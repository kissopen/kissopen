/**
 * The order the reader arranged the window's pinned navigation rows in — the
 * ones above the projects, such as Notes, Inbox, Usage and a plugin's
 * application — as the row ids in the order they are to be shown.
 *
 * Rows this window is not offering right now stay in the list: a machine that is
 * unreachable has not been moved back to where it started, and a plugin that is
 * not loaded has not been uninstalled. They hold their place until they are
 * shown again.
 *
 * An arrangement is stated as the whole list rather than as fractional keys
 * because this list is short, entirely this window's own, and has no second
 * writer to merge with: there is nothing here for a key to buy, and a plain list
 * cannot hold a key that no longer sorts where it says it does.
 */
export interface KissopenAgentNavigationOrderDocument {
    readonly order: readonly string[];
}

/**
 * Where that order is kept. The state package never names a storage medium: the
 * host supplies one, and omitting it leaves the order alive for this window's
 * lifetime only.
 */
export interface KissopenAgentNavigationOrderPersistence {
    read(): KissopenAgentNavigationOrderDocument | undefined;
    write(document: KissopenAgentNavigationOrderDocument): void;
}

export interface KissopenAgentNavigationOrderSnapshot {
    /** Every row this window has ever been told where to put, in that order. */
    readonly order: readonly string[];
}

export interface KissopenAgentNavigationOrderStore {
    get(): KissopenAgentNavigationOrderSnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * Places `itemId` immediately after `afterId` among `ids` — the rows as they
     * stand on screen, in that order — or first when it is null. A row or
     * neighbour that is not among them is not a move anybody made and is
     * ignored.
     */
    itemReorder(itemId: string, afterId: string | null, ids: readonly string[]): void;
}

/**
 * How many rows one window will remember the place of. Far past every row the
 * product offers and every plugin a machine is likely to hold, and small enough
 * that a record nobody prunes stays a record rather than a heap.
 */
const ORDER_MAX = 128;

/**
 * The remembered order with every offered row in it. A row nobody has arranged —
 * a plugin installed since, a machine that has only just become reachable —
 * takes the place the window offered it: immediately after whichever row came
 * before it there. That is what keeps a new row where the product put it instead
 * of sending it to the end of a list it was never part of.
 */
function orderMerge(order: readonly string[], ids: readonly string[]): readonly string[] {
    const known = new Set(order);
    if (ids.every((id) => known.has(id))) return order;
    const merged = [...order];
    let previous: string | undefined;
    for (const id of ids) {
        if (!known.has(id)) {
            const at = previous === undefined ? 0 : merged.indexOf(previous) + 1;
            merged.splice(at, 0, id);
            known.add(id);
        }
        previous = id;
    }
    return merged;
}

/**
 * Keeps the record a record. Every row on screen is kept; past the bound, rows
 * nobody is offering are let go from the end of the list first, which is where a
 * plugin that was installed once and uninstalled long ago ends up.
 */
function orderTrim(order: readonly string[], ids: readonly string[]): readonly string[] {
    if (order.length <= ORDER_MAX) return order;
    const offered = new Set(ids);
    let excess = order.length - ORDER_MAX;
    const kept: string[] = [];
    for (let index = order.length - 1; index >= 0; index -= 1) {
        const id = order[index]!;
        if (excess > 0 && !offered.has(id)) {
            excess -= 1;
            continue;
        }
        kept.push(id);
    }
    return kept.reverse();
}

/**
 * The offered rows in the order they are shown: the arrangement the reader made,
 * with anything they have never arranged where the window offered it.
 */
export function kissopenAgentNavigationOrderApply(
    ids: readonly string[],
    order: readonly string[],
): readonly string[] {
    if (order.length === 0) return ids;
    const offered = new Set(ids);
    const shown = orderMerge(order, ids).filter((id) => offered.has(id));
    // A caller offering the same row twice would otherwise lose one of them.
    // Arranging a list that cannot be told apart is not something to guess at.
    return shown.length === ids.length ? shown : ids;
}

/**
 * Reads a stored document, keeping only what it can read. A document that has
 * been hand-edited, or written by a version of this app that arranged rows this
 * one has never heard of, is still mostly an arrangement somebody made: throwing
 * all of it away over one unreadable entry would forget the rest of it too.
 */
function documentParse(value: unknown): KissopenAgentNavigationOrderDocument | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const order = (value as { order?: unknown }).order;
    if (!Array.isArray(order)) return undefined;
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of order) {
        // A hand-edited document can name the same row twice, which would show
        // it twice; the first mention is the one kept.
        if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    return ids.length === 0 ? undefined : { order: ids };
}

const EMPTY_SNAPSHOT: KissopenAgentNavigationOrderSnapshot = { order: [] };

/**
 * The window's pinned navigation order, hydrated from the host's storage when it
 * has one. Stored documents come from a previous version of this app and from a
 * place a reader can edit, so the document is parsed rather than trusted; an
 * unreadable one simply means nothing has been arranged.
 */
export function kissopenAgentNavigationOrderStoreCreate(
    persistence?: KissopenAgentNavigationOrderPersistence,
): KissopenAgentNavigationOrderStore {
    let snapshot: KissopenAgentNavigationOrderSnapshot = (() => {
        try {
            return documentParse(persistence?.read()) ?? EMPTY_SNAPSHOT;
        } catch {
            return EMPTY_SNAPSHOT;
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
        itemReorder(itemId, afterId, ids) {
            if (afterId === itemId) return;
            if (!ids.includes(itemId)) return;
            if (afterId !== null && !ids.includes(afterId)) return;
            // The move is made against the whole arrangement, not just the rows
            // on screen, so a row that is away keeps the neighbours it had.
            const merged = orderMerge(snapshot.order, ids);
            const rest = merged.filter((id) => id !== itemId);
            const at = afterId === null ? 0 : rest.indexOf(afterId) + 1;
            const order = orderTrim([...rest.slice(0, at), itemId, ...rest.slice(at)], ids);
            if (
                order.length === snapshot.order.length &&
                order.every((id, index) => snapshot.order[index] === id)
            )
                return;
            snapshot = { order };
            try {
                persistence?.write(snapshot);
            } catch {
                // Storage the host refused still keeps this window's arrangement
                // for as long as it stays open.
            }
            for (const listener of listeners) listener();
        },
    };
}

/**
 * A navigation order for a window that keeps none. Nothing has been arranged and
 * nothing can be, so a sidebar that must read an order unconditionally reads "as
 * offered" instead of holding an arrangement it would lose on the next launch.
 */
export const kissopenAgentNavigationOrderStoreNoop: KissopenAgentNavigationOrderStore = {
    get: () => EMPTY_SNAPSHOT,
    subscribe: () => () => undefined,
    itemReorder: () => undefined,
};
