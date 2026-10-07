import type { ThemeDoc, ThemePalette } from '@/kissopen/api/types';
import type { Theme } from './theme';

/*
 * A custom theme is eleven colours per appearance (docs/themes.md at the
 * repository root). Every colour role the app draws with is derived from
 * them here, by the same rules the desktop and the web client use, so one
 * theme file looks the same on every screen. Code, diff, terminal,
 * permission, git and status colours stay as in the base theme: they carry
 * meaning that a palette must not change.
 */

type RGB = { r: number; g: number; b: number };

function parse(hex: string): RGB {
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = Number.parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n) || h.length < 6) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const channel = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

function toHex(c: RGB): string {
    return `#${channel(c.r)}${channel(c.g)}${channel(c.b)}`;
}

/** a mixed towards b by t (0–1), as "#rrggbb". */
export function mix(a: string, b: string, t: number): string {
    const x = parse(a);
    const y = parse(b);
    return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

/** c with an alpha, as "rgba(...)". */
export function alpha(c: string, a: number): string {
    const { r, g, b } = parse(c);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

/** Whether a colour reads as dark (relative luminance under half). */
export function isDark(c: string): boolean {
    const { r, g, b } = parse(c);
    const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.5;
}

/** The radius scale of a theme, relative to the app's own (`soft`). */
export function radiusScale(radius: string | undefined): number {
    if (radius === 'sharp') return 0.4;
    if (radius === 'round') return 1.6;
    return 1;
}

/**
 * The full theme object the app draws with, for one appearance of a theme
 * document. `base` is the app's own light or dark theme; the roles listed in
 * docs/themes.md are replaced, the rest are kept.
 */
export function themeFromDoc(doc: ThemeDoc, base: Theme, p: ThemePalette): Theme {
    const scale = radiusScale(doc.radius);
    const r = (v: number) => Math.max(1, Math.round(v * scale));
    const c = base.colors;
    return {
        ...base,
        dark: isDark(p.canvas),
        colors: {
            ...c,
            text: p.text,
            textDestructive: p.danger,
            textSecondary: p.muted,
            textLink: p.accent,
            deleteAction: p.danger,
            warningCritical: p.danger,
            warning: p.warning,
            success: p.success,
            surface: p.surface,
            surfaceRipple: alpha(p.text, 0.08),
            surfacePressed: mix(p.surface, p.text, 0.08),
            surfaceSelected: mix(p.surface, p.accent, 0.12),
            surfacePressedOverlay: mix(p.surface, p.text, 0.08),
            surfaceHigh: p.raised,
            surfaceHighest: mix(p.surface, p.text, 0.06),
            divider: p.line,
            glass: {
                ...c.glass,
                background: alpha(p.canvas, 0.68),
                backgroundStrong: alpha(p.canvas, 0.84),
                backgroundSubtle: alpha(p.canvas, 0.42),
                overlay: alpha(p.canvas, 0.58),
                overlayTint: alpha(p.canvas, 0.46),
                border: alpha(p.line, 0.8),
                divider: alpha(p.line, 0.9),
                highlight: alpha(p.surface, 0.9),
                tint: alpha(p.canvas, 0.14),
                backdrop: [p.canvas, p.canvas, p.canvas] as readonly [string, string, string],
            },
            brand: {
                ...c.brand,
                accent: p.accent,
            },
            home: {
                ...c.home,
                bg: p.canvas,
                card: p.surface,
                cardSoft: mix(p.surface, p.canvas, 0.5),
                border: mix(p.line, p.accent, 0.3),
                accent: p.accent,
                accentStrong: mix(p.accent, p.text, 0.15),
                accentSoft: mix(p.surface, p.accent, 0.12),
                hover: alpha(p.accent, 0.06),
                onAccent: p.on_accent,
                green: p.success,
                greenSoft: mix(p.surface, p.success, 0.15),
                peach: p.warning,
                peachSoft: mix(p.surface, p.warning, 0.15),
                peachText: mix(p.warning, p.text, 0.3),
                muted: p.muted,
                danger: p.danger,
                track: mix(p.surface, p.text, 0.06),
            },
            groupped: {
                background: p.canvas,
                chevron: mix(p.muted, p.surface, 0.3),
                sectionTitle: p.muted,
            },
            header: {
                background: p.raised,
                tint: p.text,
            },
            switch: {
                track: {
                    active: p.accent,
                    inactive: mix(p.surface, p.text, 0.15),
                },
                thumb: {
                    active: p.on_accent,
                    inactive: c.switch.thumb.inactive,
                },
            },
            fab: {
                background: p.accent,
                backgroundPressed: mix(p.accent, p.text, 0.15),
                icon: p.on_accent,
            },
            radio: {
                active: p.accent,
                inactive: p.line,
                dot: p.accent,
            },
            modal: {
                border: alpha(p.text, 0.1),
            },
            button: {
                primary: {
                    background: p.accent,
                    tint: p.on_accent,
                    disabled: mix(p.surface, p.text, 0.25),
                },
                secondary: {
                    tint: p.muted,
                },
                emphasis: {
                    background: p.accent,
                    pressed: mix(p.accent, p.text, 0.15),
                    text: p.on_accent,
                },
            },
            input: {
                background: p.surface,
                text: p.text,
                placeholder: p.muted,
            },
            box: {
                warning: {
                    background: mix(p.surface, p.warning, 0.12),
                    border: p.warning,
                    text: mix(p.warning, p.text, 0.3),
                },
                error: {
                    background: mix(p.surface, p.danger, 0.12),
                    border: p.danger,
                    text: p.danger,
                },
            },
            userMessageBackground: mix(p.surface, p.accent, 0.12),
            userMessageText: p.text,
            agentMessageText: p.text,
            agentEventText: p.muted,
        },
        borderRadius: {
            sm: r(base.borderRadius.sm),
            md: r(base.borderRadius.md),
            lg: r(base.borderRadius.lg),
            xl: r(base.borderRadius.xl),
            xxl: r(base.borderRadius.xxl),
        },
    };
}
