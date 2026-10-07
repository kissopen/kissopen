/*
 * Which sessions a network session list says are gone.
 *
 * `/v1/sessions` returns only the most recently updated sessions (the server
 * takes 150, newest `updatedAt` first). A session the phone knows that the
 * list leaves out is gone only when the list should have had it: a list
 * shorter than the limit is complete, and a full list covers exactly the
 * sessions updated after its oldest entry. Anything older was merely paged
 * out — it and its message log stay. A tie with the oldest entry is kept, as
 * the server's order among equal times is not known.
 *
 * Pure: the caller passes the lists, so the rule can be tested on its own.
 */

/** How many sessions `/v1/sessions` returns at most. */
export const SERVER_SESSION_LIST_LIMIT = 150;

/** How many session records the cached list keeps: the listed ones and the newest paged out. */
export const CACHED_SESSION_LIST_MAX = 500;

export type DatedSession = { readonly id: string; readonly updatedAt: number };

/**
 * The known sessions the list left out, as `gone` (the list should have had
 * them) and `pagedOut` (older than what a full list covers, or touched by a
 * live event while the list was being fetched — never pruned).
 */
export function sessionsLeftOut<T extends DatedSession>(
    listed: readonly DatedSession[],
    known: readonly T[],
    protectedIds: ReadonlySet<string> = new Set(),
    limit: number = SERVER_SESSION_LIST_LIMIT,
): { gone: T[]; pagedOut: T[] } {
    const listedIds = new Set(listed.map((session) => session.id));
    const complete = listed.length < limit;
    let oldest = Number.POSITIVE_INFINITY;
    for (const session of listed) if (session.updatedAt < oldest) oldest = session.updatedAt;
    const gone: T[] = [];
    const pagedOut: T[] = [];
    const seen = new Set<string>();
    for (const session of known) {
        if (listedIds.has(session.id) || seen.has(session.id)) continue;
        seen.add(session.id);
        if (protectedIds.has(session.id)) pagedOut.push(session);
        else if (complete || session.updatedAt > oldest) gone.push(session);
        else pagedOut.push(session);
    }
    return { gone, pagedOut };
}

/**
 * The list to keep for the next start: every listed record, then the newest
 * paged-out ones up to `max` in all.
 */
export function sessionListToCache<T extends DatedSession>(listed: readonly T[], pagedOut: readonly T[], max: number = CACHED_SESSION_LIST_MAX): T[] {
    const room = Math.max(0, max - listed.length);
    const older = [...pagedOut].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, room);
    return [...listed, ...older];
}
