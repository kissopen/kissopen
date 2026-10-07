import type { ApiMessage } from '../apiTypes';

/*
 * One session's cached message log, and the cursor rule both it and Sync's
 * in-memory state follow.
 *
 * The cache holds the server's records exactly as they arrived — the
 * `content` is still the encrypted envelope, so nothing readable is ever
 * written to disk. On the next visit the records go through the same decrypt
 * and apply path as a fresh page, which is what lets a chat show at once and
 * offline.
 *
 * Seqs are not committed in order. The relay numbers a session's messages
 * with a counter it takes before the row is written, so seq N+1 can be
 * readable a moment before N, and a number taken for a message that turns out
 * to be a duplicate is never used at all. The newest seq seen is therefore
 * not a safe place to fetch forward from: a message still being written below
 * it would be skipped for good.
 *
 * So there are two cursors. `lastSeq` is the newest message held. `settledSeq`
 * is the one forward fetches start from: the highest seq S such that every
 * seq up to S is either held or a hole that has stayed empty for longer than
 * HOLE_GRACE_MS (a number the server will never use). Every missing seq in
 * (settledSeq, lastSeq] is tracked in `holes` with when it was first seen.
 * Messages above `settledSeq` that are already held come back with the next
 * forward fetch and are deduplicated by id.
 *
 * The run is [oldestSeq, lastSeq]: older history is served from here until
 * `oldestSeq` and from the server after. A page that would leave an untracked
 * gap is either merged across the gap's edge or replaces the cache outright;
 * it is never stitched on.
 *
 * Pure functions over plain values, so the rules can be tested on their own.
 */

export const MESSAGE_CACHE_VERSION = 2;

/** How long a missing seq may stay empty before it counts as never used. */
export const HOLE_GRACE_MS = 120_000;

/**
 * At most this many missing seqs are waited for; beyond it the oldest are
 * settled over at once. Only a server that skipped a great many numbers gets
 * near it, and a cursor must not stay behind a thousand-message gap.
 */
const MAX_TRACKED_HOLES = 1000;

/** Missing seqs above the settled cursor, each with when it was first seen (ms). */
export type SeqHoles = Readonly<Record<string, number>>;

export type CachedSessionMessages = {
    readonly v: typeof MESSAGE_CACHE_VERSION;
    /** Newest seq held. 0 for a session known to have no messages. */
    readonly lastSeq: number;
    /** Oldest seq held; null only when the cache holds no messages. */
    readonly oldestSeq: number | null;
    /**
     * Where the next forward fetch starts (`after_seq`): every seq up to it
     * is held, or a hole old enough to be a number the server never used.
     */
    readonly settledSeq: number;
    /** Every seq in (settledSeq, lastSeq] that is not held, with when it was first seen. */
    readonly holes: SeqHoles;
    /** Whether the server has messages older than `oldestSeq`. */
    readonly hasMoreOlder: boolean;
    /** Ascending by seq, one record per id. */
    readonly messages: readonly ApiMessage[];
};

/** How much one session keeps: the newest messages, by count and by size. */
export type MessageCacheLimits = {
    readonly maxMessages: number;
    /** Sum of the encrypted `content.c` lengths, in characters. */
    readonly maxChars: number;
};

export const DEFAULT_MESSAGE_CACHE_LIMITS: MessageCacheLimits = {
    maxMessages: 2000,
    maxChars: 8 * 1024 * 1024,
};

function isApiMessage(value: unknown): value is ApiMessage {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    const content = record.content as Record<string, unknown> | null | undefined;
    return typeof record.id === 'string'
        && typeof record.seq === 'number' && Number.isSafeInteger(record.seq) && record.seq >= 0
        && typeof record.createdAt === 'number'
        && typeof record.updatedAt === 'number'
        && (record.localId === undefined || record.localId === null || typeof record.localId === 'string')
        && !!content && content.t === 'encrypted' && typeof content.c === 'string';
}

function seqRange(messages: readonly ApiMessage[]): { min: number; max: number } | null {
    if (messages.length === 0) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const message of messages) {
        if (message.seq < min) min = message.seq;
        if (message.seq > max) max = message.seq;
    }
    return { min, max };
}

/**
 * Both sets of records as one, by id: the later arrival wins, since a record
 * the server sent again is at least as new as the copy already held.
 */
export function mergeMessagesById(held: readonly ApiMessage[], incoming: readonly ApiMessage[]): ApiMessage[] {
    const byId = new Map<string, ApiMessage>();
    for (const message of held) byId.set(message.id, message);
    for (const message of incoming) byId.set(message.id, message);
    return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * The settled cursor over (settledSeq, lastSeq]: it moves up over every seq
 * that is held or has been a hole for HOLE_GRACE_MS, and stops at the first
 * hole younger than that. Every missing seq above it is returned as a hole,
 * keeping when it was first seen (now, for one seen for the first time).
 */
export function seqSettle(
    settledSeq: number,
    lastSeq: number,
    holes: SeqHoles,
    isHeld: (seq: number) => boolean,
    now: number,
): { settledSeq: number; holes: SeqHoles } {
    let settled = Math.min(settledSeq, lastSeq);
    const firstSeen = (seq: number) => Math.min(holes[seq] ?? now, now);
    const missing: number[] = [];
    for (let seq = settled + 1; seq <= lastSeq; seq++) {
        if (!isHeld(seq)) missing.push(seq);
    }
    // Far too many to wait for: the oldest are numbers the server skipped.
    if (missing.length > MAX_TRACKED_HOLES) {
        settled = missing[missing.length - MAX_TRACKED_HOLES - 1];
        missing.splice(0, missing.length - MAX_TRACKED_HOLES);
    }
    let index = 0;
    while (settled < lastSeq) {
        const next = settled + 1;
        if (index < missing.length && missing[index] === next) {
            if (now - firstSeen(next) < HOLE_GRACE_MS) break;
            index++;
        }
        settled = next;
    }
    const nextHoles: Record<string, number> = {};
    for (; index < missing.length; index++) {
        const seq = missing[index];
        if (seq > settled) nextHoles[seq] = firstSeen(seq);
    }
    return { settledSeq: settled, holes: nextHoles };
}

/**
 * Sync's own cursor for a session it has messages for: the same rule as the
 * cache's, over the seqs it has applied rather than a stored log.
 */
export type SeqTracker = {
    readonly settledSeq: number;
    /** Newest seq applied. */
    readonly lastSeq: number;
    readonly holes: SeqHoles;
    /** Seqs applied above `settledSeq` (each has a hole somewhere below it). */
    readonly heldAbove: ReadonlySet<number>;
};

/** A cursor from `settledSeq`, nothing above it held yet. */
export function seqTrackerStart(settledSeq: number): SeqTracker {
    const settled = Math.max(0, settledSeq);
    return { settledSeq: settled, lastSeq: settled, holes: {}, heldAbove: new Set() };
}

/**
 * Seqs just applied (a forward page, the newest page or a live message). The
 * cursor never moves past a hole younger than HOLE_GRACE_MS; an empty batch
 * still settles holes that have aged out.
 */
export function seqTrackerRecord(tracker: SeqTracker, seqs: Iterable<number>, now: number = Date.now()): SeqTracker {
    const held = new Set(tracker.heldAbove);
    let lastSeq = tracker.lastSeq;
    for (const seq of seqs) {
        if (seq <= tracker.settledSeq) continue;
        held.add(seq);
        if (seq > lastSeq) lastSeq = seq;
    }
    const settled = seqSettle(tracker.settledSeq, lastSeq, tracker.holes, (seq) => held.has(seq), now);
    const heldAbove = new Set<number>();
    for (const seq of held) if (seq > settled.settledSeq) heldAbove.add(seq);
    return { settledSeq: settled.settledSeq, lastSeq, holes: settled.holes, heldAbove };
}

/** Sync's cursor seeded from a cached log, its holes aged to `now`. */
export function seqTrackerOfCache(entry: CachedSessionMessages, now: number = Date.now()): SeqTracker {
    const heldAbove = new Set<number>();
    for (const message of entry.messages) if (message.seq > entry.settledSeq) heldAbove.add(message.seq);
    return seqTrackerRecord({ settledSeq: entry.settledSeq, lastSeq: entry.lastSeq, holes: entry.holes, heldAbove }, [], now);
}

function emptyEntry(): CachedSessionMessages {
    return { v: MESSAGE_CACHE_VERSION, lastSeq: 0, oldestSeq: null, settledSeq: 0, holes: {}, hasMoreOlder: false, messages: [] };
}

/**
 * An entry over `messages` (ascending, one per id), its settled cursor moved
 * up from `settledBase` over what is held and what has aged out.
 */
function entryOf(
    messages: readonly ApiMessage[],
    hasMoreOlder: boolean,
    settledBase: number,
    holes: SeqHoles,
    now: number,
): CachedSessionMessages {
    const range = seqRange(messages);
    if (!range) return emptyEntry();
    const held = new Set(messages.map((message) => message.seq));
    const settled = seqSettle(Math.max(0, settledBase), range.max, holes, (seq) => held.has(seq), now);
    return {
        v: MESSAGE_CACHE_VERSION,
        lastSeq: range.max,
        oldestSeq: range.min,
        settledSeq: settled.settledSeq,
        holes: settled.holes,
        hasMoreOlder,
        messages,
    };
}

function parseMessages(value: unknown): ApiMessage[] | null {
    if (!Array.isArray(value) || !value.every(isApiMessage)) return null;
    return mergeMessagesById([], value as ApiMessage[]);
}

/**
 * A cache read from disk, checked. Anything malformed — an unknown version, a
 * record without its envelope, cursors that disagree with the records — is no
 * cache at all rather than a half-trusted one. A version 1 log (written when
 * the newest seq was the forward cursor) is taken as settled up to its newest.
 */
export function messageCacheParse(value: unknown): CachedSessionMessages | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (typeof record.lastSeq !== 'number' || typeof record.hasMoreOlder !== 'boolean') return null;
    const messages = parseMessages(record.messages);
    if (!messages) return null;
    const range = seqRange(messages);

    if (record.v === 1) {
        if (!range) return record.lastSeq === 0 ? emptyEntry() : null;
        if (record.oldestSeq !== range.min || record.lastSeq !== range.max) return null;
        return {
            v: MESSAGE_CACHE_VERSION,
            lastSeq: range.max,
            oldestSeq: range.min,
            settledSeq: range.max,
            holes: {},
            hasMoreOlder: record.hasMoreOlder,
            messages,
        };
    }

    if (record.v !== MESSAGE_CACHE_VERSION) return null;
    const settledSeq = record.settledSeq;
    const holes = record.holes;
    if (typeof settledSeq !== 'number' || !Number.isSafeInteger(settledSeq) || settledSeq < 0) return null;
    if (!holes || typeof holes !== 'object' || Array.isArray(holes)) return null;
    if (!range) {
        return record.lastSeq === 0 && settledSeq === 0 && Object.keys(holes).length === 0 ? emptyEntry() : null;
    }
    if (record.oldestSeq !== range.min || record.lastSeq !== range.max || settledSeq > range.max) return null;
    const held = new Set(messages.map((message) => message.seq));
    const parsedHoles: Record<string, number> = {};
    let count = 0;
    for (const [key, firstSeen] of Object.entries(holes as Record<string, unknown>)) {
        const seq = Number(key);
        if (!Number.isSafeInteger(seq) || String(seq) !== key || seq <= settledSeq || seq > range.max || held.has(seq)) return null;
        if (typeof firstSeen !== 'number' || !Number.isFinite(firstSeen)) return null;
        parsedHoles[key] = firstSeen;
        count++;
    }
    // Every seq above the cursor is accounted for: held, or a tracked hole.
    let heldAbove = 0;
    for (const seq of held) if (seq > settledSeq) heldAbove++;
    if (heldAbove + count !== range.max - settledSeq) return null;
    return {
        v: MESSAGE_CACHE_VERSION,
        lastSeq: range.max,
        oldestSeq: range.min,
        settledSeq,
        holes: parsedHoles,
        hasMoreOlder: record.hasMoreOlder,
        messages,
    };
}

/** The entry with its holes aged to `now`: those past the grace are settled over. */
export function messageCacheSettle(entry: CachedSessionMessages, now: number = Date.now()): CachedSessionMessages {
    if (entry.messages.length === 0 || entry.settledSeq >= entry.lastSeq) return entry;
    return entryOf(entry.messages, entry.hasMoreOlder, entry.settledSeq, entry.holes, now);
}

/**
 * The newest page, fetched without a cursor (`before_seq` = infinity): every
 * message readable in its range. It joins the cache when the two touch or
 * overlap, and otherwise replaces it — the messages in between were never
 * fetched, so the old run can no longer be vouched for. A page that is the
 * whole history (`hasMore` false) settles from 0, so a first message not yet
 * readable is waited for like any other hole.
 */
export function messageCacheApplyLatest(
    entry: CachedSessionMessages | undefined,
    page: readonly ApiMessage[],
    hasMore: boolean,
    now: number = Date.now(),
): CachedSessionMessages {
    const range = seqRange(page);
    if (!range) return emptyEntry();
    if (entry && entry.oldestSeq !== null && range.min <= entry.lastSeq + 1 && range.max >= entry.oldestSeq - 1) {
        const merged = mergeMessagesById(entry.messages, page);
        const olderEdgeIsCache = entry.oldestSeq < range.min;
        return entryOf(merged, olderEdgeIsCache ? entry.hasMoreOlder : hasMore, entry.settledSeq, entry.holes, now);
    }
    return entryOf(mergeMessagesById([], page), hasMore, hasMore ? range.min - 1 : 0, {}, now);
}

/**
 * Messages after `afterSeq`: a forward page (`after_seq`) or one live message
 * from the socket (`afterSeq` = its seq - 1). A page is every message readable
 * in (afterSeq, its newest], so it extends the cache whenever the cache
 * already reaches `afterSeq`. The part of it older than the cache's own oldest
 * message is left out rather than risk an untracked gap — except what fills a
 * hole the cache is waiting for. When the cache stops short of `afterSeq`, the
 * messages in between are missing, so the page starts a fresh run, settled
 * from `afterSeq`, with older history left to the server. An empty page
 * changes nothing.
 */
export function messageCacheApplyForward(
    entry: CachedSessionMessages | undefined,
    afterSeq: number,
    page: readonly ApiMessage[],
    now: number = Date.now(),
): CachedSessionMessages | undefined {
    const fresh = page.filter((message) => message.seq > afterSeq);
    if (fresh.length === 0) return entry;
    if (entry && entry.lastSeq >= afterSeq) {
        const { oldestSeq, settledSeq } = entry;
        const joining = oldestSeq === null
            ? fresh
            : fresh.filter((message) => message.seq >= oldestSeq || message.seq > settledSeq);
        if (joining.length === 0) return entry;
        const merged = mergeMessagesById(entry.messages, joining);
        // A session known to be empty that gains its first messages has
        // nothing older; otherwise the older edge is still the cache's own.
        return entryOf(merged, oldestSeq === null ? false : entry.hasMoreOlder, settledSeq, entry.holes, now);
    }
    return entryOf(mergeMessagesById([], fresh), afterSeq > 0, afterSeq, {}, now);
}

/**
 * Messages before `beforeSeq`, fetched while paging back. They join the cache
 * only when the cache already reaches down to `beforeSeq`, so the two runs
 * touch; a page for a gap the cache does not border is left out. A seq missing
 * from such a page is below the settled cursor, so it is not waited for.
 */
export function messageCacheApplyOlder(
    entry: CachedSessionMessages | undefined,
    beforeSeq: number,
    page: readonly ApiMessage[],
    hasMore: boolean,
    now: number = Date.now(),
): CachedSessionMessages | undefined {
    if (!entry || entry.oldestSeq === null || entry.oldestSeq > beforeSeq) return entry;
    const older = page.filter((message) => message.seq < beforeSeq);
    const range = seqRange(older);
    if (!range) {
        // Nothing older than the cache's own oldest message: history is complete.
        return beforeSeq <= entry.oldestSeq ? { ...entry, hasMoreOlder: false } : entry;
    }
    const merged = mergeMessagesById(entry.messages, older);
    const extendsCache = range.min < entry.oldestSeq;
    return entryOf(merged, extendsCache ? hasMore : entry.hasMoreOlder, entry.settledSeq, entry.holes, now);
}

/**
 * The newest messages that fit the limits. What falls off is the oldest end:
 * `oldestSeq` moves up and the server holds the rest. The settled cursor is
 * never left below the new run, so a hole that fell off with it is no longer
 * waited for here (Sync's own cursor still waits for it).
 */
export function messageCacheCap(
    entry: CachedSessionMessages,
    limits: MessageCacheLimits = DEFAULT_MESSAGE_CACHE_LIMITS,
    now: number = Date.now(),
): CachedSessionMessages {
    const messages = entry.messages;
    let keepFrom = Math.max(0, messages.length - limits.maxMessages);
    let chars = 0;
    for (let index = messages.length - 1; index >= keepFrom; index--) {
        chars += messages[index].content.c.length;
        if (chars > limits.maxChars) {
            // Always keep the newest message, however large.
            keepFrom = Math.min(index + 1, messages.length - 1);
            break;
        }
    }
    if (keepFrom === 0) return entry;
    const kept = messages.slice(keepFrom);
    return entryOf(kept, true, Math.max(entry.settledSeq, kept[0].seq - 1), entry.holes, now);
}

/**
 * Whether the cache can stand in for the first page: it must hold the
 * messages its cursor claims, or be a session known to be empty.
 */
export function messageCacheSeedable(entry: CachedSessionMessages): boolean {
    return entry.lastSeq === 0 ? entry.messages.length === 0 : entry.messages.length > 0 && entry.oldestSeq !== null;
}

export type CachedMessagePage = {
    readonly messages: readonly ApiMessage[];
    /** Oldest seq in the page; null for an empty page. */
    readonly oldestSeq: number | null;
    /** Whether anything older exists, in the cache or on the server. */
    readonly hasMore: boolean;
};

/** The newest `limit` cached messages: what a chat shows first. */
export function messageCacheLatestPage(entry: CachedSessionMessages, limit: number): CachedMessagePage {
    const messages = entry.messages.slice(Math.max(0, entry.messages.length - limit));
    return {
        messages,
        oldestSeq: messages.length > 0 ? messages[0].seq : null,
        hasMore: entry.messages.length > messages.length || entry.hasMoreOlder,
    };
}

/**
 * Up to `limit` cached messages just before `beforeSeq`, when the cache holds
 * that stretch; undefined sends the caller to the server.
 */
export function messageCacheOlderPage(entry: CachedSessionMessages | undefined, beforeSeq: number, limit: number): CachedMessagePage | undefined {
    if (!entry || entry.oldestSeq === null || entry.oldestSeq >= beforeSeq || beforeSeq > entry.lastSeq + 1) return undefined;
    const older = entry.messages.filter((message) => message.seq < beforeSeq);
    if (older.length === 0) return undefined;
    const messages = older.slice(Math.max(0, older.length - limit));
    return {
        messages,
        oldestSeq: messages[0].seq,
        hasMore: older.length > messages.length || entry.hasMoreOlder,
    };
}
