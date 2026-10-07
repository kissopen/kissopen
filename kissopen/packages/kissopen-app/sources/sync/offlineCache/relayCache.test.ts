import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiMessage } from '../apiTypes';

// The native stores, as plain maps: MMKV for the lists, a file tree for the logs.
const fake = vi.hoisted(() => ({ kv: new Map<string, string>(), files: new Map<string, string>() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('react-native-mmkv', () => ({
    MMKV: class {
        getString(key: string) { return fake.kv.get(key); }
        set(key: string, value: string) { fake.kv.set(key, value); }
        delete(key: string) { fake.kv.delete(key); }
        clearAll() { fake.kv.clear(); }
    },
}));
vi.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///docs/',
    makeDirectoryAsync: async () => {},
    readAsStringAsync: async (path: string) => {
        const text = fake.files.get(path);
        if (text === undefined) throw new Error('ENOENT');
        return text;
    },
    writeAsStringAsync: async (path: string, text: string) => { fake.files.set(path, text); },
    deleteAsync: async (path: string) => {
        for (const key of [...fake.files.keys()]) if (key === path || key.startsWith(path)) fake.files.delete(key);
    },
    readDirectoryAsync: async (dir: string) => [...fake.files.keys()].filter((key) => key.startsWith(dir)).map((key) => key.slice(dir.length)),
}));

const { relayCache, relayCacheClear } = await import('./relayCache');

function msg(seq: number): ApiMessage {
    return { id: `m${seq}`, seq, localId: null, content: { t: 'encrypted', c: `cipher-${seq}` }, createdAt: seq, updatedAt: seq };
}

beforeEach(async () => {
    await relayCacheClear();
    fake.kv.clear();
    fake.files.clear();
});

describe('relayCache lists', () => {
    it('reads nothing and writes nothing before an account is open', () => {
        relayCache.listWrite('sessions', [{ id: 'a' }]);
        expect(relayCache.listRead('sessions')).toBeUndefined();
        expect(fake.kv.size).toBe(0);
    });

    it('keeps each account\'s lists apart', () => {
        relayCache.open('account-1');
        relayCache.listWrite('sessions', [{ id: 'one' }]);
        relayCache.open('account-2');
        expect(relayCache.listRead('sessions')).toBeUndefined();
        relayCache.listWrite('sessions', [{ id: 'two' }]);
        relayCache.open('account-1');
        expect(relayCache.listRead('sessions')).toEqual([{ id: 'one' }]);
    });

    it('remembers and forgets project files per machine and folder', () => {
        relayCache.open('account-1');
        relayCache.projectFileWrite('machine', '/work', '.kissopen/board.json', '{"v":1}');
        expect(relayCache.projectFileRead('machine', '/work', '.kissopen/board.json')).toBe('{"v":1}');
        expect(relayCache.projectFileRead('machine', '/other', '.kissopen/board.json')).toBeUndefined();
        relayCache.projectFileWrite('machine', '/work', '.kissopen/board.json', null);
        expect(relayCache.projectFileRead('machine', '/work', '.kissopen/board.json')).toBeUndefined();
    });
});

describe('relayCache messages', () => {
    it('writes the encrypted records to the account\'s folder and reads them back', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('s1', [msg(1), msg(2)], false);
        await relayCache.messagesRecordForward('s1', 2, [msg(3)]);
        await relayCache.flush();
        const text = fake.files.get('file:///docs/relay-cache/account-1/messages/s1.json');
        expect(text).toContain('cipher-3');
        expect(JSON.parse(text!)).toMatchObject({ lastSeq: 3, oldestSeq: 1 });

        // A new run (memory forgotten) reads it from disk.
        relayCache.open(null);
        relayCache.open('account-1');
        const entry = await relayCache.messagesLoad('s1');
        expect(entry?.messages.map((message) => message.seq)).toEqual([1, 2, 3]);
    });

    it('does not show one account the other\'s logs', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('s1', [msg(1)], false);
        await relayCache.flush();
        relayCache.open('account-2');
        expect(await relayCache.messagesLoad('s1')).toBeUndefined();
    });

    it('deletes a session\'s log and ignores pages still arriving for it', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('s1', [msg(1)], false);
        await relayCache.flush();
        await relayCache.messagesDelete('s1');
        await relayCache.messagesRecordForward('s1', 1, [msg(2)]);
        await relayCache.flush();
        expect(fake.files.size).toBe(0);
        expect(await relayCache.messagesLoad('s1')).toBeUndefined();
    });

    it('keeps only the sessions the server still lists', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('keep', [msg(1)], false);
        await relayCache.messagesRecordLatest('drop', [msg(1)], false);
        await relayCache.flush();
        // A new run: nothing is held in memory, so only `keep` decides.
        relayCache.open(null);
        relayCache.open('account-1');
        await relayCache.messagesRetain(['keep']);
        expect([...fake.files.keys()]).toEqual(['file:///docs/relay-cache/account-1/messages/keep.json']);
    });

    it('keeps a log used this run even when the list does not name it', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('live', [msg(1)], false);
        await relayCache.flush();
        await relayCache.messagesRetain(() => []);
        expect([...fake.files.keys()]).toEqual(['file:///docs/relay-cache/account-1/messages/live.json']);
    });

    it('carries the settled cursor and its holes through disk', async () => {
        relayCache.open('account-1');
        await relayCache.messagesRecordLatest('s1', [msg(1), msg(2)], false);
        await relayCache.messagesRecordForward('s1', 2, [msg(4)]);
        await relayCache.flush();
        relayCache.open(null);
        relayCache.open('account-1');
        const entry = await relayCache.messagesLoad('s1');
        expect(entry).toMatchObject({ lastSeq: 4, settledSeq: 2 });
        expect(Object.keys(entry!.holes)).toEqual(['3']);
    });

    it('forgets everything on sign-out', async () => {
        relayCache.open('account-1');
        relayCache.listWrite('machines', [{ id: 'm' }]);
        await relayCache.messagesRecordLatest('s1', [msg(1)], false);
        await relayCache.flush();
        await relayCacheClear();
        expect(fake.kv.size).toBe(0);
        expect(fake.files.size).toBe(0);
        expect(relayCache.isOpen()).toBe(false);
    });
});
