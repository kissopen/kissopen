/** Local tab visibility, independent of a conversation's server lifecycle. */
export interface ConversationTabsPersistence {
    read(): unknown;
    write(closed: readonly string[]): void;
}

export interface ConversationTabsStore {
    get(): ReadonlySet<string>;
    subscribe(listener: () => void): () => void;
    close(id: string): void;
    open(id: string): void;
}

/** Bound the remembered arrangement even when conversations are later deleted. */
const CLOSED_LIMIT = 4096;

export function conversationTabsStoreCreate(
    persistence?: ConversationTabsPersistence,
): ConversationTabsStore {
    let closed = new Set<string>();
    try {
        const saved = persistence?.read();
        if (Array.isArray(saved)) {
            closed = new Set(
                saved
                    .filter((id): id is string => typeof id === "string" && id.length > 0)
                    .slice(-CLOSED_LIMIT),
            );
        }
    } catch {
        // Unavailable storage must not prevent closing a page in this window.
    }
    const listeners = new Set<() => void>();
    const change = (id: string, hide: boolean): void => {
        if (!id || closed.has(id) === hide) return;
        closed = new Set(closed);
        if (hide) closed.add(id);
        else closed.delete(id);
        if (closed.size > CLOSED_LIMIT) closed.delete(closed.values().next().value!);
        try {
            persistence?.write([...closed]);
        } catch {
            // The in-memory arrangement remains usable when persistence fails.
        }
        for (const listener of listeners) listener();
    };
    return {
        get: () => closed,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        close: (id) => change(id, true),
        open: (id) => change(id, false),
    };
}
