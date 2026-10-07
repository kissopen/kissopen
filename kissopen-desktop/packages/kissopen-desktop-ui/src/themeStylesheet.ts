import type { ThemeDoc, ThemePalette } from "kissopen-desktop-state";

/*
A custom theme, as CSS. The theme is eleven colours per appearance (see
docs/themes.md at the repository root); everything else in theme.css is
derived from them here, by the same rules the phone follows. The result is a
stylesheet scoped to the theme scope's element, so it sits over theme.css the
way theme.css's own dark block sits over its light one, and the appearance
(light, dark or the system's) still decides which palette shows.

Only colours the product's own look is made of are rewritten; the palettes
for code, diffs, terminals, permissions and file kinds stay, so they remain
readable under any theme.
*/

type Rgb = readonly [number, number, number];

function parse(hex: string): Rgb {
    const v = Number.parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function hex(c: Rgb): string {
    return (
        "#" +
        c
            .map((v) =>
                Math.round(Math.min(255, Math.max(0, v)))
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
}

/** A colour t of the way from a to b. */
function mix(a: string, b: string, t: number): string {
    const x = parse(a);
    const y = parse(b);
    return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** A colour with an opacity, as CSS writes it. */
function alpha(c: string, a: number): string {
    const [r, g, b] = parse(c);
    return `rgb(${r} ${g} ${b} / ${a})`;
}

/** The custom properties one palette sets, in theme.css's names. */
export function paletteProperties(p: ThemePalette): Record<string, string> {
    const selected = mix(p.surface, p.accent, 0.12);
    return {
        "--brand-accent": p.accent,
        "--text": p.text,
        "--text-secondary": p.muted,
        "--text-link": p.accent,
        "--text-destructive": p.danger,
        "--text-inverse": p.canvas,
        "--delete-action": p.danger,
        "--warning-critical": p.danger,
        "--warning": p.warning,
        "--success": p.success,
        "--surface": p.surface,
        "--surface-high": p.raised,
        "--surface-highest": mix(p.surface, p.text, 0.06),
        "--surface-selected": selected,
        "--surface-pressed": mix(p.surface, p.text, 0.08),
        "--surface-inverse": p.text,
        "--page-canvas": p.canvas,
        "--divider": p.line,
        "--groupped-background": p.canvas,
        "--groupped-chevron": p.muted,
        "--groupped-section-title": p.muted,
        "--rail-background": p.raised,
        "--header-background": p.raised,
        "--header-tint": p.text,
        "--header-tint-secondary": p.muted,
        "--switch-track-inactive": mix(p.surface, p.text, 0.2),
        "--switch-thumb-active": p.on_accent,
        "--radio-inactive": mix(p.surface, p.text, 0.3),
        "--fab-icon": p.on_accent,
        "--input-background": p.surface,
        "--input-text": p.text,
        "--input-placeholder": mix(p.surface, p.text, 0.5),
        "--home-bg": p.canvas,
        "--home-card": p.surface,
        "--home-card-soft": mix(p.surface, p.canvas, 0.5),
        "--home-border": mix(p.line, p.accent, 0.3),
        "--home-accent": p.accent,
        "--home-accent-strong": mix(p.accent, p.text, 0.15),
        "--home-accent-soft": selected,
        "--home-hover": alpha(p.accent, 0.06),
        "--home-green": p.success,
        "--home-green-soft": mix(p.surface, p.success, 0.15),
        "--home-peach": p.warning,
        "--home-peach-soft": mix(p.surface, p.warning, 0.15),
        "--home-peach-text": mix(p.warning, p.text, 0.3),
        "--home-muted": p.muted,
        "--home-on-accent": p.on_accent,
        "--home-danger-soft": mix(p.surface, p.danger, 0.15),
        "--home-danger-text": mix(p.danger, p.text, 0.3),
        "--home-shadow-accent": `0 6px 16px ${alpha(p.accent, 0.25)}`,
    };
}

const FONTS: Record<ThemeDoc["font"], string | undefined> = {
    sans: undefined,
    serif: '"Songti SC", "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
    mono: "var(--kissopen-font-mono)",
};

const RADII: Record<ThemeDoc["radius"], readonly [number, number, number, number] | undefined> = {
    sharp: [2, 4, 4, 6],
    soft: undefined,
    round: [10, 16, 12, 22],
};

/** The custom properties a theme sets in both appearances: type and shape. */
export function themeShapeProperties(doc: ThemeDoc): Record<string, string> {
    const out: Record<string, string> = {};
    const font = FONTS[doc.font];
    if (font) out["--kissopen-font-ui"] = font;
    const radii = RADII[doc.radius];
    if (radii) {
        out["--kissopen-radius-sm"] = `${radii[0]}px`;
        out["--kissopen-radius-md"] = `${radii[1]}px`;
        out["--kissopen-radius-window"] = `${radii[2]}px`;
        out["--kissopen-radius-shell"] = `${radii[3]}px`;
    }
    if (doc.background?.url) {
        out["--kissopen-wallpaper"] = `url("${doc.background.url.replace(/["\\]/gu, "")}")`;
        out["--kissopen-wallpaper-blur"] = `${doc.background.blur}px`;
    }
    return out;
}

function block(selector: string, properties: Record<string, string>): string {
    const body = Object.entries(properties)
        .map(([name, value]) => `${name}:${value};`)
        .join("");
    return `${selector}{${body}}`;
}

/**
 * The stylesheet that applies a theme under `.kissopen-theme-scope`: the
 * light palette by default, the dark one when the system is dark and no
 * appearance is pinned, and whichever the scope's own class pins. The veil
 * over a background picture is the canvas colour at the picture's inverse
 * opacity, so it is set with each palette.
 */
export function themeStylesheet(doc: ThemeDoc): string {
    const scope = ".kissopen-theme-scope";
    const veil = (p: ThemePalette): Record<string, string> =>
        doc.background?.url
            ? { "--kissopen-wallpaper-veil": alpha(p.canvas, 1 - doc.background.opacity) }
            : {};
    const light = {
        ...themeShapeProperties(doc),
        ...paletteProperties(doc.light),
        ...veil(doc.light),
    };
    const dark = { ...paletteProperties(doc.dark), ...veil(doc.dark) };
    return [
        block(scope, light),
        `@media (prefers-color-scheme: dark){${block(`${scope}:not(.kissopen-theme-light)`, dark)}}`,
        block(`${scope}.kissopen-theme-dark`, dark),
    ].join("\n");
}
