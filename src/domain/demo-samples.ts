import { CONFIG } from '../config';
import { encodeSamplePcm } from './samples';

/** Original, deterministic clap PCM makes the sampler useful on Play, offline and
 * without microphone permission. Generating data here never creates an audio device.
 */
export function createDemoClap() {
  const frames = new Float32Array(Math.round(CONFIG.samples.sampleRate * 0.18));
  let seed = 73;
  let previous = 0;
  for (let frame = 0; frame < frames.length; frame++) {
    const time = frame / CONFIG.samples.sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    const burst = [0, 0.012, 0.024].reduce(
      (sum, onset) => sum + (time >= onset ? Math.exp(-(time - onset) / 0.024) : 0),
      0,
    );
    const edge = Math.min(1, frame / 24, (frames.length - 1 - frame) / 120);
    frames[frame] = (noise - previous) * burst * edge * 0.22;
    previous = noise;
  }
  return { name: 'Synthesized pop clap', pcm: encodeSamplePcm(frames) };
}
