import { describe, expect, it } from 'vitest';
import type { ApiMessage } from '../apiTypes';
import {
    HOLE_GRACE_MS,
    MESSAGE_CACHE_VERSION,
    messageCacheApplyForward,
    messageCacheApplyLatest,
    messageCacheApplyOlder,
    messageCacheCap,
    messageCacheLatestPage,
    messageCacheOlderPage,
    messageCacheParse,
    messageCacheSeedable,
    messageCacheSettle,
    mergeMessagesById,
    seqTrackerOfCache,
    seqTrackerRecord,
    seqTrackerStart,
    type CachedSessionMessages,
} from './messageCache';

function msg(seq: number, c = `cipher-${seq}`, id = `m${seq}`): ApiMessage {
    return { id, seq, localId: null, content: { t: 'encrypted', c }, createdAt: seq, updatedAt: seq };
}

function range(from: number, to: number): ApiMessage[] {
    return Array.from({ length: to - from + 1 }, (_, index) => msg(from + index));
}

function seqs(entry: CachedSessionMessages | undefined): number[] {
    return (entry?.messages ?? []).map((message) => message.seq);
}

/**
 * The rule every entry keeps: each seq in (settledSeq, lastSeq] is held or a
 * tracked hole, no hole is held or outside that range, and the entry reads
 * back as itself.
 */
function expectInvariant(entry: CachedSessionMessages | undefined) {
    expect(entry).toBeDefined();
    const held = new Set(seqs(entry));
    for (let seq = entry!.settledSeq + 1; seq <= entry!.lastSeq; seq++) {
        expect(held.has(seq) || entry!.holes[seq] !== undefined).toBe(true);
    }
    for (const key of Object.keys(entry!.holes)) {
        const seq = Number(key);
        expect(seq > entry!.settledSeq && seq <= entry!.lastSeq && !held.has(seq)).toBe(true);
    }
    expect(entry!.settledSeq).toBeLessThanOrEqual(entry!.lastSeq);
    expect(messageCacheParse(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
}

describe('mergeMessagesById', () => {
    it('keeps one record per id, the later arrival winning, sorted by seq', () => {
        const merged = mergeMessagesById([msg(2), msg(1, 'old')], [msg(1, 'new'), msg(3)]);
        expect(merged.map((message) => message.seq)).toEqual([1, 2, 3]);
        expect(merged[0].content.c).toBe('new');
    });
});

describe('messageCacheApplyLatest', () => {
    it('starts a cache from the newest page', () => {
        const entry = messageCacheApplyLatest(undefined, range(101, 200), true);
        expect(entry).toMatchObject({ lastSeq: 200, oldestSeq: 101, hasMoreOlder: true });
        expect(entry.messages).toHaveLength(100);
    });

    it('records a session with no messages as empty, not unknown', () => {
        const entry = messageCacheApplyLatest(undefined, [], false);
        expect(entry).toMatchObject({ lastSeq: 0, oldestSeq: null, hasMoreOlder: false, messages: [] });
        expect(messageCacheSeedable(entry)).toBe(true);
    });

    it('joins a page that touches or overlaps the cache, keeping the older edge', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 50), false);
        const joined = messageCacheApplyLatest(held, range(51, 80), true);
        expect(joined).toMatchObject({ lastSeq: 80, oldestSeq: 1, hasMoreOlder: false });
        expect(seqs(joined)).toEqual(range(1, 80).map((message) => message.seq));
    });

    it('replaces the cache when the page leaves a hole', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 50), false);
        const replaced = messageCacheApplyLatest(held, range(200, 250), true);
        expect(replaced).toMatchObject({ lastSeq: 250, oldestSeq: 200, hasMoreOlder: true });
        expect(replaced.messages).toHaveLength(51);
    });
});

describe('messageCacheApplyForward', () => {
    const held = messageCacheApplyLatest(undefined, range(10, 20), true);

    it('appends a forward page that starts at the cache cursor', () => {
        const next = messageCacheApplyForward(held, 20, range(21, 25));
        expect(next).toMatchObject({ lastSeq: 25, oldestSeq: 10, hasMoreOlder: true });
        expect(seqs(next)).toEqual(range(10, 25).map((message) => message.seq));
    });

    it('appends one live message after the newest (afterSeq = seq - 1)', () => {
        const next = messageCacheApplyForward(held, 20, [msg(21)]);
        expect(next?.lastSeq).toBe(21);
    });

    it('changes nothing for an empty page or messages it already holds up to', () => {
        expect(messageCacheApplyForward(held, 20, [])).toBe(held);
        expect(messageCacheApplyForward(held, 25, [msg(12)])).toBe(held);
    });

    it('updates a record the cache already holds, by id', () => {
        const next = messageCacheApplyForward(held, 15, [msg(16, 'edited'), msg(21)]);
        expect(next?.messages.find((message) => message.seq === 16)?.content.c).toBe('edited');
        expect(next?.lastSeq).toBe(21);
    });

    it('leaves out the part of a page older than the cache instead of leaving a hole', () => {
        const next = messageCacheApplyForward(held, 5, range(6, 22));
        expect(next).toMatchObject({ lastSeq: 22, oldestSeq: 10 });
        expect(seqs(next)).toEqual(range(10, 22).map((message) => message.seq));
    });

    it('starts a fresh run when the cache stops short of the cursor', () => {
        const next = messageCacheApplyForward(held, 30, range(31, 33));
        expect(next).toMatchObject({ lastSeq: 33, oldestSeq: 31, hasMoreOlder: true });
    });

    it('gives an empty session its first messages with nothing older', () => {
        const empty = messageCacheApplyLatest(undefined, [], false);
        const next = messageCacheApplyForward(empty, 0, range(1, 2));
        expect(next).toMatchObject({ lastSeq: 2, oldestSeq: 1, hasMoreOlder: false });
    });

    it('builds a run without a cache from where the page starts', () => {
        expect(messageCacheApplyForward(undefined, 0, range(1, 3))).toMatchObject({ oldestSeq: 1, hasMoreOlder: false });
        expect(messageCacheApplyForward(undefined, 40, range(41, 43))).toMatchObject({ oldestSeq: 41, hasMoreOlder: true });
    });
});

describe('messageCacheApplyOlder', () => {
    const held = messageCacheApplyLatest(undefined, range(101, 200), true);

    it('prepends a page that ends where the cache begins', () => {
        const next = messageCacheApplyOlder(held, 101, range(1, 100), false);
        expect(next).toMatchObject({ lastSeq: 200, oldestSeq: 1, hasMoreOlder: false });
        expect(next?.messages).toHaveLength(200);
    });

    it('marks history complete when nothing older exists', () => {
        expect(messageCacheApplyOlder(held, 101, [], false)?.hasMoreOlder).toBe(false);
    });

    it('ignores a page for a hole the cache does not border', () => {
        expect(messageCacheApplyOlder(held, 50, range(1, 49), true)).toBe(held);
        expect(messageCacheApplyOlder(undefined, 50, range(1, 49), true)).toBeUndefined();
    });
});

describe('messageCacheCap', () => {
    it('keeps the newest messages by count and moves the older edge up', () => {
        const entry = messageCacheApplyLatest(undefined, range(1, 30), false);
        const capped = messageCacheCap(entry, { maxMessages: 10, maxChars: Number.POSITIVE_INFINITY });
        expect(capped).toMatchObject({ lastSeq: 30, oldestSeq: 21, hasMoreOlder: true });
        expect(capped.messages).toHaveLength(10);
    });

    it('keeps the newest messages by size, and always the newest one', () => {
        const entry = messageCacheApplyLatest(undefined, [msg(1, 'a'.repeat(10)), msg(2, 'b'.repeat(10)), msg(3, 'c'.repeat(10))], false);
        expect(seqs(messageCacheCap(entry, { maxMessages: 100, maxChars: 25 }))).toEqual([2, 3]);
        expect(seqs(messageCacheCap(entry, { maxMessages: 100, maxChars: 5 }))).toEqual([3]);
    });

    it('returns the same entry when it already fits', () => {
        const entry = messageCacheApplyLatest(undefined, range(1, 5), false);
        expect(messageCacheCap(entry)).toBe(entry);
    });
});

describe('messageCacheParse', () => {
    it('accepts what it wrote', () => {
        const entry = messageCacheApplyLatest(undefined, range(1, 3), true);
        expect(messageCacheParse(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
    });

    it('rejects another version, a record without its envelope, and cursors that disagree', () => {
        const entry = messageCacheApplyLatest(undefined, range(1, 3), true);
        expect(messageCacheParse({ ...entry, v: 3 })).toBeNull();
        expect(messageCacheParse({ ...entry, messages: [{ ...msg(1), content: { t: 'plain', c: 'hello' } }] })).toBeNull();
        expect(messageCacheParse({ ...entry, lastSeq: 9 })).toBeNull();
        expect(messageCacheParse(null)).toBeNull();
    });

    it('rejects holes that disagree with the records', () => {
        const entry = messageCacheApplyForward(undefined, 0, [msg(1), msg(3)], 0)!;
        expect(entry.holes).toEqual({ 2: 0 });
        expect(messageCacheParse({ ...entry, holes: {} })).toBeNull();
        expect(messageCacheParse({ ...entry, holes: { 2: 0, 3: 0 } })).toBeNull();
        expect(messageCacheParse({ ...entry, settledSeq: 7 })).toBeNull();
    });

    it('migrates a version 1 log as settled up to its newest message', () => {
        const v1 = { v: 1, lastSeq: 3, oldestSeq: 1, hasMoreOlder: true, messages: range(1, 3) };
        const migrated = messageCacheParse(JSON.parse(JSON.stringify(v1)));
        expect(migrated).toMatchObject({ v: MESSAGE_CACHE_VERSION, lastSeq: 3, oldestSeq: 1, settledSeq: 3, holes: {}, hasMoreOlder: true });
        expectInvariant(migrated!);
        expect(messageCacheParse({ ...v1, lastSeq: 9 })).toBeNull();
        expect(messageCacheParse({ v: 1, lastSeq: 0, oldestSeq: null, hasMoreOlder: false, messages: [] })).toMatchObject({ settledSeq: 0, lastSeq: 0 });
    });
});

describe('the settled cursor', () => {
    const T = 1_000_000;

    it('waits for N when N+1 arrives first, and ends with both held', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 10), false, T);
        expect(held.settledSeq).toBe(10);
        // The live message 12 is readable before 11 is.
        const early = messageCacheApplyForward(held, 10, [msg(12)], T);
        expect(early).toMatchObject({ lastSeq: 12, settledSeq: 10, holes: { 11: T } });
        expectInvariant(early);
        // The forward fetch starts from the settled cursor and brings 11 (and 12 again).
        const filled = messageCacheApplyForward(early, early!.settledSeq, [msg(11), msg(12)], T + 50);
        expect(filled).toMatchObject({ lastSeq: 12, settledSeq: 12, holes: {} });
        expect(seqs(filled)).toEqual(range(1, 12).map((message) => message.seq));
        expectInvariant(filled);
    });

    it('does not keep a hole from showing the messages after it', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 10), false, T);
        const later = messageCacheApplyForward(held, 10, [msg(12), msg(13), msg(14)], T);
        expect(seqs(later)).toContain(14);
        expect(later).toMatchObject({ lastSeq: 14, settledSeq: 10 });
        expect(messageCacheLatestPage(later!, 100).messages.map((message) => message.seq)).toContain(14);
    });

    it('settles over a hole that stays empty for the grace, and not before', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 10), false, T);
        const early = messageCacheApplyForward(held, 10, [msg(12), msg(13)], T)!;
        // The server never uses 11 (a duplicate's number). Still waiting just before the grace ends...
        expect(messageCacheApplyForward(early, 10, [msg(12), msg(13), msg(14)], T + HOLE_GRACE_MS - 1)).toMatchObject({ settledSeq: 10, holes: { 11: T } });
        // ...and settled over once it has.
        const settled = messageCacheSettle(early, T + HOLE_GRACE_MS);
        expect(settled).toMatchObject({ settledSeq: 13, holes: {} });
        expectInvariant(settled);
    });

    it('stops at the first hole still inside the grace', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 10), false, T);
        const first = messageCacheApplyForward(held, 10, [msg(12)], T)!;
        const second = messageCacheApplyForward(first, 12, [msg(14)], T + HOLE_GRACE_MS / 2)!;
        expect(second).toMatchObject({ settledSeq: 10, holes: { 11: T, 13: T + HOLE_GRACE_MS / 2 } });
        const partly = messageCacheSettle(second, T + HOLE_GRACE_MS);
        expect(partly).toMatchObject({ settledSeq: 12, holes: { 13: T + HOLE_GRACE_MS / 2 } });
        expectInvariant(partly);
    });

    it('waits for a hole inside the newest page, and for a first message a whole-history page lacks', () => {
        const withHole = messageCacheApplyLatest(undefined, [msg(1), msg(2), msg(4)], false, T);
        expect(withHole).toMatchObject({ settledSeq: 2, holes: { 3: T } });
        const noFirst = messageCacheApplyLatest(undefined, [msg(2), msg(3)], false, T);
        expect(noFirst).toMatchObject({ oldestSeq: 2, settledSeq: 0, holes: { 1: T } });
        // Message 1 arrives through the forward fetch from 0 and joins below the old edge.
        const filled = messageCacheApplyForward(noFirst, 0, range(1, 3), T + 10);
        expect(filled).toMatchObject({ oldestSeq: 1, settledSeq: 3, holes: {}, hasMoreOlder: false });
        expectInvariant(filled);
    });

    it('starts a fresh run settled from the forward cursor, waiting for what is missing above it', () => {
        const run = messageCacheApplyForward(undefined, 0, [msg(2)], T);
        expect(run).toMatchObject({ oldestSeq: 2, lastSeq: 2, settledSeq: 0, holes: { 1: T }, hasMoreOlder: false });
        expectInvariant(run);
        const filled = messageCacheApplyForward(run, 0, [msg(1), msg(2)], T + 10);
        expect(filled).toMatchObject({ oldestSeq: 1, settledSeq: 2, holes: {} });
    });

    it('keeps the rule when the cap trims the oldest end', () => {
        const held = messageCacheApplyLatest(undefined, range(1, 30), false, T);
        const gappy = messageCacheApplyForward(held, 30, [msg(32), msg(33)], T)!;
        const capped = messageCacheCap(gappy, { maxMessages: 10, maxChars: Number.POSITIVE_INFINITY }, T + 1);
        expect(capped).toMatchObject({ oldestSeq: 23, lastSeq: 33, settledSeq: 30, holes: { 31: T }, hasMoreOlder: true });
        expectInvariant(capped);
        // A cap that cuts above a waiting hole leaves the cursor at the new run's edge.
        const deep = messageCacheApplyForward(undefined, 0, [msg(2), ...range(4, 20)], T)!;
        expect(deep).toMatchObject({ settledSeq: 0, holes: { 1: T, 3: T } });
        const cut = messageCacheCap(deep, { maxMessages: 5, maxChars: Number.POSITIVE_INFINITY }, T + 1);
        expect(cut).toMatchObject({ oldestSeq: 16, settledSeq: 20, holes: {} });
        expectInvariant(cut);
    });

    it('older pages do not reopen settled history', () => {
        const held = messageCacheApplyLatest(undefined, range(101, 200), true, T);
        const older = messageCacheApplyOlder(held, 101, [...range(1, 49), ...range(51, 100)], false, T);
        expect(older).toMatchObject({ oldestSeq: 1, settledSeq: 200, holes: {} });
        expectInvariant(older);
    });
});

describe('Sync\'s seq tracker', () => {
    const T = 5_000_000;

    it('never moves past a hole, and moves over it once it is filled', () => {
        let tracker = seqTrackerStart(10);
        tracker = seqTrackerRecord(tracker, [12], T);
        expect(tracker).toMatchObject({ settledSeq: 10, lastSeq: 12, holes: { 11: T } });
        tracker = seqTrackerRecord(tracker, [13], T + 1);
        expect(tracker.settledSeq).toBe(10);
        tracker = seqTrackerRecord(tracker, [11, 12, 13], T + 2);
        expect(tracker).toMatchObject({ settledSeq: 13, lastSeq: 13, holes: {} });
        expect(tracker.heldAbove.size).toBe(0);
    });

    it('settles a permanent hole after the grace, on an empty batch too', () => {
        let tracker = seqTrackerRecord(seqTrackerStart(0), [2, 3], T);
        expect(tracker.settledSeq).toBe(0);
        tracker = seqTrackerRecord(tracker, [], T + HOLE_GRACE_MS);
        expect(tracker).toMatchObject({ settledSeq: 3, holes: {} });
    });

    it('seeds from a cached log with its holes aged', () => {
        const entry = messageCacheApplyForward(messageCacheApplyLatest(undefined, range(1, 5), false, T), 5, [msg(7)], T)!;
        expect(seqTrackerOfCache(entry, T + 1)).toMatchObject({ settledSeq: 5, lastSeq: 7, holes: { 6: T } });
        expect(seqTrackerOfCache(entry, T + HOLE_GRACE_MS)).toMatchObject({ settledSeq: 7, holes: {} });
    });
});

describe('cached pages', () => {
    const entry = messageCacheApplyLatest(undefined, range(1, 250), true);

    it('shows the newest page first and knows more is held', () => {
        const page = messageCacheLatestPage(entry, 100);
        expect(page.oldestSeq).toBe(151);
        expect(page.messages).toHaveLength(100);
        expect(page.hasMore).toBe(true);
    });

    it('serves older pages from the cache down to its oldest message', () => {
        const second = messageCacheOlderPage(entry, 151, 100)!;
        expect(second.oldestSeq).toBe(51);
        const third = messageCacheOlderPage(entry, 51, 100)!;
        expect(third.messages).toHaveLength(50);
        expect(third.oldestSeq).toBe(1);
        // The server said there is history before seq 1's run: keep paging there.
        expect(third.hasMore).toBe(true);
        expect(messageCacheOlderPage(entry, 1, 100)).toBeUndefined();
    });

    it('sends a cursor outside the cached run to the server', () => {
        expect(messageCacheOlderPage(entry, 400, 100)).toBeUndefined();
        expect(messageCacheOlderPage(undefined, 10, 100)).toBeUndefined();
    });

    it('does not seed from a log that lost its messages', () => {
        expect(messageCacheSeedable({ ...entry, messages: [] })).toBe(false);
    });
});
