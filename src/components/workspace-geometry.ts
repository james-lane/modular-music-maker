import { CONFIG } from '../config';
import type { Bounds, Size } from '../domain/workspace';

export interface Point {
  x: number;
  y: number;
}

/** World coordinate at the viewport's top-left; never serialized into a patch. */
export interface WorkspaceView extends Point {
  zoom: number;
}

export function worldPoint(view: WorkspaceView, point: Point): Point {
  return { x: view.x + point.x / view.zoom, y: view.y + point.y / view.zoom };
}

export function viewAtAnchor(anchor: Point, midpoint: Point, zoom: number): WorkspaceView {
  return { x: anchor.x - midpoint.x / zoom, y: anchor.y - midpoint.y / zoom, zoom };
}

export function fittedView(bounds: Bounds, size: Size): WorkspaceView {
  const padding = CONFIG.canvas.fitPadding;
  const zoom = clampZoom(
    Math.min(
      1,
      Math.max(1, size.width - padding * 2) / Math.max(1, bounds.width),
      Math.max(1, size.height - padding * 2) / Math.max(1, bounds.height),
    ),
    CONFIG.canvas.minFitZoom,
  );
  return viewAtAnchor(
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    { x: size.width / 2, y: size.height / 2 },
    zoom,
  );
}

/** Return screen-space velocity; changing zoom must not change edge-pan speed. */
export function edgePan(point: Point, size: Size): Point {
  const edge = CONFIG.canvas.autoPanEdgePixels;
  const speed = CONFIG.canvas.autoPanPixelsPerSecond;
  const velocity = (position: number, length: number) =>
    position < edge
      ? -speed * Math.min(1, (edge - position) / edge)
      : position > length - edge
        ? speed * Math.min(1, (position - length + edge) / edge)
        : 0;
  return { x: velocity(point.x, size.width), y: velocity(point.y, size.height) };
}

export function clampZoom(zoom: number, minimum: number = CONFIG.canvas.minZoom): number {
  return Math.max(minimum, Math.min(CONFIG.canvas.maxZoom, zoom));
}

export function touchPair(points: Point[]) {
  const [first, second] = points;
  return {
    midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}
