/**
 * Whether this copy of the app offers the features that are not finished yet.
 *
 * It is the window's own switch, not a KISSOPEN Agent's and not an account's: it says what
 * this installation shows the person sitting at it, so turning it on somewhere
 * else changes nothing here. That is why it is kept by the host's own storage
 * rather than by any machine the window connects to — a feature is unfinished
 * for the reader looking at it, and no daemon has an opinion about that.
 *
 * Following the state principles, the constructor opens nothing: it reads the
 * host's record once, and writes back only when the reader changes the switch.
 */
export interface ExperimentsDocument {
    readonly experimentalFeaturesEnabled: boolean;
}

/**
 * Where that switch is kept. The state package never names a storage medium: the
 * host supplies one, and omitting it leaves the choice alive for this window's
 * lifetime only.
 */
export interface ExperimentsPersistence {
    read(): ExperimentsDocument | undefined;
    write(document: ExperimentsDocument): void;
}

export interface ExperimentsSnapshot {
    /** Off until the reader asks for the unfinished features by name. */
    readonly experimentalFeaturesEnabled: boolean;
}

export interface ExperimentsStore {
    get(): ExperimentsSnapshot;
    subscribe(listener: () => void): () => void;
    /** Offers or withholds the unfinished features across this whole window. */
    experimentalFeaturesUpdate(enabled: boolean): void;
}

/**
 * A stored record read back as this window's own value.
 *
 * The document comes from the host's storage, which a previous version of this
 * app wrote and a person can edit by hand, so anything that is not the switch
 * this version knows is treated as no record at all rather than as a value.
 */
function documentParse(value: unknown): ExperimentsDocument | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const enabled = (value as { experimentalFeaturesEnabled?: unknown })
        .experimentalFeaturesEnabled;
    return typeof enabled === "boolean" ? { experimentalFeaturesEnabled: enabled } : undefined;
}

const DISABLED: ExperimentsSnapshot = { experimentalFeaturesEnabled: false };

/**
 * Creates the window-lifetime experiments store, hydrated from the host's
 * storage when it has one. Unfinished features stay off until the reader turns
 * them on: a person who has never asked for them is shown the finished product.
 */
export function experimentsStoreCreate(persistence?: ExperimentsPersistence): ExperimentsStore {
    let snapshot: ExperimentsSnapshot = (() => {
        try {
            return documentParse(persistence?.read()) ?? DISABLED;
        } catch {
            // Storage the host refused is a window that has no record, which is
            // the same as never having been asked.
            return DISABLED;
        }
    })();
    const listeners = new Set<() => void>();

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        experimentalFeaturesUpdate(enabled) {
            if (snapshot.experimentalFeaturesEnabled === enabled) return;
            snapshot = { experimentalFeaturesEnabled: enabled };
            try {
                persistence?.write(snapshot);
            } catch {
                // Storage the host refused still keeps this window's choice for
                // as long as it stays open.
            }
            for (const listener of listeners) listener();
        },
    };
}

/**
 * The store a host that remembers nothing stands in. It withholds the unfinished
 * features and never changes, so a surface can subscribe to it unconditionally
 * instead of branching on whether this window has storage.
 */
export const experimentsStoreNoop: ExperimentsStore = {
    experimentalFeaturesUpdate: () => {},
    get: () => DISABLED,
    subscribe: () => () => {},
};
