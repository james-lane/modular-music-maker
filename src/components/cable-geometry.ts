import { CONFIG } from '../config';

interface Point {
  x: number;
  y: number;
}

function cableSag(from: Point, to: Point): number {
  return Math.min(200, 70 + Math.abs(to.x - from.x) * 0.15 + Math.abs(to.y - from.y) * 0.1);
}

export function cablePath(from: Point, to: Point): string {
  const sag = cableSag(from, to);
  return `M${from.x},${from.y} C${from.x},${from.y + sag} ${to.x},${to.y + sag} ${to.x},${to.y}`;
}

/** Two strands follow the curve's normal, swapping depth at each crossing.
 * Phase uses distance along the cable so long/vertical cables keep the same weave density.
 * Pure geometry avoids DOM measurements during dragging and scales with the workspace.
 */
export function braidedCablePaths(from: Point, to: Point) {
  const sag = cableSag(from, to);
  // Open workspaces can contain extremely long cables. Their visual detail must
  // stay bounded rather than allocating a path point for every world-space pixel.
  const samples = Math.min(
    CONFIG.cables.maxBraidSamples,
    Math.ceil(
      (Math.hypot(to.x - from.x, to.y - from.y) + 2 * sag) / CONFIG.cables.braidSamplePixels,
    ),
  );
  const period = 16;
  const radius = 1.8;
  const source = { under: '', over: '' };
  const target = { under: '', over: '' };
  let distance = 0;
  let previous = from;
  let previousSource = '';
  let previousTarget = '';
  let previousSpan = -1;

  for (let index = 0; index <= samples; index++) {
    const t = index / samples;
    const u = 1 - t;
    const point = {
      x: from.x + (to.x - from.x) * (3 * t * t - 2 * t * t * t),
      y:
        u * u * u * from.y +
        3 * u * u * t * (from.y + sag) +
        3 * u * t * t * (to.y + sag) +
        t * t * t * to.y,
    };
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    const dx = 6 * u * t * (to.x - from.x);
    const dy = 3 * u * u * sag + 6 * u * t * (to.y - from.y) - 3 * t * t * sag;
    const length = Math.hypot(dx, dy) || 1;
    const offset = radius * Math.sin((distance * 2 * Math.PI) / period);
    const sourcePoint = `${(point.x - (dy / length) * offset).toFixed(2)},${(point.y + (dx / length) * offset).toFixed(2)}`;
    const targetPoint = `${(point.x + (dy / length) * offset).toFixed(2)},${(point.y - (dx / length) * offset).toFixed(2)}`;
    // Split at strand peaks, away from the crossings, to hide joins between depth layers.
    const span = Math.floor((distance + period / 4) / (period / 2));
    const sourceDepth = span % 2 === 0 ? 'over' : 'under';
    const targetDepth = span % 2 === 0 ? 'under' : 'over';
    const nextSpan = span !== previousSpan;
    source[sourceDepth] += nextSpan
      ? `M${previousSource || sourcePoint} L${sourcePoint}`
      : ` L${sourcePoint}`;
    target[targetDepth] += nextSpan
      ? `M${previousTarget || targetPoint} L${targetPoint}`
      : ` L${targetPoint}`;
    previous = point;
    previousSource = sourcePoint;
    previousTarget = targetPoint;
    previousSpan = span;
  }
  return { source, target };
}
