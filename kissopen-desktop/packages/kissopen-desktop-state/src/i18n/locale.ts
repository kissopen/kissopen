import { en } from "./en.js";
import { zh } from "./zh.js";

/**
 * The two languages the desktop speaks. Strings are written in whichever one
 * they were first written in and used as their own key: an English string is
 * looked up in the Chinese catalog, a Chinese one in the English catalog, and a
 * string missing from the catalog stays as written rather than disappearing.
 */
export type Locale = "zh" | "en";
/** What the reader chose; "system" follows the operating system's language. */
export type LocalePreference = "system" | Locale;

let current: Locale = "en";

/** The language a preference means on a system whose languages are `system`. */
export function localeResolve(preference: LocalePreference, system: readonly string[]): Locale {
    if (preference !== "system") return preference;
    return system.some((tag) => tag.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

export function localeParse(value: unknown): LocalePreference {
    return value === "zh" || value === "en" ? value : "system";
}

/**
 * Sets the language every later `t` call answers in. Called once, before the
 * interface's modules load, so text computed at module scope is in the right
 * language too; changing language afterwards reloads the window.
 */
export function localeSet(locale: Locale): void {
    current = locale;
}

export function localeCurrent(): Locale {
    return current;
}

/**
 * The text in the current language, with `{name}` placeholders filled from
 * `values`.
 */
export function t(source: string, values?: Readonly<Record<string, string | number>>): string {
    const catalog = current === "zh" ? zh : en;
    const text = catalog[source] ?? source;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in values ? String(values[name]) : whole,
    );
}

// The window's language choice. The host binds it once at start, with what
// changing it means there (saving it and reloading the window); the settings
// page only reads it and asks for a change.
let preference: LocalePreference = "system";
let preferenceChange: ((next: LocalePreference) => void) | undefined;

export function localePreferenceBind(
    current: LocalePreference,
    change: (next: LocalePreference) => void,
): void {
    preference = current;
    preferenceChange = change;
}

export function localePreference(): LocalePreference {
    return preference;
}

/** False where no host can apply a change, so the choice is not offered. */
export function localePreferenceChangeable(): boolean {
    return preferenceChange !== undefined;
}

export function localePreferenceChange(next: LocalePreference): void {
    preferenceChange?.(next);
}
