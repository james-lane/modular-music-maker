import { KitEffects } from './kit-effects';
import { CONFIG } from '../config';
import { stepFrequency } from '../domain/project';
import { sequencerRate } from '../domain/modules';
import {
  controllerTargets,
  connectedDrumKit,
  kitSamplerSources,
  DRUM_LANES,
  DRUM_SOUNDS,
  drumHitsAtStep,
  midiFrequency,
  type DrumSound,
} from '../domain/instruments';
import type { PatchModule, Project } from '../domain/types';
import { switchInputAtBar, ticksPerBar } from '../domain/switch-schedule';
import { padTargets } from '../domain/pad-controller';
import { AUDIO_FACTORIES, type AudioRuntime } from './factories';
import { audioSession } from './session';

/** One engine per studio. AudioContext is created only after a user gesture.
 * Musical notes use the audio clock and a look-ahead scheduler, never React render timing.
 */
export class AudioEngine {
  constructor(
    private readonly createContext: () => AudioContext = () =>
      new AudioContext({ latencyHint: 'interactive' }),
  ) {}
  private context?: AudioContext;
  private releaseSession?: () => void;
  private master?: GainNode;
  private bus?: DynamicsCompressorNode;
  private analyser?: AnalyserNode;
  private recordingDestination?: MediaStreamAudioDestinationNode;
  private runtimes = new Map<string, AudioRuntime>();
  private project?: Project;
  private kitEffects?: KitEffects;
  private controlAnalysers = new Map<
    string,
    { source: AudioNode; analyser: AnalyserNode; data: Float32Array<ArrayBuffer> }
  >();
  private samplePreview?: { moduleId: string; runtime: AudioRuntime };
  private graphSignature = '';
  private scheduler?: ReturnType<typeof setInterval>;
  private visualTimers = new Set<ReturnType<typeof setTimeout>>();
  private nextStepTime = 0;
  private tickIndex = 0;
  /** Retain only the current/future audio ticks so edits can replace queued Switch cues. */
  private scheduledTicks: { tick: number; time: number }[] = [];
  private switchStates = new Map<string, { signature: string; lastSelected: number }>();
  private keyboardNotes = new Map<string, Map<number, number>>();
  onTick?: (tick: number, beat: number, drumStep: number) => void;

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
    // Declare music playback before waking Web Audio so iPhone Silent mode
    // does not mute instruments. Browsing and passive previews never acquire it.
    this.releaseSession ??= audioSession.acquire('playback');
    try {
      this.initialize();
      await this.context!.resume();
      this.update(project);
    } catch (error) {
      if (!this.isActive) {
        this.releaseSession?.();
        this.releaseSession = undefined;
      }
      throw error;
    }
  }

  async play(project: Project) {
    await this.activate(project);
    if (this.isPlaying) return;
    this.tickIndex = 0;
    this.nextStepTime = this.context!.currentTime + 0.03;
    this.scheduler = setInterval(() => this.schedule(), CONFIG.audio.schedulerIntervalMs);
    this.scheduledTicks = [];
    this.switchStates.clear();
    for (const module of project.modules) if (module.type === 'switch') this.syncSwitch(module);
    this.schedule();
  }

  async stop() {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = undefined;
    this.scheduledTicks = [];
    this.switchStates.clear();
    this.visualTimers.forEach((timer) => clearTimeout(timer));
    this.visualTimers.clear();
    this.keyboardNotes.clear();
    this.samplePreview?.runtime.silence?.();
    this.runtimes.forEach((runtime) => {
      runtime.silence?.();
      if (runtime.voice && this.context) {
        runtime.voice.envelope.cancelScheduledValues(this.context.currentTime);
        runtime.voice.envelope.setValueAtTime(0, this.context.currentTime);
      }
    });
    const releaseSession = this.releaseSession;
    this.releaseSession = undefined;
    try {
      if (this.context && this.context.state !== 'closed') await this.context.suspend();
    } finally {
      releaseSession?.();
    }
    this.onTick?.(-1, 0, -1);
  }

  update(project: Project) {
    if (this.project?.id !== project.id) this.disposeSamplePreview();
    this.project = project;
    if (this.samplePreview) {
      const module = project.modules.find((item) => item.id === this.samplePreview?.moduleId);
      if (module?.type === 'mic-sampler') {
        this.samplePreview.runtime.update(module.parameters);
        this.samplePreview.runtime.configureSample?.(module.samples?.clip);
      } else this.disposeSamplePreview();
    }
    if (!this.context || !this.master || !this.bus) return;
    const signature = JSON.stringify([
      project.modules.map((module) => [module.id, module.type]),
      project.cables,
    ]);
    if (signature !== this.graphSignature) {
      this.keyboardNotes.clear();
      this.disposeControlAnalysers();
      // Consumers detach per-hit modulation taps before producer buses disconnect.
      this.runtimes.forEach((runtime) => runtime.silence?.());
      this.kitEffects?.dispose();
      this.kitEffects = undefined;
      this.runtimes.forEach((runtime) => runtime.dispose());
      this.runtimes.clear();
      this.switchStates.clear();
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
      this.kitEffects = new KitEffects(this.context, project, this.runtimes);
      this.graphSignature = signature;
    }
    this.kitEffects?.update(project);
    this.master.gain.setTargetAtTime(project.masterVolume, this.context.currentTime, 0.025);
    // Configure all source flags before kits read their shared modulation buses.
    for (const module of project.modules) {
      this.runtimes
        .get(module.id)
        ?.configureConnections?.(
          new Set(
            project.cables
              .filter((cable) => cable.to.moduleId === module.id)
              .map((cable) => cable.to.portId),
          ),
        );
    }
    for (const module of project.modules) {
      const runtime = this.runtimes.get(module.id)!;
      if (module.type === 'switch') this.syncSwitch(module);
      else runtime.update(module.parameters);
      runtime.configureSample?.(module.samples?.clip);
      if (runtime.configureKit) {
        const kit = connectedDrumKit(project, module.id);
        const samplers = kitSamplerSources(project, kit);
        runtime.configureKit(
          kit,
          samplers,
          this.kitEffects?.inputs.get(module.id),
          Object.fromEntries(
            Object.entries(samplers).flatMap(([lane, sampler]) => {
              const modulation = this.runtimes.get(sampler.id)?.sampleModulation;
              return modulation ? [[lane, modulation]] : [];
            }),
          ),
        );
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
    this.updateKeyboardVoice(controllerId, true);
  }

  noteOff(controllerId: string, note: number) {
    this.keyboardNotes.get(controllerId)?.delete(note);
    this.updateKeyboardVoice(controllerId, true);
  }

  releaseKeyboard(controllerId: string) {
    this.keyboardNotes.delete(controllerId);
    this.updateKeyboardVoice(controllerId, true);
  }

  private updateKeyboardVoice(controllerId: string, gateChanged = false) {
    if (!this.context || !this.project) return;
    const controller = this.project.modules.find((module) => module.id === controllerId);
    const held = [...(this.keyboardNotes.get(controllerId) ?? [])].at(-1);
    for (const id of controllerTargets(this.project, controllerId, 'pitch')) {
      const target = this.project.modules.find((module) => module.id === id);
      const runtime = this.runtimes.get(id);
      if (gateChanged) runtime?.gate?.(Boolean(held), held?.[1] ?? 0, this.context.currentTime);
      const voice = runtime?.voice;
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

  /** Audition dry saved audio independently of Output routing, mute, and recording. */
  hitSample(moduleId: string) {
    const module = this.project?.modules.find((item) => item.id === moduleId);
    if (!this.context || module?.type !== 'mic-sampler' || !module.samples?.clip) return;
    if (this.samplePreview?.moduleId !== moduleId) {
      this.disposeSamplePreview();
      const runtime = AUDIO_FACTORIES['mic-sampler'](this.context, this.context.destination);
      runtime.outputs.out.connect(this.context.destination);
      this.samplePreview = { moduleId, runtime };
    }
    const { runtime } = this.samplePreview;
    runtime.update(module.parameters);
    runtime.configureSample?.(module.samples.clip);
    runtime.trigger?.('kick', 1, this.context.currentTime);
  }

  private disposeSamplePreview() {
    this.samplePreview?.runtime.dispose();
    this.samplePreview = undefined;
  }

  hitPad(controllerId: string, index: number, velocity: number) {
    if (!this.project) return;
    padTargets(this.project, controllerId, index).forEach((id) =>
      this.hitDrum(id, DRUM_SOUNDS[index].id, velocity),
    );
  }

  private syncSwitch(module: PatchModule) {
    const runtime = this.runtimes.get(module.id),
      context = this.context,
      project = this.project;
    if (!runtime?.resetSelection || !context || !project) return;
    const signature = JSON.stringify([
      project.id,
      module.parameters,
      module.switchCues,
      project.tempo,
      project.timeSignature,
      this.isPlaying,
    ]);
    if (this.switchStates.get(module.id)?.signature === signature) return;
    const running = this.isPlaying && Boolean(module.parameters.automatic);
    const current = this.scheduledTicks.filter((item) => item.time <= context.currentTime).at(-1);
    const selected = running
      ? current
        ? switchInputAtBar(module, Math.floor(current.tick / ticksPerBar(project.timeSignature)))
        : 0
      : Number(module.parameters.selected);
    runtime.resetSelection(selected);
    this.switchStates.set(module.id, { signature, lastSelected: selected });
    if (running)
      for (const item of this.scheduledTicks) {
        if (item.time > context.currentTime) this.scheduleSwitch(module, item.tick, item.time);
      }
  }

  private scheduleSwitch(module: PatchModule, tick: number, time: number) {
    if (!this.project || !module.parameters.automatic) return;
    const state = this.switchStates.get(module.id);
    const selected = switchInputAtBar(
      module,
      Math.floor(tick / ticksPerBar(this.project.timeSignature)),
    );
    if (!state || selected === state.lastSelected) return;
    this.runtimes.get(module.id)?.selectInput?.(selected, time);
    state.lastSelected = selected;
  }

  private schedule() {
    const context = this.context;
    const project = this.project;
    if (!context || !project) return;
    // All rates divide this shared sixteenth-note clock, including after live rate edits.
    const tickSeconds = 60 / project.tempo / 4;
    // Background tabs can miss timer windows. Resume from now instead of bursting
    // through a backlog of notes with timestamps that are already in the past.
    if (this.nextStepTime < context.currentTime - CONFIG.audio.scheduleAheadSeconds) {
      this.nextStepTime = context.currentTime + 0.03;
    }
    while (this.nextStepTime < context.currentTime + CONFIG.audio.scheduleAheadSeconds) {
      const tick = this.tickIndex;
      this.scheduledTicks.push({ tick, time: this.nextStepTime });
      while (this.scheduledTicks.length > 1 && this.scheduledTicks[1].time <= context.currentTime)
        this.scheduledTicks.shift();
      const drumStep = this.tickIndex % 16;
      for (const module of project.modules) {
        if (module.type === 'switch') this.scheduleSwitch(module, tick, this.nextStepTime);
        this.runtimes.get(module.id)?.scheduleControl?.(tick, this.nextStepTime);
        for (const sound of drumHitsAtStep(module, drumStep))
          this.runtimes.get(module.id)?.trigger?.(sound, 0.85, this.nextStepTime);
      }
      for (const cable of project.cables) {
        if (cable.to.portId !== 'pitch' && cable.to.portId !== 'gate') continue;
        const sequencer = project.modules.find((module) => module.id === cable.from.moduleId);
        const targetModule = project.modules.find((module) => module.id === cable.to.moduleId);
        const voice = this.runtimes.get(cable.to.moduleId)?.voice;
        if (sequencer?.type !== 'sequencer' || !sequencer.steps || !targetModule) continue;
        const ticksPerStep = sequencerRate(sequencer.parameters.rate).ticks;
        if (tick % ticksPerStep !== 0) continue;
        const step = Math.floor(tick / ticksPerStep) % sequencer.steps.length;
        const stepSeconds = tickSeconds * ticksPerStep;
        const degree = sequencer.steps[step];
        const start = this.nextStepTime;
        const gate = stepSeconds * Number(sequencer.parameters.gate);
        const runtime = this.runtimes.get(cable.to.moduleId);
        if (runtime?.gate) {
          if (degree >= 0) {
            runtime.gate(true, 1, start);
            runtime.gate(false, 0, start + gate);
          } else runtime.gate(false, 0, start);
        }
        if (!voice) continue;
        voice.envelope.cancelScheduledValues(start);
        voice.envelope.setValueAtTime(0, start);
        if (degree >= 0) {
          voice.frequency.setValueAtTime(
            stepFrequency(project, degree, Number(targetModule.parameters.octave)),
            start,
          );
          voice.envelope.linearRampToValueAtTime(
            Number(targetModule.parameters.level),
            start + Math.min(0.008, gate * 0.8),
          );
          voice.envelope.setValueAtTime(Number(targetModule.parameters.level), start + gate);
          // Leave silence before the next onset, but keep release after the hold even
          // at 1/16, maximum tempo and a long gate. Reversed events can leave a drone.
          const endGap = Math.min(0.005, (stepSeconds - gate) / 2);
          voice.envelope.linearRampToValueAtTime(
            0,
            start + Math.min(stepSeconds - endGap, gate + 0.035),
          );
        }
      }
      const beatsPerBar = project.timeSignature === '4/4' ? 4 : 3;
      const beat = Math.floor(this.tickIndex / 4) % beatsPerBar;
      const timer = setTimeout(
        () => {
          this.onTick?.(tick, beat, drumStep);
          this.visualTimers.delete(timer);
        },
        Math.max(0, (this.nextStepTime - context.currentTime) * 1000),
      );
      this.visualTimers.add(timer);
      this.nextStepTime += tickSeconds;
      this.tickIndex++;
    }
  }

  remainingTailSeconds(): number {
    return Math.max(
      0,
      this.samplePreview?.runtime.remainingTailSeconds?.() ?? 0,
      ...[...this.runtimes.values()].map((runtime) => runtime.remainingTailSeconds?.() ?? 0),
    );
  }

  /** Lazily meter requested control screens; these taps never reach the speakers. */
  readControl(moduleId: string, portId: string): number {
    if (!this.context) return 0;
    const key = `${moduleId}:${portId}`;
    let meter = this.controlAnalysers.get(key);
    if (!meter) {
      const source = this.runtimes.get(moduleId)?.outputs[portId];
      if (!source) return 0;
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      meter = { source, analyser, data: new Float32Array(256) };
      this.controlAnalysers.set(key, meter);
    }
    meter.analyser.getFloatTimeDomainData(meter.data);
    return meter.data.reduce((sum, value) => sum + value, 0) / meter.data.length;
  }

  private disposeControlAnalysers() {
    for (const { source, analyser } of this.controlAnalysers.values()) {
      source.disconnect(analyser);
      analyser.disconnect();
    }
    this.controlAnalysers.clear();
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
    this.disposeControlAnalysers();
    this.runtimes.forEach((runtime) => runtime.silence?.());
    this.kitEffects?.dispose();
    this.kitEffects = undefined;
    this.runtimes.forEach((runtime) => runtime.dispose());
    this.runtimes.clear();
    this.disposeSamplePreview();
    this.graphSignature = '';
    this.scheduledTicks = [];
    this.switchStates.clear();
    this.context = undefined;
    this.master = undefined;
    this.bus = undefined;
    this.analyser = undefined;
    this.recordingDestination = undefined;
    this.releaseSession?.();
    this.releaseSession = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
}
