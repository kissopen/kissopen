// Canonical KissOpen artwork for surfaces that need URLs rather than inline SVG.
// Accent reads on both themes; white is reserved for dark backgrounds.
export const kissopenMarkUrl = new URL("./assets/brand/kissopen-mark.svg", import.meta.url).href;
export const kissopenMarkWhiteUrl = new URL(
    "./assets/brand/kissopen-mark-white.svg",
    import.meta.url,
).href;
// 小秘书 waving: a short silent loop, and one frame of it for when motion is not wanted.
export const secretaryVideoUrl = new URL("./assets/secretary/secretary.mp4", import.meta.url).href;
export const secretaryStillUrl = new URL("./assets/secretary/secretary-still.jpg", import.meta.url)
    .href;

// Cropped to the ink, so a lockup lines its type up against the mark itself.
export const kissopenGlyphUrl = new URL("./assets/brand/kissopen-glyph.svg", import.meta.url).href;
