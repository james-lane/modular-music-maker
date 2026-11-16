import { CONFIG } from '../config';

const display = CONFIG.audio.displays;

/** A stopped preview uses a fixed time/voltage scale, so both dials visibly matter.
 * It never advances the musical clock or creates an audio device.
 */
export function lfoPreviewPath(rate: number, depth: number): string {
  return Array.from({ length: display.points }, (_, index) => {
    const fraction = index / (display.points - 1);
    const value =
      (Math.sin(2 * Math.PI * rate * display.lfoPreviewSeconds * fraction) * depth) /
      CONFIG.audio.modulation.reference;
    return `${index ? 'L' : 'M'}${(fraction * display.width).toFixed(2)},${(display.height / 2 - value * display.height * 0.4).toFixed(2)}`;
  }).join(' ');
}

/** Web Audio biquad magnitude, using its low/high-pass dB Q and linear band-pass Q.
 * https://webaudio.github.io/web-audio-api/#filters-characteristics
 * Pure preview math avoids creating extra contexts/nodes just to turn a dial.
 */
export function filterMagnitude(
  mode: string,
  cutoff: number,
  resonance: number,
  frequency: number,
  sampleRate: number,
): number {
  const nyquist = sampleRate / 2;
  const centre = Math.max(0, Math.min(nyquist, cutoff));
  // The limiting low/high-pass cases are constant responses, not 0/0 biquads.
  if (centre === 0) return mode === 'highpass' ? 1 : 0;
  if (centre === nyquist) return mode === 'lowpass' ? 1 : 0;
  const omega = (2 * Math.PI * centre) / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * (mode === 'bandpass' ? resonance : 10 ** (resonance / 20)));
  let b0: number;
  let b1: number;
  let b2: number;
  switch (mode) {
    case 'lowpass':
      b0 = (1 - cosine) / 2;
      b1 = 1 - cosine;
      b2 = b0;
      break;
    case 'highpass':
      b0 = (1 + cosine) / 2;
      b1 = -(1 + cosine);
      b2 = b0;
      break;
    case 'bandpass':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      break;
    default:
      throw new Error('Unsupported filter display mode.');
  }
  const w = (2 * Math.PI * frequency) / sampleRate;
  const c1 = Math.cos(w),
    c2 = Math.cos(2 * w),
    s1 = Math.sin(w),
    s2 = Math.sin(2 * w);
  const numerator = (b0 + b1 * c1 + b2 * c2) ** 2 + (b1 * s1 + b2 * s2) ** 2;
  const denominator =
    (1 + alpha - 2 * cosine * c1 + (1 - alpha) * c2) ** 2 +
    (-2 * cosine * s1 + (1 - alpha) * s2) ** 2;
  return Math.sqrt(numerator / Math.max(Number.MIN_VALUE, denominator));
}

/** Log-frequency response with an exact cutoff sample so a narrow peak is not lost. */
export function filterResponsePath(
  mode: string,
  cutoff: number,
  resonance: number,
  sampleRate: number,
): string {
  const min = display.filterMinHz;
  const max = Math.min(display.filterMaxHz, sampleRate * 0.4999);
  const frequencies = Array.from(
    { length: display.points },
    (_, index) => min * (max / min) ** (index / (display.points - 1)),
  );
  if (cutoff > min && cutoff < max) frequencies.push(cutoff);
  frequencies.sort((a, b) => a - b);
  return frequencies
    .map((frequency, index) => {
      const magnitude = filterMagnitude(mode, cutoff, resonance, frequency, sampleRate);
      const db = Math.max(
        display.filterMinDb,
        Math.min(display.filterMaxDb, 20 * Math.log10(Math.max(1e-12, magnitude))),
      );
      const x = (Math.log(frequency / min) / Math.log(max / min)) * display.width;
      const y =
        ((display.filterMaxDb - db) / (display.filterMaxDb - display.filterMinDb)) *
          (display.height - 8) +
        4;
      return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/** A unit impulse: dry signal at zero, then echoes at Time with bounded feedback. */
export function delayPreviewPath(time: number, feedback: number, mix: number): string {
  const impulses = [{ time: 0, strength: 1 - mix }];
  for (let index = 1; index <= Math.floor(display.delayPreviewSeconds / time); index++) {
    const strength = mix * feedback ** (index - 1);
    if (strength >= 0.001) impulses.push({ time: index * time, strength });
  }
  return (
    'M0 82H360 ' +
    impulses
      .map((impulse) => {
        const x = 2 + (impulse.time / display.delayPreviewSeconds) * (display.width - 4);
        return `M${x.toFixed(2)} 82V${(82 - impulse.strength * 70).toFixed(2)}`;
      })
      .join(' ')
  );
}
