/** Corner identities stay stable when their assigned effects change. */
export const XY_CORNERS = [
  { id: 'topLeft', label: 'Top left' },
  { id: 'topRight', label: 'Top right' },
  { id: 'bottomLeft', label: 'Bottom left' },
  { id: 'bottomRight', label: 'Bottom right' },
] as const;

export const XY_EFFECTS = [
  { id: 'filter', label: 'Filter' },
  { id: 'echo', label: 'Echo' },
  { id: 'grit', label: 'Grit' },
  { id: 'space', label: 'Space' },
  { id: 'highpass', label: 'Thin' },
  { id: 'clean', label: 'Clean' },
] as const;

export type XYEffect = (typeof XY_EFFECTS)[number]['id'];

/** X/Y are normalized, with positive Y at the top of the printed pad. Convex weights
 * keep total gain bounded, even when all four corners select the same effect.
 * The centre is dry; distance from it brings in the bilinear corner blend.
 */
export function xyBlend(x: number, y: number, mix: number) {
  const horizontal = (Math.max(-1, Math.min(1, x)) + 1) / 2;
  const vertical = (Math.max(-1, Math.min(1, y)) + 1) / 2;
  const amount =
    Math.max(Math.abs(horizontal * 2 - 1), Math.abs(vertical * 2 - 1)) *
    Math.max(0, Math.min(1, mix));
  return {
    dry: 1 - amount,
    corners: [
      (1 - horizontal) * vertical * amount,
      horizontal * vertical * amount,
      (1 - horizontal) * (1 - vertical) * amount,
      horizontal * (1 - vertical) * amount,
    ],
  };
}
