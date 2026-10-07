/*
What this desktop keeps of the account's other machines, on its own disk.

The relay is still the copy that matters. This is the one that is here when the
relay, or the machine a conversation runs on, is not: a cloud workspace being
recreated, a laptop on a train, a relay that is slow to answer at start. Without
it every one of those showed an empty conversation, an empty list or a project
without a board, although all of it had been on this screen a minute before.

Three things are kept, one folder per account:

- the lists the relay last gave (machines, projects, conversations), as it gave
  them — still encrypted, read with the same keys as a live answer;
- each conversation's messages, as the relay stores them — still encrypted, so
  nothing written here is more readable than the relay's own copy;
- small files read from a project there, above all `.kissopen/board.json` and
  `.kissopen/project.json`, which exist only on that machine.

Nothing here decides what is shown. The reader asks the relay first and falls
back to this; a copy that is wrong is replaced by the next answer.
*/
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** One message as the relay stores it: the content is still ciphertext. */
export interface RelayCachedMessage {
    readonly id: string;
    readonly seq: number;
    readonly localId: string | null;
    readonly content: { readonly t: string; readonly c: string };
    readonly createdAt: number;
    readonly updatedAt: number;
}

/*
A conversation's copy, and how far it is known to be complete.

The relay numbers a conversation's messages 1, 2, 3…, but a number can become
visible before the one below it — the relay takes the number first and writes
the message after, outside any transaction — and a number taken for a message
that turned out to be a repeat is never used at all. So "the newest message
here" is not "everything up to it is here". `settledSeq` is: every number up to
it is either held or was looked for again, long enough after it was first
missed, and still not there. Numbers above it that are missing are `holes`,
each with when it was first missed, and every read asks the relay for them
again until they arrive or settle.
*/
export interface RelayCachedConversation {
    readonly messages: readonly RelayCachedMessage[];
    readonly settledSeq: number;
    /** Missing numbers above `settledSeq`, by number, with when each was first missed. */
    readonly holes: Readonly<Record<string, number>>;
}

/*
How long a missing number is looked for before it is taken as never used. A
message written out of order lands within milliseconds; two minutes is far past
that, and a number is only settled by a read made after this long, never by the
clock alone — a desktop asleep for a day has not looked.
*/
export const RELAY_HOLE_GRACE_MS = 120_000;

/**
 * Works out how far a conversation's copy is complete after a read.
 *
 * `checked` is the numbers this read asked the relay for again; only those may
 * settle, and only when they were first missed at least the grace period ago.
 */
export function relayCachedSettle(
    messages: readonly RelayCachedMessage[],
    previous: { readonly settledSeq: number; readonly holes: Readonly<Record<string, number>> },
    checked: ReadonlySet<number>,
    now: number,
): { settledSeq: number; holes: Record<string, number> } {
    const held = new Set(messages.map((message) => message.seq));
    const newest = messages.at(-1)?.seq ?? previous.settledSeq;
    // Numbers below what is kept are out of reach; the copy starts at its oldest.
    let settledSeq = Math.max(previous.settledSeq, (messages[0]?.seq ?? 1) - 1);
    const holes: Record<string, number> = {};
    let blocked = false;
    for (let seq = settledSeq + 1; seq <= newest; seq += 1) {
        if (held.has(seq)) {
            if (!blocked) settledSeq = seq;
            continue;
        }
        const missedAt = previous.holes[seq] ?? now;
        if (!blocked && checked.has(seq) && now - missedAt >= RELAY_HOLE_GRACE_MS) {
            settledSeq = seq;
            continue;
        }
        holes[seq] = missedAt;
        blocked = true;
    }
    return { settledSeq, holes };
}

/** The missing numbers as runs to ask for, lowest first, at most `limit` of them. */
export function relayCachedHoleRuns(
    holes: Readonly<Record<string, number>>,
    limit: number,
): { from: number; to: number }[] {
    const seqs = Object.keys(holes)
        .map(Number)
        .filter(Number.isInteger)
        .sort((a, b) => a - b);
    const runs: { from: number; to: number }[] = [];
    for (const seq of seqs) {
        const last = runs.at(-1);
        if (last && seq === last.to + 1) last.to = seq;
        else if (runs.length < limit) runs.push({ from: seq, to: seq });
        else break;
    }
    return runs;
}

/** The relay's three list answers, exactly as they came. */
export interface RelayCachedLists {
    readonly machines: unknown;
    readonly projects: unknown;
    readonly sessions: unknown;
    readonly savedAt: number;
}

/*
How much of one conversation is kept. Enough for a long working thread; a
conversation longer than this keeps its newest part, which is the part read.
*/
export const RELAY_CACHE_MAX_MESSAGES = 5000;
/** The largest file kept: a board or a note, not a deck. */
export const RELAY_CACHE_MAX_FILE_BYTES = 2 * 1024 * 1024;
/** All kept files together; the least recently written go first. */
const RELAY_CACHE_MAX_FILES_BYTES = 128 * 1024 * 1024;

function hash(...parts: readonly string[]): string {
    return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function isCachedMessage(value: unknown): value is RelayCachedMessage {
    const message = value as Partial<RelayCachedMessage> | null;
    return (
        typeof message?.id === "string" &&
        typeof message.seq === "number" &&
        typeof message.createdAt === "number" &&
        typeof message.content?.c === "string"
    );
}

/**
 * Two runs of the same conversation as one, in the order the relay numbered
 * them. A message both have is the later copy; only the newest are kept.
 */
export function relayCachedMessagesMerge(
    held: readonly RelayCachedMessage[],
    fresh: readonly RelayCachedMessage[],
): RelayCachedMessage[] {
    const byId = new Map<string, RelayCachedMessage>();
    for (const message of held) byId.set(message.id, message);
    for (const message of fresh) byId.set(message.id, message);
    const ordered = [...byId.values()].sort((a, b) => a.seq - b.seq);
    return ordered.length > RELAY_CACHE_MAX_MESSAGES
        ? ordered.slice(ordered.length - RELAY_CACHE_MAX_MESSAGES)
        : ordered;
}

export class RelayCache {
    readonly #dir: string;
    /** The write in flight for each file, so two never interleave and a read waits for it. */
    readonly #writes = new Map<string, Promise<void>>();
    #pruned = false;
    /** Cleared for a sign-out: nothing more is written, however late it arrives. */
    #closed = false;

    /*
    One folder per account and relay, named by a hash of both: a person who
    signs in as somebody else on this computer does not read the first
    person's copy, and the folder name says nothing about either.
    */
    constructor(root: string, serverUrl: string, userId: string) {
        this.#dir = join(root, hash(serverUrl, userId).slice(0, 24));
    }

    async #read(path: string): Promise<Buffer | undefined> {
        await this.#writes.get(path);
        try {
            return await readFile(path);
        } catch {
            return undefined;
        }
    }

    async #readJson<T>(path: string): Promise<T | undefined> {
        const bytes = await this.#read(path);
        if (!bytes) return undefined;
        try {
            return JSON.parse(bytes.toString("utf8")) as T;
        } catch {
            return undefined;
        }
    }

    /*
    Written whole and renamed into place, so a desktop that quits halfway leaves
    the previous copy rather than half of a new one. A failed write is only
    reported: the copy here is a convenience, and losing it loses nothing the
    relay does not have.
    */
    #write(path: string, data: string | Uint8Array | undefined): Promise<void> {
        if (this.#closed) return Promise.resolve();
        const previous = this.#writes.get(path) ?? Promise.resolve();
        const next = previous
            .then(async () => {
                if (data === undefined) {
                    await rm(path, { force: true });
                    return;
                }
                await mkdir(dirname(path), { recursive: true });
                const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
                await writeFile(temporary, data);
                await rename(temporary, path);
            })
            .catch((error: unknown) => console.warn("[relay-cache] A write failed", error));
        this.#writes.set(path, next);
        void next.finally(() => {
            if (this.#writes.get(path) === next) this.#writes.delete(path);
        });
        return next;
    }

    /**
     * Removes this account's whole copy, for a person signing out. Writes
     * already under way finish first, so none of them lands after the folder
     * is gone and brings part of it back.
     */
    async clear(): Promise<void> {
        this.#closed = true;
        await Promise.all([...this.#writes.values()]);
        await rm(this.#dir, { recursive: true, force: true });
    }

    #listsPath(): string {
        return join(this.#dir, "lists.json");
    }

    #messagesPath(sessionId: string): string {
        return join(this.#dir, "messages", `${hash(sessionId).slice(0, 32)}.json`);
    }

    #filePath(machineId: string, place: string, path: string): string {
        return join(this.#dir, "files", hash(machineId, place, path).slice(0, 40));
    }

    async lists(): Promise<RelayCachedLists | undefined> {
        const lists = await this.#readJson<RelayCachedLists>(this.#listsPath());
        return lists && typeof lists === "object" && "sessions" in lists ? lists : undefined;
    }

    listsSave(lists: Omit<RelayCachedLists, "savedAt">): Promise<void> {
        return this.#write(this.#listsPath(), JSON.stringify({ ...lists, savedAt: Date.now() }));
    }

    /**
     * One conversation's copy; undefined when none is kept. A copy written
     * before gaps were tracked says nothing about them, so all of it is looked
     * over again: it starts settled only below its oldest message.
     */
    async messages(sessionId: string): Promise<RelayCachedConversation | undefined> {
        const kept = await this.#readJson<{
            version?: unknown;
            messages?: unknown;
            settledSeq?: unknown;
            holes?: unknown;
        }>(this.#messagesPath(sessionId));
        if (!Array.isArray(kept?.messages)) return undefined;
        const messages = relayCachedMessagesMerge([], kept.messages.filter(isCachedMessage));
        const oldest = messages[0]?.seq ?? 1;
        if (kept.version !== 2 || typeof kept.settledSeq !== "number")
            return { messages, settledSeq: oldest - 1, holes: {} };
        const holes: Record<string, number> = {};
        if (kept.holes && typeof kept.holes === "object")
            for (const [seq, at] of Object.entries(kept.holes as Record<string, unknown>))
                if (typeof at === "number") holes[seq] = at;
        return { messages, settledSeq: kept.settledSeq, holes };
    }

    messagesSave(sessionId: string, conversation: RelayCachedConversation): Promise<void> {
        return this.#write(
            this.#messagesPath(sessionId),
            JSON.stringify({ version: 2, ...conversation }),
        );
    }

    messagesDrop(sessionId: string): Promise<void> {
        return this.#write(this.#messagesPath(sessionId), undefined);
    }

    /**
     * A file last read from a project on another machine, by that machine,
     * the folder its conversation works in, and the path as it was asked for.
     */
    async file(machineId: string, place: string, path: string): Promise<Uint8Array | undefined> {
        const bytes = await this.#read(this.#filePath(machineId, place, path));
        return bytes ? new Uint8Array(bytes) : undefined;
    }

    async fileSave(
        machineId: string,
        place: string,
        path: string,
        bytes: Uint8Array,
    ): Promise<void> {
        if (bytes.byteLength > RELAY_CACHE_MAX_FILE_BYTES) return;
        await this.#write(this.#filePath(machineId, place, path), bytes);
        if (!this.#pruned) {
            this.#pruned = true;
            await this.#filesPrune().catch(() => undefined);
        }
    }

    fileDrop(machineId: string, place: string, path: string): Promise<void> {
        return this.#write(this.#filePath(machineId, place, path), undefined);
    }

    /** Keeps the kept files under their limit, once a run. */
    async #filesPrune(): Promise<void> {
        const folder = join(this.#dir, "files");
        const names = await readdir(folder).catch(() => [] as string[]);
        const files = [];
        for (const name of names) {
            const info = await stat(join(folder, name)).catch(() => undefined);
            if (info?.isFile()) files.push({ name, size: info.size, at: info.mtimeMs });
        }
        let total = files.reduce((sum, file) => sum + file.size, 0);
        for (const file of files.sort((a, b) => a.at - b.at)) {
            if (total <= RELAY_CACHE_MAX_FILES_BYTES) break;
            await rm(join(folder, file.name), { force: true });
            total -= file.size;
        }
    }
}
