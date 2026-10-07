import { t } from "../i18n/locale.js";
import type { ThemeDoc, ThemePalette, ThemeWrite } from "./types";

/** Imported files are untrusted; construct the complete rendering contract before previewing. */
export function readThemeImport(text: string): ThemeWrite {
    const invalid = (): never => {
        throw new Error(t("这不是一个主题文件"));
    };
    const object = (value: unknown): Record<string, unknown> => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
        return value as Record<string, unknown>;
    };
    const colour = (value: unknown): string => {
        if (typeof value !== "string") return invalid();
        const hex = value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/u.test(hex)) return hex;
        if (/^#[0-9a-f]{3}$/u.test(hex)) return "#" + [...hex.slice(1)].map((c) => c + c).join("");
        return invalid();
    };
    const palette = (value: unknown): ThemePalette => {
        const p = object(value);
        return {
            accent: colour(p.accent),
            on_accent: colour(p.on_accent),
            canvas: colour(p.canvas),
            surface: colour(p.surface),
            raised: colour(p.raised),
            text: colour(p.text),
            muted: colour(p.muted),
            line: colour(p.line),
            success: colour(p.success),
            warning: colour(p.warning),
            danger: colour(p.danger),
        };
    };
    const parsed = object(JSON.parse(text));
    const raw = object(parsed.doc === undefined ? parsed : parsed.doc);
    const font = raw.font === undefined ? "sans" : raw.font;
    const radius = raw.radius === undefined ? "soft" : raw.radius;
    if (raw.version !== undefined && raw.version !== 1) return invalid();
    if (font !== "sans" && font !== "serif" && font !== "mono") return invalid();
    if (radius !== "sharp" && radius !== "soft" && radius !== "round") return invalid();
    const doc: ThemeDoc = {
        version: 1,
        font,
        radius,
        light: palette(raw.light),
        dark: palette(raw.dark),
    };
    if (raw.background !== undefined && raw.background !== null) {
        const bg = object(raw.background);
        if (
            typeof bg.url !== "string" ||
            typeof bg.opacity !== "number" ||
            typeof bg.blur !== "number" ||
            !Number.isFinite(bg.opacity) ||
            bg.opacity < 0.05 ||
            bg.opacity > 1 ||
            !Number.isFinite(bg.blur) ||
            bg.blur < 0 ||
            bg.blur > 40
        )
            return invalid();
        const url = new URL(bg.url);
        if (
            (url.protocol !== "https:" && url.protocol !== "http:") ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            !/^\/api\/themes\/images\/[0-9a-f]{16,64}$/u.test(url.pathname)
        )
            return invalid();
        doc.background = { url: url.href, opacity: bg.opacity, blur: bg.blur };
    }
    if (
        (parsed.name !== undefined && typeof parsed.name !== "string") ||
        (parsed.description !== undefined && typeof parsed.description !== "string")
    )
        return invalid();
    return {
        name: typeof parsed.name === "string" ? parsed.name : t("导入的主题"),
        description: typeof parsed.description === "string" ? parsed.description : "",
        source: "user",
        doc,
    };
}
