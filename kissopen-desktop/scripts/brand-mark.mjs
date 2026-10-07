/*
 * The 卷 mark as SVG source text, for the scripts that rasterise it (app icons,
 * the tray, favicons, the theme-switched logo PNGs). The same geometry the
 * interface draws inline lives in kissopen-desktop-ui/src/kissopenMarkGeometry.ts;
 * both are the product owner's design ("卷字概念logo设计") and must stay in step.
 *
 * 120 × 120 grid, round caps. The unframed mark is the grid cropped to
 * `30 30 70 60`; the app icon keeps the whole grid, lets the lines enter from
 * the left edge and clips them to a rounded square (rx 27 = side × 0.225)
 * filled with a neutral-700 → neutral-900 gradient.
 *
 * "越小，卷得越少": full roll from 96px, one and a half turns from 40px, the
 * back-less hook below that.
 */

export const COLORS = {
    accent: "#9184D9",
    back: "#6E7084",
    backSky: "#B4B5C2",
    frameTop: "#3A3C50",
    frameBottom: "#1B1D2C",
    paper: "#E9E9ED",
    ink: "#1B1D29",
};

const FULL = "H70 A26,26 0 0 1 70,86 A19,19 0 0 1 70,48 A14,14 0 0 1 70,76 A9,9 0 0 1 70,58";
const TURN = "H70 A26,26 0 0 1 70,86 A18,18 0 0 1 70,50";
const SMALL = "H70 A26,26 0 0 1 70,86 A16,16 0 0 1 70,54";

const GEOMETRY = {
    unframed: {
        full: { roll: `M34,34 ${FULL}`, back: "M34,86 H52", stroke: 5, glow: 6 },
        turn: { roll: `M34,34 ${TURN}`, back: "M34,86 H52", stroke: 6, glow: 4 },
        small: { roll: `M34,34 ${SMALL}`, back: null, stroke: 10, glow: 0 },
    },
    framed: {
        full: { roll: `M0,34 ${FULL}`, back: "M0,86 H52", stroke: 5, glow: 6 },
        turn: { roll: `M0,34 ${TURN}`, back: "M0,86 H52", stroke: 8.5, glow: 4 },
        small: { roll: `M0,34 ${SMALL}`, back: null, stroke: 18, glow: 0 },
    },
};

/** The drawing a mark `size` pixels wide (the tile's side when framed) calls for. */
export function tierFor(size) {
    if (size >= 96) return "full";
    if (size >= 40) return "turn";
    return "small";
}

export function geometry(tier, framed) {
    return GEOMETRY[framed ? "framed" : "unframed"][tier];
}

/**
 * CSS `drop-shadow(0 0 R accent-50%)`, as an SVG filter: a Gaussian of
 * deviation R/2 under the line, in the mark's own user units.
 */
function glowFilter(id, radius) {
    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${radius / 2}" result="blur"/>
      <feFlood flood-color="${COLORS.accent}" flood-opacity="0.5"/>
      <feComposite in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

/**
 * The unframed mark as a standalone SVG document.
 *
 * `viewBox` defaults to the design's `30 30 70 60`; pass a wider one where the
 * glow or a heavy stroke must not be cropped. `roll`/`back` recolour the lines
 * (a template image uses black for both); `glow: false` drops the glow.
 */
export function markSvg({
    tier = "full",
    width,
    height,
    viewBox = "30 30 70 60",
    roll = COLORS.accent,
    back = COLORS.back,
    backOpacity = 1,
    glow = true,
    title,
} = {}) {
    const shape = geometry(tier, false);
    const size = width === undefined ? "" : ` width="${width}" height="${height}"`;
    const filtered = glow && shape.glow > 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size}>
  ${title ? `<title>${title}</title>` : ""}
  ${filtered ? `<defs>${glowFilter("glow", shape.glow)}</defs>` : ""}
  <g fill="none" stroke-linecap="round" stroke-width="${shape.stroke}">
    ${shape.back ? `<path d="${shape.back}" stroke="${back}"${backOpacity === 1 ? "" : ` stroke-opacity="${backOpacity}"`}/>` : ""}
    <path d="${shape.roll}" stroke="${roll}"${filtered ? ' filter="url(#glow)"' : ""}/>
  </g>
</svg>
`;
}

/** The app icon (framed) on its own 120 grid, as a standalone SVG document. */
export function tileSvg({ tier = "full", width, height, title } = {}) {
    const shape = geometry(tier, true);
    const size = width === undefined ? "" : ` width="${width}" height="${height}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"${size}>
  ${title ? `<title>${title}</title>` : ""}
  <defs>
    <linearGradient id="tile" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${COLORS.frameTop}"/>
      <stop offset="1" stop-color="${COLORS.frameBottom}"/>
    </linearGradient>
    <clipPath id="frame"><rect x="0" y="0" width="120" height="120" rx="27"/></clipPath>
    ${shape.glow > 0 ? glowFilter("glow", shape.glow) : ""}
  </defs>
  <rect x="0" y="0" width="120" height="120" rx="27" fill="url(#tile)"/>
  <g clip-path="url(#frame)" fill="none" stroke-linecap="round" stroke-width="${shape.stroke}">
    ${shape.back ? `<path d="${shape.back}" stroke="${COLORS.back}"/>` : ""}
    <path d="${shape.roll}" stroke="${COLORS.accent}"${shape.glow > 0 ? ' filter="url(#glow)"' : ""}/>
  </g>
</svg>
`;
}

/**
 * Renders an SVG into a transparent square `canvas` so that the artwork's
 * alpha-weighted optical centre lands on the canvas centre and its larger
 * half-extent from that centre fills `coverage` of the canvas.
 */
export async function renderOpticallyCentred(sharp, svg, canvas, coverage) {
    // Rasterise straight at about 1600px across rather than scaling a smaller
    // render up, so the probe is as sharp as the artwork cut from it.
    const viewBoxWidth = Number(/viewBox="[^"]*?\S+\s+\S+\s+(\S+)/u.exec(svg)?.[1] ?? 120);
    const probe = await sharp(Buffer.from(svg), { density: (72 * 1600) / viewBoxWidth })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width, height } = probe.info;
    let total = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y += 1)
        for (let x = 0; x < width; x += 1) {
            const alpha = probe.data[(y * width + x) * 4 + 3];
            if (alpha === 0) continue;
            total += alpha;
            sumX += alpha * (x + 0.5);
            sumY += alpha * (y + 0.5);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + 1);
            maxY = Math.max(maxY, y + 1);
        }
    const cx = sumX / total;
    const cy = sumY / total;
    const reach = Math.max(cx - minX, maxX - cx, cy - minY, maxY - cy);
    const scale = (canvas * coverage) / 2 / reach;
    // Cut the ink out of the high-resolution probe and scale only that down,
    // so the overlay always fits inside the canvas it is placed on.
    const artwork = await sharp(probe.data, { raw: { width, height, channels: 4 } })
        .extract({ left: minX, top: minY, width: maxX - minX, height: maxY - minY })
        .resize({
            width: Math.max(1, Math.round((maxX - minX) * scale)),
            height: Math.max(1, Math.round((maxY - minY) * scale)),
            fit: "fill",
            kernel: "lanczos3",
        })
        .png()
        .toBuffer();
    const left = Math.round(canvas / 2 - (cx - minX) * scale);
    const top = Math.round(canvas / 2 - (cy - minY) * scale);
    return await sharp({
        create: {
            width: canvas,
            height: canvas,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: artwork, left, top }])
        .png()
        .toBuffer();
}
