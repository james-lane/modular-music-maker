import { CONFIG } from '../config';

/** Build a bounded XY blend entirely on the audio clock, including externally
 * patched axes. Native multiplication preserves convex weights without polling
 * analysers or writing a performance into React state/history.
 */
export function createXYControl(context: AudioContext) {
  const nodes: AudioNode[] = [];
  const sources: ConstantSourceNode[] = [];
  const map = (source: AudioNode, fn: (value: number) => number) => {
    const shaper = context.createWaveShaper();
    shaper.curve = Float32Array.from({ length: CONFIG.audio.modulation.curveSamples }, (_, i) =>
      fn((i * 2) / (CONFIG.audio.modulation.curveSamples - 1) - 1),
    );
    source.connect(shaper);
    nodes.push(shaper);
    return shaper;
  };
  const sum = (terms: [AudioNode, number][]) => {
    const result = context.createGain();
    nodes.push(result);
    for (const [source, scale] of terms) {
      const gain = context.createGain();
      gain.gain.value = scale;
      source.connect(gain);
      gain.connect(result);
      nodes.push(gain);
    }
    return result;
  };
  const multiply = (a: AudioNode, b: AudioNode) => {
    const result = context.createGain();
    result.gain.value = 0;
    a.connect(result);
    b.connect(result.gain);
    nodes.push(result);
    return result;
  };
  const axis = (unipolar: boolean) => {
    const input = context.createGain();
    input.gain.value = 1 / CONFIG.audio.modulation.reference;
    const bias = context.createConstantSource();
    bias.offset.value = 0;
    bias.start();
    bias.connect(input); // Bias is in reference units too.
    nodes.push(input, bias);
    sources.push(bias);
    return { input, bias, output: map(input, (value) => (unipolar ? Math.max(0, value) : value)) };
  };
  const x = axis(false),
    y = axis(false),
    mix = axis(true);
  const absX = map(x.output, Math.abs),
    absY = map(y.output, Math.abs);
  const difference = sum([
    [absX, 1],
    [absY, -1],
  ]);
  const maximum = sum([
    [absX, 0.5],
    [absY, 0.5],
    [map(difference, Math.abs), 0.5],
  ]);
  const amount = multiply(maximum, mix.output);
  const horizontal = [
    map(x.output, (value) => (1 - value) / 2),
    map(x.output, (value) => (1 + value) / 2),
  ];
  const vertical = [
    map(y.output, (value) => (1 + value) / 2),
    map(y.output, (value) => (1 - value) / 2),
  ];
  const corners = [
    multiply(multiply(horizontal[0], vertical[0]), amount),
    multiply(multiply(horizontal[1], vertical[0]), amount),
    multiply(multiply(horizontal[0], vertical[1]), amount),
    multiply(multiply(horizontal[1], vertical[1]), amount),
  ];
  let connected: ReadonlySet<string> = new Set();
  return {
    inputs: { xMod: x.input, yMod: y.input, mixMod: mix.input },
    dry: map(amount, (value) => 1 - value),
    corners,
    configure(ports: ReadonlySet<string>) {
      connected = ports;
    },
    update(values: { x: number; y: number; mix: number }) {
      for (const [id, axis, value] of [
        ['xMod', x, values.x],
        ['yMod', y, values.y],
        ['mixMod', mix, values.mix],
      ] as const)
        axis.bias.offset.setTargetAtTime(
          connected.has(id) ? 0 : value * CONFIG.audio.modulation.reference,
          context.currentTime,
          CONFIG.audio.parameterRampSeconds,
        );
    },
    dispose() {
      sources.forEach((source) => source.stop());
      nodes.forEach((node) => node.disconnect());
    },
  };
}
