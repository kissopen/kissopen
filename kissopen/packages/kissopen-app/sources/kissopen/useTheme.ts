import * as React from 'react';
import { Platform } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import * as SystemUI from 'expo-system-ui';
import { darkTheme, lightTheme } from '@/theme';
import { themeFromDoc } from '@/themeDoc';
import { setBodyFont, type BodyFont } from '@/constants/Typography';
import { onConsumerSessionEnded } from './sessionEvents';
import type { Theme, ThemeBackground, ThemeDoc } from './api/types';

/*
 * The account's custom theme, applied to the whole app. `/api/me` says which
 * theme the account chose (or none); applying it replaces both Unistyles
 * themes with ones derived from the document (themeDoc.ts), so every screen
 * repaints, while the person's light / dark / adaptive preference keeps
 * choosing between the two as before. Signing out restores the app's own
 * look. A theme may also be tried before it is saved (themePreview).
 */

export type AppliedTheme = {
    /** Empty while a theme is only being tried. */
    id: string;
    name: string;
    doc: ThemeDoc;
};

let applied: AppliedTheme | null = null;
let appliedKey = '';
const listeners = new Set<() => void>();

const keyOf = (theme: AppliedTheme | null) => theme ? `${theme.id}:${JSON.stringify(theme.doc)}` : '';

function bodyFontOf(doc: ThemeDoc | undefined): BodyFont {
    return doc?.font === 'serif' || doc?.font === 'mono' ? doc.font : 'sans';
}

/** Repaints the app in the theme given, or in its own look when null. */
function paint(theme: AppliedTheme | null) {
    const key = keyOf(theme);
    if (key === appliedKey) return;
    applied = theme;
    appliedKey = key;
    setBodyFont(bodyFontOf(theme?.doc));
    const light = theme ? themeFromDoc(theme.doc, lightTheme, theme.doc.light) : lightTheme;
    const dark = theme ? themeFromDoc(theme.doc, darkTheme, theme.doc.dark) : darkTheme;
    try {
        UnistylesRuntime.updateTheme('light', () => light);
        UnistylesRuntime.updateTheme('dark', () => dark);
        const current = UnistylesRuntime.themeName === 'dark' ? dark : light;
        const color = current.colors.groupped.background;
        UnistylesRuntime.setRootViewBackgroundColor(color);
        if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(color);
    } catch (error) {
        console.warn('theme: cannot apply', error);
    }
    for (const listener of listeners) listener();
}

/** Applies the theme `/api/me` (or a selection) answered with; null is the app's own look. */
export function themeApply(theme: Theme | null | undefined) {
    paint(theme ? { id: theme.id, name: theme.name, doc: theme.doc } : null);
}

/** Tries a theme that is not saved; the next `/api/me` answer replaces it. */
export function themePreview(name: string, doc: ThemeDoc) {
    paint({ id: '', name, doc });
}

/** The theme the app is painted in right now, or null for its own look. */
export function themeApplied(): AppliedTheme | null {
    return applied;
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

/** The applied theme, as state: re-renders when it changes. */
export function useAppliedTheme(): AppliedTheme | null {
    return React.useSyncExternalStore(subscribe, themeApplied, themeApplied);
}

/** The applied theme's background picture, when it has one. */
export function useThemeBackground(): ThemeBackground | null {
    const theme = useAppliedTheme();
    const background = theme?.doc.background;
    return background && background.url ? background : null;
}

// Signing out (or a session the server refused) goes back to the app's own look.
onConsumerSessionEnded(() => themeApply(null));
