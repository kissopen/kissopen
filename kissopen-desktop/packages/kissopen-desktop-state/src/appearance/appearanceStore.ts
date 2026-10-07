/**
 * The appearance surface: the selected and resolved theme plus the window's
 * scrollbar visibility behavior.
 *
 * It exists because appearance is product state, not React state: every
 * workspace renders one `ThemeScope` from it instead of carrying a separate
 * theme implementation. Keeping it here also keeps the selection out of the
 * application layer, which may not own React state.
 *
 * Following the state principles, the constructor opens nothing. The system
 * appearance is observed only while the store has a subscriber and only while
 * the mode actually depends on it, so a backgrounded surface does no work.
 */
export type ThemeMode = "dark" | "light" | "system";
export type ScrollbarVisibility = "always" | "automatic";

export interface AppearanceSnapshot {
    /** The user's selection. `system` defers to the platform appearance. */
    readonly mode: ThemeMode;
    /** The appearance actually rendered, after resolving `system`. */
    readonly appearance: "dark" | "light";
    /** Whether overflowing surfaces keep their scrollbar visible at rest. */
    readonly scrollbarVisibility: ScrollbarVisibility;
}

export interface AppearanceStore {
    get(): AppearanceSnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * Flips to the opposite of the appearance currently rendered. From `system`
     * this pins the explicit opposite of what the platform is showing, which is
     * what a single toggle control means to the person pressing it.
     */
    appearanceToggle(): void;
    /** Selects a mode directly, including returning to `system`. */
    appearanceSelect(mode: ThemeMode): void;
    scrollbarVisibilitySelect(visibility: ScrollbarVisibility): void;
    [Symbol.dispose](): void;
}

/** Media query the `system` mode resolves against. */
const DARK_QUERY = "(prefers-color-scheme: dark)";

export interface AppearanceStoreOptions {
    /** Initial selection; defaults to following the platform. */
    readonly mode?: ThemeMode;
    /** Initial scrollbar behavior; defaults to automatic. */
    readonly scrollbarVisibility?: ScrollbarVisibility;
    /**
     * Injected platform appearance source. Supplying it keeps this store free of
     * a `window` dependency in tests and in any non-browser host.
     */
    readonly systemAppearance?: () => "dark" | "light";
    /** Injected subscription to platform appearance changes; returns an unsubscribe. */
    readonly systemAppearanceSubscribe?: (listener: () => void) => () => void;
}

function browserSystemAppearance(): "dark" | "light" {
    return globalThis.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

function browserSystemAppearanceSubscribe(listener: () => void): () => void {
    const query = globalThis.matchMedia?.(DARK_QUERY);
    if (!query) return () => undefined;
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
}

/**
 * Creates an appearance store. The platform appearance source is injectable so
 * tests drive it deterministically. Listeners are notified only when the
 * resolved snapshot actually changes, so a platform change that the current mode
 * ignores is not a notification.
 */
export function appearanceStoreCreate(options: AppearanceStoreOptions = {}): AppearanceStore {
    const systemAppearance = options.systemAppearance ?? browserSystemAppearance;
    const systemSubscribe = options.systemAppearanceSubscribe ?? browserSystemAppearanceSubscribe;

    const listeners = new Set<() => void>();
    let mode: ThemeMode = options.mode ?? "system";
    let scrollbarVisibility: ScrollbarVisibility = options.scrollbarVisibility ?? "automatic";
    let snapshot: AppearanceSnapshot = {
        mode,
        appearance: mode === "system" ? systemAppearance() : mode,
        scrollbarVisibility,
    };
    let systemUnsubscribe: (() => void) | undefined;
    let disposed = false;

    const publish = (): void => {
        const appearance = mode === "system" ? systemAppearance() : mode;
        if (
            snapshot.mode === mode &&
            snapshot.appearance === appearance &&
            snapshot.scrollbarVisibility === scrollbarVisibility
        )
            return;
        snapshot = { mode, appearance, scrollbarVisibility };
        for (const listener of listeners) listener();
    };

    // The platform is only worth observing while a subscriber exists and the
    // current mode actually resolves against it.
    const systemWatchSync = (): void => {
        const wanted = mode === "system" && listeners.size > 0 && !disposed;
        if (wanted && systemUnsubscribe === undefined) systemUnsubscribe = systemSubscribe(publish);
        else if (!wanted && systemUnsubscribe !== undefined) {
            systemUnsubscribe();
            systemUnsubscribe = undefined;
        }
    };

    const modeSet = (next: ThemeMode): void => {
        if (mode === next) return;
        mode = next;
        publish();
        systemWatchSync();
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) {
                // A platform change may have landed while nothing was listening.
                publish();
                systemWatchSync();
            }
            return () => {
                listeners.delete(listener);
                systemWatchSync();
            };
        },
        appearanceToggle() {
            modeSet(snapshot.appearance === "dark" ? "light" : "dark");
        },
        appearanceSelect(next) {
            modeSet(next);
        },
        scrollbarVisibilitySelect(next) {
            if (scrollbarVisibility === next) return;
            scrollbarVisibility = next;
            publish();
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            listeners.clear();
            systemWatchSync();
        },
    };
}
