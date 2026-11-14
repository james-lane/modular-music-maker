import { CONFIG } from '../config';
import { stepFrequency } from '../domain/project';
import type { Project } from '../domain/types';
import { AUDIO_FACTORIES, type AudioRuntime } from './factories';

/** One engine per studio. AudioContext is created only after a user gesture.
 * Musical notes use the audio clock and a look-ahead scheduler, never React render timing.
 */
export class AudioEngine {
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
  onStep?: (step: number, beat: number) => void;

  get sampleRate() {
    return this.context?.sampleRate ?? 48000;
  }
  get isPlaying() {
    return this.scheduler !== undefined;
  }

  private initialize() {
    if (this.context) return;
    this.context = new AudioContext({ latencyHint: 'interactive' });
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

  async play(project: Project) {
    this.initialize();
    await this.context!.resume();
    if (this.isPlaying) return;
    this.update(project);
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
    if (this.context) await this.context.suspend();
    this.onStep?.(-1, 0);
  }

  update(project: Project) {
    this.project = project;
    if (!this.context || !this.master || !this.bus) return;
    const signature = JSON.stringify([
      project.modules.map((module) => [module.id, module.type]),
      project.cables,
    ]);
    if (signature !== this.graphSignature) {
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
      this.graphSignature = signature;
    }
    this.master.gain.setTargetAtTime(project.masterVolume, this.context.currentTime, 0.025);
    for (const module of project.modules) {
      const runtime = this.runtimes.get(module.id)!;
      runtime.update(module.parameters);
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
  }

  private schedule() {
    const context = this.context;
    const project = this.project;
    if (!context || !project) return;
    // Eight eighth-notes fill one 4/4 bar. 3/4 and 6/8 use their own beat grouping.
    const stepSeconds = 60 / project.tempo / 2;
    // Background tabs can miss timer windows. Resume from now instead of bursting
    // through a backlog of notes with timestamps that are already in the past.
    if (this.nextStepTime < context.currentTime - CONFIG.audio.scheduleAheadSeconds) {
      this.nextStepTime = context.currentTime + 0.03;
    }
    while (this.nextStepTime < context.currentTime + CONFIG.audio.scheduleAheadSeconds) {
      const step = this.stepIndex % 8;
      for (const cable of project.cables) {
        if (cable.to.portId !== 'pitch') continue;
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
      const beat = Math.floor(this.stepIndex / 2) % beatsPerBar;
      const timer = setTimeout(
        () => {
          this.onStep?.(step, beat);
          this.visualTimers.delete(timer);
        },
        Math.max(0, (this.nextStepTime - context.currentTime) * 1000),
      );
      this.visualTimers.add(timer);
      this.nextStepTime += stepSeconds;
      this.stepIndex++;
    }
  }

  readWaveform(data: Uint8Array<ArrayBuffer>) {
    this.analyser?.getByteTimeDomainData(data);
  }
  readLevel(): number {
    if (!this.analyser || !this.isPlaying) return 0;
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
    await this.stop();
    this.runtimes.forEach((runtime) => runtime.dispose());
    this.runtimes.clear();
    await this.context?.close();
  }
}
