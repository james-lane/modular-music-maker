import { boundedModulation } from './modulation';
import { CONFIG } from '../config';
import { decodeSamplePcm, sampleRegion } from '../domain/samples';
import type { DrumSample, Parameters } from '../domain/types';
import type { AudioRuntime, SampleModulation } from './factories';

/** Playback owns only saved PCM. The microphone never enters the studio graph. */
export function createMicSampler(context: AudioContext): AudioRuntime {
  const output = context.createGain();
  const pitchMod = boundedModulation(context, CONFIG.audio.modulation.pitchCents);
  // With no cable this multiplier is unity. A patched level signal opens 0..100%
  // of the saved Level, giving envelopes a true silent baseline and bounding gain.
  const levelMod = boundedModulation(context, 1, 1, true);
  const modulation: SampleModulation = {
    pitch: pitchMod.output,
    level: levelMod.output,
    pitchActive: false,
    levelActive: false,
  };
  const levelGain = context.createGain();
  levelGain.gain.value = 0;
  levelMod.output.connect(levelGain.gain);
  levelGain.connect(output);
  output.gain.value = 0;
  let pcm: string | undefined;
  let buffer: AudioBuffer | undefined;
  let rate = 1;
  let trim: Parameters = {};
  const voices = new Set<{ source: AudioBufferSourceNode; envelope: GainNode; end: number }>();
  const disconnect = (voice: {
    source: AudioBufferSourceNode;
    envelope: GainNode;
    end: number;
  }) => {
    if (!voices.has(voice)) return;
    if (modulation.pitchActive) pitchMod.output.disconnect(voice.source.detune);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.envelope.disconnect();
    voices.delete(voice);
  };
  const silence = () => {
    for (const voice of [...voices]) {
      voice.source.stop();
      disconnect(voice);
    }
  };
  return {
    inputs: { rateMod: pitchMod.input, levelMod: levelMod.input },
    sampleModulation: modulation,
    configureConnections(ports) {
      modulation.pitchActive = ports.has('rateMod');
      modulation.levelActive = ports.has('levelMod');
      levelMod.setBase(modulation.levelActive ? 0 : 1);
    },
    outputs: { out: output },
    update(parameters) {
      output.gain.setTargetAtTime(
        Number(parameters.level),
        context.currentTime,
        CONFIG.audio.parameterRampSeconds,
      );
      // A speed change applies to the next hit so its end envelope stays on the audio clock.
      rate = Number(parameters.rate);
      trim = parameters;
    },
    configureSample(sample: DrumSample | undefined) {
      if (sample?.pcm === pcm) return;
      silence();
      pcm = sample?.pcm;
      buffer = undefined;
      if (!pcm) return;
      const data = decodeSamplePcm(pcm);
      buffer = context.createBuffer(1, data.length, CONFIG.samples.sampleRate);
      buffer.copyToChannel(data, 0);
    },
    trigger(_sound, velocity, time) {
      if (!buffer || !pcm) return;
      const start = Math.max(time, context.currentTime);
      const fade = CONFIG.audio.samplerFadeSeconds;
      // A retrigger restarts the clip, with a short retiring tail to avoid a hard cut.
      for (const voice of voices) {
        voice.envelope.gain.cancelScheduledValues(start);
        voice.envelope.gain.setTargetAtTime(0, start, fade / 3);
        voice.source.stop(start + fade);
      }
      while (voices.size >= CONFIG.audio.maxSamplerTails) {
        const oldest = voices.values().next().value;
        if (!oldest) break;
        oldest.source.stop();
        disconnect(oldest);
      }
      const source = context.createBufferSource();
      const envelope = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const region = sampleRegion(pcm, trim);
      const duration = (region.duration / rate) * (modulation.pitchActive ? 2 : 1);
      const edge = Math.min(fade, duration / 2);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(velocity, start + edge);
      envelope.gain.setValueAtTime(velocity, start + duration - edge);
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(envelope);
      envelope.connect(levelGain);
      if (modulation.pitchActive) pitchMod.output.connect(source.detune);
      const voice = { source, envelope, end: start + duration };
      voices.add(voice);
      source.onended = () => disconnect(voice);
      // Native source-duration counts clip frames, so speed modulation changes
      // playback length without reading/trimming past the selected region.
      if (modulation.pitchActive) source.start(start, region.startSeconds, region.duration);
      else source.start(start, region.startSeconds);
      source.stop(start + duration);
    },
    remainingTailSeconds: () =>
      Math.max(0, ...[...voices].map((voice) => voice.end - context.currentTime)),
    silence,
    dispose() {
      silence();
      pitchMod.dispose();
      levelMod.dispose();
      levelGain.disconnect();
      output.disconnect();
      buffer = undefined;
    },
  };
}
