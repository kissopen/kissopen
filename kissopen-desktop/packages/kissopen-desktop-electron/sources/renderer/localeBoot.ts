// Imported first by the renderer entry, before any interface module, so text
// computed at module scope is already in the reader's language. Only the i18n
// subpath is imported: the package root would evaluate every store first.
import {
    localeParse,
    localeResolve,
    localeSet,
    type LocalePreference,
} from "kissopen-desktop-state/i18n";

/** Where the renderer keeps the choice for its own synchronous start. */
export const LOCALE_STORAGE_KEY = "kissopen.language";

export function localePreferenceRead(): LocalePreference {
    try {
        return localeParse(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
        return "system";
    }
}

localeSet(localeResolve(localePreferenceRead(), navigator.languages ?? [navigator.language]));
