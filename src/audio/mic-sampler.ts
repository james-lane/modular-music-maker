import { CONFIG } from '../config';
import { decodeSamplePcm } from '../domain/samples';
import type { DrumSample } from '../domain/types';
import type { AudioRuntime } from './factories';

/** Playback owns only saved PCM. The microphone never enters the studio graph. */
export function createMicSampler(context: AudioContext): AudioRuntime {
  const output = context.createGain();
  output.gain.value = 0;
  let pcm: string | undefined;
  let buffer: AudioBuffer | undefined;
  let rate = 1;
  const voices = new Set<{ source: AudioBufferSourceNode; envelope: GainNode }>();
  const disconnect = (voice: { source: AudioBufferSourceNode; envelope: GainNode }) => {
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
    inputs: {},
    outputs: { out: output },
    update(parameters) {
      output.gain.setTargetAtTime(
        Number(parameters.level),
        context.currentTime,
        CONFIG.audio.parameterRampSeconds,
      );
      // A speed change applies to the next hit so its end envelope stays on the audio clock.
      rate = Number(parameters.rate);
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
      if (!buffer) return;
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
      const duration = buffer.duration / rate;
      const edge = Math.min(fade, duration / 2);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(velocity, start + edge);
      envelope.gain.setValueAtTime(velocity, start + duration - edge);
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(envelope);
      envelope.connect(output);
      const voice = { source, envelope };
      voices.add(voice);
      source.onended = () => disconnect(voice);
      source.start(start);
      source.stop(start + duration);
    },
    silence,
    dispose() {
      silence();
      output.disconnect();
      buffer = undefined;
    },
  };
}
