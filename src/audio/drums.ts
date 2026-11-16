import { CONFIG } from '../config';
import {
  DRUM_LANES,
  DRUM_SOUNDS,
  type DrumLane,
  type DrumSound,
  type KitSamplerSources,
} from '../domain/instruments';
import { decodeSamplePcm, sampleRegion } from '../domain/samples';
import type { Parameters, PatchModule } from '../domain/types';
import type { AudioRuntime, SampleModulation } from './factories';

interface Tone {
  frequency: number;
  endFrequency?: number;
  duration: number;
  level: number;
  wave?: OscillatorType;
}
interface DrumRecipe {
  tones?: Tone[];
  noise?: {
    frequency: number;
    duration: number;
    level: number;
    filter: BiquadFilterType;
    bursts?: number;
  };
}

/** Small editable synthesis recipes. No audio files, microphones, or downloads are needed. */
export const DRUM_RECIPES: Record<DrumSound, DrumRecipe> = {
  kick: { tones: [{ frequency: 150, endFrequency: 42, duration: 0.48, level: 0.9 }] },
  snare: {
    tones: [{ frequency: 185, endFrequency: 120, duration: 0.16, level: 0.3 }],
    noise: { frequency: 1800, duration: 0.22, level: 0.65, filter: 'highpass' },
  },
  clap: { noise: { frequency: 1400, duration: 0.22, level: 0.8, filter: 'bandpass', bursts: 3 } },
  'closed-hat': { noise: { frequency: 7500, duration: 0.07, level: 0.38, filter: 'highpass' } },
  'open-hat': { noise: { frequency: 6500, duration: 0.5, level: 0.33, filter: 'highpass' } },
  'low-tom': { tones: [{ frequency: 160, endFrequency: 75, duration: 0.45, level: 0.7 }] },
  'high-tom': { tones: [{ frequency: 270, endFrequency: 145, duration: 0.32, level: 0.65 }] },
  rim: {
    tones: [
      { frequency: 780, duration: 0.035, level: 0.35, wave: 'triangle' },
      { frequency: 1800, duration: 0.025, level: 0.2, wave: 'square' },
    ],
  },
  shaker: { noise: { frequency: 5000, duration: 0.11, level: 0.4, filter: 'bandpass' } },
  crash: {
    tones: [{ frequency: 4020, duration: 0.3, level: 0.035, wave: 'square' }],
    noise: { frequency: 5500, duration: 1.6, level: 0.4, filter: 'highpass' },
  },
  ride: {
    tones: [
      { frequency: 4200, duration: 0.75, level: 0.12, wave: 'square' },
      { frequency: 6300, duration: 0.6, level: 0.08, wave: 'triangle' },
    ],
    noise: { frequency: 8000, duration: 0.25, level: 0.12, filter: 'highpass' },
  },
  cowbell: {
    tones: [
      { frequency: 540, duration: 0.2, level: 0.25, wave: 'square' },
      { frequency: 800, duration: 0.16, level: 0.2, wave: 'square' },
    ],
  },
  tambourine: {
    tones: [{ frequency: 7200, duration: 0.18, level: 0.05, wave: 'square' }],
    noise: { frequency: 7000, duration: 0.26, level: 0.36, filter: 'highpass', bursts: 2 },
  },
  claves: { tones: [{ frequency: 2400, duration: 0.06, level: 0.4 }] },
  'low-conga': { tones: [{ frequency: 230, endFrequency: 170, duration: 0.3, level: 0.65 }] },
  'high-conga': { tones: [{ frequency: 370, endFrequency: 260, duration: 0.22, level: 0.6 }] },
};

interface ActiveHit {
  sound: DrumSound;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  endTime?: number;
  modulationConnections?: { source: AudioNode; target: AudioParam }[];
  inputConnection?: { input: AudioNode; gain: GainNode };
}

export function createDrumRuntime(context: AudioContext): AudioRuntime {
  const output = context.createGain();
  const noiseBuffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * 2.5),
    context.sampleRate,
  );
  const samples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const inputs = Object.fromEntries(DRUM_LANES.map((lane) => [lane, context.createGain()]));
  const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
  let kit: PatchModule | undefined;
  let samplers: KitSamplerSources = {};
  let effectInputs: Partial<Record<DrumLane, AudioNode>> = {};
  let modulation: Partial<Record<DrumLane, SampleModulation>> = {};
  const sampleBuffers = new Map<string, { pcm: string; buffer: AudioBuffer }>();
  const active = new Set<ActiveHit>();
  let parameters: Parameters = { tone: 0, decay: 0.8, level: 0.7 };

  const clean = (hit: ActiveHit) => {
    // Stop and a later onended callback can both reach cleanup.
    if (!active.has(hit)) return;
    hit.modulationConnections?.forEach(({ source, target }) => source.disconnect(target));
    if (hit.inputConnection) hit.inputConnection.input.disconnect(hit.inputConnection.gain);
    hit.nodes.forEach((node) => node.disconnect());
    active.delete(hit);
  };
  const stopHit = (hit: ActiveHit) => {
    hit.sources.forEach((source) => source.stop());
    clean(hit);
  };

  return {
    inputs: Object.fromEntries(DRUM_LANES.map((lane) => [`kit-${lane}`, inputs[lane]])),
    configureKit(next, nextSamplers = {}, nextEffectInputs = {}, nextModulation = {}) {
      modulation = nextModulation;
      effectInputs = nextEffectInputs;
      kit = next;
      samplers = nextSamplers;
      for (const lane of DRUM_LANES) {
        const sample =
          next?.parameters[lane] === 'input' && nextSamplers[lane]
            ? nextSamplers[lane]?.samples?.clip
            : next?.samples?.[lane];
        if (!sample) sampleBuffers.delete(lane);
        else if (sampleBuffers.get(lane)?.pcm !== sample.pcm) {
          const data = decodeSamplePcm(sample.pcm);
          const buffer = context.createBuffer(1, data.length, CONFIG.samples.sampleRate);
          buffer.copyToChannel(data, 0);
          sampleBuffers.set(lane, { pcm: sample.pcm, buffer });
        }
      }
    },
    outputs: { out: output },
    update(next) {
      parameters = next;
      output.gain.setTargetAtTime(
        Number(next.level),
        context.currentTime,
        CONFIG.audio.parameterRampSeconds,
      );
    },
    trigger(sound, velocity, when) {
      // Lane identity stays stable in patterns and the first four pads. Resolve once,
      // so choosing a sound never recursively remaps another lane or rewrites a pattern.
      const lane = DRUM_LANES.find((lane) => lane === sound);
      const source = lane ? (kit?.parameters[lane] ?? lane) : sound;
      const sampler = source === 'input' && lane ? samplers[lane] : undefined;
      const builtIn = DRUM_SOUNDS.find((item) => item.id === source)?.id;
      const recipe = builtIn ? DRUM_RECIPES[builtIn] : undefined;
      const sample = source === 'sample' || sampler ? sampleBuffers.get(sound)?.buffer : undefined;
      // An empty linked sampler must stay silent, even if its audio bus is connected.
      if (sampler && !sample) return;
      if (!recipe && !sample && source !== 'input') return;
      // Like a real kit, a closed hat cuts the open hat short. Bound overlap under rapid playing.
      if (source === 'closed-hat')
        [...active].filter((hit) => hit.sound === 'open-hat').forEach(stopHit);
      if (active.size >= CONFIG.audio.maxDrumHits) stopHit(active.values().next().value!);
      const start = Math.max(context.currentTime, when);
      const decay = Number(parameters.decay);
      const pitch = 2 ** (Number(parameters.tone) / 12);
      const strength = Math.max(0.01, Math.min(1, velocity));
      const hit: ActiveHit = { sound: builtIn ?? sound, sources: [], nodes: [] };
      active.add(hit);

      const envelope = (duration: number, level: number, bursts = 1) => {
        const gain = context.createGain();
        gain.gain.value = 0;
        const end = start + duration * decay;
        gain.gain.setValueAtTime(0.0001, start);
        for (let burst = 0; burst < bursts; burst++) {
          const at = start + burst * 0.012;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.linearRampToValueAtTime(level * strength, at + 0.002);
        }
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          Math.max(end, start + bursts * 0.012 + 0.01),
        );
        gain.connect(output);
        hit.nodes.push(gain);
        const finalEnd = Math.max(end, start + bursts * 0.012 + 0.01);
        hit.endTime = Math.max(hit.endTime ?? 0, finalEnd + 0.01);
        return { gain, end: finalEnd };
      };

      if (sample) {
        // Saved sounds are independent one-shots, never gates over the sampler's live bus.
        // Decay shapes only their tail: it must not shorten the source or steal another hit.
        const player = context.createBufferSource();
        const gain = context.createGain();
        const clip = sampler?.samples?.clip;
        const region =
          clip && sampler
            ? sampleRegion(clip.pcm, sampler.parameters)
            : { startSeconds: 0, duration: sample.duration };
        const rate = pitch * (sampler ? Number(sampler.parameters.rate) : 1);
        const mod = sampler && lane ? modulation[lane] : undefined;
        const duration = (region.duration / rate) * (mod?.pitchActive ? 2 : 1);
        const end = start + duration;
        const edge = Math.min(CONFIG.audio.samplerFadeSeconds, duration / 2);
        const release = Math.min(
          duration - edge,
          Math.max(edge, duration * (1 - Math.min(1, decay))),
        );
        const level = strength * (sampler ? Number(sampler.parameters.level) : 1);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + edge);
        gain.gain.setValueAtTime(level, end - release);
        gain.gain.linearRampToValueAtTime(0, end);
        // The private effect rack returns to this machine's output, preserving tails
        // and isolating fan-out to other lanes, drum machines and ordinary audio routes.
        const destination = (lane && effectInputs[lane]) || output;
        hit.modulationConnections = [];
        if (mod?.levelActive) {
          const modGain = context.createGain();
          modGain.gain.value = 0;
          mod.level.connect(modGain.gain);
          hit.modulationConnections.push({ source: mod.level, target: modGain.gain });
          gain.connect(modGain);
          modGain.connect(destination);
          hit.nodes.push(modGain);
        } else gain.connect(destination);
        if (mod?.pitchActive) {
          mod.pitch.connect(player.detune);
          hit.modulationConnections.push({ source: mod.pitch, target: player.detune });
        }
        player.buffer = sample;
        player.playbackRate.value = rate;
        player.connect(gain);
        hit.sources.push(player);
        hit.nodes.push(player, gain);
        hit.endTime = end;
        if (mod?.pitchActive) player.start(start, region.startSeconds, region.duration);
        else player.start(start, region.startSeconds);
        player.stop(end);
      } else if (source === 'input') {
        const player = context.createBufferSource();
        const { gain, end } = envelope(Number(kit?.parameters.length ?? 0.3), 1);
        const input = inputs[sound];
        input.connect(gain);
        hit.inputConnection = { input, gain };
        // A silent looping source gives ordinary live-input gates audio-clock cleanup.
        player.buffer = silentBuffer;
        player.loop = true;
        player.connect(gain);
        hit.sources.push(player);
        hit.nodes.push(player);
        player.start(start);
        player.stop(end + 0.01);
      }
      for (const tone of recipe?.tones ?? []) {
        const oscillator = context.createOscillator();
        const { gain, end } = envelope(tone.duration, tone.level);
        oscillator.type = tone.wave ?? 'sine';
        oscillator.frequency.setValueAtTime(tone.frequency * pitch, start);
        if (tone.endFrequency)
          oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency * pitch, end);
        oscillator.connect(gain);
        hit.sources.push(oscillator);
        hit.nodes.push(oscillator);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
      }
      if (recipe?.noise) {
        const noise = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const { gain, end } = envelope(
          recipe.noise.duration,
          recipe.noise.level,
          recipe.noise.bursts,
        );
        noise.buffer = noiseBuffer;
        filter.type = recipe.noise.filter;
        filter.frequency.value = Math.min(
          context.sampleRate / 2 - 100,
          recipe.noise.frequency * pitch,
        );
        filter.Q.value = 0.8;
        noise.connect(filter);
        filter.connect(gain);
        hit.sources.push(noise);
        hit.nodes.push(noise, filter);
        noise.start(start);
        noise.stop(end + 0.01);
      }
      // Each hit owns all its nodes until its final source finishes, including scheduled hits.
      let remaining = hit.sources.length;
      hit.sources.forEach((source) => {
        source.onended = () => {
          if (--remaining === 0) clean(hit);
        };
      });
    },
    remainingTailSeconds() {
      return Math.max(0, ...[...active].map((hit) => (hit.endTime ?? 0) - context.currentTime));
    },
    silence() {
      [...active].forEach(stopHit);
    },
    dispose() {
      [...active].forEach(stopHit);
      Object.values(inputs).forEach((input) => input.disconnect());
      sampleBuffers.clear();
      output.disconnect();
    },
  };
}
