import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messagePlanMode } from './messagePlanMode';
import { messageCacheApplyForward, messageCacheApplyLatest, seqTrackerRecord, seqTrackerStart, type CachedSessionMessages } from './offlineCache/messageCache';

const mocks = vi.hoisted(() => ({
    state: { sessions: {}, sessionMessages: {}, currentViewingSessionId: null } as any,
    request: vi.fn(),
    applyMessages: vi.fn(),
    applyMessagesLoaded: vi.fn(),
    applyOlderMessagesPagination: vi.fn(),
    setModes: vi.fn(),
    gitInvalidate: vi.fn(),
    voiceFocus: vi.fn(),
    voiceMessages: vi.fn(),
    voiceReady: vi.fn(),
    loadAvatar: vi.fn(async () => null),
    cache: {
        listRead: vi.fn(),
        listWrite: vi.fn(),
        messagesLoad: vi.fn(),
        messagesRecordLatest: vi.fn(),
        messagesRecordForward: vi.fn(),
        messagesRecordOlder: vi.fn(),
        messagesDelete: vi.fn(),
    },
}));

// Exercise the real Sync orchestration, locking and pagination with only the
// native services/network/store boundary replaced. No Expo runtime or sockets.
vi.mock('expo-constants', () => ({ default: {} }));
vi.mock('expo-device', () => ({}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
vi.mock('expo-notifications', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: vi.fn() } }));
vi.mock('@/utils/platform', () => ({ isRunningOnMac: () => false }));
vi.mock('@/sync/apiSocket', () => ({ apiSocket: { request: mocks.request }, getCurrentAppState: () => 'active', getKissopenClientId: () => 'test' }));
vi.mock('@/sync/webTabTitle', () => ({ notifyUnreadMessage: vi.fn() }));
vi.mock('@/sync/encryption/encryption', () => ({ Encryption: class {} }));
vi.mock('@/sync/encryption/artifactEncryption', () => ({ ArtifactEncryption: class {} }));
vi.mock('@/sync/encryption/encryptionCache', () => ({ EncryptionCache: class {} }));
vi.mock('@/sync/storage', () => ({ storage: { getState: () => ({
    ...mocks.state,
    getActiveSessions: () => [],
    applySessions: (sessions: any[]) => {
        mocks.state.sessions = { ...mocks.state.sessions };
        for (const session of sessions) mocks.state.sessions[session.id] = session;
    },
    applyMessages: mocks.applyMessages,
    applyMessagesLoaded: mocks.applyMessagesLoaded,
    applyOlderMessagesPagination: mocks.applyOlderMessagesPagination,
}) } }));
vi.mock('@/sync/ops', () => ({ sessionSetAgentModes: mocks.setModes }));
vi.mock('@/sync/persistence', () => ({ loadPendingSettings: () => ({}), savePendingSettings: vi.fn() }));
// The offline cache's storage is covered by its own tests; here its message
// log is whatever a test puts in `mocks.cache` (by default: nothing cached).
vi.mock('@/sync/offlineCache/relayCache', () => ({ relayCache: {
    open: vi.fn(), isOpen: () => false, messagesRetain: async () => {},
    ...mocks.cache,
} }));
vi.mock('@/sync/revenueCat', () => ({ RevenueCat: {}, LogLevel: {}, PaywallResult: {} }));
vi.mock('@/sync/serverConfig', () => ({ getServerUrl: () => 'https://example.invalid' }));
vi.mock('@/sync/pushRegistration', () => ({ syncCurrentPushToken: vi.fn() }));
vi.mock('@/sync/apiArtifacts', () => ({ fetchArtifact: vi.fn(), fetchArtifacts: vi.fn(), createArtifact: vi.fn(), updateArtifact: vi.fn() }));
vi.mock('@/sync/apiFriends', () => ({ getFriendsList: vi.fn(), getUserProfile: vi.fn() }));
vi.mock('@/sync/apiFeed', () => ({ fetchFeed: vi.fn() }));
vi.mock('@/sync/apiAttachments', () => ({ requestAttachmentUpload: vi.fn(), uploadEncryptedBlob: vi.fn() }));
vi.mock('@/sync/apiProjects', () => ({ fetchProjects: vi.fn() }));
vi.mock('@/sync/projects', () => ({ decryptProjectRecord: vi.fn(), loadProjectAvatar: vi.fn() }));
vi.mock('@/sync/sessionAvatars', () => ({ loadSessionAvatar: mocks.loadAvatar }));
vi.mock('@/sync/typesRaw', () => ({ normalizeRawMessage: (_id: string, _localId: string, _time: number, content: unknown) => content }));
vi.mock('@/config', () => ({ config: {} }));
vi.mock('@/log', () => ({ log: { log: vi.fn() } }));
vi.mock('@/track', () => ({ tracking: null }));
vi.mock('@/modal', () => ({ Modal: {} }));
vi.mock('@/text', () => ({ t: (key: string) => key }));
vi.mock('@/encryption/blob', () => ({}));
vi.mock('@/utils/readFileBytes', () => ({}));
vi.mock('@/sync/gitStatusSync', () => ({ gitStatusSync: { getSync: () => ({ invalidate: mocks.gitInvalidate }), clearForSession: () => {} } }));
vi.mock('@/realtime/hooks/voiceHooks', () => ({ voiceHooks: {
    onSessionFocus: mocks.voiceFocus, onMessages: mocks.voiceMessages, onReady: mocks.voiceReady,
} }));

import { sync } from './sync';

let engine: any;
let encryption: { decryptMessages: ReturnType<typeof vi.fn> };
afterEach(() => { engine?.sessionAvatars.clear(); vi.unstubAllGlobals(); });
function response(messages: any[], hasMore = false) {
    return { ok: true, json: async () => ({ messages, hasMore }) };
}
function message(name?: string) {
    return {
        id: 'message', seq: 100, localId: null, createdAt: 1,
        content: { role: 'agent', content: name ? [{ type: 'tool-call', name }] : [{ type: 'text', text: 'Hello' }] },
    };
}
async function waitForPreload() {
    await vi.waitFor(() => expect(mocks.applyMessagesLoaded).toHaveBeenCalled());
    await Promise.resolve();
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.state = {
        sessions: { a: { id: 'a', permissionMode: 'auto', metadata: {} }, b: { id: 'b', permissionMode: 'auto', metadata: {} } },
        sessionMessages: {}, currentViewingSessionId: null,
    };
    mocks.request.mockResolvedValue(response([message()]));
    mocks.applyMessages.mockImplementation((id, messages, source) => {
        mocks.state.sessionMessages[id] = { messages, messagesMap: { message: messages[0] }, hasMoreOlder: false };
        const enteredPlanMode = messagePlanMode(messages) === true;
        if (enteredPlanMode && source !== 'preload') mocks.state.sessions[id].permissionMode = 'plan';
        return { changed: ['message'], hasReadyEvent: true, enteredPlanMode };
    });
    mocks.applyOlderMessagesPagination.mockImplementation((id, { hasMore }) => {
        mocks.state.sessionMessages[id] ??= {};
        mocks.state.sessionMessages[id].hasMoreOlder = hasMore;
    });
    mocks.setModes.mockImplementation((id, patch) => Object.assign(mocks.state.sessions[id], patch));
    engine = new (sync.constructor as new () => typeof sync)();
    encryption = { decryptMessages: vi.fn(async (messages: any[]) => messages) };
    engine.encryption = { getSessionEncryption: (id: string) => mocks.state.sessions[id] ? encryption : undefined };
});

describe('session avatar sync integration', () => {
    const avatar = { ref: 'sessions/a/avatar/a.enc', preview: 'opaque', version: 1 };
    const update = (seq: number, value: unknown) => ({ id: `u${seq}`, seq, createdAt: seq, body: { t: 'update-session', id: 'a', avatar: value } });

    it('applies artwork events and prevents reordered updates from undoing removal', async () => {
        engine.projectsSync = { invalidate: vi.fn() };
        await engine.handleUpdate(update(10, avatar));
        expect(mocks.state.sessions.a.avatarDescriptor).toEqual(avatar);
        await engine.handleUpdate(update(12, null));
        await engine.handleUpdate(update(11, { ...avatar, version: 2 }));
        expect(mocks.state.sessions.a.avatarDescriptor).toBeNull();
        expect(mocks.state.sessions.a.avatar).toBeNull();
        expect(mocks.state.sessions.a.avatarUpdateSeq).toBe(12);
        expect(mocks.state.sessions.a.seq).toBe(12);
    });

    it('does not resurrect an image when an old event arrives after a removal snapshot', async () => {
        engine.projectsSync = { invalidate: vi.fn() };
        engine.credentials = { token: 'test', secret: 'secret' };
        engine.encryption = {
            initializeSessions: vi.fn(),
            getSessionEncryption: () => ({ decryptMetadata: async () => ({}), decryptAgentState: async () => null }),
        };
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sessions: [{ id: 'a', seq: 0, metadata: 'opaque', metadataVersion: 1, agentState: null, agentStateVersion: 0, dataEncryptionKey: null, active: false, updatedAt: 10, createdAt: 1, avatar: null, avatarVersion: 3 }] })));
        await engine.fetchSessions();
        await engine.handleUpdate({ ...update(100, { ...avatar, version: 2 }), body: { t: 'update-session', id: 'a', avatar: { ...avatar, version: 2 }, avatarVersion: 2 } });
        expect(mocks.state.sessions.a.avatarDescriptor).toBeNull();
        expect(mocks.state.sessions.a.avatarRevision).toBe(3);
    });

    it('preserves a removal delivered while a stale session snapshot is downloading', async () => {
        engine.projectsSync = { invalidate: vi.fn() };
        engine.credentials = { token: 'test', secret: 'secret' };
        engine.encryption = {
            initializeSessions: vi.fn(),
            getSessionEncryption: () => ({ decryptMetadata: async () => ({}), decryptAgentState: async () => null }),
        };
        await engine.handleUpdate(update(10, avatar));
        let finish!: (value: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
        const fetching = engine.fetchSessions();
        await engine.handleUpdate(update(11, null));
        finish(Response.json({ sessions: [{ id: 'a', seq: 0, metadata: 'opaque', metadataVersion: 1, agentState: null, agentStateVersion: 0, dataEncryptionKey: null, active: false, updatedAt: 1, createdAt: 1, avatar }] }));
        await fetching;
        expect(mocks.state.sessions.a.avatarDescriptor).toBeNull();
        expect(mocks.state.sessions.a.avatarUpdateSeq).toBe(11);
    });
});

describe('chat preload sync integration', () => {
    it('hydrates one latest page without read, voice, git, or history side effects', async () => {
        mocks.request.mockResolvedValue(response([message()], true));
        const older = vi.spyOn(engine, 'loadOlderMessages');
        engine.preloadSession('a');
        await waitForPreload();
        expect(mocks.request).toHaveBeenCalledOnce();
        expect(mocks.request.mock.calls[0][0]).toBe('/v3/sessions/a/messages?before_seq=2147483647&limit=100');
        expect(mocks.applyMessages.mock.calls[0][2]).toBe('preload');
        expect(mocks.state.currentViewingSessionId).toBeNull();
        expect(mocks.voiceFocus).not.toHaveBeenCalled();
        expect(mocks.voiceMessages).not.toHaveBeenCalled();
        expect(mocks.voiceReady).not.toHaveBeenCalled();
        expect(mocks.gitInvalidate).not.toHaveBeenCalled();
        expect(older).not.toHaveBeenCalled();
        engine.preloadSession('a');
        await Promise.resolve();
        expect(mocks.request).toHaveBeenCalledOnce();
    });

    it('shares the in-flight first page with touch-up and activates it normally', async () => {
        let finish!: (value: unknown) => void;
        mocks.request.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        engine.preloadSession('a');
        await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
        mocks.state.currentViewingSessionId = 'a';
        engine.onSessionVisible('a');
        finish(response([message()]));
        await engine.getMessagesSync('a').awaitQueue();
        expect(mocks.request).toHaveBeenCalledOnce();
        expect(encryption.decryptMessages).toHaveBeenCalledOnce();
        expect(mocks.applyMessages.mock.calls[0][2]).toBe('sync');
        expect(mocks.voiceMessages).toHaveBeenCalledOnce();
        expect(mocks.voiceFocus).toHaveBeenCalledWith('a', {});
    });

    it('revalidates a completed preload and starts older history only after a visit', async () => {
        mocks.request.mockResolvedValueOnce(response([message()], true)).mockResolvedValue(response([]));
        // End this test's history loop after its first attempt, without timers.
        const older = vi.spyOn(engine, 'loadOlderMessages').mockRejectedValue(new Error('test stop'));
        engine.preloadSession('a');
        await waitForPreload();
        expect(older).not.toHaveBeenCalled();
        mocks.state.currentViewingSessionId = 'a';
        engine.onSessionVisible('a');
        await engine.getMessagesSync('a').awaitQueue();
        expect(mocks.request.mock.calls[1][0]).toBe('/v3/sessions/a/messages?after_seq=100&limit=100');
        expect(older).toHaveBeenCalledExactlyOnceWith('a');
    });

    it('defers plan-mode changes until the session is actually opened, exactly once', async () => {
        mocks.request.mockResolvedValueOnce(response([message('EnterPlanMode')])).mockResolvedValue(response([]));
        engine.preloadSession('a');
        await waitForPreload();
        expect(mocks.state.sessions.a.permissionMode).toBe('auto');
        expect(mocks.setModes).not.toHaveBeenCalled();
        engine.onSessionVisible('a');
        await engine.getMessagesSync('a').awaitQueue();
        expect(mocks.setModes).toHaveBeenCalledExactlyOnceWith('a', { permissionMode: 'plan' });
        expect(mocks.state.sessions.a.permissionMode).toBe('plan');
    });

    it.each(['new-choice', 'exit-event', 'exit-on-refresh'])('does not replay an obsolete plan transition: %s', async (reason) => {
        mocks.request.mockResolvedValueOnce(response([message('EnterPlanMode')])).mockResolvedValue(response([]));
        engine.preloadSession('a');
        await waitForPreload();
        if (reason === 'new-choice') mocks.state.sessions.a.permissionMode = 'yolo';
        else if (reason === 'exit-event') engine.applyMessages('a', [message('ExitPlanMode').content]);
        else mocks.request.mockResolvedValue(response([{ ...message('ExitPlanMode'), seq: 101 }]));
        engine.onSessionVisible('a');
        await engine.getMessagesSync('a').awaitQueue();
        expect(mocks.setModes).not.toHaveBeenCalled();
    });

    it('drops an abandoned page even if the transport ignores abort', async () => {
        let finish!: (value: unknown) => void;
        mocks.request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue(response([message()]));
        engine.preloadSession('a');
        await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
        engine.preloadSession('b');
        expect(mocks.request.mock.calls[0][1].signal.aborted).toBe(true);
        finish(response([message()]));
        await vi.waitFor(() => expect(mocks.applyMessagesLoaded).toHaveBeenCalledWith('b'));
        expect(mocks.applyMessagesLoaded).not.toHaveBeenCalledWith('a');
        expect(engine.sessionSeq.has('a')).toBe(false);
    });

    it('does not hydrate after the session is deleted during decryption', async () => {
        let finish!: (value: unknown) => void;
        encryption.decryptMessages.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        engine.preloadSession('a');
        await vi.waitFor(() => expect(encryption.decryptMessages).toHaveBeenCalledOnce());
        const pending = engine.messagePreloader.take('a');
        delete mocks.state.sessions.a;
        finish([message()]);
        await expect(pending).resolves.toBe(false);
        expect(mocks.applyMessages).not.toHaveBeenCalled();
        expect(engine.sessionSeq.has('a')).toBe(false);
    });

    it('server events preserve voice-follow without claiming a visit or fetching all history', async () => {
        mocks.request.mockResolvedValue(response([message()], true));
        const older = vi.spyOn(engine, 'loadOlderMessages');
        engine.onSessionDataUpdated('a');
        await engine.getMessagesSync('a').awaitQueue();
        expect(mocks.voiceFocus).toHaveBeenCalledWith('a', {});
        expect(mocks.state.currentViewingSessionId).toBeNull();
        expect(older).not.toHaveBeenCalled();
    });
});
describe('offline message cache integration', () => {
    // The cache holds the server's records as they came; the mocked decrypt is
    // the identity, so a cached record here is simply its content.
    function record(seq: number) {
        return { ...message(), id: `m${seq}`, seq, updatedAt: 1 };
    }
    function cached(seqs: number[], hasMoreOlder = false): CachedSessionMessages {
        const messages = seqs.map(record);
        const lastSeq = Math.max(0, ...seqs);
        return { v: 2, lastSeq, oldestSeq: seqs.length ? Math.min(...seqs) : null, settledSeq: lastSeq, holes: {}, hasMoreOlder, messages } as any;
    }

    it('shows the cached log first, then fetches only what is newer', async () => {
        mocks.cache.messagesLoad.mockResolvedValue(cached([1, 2, 3]));
        const forward = [{ ...message(), id: 'm4', seq: 4 }];
        mocks.request.mockResolvedValue(response(forward));
        const order: string[] = [];
        mocks.applyMessagesLoaded.mockImplementation(() => order.push('loaded'));
        mocks.request.mockImplementation(async () => { order.push('request'); return response(forward); });
        await engine.fetchMessages('a');
        expect(mocks.applyMessages.mock.calls[0][1]).toHaveLength(3);
        expect(order).toEqual(['loaded', 'request', 'loaded']);
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/v3/sessions/a/messages?after_seq=3&limit=100');
        expect(mocks.cache.messagesRecordForward).toHaveBeenCalledWith('a', 3, forward);
        expect(engine.sessionSeq.get('a')).toMatchObject({ settledSeq: 4, lastSeq: 4 });
        expect(engine.sessionOldestSeq.get('a')).toBe(1);
        expect(mocks.applyOlderMessagesPagination).toHaveBeenCalledWith('a', { hasMore: false });
    });

    it('keeps the cached log on screen when the network fails', async () => {
        mocks.cache.messagesLoad.mockResolvedValue(cached([5, 6], true));
        mocks.request.mockRejectedValue(new Error('offline'));
        await expect(engine.fetchMessages('a')).rejects.toThrow('offline');
        expect(mocks.applyMessages).toHaveBeenCalledOnce();
        expect(mocks.applyMessagesLoaded).toHaveBeenCalledWith('a');
        // The next attempt is the incremental one, from the cache's cursor.
        expect(engine.sessionSeq.get('a').settledSeq).toBe(6);
        expect(mocks.applyOlderMessagesPagination).toHaveBeenCalledWith('a', { hasMore: true });
    });

    it('fetches and records the latest page when nothing is cached', async () => {
        mocks.request.mockResolvedValue(response([message()], true));
        await engine.fetchMessages('a');
        expect(mocks.request.mock.calls[0][0]).toBe('/v3/sessions/a/messages?before_seq=2147483647&limit=100');
        expect(mocks.cache.messagesRecordLatest).toHaveBeenCalledWith('a', [message()], true);
    });

    it('pages back through cached history before asking the server', async () => {
        const seqs = Array.from({ length: 150 }, (_, index) => index + 1);
        mocks.cache.messagesLoad.mockResolvedValue(cached(seqs, true));
        mocks.request.mockResolvedValue(response([]));
        await engine.fetchMessages('a');
        expect(mocks.applyMessages.mock.calls[0][1]).toHaveLength(100);
        expect(engine.sessionOldestSeq.get('a')).toBe(51);
        mocks.request.mockClear();
        mocks.state.applyOlderMessagesLoading = vi.fn();
        mocks.state.sessionMessages.a = { ...mocks.state.sessionMessages.a, hasMoreOlder: true, isLoadingOlder: false };
        await engine.loadOlderMessages('a');
        expect(mocks.request).not.toHaveBeenCalled();
        expect(mocks.applyMessages.mock.calls.at(-1)![1]).toHaveLength(50);
        expect(engine.sessionOldestSeq.get('a')).toBe(1);
        // The cache's oldest is not the session's first: the server still has more.
        expect(mocks.applyOlderMessagesPagination).toHaveBeenLastCalledWith('a', { hasMore: true });
    });

    it('records live socket messages that extend the log', async () => {
        engine.sessionSeq.set('a', seqTrackerStart(7));
        const live = { id: 'm8', seq: 8, localId: null, createdAt: 8, updatedAt: 8, content: { t: 'encrypted', c: 'x' } };
        Object.assign(encryption, { decryptMessage: vi.fn(async () => ({ id: 'm8', localId: null, createdAt: 8, content: message().content })) });
        engine.sessionsSync = { awaitQueue: async () => {} };
        await engine.handleUpdate({ id: 'u', seq: 1, createdAt: 8, body: { t: 'new-message', sid: 'a', message: live } });
        expect(mocks.cache.messagesRecordForward).toHaveBeenCalledWith('a', 7, [live]);
        expect(engine.sessionSeq.get('a').settledSeq).toBe(8);
    });

    it('shows a live message that skips a seq, but fetches from before the gap', async () => {
        engine.sessionSeq.set('a', seqTrackerStart(7));
        const live = { id: 'm9', seq: 9, localId: null, createdAt: 9, updatedAt: 9, content: { t: 'encrypted', c: 'x' } };
        Object.assign(encryption, { decryptMessage: vi.fn(async () => ({ id: 'm9', localId: null, createdAt: 9, content: message().content })) });
        engine.sessionsSync = { awaitQueue: async () => {} };
        const invalidate = vi.fn();
        engine.getMessagesSync = () => ({ invalidate, awaitQueue: async () => {} });
        const enqueue = vi.spyOn(engine, 'enqueueMessages').mockImplementation(() => {});
        await engine.handleUpdate({ id: 'u', seq: 1, createdAt: 9, body: { t: 'new-message', sid: 'a', message: live } });
        // Shown at once (the mocked normalizer passes the decrypted content through).
        expect(enqueue).toHaveBeenCalledWith('a', [message().content]);
        expect(invalidate).toHaveBeenCalled();
        // Not recorded: the forward fetch from 7 brings 8 (once readable) and 9 together.
        expect(mocks.cache.messagesRecordForward).not.toHaveBeenCalled();
        expect(engine.sessionSeq.get('a').settledSeq).toBe(7);
    });

    it('fetches forward from the settled cursor, not the newest seq held, until the hole fills', async () => {
        // 9 was readable before 8: the cursor waits at 7.
        engine.sessionSeq.set('a', seqTrackerRecord(seqTrackerStart(7), [9]));
        mocks.state.sessionMessages.a = { reducerState: { messageIds: new Map([['m9', 'm9']]) } };
        mocks.request.mockResolvedValue(response([record(8), record(9)]));
        await engine.fetchMessages('a');
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/v3/sessions/a/messages?after_seq=7&limit=100');
        // 9 is already on screen; only 8 is decrypted and applied.
        expect(encryption.decryptMessages).toHaveBeenCalledExactlyOnceWith([record(8)]);
        expect(mocks.cache.messagesRecordForward).toHaveBeenCalledWith('a', 7, [record(8), record(9)]);
        expect(engine.sessionSeq.get('a')).toMatchObject({ settledSeq: 9, lastSeq: 9, holes: {} });
    });

    it('seeds the forward cursor from a cached log that waits on a hole', async () => {
        const entry = messageCacheApplyForward(messageCacheApplyLatest(undefined, [record(1), record(2)] as any, false), 2, [record(4)] as any)!;
        expect(entry.settledSeq).toBe(2);
        mocks.cache.messagesLoad.mockResolvedValue(entry);
        mocks.request.mockResolvedValue(response([]));
        await engine.fetchMessages('a');
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/v3/sessions/a/messages?after_seq=2&limit=100');
        expect(engine.sessionSeq.get('a')).toMatchObject({ settledSeq: 2, lastSeq: 4 });
        expect(engine.holeRecheckTimers.has('a')).toBe(true);
        engine.clearHoleRecheck('a');
    });

    it('forgets a deleted session\'s log', async () => {
        engine.projectsSync = { invalidate: vi.fn() };
        engine.encryption.removeSessionEncryption = vi.fn();
        mocks.state.deleteSession = vi.fn();
        await engine.handleUpdate({ id: 'u', seq: 1, createdAt: 1, body: { t: 'delete-session', sid: 'a' } });
        expect(mocks.cache.messagesDelete).toHaveBeenCalledWith('a');
    });
});

describe('offline list cache integration', () => {
    const record = (id: string, metadata = id) => ({
        id, seq: 0, metadata, metadataVersion: 1, agentState: null, agentStateVersion: 0,
        dataEncryptionKey: null, active: false, activeAt: 0, updatedAt: 1, createdAt: 1, avatar: null,
    });
    beforeEach(() => {
        mocks.state.sessions = {};
        mocks.state.deleteSession = vi.fn((id: string) => { delete mocks.state.sessions[id]; });
        engine.credentials = { token: 'test', secret: 'secret' };
        engine.projectsSync = { invalidate: vi.fn() };
        engine.encryption = {
            initializeSessions: vi.fn(),
            removeSessionEncryption: vi.fn(),
            getSessionEncryption: () => ({ decryptMetadata: async (_version: number, value: string) => ({ name: value }), decryptAgentState: async () => null }),
        };
    });

    it('shows the cached sessions, then the network list replaces them and drops the deleted', async () => {
        mocks.cache.listRead.mockImplementation((name: string) => name === 'sessions' ? [record('a', 'cached'), record('gone')] : undefined);
        await expect(engine.seedListsFromCache()).resolves.toBe(true);
        expect(Object.keys(mocks.state.sessions).sort()).toEqual(['a', 'gone']);
        expect(mocks.state.sessions.a.metadata).toEqual({ name: 'cached' });

        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sessions: [record('a', 'fresh')] })));
        await engine.fetchSessions();
        expect(mocks.state.sessions.a.metadata).toEqual({ name: 'fresh' });
        expect(mocks.state.deleteSession).toHaveBeenCalledExactlyOnceWith('gone');
        expect(mocks.cache.listWrite).toHaveBeenCalledWith('sessions', [record('a', 'fresh')]);
    });

    it('keeps sessions a full network list paged out, with their logs', async () => {
        const dated = (id: string, updatedAt: number) => ({ ...record(id), updatedAt });
        const listed = Array.from({ length: 150 }, (_, index) => dated(`s${index}`, 1000 - index)); // 851..1000
        mocks.cache.listRead.mockImplementation((name: string) => name === 'sessions'
            ? [dated('s0', 999), dated('paged', 10), dated('deleted', 900)]
            : undefined);
        await engine.seedListsFromCache();
        let retainKeep: (() => Iterable<string>) | undefined;
        const relay = (await import('@/sync/offlineCache/relayCache')).relayCache as any;
        const retain = relay.messagesRetain;
        relay.messagesRetain = async (keep: () => Iterable<string>) => { retainKeep = keep; };
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sessions: listed })));
        try {
            await engine.fetchSessions();
        } finally {
            relay.messagesRetain = retain;
        }
        expect(mocks.state.deleteSession).toHaveBeenCalledExactlyOnceWith('deleted');
        expect(mocks.state.sessions.paged).toBeDefined();
        expect(mocks.cache.listWrite).toHaveBeenCalledWith('sessions', [...listed, dated('paged', 10)]);
        expect([...retainKeep!()]).toContain('paged');
        expect([...retainKeep!()]).not.toContain('deleted');
    });

    it('shows cached machines and sessions as offline until the network says otherwise', async () => {
        mocks.cache.listRead.mockImplementation((name: string) => name === 'sessions' ? [{ ...record('a'), active: true }] : undefined);
        await engine.seedListsFromCache();
        expect(mocks.state.sessions.a.active).toBe(false);
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sessions: [{ ...record('a'), active: true }] })));
        await engine.fetchSessions();
        expect(mocks.state.sessions.a.active).toBe(true);
    });

    it('drops a cached list that lands after the network list', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sessions: [record('a', 'fresh')] })));
        await engine.fetchSessions();
        mocks.cache.listRead.mockImplementation((name: string) => name === 'sessions' ? [record('a', 'cached'), record('b')] : undefined);
        await expect(engine.seedListsFromCache()).resolves.toBe(false);
        expect(mocks.state.sessions.a.metadata).toEqual({ name: 'fresh' });
        expect(mocks.state.sessions.b).toBeUndefined();
    });

    it('starts from the network alone when nothing is cached', async () => {
        await expect(engine.seedListsFromCache()).resolves.toBe(false);
        expect(mocks.state.sessions).toEqual({});
    });
});
