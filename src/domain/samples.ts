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
