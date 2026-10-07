import type {
    KissopenAgentModelPreferenceDocument,
    KissopenAgentModelPreferencePersistence,
} from "kissopen-desktop-state";

/** A remote's model choices never share the main daemon's desktop settings document. */
export function desktopConnectionPreferencesCreate(
    id: string,
): KissopenAgentModelPreferencePersistence {
    const key = `kissopen.connection-preferences.v1:${id}`;
    const listeners = new Set<() => void>();
    let current: KissopenAgentModelPreferenceDocument | undefined;
    try {
        const value = localStorage.getItem(key);
        current = value ? (JSON.parse(value) as KissopenAgentModelPreferenceDocument) : undefined;
    } catch {
        /* Storage-denied windows retain in-memory choices. */
    }
    return {
        read: () => current,
        write(next) {
            current = next;
            try {
                localStorage.setItem(key, JSON.stringify(next));
            } catch {
                /* Memory remains authoritative for this window. */
            }
            for (const listener of listeners) listener();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
