import { CONFIG } from '../config';

export interface Point {
  x: number;
  y: number;
}

export function clampZoom(zoom: number): number {
  return Math.max(CONFIG.canvas.minZoom, Math.min(CONFIG.canvas.maxZoom, zoom));
}

/** Keep the same rack point under the fingers even while their midpoint moves. */
export function zoomScroll(anchor: Point, midpoint: Point, zoom: number): Point {
  return { x: anchor.x * zoom - midpoint.x, y: anchor.y * zoom - midpoint.y };
}

export function touchPair(points: Point[]) {
  const [first, second] = points;
  return {
    midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}
