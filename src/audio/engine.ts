import { CONFIG } from '../config';
import { stepFrequency } from '../domain/project';
import {
  controllerTargets,
  connectedDrumKit,
  kitSamplerSources,
  DRUM_LANES,
  drumHitsAtStep,
  midiFrequency,
  type DrumSound,
} from '../domain/instruments';
import type { Project } from '../domain/types';
import { AUDIO_FACTORIES, type AudioRuntime } from './factories';

/** One engine per studio. AudioContext is created only after a user gesture.
 * Musical notes use the audio clock and a look-ahead scheduler, never React render timing.
 */
export class AudioEngine {
  constructor(
    private readonly createContext: () => AudioContext = () =>
      new AudioContext({ latencyHint: 'interactive' }),
  ) {}
  private context?: AudioContext;
  private master?: GainNode;
  private bus?: DynamicsCompressorNode;
  private analyser?: AnalyserNode;
  private recordingDestination?: MediaStreamAudioDestinationNode;
  private runtimes = new Map<string, AudioRuntime>();
  private project?: Project;
  private graphSignature = '';
  private scheduler?: ReturnType<typeof setInterval>;
  private visualTimers = new Set<ReturnType<typeof setTimeout>>();
  private nextStepTime = 0;
  private stepIndex = 0;
  private keyboardNotes = new Map<string, Map<number, number>>();
  onStep?: (step: number, beat: number, drumStep: number) => void;

  get sampleRate() {
    return this.context?.sampleRate ?? 48000;
  }
  get isPlaying() {
    return this.scheduler !== undefined;
  }
  get isActive() {
    return this.context?.state === 'running';
  }

  private initialize() {
    if (this.context) return;
    this.context = this.createContext();
    this.bus = this.context.createDynamicsCompressor();
    this.bus.threshold.value = -3;
    this.bus.knee.value = 3;
    this.bus.ratio.value = 16;
    this.bus.attack.value = 0.003;
    this.bus.release.value = 0.15;
    this.master = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.recordingDestination = this.context.createMediaStreamDestination();
    this.bus.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.analyser.connect(this.recordingDestination);
  }

  /** Live instruments can resume the audio device without starting the transport. */
  async activate(project: Project) {
    this.initialize();
    await this.context!.resume();
    this.update(project);
  }

  async play(project: Project) {
    await this.activate(project);
    if (this.isPlaying) return;
    this.stepIndex = 0;
    this.nextStepTime = this.context!.currentTime + 0.03;
    this.scheduler = setInterval(() => this.schedule(), CONFIG.audio.schedulerIntervalMs);
    this.schedule();
  }

  async stop() {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = undefined;
    this.visualTimers.forEach((timer) => clearTimeout(timer));
    this.visualTimers.clear();
    this.keyboardNotes.clear();
    this.runtimes.forEach((runtime) => {
      runtime.silence?.();
      if (runtime.voice && this.context) {
        runtime.voice.envelope.cancelScheduledValues(this.context.currentTime);
        runtime.voice.envelope.setValueAtTime(0, this.context.currentTime);
      }
    });
    if (this.context && this.context.state !== 'closed') await this.context.suspend();
    this.onStep?.(-1, 0, -1);
  }

  update(project: Project) {
    this.project = project;
    if (!this.context || !this.master || !this.bus) return;
    const signature = JSON.stringify([
      project.modules.map((module) => [module.id, module.type]),
      project.cables,
    ]);
    if (signature !== this.graphSignature) {
      this.keyboardNotes.clear();
      this.runtimes.forEach((runtime) => runtime.dispose());
      this.runtimes.clear();
      for (const module of project.modules)
        this.runtimes.set(module.id, AUDIO_FACTORIES[module.type](this.context, this.bus));
      for (const cable of project.cables) {
        const output = this.runtimes.get(cable.from.moduleId)?.outputs[cable.from.portId];
        const input = this.runtimes.get(cable.to.moduleId)?.inputs[cable.to.portId];
        // Pitch cables are musical events handled below, rather than audio-rate voltages.
        if (output && input) {
          if (input instanceof AudioParam) output.connect(input);
          else output.connect(input);
        }
      }
      for (const module of project.modules) {
        if (module.type !== 'drum-machine') continue;
        const kit = connectedDrumKit(project, module.id);
        if (!kit) continue;
        for (const lane of DRUM_LANES) {
          const output = this.runtimes.get(kit.id)?.outputs[lane];
          const input = this.runtimes.get(module.id)?.inputs[`kit-${lane}`];
          if (output && input) {
            if (input instanceof AudioParam) output.connect(input);
            else output.connect(input);
          }
        }
      }
      this.graphSignature = signature;
    }
    this.master.gain.setTargetAtTime(project.masterVolume, this.context.currentTime, 0.025);
    for (const module of project.modules) {
      const runtime = this.runtimes.get(module.id)!;
      runtime.update(module.parameters);
      runtime.configureSample?.(module.samples?.clip);
      if (runtime.configureKit) {
        const kit = connectedDrumKit(project, module.id);
        runtime.configureKit(kit, kitSamplerSources(project, kit));
      }
      if (
        runtime.voice &&
        !project.cables.some(
          (cable) => cable.to.moduleId === module.id && cable.to.portId === 'pitch',
        )
      ) {
        runtime.voice.frequency.setTargetAtTime(
          stepFrequency(project, 0, Number(module.parameters.octave)),
          this.context.currentTime,
          0.02,
        );
        runtime.voice.envelope.setTargetAtTime(
          Number(module.parameters.level),
          this.context.currentTime,
          0.02,
        );
      }
    }
    for (const id of this.keyboardNotes.keys()) this.updateKeyboardVoice(id);
  }

  noteOn(controllerId: string, note: number, velocity: number) {
    const notes = this.keyboardNotes.get(controllerId) ?? new Map<number, number>();
    notes.delete(note);
    notes.set(note, velocity);
    this.keyboardNotes.set(controllerId, notes);
    this.updateKeyboardVoice(controllerId);
  }

  noteOff(controllerId: string, note: number) {
    this.keyboardNotes.get(controllerId)?.delete(note);
    this.updateKeyboardVoice(controllerId);
  }

  releaseKeyboard(controllerId: string) {
    this.keyboardNotes.delete(controllerId);
    this.updateKeyboardVoice(controllerId);
  }

  private updateKeyboardVoice(controllerId: string) {
    if (!this.context || !this.project) return;
    const controller = this.project.modules.find((module) => module.id === controllerId);
    const held = [...(this.keyboardNotes.get(controllerId) ?? [])].at(-1);
    for (const id of controllerTargets(this.project, controllerId, 'pitch')) {
      const target = this.project.modules.find((module) => module.id === id);
      const voice = this.runtimes.get(id)?.voice;
      if (!voice || !target || !controller) continue;
      const now = this.context.currentTime;
      // Cancel the previous envelope so releasing or changing a held note cannot leave a drone.
      voice.envelope.cancelScheduledValues(now);
      if (held) {
        const [note, velocity] = held;
        voice.frequency.setTargetAtTime(
          midiFrequency(
            note + (Number(controller.parameters.octave) + Number(target.parameters.octave)) * 12,
          ),
          now,
          0.005,
        );
        voice.envelope.setTargetAtTime(Number(target.parameters.level) * velocity, now, 0.008);
      } else voice.envelope.setTargetAtTime(0, now, 0.015);
    }
  }

  hitDrum(moduleId: string, sound: DrumSound, velocity: number) {
    if (!this.context || !this.project) return;
    const module = this.project.modules.find((item) => item.id === moduleId);
    if (module?.type === 'drum-kit') {
      for (const id of controllerTargets(this.project, moduleId, 'kit'))
        this.hitDrum(id, sound, velocity);
    } else this.runtimes.get(moduleId)?.trigger?.(sound, velocity, this.context.currentTime);
  }

  hitSample(moduleId: string) {
    if (this.project?.modules.find((module) => module.id === moduleId)?.type === 'mic-sampler')
      this.runtimes.get(moduleId)?.trigger?.('kick', 1, this.context?.currentTime ?? 0);
  }

  hitPad(controllerId: string, sound: DrumSound, velocity: number) {
    if (!this.project) return;
    controllerTargets(this.project, controllerId, 'trigger').forEach((id) =>
      this.hitDrum(id, sound, velocity),
    );
  }

  private schedule() {
    const context = this.context;
    const project = this.project;
    if (!context || !project) return;
    // The shared clock ticks sixteenths. Existing melodic patterns advance every other tick.
    const tickSeconds = 60 / project.tempo / 4;
    const stepSeconds = tickSeconds * 2;
    // Background tabs can miss timer windows. Resume from now instead of bursting
    // through a backlog of notes with timestamps that are already in the past.
    if (this.nextStepTime < context.currentTime - CONFIG.audio.scheduleAheadSeconds) {
      this.nextStepTime = context.currentTime + 0.03;
    }
    while (this.nextStepTime < context.currentTime + CONFIG.audio.scheduleAheadSeconds) {
      const step = Math.floor(this.stepIndex / 2) % 8;
      const drumStep = this.stepIndex % 16;
      for (const module of project.modules) {
        for (const sound of drumHitsAtStep(module, drumStep))
          this.runtimes.get(module.id)?.trigger?.(sound, 0.85, this.nextStepTime);
      }
      for (const cable of project.cables) {
        if (cable.to.portId !== 'pitch' || this.stepIndex % 2 !== 0) continue;
        const sequencer = project.modules.find((module) => module.id === cable.from.moduleId);
        const oscillator = project.modules.find((module) => module.id === cable.to.moduleId);
        const voice = this.runtimes.get(cable.to.moduleId)?.voice;
        if (!sequencer?.steps || !oscillator || !voice) continue;
        const degree = sequencer.steps[step];
        const start = this.nextStepTime;
        const gate = stepSeconds * Number(sequencer.parameters.gate);
        voice.envelope.cancelScheduledValues(start);
        voice.envelope.setValueAtTime(0, start);
        if (degree >= 0) {
          voice.frequency.setValueAtTime(
            stepFrequency(project, degree, Number(oscillator.parameters.octave)),
            start,
          );
          voice.envelope.linearRampToValueAtTime(
            Number(oscillator.parameters.level),
            start + 0.008,
          );
          voice.envelope.setValueAtTime(Number(oscillator.parameters.level), start + gate);
          voice.envelope.linearRampToValueAtTime(
            0,
            start + Math.min(stepSeconds - 0.005, gate + 0.035),
          );
        }
      }
      const beatsPerBar = project.timeSignature === '4/4' ? 4 : 3;
      const beat = Math.floor(this.stepIndex / 4) % beatsPerBar;
      const timer = setTimeout(
        () => {
          this.onStep?.(step, beat, drumStep);
          this.visualTimers.delete(timer);
        },
        Math.max(0, (this.nextStepTime - context.currentTime) * 1000),
      );
      this.visualTimers.add(timer);
      this.nextStepTime += tickSeconds;
      this.stepIndex++;
    }
  }

  remainingTailSeconds(): number {
    return Math.max(
      0,
      ...[...this.runtimes.values()].map((runtime) => runtime.remainingTailSeconds?.() ?? 0),
    );
  }

  readWaveform(data: Uint8Array<ArrayBuffer>) {
    this.analyser?.getByteTimeDomainData(data);
  }
  readLevel(): number {
    if (!this.analyser || !this.isActive) return 0;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    return Math.sqrt(
      data.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / data.length,
    );
  }
  getRecordingStream(): MediaStream {
    this.initialize();
    return this.recordingDestination!.stream;
  }
  async dispose() {
    // Detach synchronously before closing asynchronously. React Fast Refresh can reuse
    // this engine while the previous context's close() promise is still pending.
    const context = this.context;
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = undefined;
    this.visualTimers.forEach((timer) => clearTimeout(timer));
    this.visualTimers.clear();
    this.keyboardNotes.clear();
    this.runtimes.forEach((runtime) => runtime.dispose());
    this.runtimes.clear();
    this.graphSignature = '';
    this.context = undefined;
    this.master = undefined;
    this.bus = undefined;
    this.analyser = undefined;
    this.recordingDestination = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
}
