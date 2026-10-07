import { AppState, Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { deleteAsync, documentDirectory, makeDirectoryAsync, readAsStringAsync, readDirectoryAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { AsyncLock } from '@/utils/lock';
import type { ApiMessage } from '../apiTypes';
import { cacheFileName, projectFileCacheKey } from './cacheKeys';
import {
    messageCacheApplyForward,
    messageCacheApplyLatest,
    messageCacheApplyOlder,
    messageCacheCap,
    messageCacheParse,
    type CachedSessionMessages,
} from './messageCache';

/*
 * The relay account's on-device cache.
 *
 * Two stores, both scoped to the account key Sync opens with:
 *
 * - A named MMKV instance for small documents read synchronously at start:
 *   the raw session list, machines and project records exactly as the server
 *   sent them (metadata still encrypted), and the last text of each project's
 *   board.json / project.json. Keys are `<account>:<name>`.
 *
 * - One JSON file per session under the document directory for the message
 *   log, which is too large for MMKV:
 *   `relay-cache/<account>/messages/<sessionId>.json`. Each file holds the
 *   encrypted `ApiMessage` records and their cursors — the newest seq held,
 *   the settled forward cursor and the holes still waited for (see
 *   messageCache.ts); the whole entry is written and read back as one.
 *
 * Nothing readable is written: messages and metadata stay in the envelope
 * the server keeps them in, and no credential is stored. Web has no document
 * directory, so there the message log is simply not cached.
 *
 * Every write is off the hot path: message files are written after a short
 * quiet period (and when the app leaves the foreground), and a failure to
 * write only means the next start shows less.
 */

const kv = new MMKV({ id: 'relay-cache' });
const ROOT = documentDirectory ? `${documentDirectory}relay-cache/` : null;
const WRITE_DELAY_MS = 1000;
/** Parsed logs kept in memory, newest use last. Written ones can be dropped. */
const MEMORY_ENTRIES = 12;

export type RelayListName = 'sessions' | 'machines' | 'projects';

let account: string | null = null;
/** Bumped by every open/clear, so work begun for one account cannot land in another. */
let generation = 0;
const entries = new Map<string, CachedSessionMessages>();
const dirty = new Map<string, CachedSessionMessages>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const locks = new Map<string, AsyncLock>();
/** Sessions deleted since the account opened; nothing more is cached for them. */
const deleted = new Set<string>();
let directoryReady: Promise<boolean> | null = null;
/** Whether this account's folder has been tidied this run (see messagesRetain). */
let retained = false;

function messagesDir(key: string): string | null {
    return ROOT ? `${ROOT}${key}/messages/` : null;
}

function messagesPath(key: string, sessionId: string): string | null {
    const dir = messagesDir(key);
    return dir ? `${dir}${cacheFileName(sessionId)}.json` : null;
}

function lockFor(sessionId: string): AsyncLock {
    let lock = locks.get(sessionId);
    if (!lock) {
        lock = new AsyncLock();
        locks.set(sessionId, lock);
    }
    return lock;
}

function remember(sessionId: string, entry: CachedSessionMessages) {
    entries.delete(sessionId);
    entries.set(sessionId, entry);
    while (entries.size > MEMORY_ENTRIES) {
        const oldest = entries.keys().next().value as string;
        entries.delete(oldest);
    }
}

function forgetMemory() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    dirty.clear();
    entries.clear();
    locks.clear();
    deleted.clear();
    directoryReady = null;
    retained = false;
}

async function ensureDirectory(key: string): Promise<boolean> {
    const dir = messagesDir(key);
    if (!dir) return false;
    directoryReady ??= makeDirectoryAsync(dir, { intermediates: true }).then(() => true, (error) => {
        console.warn('relayCache: cannot create the message cache folder', error);
        directoryReady = null;
        return false;
    });
    return directoryReady;
}

/** Writes one log file, under the session's lock so a delete cannot be overtaken. */
function writeEntry(key: string, gen: number, sessionId: string, entry: CachedSessionMessages): Promise<void> {
    const path = messagesPath(key, sessionId);
    if (!path) return Promise.resolve();
    return lockFor(sessionId).inLock(async () => {
        if (!(await ensureDirectory(key)) || gen !== generation || deleted.has(sessionId)) return;
        await writeAsStringAsync(path, JSON.stringify(entry));
    }).catch((error) => {
        console.warn(`relayCache: cannot write the message cache for ${sessionId}`, error);
    });
}

function scheduleWrite(sessionId: string, entry: CachedSessionMessages) {
    const key = account;
    if (!key || !ROOT) return;
    dirty.set(sessionId, entry);
    if (timers.has(sessionId)) return;
    const gen = generation;
    timers.set(sessionId, setTimeout(() => {
        timers.delete(sessionId);
        const pending = dirty.get(sessionId);
        dirty.delete(sessionId);
        if (pending && gen === generation) void writeEntry(key, gen, sessionId, pending);
    }, WRITE_DELAY_MS));
}

/** Writes every pending message log now, e.g. before the app is suspended. */
async function flush(): Promise<void> {
    const key = account;
    const gen = generation;
    const pending = [...dirty.entries()];
    for (const sessionId of timers.keys()) clearTimeout(timers.get(sessionId));
    timers.clear();
    dirty.clear();
    if (!key) return;
    await Promise.all(pending.map(([sessionId, entry]) => writeEntry(key, gen, sessionId, entry)));
}

AppState.addEventListener?.('change', (state) => {
    if (state !== 'active') void flush();
});

/** The held log: pending write, memory, then disk. Caller holds the session lock. */
async function current(sessionId: string): Promise<CachedSessionMessages | undefined> {
    const held = dirty.get(sessionId) ?? entries.get(sessionId);
    if (held) return held;
    const key = account;
    const path = key ? messagesPath(key, sessionId) : null;
    if (!key || !path) return undefined;
    const gen = generation;
    let parsed: CachedSessionMessages | null = null;
    try {
        parsed = messageCacheParse(JSON.parse(await readAsStringAsync(path)));
    } catch {
        // No file yet, or one cut short: no cache.
    }
    if (!parsed || gen !== generation) return undefined;
    remember(sessionId, parsed);
    return parsed;
}

/** Runs one change to a session's log under its lock and schedules the write. */
function update(sessionId: string, change: (entry: CachedSessionMessages | undefined) => CachedSessionMessages | undefined): Promise<void> {
    if (!account || !ROOT || deleted.has(sessionId)) return Promise.resolve();
    const gen = generation;
    return lockFor(sessionId).inLock(async () => {
        const before = await current(sessionId);
        if (gen !== generation || deleted.has(sessionId)) return;
        const after = change(before);
        if (!after || after === before) return;
        const capped = messageCacheCap(after);
        remember(sessionId, capped);
        scheduleWrite(sessionId, capped);
    }).catch((error) => {
        console.warn(`relayCache: cannot update the message cache for ${sessionId}`, error);
    });
}

function kvKey(name: string): string | null {
    return account ? `${account}:${name}` : null;
}

function kvRead<T>(name: string): T | undefined {
    const key = kvKey(name);
    if (!key) return undefined;
    try {
        const raw = kv.getString(key);
        return raw === undefined ? undefined : JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function kvWrite(name: string, value: unknown) {
    const key = kvKey(name);
    if (!key) return;
    try {
        if (value === undefined) kv.delete(key);
        else kv.set(key, JSON.stringify(value));
    } catch (error) {
        // Web's storage can be full; the cache is only ever a head start.
        console.warn(`relayCache: cannot store ${name}`, error);
    }
}

export const relayCache = {
    /**
     * Which account the cache serves; null closes it. Called by Sync as soon
     * as it knows the account, before anything is read.
     */
    open(accountKey: string | null) {
        if (accountKey === account) return;
        generation++;
        forgetMemory();
        account = accountKey;
    },

    /** Whether an account is open: nothing is read or written otherwise. */
    isOpen(): boolean {
        return account !== null;
    },

    /** A raw list response as last stored, or undefined. */
    listRead<T>(name: RelayListName): T | undefined {
        return kvRead<T>(`list:${name}`);
    },

    listWrite(name: RelayListName, value: unknown) {
        kvWrite(`list:${name}`, value);
    },

    /** The last text read of one project file, e.g. `.kissopen/board.json`. */
    projectFileRead(machineId: string, projectPath: string, file: string): string | undefined {
        const value = kvRead<unknown>(projectFileCacheKey(machineId, projectPath, file));
        return typeof value === 'string' ? value : undefined;
    },

    /** Remembers a file's text; null forgets it (the computer said it is gone). */
    projectFileWrite(machineId: string, projectPath: string, file: string, text: string | null) {
        kvWrite(projectFileCacheKey(machineId, projectPath, file), text === null ? undefined : text);
    },

    /** A session's cached log, or undefined when there is none. */
    messagesLoad(sessionId: string): Promise<CachedSessionMessages | undefined> {
        if (!account || !ROOT) return Promise.resolve(undefined);
        return lockFor(sessionId).inLock(() => current(sessionId)).catch(() => undefined);
    },

    /** The newest page, fetched without a cursor. */
    messagesRecordLatest(sessionId: string, page: readonly ApiMessage[], hasMore: boolean): Promise<void> {
        return update(sessionId, (entry) => messageCacheApplyLatest(entry, page, hasMore));
    },

    /** Messages after `afterSeq`: a forward page or one live socket message. */
    messagesRecordForward(sessionId: string, afterSeq: number, page: readonly ApiMessage[]): Promise<void> {
        return update(sessionId, (entry) => messageCacheApplyForward(entry, afterSeq, page));
    },

    /** Messages before `beforeSeq`, from paging back through history. */
    messagesRecordOlder(sessionId: string, beforeSeq: number, page: readonly ApiMessage[], hasMore: boolean): Promise<void> {
        return update(sessionId, (entry) => messageCacheApplyOlder(entry, beforeSeq, page, hasMore));
    },

    /**
     * Forgets a deleted session's log, in memory and on disk. Under the
     * session's lock, after any change already under way, and for good: a
     * page still in flight for the session is not written back.
     */
    messagesDelete(sessionId: string): Promise<void> {
        const key = account;
        const path = key ? messagesPath(key, sessionId) : null;
        if (!key) return Promise.resolve();
        deleted.add(sessionId);
        return lockFor(sessionId).inLock(async () => {
            const timer = timers.get(sessionId);
            if (timer) clearTimeout(timer);
            timers.delete(sessionId);
            dirty.delete(sessionId);
            entries.delete(sessionId);
            if (path) await deleteAsync(path, { idempotent: true });
        }).catch(() => undefined);
    },

    /**
     * Deletes the logs of sessions the phone no longer knows — deleted
     * elsewhere, or long out of use — so the folder does not grow for ever.
     * Once per run. `keep` names the sessions whose logs stay: the caller
     * decides (the server's list only covers the newest sessions, so it is
     * not the whole answer). It is asked after the folder is read, so a
     * session that arrived meanwhile is kept, and so is any log written or
     * read this run.
     */
    async messagesRetain(keep: readonly string[] | (() => Iterable<string>)): Promise<void> {
        const key = account;
        const dir = key ? messagesDir(key) : null;
        if (!key || !dir || retained) return;
        retained = true;
        const gen = generation;
        let names: string[];
        try {
            names = await readDirectoryAsync(dir);
        } catch {
            return; // No folder yet: nothing to tidy.
        }
        if (gen !== generation) return;
        const kept = new Set<string>();
        for (const id of typeof keep === 'function' ? keep() : keep) kept.add(`${cacheFileName(id)}.json`);
        for (const id of [...entries.keys(), ...dirty.keys()]) kept.add(`${cacheFileName(id)}.json`);
        for (const name of names) {
            if (kept.has(name) || gen !== generation) continue;
            await deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => undefined);
        }
    },

    flush,
};

/**
 * Forgets every account's relay cache: the MMKV instance and the whole
 * message folder. Part of signing out, next to clearPersistence().
 */
export async function relayCacheClear(): Promise<void> {
    generation++;
    forgetMemory();
    account = null;
    try {
        kv.clearAll();
    } catch (error) {
        console.warn('relayCache: cannot clear the list cache', error);
    }
    if (ROOT && Platform.OS !== 'web') {
        await deleteAsync(ROOT, { idempotent: true }).catch((error) => {
            console.warn('relayCache: cannot delete the message cache', error);
        });
    }
}
