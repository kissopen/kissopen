/**
 * Whether activity is also reported by a band of light travelling through
 * session, project, and workspace titles.
 *
 * This is the window's own visual choice rather than a KISSOPEN Agent setting. Its stored
 * document is deliberately an optional override: a release may change the
 * product default for everyone who has never chosen, while a reader who has
 * chosen keeps exactly what they asked for.
 */
export const TITLE_SHIMMER_ENABLED_DEFAULT = false;

export interface TitleShimmerDocument {
    /** Absent until the reader explicitly changes the setting. */
    readonly titleShimmerEnabled?: boolean;
}

export interface TitleShimmerPersistence {
    read(): TitleShimmerDocument | undefined;
    write(document: TitleShimmerDocument): void;
}

export interface TitleShimmerSnapshot {
    readonly titleShimmerEnabled: boolean;
}

export interface TitleShimmerStore {
    get(): TitleShimmerSnapshot;
    subscribe(listener: () => void): () => void;
    /** Keeps this explicit choice across launches, independent of later defaults. */
    titleShimmerUpdate(enabled: boolean): void;
}

function documentParse(value: unknown): TitleShimmerDocument | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const enabled = (value as { titleShimmerEnabled?: unknown }).titleShimmerEnabled;
    return typeof enabled === "boolean" ? { titleShimmerEnabled: enabled } : undefined;
}

const DEFAULT_SNAPSHOT: TitleShimmerSnapshot = {
    titleShimmerEnabled: TITLE_SHIMMER_ENABLED_DEFAULT,
};

/**
 * Creates the window-lifetime title-shimmer store.
 *
 * Reading an absent record applies the current product default entirely in
 * memory. Nothing is persisted until `titleShimmerUpdate` records a choice, so
 * merely launching this version cannot pin today's default for future releases.
 */
export function titleShimmerStoreCreate(persistence?: TitleShimmerPersistence): TitleShimmerStore {
    let override: boolean | undefined;
    try {
        override = documentParse(persistence?.read())?.titleShimmerEnabled;
    } catch {
        // Storage the host refused is the same as no remembered choice.
    }
    let snapshot: TitleShimmerSnapshot =
        override === undefined ? DEFAULT_SNAPSHOT : { titleShimmerEnabled: override };
    const listeners = new Set<() => void>();

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        titleShimmerUpdate(enabled) {
            if (override === enabled) return;
            override = enabled;
            const changed = snapshot.titleShimmerEnabled !== enabled;
            if (changed) snapshot = { titleShimmerEnabled: enabled };
            try {
                persistence?.write({ titleShimmerEnabled: enabled });
            } catch {
                // Keep the explicit choice for the rest of this window even
                // when the host cannot remember it.
            }
            if (changed) for (const listener of listeners) listener();
        },
    };
}

/**
 * A host without preference storage uses the product default and ignores
 * updates, so application surfaces can subscribe without branching.
 */
export const titleShimmerStoreNoop: TitleShimmerStore = {
    get: () => DEFAULT_SNAPSHOT,
    subscribe: () => () => {},
    titleShimmerUpdate: () => {},
};
