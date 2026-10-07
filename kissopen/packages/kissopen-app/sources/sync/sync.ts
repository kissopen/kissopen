import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { apiSocket, getCurrentAppState, getKissopenClientId } from '@/sync/apiSocket';
import { notifyUnreadMessage } from '@/sync/webTabTitle';
import { AuthCredentials } from '@/auth/tokenStorage';
import { Encryption } from '@/sync/encryption/encryption';
import { decodeBase64, encodeBase64 } from '@/encryption/base64';
import { storage } from './storage';
// Circular at module level (ops.ts imports sync) but safe: both sides only
// touch each other's exports at runtime, never during module initialization.
import { sessionSetAgentModes } from './ops';
import { getImageAttachmentSendPlan, isAttachmentAllowedByPolicy } from './attachmentSupport';
import {
    errorMessageFromUnknown,
    formatAttachmentDiagnosticForLog,
    getAttachmentDiagnostic,
} from './attachmentDiagnostics';
import { ApiEphemeralUpdateSchema, ApiMessage, ApiUpdateContainerSchema } from './apiTypes';
import type { ApiEphemeralActivityUpdate } from './apiTypes';
import { Session, Machine } from './storageTypes';
import { InvalidateSync } from '@/utils/sync';
import { delay } from '@/utils/time';
import { ActivityUpdateAccumulator } from './reducer/activityUpdateAccumulator';
import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { syncCurrentPushToken } from './pushRegistration';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { isRunningOnMac } from '@/utils/platform';
import { NormalizedMessage, normalizeRawMessage, RawRecord } from './typesRaw';
import { applySettings, Settings, settingsDefaults, settingsParse, settingsToSyncPayload, SUPPORTED_SCHEMA_VERSION } from './settings';
import { Profile, profileParse } from './profile';
import { loadPendingSettings, savePendingSettings } from './persistence';
import {
    initializeTracking,
    trackGitHubConnected,
    trackMessageSent,
    tracking,
    trackPaywallCancelled,
    trackPaywallError,
    trackPaywallPresented,
    trackPaywallPurchased,
    trackPaywallRestored,
} from '@/track';
import type { MessageSentSource } from '@/track';
import { parseToken } from '@/utils/parseToken';
import { RevenueCat, LogLevel, PaywallResult } from './revenueCat';
import { getServerUrl } from './serverConfig';
import { config } from '@/config';
import { log } from '@/log';
import { gitStatusSync } from './gitStatusSync';
import { AsyncLock } from '@/utils/lock';
import { voiceHooks } from '@/realtime/hooks/voiceHooks';
import { Message } from './typesMessage';
import { EncryptionCache } from './encryption/encryptionCache';
import { systemPrompt } from './prompt/systemPrompt';
import { fetchArtifact, fetchArtifacts, createArtifact, updateArtifact } from './apiArtifacts';
import { DecryptedArtifact, Artifact, ArtifactCreateRequest, ArtifactUpdateRequest } from './artifactTypes';
import { ArtifactEncryption } from './encryption/artifactEncryption';
import { getFriendsList, getUserProfile } from './apiFriends';
import { fetchFeed } from './apiFeed';
import { FeedItem } from './feedTypes';
import { UserProfile } from './friendTypes';
import { resolveControlHandoffDirection } from './controlHandoff';
import { resolveMessageModeMeta, UnsupportedPermissionModeError } from './messageMeta';
import type { AttachmentPreview, UploadedAttachment } from './attachmentTypes';
import { requestAttachmentUpload, uploadEncryptedBlob } from './apiAttachments';
import { encryptBlob } from '@/encryption/blob';
import { readFileBytes } from '@/utils/readFileBytes';
import { Modal } from '@/modal';
import { t } from '@/text';
import { isRigMetadataV1, rigCanUseAttachments, rigSendsMessageReceipts, usesControlledSessionUi } from './rig';
import { fetchProjects as fetchProjectRecords } from './apiProjects';
import { decryptProjectRecord, loadProjectAvatar, type DecryptedProjectRecord } from './projects';
import type { ApiProjectRecord, Project, ProjectAvatar } from './projectTypes';
import { SessionMessagePreloader } from './sessionMessagePreloader';
import { messagePlanMode } from './messagePlanMode';
import { loadSessionAvatar } from './sessionAvatars';
import { SessionAvatarHydrator } from './SessionAvatarHydrator';
import { sessionAvatarDescriptorSchema, sessionAvatarRevisionSchema, sameSessionAvatar } from './sessionAvatarTypes';
import { releaseSpawnedSession } from './spawnRequestId';
import { relayCache } from './offlineCache/relayCache';
import { cacheAccountKey } from './offlineCache/cacheKeys';
import {
    HOLE_GRACE_MS,
    messageCacheLatestPage,
    messageCacheOlderPage,
    messageCacheSeedable,
    seqTrackerOfCache,
    seqTrackerRecord,
    seqTrackerStart,
    type SeqTracker,
} from './offlineCache/messageCache';
import { sessionListToCache, sessionsLeftOut } from './offlineCache/sessionListRetention';

type V3GetSessionMessagesResponse = {
    messages: ApiMessage[];
    hasMore: boolean;
};

/** One session as GET /v1/sessions returns it: metadata and keys still encrypted. */
type ApiSessionRecord = {
    id: string;
    tag: string;
    seq: number;
    metadata: string;
    metadataVersion: number;
    agentState: string | null;
    agentStateVersion: number;
    dataEncryptionKey: string | null;
    projectId?: string | null;
    avatar?: unknown;
    avatarVersion?: unknown;
    active: boolean;
    activeAt: number;
    createdAt: number;
    updatedAt: number;
    lastMessage: ApiMessage | null;
};

/** One machine as GET /v1/machines returns it: metadata and keys still encrypted. */
type ApiMachineRecord = {
    id: string;
    metadata: string;
    metadataVersion: number;
    daemonState?: string | null;
    daemonStateVersion?: number;
    dataEncryptionKey?: string | null; // Add support for per-machine encryption keys
    seq: number;
    active: boolean;
    activeAt: number;  // Changed from lastActiveAt
    createdAt: number;
    updatedAt: number;
};

/*
 * Where a list being applied came from. `cache` is the copy relayCache kept
 * from the last run, shown while the network is asked; once the network's
 * copy of a list has been applied, a cached one arriving late is dropped.
 */
type ListSource = 'network' | 'cache';

/** Cached messages shown on a chat's first paint: one page, like the network's. */
const CACHED_FIRST_PAGE = 100;

// Sentinel used as `before_seq` for the very first backward fetch of a
// session. It must exceed any real `seq` value the server can produce.
// `seq` is stored as Postgres int4 on the server, so the maximum is
// 2_147_483_647. We use that exact upper bound to keep the request safely
// within int4 while still being effectively "infinite" for any session.
const SEQ_BACKWARD_INITIAL_SENTINEL = 2_147_483_647;

type V3PostSessionMessagesResponse = {
    messages: Array<{
        id: string;
        seq: number;
        localId: string | null;
        createdAt: number;
        updatedAt: number;
    }>;
};

type OutboxMessage = {
    kind: 'user' | 'attachment';
    localId: string;
    content: string;
};

type SendMessageOptions = {
    displayText?: string;
    source?: MessageSentSource;
    /** Optional image attachments to send before the text message. */
    attachments?: AttachmentPreview[];
    /** Wait until the outbox reaches the server before resolving. */
    awaitDelivery?: boolean;
    /** Cancel before outbox acceptance; queued messages are not recalled. */
    signal?: AbortSignal;
    /** Synchronous commit notification, before a caller can cancel its UI flow. */
    onAccepted?: () => void;
    /** Re-check the composer's destination after asynchronous preparation. */
    isCurrent?: () => boolean;
};

function sameBytes(a: Uint8Array | null | undefined, b: Uint8Array | null): boolean {
    if (a === undefined) return false;
    if (a === null || b === null) return a === b;
    if (a.length !== b.length) return false;
    for (let index = 0; index < b.length; index += 1) {
        if (a[index] !== b[index]) return false;
    }
    return true;
}

function avatarDescriptorKey(descriptor: NonNullable<DecryptedProjectRecord['avatar']>): string {
    return `${descriptor.ref}:${descriptor.version}`;
}

class Sync {
    private static readonly BACKGROUND_SEND_TIMEOUT_MS = 30_000;
    encryption!: Encryption;
    serverID!: string;
    anonID!: string;
    private credentials!: AuthCredentials;
    public encryptionCache = new EncryptionCache();
    private sessionsSync: InvalidateSync;
    private projectsSync: InvalidateSync;
    private messagesSync = new Map<string, InvalidateSync>();
    private messagePreloader = new SessionMessagePreloader((sessionId, signal) => this.preloadLatestPage(sessionId, signal));
    private historyPrefetchSessions = new Set<string>();
    private olderMessagesPrefetching = new Set<string>();
    private preloadedPlanModes = new Map<string, Session['permissionMode']>();
    private sendSync = new Map<string, InvalidateSync>();
    private sendAbortControllers = new Map<string, AbortController>();
    // Each session's forward cursor (see messageCache.ts): `settledSeq` is
    // where the next forward fetch starts — never past a seq that may still
    // be being written — and `lastSeq` the newest applied. Present once a
    // session's messages have been loaded.
    private sessionSeq = new Map<string, SeqTracker>();
    // One pending re-fetch per session while its cursor waits on a hole.
    private holeRecheckTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Lowest seq value we have already fetched and applied for a session.
    // Used as the cursor for backward pagination when the user scrolls up to
    // load older history. Set after the initial latest-page fetch and
    // advanced downward by loadOlderMessages.
    private sessionOldestSeq = new Map<string, number>();
    // Which lists the network has already answered this run; a cached copy
    // must not overwrite them (see ListSource).
    private listsFromNetwork = { sessions: false, machines: false, projects: false };
    // Sessions shown from the cached list (id → updatedAt as cached), until
    // the network's list confirms them: one it should have had but does not
    // was deleted while the app was closed.
    private cacheSeededSessions: Map<string, number> | null = null;
    // Sessions a live socket event named, by a counter that only goes up, so
    // a session list can tell which arrived while it was being fetched.
    private liveSessionTick = 0;
    private liveSessionTicks = new Map<string, number>();
    private pendingOutbox = new Map<string, OutboxMessage[]>();
    private sessionMessageQueue = new Map<string, NormalizedMessage[]>();
    private sessionQueueProcessing = new Set<string>();
    private sessionMessageLocks = new Map<string, AsyncLock>();
    private sessionDataKeys = new Map<string, Uint8Array>(); // Store session data encryption keys internally
    private machineDataKeys = new Map<string, Uint8Array>(); // Store machine data encryption keys internally
    private artifactDataKeys = new Map<string, Uint8Array>(); // Store artifact data encryption keys internally
    // Project data keys are account secrets and remain private to Sync. They
    // are intentionally never copied into Zustand or row/display data.
    private projectDataKeys = new Map<string, Uint8Array | null>();
    private readonly sessionAvatars = new SessionAvatarHydrator({
        read: (id) => storage.getState().sessions[id],
        load: async (id, descriptor, signal) => this.credentials
            ? await loadSessionAvatar(this.credentials, this.encryption, id, descriptor, signal)
            : null,
        publish: (id, avatar) => {
            const session = storage.getState().sessions[id];
            if (session) storage.getState().applySessions([{ ...session, avatar }]);
        },
    });
    private projectAvatarCache = new Map<string, ProjectAvatar>();
    private projectAvatarInFlight = new Map<string, Promise<ProjectAvatar | null>>();
    private projectAvatarDescriptors = new Map<string, string>();
    private projectAvatarGenerations = new Map<string, number>();
    private settingsSync: InvalidateSync;
    private profileSync: InvalidateSync;
    private purchasesSync: InvalidateSync;
    private machinesSync: InvalidateSync;
    private pushTokenSync: InvalidateSync;
    private nativeUpdateSync: InvalidateSync;
    private artifactsSync: InvalidateSync;
    private friendsSync: InvalidateSync;
    private friendRequestsSync: InvalidateSync;
    private feedSync: InvalidateSync;
    private activityAccumulator: ActivityUpdateAccumulator;
    private pendingSettings: Partial<Settings> = loadPendingSettings();
    private appState: AppStateStatus = AppState.currentState;
    private backgroundSendTimeout: ReturnType<typeof setTimeout> | null = null;
    private backgroundSendNotificationId: string | null = null;
    private backgroundSendStartedAt: number | null = null;
    revenueCatInitialized = false;

    // Generic locking mechanism
    private recalculationLockCount = 0;
    private lastRecalculationTime = 0;

    constructor() {
        this.sessionsSync = new InvalidateSync(this.fetchSessions);
        this.projectsSync = new InvalidateSync(this.fetchProjects);
        this.settingsSync = new InvalidateSync(this.syncSettings);
        this.profileSync = new InvalidateSync(this.fetchProfile);
        this.purchasesSync = new InvalidateSync(this.syncPurchases);
        this.machinesSync = new InvalidateSync(this.fetchMachines);
        this.nativeUpdateSync = new InvalidateSync(this.fetchNativeUpdate);
        this.artifactsSync = new InvalidateSync(this.fetchArtifactsList);
        this.friendsSync = new InvalidateSync(this.fetchFriends);
        this.friendRequestsSync = new InvalidateSync(this.fetchFriendRequests);
        this.feedSync = new InvalidateSync(this.fetchFeed);

        const registerPushToken = async () => {
            await this.registerPushToken();
        }
        this.pushTokenSync = new InvalidateSync(registerPushToken);
        this.activityAccumulator = new ActivityUpdateAccumulator(this.flushActivityUpdates.bind(this), 2000);

        // Listen for app state changes to refresh purchases
        AppState.addEventListener('change', (nextAppState) => {
            this.appState = nextAppState;

            // Notify server of focus state for push notification routing.
            // Mobile: AppState.currentState reflects fg/bg directly.
            // Web/desktop: visibilitychange/focus listeners below drive this same path
            // by updating this.appState too — re-derive via getCurrentAppState() so
            // the wire value matches what the server uses for suppression.
            apiSocket.sendAppState(getCurrentAppState());

            if (nextAppState === 'active') {
                const shouldFailAfterResume = this.backgroundSendStartedAt !== null
                    && this.hasPendingOutboxMessages()
                    && (Date.now() - this.backgroundSendStartedAt) >= Sync.BACKGROUND_SEND_TIMEOUT_MS;
                void this.cancelBackgroundSendTimeoutNotification();
                this.clearBackgroundSendWatchdog();
                if (shouldFailAfterResume) {
                    void this.notifyMessageSendFailed();
                    this.failPendingOutboxMessages('Message failed to send in background after 30s. Please retry.');
                }
                log.log('📱 App became active');
                this.purchasesSync.invalidate();
                this.profileSync.invalidate();
                this.machinesSync.invalidate();
                this.pushTokenSync.invalidate();
                this.sessionsSync.invalidate();
                this.nativeUpdateSync.invalidate();
                log.log('📱 App became active: Invalidating artifacts sync');
                this.artifactsSync.invalidate();
                this.friendsSync.invalidate();
                this.friendRequestsSync.invalidate();
                this.feedSync.invalidate();

                // Refresh the open chat's message log on resume. While the app is
                // backgrounded the data socket is suspended/dropped, so any messages
                // the agent produced while away arrive with no live `update` to apply
                // them. The invalidations above only refresh the session LIST, not the
                // viewing session's messages — without this the visible chat stays
                // stale until the user leaves and re-enters it (it only re-fetches on a
                // fresh SessionView mount). getMessagesSync does a bounded forward sync;
                // if the socket hasn't reconnected yet, InvalidateSync's backoff retries
                // until it has.
                const resumeViewingSessionId = storage.getState().currentViewingSessionId;
                if (resumeViewingSessionId) {
                    this.onSessionVisible(resumeViewingSessionId);
                }
            } else {
                log.log(`📱 App state changed to: ${nextAppState}`);
                this.maybeStartBackgroundSendWatchdog();
            }
        });

        // Web/desktop: AppState alone doesn't capture tab focus/visibility.
        // Notify server when the tab becomes hidden, regains visibility,
        // or window focus changes — so push routing can suppress only when
        // the user is actually looking at this client.
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const broadcast = () => {
                apiSocket.sendAppState(getCurrentAppState());
            };
            document.addEventListener('visibilitychange', broadcast);
            window.addEventListener('focus', broadcast);
            window.addEventListener('blur', broadcast);
        }
    }

    async create(credentials: AuthCredentials, encryption: Encryption) {
        this.sessionAvatars.clear();
        this.credentials = credentials;
        this.encryption = encryption;
        this.anonID = encryption.anonID;
        this.serverID = parseToken(credentials.token);
        relayCache.open(cacheAccountKey(getServerUrl(), this.serverID));
        await this.#init();

        // Await settings sync to have fresh settings
        await this.settingsSync.awaitQueue();

        // Await profile sync to have fresh profile
        await this.profileSync.awaitQueue();

        // Await purchases sync to have fresh purchases
        await this.purchasesSync.awaitQueue();
    }

    async restore(credentials: AuthCredentials, encryption: Encryption) {
        this.sessionAvatars.clear();
        // NOTE: No awaiting anything here, we're restoring from a disk (ie app restarted)
        // Purchases sync is invalidated in #init() and will complete asynchronously
        this.credentials = credentials;
        this.encryption = encryption;
        this.anonID = encryption.anonID;
        this.serverID = parseToken(credentials.token);
        relayCache.open(cacheAccountKey(getServerUrl(), this.serverID));
        await this.#init();
    }

    async #init() {

        // Subscribe to updates
        this.subscribeToUpdates();

        // Sync initial PostHog opt-out state with stored settings
        if (tracking) {
            const currentSettings = storage.getState().settings;
            if (currentSettings.analyticsOptOut) {
                tracking.optOut();
            } else {
                tracking.optIn();
            }
        }

        // Show what the last run kept (sessions, machines, projects) while the
        // network is asked. It runs beside the fetches below rather than before
        // them: whichever lands later, the network's copy is the one that stays.
        void this.seedListsFromCache().then((seeded) => {
            if (seeded) storage.getState().applyReady();
        });

        // Invalidate sync
        log.log('🔄 #init: Invalidating all syncs');
        this.sessionsSync.invalidate();
        this.settingsSync.invalidate();
        this.profileSync.invalidate();
        this.purchasesSync.invalidate();
        this.machinesSync.invalidate();
        this.pushTokenSync.invalidate();
        this.nativeUpdateSync.invalidate();
        this.friendsSync.invalidate();
        this.friendRequestsSync.invalidate();
        this.artifactsSync.invalidate();
        this.feedSync.invalidate();
        log.log('🔄 #init: All syncs invalidated, including artifacts');

        // Mark UI ready as soon as sessions load (from the cache above, or
        // else from the network). Machines sync may hang
        // when encryption keys are unavailable (e.g. V1 auth fallback) —
        // let it resolve in the background instead of blocking the UI.
        this.sessionsSync.awaitQueue().then(() => {
            storage.getState().applyReady();
        }).catch((error) => {
            console.error('Failed to load sessions:', error);
            // Still mark ready so the UI doesn't stay on a blank screen forever
            storage.getState().applyReady();
        });
    }


    /**
     * Applies the session list, machines and project records the last run
     * kept, through the same decrypt path as the network's. True when a
     * session list was there to show. A failure only means the start waits
     * for the network, as it always did.
     */
    private seedListsFromCache = async (): Promise<boolean> => {
        const sessions = relayCache.listRead<ApiSessionRecord[]>('sessions');
        if (!Array.isArray(sessions)) return false;
        try {
            const applied = await this.applySessionRecords(sessions, storage.getState().sessions, 'cache');
            if (!applied) return false;
            log.log(`📦 Seeded ${applied.length} sessions from the offline cache`);
        } catch (error) {
            console.warn('Failed to show cached sessions:', error);
            return false;
        }
        // Machines and projects fill in behind the list; neither is awaited by the UI.
        const machines = relayCache.listRead<ApiMachineRecord[]>('machines');
        if (Array.isArray(machines)) {
            void this.applyMachineRecords(machines, 'cache').catch((error) => console.warn('Failed to show cached machines:', error));
        }
        const projects = relayCache.listRead<ApiProjectRecord[]>('projects');
        if (Array.isArray(projects)) {
            void this.applyProjectRecords(projects, 'cache').catch((error) => console.warn('Failed to show cached projects:', error));
        }
        return true;
    }

    /**
     * After the network's first session list: sessions shown from the cache
     * that it should have had but does not were deleted while the app was
     * closed, so they leave the screen as a fresh start would never have
     * shown them. The list holds only the newest sessions, so one older than
     * all of a full list's is kept (see sessionListRetention.ts), and so is
     * one a live event named while the list was fetched.
     */
    private pruneCacheSeededSessions = (sessions: readonly ApiSessionRecord[], protectedIds: ReadonlySet<string>) => {
        const seeded = this.cacheSeededSessions;
        this.cacheSeededSessions = null;
        if (!seeded) return;
        const known = [...seeded].map(([id, updatedAt]) => ({ id, updatedAt }));
        for (const { id: sessionId } of sessionsLeftOut(sessions, known, protectedIds).gone) {
            this.sessionAvatars.cancel(sessionId);
            storage.getState().deleteSession(sessionId);
            this.encryption.removeSessionEncryption(sessionId);
        }
    }

    /** Notes a session a live socket event named (see fetchSessions). */
    private noteLiveSession = (sessionId: string) => {
        this.liveSessionTicks.set(sessionId, ++this.liveSessionTick);
    }

    /** Sessions a live event named after `tick`. */
    private liveSessionsSince = (tick: number): Set<string> => {
        const ids = new Set<string>();
        for (const [sessionId, at] of this.liveSessionTicks) if (at > tick) ids.add(sessionId);
        return ids;
    }

    onSessionVisible = (sessionId: string) => {
        releaseSpawnedSession(sessionId);
        this.historyPrefetchSessions.add(sessionId);
        this.refreshSessionData(sessionId);
        // Also cover focus arriving while the speculative first page is still
        // being decrypted. Revalidate first so a newer ExitPlanMode can cancel
        // the deferred transition before activation consumes it once.
        void this.getMessagesSync(sessionId).awaitQueue().then(() => this.activatePreloadedPlanMode(sessionId));

        this.notifyVoiceSessionFocus(sessionId);
    }

    private notifyVoiceSessionFocus = (sessionId: string) => {
        const session = storage.getState().sessions[sessionId];
        if (session) {
            voiceHooks.onSessionFocus(sessionId, session.metadata || undefined);
        }
    }

    private refreshSessionData = (sessionId: string) => {
        this.getMessagesSync(sessionId).invalidate();

        // Also invalidate git status sync for this session
        gitStatusSync.getSync(sessionId).invalidate();
    }

    private onSessionDataUpdated = (sessionId: string) => {
        this.refreshSessionData(sessionId);
        // Preserve existing voice-follow behavior for actual server events.
        // Unlike a user visit, these must not opt a session into full history.
        this.notifyVoiceSessionFocus(sessionId);
    }

    preloadSession = (sessionId: string) => {
        this.messagePreloader.preload(sessionId);
    }

    private activatePreloadedPlanMode = (sessionId: string) => {
        if (!this.preloadedPlanModes.has(sessionId)) return;
        const previousMode = this.preloadedPlanModes.get(sessionId);
        this.preloadedPlanModes.delete(sessionId);
        const session = storage.getState().sessions[sessionId];
        // Do not replay history over a mode chosen since the preload.
        if (session && session.permissionMode === previousMode) {
            sessionSetAgentModes(sessionId, { permissionMode: 'plan' });
        }
    }

    private preloadLatestPage = async (sessionId: string, signal: AbortSignal): Promise<boolean> => {
        const lock = this.getSessionMessageLock(sessionId);
        return lock.inLock(async () => {
            // Recheck inside the shared lock: normal sync or a previous touch
            // may have already populated the cache while this request waited.
            const encryption = this.encryption?.getSessionEncryption(sessionId);
            if (signal.aborted || !encryption || !storage.getState().sessions[sessionId]
                || this.sessionSeq.has(sessionId)) {
                return false;
            }
            const cachedSettledSeq = await this.restoreCachedMessages(sessionId, encryption, signal);
            if (cachedSettledSeq === undefined) {
                await this.fetchInitialLatestPage(sessionId, encryption, signal);
                storage.getState().applyMessagesLoaded(sessionId);
            } else {
                // Shown from the cache already; the network only adds what is newer.
                storage.getState().applyMessagesLoaded(sessionId);
                await this.fetchForwardSince(sessionId, encryption, cachedSettledSeq, signal);
            }
            return true;
        });
    }

    private getMessagesSync(sessionId: string): InvalidateSync {
        let sync = this.messagesSync.get(sessionId);
        if (!sync) {
            sync = new InvalidateSync(() => this.fetchMessages(sessionId));
            this.messagesSync.set(sessionId, sync);
        }
        return sync;
    }

    private getSendSync(sessionId: string): InvalidateSync {
        let sync = this.sendSync.get(sessionId);
        if (!sync) {
            sync = new InvalidateSync(() => this.flushOutbox(sessionId));
            this.sendSync.set(sessionId, sync);
        }
        return sync;
    }

    private enqueueMessages(sessionId: string, messages: NormalizedMessage[]) {
        if (messages.length === 0) {
            return;
        }

        let queue = this.sessionMessageQueue.get(sessionId);
        if (!queue) {
            queue = [];
            this.sessionMessageQueue.set(sessionId, queue);
        }
        queue.push(...messages);

        this.scheduleQueuedMessagesProcessing(sessionId);
    }

    private getSessionMessageLock(sessionId: string): AsyncLock {
        let lock = this.sessionMessageLocks.get(sessionId);
        if (!lock) {
            lock = new AsyncLock();
            this.sessionMessageLocks.set(sessionId, lock);
        }
        return lock;
    }

    private scheduleQueuedMessagesProcessing(sessionId: string) {
        if (this.sessionQueueProcessing.has(sessionId)) {
            return;
        }

        this.sessionQueueProcessing.add(sessionId);
        const lock = this.getSessionMessageLock(sessionId);
        void lock.inLock(() => {
            while (true) {
                const pending = this.sessionMessageQueue.get(sessionId);
                if (!pending || pending.length === 0) {
                    break;
                }
                const batch = pending.splice(0, pending.length);
                this.applyMessages(sessionId, batch);
            }
        }).finally(() => {
            this.sessionQueueProcessing.delete(sessionId);
            const pending = this.sessionMessageQueue.get(sessionId);
            if (pending && pending.length > 0) {
                this.scheduleQueuedMessagesProcessing(sessionId);
            }
        });
    }

    private hasPendingOutboxMessages() {
        if (this.sendAbortControllers.size > 0) {
            return true;
        }
        for (const messages of this.pendingOutbox.values()) {
            if (messages.length > 0) {
                return true;
            }
        }
        return false;
    }

    private maybeStartBackgroundSendWatchdog() {
        if (Platform.OS === 'web' || this.appState === 'active') {
            return;
        }
        if (!this.hasPendingOutboxMessages() || this.backgroundSendTimeout) {
            return;
        }

        log.log('📨 Pending messages detected in background. Starting 30s send watchdog.');
        this.backgroundSendStartedAt = Date.now();
        this.backgroundSendTimeout = setTimeout(() => {
            this.backgroundSendTimeout = null;
            void this.handleBackgroundSendTimeout();
        }, Sync.BACKGROUND_SEND_TIMEOUT_MS);
        void this.scheduleBackgroundSendTimeoutNotification();
    }

    private clearBackgroundSendWatchdog() {
        if (this.backgroundSendTimeout) {
            clearTimeout(this.backgroundSendTimeout);
            this.backgroundSendTimeout = null;
        }
        this.backgroundSendStartedAt = null;
    }

    private async scheduleBackgroundSendTimeoutNotification() {
        if (Platform.OS === 'web' || this.backgroundSendNotificationId) {
            return;
        }
        try {
            this.backgroundSendNotificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Message not sent',
                    body: 'A message is still sending in the background. It will fail in 30 seconds if not delivered.',
                    sound: true
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: Math.ceil(Sync.BACKGROUND_SEND_TIMEOUT_MS / 1000)
                }
            });
        } catch (error) {
            log.log(`Failed to schedule background send timeout notification: ${error}`);
        }
    }

    private async cancelBackgroundSendTimeoutNotification() {
        if (!this.backgroundSendNotificationId) {
            return;
        }
        try {
            await Notifications.cancelScheduledNotificationAsync(this.backgroundSendNotificationId);
        } catch (error) {
            log.log(`Failed to cancel background send timeout notification: ${error}`);
        } finally {
            this.backgroundSendNotificationId = null;
        }
    }

    private async notifyMessageSendFailed() {
        if (Platform.OS === 'web') {
            return;
        }
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Message failed',
                    body: 'A message failed to send while the app was in background. Open KissOpen and retry.',
                    sound: true
                },
                trigger: null
            });
        } catch (error) {
            log.log(`Failed to schedule message failure notification: ${error}`);
        }
    }

    private failPendingOutboxMessages(reasonText: string) {
        for (const controller of this.sendAbortControllers.values()) {
            controller.abort();
        }
        this.sendAbortControllers.clear();

        const now = Date.now();
        const sessionIds: string[] = [];
        for (const [sessionId, pending] of this.pendingOutbox) {
            if (pending.length === 0) {
                continue;
            }
            pending.length = 0;
            this.pendingOutbox.delete(sessionId);
            sessionIds.push(sessionId);
        }

        for (const sessionId of sessionIds) {
            this.enqueueMessages(sessionId, [{
                id: randomUUID(),
                localId: null,
                createdAt: now,
                role: 'event',
                isSidechain: false,
                content: {
                    type: 'message',
                    message: reasonText
                }
            }]);
        }
    }

    private async handleBackgroundSendTimeout() {
        if (!this.hasPendingOutboxMessages()) {
            await this.cancelBackgroundSendTimeoutNotification();
            this.backgroundSendStartedAt = null;
            return;
        }

        await this.cancelBackgroundSendTimeoutNotification();
        await this.notifyMessageSendFailed();
        this.failPendingOutboxMessages('Message failed to send in background after 30s. Please retry.');
        this.backgroundSendStartedAt = null;
    }

    /**
     * Upload image attachments for a session: read bytes → encrypt → upload to server.
     * Returns UploadedAttachment records to embed as file events before the text message.
     * Failures are logged and skipped rather than aborting the whole message send.
     */
    private async uploadAttachmentsForSession(
        sessionId: string,
        attachments: AttachmentPreview[],
    ): Promise<{ uploaded: UploadedAttachment[]; failed: number }> {
        if (!this.credentials) return { uploaded: [], failed: attachments.length };

        const blobKey = this.encryption.getSessionBlobKey(sessionId);
        if (!blobKey) {
            console.error(`[attachments] No blob key for session ${sessionId}`);
            return { uploaded: [], failed: attachments.length };
        }

        const uploaded: UploadedAttachment[] = [];
        let failed = 0;

        for (const attachment of attachments) {
            try {
                const bytes = await readFileBytes(attachment.uri);
                const encrypted = encryptBlob(bytes, blobKey);

                const upload = await requestAttachmentUpload(
                    this.credentials,
                    sessionId,
                    attachment.name,
                    encrypted.length,
                );

                await uploadEncryptedBlob(upload, encrypted, this.credentials);
                const { ref } = upload;

                uploaded.push({
                    ref,
                    name: attachment.name,
                    size: attachment.size,
                    width: attachment.width,
                    height: attachment.height,
                    thumbhash: attachment.thumbhash,
                });
            } catch (err) {
                const diagnostic = getAttachmentDiagnostic(err);
                if (diagnostic) {
                    console.error('[attachments] Failed to upload image attachment:', formatAttachmentDiagnosticForLog(diagnostic, {
                        platform: Platform.OS,
                        client: getKissopenClientId(),
                    }));
                } else {
                    const message = errorMessageFromUnknown(err);
                    console.error('[attachments] Failed to upload image attachment:', {
                        leg: 'blob-upload',
                        message,
                        platform: Platform.OS,
                        client: getKissopenClientId(),
                    });
                }
                failed++;
                // Skip this attachment; do not abort the whole message send.
            }
        }

        return { uploaded, failed };
    }

    /** A visible row alone is not enough to place a message safely. */
    async ensureSessionReady(sessionId: string): Promise<void> {
        const isReady = () => !!(storage.getState().sessions[sessionId]?.metadata
            && this.encryption.getSessionEncryption(sessionId)
            && this.encryption.getSessionBlobKey(sessionId));
        for (let attempt = 0; !isReady() && attempt < 3; attempt++) {
            if (attempt > 0) await delay(300 * attempt);
            // The shared sync retries network failures indefinitely. Keep the
            // existing send budget, and require both the row and its own key.
            await Promise.race([this.sessionsSync.invalidateAndAwait(), delay(4000)]);
        }
        if (!isReady()) {
            throw new Error('The message was not sent: this session has not finished syncing. Please try again.');
        }
    }

    /** True means accepted into the outbox, not necessarily delivered to the agent. */
    async sendMessage(sessionId: string, text: string, options?: SendMessageOptions): Promise<boolean> {
        const accountEncryption = this.encryption;
        const canSend = () => !options?.signal?.aborted && this.encryption === accountEncryption
            && (options?.isCurrent?.() ?? true);
        if (!canSend()) return false;
        try {
            await this.ensureSessionReady(sessionId);
        } catch (error) {
            if (!canSend()) return false;
            Modal.alert(t('common.error'), error instanceof Error ? error.message : 'Failed to sync session');
            return false;
        }
        if (!canSend()) return false;
        const encryption = this.encryption.getSessionEncryption(sessionId)!;
        const session = storage.getState().sessions[sessionId];

        let modeMeta: ReturnType<typeof resolveMessageModeMeta>;
        try {
            modeMeta = resolveMessageModeMeta(session, storage.getState().settings);
        } catch (error) {
            if (error instanceof UnsupportedPermissionModeError) {
                // Refuse loudly instead of substituting a mode: swapping in a
                // default would silently change what the agent may do.
                Modal.alert(t('common.error'), error.message);
                return false;
            }
            throw error;
        }
        const { displayText, source = 'chat', attachments, awaitDelivery = false } = options ?? {};

        const flavor = session.metadata?.flavor;
        const rigAttachmentPolicy = isRigMetadataV1(session.metadata)
            ? session.metadata?.capabilities?.attachments
            : null;
        const attachmentPlan = getImageAttachmentSendPlan({
            flavor,
            text,
            attachmentCount: attachments?.length ?? 0,
            supportsAttachments: isRigMetadataV1(session.metadata)
                ? rigCanUseAttachments(session.metadata)
                : undefined,
        });
        const effectiveAttachments = attachmentPlan.shouldUseAttachments
            ? (rigAttachmentPolicy
                ? attachments?.filter((attachment) => isAttachmentAllowedByPolicy(attachment, rigAttachmentPolicy))
                : attachments)
            : undefined;
        const rejectedByRigPolicy = isRigMetadataV1(session.metadata)
            && (attachments?.length ?? 0) > (effectiveAttachments?.length ?? 0);

        if (attachmentPlan.shouldShowUnsupportedAlert || rejectedByRigPolicy) {
            Modal.alert(
                t('imageUpload.notSupportedTitle'),
                t('imageUpload.notSupportedMessage'),
                [{ text: t('common.ok'), style: 'cancel' }],
            );
            if (!attachmentPlan.shouldSendText || (!text.trim() && (effectiveAttachments?.length ?? 0) === 0)) {
                return false;
            }
        }

        // Stage all records first. Cancellation/encryption failure must not
        // leave file events in the outbox for a retry to send twice.
        const stagedAttachments: { pending: OutboxMessage; normalized: NormalizedMessage | null }[] = [];
        if (effectiveAttachments && effectiveAttachments.length > 0) {
            const { uploaded, failed } = await this.uploadAttachmentsForSession(sessionId, effectiveAttachments);

            if (failed > 0) {
                Modal.alert(
                    t('imageUpload.uploadFailedTitle'),
                    t('imageUpload.uploadFailedMessage', { count: failed }),
                    [{ text: t('common.ok'), style: 'cancel' }],
                );
            }

            if (uploaded.length > 0) {
                for (const att of uploaded) {
                    const fileRecord: RawRecord = {
                        role: 'session',
                        content: {
                            type: 'session',
                            data: {
                                id: randomUUID(),
                                time: Date.now(),
                                role: 'user',
                                ev: {
                                    t: 'file',
                                    ref: att.ref,
                                    name: att.name,
                                    size: att.size,
                                    // Include image metadata when we have dimensions; thumbhash is
                                    // optional. The native iOS picker can't generate a thumbhash
                                    // without Canvas, so requiring it here would reduce the chat
                                    // bubble to a compact filename row instead of an inline picture.
                                    // FileView only needs w/h to size the inline render — placeholder
                                    // is absent, but the real image is decrypted on mount.
                                    ...(att.width > 0 && att.height > 0
                                        ? {
                                            image: {
                                                width: att.width,
                                                height: att.height,
                                                ...(att.thumbhash ? { thumbhash: att.thumbhash } : {}),
                                            },
                                        }
                                        : {}),
                                },
                            },
                        },
                    };
                    const encryptedFileRecord = await encryption.encryptRawRecord(fileRecord);
                    const fileLocalId = randomUUID();
                    const fileNormalized = normalizeRawMessage(fileLocalId, fileLocalId, Date.now(), fileRecord);
                    stagedAttachments.push({
                        pending: { kind: 'attachment', localId: fileLocalId, content: encryptedFileRecord },
                        normalized: fileNormalized,
                    });
                }
            }
        }

        // Generate local ID
        const localId = randomUUID();

        // Determine sentFrom based on platform
        let sentFrom: string;
        if (Platform.OS === 'web') {
            sentFrom = 'web';
        } else if (Platform.OS === 'android') {
            sentFrom = 'android';
        } else if (Platform.OS === 'ios') {
            // Check if running on Mac (Catalyst or Designed for iPad on Mac)
            if (isRunningOnMac()) {
                sentFrom = 'mac';
            } else {
                sentFrom = 'ios';
            }
        } else {
            sentFrom = 'web'; // fallback
        }

        // Create user message content with metadata
        const content: RawRecord = {
            role: 'user',
            content: {
                type: 'text',
                text
            },
            meta: {
                sentFrom,
                ...(rigSendsMessageReceipts(session.metadata) ? { expectsAcceptance: true } : {}),
                appendSystemPrompt: systemPrompt,
                ...(modeMeta.permissionMode !== undefined ? { permissionMode: modeMeta.permissionMode } : {}),
                ...(modeMeta.model !== undefined ? { model: modeMeta.model } : {}),
                ...(modeMeta.modelProviderId !== undefined ? { modelProviderId: modeMeta.modelProviderId } : {}),
                ...(modeMeta.effort !== undefined ? { effort: modeMeta.effort } : {}),
                ...(displayText && { displayText }) // Add displayText if provided
            }
        };
        const encryptedRawRecord = await encryption.encryptRawRecord(content);

        // No await between this check and acceptance. A navigation, account
        // change, deletion, or Stop must never redirect or replay this send.
        if (!canSend()
            || !storage.getState().sessions[sessionId]
            || this.encryption.getSessionEncryption(sessionId) !== encryption) return false;

        for (const attachment of stagedAttachments) {
            if (attachment.normalized) this.enqueueMessages(sessionId, [attachment.normalized]);
        }

        // Add to messages - normalize the raw record
        const createdAt = Date.now();
        const normalizedMessage = normalizeRawMessage(localId, localId, createdAt, content);
        if (normalizedMessage) {
            this.enqueueMessages(sessionId, [normalizedMessage]);
        }

        let pending = this.pendingOutbox.get(sessionId);
        if (!pending) {
            pending = [];
            this.pendingOutbox.set(sessionId, pending);
        }
        pending.push(...stagedAttachments.map(attachment => attachment.pending), {
            kind: 'user',
            localId,
            content: encryptedRawRecord
        });
        releaseSpawnedSession(sessionId);
        options?.onAccepted?.();
        trackMessageSent(source, session.metadata);

        // Stamp local activity time so the (opt-in) activity sort bubbles this session
        // up on user action only — not on background agent output.
        storage.getState().markSessionMessageSent(sessionId);

        if (awaitDelivery) {
            await this.getSendSync(sessionId).invalidateAndAwait();
        } else {
            this.getSendSync(sessionId).invalidate();
        }
        this.maybeStartBackgroundSendWatchdog();
        return true;
    }

    /** Server sent us settings — merge any pending local changes on top, then apply as one update. */
    private applyServerSettings = (serverSettings: Settings, version: number) => {
        const merged = Object.keys(this.pendingSettings).length > 0
            ? applySettings(serverSettings, this.pendingSettings)
            : serverSettings;
        storage.getState().applySettings(merged, version);
    }

    applySettings = (delta: Partial<Settings>) => {
        storage.getState().applySettingsLocal(delta);

        // Save pending settings
        this.pendingSettings = { ...this.pendingSettings, ...delta };
        savePendingSettings(this.pendingSettings);

        // Sync PostHog opt-out state if it was changed
        if (tracking && 'analyticsOptOut' in delta) {
            const currentSettings = storage.getState().settings;
            if (currentSettings.analyticsOptOut) {
                tracking.optOut();
            } else {
                tracking.optIn();
            }
        }

        // Invalidate settings sync
        this.settingsSync.invalidate();
    }

    refreshPurchases = () => {
        this.purchasesSync.invalidate();
    }

    refreshProfile = async () => {
        await this.profileSync.invalidateAndAwait();
    }

    purchaseProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            // Check if RevenueCat is initialized
            if (!this.revenueCatInitialized) {
                return { success: false, error: 'RevenueCat not initialized' };
            }

            // Fetch the product
            const products = await RevenueCat.getProducts([productId]);
            if (products.length === 0) {
                return { success: false, error: `Product '${productId}' not found` };
            }

            // Purchase the product
            const product = products[0];
            const { customerInfo } = await RevenueCat.purchaseStoreProduct(product);

            // Update local purchases data
            storage.getState().applyPurchases(customerInfo);

            return { success: true };
        } catch (error: any) {
            // Check if user cancelled
            if (error.userCancelled) {
                return { success: false, error: 'Purchase cancelled' };
            }

            // Return the error message
            return { success: false, error: error.message || 'Purchase failed' };
        }
    }

    getOfferings = async (): Promise<{ success: boolean; offerings?: any; error?: string }> => {
        try {
            // Check if RevenueCat is initialized
            if (!this.revenueCatInitialized) {
                return { success: false, error: 'RevenueCat not initialized' };
            }

            // Fetch offerings
            const offerings = await RevenueCat.getOfferings();

            // Return the offerings data
            return {
                success: true,
                offerings: {
                    current: offerings.current,
                    all: offerings.all
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to fetch offerings' };
        }
    }

    presentPaywall = async (flow?: string): Promise<{ success: boolean; purchased?: boolean; error?: string }> => {
        try {
            // Check if RevenueCat is initialized
            if (!this.revenueCatInitialized) {
                const error = 'RevenueCat not initialized';
                trackPaywallError(error, flow);
                return { success: false, error };
            }

            // Track paywall presentation
            trackPaywallPresented(flow);

            // Present the paywall (with flow custom variable if specified)
            const result = await RevenueCat.presentPaywall(
                flow ? { customVariables: { flow } } : undefined
            );

            // Handle the result
            switch (result) {
                case PaywallResult.PURCHASED:
                    trackPaywallPurchased(flow);
                    // Refresh customer info after purchase
                    await this.syncPurchases();
                    return { success: true, purchased: true };
                case PaywallResult.RESTORED:
                    trackPaywallRestored(flow);
                    // Refresh customer info after restore
                    await this.syncPurchases();
                    return { success: true, purchased: true };
                case PaywallResult.CANCELLED:
                    trackPaywallCancelled(flow);
                    return { success: true, purchased: false };
                case PaywallResult.NOT_PRESENTED:
                    trackPaywallError('Paywall not presented', flow);
                    return { success: false, error: 'Paywall not available on this platform' };
                case PaywallResult.ERROR:
                default:
                    const errorMsg = 'Failed to present paywall';
                    trackPaywallError(errorMsg, flow);
                    return { success: false, error: errorMsg };
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to present paywall';
            trackPaywallError(errorMessage, flow);
            return { success: false, error: errorMessage };
        }
    }

    async assumeUsers(userIds: string[]): Promise<void> {
        if (!this.credentials || userIds.length === 0) return;
        
        const state = storage.getState();
        // Filter out users we already have in cache (including null for 404s)
        const missingIds = userIds.filter(id => !(id in state.users));
        
        if (missingIds.length === 0) return;
        
        log.log(`👤 Fetching ${missingIds.length} missing users...`);
        
        // Fetch missing users in parallel
        const results = await Promise.all(
            missingIds.map(async (id) => {
                try {
                    const profile = await getUserProfile(this.credentials!, id);
                    return { id, profile };  // profile is null if 404
                } catch (error) {
                    console.error(`Failed to fetch user ${id}:`, error);
                    return { id, profile: null };  // Treat errors as 404
                }
            })
        );
        
        // Convert to Record<string, UserProfile | null>
        const usersMap: Record<string, UserProfile | null> = {};
        results.forEach(({ id, profile }) => {
            usersMap[id] = profile;
        });
        
        storage.getState().applyUsers(usersMap);
        log.log(`👤 Applied ${results.length} users to cache (${results.filter(r => r.profile).length} found, ${results.filter(r => !r.profile).length} not found)`);
    }

    //
    // Private
    //

    private clearProjectAvatarCache(projectId: string): void {
        const prefix = `${projectId}:`;
        for (const key of this.projectAvatarCache.keys()) {
            if (key.startsWith(prefix)) this.projectAvatarCache.delete(key);
        }
        for (const key of this.projectAvatarInFlight.keys()) {
            if (key.startsWith(prefix)) this.projectAvatarInFlight.delete(key);
        }
        this.projectAvatarGenerations.set(
            projectId,
            (this.projectAvatarGenerations.get(projectId) ?? 0) + 1,
        );
    }

    private hydrateProjectAvatar = async (record: DecryptedProjectRecord): Promise<void> => {
        const descriptor = record.avatar;
        if (!descriptor || !this.credentials) return;

        const projectId = record.project.id;
        const cacheKey = `${projectId}:${avatarDescriptorKey(descriptor)}`;
        const generation = this.projectAvatarGenerations.get(projectId) ?? 0;
        const cached = this.projectAvatarCache.get(cacheKey);
        if (cached) {
            storage.getState().applyProjectAvatar(projectId, cached);
            return;
        }

        const existing = this.projectAvatarInFlight.get(cacheKey);
        if (existing) {
            await existing;
            return;
        }

        let blobKey: Uint8Array;
        try {
            blobKey = await this.encryption.getProjectBlobKey(record.dataKey);
        } catch {
            return;
        }
        const request = loadProjectAvatar(
            this.credentials,
            projectId,
            descriptor,
            blobKey,
        );
        this.projectAvatarInFlight.set(cacheKey, request);

        try {
            const avatar = await request;
            // A project/avatar event can arrive while the object URL is being
            // downloaded. Do not let an old ciphertext win that race.
            const currentKey = this.projectDataKeys.get(projectId);
            const currentGeneration = this.projectAvatarGenerations.get(projectId) ?? 0;
            if (!avatar || currentGeneration !== generation || !sameBytes(currentKey, record.dataKey)) {
                return;
            }

            this.projectAvatarCache.set(cacheKey, avatar);
            storage.getState().applyProjectAvatar(projectId, avatar);
        } finally {
            if (this.projectAvatarInFlight.get(cacheKey) === request) {
                this.projectAvatarInFlight.delete(cacheKey);
            }
        }
    };

    private fetchProjects = async (): Promise<void> => {
        if (!this.credentials) return;

        const projectIds = [...new Set(Object.values(storage.getState().sessions)
            .map((session) => session.projectId)
            .filter((projectId): projectId is string => typeof projectId === 'string' && projectId.length > 0))];
        const records = await fetchProjectRecords(this.credentials, projectIds);
        const decryptedRecords = await this.applyProjectRecords(records, 'network');
        if (!decryptedRecords) return;
        // Kept as the server sent them (still encrypted) for the next start.
        relayCache.listWrite('projects', records);

        // Artwork is deliberately hydrated after the encrypted catalog is
        // visible. A failed avatar download leaves the project name usable and
        // the Avatar component falls back to its brutalist identity.
        await Promise.all(decryptedRecords.map((record) => this.hydrateProjectAvatar(record)));
    };

    /**
     * Decrypts project records and applies them to the store: the network's,
     * or the copy relayCache kept (null when the network's has landed since).
     * Artwork is left to the caller.
     */
    private applyProjectRecords = async (records: readonly ApiProjectRecord[], source: ListSource): Promise<DecryptedProjectRecord[] | null> => {
        if (source === 'cache' && this.listsFromNetwork.projects) return null;
        const decryptedRecords = (await Promise.all(records.map(async (record) => {
            try {
                return await decryptProjectRecord(record, this.encryption);
            } catch (error) {
                console.error(`Failed to decrypt project ${record.id}:`, error);
                return null;
            }
        }))).filter((record): record is DecryptedProjectRecord => record !== null);
        // The decrypts above yield; the network's records may have landed meanwhile.
        if (source === 'cache' && this.listsFromNetwork.projects) return null;
        if (source === 'network') this.listsFromNetwork.projects = true;

        const currentIds = new Set(decryptedRecords.map((record) => record.project.id));
        for (const projectId of this.projectDataKeys.keys()) {
            if (currentIds.has(projectId)) continue;
            this.projectDataKeys.delete(projectId);
            this.projectAvatarDescriptors.delete(projectId);
            this.clearProjectAvatarCache(projectId);
        }

        const expectedAvatarCacheKeys = new Set<string>();
        for (const record of decryptedRecords) {
            const projectId = record.project.id;
            const nextDescriptor = record.avatar ? avatarDescriptorKey(record.avatar) : null;
            const previousDescriptor = this.projectAvatarDescriptors.get(projectId) ?? null;
            if (previousDescriptor !== nextDescriptor) {
                this.clearProjectAvatarCache(projectId);
            }
            if (nextDescriptor) {
                this.projectAvatarDescriptors.set(projectId, nextDescriptor);
                expectedAvatarCacheKeys.add(`${projectId}:${nextDescriptor}`);
            } else {
                this.projectAvatarDescriptors.delete(projectId);
            }

            const previousKey = this.projectDataKeys.get(projectId);
            if (this.projectDataKeys.has(projectId) && !sameBytes(previousKey, record.dataKey)) {
                this.clearProjectAvatarCache(projectId);
            }
            this.projectDataKeys.set(projectId, record.dataKey);
        }

        // The referenced project snapshot is authoritative. Discard entries
        // for removed/changed descriptors before starting new downloads.
        for (const cacheKey of this.projectAvatarCache.keys()) {
            if (!expectedAvatarCacheKeys.has(cacheKey)) this.projectAvatarCache.delete(cacheKey);
        }

        storage.getState().applyProjects(decryptedRecords.map((record) => record.project), true);
        return decryptedRecords;
    };

    private fetchSessions = async () => {
        if (!this.credentials) return;
        const avatarsBeforeFetch = storage.getState().sessions;
        const liveTickAtStart = this.liveSessionTick;

        const API_ENDPOINT = getServerUrl();
        const response = await fetch(`${API_ENDPOINT}/v1/sessions`, {
            headers: {
                'Authorization': `Bearer ${this.credentials.token}`,
                'Content-Type': 'application/json',
                'X-KISSOPEN-Client': getKissopenClientId(),
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch sessions: ${response.status}`);
        }

        const data = await response.json();
        const sessions = data.sessions as ApiSessionRecord[];
        const decryptedSessions = (await this.applySessionRecords(sessions, avatarsBeforeFetch, 'network')) ?? [];

        // The server lists only its newest sessions. Older ones this phone
        // already knows were paged out, not deleted: they stay on screen, in
        // the list kept for the next start, and with their message logs.
        const protectedIds = this.liveSessionsSince(liveTickAtStart);
        const previous = relayCache.listRead<ApiSessionRecord[]>('sessions');
        const known = Array.isArray(previous)
            ? previous.filter((record) => !!record && typeof record.id === 'string' && typeof record.updatedAt === 'number')
            : [];
        const { pagedOut } = sessionsLeftOut(sessions, known, protectedIds);
        // Kept as the server sent it (still encrypted) for the next start.
        relayCache.listWrite('sessions', sessionListToCache(sessions, pagedOut));
        this.pruneCacheSeededSessions(sessions, protectedIds);
        // Asked once the log folder has been read: the sessions still on
        // screen (listed, paged out, or arrived live since) and those the
        // kept list names.
        const retainedIds = [...sessions, ...pagedOut].map((session) => session.id);
        void relayCache.messagesRetain(() => [...retainedIds, ...Object.keys(storage.getState().sessions)]);

        this.projectsSync.invalidate();
        log.log(`📥 fetchSessions completed - processed ${decryptedSessions.length} sessions`);
        // Machine-readable for scripts/perf-e2e.mjs, which deep-links through
        // the most recent real sessions and reads [perf] timings off Metro.
        const recent = [...decryptedSessions]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 12)
            .map((s) => s.id);
        console.log(`[perf] recent-sessions ${recent.join(',')}`);
    }

    /**
     * Decrypts a session list and applies it to the store: the network's, or
     * the copy relayCache kept. Returns the sessions applied, or null when a
     * cached list arrived after the network's and was dropped.
     */
    private applySessionRecords = async (
        sessions: readonly ApiSessionRecord[],
        avatarsBeforeFetch: Record<string, Session>,
        source: ListSource,
    ) => {
        if (source === 'cache' && this.listsFromNetwork.sessions) return null;

        // Initialize all session encryptions first
        const sessionKeys = new Map<string, Uint8Array | null>();
        for (const session of sessions) {
            if (session.dataEncryptionKey) {
                let decrypted = await this.encryption.decryptEncryptionKey(session.dataEncryptionKey);
                if (!decrypted) {
                    console.error(`Failed to decrypt data encryption key for session ${session.id}`);
                    continue;
                }
                sessionKeys.set(session.id, decrypted);
            } else {
                sessionKeys.set(session.id, null);
            }
        }
        await this.encryption.initializeSessions(sessionKeys);

        // Decrypt sessions
        let decryptedSessions: (Omit<Session, 'presence'> & { presence?: "online" | number })[] = [];
        for (const session of sessions) {
            // Get session encryption (should always exist after initialization)
            const sessionEncryption = this.encryption.getSessionEncryption(session.id);
            if (!sessionEncryption) {
                console.error(`Session encryption not found for ${session.id} - this should never happen`);
                continue;
            }

            // Decrypt metadata using session-specific encryption
            let metadata: Session['metadata'];
            let agentState: Session['agentState'];
            try {
                metadata = await sessionEncryption.decryptMetadata(session.metadataVersion, session.metadata);
                agentState = await sessionEncryption.decryptAgentState(session.agentStateVersion, session.agentState);
            } catch {
                // One malformed record must not prevent every valid session
                // (including a just-created one) from becoming visible.
                console.error(`Failed to decrypt session ${session.id}`);
                continue;
            }

            // Put it all together. Thinking placeholders are overwritten just
            // before applySessions below.
            const processedSession = {
                ...session,
                avatarDescriptor: sessionAvatarDescriptorSchema.safeParse(session.avatar).data ?? null,
                avatarRevision: sessionAvatarRevisionSchema.safeParse(session.avatarVersion).data,
                avatar: null,
                thinking: false,
                thinkingAt: 0,
                metadata,
                agentState
            };
            decryptedSessions.push(processedSession);
        }

        // The decrypts above yield; the network's list may have landed meanwhile.
        if (source === 'cache' && this.listsFromNetwork.sessions) return null;
        if (source === 'network') this.listsFromNetwork.sessions = true;
        // Set with the apply, so the network list that follows always sees it.
        if (source === 'cache') this.cacheSeededSessions = new Map(sessions.map((session) => [session.id, session.updatedAt]));

        // Thinking state exists only in activity ephemerals — the server
        // session record has no such field, so preserve whatever we already
        // know. Hardcoding false wipes the live state of every running session
        // on any full refetch (notably the one `new-session` triggers), which
        // both freezes the pulsing dot and trips the "agent just finished"
        // unread detector in applySessions. Two deliberate details:
        // - Resolved here, synchronously with the apply, rather than inside
        //   the decrypt loop above: the loop awaits per session, so a snapshot
        //   taken there can be overtaken by an activity ephemeral clearing
        //   thinking in the meantime.
        // - Gated on `active`: a dead session can never send the clearing
        //   ephemeral, so a preserved `true` would otherwise be immortal.
        const current = storage.getState().sessions;
        this.applySessions(decryptedSessions.map(s => ({
            ...s,
            // A cached record's `active` is only what was true when it was
            // kept; until the network's list lands the session counts as
            // offline, unless a live event has said otherwise since.
            ...(source === 'cache' ? { active: current[s.id]?.active ?? false } : {}),
            // A live replacement or removal received during this fetch wins over its snapshot.
            ...((current[s.id]?.avatarRevision !== undefined && s.avatarRevision !== undefined
                ? current[s.id].avatarRevision! > s.avatarRevision
                : current[s.id]?.avatarUpdateSeq !== avatarsBeforeFetch[s.id]?.avatarUpdateSeq)
                ? { avatarDescriptor: current[s.id]?.avatarDescriptor, avatar: current[s.id]?.avatar, avatarRevision: current[s.id]?.avatarRevision }
                : { avatar: sameSessionAvatar(s.avatarDescriptor, current[s.id]?.avatarDescriptor) ? current[s.id]?.avatar ?? null : null }),
            avatarUpdateSeq: current[s.id]?.avatarUpdateSeq,
            thinking: (source === 'cache' ? current[s.id]?.active : s.active) ? (current[s.id]?.thinking ?? false) : false,
            thinkingAt: (source === 'cache' ? current[s.id]?.active : s.active) ? (current[s.id]?.thinkingAt ?? 0) : 0,
        })));
        return decryptedSessions;
    }

    public refreshMachines = async () => {
        return this.fetchMachines();
    }

    public refreshSessions = async () => {
        return this.sessionsSync.invalidateAndAwait();
    }

    public getCredentials() {
        return this.credentials;
    }

    // Artifact methods
    public fetchArtifactsList = async (): Promise<void> => {
        log.log('📦 fetchArtifactsList: Starting artifact sync');
        if (!this.credentials) {
            log.log('📦 fetchArtifactsList: No credentials, skipping');
            return;
        }

        try {
            log.log('📦 fetchArtifactsList: Fetching artifacts from server');
            const artifacts = await fetchArtifacts(this.credentials);
            log.log(`📦 fetchArtifactsList: Received ${artifacts.length} artifacts from server`);
            const decryptedArtifacts: DecryptedArtifact[] = [];

            for (const artifact of artifacts) {
                try {
                    // Decrypt the data encryption key
                    const decryptedKey = await this.encryption.decryptEncryptionKey(artifact.dataEncryptionKey);
                    if (!decryptedKey) {
                        console.error(`Failed to decrypt key for artifact ${artifact.id}`);
                        continue;
                    }

                    // Store the decrypted key in memory
                    this.artifactDataKeys.set(artifact.id, decryptedKey);

                    // Create artifact encryption instance
                    const artifactEncryption = new ArtifactEncryption(decryptedKey);

                    // Decrypt header
                    const header = await artifactEncryption.decryptHeader(artifact.header);
                    
                    decryptedArtifacts.push({
                        id: artifact.id,
                        title: header?.title || null,
                        sessions: header?.sessions,  // Include sessions from header
                        draft: header?.draft,        // Include draft flag from header
                        body: undefined, // Body not loaded in list
                        headerVersion: artifact.headerVersion,
                        bodyVersion: artifact.bodyVersion,
                        seq: artifact.seq,
                        createdAt: artifact.createdAt,
                        updatedAt: artifact.updatedAt,
                        isDecrypted: !!header,
                    });
                } catch (err) {
                    console.error(`Failed to decrypt artifact ${artifact.id}:`, err);
                    // Add with decryption failed flag
                    decryptedArtifacts.push({
                        id: artifact.id,
                        title: null,
                        body: undefined,
                        headerVersion: artifact.headerVersion,
                        seq: artifact.seq,
                        createdAt: artifact.createdAt,
                        updatedAt: artifact.updatedAt,
                        isDecrypted: false,
                    });
                }
            }

            log.log(`📦 fetchArtifactsList: Successfully decrypted ${decryptedArtifacts.length} artifacts`);
            storage.getState().applyArtifacts(decryptedArtifacts);
            log.log('📦 fetchArtifactsList: Artifacts applied to storage');
        } catch (error) {
            log.log(`📦 fetchArtifactsList: Error fetching artifacts: ${error}`);
            console.error('Failed to fetch artifacts:', error);
            throw error;
        }
    }

    public async fetchArtifactWithBody(artifactId: string): Promise<DecryptedArtifact | null> {
        if (!this.credentials) return null;

        try {
            const artifact = await fetchArtifact(this.credentials, artifactId);

            // Decrypt the data encryption key
            const decryptedKey = await this.encryption.decryptEncryptionKey(artifact.dataEncryptionKey);
            if (!decryptedKey) {
                console.error(`Failed to decrypt key for artifact ${artifactId}`);
                return null;
            }

            // Store the decrypted key in memory
            this.artifactDataKeys.set(artifact.id, decryptedKey);

            // Create artifact encryption instance
            const artifactEncryption = new ArtifactEncryption(decryptedKey);

            // Decrypt header and body
            const header = await artifactEncryption.decryptHeader(artifact.header);
            const body = artifact.body ? await artifactEncryption.decryptBody(artifact.body) : null;

            return {
                id: artifact.id,
                title: header?.title || null,
                sessions: header?.sessions,  // Include sessions from header
                draft: header?.draft,        // Include draft flag from header
                body: body?.body || null,
                headerVersion: artifact.headerVersion,
                bodyVersion: artifact.bodyVersion,
                seq: artifact.seq,
                createdAt: artifact.createdAt,
                updatedAt: artifact.updatedAt,
                isDecrypted: !!header,
            };
        } catch (error) {
            console.error(`Failed to fetch artifact ${artifactId}:`, error);
            return null;
        }
    }

    public async createArtifact(
        title: string | null, 
        body: string | null,
        sessions?: string[],
        draft?: boolean
    ): Promise<string> {
        if (!this.credentials) {
            throw new Error('Not authenticated');
        }

        try {
            // Generate unique artifact ID
            const artifactId = this.encryption.generateId();

            // Generate data encryption key
            const dataEncryptionKey = ArtifactEncryption.generateDataEncryptionKey();
            
            // Store the decrypted key in memory
            this.artifactDataKeys.set(artifactId, dataEncryptionKey);
            
            // Encrypt the data encryption key with user's key
            const encryptedKey = await this.encryption.encryptEncryptionKey(dataEncryptionKey);
            
            // Create artifact encryption instance
            const artifactEncryption = new ArtifactEncryption(dataEncryptionKey);
            
            // Encrypt header and body
            const encryptedHeader = await artifactEncryption.encryptHeader({ title, sessions, draft });
            const encryptedBody = await artifactEncryption.encryptBody({ body });
            
            // Create the request
            const request: ArtifactCreateRequest = {
                id: artifactId,
                header: encryptedHeader,
                body: encryptedBody,
                dataEncryptionKey: encodeBase64(encryptedKey, 'base64'),
            };
            
            // Send to server
            const artifact = await createArtifact(this.credentials, request);
            
            // Add to local storage
            const decryptedArtifact: DecryptedArtifact = {
                id: artifact.id,
                title,
                sessions,
                draft,
                body,
                headerVersion: artifact.headerVersion,
                bodyVersion: artifact.bodyVersion,
                seq: artifact.seq,
                createdAt: artifact.createdAt,
                updatedAt: artifact.updatedAt,
                isDecrypted: true,
            };
            
            storage.getState().addArtifact(decryptedArtifact);
            
            return artifactId;
        } catch (error) {
            console.error('Failed to create artifact:', error);
            throw error;
        }
    }

    public async updateArtifact(
        artifactId: string, 
        title: string | null, 
        body: string | null,
        sessions?: string[],
        draft?: boolean
    ): Promise<void> {
        if (!this.credentials) {
            throw new Error('Not authenticated');
        }

        try {
            // Get current artifact to get versions and encryption key
            const currentArtifact = storage.getState().artifacts[artifactId];
            if (!currentArtifact) {
                throw new Error('Artifact not found');
            }

            // Get the data encryption key from memory or fetch it
            let dataEncryptionKey = this.artifactDataKeys.get(artifactId);
            
            // Fetch full artifact if we don't have version info or encryption key
            let headerVersion = currentArtifact.headerVersion;
            let bodyVersion = currentArtifact.bodyVersion;
            
            if (headerVersion === undefined || bodyVersion === undefined || !dataEncryptionKey) {
                const fullArtifact = await fetchArtifact(this.credentials, artifactId);
                headerVersion = fullArtifact.headerVersion;
                bodyVersion = fullArtifact.bodyVersion;
                
                // Decrypt and store the data encryption key if we don't have it
                if (!dataEncryptionKey) {
                    const decryptedKey = await this.encryption.decryptEncryptionKey(fullArtifact.dataEncryptionKey);
                    if (!decryptedKey) {
                        throw new Error('Failed to decrypt encryption key');
                    }
                    this.artifactDataKeys.set(artifactId, decryptedKey);
                    dataEncryptionKey = decryptedKey;
                }
            }

            // Create artifact encryption instance
            const artifactEncryption = new ArtifactEncryption(dataEncryptionKey);

            // Prepare update request
            const updateRequest: ArtifactUpdateRequest = {};
            
            // Check if header needs updating (title, sessions, or draft changed)
            if (title !== currentArtifact.title || 
                JSON.stringify(sessions) !== JSON.stringify(currentArtifact.sessions) ||
                draft !== currentArtifact.draft) {
                const encryptedHeader = await artifactEncryption.encryptHeader({ 
                    title, 
                    sessions, 
                    draft 
                });
                updateRequest.header = encryptedHeader;
                updateRequest.expectedHeaderVersion = headerVersion;
            }

            // Only update body if it changed
            if (body !== currentArtifact.body) {
                const encryptedBody = await artifactEncryption.encryptBody({ body });
                updateRequest.body = encryptedBody;
                updateRequest.expectedBodyVersion = bodyVersion;
            }

            // Skip if no changes
            if (Object.keys(updateRequest).length === 0) {
                return;
            }

            // Send update to server
            const response = await updateArtifact(this.credentials, artifactId, updateRequest);
            
            if (!response.success) {
                // Handle version mismatch
                if (response.error === 'version-mismatch') {
                    throw new Error('Artifact was modified by another client. Please refresh and try again.');
                }
                throw new Error('Failed to update artifact');
            }

            // Update local storage
            const updatedArtifact: DecryptedArtifact = {
                ...currentArtifact,
                title,
                sessions,
                draft,
                body,
                headerVersion: response.headerVersion !== undefined ? response.headerVersion : headerVersion,
                bodyVersion: response.bodyVersion !== undefined ? response.bodyVersion : bodyVersion,
                updatedAt: Date.now(),
            };
            
            storage.getState().updateArtifact(updatedArtifact);
        } catch (error) {
            console.error('Failed to update artifact:', error);
            throw error;
        }
    }

    private fetchMachines = async () => {
        if (!this.credentials) return;

        console.log('📊 Sync: Fetching machines...');
        const API_ENDPOINT = getServerUrl();
        const response = await fetch(`${API_ENDPOINT}/v1/machines`, {
            headers: {
                'Authorization': `Bearer ${this.credentials.token}`,
                'Content-Type': 'application/json',
                'X-KISSOPEN-Client': getKissopenClientId(),
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch machines: ${response.status}`);
            return;
        }

        const data = await response.json();
        console.log(`📊 Sync: Fetched ${Array.isArray(data) ? data.length : 0} machines from server`);
        const machines = data as ApiMachineRecord[];
        await this.applyMachineRecords(machines, 'network');
        // Kept as the server sent it (still encrypted) for the next start —
        // except an empty list, which (as below) is not trusted over a known one.
        if (Array.isArray(machines) && machines.length > 0) relayCache.listWrite('machines', machines);
    }

    /**
     * Decrypts a machine list and applies it to the store: the network's, or
     * the copy relayCache kept (dropped if the network's has landed since).
     */
    private applyMachineRecords = async (machines: readonly ApiMachineRecord[], source: ListSource) => {
        if (source === 'cache' && this.listsFromNetwork.machines) return;

        // First, collect and decrypt encryption keys for all machines.
        //
        // Resilience: a single machine whose data key cannot be decrypted
        // (legacy/foreign key format, contentKeyPair mismatch, malformed
        // base64) must NOT abort the whole sync. Previously a throw here
        // rejected fetchMachines entirely — backoff() only console.warn's and
        // retries forever, so applyMachines was never reached and EVERY
        // machine silently vanished from the store (empty /new, no
        // console.error). On failure we fall back to a null key: the machine
        // still gets a (legacy) encryptor and stays visible/selectable, just
        // with undecryptable metadata.
        const machineKeysMap = new Map<string, Uint8Array | null>();
        for (const machine of machines) {
            if (machine.dataEncryptionKey) {
                let decryptedKey: Uint8Array | null = null;
                try {
                    decryptedKey = await this.encryption.decryptEncryptionKey(machine.dataEncryptionKey);
                } catch (error) {
                    console.error(`Failed to decrypt data encryption key for machine ${machine.id}:`, error);
                }
                if (decryptedKey) {
                    machineKeysMap.set(machine.id, decryptedKey);
                    this.machineDataKeys.set(machine.id, decryptedKey);
                } else {
                    console.error(`Failed to decrypt data encryption key for machine ${machine.id} - keeping machine with undecryptable metadata`);
                    machineKeysMap.set(machine.id, null);
                }
            } else {
                machineKeysMap.set(machine.id, null);
            }
        }

        // Initialize machine encryptions. Guard so an init failure cannot
        // reject the whole sync and wipe the machine list.
        try {
            await this.encryption.initializeMachines(machineKeysMap);
        } catch (error) {
            console.error('Failed to initialize machine encryptions:', error);
        }

        // Process all machines first, then update state once. Every machine is
        // pushed exactly once — decryption failures degrade to null metadata
        // instead of dropping the machine, so a machine never disappears from
        // the picker just because its metadata could not be read.
        const decryptedMachines: Machine[] = [];

        for (const machine of machines) {
            try {
                const machineEncryption = this.encryption.getMachineEncryption(machine.id);

                // Use machine-specific encryption (which handles fallback internally)
                const metadata = machineEncryption && machine.metadata
                    ? await machineEncryption.decryptMetadata(machine.metadataVersion, machine.metadata)
                    : null;

                const daemonState = machineEncryption && machine.daemonState
                    ? await machineEncryption.decryptDaemonState(machine.daemonStateVersion || 0, machine.daemonState)
                    : null;

                decryptedMachines.push({
                    id: machine.id,
                    seq: machine.seq,
                    createdAt: machine.createdAt,
                    updatedAt: machine.updatedAt,
                    active: machine.active,
                    activeAt: machine.activeAt,
                    metadata,
                    metadataVersion: machine.metadataVersion,
                    daemonState,
                    daemonStateVersion: machine.daemonStateVersion || 0
                });
            } catch (error) {
                console.error(`Failed to decrypt machine ${machine.id}:`, error);
                // Still add the machine with null metadata so it stays visible.
                decryptedMachines.push({
                    id: machine.id,
                    seq: machine.seq,
                    createdAt: machine.createdAt,
                    updatedAt: machine.updatedAt,
                    active: machine.active,
                    activeAt: machine.activeAt,
                    metadata: null,
                    metadataVersion: machine.metadataVersion,
                    daemonState: null,
                    daemonStateVersion: 0
                });
            }
        }

        // The decrypts above yield; the network's list may have landed meanwhile.
        if (source === 'cache' && this.listsFromNetwork.machines) return;
        if (source === 'network') this.listsFromNetwork.machines = true;

        // Replace entire machine state with fetched machines — but never wipe
        // a populated store with an empty result. An empty list here almost
        // always means a transient fetch/decrypt problem, not "user has no
        // machines"; destroying good state would blank /new until restart.
        const existingMachineCount = Object.keys(storage.getState().machines).length;
        if (decryptedMachines.length === 0 && existingMachineCount > 0) {
            log.log(`🖥️ fetchMachines: empty result, keeping ${existingMachineCount} existing machine(s)`);
            return;
        }
        if (source === 'cache') {
            // A cached machine's `active` is only what was true when it was
            // kept. Until the network's list lands it counts as offline — so a
            // card opened now takes the offline path instead of starting on a
            // computer that may be off — unless a live event has said otherwise.
            const live = storage.getState().machines;
            for (let index = 0; index < decryptedMachines.length; index++) {
                const machine = decryptedMachines[index];
                decryptedMachines[index] = { ...machine, active: live[machine.id]?.active ?? false, activeAt: live[machine.id]?.activeAt ?? machine.activeAt };
            }
        }
        storage.getState().applyMachines(decryptedMachines, true);
        log.log(`🖥️ fetchMachines completed - processed ${decryptedMachines.length} machines`);
    }

    private fetchFriends = async () => {
        if (!this.credentials) return;
        
        try {
            log.log('👥 Fetching friends list...');
            const friendsList = await getFriendsList(this.credentials);
            storage.getState().applyFriends(friendsList);
            log.log(`👥 fetchFriends completed - processed ${friendsList.length} friends`);
        } catch (error) {
            console.error('Failed to fetch friends:', error);
            // Silently handle error - UI will show appropriate state
        }
    }

    private fetchFriendRequests = async () => {
        // Friend requests are now included in the friends list with status='pending'
        // This method is kept for backward compatibility but does nothing
        log.log('👥 fetchFriendRequests called - now handled by fetchFriends');
    }

    private fetchFeed = async () => {
        if (!this.credentials) return;

        try {
            log.log('📰 Fetching feed...');
            const state = storage.getState();
            const existingItems = state.feedItems;
            const head = state.feedHead;
            
            // Load feed items - if we have a head, load newer items
            let allItems: FeedItem[] = [];
            let hasMore = true;
            let cursor = head ? { after: head } : undefined;
            let loadedCount = 0;
            const maxItems = 500;
            
            // Keep loading until we reach known items or hit max limit
            while (hasMore && loadedCount < maxItems) {
                const response = await fetchFeed(this.credentials, {
                    limit: 100,
                    ...cursor
                });
                
                // Check if we reached known items
                const foundKnown = response.items.some(item => 
                    existingItems.some(existing => existing.id === item.id)
                );
                
                allItems.push(...response.items);
                loadedCount += response.items.length;
                hasMore = response.hasMore && !foundKnown;
                
                // Update cursor for next page
                if (response.items.length > 0) {
                    const lastItem = response.items[response.items.length - 1];
                    cursor = { after: lastItem.cursor };
                }
            }
            
            // If this is initial load (no head), also load older items
            if (!head && allItems.length < 100) {
                const response = await fetchFeed(this.credentials, {
                    limit: 100
                });
                allItems.push(...response.items);
            }
            
            // Collect user IDs from friend-related feed items
            const userIds = new Set<string>();
            allItems.forEach(item => {
                if (item.body && (item.body.kind === 'friend_request' || item.body.kind === 'friend_accepted')) {
                    userIds.add(item.body.uid);
                }
            });
            
            // Fetch missing users
            if (userIds.size > 0) {
                await this.assumeUsers(Array.from(userIds));
            }
            
            // Filter out items where user is not found (404)
            const users = storage.getState().users;
            const compatibleItems = allItems.filter(item => {
                // Keep text items
                if (item.body.kind === 'text') return true;
                
                // For friend-related items, check if user exists and is not null (404)
                if (item.body.kind === 'friend_request' || item.body.kind === 'friend_accepted') {
                    const userProfile = users[item.body.uid];
                    // Keep item only if user exists and is not null
                    return userProfile !== null && userProfile !== undefined;
                }
                
                return true;
            });
            
            // Apply only compatible items to storage
            storage.getState().applyFeedItems(compatibleItems);
            log.log(`📰 fetchFeed completed - loaded ${compatibleItems.length} compatible items (${allItems.length - compatibleItems.length} filtered)`);
        } catch (error) {
            console.error('Failed to fetch feed:', error);
        }
    }

    private syncSettings = async () => {
        if (!this.credentials) return;

        const API_ENDPOINT = getServerUrl();
        const maxRetries = 3;
        let retryCount = 0;

        // Apply pending settings
        if (Object.keys(this.pendingSettings).length > 0) {

            while (retryCount < maxRetries) {
                // Snapshot what we're about to send so we can detect concurrent changes
                const sentPending = { ...this.pendingSettings };
                let version = storage.getState().settingsVersion;
                let settings = applySettings(storage.getState().settings, this.pendingSettings);
                const response = await fetch(`${API_ENDPOINT}/v1/account/settings`, {
                    method: 'POST',
                    body: JSON.stringify({
                        settings: await this.encryption.encryptRaw(settingsToSyncPayload(settings)),
                        expectedVersion: version ?? 0
                    }),
                    headers: {
                        'Authorization': `Bearer ${this.credentials.token}`,
                        'Content-Type': 'application/json',
                        'X-KISSOPEN-Client': getKissopenClientId(),
                    }
                });
                const data = await response.json() as {
                    success: false,
                    error: string,
                    currentVersion: number,
                    currentSettings: string | null
                } | {
                    success: true
                };
                if (data.success) {
                    // Only clear keys we actually sent — preserve any settings
                    // added by applySettings() calls during the POST roundtrip
                    const newPending: Partial<Settings> = {};
                    for (const key of Object.keys(this.pendingSettings) as (keyof Settings)[]) {
                        if (!(key in sentPending) || this.pendingSettings[key] !== sentPending[key]) {
                            (newPending as any)[key] = this.pendingSettings[key];
                        }
                    }
                    this.pendingSettings = newPending;
                    savePendingSettings(this.pendingSettings);
                    break;
                }
                if (data.error === 'version-mismatch') {
                    // Parse server settings
                    const serverSettings = data.currentSettings
                        ? settingsParse(await this.encryption.decryptRaw(data.currentSettings))
                        : { ...settingsDefaults };

                    // Merge: server base + our pending changes (our changes win)
                    const mergedSettings = applySettings(serverSettings, this.pendingSettings);

                    // Update local storage with merged result at server's version
                    this.applyServerSettings(mergedSettings, data.currentVersion);

                    // Sync tracking state with merged settings
                    if (tracking) {
                        mergedSettings.analyticsOptOut ? tracking.optOut() : tracking.optIn();
                    }

                    // Log and retry
                    console.log('settings version-mismatch, retrying', {
                        serverVersion: data.currentVersion,
                        retry: retryCount + 1,
                        pendingKeys: Object.keys(this.pendingSettings)
                    });
                    retryCount++;
                    continue;
                } else {
                    throw new Error(`Failed to sync settings: ${data.error}`);
                }
            }
        }

        // If exhausted retries, throw to trigger outer backoff delay
        if (retryCount >= maxRetries) {
            throw new Error(`Settings sync failed after ${maxRetries} retries due to version conflicts`);
        }

        // Run request
        const response = await fetch(`${API_ENDPOINT}/v1/account/settings`, {
            headers: {
                'Authorization': `Bearer ${this.credentials.token}`,
                'Content-Type': 'application/json',
                'X-KISSOPEN-Client': getKissopenClientId(),
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch settings: ${response.status}`);
        }
        const data = await response.json() as {
            settings: string | null,
            settingsVersion: number
        };

        // Parse response
        let parsedSettings: Settings;
        if (data.settings) {
            parsedSettings = settingsParse(await this.encryption.decryptRaw(data.settings));
        } else {
            parsedSettings = { ...settingsDefaults };
        }

        // Log
        console.log('settings', JSON.stringify({
            settings: parsedSettings,
            version: data.settingsVersion
        }));

        // Apply settings to storage, re-layering any pending local changes on top
        this.applyServerSettings(parsedSettings, data.settingsVersion);

        // Sync PostHog opt-out state with settings
        if (tracking) {
            if (parsedSettings.analyticsOptOut) {
                tracking.optOut();
            } else {
                tracking.optIn();
            }
        }
    }

    private fetchProfile = async () => {
        if (!this.credentials) return;

        const API_ENDPOINT = getServerUrl();
        const response = await fetch(`${API_ENDPOINT}/v1/account/profile`, {
            headers: {
                'Authorization': `Bearer ${this.credentials.token}`,
                'Content-Type': 'application/json',
                'X-KISSOPEN-Client': getKissopenClientId(),
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const data = await response.json();
        const parsedProfile = profileParse(data);

        // Log profile data for debugging
        console.log('profile', JSON.stringify({
            id: parsedProfile.id,
            timestamp: parsedProfile.timestamp,
            firstName: parsedProfile.firstName,
            lastName: parsedProfile.lastName,
            hasAvatar: !!parsedProfile.avatar,
            hasGitHub: !!parsedProfile.github
        }));

        // Apply profile to storage
        storage.getState().applyProfile(parsedProfile);
    }

    private fetchNativeUpdate = async () => {
        try {
            // Skip in development
            if ((Platform.OS !== 'android' && Platform.OS !== 'ios') || !Constants.expoConfig?.version) {
                return;
            }
            if (Platform.OS === 'ios' && !Constants.expoConfig?.ios?.bundleIdentifier) {
                return;
            }
            if (Platform.OS === 'android' && !Constants.expoConfig?.android?.package) {
                return;
            }

            const serverUrl = getServerUrl();

            // Get platform and app identifiers
            const platform = Platform.OS;
            const version = Constants.expoConfig?.version!;
            const appId = (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.bundleIdentifier! : Constants.expoConfig?.android?.package!);

            const response = await fetch(`${serverUrl}/v1/version`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-KISSOPEN-Client': getKissopenClientId(),
                },
                body: JSON.stringify({
                    platform,
                    version,
                    app_id: appId,
                }),
            });

            if (!response.ok) {
                console.log(`[fetchNativeUpdate] Request failed: ${response.status}`);
                return;
            }

            const data = await response.json();
            console.log('[fetchNativeUpdate] Data:', data);

            // Apply update status to storage
            if (data.update_required && data.update_url) {
                storage.getState().applyNativeUpdateStatus({
                    available: true,
                    updateUrl: data.update_url
                });
            } else {
                storage.getState().applyNativeUpdateStatus({
                    available: false
                });
            }
        } catch (error) {
            console.log('[fetchNativeUpdate] Error:', error);
            storage.getState().applyNativeUpdateStatus(null);
        }
    }

    private syncPurchases = async () => {
        // iOS purchases belong to the consumer account, not this workspace's
        // serverID. AppleBilling is the sole owner of the native SDK on iOS.
        if (Platform.OS === 'ios') return;
        try {
            // Initialize RevenueCat if not already done
            if (!this.revenueCatInitialized) {
                // Get the appropriate API key based on platform
                let apiKey: string | undefined;

                if (Platform.OS === 'android') {
                    apiKey = config.revenueCatGoogleKey;
                } else if (Platform.OS === 'web') {
                    apiKey = config.revenueCatStripeKey;
                }

                if (!apiKey) {
                    console.log(`RevenueCat: No API key found for platform ${Platform.OS}`);
                    return;
                }

                // Configure RevenueCat
                if (__DEV__) {
                    RevenueCat.setLogLevel(LogLevel.DEBUG);
                }

                // Initialize with the public ID as user ID
                RevenueCat.configure({
                    apiKey,
                    appUserID: this.serverID, // In server this is a CUID, which we can assume is globaly unique even between servers
                    useAmazon: false,
                });

                this.revenueCatInitialized = true;
                console.log('RevenueCat initialized successfully');
            }

            // iOS is handled by the consumer account's AppleBilling surface.
            await RevenueCat.syncPurchases();

            // Fetch customer info
            const customerInfo = await RevenueCat.getCustomerInfo();

            // Apply to storage (storage handles the transformation)
            storage.getState().applyPurchases(customerInfo);

        } catch (error) {
            // console.log, not console.error: purchases are optional and a
            // failure here must not raise the dev error overlay.
            console.log('Failed to sync purchases:', error);
        }
    }

    private flushOutbox = async (sessionId: string) => {
        const pending = this.pendingOutbox.get(sessionId);
        if (!pending || pending.length === 0) {
            if (!this.hasPendingOutboxMessages()) {
                this.clearBackgroundSendWatchdog();
                await this.cancelBackgroundSendTimeoutNotification();
                this.backgroundSendStartedAt = null;
            }
            return;
        }

        const batch = pending.slice();
        const controller = new AbortController();
        this.sendAbortControllers.set(sessionId, controller);
        try {
            const response = await apiSocket.request(`/v3/sessions/${sessionId}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    messages: batch.map((message) => ({
                        localId: message.localId,
                        content: message.content
                    }))
                }),
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`Failed to send messages for ${sessionId}: ${response.status}`);
            }

            const data = await response.json() as V3PostSessionMessagesResponse;
            pending.splice(0, batch.length);
            if (Array.isArray(data.messages) && data.messages.length > 0) {
                // Join our local rows even if the socket echo is delayed or lost.
                const userLocalIds = new Set(batch.filter((message) => message.kind === 'user').map((message) => message.localId));
                const serverIdPairs = data.messages.flatMap((message) =>
                    message.localId && userLocalIds.has(message.localId) ? [{ serverId: message.id, localId: message.localId }] : []);
                if (serverIdPairs.length > 0) {
                    storage.getState().applyUserMessageServerIds(sessionId, serverIdPairs);
                }

                // An acknowledgement proves only that our messages were stored.
                // Receipts or other participants' messages can precede them but
                // remain unread. Only stream consumption may advance the cursor.
                this.getMessagesSync(sessionId).invalidate();
            }
        } catch (error) {
            this.maybeStartBackgroundSendWatchdog();
            throw error;
        } finally {
            this.sendAbortControllers.delete(sessionId);
        }

        if (pending.length === 0) {
            this.pendingOutbox.delete(sessionId);
        }
        if (!this.hasPendingOutboxMessages()) {
            this.clearBackgroundSendWatchdog();
            await this.cancelBackgroundSendTimeoutNotification();
            this.backgroundSendStartedAt = null;
        } else if (this.appState !== 'active') {
            this.maybeStartBackgroundSendWatchdog();
        }
    }

    private fetchMessages = async (sessionId: string) => {
        // Take ownership before waiting. A touch on a different row must not
        // abort the first page once ordinary sync needs it. No duplicate GET
        // or second decryption when touch-up overlaps the speculative request.
        const preload = this.messagePreloader.take(sessionId);
        if (preload && await preload) {
            void this.prefetchOlderMessagesInBackground(sessionId);
            return;
        }
        // Deletion during a handed-off preload is not a transient fetch error.
        if (!storage.getState().sessions[sessionId]) return;
        log.log(`💬 fetchMessages starting for session ${sessionId} - acquiring lock`);
        const lock = this.getSessionMessageLock(sessionId);
        await lock.inLock(async () => {
            if (!storage.getState().sessions[sessionId]) return;
            const encryption = this.encryption.getSessionEncryption(sessionId);
            if (!encryption) {
                log.log(`💬 fetchMessages: Session encryption not ready for ${sessionId}, will retry`);
                throw new Error(`Session encryption not ready for ${sessionId}`);
            }

            const known = this.sessionSeq.get(sessionId);
            const isInitialLoad = known === undefined;
            if (isInitialLoad) {
                // Initial load. Pull only the most recent page so the user can
                // start chatting immediately. Older history streams in lazily
                // through loadOlderMessages() when the user scrolls up — and
                // also through a background prefetch kicked off below, so the
                // history fills in even when the user doesn't scroll.
                //
                // Previously this method walked forward from seq=0 until every
                // page had been fetched and decrypted, which blocked the chat
                // from displaying anything for sessions with thousands of
                // messages. The user's reported pain point was "opening a long
                // session feels frozen" — this is the fix.
                //
                // A session this phone has shown before starts from its cached
                // log instead (restoreCachedMessages): the chat appears at once,
                // and without a connection, and the fetch that follows is the
                // incremental forward one from the cache's settled cursor.
                const cachedSettledSeq = await this.restoreCachedMessages(sessionId, encryption);
                if (cachedSettledSeq === undefined) {
                    await this.fetchInitialLatestPage(sessionId, encryption);
                } else {
                    storage.getState().applyMessagesLoaded(sessionId);
                    await this.fetchForwardSince(sessionId, encryption, cachedSettledSeq);
                }
            } else {
                // Forward incremental sync. Used after reconnect, invalidate,
                // or any subsequent visit. Pulls from the settled cursor, not
                // the newest seq seen: a message still being written below
                // that one comes with it (held ones are skipped by id).
                await this.fetchForwardSince(sessionId, encryption, known.settledSeq);
            }

            storage.getState().applyMessagesLoaded(sessionId);
            log.log(`💬 fetchMessages completed for session ${sessionId}`);

            // A preloaded first page may already be cached. History starts
            // after an actual visit, regardless of who fetched that first page.
            void this.prefetchOlderMessagesInBackground(sessionId);
        });
    }

    private prefetchOlderMessagesInBackground = async (sessionId: string) => {
        if (!this.historyPrefetchSessions.has(sessionId) || this.olderMessagesPrefetching.has(sessionId)) return;
        this.olderMessagesPrefetching.add(sessionId);
        try {
            await this.fetchOlderMessagesInBackground(sessionId);
        } finally {
            this.olderMessagesPrefetching.delete(sessionId);
        }
    }

    private fetchOlderMessagesInBackground = async (sessionId: string) => {
        const SLEEP_BETWEEN_PAGES_MS = 250;
        // While loadOlderMessages handles the actual work, this loop is what
        // keeps it going without user input. We keep stepping until either:
        //   - the server says there is no more older history, or
        //   - the session is no longer present in the store (user navigated
        //     away and the session was unloaded), or
        //   - we hit seq = 1 (the very first message), or
        //   - the encryption key is gone (logged out).
        // The loop yields between pages to keep the UI thread responsive
        // and to spread out server load.
        while (true) {
            const sessionMessages = storage.getState().sessionMessages[sessionId];
            if (!sessionMessages || !sessionMessages.hasMoreOlder) {
                return;
            }
            if (!this.encryption.getSessionEncryption(sessionId)) {
                return;
            }
            const oldestSeq = this.sessionOldestSeq.get(sessionId);
            if (oldestSeq === undefined || oldestSeq <= 1) {
                return;
            }

            try {
                await this.loadOlderMessages(sessionId);
            } catch (error) {
                log.log(`💬 prefetchOlderMessagesInBackground: error for ${sessionId}, stopping: ${String(error)}`);
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_PAGES_MS));
        }
    }

    private fetchInitialLatestPage = async (
        sessionId: string,
        encryption: ReturnType<Encryption['getSessionEncryption']> & {},
        preloadSignal?: AbortSignal,
    ) => {
        const response = await apiSocket.request(
            `/v3/sessions/${sessionId}/messages?before_seq=${SEQ_BACKWARD_INITIAL_SENTINEL}&limit=100`,
            { signal: preloadSignal },
        );
        if (!response.ok) {
            throw new Error(`Failed to fetch initial page for ${sessionId}: ${response.status}`);
        }
        const data = await response.json() as V3GetSessionMessagesResponse;
        const messages = Array.isArray(data.messages) ? data.messages : [];

        await this.applyFetchedMessages(sessionId, encryption, messages, preloadSignal);

        // Anchor both ends so future incremental forward sync resumes from
        // the settled cursor, and loadOlderMessages can page backward from
        // minSeq. A seq missing inside the page may still be being written,
        // so the cursor waits below it; a page that is the whole history
        // waits for a missing first message too (as messageCacheApplyLatest).
        let minSeq = Number.POSITIVE_INFINITY;
        for (const message of messages) {
            if (message.seq < minSeq) minSeq = message.seq;
        }
        const hasMore = !!data.hasMore && messages.length > 0;
        this.recordSeqs(sessionId, messages, seqTrackerStart(hasMore ? minSeq - 1 : 0), true);
        if (messages.length > 0) {
            this.sessionOldestSeq.set(sessionId, minSeq);
        }
        storage.getState().applyOlderMessagesPagination(sessionId, {
            hasMore
        });
        void relayCache.messagesRecordLatest(sessionId, messages, !!data.hasMore && messages.length > 0);
    }

    /**
     * Shows a session's cached log (relayCache) through the ordinary decrypt
     * and apply path, and seeds the cursors from it: the settled cursor (and
     * the holes it waits on) for the forward fetch that follows, and the
     * oldest shown for paging back — the
     * rest of the cached history is served by loadOlderMessages before it
     * asks the server. One page is shown now, like the network's first page,
     * so a long log does not hold up the first paint.
     *
     * Returns the cursor to fetch forward from, or undefined when there is
     * nothing usable to show and the caller should fetch the latest page
     * instead.
     */
    private restoreCachedMessages = async (
        sessionId: string,
        encryption: ReturnType<Encryption['getSessionEncryption']> & {},
        preloadSignal?: AbortSignal,
    ): Promise<number | undefined> => {
        const entry = await relayCache.messagesLoad(sessionId);
        if (!entry || !messageCacheSeedable(entry)) return undefined;
        const page = messageCacheLatestPage(entry, CACHED_FIRST_PAGE);
        await this.applyFetchedMessages(sessionId, encryption, [...page.messages], preloadSignal);
        const tracker = this.recordSeqs(sessionId, [], seqTrackerOfCache(entry), true);
        if (page.oldestSeq !== null) {
            this.sessionOldestSeq.set(sessionId, page.oldestSeq);
        }
        storage.getState().applyOlderMessagesPagination(sessionId, { hasMore: page.hasMore });
        log.log(`💬 Restored ${page.messages.length} cached messages for ${sessionId} (lastSeq=${entry.lastSeq}, settledSeq=${tracker.settledSeq})`);
        return tracker.settledSeq;
    }

    /**
     * Records seqs just applied in the session's cursor (starting from
     * `start` when it has none, or when `replace`), and keeps a re-fetch
     * scheduled while the cursor waits on a hole.
     */
    private recordSeqs = (
        sessionId: string,
        messages: readonly { readonly seq: number }[],
        start: SeqTracker,
        replace = false,
    ): SeqTracker => {
        const base = replace ? start : this.sessionSeq.get(sessionId) ?? start;
        const next = seqTrackerRecord(base, messages.map((message) => message.seq));
        this.sessionSeq.set(sessionId, next);
        this.scheduleHoleRecheck(sessionId, next);
        return next;
    }

    /**
     * While a session's cursor waits on a hole, fetch forward again every
     * little while: soon at first, since a seq out of order is usually
     * readable within milliseconds, then less often, and once more just
     * after the grace so a number the server never used is settled over.
     */
    private scheduleHoleRecheck = (sessionId: string, tracker: SeqTracker) => {
        if (tracker.settledSeq >= tracker.lastSeq) {
            this.clearHoleRecheck(sessionId);
            return;
        }
        if (this.holeRecheckTimers.has(sessionId)) return;
        const firstSeen = tracker.holes[tracker.settledSeq + 1] ?? Date.now();
        const age = Math.max(0, Date.now() - firstSeen);
        const untilGrace = HOLE_GRACE_MS - age + 500;
        const delay = Math.max(500, Math.min(Math.max(1_500, age), 30_000, untilGrace));
        this.holeRecheckTimers.set(sessionId, setTimeout(() => {
            this.holeRecheckTimers.delete(sessionId);
            const current = this.sessionSeq.get(sessionId);
            if (!current || current.settledSeq >= current.lastSeq || !storage.getState().sessions[sessionId]) return;
            this.getMessagesSync(sessionId).invalidate();
        }, delay));
    }

    private clearHoleRecheck = (sessionId: string) => {
        const timer = this.holeRecheckTimers.get(sessionId);
        if (timer) clearTimeout(timer);
        this.holeRecheckTimers.delete(sessionId);
    }

    private fetchForwardSince = async (
        sessionId: string,
        encryption: ReturnType<Encryption['getSessionEncryption']> & {},
        fromSeq: number,
        preloadSignal?: AbortSignal,
    ) => {
        let afterSeq = fromSeq;
        while (true) {
            const path = `/v3/sessions/${sessionId}/messages?after_seq=${afterSeq}&limit=100`;
            const response = await (preloadSignal ? apiSocket.request(path, { signal: preloadSignal }) : apiSocket.request(path));
            if (!response.ok) {
                throw new Error(`Failed to forward-sync ${sessionId}: ${response.status}`);
            }
            const data = await response.json() as V3GetSessionMessagesResponse;
            const messages = Array.isArray(data.messages) ? data.messages : [];

            await this.applyFetchedMessages(sessionId, encryption, messages, preloadSignal);
            void relayCache.messagesRecordForward(sessionId, afterSeq, messages);
            // Recorded even when empty: a hole that has aged out settles here.
            this.recordSeqs(sessionId, messages, seqTrackerStart(fromSeq));

            let maxSeq = afterSeq;
            for (const message of messages) {
                if (message.seq > maxSeq) maxSeq = message.seq;
            }

            if (!data.hasMore) break;
            if (maxSeq === afterSeq) {
                log.log(`💬 fetchForwardSince: pagination stalled for ${sessionId}, stopping to avoid infinite loop`);
                break;
            }
            afterSeq = maxSeq;
        }
    }

    private applyFetchedMessages = async (
        sessionId: string,
        encryption: ReturnType<Encryption['getSessionEncryption']> & {},
        messages: ApiMessage[],
        preloadSignal?: AbortSignal,
    ) => {
        const assertPreloadActive = () => {
            if (preloadSignal && (preloadSignal.aborted || !storage.getState().sessions[sessionId]
                || this.encryption.getSessionEncryption(sessionId) !== encryption)) {
                throw new Error('Session preload cancelled');
            }
        };
        assertPreloadActive();
        // Forward fetches start from the settled cursor, so messages already
        // applied above it come back; they are skipped by id here, before the
        // decrypt, rather than replayed through the reducer.
        const applied = storage.getState().sessionMessages[sessionId]?.reducerState?.messageIds;
        if (applied && applied.size > 0) messages = messages.filter((message) => !applied.has(message.id));
        if (messages.length === 0) return;
        const decryptedMessages = await encryption.decryptMessages(messages);
        assertPreloadActive();
        const normalizedMessages: NormalizedMessage[] = [];
        for (let i = 0; i < decryptedMessages.length; i++) {
            const decrypted = decryptedMessages[i];
            if (!decrypted) continue;
            const normalized = normalizeRawMessage(decrypted.id, decrypted.localId, decrypted.createdAt, decrypted.content);
            if (normalized) {
                normalizedMessages.push(normalized);
            }
        }
        if (normalizedMessages.length > 0) {
            // Once the destination has focus this is an ordinary first page,
            // including voice updates if the call began before it arrived.
            const source = preloadSignal && storage.getState().currentViewingSessionId !== sessionId ? 'preload' : 'sync';
            this.applyMessages(sessionId, normalizedMessages, source);
        }
    }

    /**
     * Fetch one page of older messages for a session and prepend them to the
     * store. Called from the chat UI when the user scrolls past the top of
     * the currently loaded history. No-op when we have already fetched the
     * earliest message, when no initial fetch has happened yet, or when an
     * older-fetch is already in flight for this session.
     */
    loadOlderMessages = async (sessionId: string) => {
        const oldestSeq = this.sessionOldestSeq.get(sessionId);
        if (oldestSeq === undefined || oldestSeq <= 1) {
            return;
        }
        const sessionMessages = storage.getState().sessionMessages[sessionId];
        if (!sessionMessages || sessionMessages.isLoadingOlder || !sessionMessages.hasMoreOlder) {
            return;
        }

        storage.getState().applyOlderMessagesLoading(sessionId, true);
        const lock = this.getSessionMessageLock(sessionId);
        try {
            await lock.inLock(async () => {
                const encryption = this.encryption.getSessionEncryption(sessionId);
                if (!encryption) {
                    log.log(`💬 loadOlderMessages: encryption not ready for ${sessionId}`);
                    return;
                }
                // Re-read the cursor inside the lock. A concurrent
                // socket-pushed update or reload could have changed it.
                const beforeSeq = this.sessionOldestSeq.get(sessionId);
                if (beforeSeq === undefined || beforeSeq <= 1) {
                    return;
                }
                // History this phone already holds comes from its cache; the
                // server is asked only past the cache's oldest message.
                const cached = messageCacheOlderPage(await relayCache.messagesLoad(sessionId), beforeSeq, 100);
                if (cached && cached.oldestSeq !== null) {
                    await this.applyFetchedMessages(sessionId, encryption, [...cached.messages]);
                    this.sessionOldestSeq.set(sessionId, cached.oldestSeq);
                    storage.getState().applyOlderMessagesPagination(sessionId, { hasMore: cached.hasMore });
                    return;
                }
                const response = await apiSocket.request(
                    `/v3/sessions/${sessionId}/messages?before_seq=${beforeSeq}&limit=100`
                );
                if (!response.ok) {
                    throw new Error(`Failed to load older messages for ${sessionId}: ${response.status}`);
                }
                const data = await response.json() as V3GetSessionMessagesResponse;
                const messages = Array.isArray(data.messages) ? data.messages : [];

                await this.applyFetchedMessages(sessionId, encryption, messages);

                let minSeq = beforeSeq;
                for (const message of messages) {
                    if (message.seq < minSeq) minSeq = message.seq;
                }
                if (messages.length > 0) {
                    this.sessionOldestSeq.set(sessionId, minSeq);
                }
                storage.getState().applyOlderMessagesPagination(sessionId, {
                    hasMore: !!data.hasMore && messages.length > 0
                });
                void relayCache.messagesRecordOlder(sessionId, beforeSeq, messages, !!data.hasMore && messages.length > 0);
            });
        } finally {
            storage.getState().applyOlderMessagesLoading(sessionId, false);
        }
    }

    private registerPushToken = async () => {
        log.log('registerPushToken');
        try {
            const result = await syncCurrentPushToken(this.credentials);
            log.log('Push token sync result: ' + JSON.stringify({
                registered: result.registered,
                hasToken: !!result.token,
                permission: result.permission.status,
            }));
            if (!result.permission.granted) {
                console.log('Failed to get push token for push notification!');
            }
        } catch (error) {
            log.log('Failed to register push token: ' + JSON.stringify(error));
        }
    }

    private subscribeToUpdates = () => {
        // Subscribe to message updates
        apiSocket.onMessage('update', this.handleUpdate.bind(this));
        apiSocket.onMessage('ephemeral', this.handleEphemeralUpdate.bind(this));

        // Subscribe to connection state changes
        apiSocket.onReconnected(() => {
            log.log('🔌 Socket reconnected');

            // Send current focus state on reconnect so the server's
            // suppression rules pick up where we left off (handshake.auth.appState
            // covers the very first connect; this covers reconnects).
            apiSocket.sendAppState(getCurrentAppState());

            this.sessionsSync.invalidate();
            this.machinesSync.invalidate();
            log.log('🔌 Socket reconnected: Invalidating artifacts sync');
            this.artifactsSync.invalidate();
            this.friendsSync.invalidate();
            this.friendRequestsSync.invalidate();
            this.feedSync.invalidate();
            // Refresh the open chat's message log. The socket dropped (foreground
            // network blip, server restart, or returning from background), so any
            // messages produced during the gap were missed — there was no live
            // `update` to apply them, and `connect` fired with recovered=false so
            // socket.io did not replay them. sessionsSync above only refreshes the
            // session list/metadata, not the viewing session's messages. (This used
            // to rely on SessionView calling onSessionVisible "when realtimeStatus
            // changes", but realtimeStatus tracks the voice session, not this data
            // socket — see useSocketStatus vs useRealtimeStatus — so that trigger
            // never fired on reconnect.)
            const reconnectViewingSessionId = storage.getState().currentViewingSessionId;
            if (reconnectViewingSessionId) {
                this.onSessionVisible(reconnectViewingSessionId);
            }
            for (const sync of this.sendSync.values()) {
                sync.invalidate();
            }
        });
    }

    private handleUpdate = async (update: unknown) => {
        const validatedUpdate = ApiUpdateContainerSchema.safeParse(update);
        if (!validatedUpdate.success) {
            console.log('❌ Sync: Invalid update received:', validatedUpdate.error);
            console.error('❌ Sync: Invalid update data:', update);
            return;
        }
        const updateData = validatedUpdate.data;
        console.log(`🔄 Sync: Validated update type: ${updateData.body.t}`);

        if (updateData.body.t === 'new-message') {
            this.noteLiveSession(updateData.body.sid);

            // Get encryption — may not be ready if sessions are still syncing
            let encryption = this.encryption.getSessionEncryption(updateData.body.sid);
            if (!encryption) {
                await this.sessionsSync.awaitQueue();
                encryption = this.encryption.getSessionEncryption(updateData.body.sid);
                if (!encryption) {
                    console.error(`Session ${updateData.body.sid} not found after sync`);
                    this.fetchSessions();
                    return;
                }
            }

            // Decrypt message
            let lastMessage: NormalizedMessage | null = null;
            if (updateData.body.message) {
                const decrypted = await encryption.decryptMessage(updateData.body.message);
                if (decrypted) {
                    lastMessage = normalizeRawMessage(decrypted.id, decrypted.localId, decrypted.createdAt, decrypted.content);

                    // Check for task lifecycle events to update thinking state
                    // This ensures UI updates even if volatile activity updates are lost
                    const rawContent = decrypted.content as {
                        role?: string;
                        content?: {
                            type?: string;
                            data?: {
                                type?: string;
                                ev?: { t?: string };
                            }
                        }
                    } | null;
                    const contentType = rawContent?.content?.type;
                    const dataType = rawContent?.content?.data?.type;
                    const sessionEventType = rawContent?.content?.data?.ev?.t;
                    
                    // Debug logging to trace lifecycle events
                    if (dataType === 'task_complete' || dataType === 'turn_aborted' || dataType === 'task_started' || sessionEventType === 'turn-start' || sessionEventType === 'turn-end') {
                        console.log(`🔄 [Sync] Lifecycle event detected: contentType=${contentType}, dataType=${dataType}, sessionEventType=${sessionEventType}`);
                    }
                    
                    const isTaskComplete = 
                        ((contentType === 'acp' || contentType === 'codex') && 
                            (dataType === 'task_complete' || dataType === 'turn_aborted')) ||
                        (contentType === 'session' && sessionEventType === 'turn-end');
                    
                    const isTaskStarted = 
                        ((contentType === 'acp' || contentType === 'codex') && dataType === 'task_started') ||
                        (contentType === 'session' && sessionEventType === 'turn-start');
                    
                    if (isTaskComplete || isTaskStarted) {
                        console.log(`🔄 [Sync] Updating thinking state: isTaskComplete=${isTaskComplete}, isTaskStarted=${isTaskStarted}`);
                    }

                    // Update session
                    const session = storage.getState().sessions[updateData.body.sid];
                    if (session) {
                        this.applySessions([{
                            ...session,
                            updatedAt: updateData.createdAt,
                            seq: updateData.seq,
                            // Update thinking state based on task lifecycle events
                            ...(isTaskComplete ? { thinking: false } : {}),
                            ...(isTaskStarted ? { thinking: true } : {})
                        }])
                    } else {
                        // Fetch sessions again if we don't have this session
                        this.fetchSessions();
                    }

                    // A live message is shown at once. It moves the cursor only
                    // when it is the very next seq after the settled one; any
                    // other seq may have one still being written below it, so
                    // the forward fetch from the settled cursor fills that in
                    // (and brings this one again, skipped by id).
                    const tracker = this.sessionSeq.get(updateData.body.sid);
                    const incomingSeq = updateData.body.message.seq;
                    if (lastMessage && tracker !== undefined) {
                        this.enqueueMessages(updateData.body.sid, [lastMessage]);
                        if (incomingSeq === tracker.settledSeq + 1) {
                            this.recordSeqs(updateData.body.sid, [updateData.body.message], tracker);
                            void relayCache.messagesRecordForward(updateData.body.sid, incomingSeq - 1, [updateData.body.message]);
                        } else if (incomingSeq > tracker.settledSeq) {
                            this.getMessagesSync(updateData.body.sid).invalidate();
                        }
                        let hasMutableTool = false;
                        if (lastMessage.role === 'agent' && lastMessage.content[0] && lastMessage.content[0].type === 'tool-result') {
                            hasMutableTool = storage.getState().isMutableToolCall(updateData.body.sid, lastMessage.content[0].tool_use_id);
                        }
                        if (hasMutableTool) {
                            gitStatusSync.invalidate(updateData.body.sid);
                        }
                    } else {
                        this.getMessagesSync(updateData.body.sid).invalidate();
                    }
                }
            }

            // A socket update refreshes data; it is not a user opening a chat.
            this.onSessionDataUpdated(updateData.body.sid);

        } else if (updateData.body.t === 'new-session') {
            log.log('🆕 New session update received');
            this.noteLiveSession(updateData.body.id);
            this.sessionsSync.invalidate();
        } else if (updateData.body.t === 'delete-session') {
            log.log('🗑️ Delete session update received');
            const sessionId = updateData.body.sid;
            this.sessionAvatars.cancel(sessionId);

            // Remove session from storage
            storage.getState().deleteSession(sessionId);

            // Remove encryption keys from memory
            this.encryption.removeSessionEncryption(sessionId);

            // Clear any cached git status
            gitStatusSync.clearForSession(sessionId);
            this.messagePreloader.cancel(sessionId);
            this.historyPrefetchSessions.delete(sessionId);
            this.preloadedPlanModes.delete(sessionId);
            this.messagesSync.delete(sessionId);
            this.sendSync.delete(sessionId);
            this.pendingOutbox.delete(sessionId);
            this.sessionSeq.delete(sessionId);
            this.clearHoleRecheck(sessionId);
            this.liveSessionTicks.delete(sessionId);
            this.sessionOldestSeq.delete(sessionId);
            void relayCache.messagesDelete(sessionId);
            this.sessionMessageLocks.delete(sessionId);
            this.sessionMessageQueue.delete(sessionId);
            this.sessionQueueProcessing.delete(sessionId);
            this.projectsSync.invalidate();

            log.log(`🗑️ Session ${sessionId} deleted from local storage`);
        } else if (updateData.body.t === 'update-session') {
            this.noteLiveSession(updateData.body.id);
            // Session + encryption may not be initialized yet if sessions are
            // still syncing on startup. Mirror the new-message path: await the
            // sessions sync queue and re-check before giving up — dropping here
            // silently loses the metadata update that carries the chat title
            // (#1251: every chat stuck on "New chat" after the lazy-load change).
            let session = storage.getState().sessions[updateData.body.id];
            let sessionEncryption = this.encryption.getSessionEncryption(updateData.body.id);
            if (!session || !sessionEncryption) {
                await this.sessionsSync.awaitQueue();
                session = storage.getState().sessions[updateData.body.id];
                sessionEncryption = this.encryption.getSessionEncryption(updateData.body.id);
            }
            if (session) {
                if (!sessionEncryption) {
                    console.error(`Session encryption not found for ${updateData.body.id} after sync`);
                    this.fetchSessions();
                    return;
                }

                const agentState = updateData.body.agentState && sessionEncryption
                    ? await sessionEncryption.decryptAgentState(updateData.body.agentState.version, updateData.body.agentState.value)
                    : session.agentState;
                const metadata = updateData.body.metadata && sessionEncryption
                    ? await sessionEncryption.decryptMetadata(updateData.body.metadata.version, updateData.body.metadata.value)
                    : session.metadata;

                const nextProjectId = updateData.body.projectId !== undefined
                    ? updateData.body.projectId
                    : session.projectId;
                const latestAvatar = storage.getState().sessions[session.id] ?? session;
                const incomingAvatarRevision = updateData.body.avatarVersion ?? updateData.body.avatar?.version;
                const avatarChanged = updateData.body.avatar !== undefined && (incomingAvatarRevision !== undefined && latestAvatar.avatarRevision !== undefined
                    ? incomingAvatarRevision > latestAvatar.avatarRevision
                    : updateData.seq > (latestAvatar.avatarUpdateSeq ?? -1));
                if (updateData.body.avatar !== undefined && !avatarChanged && !updateData.body.metadata && !updateData.body.agentState && updateData.body.projectId === undefined) return;
                const nextAvatarDescriptor = avatarChanged ? updateData.body.avatar : latestAvatar.avatarDescriptor;
                this.applySessions([{
                    ...session,
                    avatarDescriptor: nextAvatarDescriptor,
                    avatar: sameSessionAvatar(nextAvatarDescriptor, latestAvatar.avatarDescriptor) ? latestAvatar.avatar : null,
                    avatarUpdateSeq: avatarChanged ? updateData.seq : latestAvatar.avatarUpdateSeq,
                    avatarRevision: avatarChanged ? incomingAvatarRevision : latestAvatar.avatarRevision,
                    agentState,
                    agentStateVersion: updateData.body.agentState
                        ? updateData.body.agentState.version
                        : session.agentStateVersion,
                    metadata,
                    metadataVersion: updateData.body.metadata
                        ? updateData.body.metadata.version
                        : session.metadataVersion,
                    projectId: nextProjectId,
                    updatedAt: updateData.createdAt,
                    seq: updateData.seq
                }]);
                if (nextProjectId !== session.projectId) this.projectsSync.invalidate();

                // Invalidate git status when agent state changes (files may have been modified)
                if (updateData.body.agentState) {
                    gitStatusSync.invalidate(updateData.body.id);

                    // Check for new permission requests and notify voice assistant
                    if (agentState?.requests && Object.keys(agentState.requests).length > 0) {
                        const requestIds = Object.keys(agentState.requests);
                        const firstRequest = agentState.requests[requestIds[0]];
                        const toolName = firstRequest?.tool;
                        voiceHooks.onPermissionRequested(updateData.body.id, requestIds[0], toolName, firstRequest?.arguments);
                    }

                    // Re-fetch messages on control handoff so the newly active
                    // side catches up on messages exchanged while it was passive.
                    const wasControlledByUser = session.agentState?.controlledByUser;
                    const isNowControlledByUser = agentState?.controlledByUser;
                    const handoffDirection = usesControlledSessionUi(metadata)
                        ? resolveControlHandoffDirection(wasControlledByUser, isNowControlledByUser)
                        : null;
                    if (handoffDirection) {
                        const target = handoffDirection === 'desktop-to-mobile' ? 'mobile' : 'desktop';
                        log.log(`🔄 Control returned to ${target} for session ${updateData.body.id}, re-fetching messages`);
                        this.onSessionDataUpdated(updateData.body.id);
                    }
                }
            }
        } else if (
            updateData.body.t === 'new-project'
            || updateData.body.t === 'update-project'
            || updateData.body.t === 'delete-project'
        ) {
            log.log(`📁 ${updateData.body.t} update received`);
            // Project events only invalidate; the catalog endpoint is canonical.
            this.projectsSync.invalidate();
            if (updateData.body.t === 'delete-project') {
                // Deletion also nulls the server-side session link.
                this.sessionsSync.invalidate();
            }
        } else if (updateData.body.t === 'update-account') {
            const accountUpdate = updateData.body;
            const currentProfile = storage.getState().profile;
            const hadGitHub = !!currentProfile.github?.login;

            // Build updated profile with new data
            const updatedProfile: Profile = {
                ...currentProfile,
                firstName: accountUpdate.firstName !== undefined ? accountUpdate.firstName : currentProfile.firstName,
                lastName: accountUpdate.lastName !== undefined ? accountUpdate.lastName : currentProfile.lastName,
                avatar: accountUpdate.avatar !== undefined ? accountUpdate.avatar : currentProfile.avatar,
                github: accountUpdate.github !== undefined ? accountUpdate.github : currentProfile.github,
                timestamp: updateData.createdAt // Update timestamp to latest
            };

            // Apply the updated profile to storage
            storage.getState().applyProfile(updatedProfile);

            if (!hadGitHub && updatedProfile.github?.login) {
                trackGitHubConnected();
            }

            // Handle settings updates (new for profile sync)
            if (accountUpdate.settings?.value) {
                try {
                    const decryptedSettings = await this.encryption.decryptRaw(accountUpdate.settings.value);
                    const parsedSettings = settingsParse(decryptedSettings);

                    // Version compatibility check
                    const settingsSchemaVersion = parsedSettings.schemaVersion ?? 1;
                    if (settingsSchemaVersion > SUPPORTED_SCHEMA_VERSION) {
                        console.warn(
                            `⚠️ Received settings schema v${settingsSchemaVersion}, ` +
                            `we support v${SUPPORTED_SCHEMA_VERSION}. Update app for full functionality.`
                        );
                    }

                    this.applyServerSettings(parsedSettings, accountUpdate.settings.version);
                    log.log(`📋 Settings synced from server (schema v${settingsSchemaVersion}, version ${accountUpdate.settings.version})`);
                } catch (error) {
                    console.error('❌ Failed to process settings update:', error);
                    // Don't crash on settings sync errors, just log
                }
            }
        } else if (updateData.body.t === 'new-machine') {
            const machineUpdate = updateData.body;
            const machineId = machineUpdate.machineId;

            // Brand-new machines (cold onboarding) are delivered via 'new-machine'
            // before any fetchMachines has seen them, so their per-machine
            // encryption isn't initialized yet. The update carries the data
            // encryption key — register it here (mirroring fetchMachines) or every
            // later decrypt for this machine fails and it never lands in storage,
            // leaving the new-session screen unable to start a session until an app
            // restart / socket reconnect triggers a full machine refetch.
            const machineKeysMap = new Map<string, Uint8Array | null>();
            if (machineUpdate.dataEncryptionKey) {
                const decryptedKey = await this.encryption.decryptEncryptionKey(machineUpdate.dataEncryptionKey);
                if (decryptedKey) {
                    machineKeysMap.set(machineId, decryptedKey);
                    this.machineDataKeys.set(machineId, decryptedKey);
                } else {
                    console.error(`Failed to decrypt data encryption key for new machine ${machineId}`);
                    machineKeysMap.set(machineId, null);
                }
            } else {
                machineKeysMap.set(machineId, null);
            }
            await this.encryption.initializeMachines(machineKeysMap);

            const machineEncryption = this.encryption.getMachineEncryption(machineId);
            if (!machineEncryption) {
                console.error(`Machine encryption not found for ${machineId} after init - cannot apply new-machine`);
                return;
            }

            // Preserve an existing createdAt if we somehow already know this machine.
            const existing = storage.getState().machines[machineId];
            const newMachine: Machine = {
                id: machineId,
                seq: machineUpdate.seq,
                createdAt: existing?.createdAt ?? machineUpdate.createdAt,
                updatedAt: machineUpdate.updatedAt,
                active: machineUpdate.active,
                activeAt: machineUpdate.activeAt,
                metadata: null,
                metadataVersion: machineUpdate.metadataVersion,
                daemonState: null,
                daemonStateVersion: machineUpdate.daemonStateVersion
            };

            // Decrypt best-effort; still apply the machine on failure so it stays
            // visible/usable (matches fetchMachines' fallback behavior).
            try {
                newMachine.metadata = machineUpdate.metadata
                    ? await machineEncryption.decryptMetadata(machineUpdate.metadataVersion, machineUpdate.metadata)
                    : null;
                newMachine.daemonState = machineUpdate.daemonState
                    ? await machineEncryption.decryptDaemonState(machineUpdate.daemonStateVersion, machineUpdate.daemonState)
                    : null;
            } catch (error) {
                console.error(`Failed to decrypt new machine ${machineId}:`, error);
            }

            storage.getState().applyMachines([newMachine]);
        } else if (updateData.body.t === 'update-machine') {
            const machineUpdate = updateData.body;
            const machineId = machineUpdate.machineId;  // Changed from .id to .machineId
            const machine = storage.getState().machines[machineId];

            // Create or update machine with all required fields
            const updatedMachine: Machine = {
                id: machineId,
                seq: updateData.seq,
                createdAt: machine?.createdAt ?? updateData.createdAt,
                updatedAt: updateData.createdAt,
                active: machineUpdate.active ?? true,
                activeAt: machineUpdate.activeAt ?? updateData.createdAt,
                metadata: machine?.metadata ?? null,
                metadataVersion: machine?.metadataVersion ?? 0,
                daemonState: machine?.daemonState ?? null,
                daemonStateVersion: machine?.daemonStateVersion ?? 0
            };

            // Get machine-specific encryption (might not exist if machine wasn't initialized)
            const machineEncryption = this.encryption.getMachineEncryption(machineId);
            if (!machineEncryption) {
                console.error(`Machine encryption not found for ${machineId} - cannot decrypt updates`);
                return;
            }

            // If metadata is provided, decrypt and update it
            const metadataUpdate = machineUpdate.metadata;
            if (metadataUpdate) {
                try {
                    const metadata = await machineEncryption.decryptMetadata(metadataUpdate.version, metadataUpdate.value);
                    updatedMachine.metadata = metadata;
                    updatedMachine.metadataVersion = metadataUpdate.version;
                } catch (error) {
                    console.error(`Failed to decrypt machine metadata for ${machineId}:`, error);
                }
            }

            // If daemonState is provided, decrypt and update it
            const daemonStateUpdate = machineUpdate.daemonState;
            if (daemonStateUpdate) {
                try {
                    const daemonState = await machineEncryption.decryptDaemonState(daemonStateUpdate.version, daemonStateUpdate.value);
                    updatedMachine.daemonState = daemonState;
                    updatedMachine.daemonStateVersion = daemonStateUpdate.version;
                } catch (error) {
                    console.error(`Failed to decrypt machine daemonState for ${machineId}:`, error);
                }
            }

            // Update storage using applyMachines which rebuilds sessionListViewData
            storage.getState().applyMachines([updatedMachine]);
        } else if (updateData.body.t === 'delete-machine') {
            const machineId = updateData.body.machineId;
            log.log(`🗑️ Delete machine update received for ${machineId}`);
            if (!storage.getState().machines[machineId]) {
                log.log(`Machine ${machineId} not in storage, skipping delete`);
            } else {
                storage.getState().deleteMachine(machineId);
                this.encryption.removeMachineEncryption(machineId);
                this.machineDataKeys.delete(machineId);
            }
        } else if (updateData.body.t === 'relationship-updated') {
            log.log('👥 Received relationship-updated update');
            const relationshipUpdate = updateData.body;
            
            // Apply the relationship update to storage
            storage.getState().applyRelationshipUpdate({
                fromUserId: relationshipUpdate.fromUserId,
                toUserId: relationshipUpdate.toUserId,
                status: relationshipUpdate.status,
                action: relationshipUpdate.action,
                fromUser: relationshipUpdate.fromUser,
                toUser: relationshipUpdate.toUser,
                timestamp: relationshipUpdate.timestamp
            });
            
            // Invalidate friends data to refresh with latest changes
            this.friendsSync.invalidate();
            this.friendRequestsSync.invalidate();
            this.feedSync.invalidate();
        } else if (updateData.body.t === 'new-artifact') {
            log.log('📦 Received new-artifact update');
            const artifactUpdate = updateData.body;
            const artifactId = artifactUpdate.artifactId;
            
            try {
                // Decrypt the data encryption key
                const decryptedKey = await this.encryption.decryptEncryptionKey(artifactUpdate.dataEncryptionKey);
                if (!decryptedKey) {
                    console.error(`Failed to decrypt key for new artifact ${artifactId}`);
                    return;
                }
                
                // Store the decrypted key in memory
                this.artifactDataKeys.set(artifactId, decryptedKey);
                
                // Create artifact encryption instance
                const artifactEncryption = new ArtifactEncryption(decryptedKey);
                
                // Decrypt header
                const header = await artifactEncryption.decryptHeader(artifactUpdate.header);
                
                // Decrypt body if provided
                let decryptedBody: string | null | undefined = undefined;
                if (artifactUpdate.body && artifactUpdate.bodyVersion !== undefined) {
                    const body = await artifactEncryption.decryptBody(artifactUpdate.body);
                    decryptedBody = body?.body || null;
                }
                
                // Add to storage
                const decryptedArtifact: DecryptedArtifact = {
                    id: artifactId,
                    title: header?.title || null,
                    body: decryptedBody,
                    headerVersion: artifactUpdate.headerVersion,
                    bodyVersion: artifactUpdate.bodyVersion,
                    seq: artifactUpdate.seq,
                    createdAt: artifactUpdate.createdAt,
                    updatedAt: artifactUpdate.updatedAt,
                    isDecrypted: !!header,
                };
                
                storage.getState().addArtifact(decryptedArtifact);
                log.log(`📦 Added new artifact ${artifactId} to storage`);
            } catch (error) {
                console.error(`Failed to process new artifact ${artifactId}:`, error);
            }
        } else if (updateData.body.t === 'update-artifact') {
            log.log('📦 Received update-artifact update');
            const artifactUpdate = updateData.body;
            const artifactId = artifactUpdate.artifactId;
            
            // Get existing artifact
            const existingArtifact = storage.getState().artifacts[artifactId];
            if (!existingArtifact) {
                console.error(`Artifact ${artifactId} not found in storage`);
                // Fetch all artifacts to sync
                this.artifactsSync.invalidate();
                return;
            }
            
            try {
                // Get the data encryption key from memory
                let dataEncryptionKey = this.artifactDataKeys.get(artifactId);
                if (!dataEncryptionKey) {
                    console.error(`Encryption key not found for artifact ${artifactId}, fetching artifacts`);
                    this.artifactsSync.invalidate();
                    return;
                }
                
                // Create artifact encryption instance
                const artifactEncryption = new ArtifactEncryption(dataEncryptionKey);
                
                // Update artifact with new data  
                const updatedArtifact: DecryptedArtifact = {
                    ...existingArtifact,
                    seq: updateData.seq,
                    updatedAt: updateData.createdAt,
                };
                
                // Decrypt and update header if provided
                if (artifactUpdate.header) {
                    const header = await artifactEncryption.decryptHeader(artifactUpdate.header.value);
                    updatedArtifact.title = header?.title || null;
                    updatedArtifact.sessions = header?.sessions;
                    updatedArtifact.draft = header?.draft;
                    updatedArtifact.headerVersion = artifactUpdate.header.version;
                }
                
                // Decrypt and update body if provided
                if (artifactUpdate.body) {
                    const body = await artifactEncryption.decryptBody(artifactUpdate.body.value);
                    updatedArtifact.body = body?.body || null;
                    updatedArtifact.bodyVersion = artifactUpdate.body.version;
                }
                
                storage.getState().updateArtifact(updatedArtifact);
                log.log(`📦 Updated artifact ${artifactId} in storage`);
            } catch (error) {
                console.error(`Failed to process artifact update ${artifactId}:`, error);
            }
        } else if (updateData.body.t === 'delete-artifact') {
            log.log('📦 Received delete-artifact update');
            const artifactUpdate = updateData.body;
            const artifactId = artifactUpdate.artifactId;
            
            // Remove from storage
            storage.getState().deleteArtifact(artifactId);
            
            // Remove encryption key from memory
            this.artifactDataKeys.delete(artifactId);
        } else if (updateData.body.t === 'new-feed-post') {
            log.log('📰 Received new-feed-post update');
            const feedUpdate = updateData.body;
            
            // Convert to FeedItem with counter from cursor
            const feedItem: FeedItem = {
                id: feedUpdate.id,
                body: feedUpdate.body,
                cursor: feedUpdate.cursor,
                createdAt: feedUpdate.createdAt,
                repeatKey: feedUpdate.repeatKey,
                counter: parseInt(feedUpdate.cursor.substring(2), 10)
            };
            
            // Check if we need to fetch user for friend-related items
            if (feedItem.body && (feedItem.body.kind === 'friend_request' || feedItem.body.kind === 'friend_accepted')) {
                await this.assumeUsers([feedItem.body.uid]);
                
                // Check if user fetch failed (404) - don't store item if user not found
                const users = storage.getState().users;
                const userProfile = users[feedItem.body.uid];
                if (userProfile === null || userProfile === undefined) {
                    // User was not found or 404, don't store this item
                    log.log(`📰 Skipping feed item ${feedItem.id} - user ${feedItem.body.uid} not found`);
                    return;
                }
            }
            
            // Apply to storage (will handle repeatKey replacement)
            storage.getState().applyFeedItems([feedItem]);
        }
    }

    private flushActivityUpdates = (updates: Map<string, ApiEphemeralActivityUpdate>) => {
        // log.log(`🔄 Flushing activity updates for ${updates.size} sessions - acquiring lock`);


        const sessions: Session[] = [];

        for (const [sessionId, update] of updates) {
            const session = storage.getState().sessions[sessionId];
            if (session) {
                sessions.push({
                    ...session,
                    active: update.active,
                    activeAt: update.activeAt,
                    thinking: update.thinking ?? false,
                    thinkingAt: update.activeAt // Always use activeAt for consistency
                });
            }
        }

        if (sessions.length > 0) {
            // console.log('flushing activity updates ' + sessions.length);
            this.applySessions(sessions);
            // log.log(`🔄 Activity updates flushed - updated ${sessions.length} sessions`);
        }
    }

    private handleEphemeralUpdate = (update: unknown) => {
        const validatedUpdate = ApiEphemeralUpdateSchema.safeParse(update);
        if (!validatedUpdate.success) {
            console.log('Invalid ephemeral update received:', validatedUpdate.error);
            console.error('Invalid ephemeral update received:', update);
            return;
        } else {
            // console.log('Ephemeral update received:', update);
        }
        const updateData = validatedUpdate.data;

        // Process activity updates through smart debounce accumulator
        if (updateData.type === 'activity') {
            // console.log('adding activity update ' + updateData.id);
            this.activityAccumulator.addUpdate(updateData);
        }

        // Handle machine activity updates
        if (updateData.type === 'machine-activity') {
            // Update machine's active status and lastActiveAt
            const machine = storage.getState().machines[updateData.id];
            if (machine) {
                const updatedMachine: Machine = {
                    ...machine,
                    active: updateData.active,
                    activeAt: updateData.activeAt
                };
                storage.getState().applyMachines([updatedMachine]);
            }
        }

        // Session-level lifecycle event (Claude finished, needs permission, asks question).
        // This is the same signal that triggers the mobile push — bump browser-tab
        // unread counter on these only, ignore the noisy per-message stream.
        if (updateData.type === 'session-event') {
            notifyUnreadMessage();
        }

        // daemon-status ephemeral updates are deprecated, machine status is handled via machine-activity
    }

    //
    // Apply store
    //

    private applyMessages = (sessionId: string, messages: NormalizedMessage[], source: 'sync' | 'preload' = 'sync') => {
        const planMode = messagePlanMode(messages);
        if (planMode !== null) this.preloadedPlanModes.delete(sessionId);
        const applyStarted = Date.now();
        const result = storage.getState().applyMessages(sessionId, messages, source);
        const applyElapsed = Date.now() - applyStarted;
        if (applyElapsed > 8) {
            const total = storage.getState().sessionMessages[sessionId]?.messages.length ?? 0;
            console.log(`[perf] applyMessages ${sessionId} ${applyElapsed}ms batch=${messages.length} total=${total}`);
        }
        // History preparation is cache hydration, not a new agent event. It
        // must not send voice prompts or change the agent's operating mode.
        if (source === 'preload') {
            if (result.enteredPlanMode) {
                this.preloadedPlanModes.set(sessionId, storage.getState().sessions[sessionId]?.permissionMode);
            }
            return;
        }
        // Settle-only changes re-render an existing row; announcing one to
        // voice would repeat "User sent message" when its receipt arrives.
        const settledOnly = new Set(result.settledMessageIds);
        let m: Message[] = [];
        for (let messageId of result.changed) {
            if (settledOnly.has(messageId)) {
                continue;
            }
            const message = storage.getState().sessionMessages[sessionId].messagesMap[messageId];
            if (message) {
                m.push(message);
            }
        }
        if (m.length > 0) {
            voiceHooks.onMessages(sessionId, m);
        }
        if (result.hasReadyEvent) {
            voiceHooks.onReady(sessionId);
        }
        if (result.enteredPlanMode) {
            // The EnterPlanMode auto-switch only wrote the local mirror; push
            // it into synced metadata so other devices see plan mode and the
            // next inbound metadata update doesn't revert it (#1492)
            sessionSetAgentModes(sessionId, { permissionMode: 'plan' });
        }
    }

    private applySessions = (sessions: (Omit<Session, "presence"> & {
        presence?: "online" | number;
    })[]) => {
        const active = storage.getState().getActiveSessions();
        storage.getState().applySessions(sessions);
        for (const session of sessions) this.sessionAvatars.refresh(session.id);
        const newActive = storage.getState().getActiveSessions();
        this.applySessionDiff(active, newActive);
    }

    private applySessionDiff = (active: Session[], newActive: Session[]) => {
        let wasActive = new Set(active.map(s => s.id));
        let isActive = new Set(newActive.map(s => s.id));
        for (let s of active) {
            if (!isActive.has(s.id)) {
                voiceHooks.onSessionOffline(s.id, s.metadata ?? undefined);
            }
        }
        for (let s of newActive) {
            if (!wasActive.has(s.id)) {
                voiceHooks.onSessionOnline(s.id, s.metadata ?? undefined);
            }
        }
    }

}

// Global singleton instance
export const sync = new Sync();

//
// Init sequence
//

let isInitialized = false;
let initialization: Promise<void> | null = null;
export async function syncCreate(credentials: AuthCredentials) {
    await initializeSync(credentials, false);
}

export async function syncRestore(credentials: AuthCredentials) {
    await initializeSync(credentials, true);
}

async function initializeSync(credentials: AuthCredentials, restore: boolean) {
    if (isInitialized) {
        console.warn('Sync already initialized: ignoring');
        return;
    }
    if (initialization) return initialization;
    initialization = syncInit(credentials, restore);
    try {
        await initialization;
        isInitialized = true;
    } catch (error) {
        // A failed initialization is not a ready workspace. A later recovery
        // must actually initialize, not silently skip because a flag was set.
        apiSocket.disconnect();
        throw error;
    } finally { initialization = null; }
}

async function syncInit(credentials: AuthCredentials, restore: boolean) {

    // Initialize sync engine
    const secretKey = decodeBase64(credentials.secret, 'base64url');
    if (secretKey.length !== 32) {
        throw new Error(`Invalid secret key length: ${secretKey.length}, expected 32`);
    }
    const encryption = await Encryption.create(secretKey);

    // Initialize tracking
    initializeTracking(encryption.anonID);

    // Initialize socket connection
    const API_ENDPOINT = getServerUrl();
    apiSocket.initialize({ endpoint: API_ENDPOINT, token: credentials.token }, encryption);

    // Wire socket status to storage
    apiSocket.onStatusChange((status) => {
        storage.getState().setSocketStatus(status);
    });

    // Initialize sessions engine
    if (restore) {
        await sync.restore(credentials, encryption);
    } else {
        await sync.create(credentials, encryption);
    }
}
