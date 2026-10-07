/** Canonical KissOpen geometry from the supplied VI; do not reshape. */
export type KissopenMarkTier = "full" | "turn" | "small";
export const KISSOPEN_MARK_VIEWBOX = "13.5 14.5 37 35";
export const KISSOPEN_MARK_FRAMED_VIEWBOX = "0 0 512 512";
export const KISSOPEN_MARK_ASPECT = 35 / 37;
export const KISSOPEN_MARK_FRAME_RADIUS = 117.76;
export const KISSOPEN_MARK_LEFT = "M16 17 L26 29 L26 35 L16 47 Z";
export const KISSOPEN_MARK_RIGHT = "M48 17 L38 29 L38 35 L48 47 Z";
export const KISSOPEN_MARK_TILE_TRANSFORM =
    "translate(256 256) scale(9.132972972973) translate(-32 -32)";
export function kissopenMarkTier(size: number): KissopenMarkTier {
    return size <= 24 ? "small" : size < 96 ? "turn" : "full";
}
export function kissopenMarkGeometry(_tier: KissopenMarkTier, _framed: boolean) {
    return { roll: KISSOPEN_MARK_LEFT, back: KISSOPEN_MARK_RIGHT, stroke: 5 };
}
