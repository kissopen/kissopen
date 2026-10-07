import type { DesktopStartupValues } from "kissopen-desktop-app";

export interface StartupValuesStore {
    get(): DesktopStartupValues;
    subscribe(listener: () => void): () => void;
    change(values: DesktopStartupValues): void;
}

/**
 * The desktop chooser's form values held outside React. The startup screen is a
 * pure projection of this store, so the renderer needs no local component state.
 */
export function startupValuesStoreCreate(): StartupValuesStore {
    let values: DesktopStartupValues = { mode: "local" };
    const listeners = new Set<() => void>();
    return {
        get: () => values,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        change(next) {
            values = next;
            for (const listener of listeners) listener();
        },
    };
}
