export type KissopenAgentDebugLogLevel = "info" | "warning" | "error";

export type KissopenAgentDebugLogSource =
    | "catalog"
    | "connection"
    | "health"
    | "mutation"
    | "sse"
    | "sync";

/** One diagnostic fact before the store assigns its local identity and timestamp. */
export interface KissopenAgentDebugLogInput {
    readonly detail?: string;
    readonly level: KissopenAgentDebugLogLevel;
    readonly message: string;
    readonly source: KissopenAgentDebugLogSource;
}

export interface KissopenAgentDebugLogEntry extends KissopenAgentDebugLogInput {
    readonly id: number;
    /** Epoch milliseconds when this window observed the event. */
    readonly occurredAt: number;
}

export interface KissopenAgentDebugLogSnapshot {
    /** Entries retained in arrival order, oldest first. */
    readonly entries: readonly KissopenAgentDebugLogEntry[];
    /** Entries removed from the head to keep this diagnostic surface memory-bounded. */
    readonly discardedEntries: number;
}

export interface KissopenAgentDebugLogStore {
    get(): KissopenAgentDebugLogSnapshot;
    subscribe(listener: () => void): () => void;
}

/** Private input used by the connection composition root, never by UI code. */
export interface KissopenAgentDebugLogWriter {
    entryAppend(input: KissopenAgentDebugLogInput): void;
}

export interface KissopenAgentDebugLogStoreOptions {
    readonly now?: () => number;
}

const MAXIMUM_ENTRIES = 2_000;
const MAXIMUM_RETAINED_CHARACTERS = 4 * 1024 * 1024;
const MAXIMUM_DETAIL_CHARACTERS = 64 * 1024;

function detailBound(detail: string | undefined): string | undefined {
    if (detail === undefined || detail.length <= MAXIMUM_DETAIL_CHARACTERS) return detail;
    const discarded = detail.length - MAXIMUM_DETAIL_CHARACTERS;
    return `${detail.slice(0, MAXIMUM_DETAIL_CHARACTERS)}\n… ${discarded.toLocaleString("en-US")} detail characters omitted`;
}

function entryCharacters(entry: KissopenAgentDebugLogEntry): number {
    return entry.message.length + (entry.detail?.length ?? 0);
}

/**
 * Creates one Kissopen Agent-lifetime diagnostic buffer. The constructor opens no timers or
 * transport; connection owners synchronously write the facts they observe.
 */
export function kissopenAgentDebugLogStoreCreate(options: KissopenAgentDebugLogStoreOptions = {}): {
    readonly store: KissopenAgentDebugLogStore;
    readonly writer: KissopenAgentDebugLogWriter;
} {
    const now = options.now ?? Date.now;
    const listeners = new Set<() => void>();
    let nextId = 1;
    let retainedCharacters = 0;
    let snapshot: KissopenAgentDebugLogSnapshot = { discardedEntries: 0, entries: [] };

    const writer: KissopenAgentDebugLogWriter = {
        entryAppend(input) {
            const detail = detailBound(input.detail);
            const entry: KissopenAgentDebugLogEntry = {
                ...input,
                ...(detail === undefined ? {} : { detail }),
                id: nextId,
                occurredAt: now(),
            };
            nextId += 1;

            const entries = [...snapshot.entries, entry];
            retainedCharacters += entryCharacters(entry);
            let discardedEntries = snapshot.discardedEntries;
            while (
                entries.length > 1 &&
                (entries.length > MAXIMUM_ENTRIES ||
                    retainedCharacters > MAXIMUM_RETAINED_CHARACTERS)
            ) {
                const discarded = entries.shift();
                if (discarded === undefined) break;
                retainedCharacters -= entryCharacters(discarded);
                discardedEntries += 1;
            }
            snapshot = { discardedEntries, entries };
            for (const listener of listeners) listener();
        },
    };

    return {
        store: {
            get: () => snapshot,
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        writer,
    };
}
