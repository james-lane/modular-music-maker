import { CONFIG } from '../config';

/** Fixed PCM format avoids trusting file headers or decoding untrusted media at playback. */
export function isValidSamplePcm(pcm: string): boolean {
  if (!pcm.length || pcm.length > CONFIG.samples.maxEncodedLength || pcm.length % 4 !== 0)
    return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(pcm)) return false;
  const bytes = (pcm.length / 4) * 3 - (pcm.endsWith('==') ? 2 : pcm.endsWith('=') ? 1 : 0);
  return (
    bytes > 0 &&
    bytes % 2 === 0 &&
    bytes <= CONFIG.samples.sampleRate * CONFIG.samples.maxSeconds * 2
  );
}

export function encodeSamplePcm(data: Float32Array): string {
  const bytes = new Uint8Array(data.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < data.length; index++) {
    const value = Math.max(-1, Math.min(1, data[index]));
    view.setInt16(index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  // Chunking avoids exceeding the JavaScript argument limit for longer samples.
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}

export function decodeSamplePcm(pcm: string): Float32Array<ArrayBuffer> {
  const binary = atob(pcm);
  const data = new Float32Array(binary.length / 2);
  for (let index = 0; index < data.length; index++) {
    const unsigned = binary.charCodeAt(index * 2) | (binary.charCodeAt(index * 2 + 1) << 8);
    data[index] = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
  }
  return data;
}

/** A standard mono WAV lets the same clip become a Drum kit voice via Load audio. */
export function sampleWav(pcm: string): Blob {
  const data = decodeSamplePcm(pcm);
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(bytes);
  const label = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  label(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, CONFIG.samples.sampleRate, true);
  view.setUint32(28, CONFIG.samples.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, data.length * 2, true);
  for (let index = 0; index < data.length; index++)
    view.setInt16(44 + index * 2, Math.round(data[index] * 32768), true);
  return new Blob([bytes], { type: 'audio/wav' });
}
