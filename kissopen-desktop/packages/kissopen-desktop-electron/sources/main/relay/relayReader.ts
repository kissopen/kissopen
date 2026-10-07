/*
Reads the account's relay: its machines, and the sessions on them.

This is the half of the desktop that has been missing. The desktop already
writes to this relay — it configures the local Agent with the account's own
identity — but has never read it, so the rest of the account has been
invisible here: the person's other computers, and the cloud workspace, which
registers itself as one more machine.

Deliberately a reader and nothing else. It does not decide what a conversation
looks like on screen, and it does not own the local Agent connection, which
stays as it is: low latency, terminals, approvals. What it adds is everything
that is not this machine.

Runs in the main process, because the relay credential does, and hands the
renderer conversations that are already decrypted.
*/
import { t } from "kissopen-desktop-state/i18n";
import { kissopenAgentBoardParse, kissopenAgentProjectParse } from "kissopen-desktop-state";
import { randomUUID } from "node:crypto";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import { decodeBase64 } from "@kissopen/kissopen-sync/crypto/base64";
import { relayMessagesRead } from "./relayMessages";
import {
    RELAY_CACHE_MAX_MESSAGES as RELAY_CACHE_MAX_MESSAGES_KEPT,
    relayCachedMessagesMerge,
    type RelayCache,
    relayCachedHoleRuns,
    relayCachedSettle,
    type RelayCachedConversation,
    type RelayCachedMessage,
} from "./relayCache";
import { relaySendBody, relaySendLocalId } from "./relaySend";
import { relayAttachmentUpload, type RelayFile } from "./relayAttachments";
import { RelayTerminals, type RelayTerminalListener } from "./relayTerminals";
import { relayMachineKind, type RelayLocalIdentity } from "./relayMachineKind";
import { RELAY_ABORT_REASON, relayPermissionAnswer, relayRpcMethod } from "./relayCommands";
import { isRigMetadata, rigCanAbort, rigHasRpcMethod } from "@kissopen/kissopen-sync/rig";
import {
    getKissopenAgentGitState,
    readKissopenAgentGitFile,
    type AgentGitSession,
    type KissopenAgentFileContent,
    type KissopenAgentGitFile,
    type KissopenAgentGitState,
} from "@kissopen/kissopen-sync/agentGit";
import { projectMetadataRead } from "@kissopen/kissopen-sync/projectRecord";
import { getSessionProjectId } from "@kissopen/kissopen-sync/projectTypes";
import type { Message } from "@kissopen/kissopen-sync/typesMessage";
import type { AgentState } from "@kissopen/kissopen-sync/storageTypes";
import type {
    RelayDirectoryEntry,
    RelayMachineView,
    RelayProjectView,
    RelaySessionView,
    RelaySnapshotView,
    RelayTurn,
    RelayUsage,
} from "../../shared/relayContract";
import type { RelayCredentials } from "./relayCredentials";
import type { RelaySocket, RelayTransport } from "./relayTransport";

/*
Named again here only to keep the reader's own vocabulary readable. The
shapes are the contract the window is given, defined once in shared/.
*/
export type RelayMachine = RelayMachineView;
export type RelaySession = RelaySessionView;
export type RelaySnapshot = RelaySnapshotView;

interface RawSession {
    id: string;
    seq: number;
    active: boolean;
    updatedAt: number;
    metadata: string;
    metadataVersion: number;
    agentState?: string | null;
    agentStateVersion?: number;
    dataEncryptionKey?: string | null;
    projectId?: string | null;
}

/** What the relay sends when a listed conversation changes: only the fields that moved. */
interface SessionPatch {
    id?: string;
    metadata?: { value: string; version: number };
    agentState?: { value: string | null; version: number };
    projectId?: string | null;
}

interface RawMachine {
    id: string;
    active: boolean;
    activeAt: number;
    metadata: string;
    metadataVersion: number;
    dataEncryptionKey?: string | null;
}

function parse<T>(text: string, what: string): T {
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(t("{what}响应无法解析", { what: t(what) }));
    }
}

/*
The list inside a relay answer.

The two endpoints this reads do not agree with each other: `/v1/sessions`
answers with `{sessions: [...]}` and `/v1/machines` answers with a bare array.
Accepting both is not politeness — reading one of them the other way produced
an empty list rather than an error, and an account with no machines is a
believable, wrong picture.
*/
function listOf<T>(body: unknown, key: string, what: string): T[] {
    if (Array.isArray(body)) return body as T[];
    const named = (body as Record<string, unknown> | null)?.[key];
    if (Array.isArray(named)) return named as T[];
    throw new Error(t("{what}响应不是列表", { what: t(what) }));
}

/**
 * Connects to the account's relay and keeps a readable picture of it.
 *
 * `onChange` fires whenever that picture moves. The caller decides what to do
 * with it; this does not know about windows or IPC.
 */
/*
One part of a file read over the relay. Each part is one call that must be
answered within the relay's timeout, and on a slow connection — 50 KB/s is not
rare — a 384 KB part (about 700 KB on the wire once encrypted) is not; this
size is, with room. More calls for a large file, but every one of them lands.
*/
const RELAY_READ_PART_BYTES = 192 * 1024;
/** The largest file read in parts: a document to preview, not a data set. */
const RELAY_READ_MAX_FILE_BYTES = 32 * 1024 * 1024;

/*
How much of a conversation is read into the window at once. The whole of it is
kept on this computer; what is shown is its newest part, as the relay's own
list answer did at 150 — which cut a long working thread off mid-afternoon.
*/
const RELAY_SHOWN_MESSAGES = 1000;
/** One page of messages from the relay, the most it gives at a time. */
const RELAY_MESSAGES_PAGE = 500;
/*
How many runs of missing numbers one read asks for again. Each is one request;
a run that is still missing is asked for on the next read, so a long list of
them is worked through rather than asked for all at once.
*/
const RELAY_HOLE_RUNS_PER_READ = 8;
/** How many conversations the relay's list gives: its newest, by last update. */
const RELAY_SESSIONS_LISTED = 150;
/** Asks for the newest messages: every seq is below it. */
const RELAY_SEQ_NEWEST = 2147483647;
/*
How long a project's own files (the board, project.json) may keep the window
waiting when a copy of them is already here. The read goes on after that and
the copy is replaced when it lands; the board is read again within a minute.
*/
const RELAY_KEPT_FILE_WAIT_MS = 2500;
/** How soon after a change the lists are written to this computer, gathered. */
const RELAY_LISTS_SAVE_MS = 2000;

/** The relay answered, with something other than what was asked for. */
class RelayAnswerError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

function relayRefusedAccount(error: unknown): boolean {
    return error instanceof RelayAnswerError && (error.status === 401 || error.status === 403);
}

/** The machine refused a file — not there, too large, outside the workspace — rather than being unreachable. */
class RelayFileRefused extends Error {}

export class RelayReader {
    #credentials: RelayCredentials;
    #transport: RelayTransport;
    #encryption: Encryption | undefined;
    #socket: RelaySocket | undefined;
    #machines = new Map<string, RelayMachine>();
    #sessions = new Map<string, RelaySession>();
    /** Each session as the relay last described it, so a live change can be merged into it. */
    #raw = new Map<string, RawSession>();
    #listeners = new Set<(snapshot: RelaySnapshot) => void>();
    #arrivals = new Set<(sessionId: string) => void>();
    /** Sessions the relay currently says are working. */
    #thinking = new Map<string, boolean>();
    #activity = new Set<(sessionId: string, thinking: boolean) => void>();
    #connected = false;
    /** Whether the socket has been up before, so a connect is a reconnect. */
    #everConnected = false;

    /*
     * What this computer looks like, and which bot the account's cloud
     * workspace speaks as. Both arrive from outside: os and the business API
     * belong to the process that owns them, not to a reader of the relay.
     */
    #local: RelayLocalIdentity;
    #cloudBotId: string | undefined;

    /*
     * This computer's copy of what was read, when there is somewhere to keep
     * one. The lists are shown from it before the relay answers, and instead
     * of the relay when it does not; conversations and project files the same.
     */
    #cache: RelayCache | undefined;
    /** The lists were last shown from the copy here, so the first connect reads them again. */
    #stale = false;
    /** The relay's machine and project answers as last given, for the copy here. */
    #listBodies: { machines: unknown; projects: unknown } = { machines: [], projects: [] };
    #listsSaveTimer: ReturnType<typeof setTimeout> | undefined;
    /*
     * The conversations read lately, in memory, so a new message does not read
     * the whole of one back from the disk. The newest few; the rest are on disk.
     */
    #held = new Map<string, RelayCachedConversation>();
    /** When a live change last named each conversation, so a list read across it does not drop it. */
    #liveNamed = new Map<string, number>();
    /** One change at a time to each conversation's copy: a live read and a backfill meet here. */
    #heldLocks = new Map<string, Promise<unknown>>();
    /** A read of each conversation queued behind the lock and not yet started. */
    #messagesWaiting = new Map<
        string,
        Promise<{ conversation: RelayCachedConversation; offline: boolean }>
    >();

    constructor(
        credentials: RelayCredentials,
        transport: RelayTransport,
        local: RelayLocalIdentity,
        cloudBotId?: string,
        cache?: RelayCache,
    ) {
        this.#credentials = credentials;
        this.#transport = transport;
        this.#local = local;
        this.#cloudBotId = cloudBotId;
        this.#cache = cache;
    }

    /**
     * What this computer looks like changed — the local Agent said which
     * machine it is. Republished, so the roster's badges follow.
     */
    localSet(local: RelayLocalIdentity): void {
        if (
            local.host === this.#local.host &&
            local.homeDir === this.#local.homeDir &&
            local.machineId === this.#local.machineId
        )
            return;
        this.#local = local;
        const snapshot = this.snapshot();
        for (const listener of this.#listeners) listener(snapshot);
    }

    /** True once the socket is up. A snapshot can exist before this. */
    get connected(): boolean {
        return this.#connected;
    }

    onChange(listener: (snapshot: RelaySnapshot) => void): () => void {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    /**
     * The machine the account's cloud workspace runs on.
     *
     * Established from the sessions rather than from a machine's own metadata,
     * the way the phone establishes it: the business server names the cloud
     * bot, and the session that bot speaks in names its machine. A container's
     * hostname would not tell us this.
     */
    #cloudMachineId(): string | undefined {
        if (!this.#cloudBotId) return undefined;
        for (const session of this.#sessions.values()) {
            if (session.metadata?.bot?.id === this.#cloudBotId) return session.machineId;
        }
        return undefined;
    }

    /**
     * Learns which bot the cloud workspace speaks as, after the fact.
     *
     * The workspace is provisioned on sign-in and may not exist yet when the
     * reader starts, so the bot id it was constructed without can arrive
     * later. Re-published, because which machine is "the cloud" and which
     * conversations are its both hang on this.
     */
    cloudBotSet(botId: string | undefined): void {
        if (this.#cloudBotId === botId) return;
        this.#cloudBotId = botId;
        const snapshot = this.snapshot();
        for (const listener of this.#listeners) listener(snapshot);
    }

    /**
     * The conversation the account's cloud bot is holding.
     *
     * The most recently updated one, because the default bot keeps a long
     * conversation and anything said to it without naming a session belongs
     * in the one it is already in — starting another would scatter a person's
     * own thread across as many sessions as times they spoke from the bar.
     *
     * Undefined when the account has no cloud workspace, or has one whose bot
     * has not spoken yet. Both mean the same thing to a caller: there is
     * nowhere to put this yet.
     */
    cloudSessionId(): string | undefined {
        if (!this.#cloudBotId) return undefined;
        let latest: { id: string; updatedAt: number } | undefined;
        for (const session of this.#sessions.values()) {
            if (session.metadata?.bot?.id !== this.#cloudBotId) continue;
            if (!latest || session.updatedAt > latest.updatedAt)
                latest = { id: session.id, updatedAt: session.updatedAt };
        }
        return latest?.id;
    }

    snapshot(): RelaySnapshot {
        const cloudMachineId = this.#cloudMachineId();
        return {
            machines: [...this.#machines.values()]
                .map((machine) => ({
                    ...machine,
                    kind: relayMachineKind({
                        machineId: machine.id,
                        metadata: machine.metadata,
                        local: this.#local,
                        ...(cloudMachineId ? { cloudMachineId } : {}),
                    }),
                }))
                .sort((a, b) => b.activeAt - a.activeAt),
            sessions: [...this.#sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt),
            projects: this.#projectViews(),
            connected: this.#connected,
            thinking: [...this.#thinking.keys()],
        };
    }

    /*
    The account's projects, placed on the machines they are worked on.

    A project record does not say which computer it lives on — nothing in it
    could, since the same project can be opened anywhere. Its sessions do, so
    a project appears on a machine when that machine has worked in it, and on
    two machines when two have. That is also what makes the card honest: what
    it lists is what this reader can actually open there.
    */
    #projectViews(): RelayProjectView[] {
        const views = new Map<string, RelayProjectView & { sessions: number }>();
        for (const session of this.#sessions.values()) {
            if (!session.projectId || !session.machineId) continue;
            const key = `${session.machineId}:${session.projectId}`;
            const seen = views.get(key);
            if (seen) {
                seen.sessions += 1;
                if (session.updatedAt > seen.updatedAt)
                    (seen as { updatedAt: number }).updatedAt = session.updatedAt;
                continue;
            }
            views.set(key, {
                id: session.projectId,
                name: this.#projects.get(session.projectId) ?? null,
                machineId: session.machineId,
                sessions: 1,
                updatedAt: session.updatedAt,
            });
        }
        return [...views.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Loads what the account has, then follows it.
     *
     * The load comes first on purpose: a socket that starts delivering updates
     * for sessions this has never heard of would have to guess at the rest of
     * them, and guessing is how two devices end up disagreeing.
     */
    async start(): Promise<void> {
        this.#encryption = await Encryption.create(
            decodeBase64(this.#credentials.secret, "base64url"),
        );
        /*
         * What this computer kept from last time goes up first, so the lists
         * are there before the relay has said anything, and stay there when it
         * cannot be reached at all. A copy that cannot be read is no copy.
         */
        const kept = await this.#cache?.lists().catch(() => undefined);
        let shownFromKept = false;
        if (kept) {
            try {
                await this.#applyMachines(kept.machines);
                await this.#applyProjects(kept.projects);
                await this.#applySessions(kept.sessions);
                this.#listBodies = { machines: kept.machines, projects: kept.projects };
                shownFromKept = true;
                this.#announce();
            } catch (error) {
                console.warn(
                    "[relay] The copy of the lists on this computer could not be read",
                    error,
                );
            }
        }
        try {
            await this.#loadMachines();
            await this.#loadProjects();
            await this.#loadSessions();
        } catch (error) {
            // A relay that turned this account away is not one that is unreachable:
            // showing the copy would keep a person signed in to nothing.
            if (!shownFromKept || relayRefusedAccount(error)) throw error;
            console.warn("[relay] Showing this computer's copy; the relay did not answer", error);
            this.#stale = true;
        }
        this.#announce();
        this.#listen();
    }

    stop(): void {
        if (this.#listsSaveTimer) {
            clearTimeout(this.#listsSaveTimer);
            this.#listsSaveTimer = undefined;
            this.#listsSave();
        }
        // The attachments first: each is a stream on the socket that is about
        // to go, and a replica nobody can reach is not one worth holding.
        this.#terminals.closeAll();
        this.#socket?.close();
        this.#socket = undefined;
        this.#connected = false;
    }

    async #fetch(path: string, what: string): Promise<string> {
        const response = await this.#transport.get({
            serverUrl: this.#credentials.serverUrl,
            token: this.#credentials.token,
            path,
        });
        if (response.status !== 200)
            throw new RelayAnswerError(
                response.status,
                t("{what}读取失败（{status}）", { what: t(what), status: response.status }),
            );
        return response.text;
    }

    async #loadMachines(): Promise<void> {
        const body = parse<unknown>(await this.#fetch("/v1/machines", "机器列表"), "机器列表");
        await this.#applyMachines(body);
        this.#listBodies.machines = body;
        this.#listsSaveSoon();
    }

    async #applyMachines(body: unknown): Promise<void> {
        const raw = listOf<RawMachine>(body, "machines", "机器列表");
        const encryption = this.#encryption!;
        await encryption.initializeMachines(
            new Map(
                raw.map((machine) => [
                    machine.id,
                    machine.dataEncryptionKey ? decodeBase64(machine.dataEncryptionKey) : null,
                ]),
            ),
        );
        for (const machine of raw) {
            const decryptor = encryption.getMachineEncryption(machine.id);
            const metadata = decryptor
                ? await decryptor
                      .decryptMetadata(machine.metadataVersion, machine.metadata)
                      .catch(() => null)
                : null;
            this.#machines.set(machine.id, {
                id: machine.id,
                active: machine.active,
                activeAt: machine.activeAt,
                // Settled in snapshot(), where the cloud bot is known.
                kind: "other",
                metadata,
            });
        }
    }

    /** Project names, by project id. Null where this account cannot read one. */
    #projects = new Map<string, string | null>();

    /**
     * Reads the project list again when a conversation names a project this
     * desktop has not seen: the conversation can arrive before the project's
     * own update does.
     */
    async #projectsCatchUp(projectId: string | null | undefined): Promise<void> {
        if (!projectId || this.#projects.has(projectId)) return;
        await this.#loadProjects();
    }

    async #loadProjects(): Promise<void> {
        const body = parse<unknown>(await this.#fetch("/v1/projects", "项目列表"), "项目列表");
        await this.#applyProjects(body);
        this.#listBodies.projects = body;
        this.#listsSaveSoon();
    }

    async #applyProjects(body: unknown): Promise<void> {
        const raw = listOf<{ id: string; metadata: string; dataEncryptionKey: string | null }>(
            body,
            "projects",
            "项目列表",
        );
        for (const project of raw) {
            const metadata = await projectMetadataRead(project, this.#encryption!);
            this.#projects.set(project.id, metadata?.name ?? null);
        }
    }

    async #loadSessions(): Promise<void> {
        const startedAt = Date.now();
        const body = parse<unknown>(await this.#fetch("/v1/sessions", "会话列表"), "会话列表");
        await this.#applySessions(body, startedAt);
        this.#listsSaveSoon();
    }

    /*
     * A conversation the relay's list should have named and did not was
     * deleted somewhere while this desktop was not listening; keeping it —
     * above all one shown from the copy here — would offer a conversation
     * nobody can open. `listedAt` is when the list was asked for, and absent
     * for the copy's own list, which is only ever added to.
     *
     * But the list is the relay's newest 150, not all of them. A full list says
     * nothing about conversations older than its oldest, so those are kept, and
     * so is any conversation a live change named after the list was asked for.
     */
    async #applySessions(body: unknown, listedAt?: number): Promise<void> {
        const raw = listOf<RawSession>(body, "sessions", "会话列表");
        const encryption = this.#encryption!;
        await encryption.initializeSessions(
            new Map(
                raw.map((session) => [
                    session.id,
                    session.dataEncryptionKey ? decodeBase64(session.dataEncryptionKey) : null,
                ]),
            ),
        );
        for (const session of raw) await this.#applySession(session);
        if (listedAt === undefined) return;
        const named = new Set(raw.map((session) => session.id));
        const complete = raw.length < RELAY_SESSIONS_LISTED;
        const oldestListed = Math.min(...raw.map((session) => session.updatedAt));
        for (const [id, session] of [...this.#raw]) {
            if (named.has(id)) continue;
            if (!complete && session.updatedAt < oldestListed) continue;
            if ((this.#liveNamed.get(id) ?? 0) >= listedAt) continue;
            this.#sessions.delete(id);
            this.#raw.delete(id);
        }
        // What a live change named is only needed against lists asked for after it.
        for (const [id, at] of this.#liveNamed) if (at < listedAt) this.#liveNamed.delete(id);
    }

    /*
     * The lists as this desktop now holds them, written to the copy here a
     * moment later: changes arrive in bursts, and each one is not worth a
     * write. Conversations are written as merged with every live change, so
     * the copy is the picture that was on screen, not the one at start.
     */
    #listsSaveSoon(): void {
        if (!this.#cache || this.#listsSaveTimer) return;
        this.#listsSaveTimer = setTimeout(() => {
            this.#listsSaveTimer = undefined;
            this.#listsSave();
        }, RELAY_LISTS_SAVE_MS);
    }

    #listsSave(): void {
        void this.#cache?.listsSave({
            machines: this.#listBodies.machines,
            projects: this.#listBodies.projects,
            sessions: { sessions: [...this.#raw.values()] },
        });
    }

    /*
     * The terminal attachments this process is holding for the window.
     *
     * Held here because the socket is: a stream is opened on the connection
     * this reader owns, and handing that connection out would hand out the
     * account's credential with it.
     */
    readonly #terminals = new RelayTerminals();

    /** The encrypted agent state each session last reported, by session id. */
    #agentStates = new Map<string, { version: number; encrypted: string | null }>();

    async #applySession(session: RawSession): Promise<void> {
        this.#raw.set(session.id, session);
        const decryptor = this.#encryption!.getSessionEncryption(session.id);
        // A session whose key this account cannot open is still listed, with
        // its name missing. Dropping it would make a conversation that exists
        // look like one that does not.
        // One record that cannot be opened stays listed without its details;
        // a throw here used to fail the whole load and blank every cloud list.
        const metadata = decryptor
            ? await decryptor
                  .decryptMetadata(session.metadataVersion, session.metadata)
                  .catch(() => null)
            : null;
        this.#agentStates.set(session.id, {
            version: session.agentStateVersion ?? 0,
            encrypted: session.agentState ?? null,
        });
        /*
         * Which project this conversation belongs to, read the way the rest
         * of the account reads it: the column first, then the metadata the
         * older clients wrote. Doing it by hand here would put this desktop
         * in a different project from the phone for the same session.
         */
        const projectId = getSessionProjectId({
            projectId: session.projectId ?? null,
            metadata,
        } as never);
        this.#sessions.set(session.id, {
            id: session.id,
            seq: session.seq,
            active: session.active,
            updatedAt: session.updatedAt,
            machineId: metadata?.machineId,
            projectId: projectId ?? undefined,
            metadata,
        });
        this.#listsSaveSoon();
    }

    /**
     * One conversation, read on demand.
     *
     * Read from the copy this computer keeps, brought up to date with only
     * what the relay has that the copy does not. When the relay cannot be
     * reached the copy is the answer, and says so; a conversation never read
     * here before has nothing to fall back on and fails as it always did.
     */
    async conversation(sessionId: string): Promise<{
        messages: Message[];
        agentState: AgentState;
        usage: RelayUsage | undefined;
        turns: RelayTurn[];
        offline?: true;
    }> {
        const { conversation, offline } = await this.#messages(sessionId);
        const body = { messages: conversation.messages.slice(-RELAY_SHOWN_MESSAGES) };
        const decryptor = this.#encryption!.getSessionEncryption(sessionId);
        const stored = this.#agentStates.get(sessionId);
        /*
         * What the agent is doing, as it last reported. The reducer folds it
         * into the transcript — a permission still waiting, a tool still
         * running — so it has to arrive with the messages rather than after.
         */
        const agentState = decryptor
            ? await decryptor
                  .decryptAgentState(stored?.version ?? 0, stored?.encrypted)
                  .catch(() => ({}))
            : {};
        const read = await relayMessagesRead(this.#encryption!, sessionId, body, agentState);
        return {
            messages: read.messages,
            agentState,
            usage: read.usage,
            turns: read.turns,
            ...(offline ? { offline: true as const } : {}),
        };
    }

    /** One page of a conversation's messages, as the relay stores them. */
    async #messagesPage(
        sessionId: string,
        query: string,
    ): Promise<{ messages: RelayCachedMessage[]; hasMore: boolean }> {
        const body = parse<{ messages?: unknown; hasMore?: unknown }>(
            await this.#fetch(
                `/v3/sessions/${encodeURIComponent(sessionId)}/messages?${query}`,
                "消息",
            ),
            "消息",
        );
        if (!Array.isArray(body?.messages)) throw new Error(t("消息响应不是列表"));
        return { messages: body.messages as RelayCachedMessage[], hasMore: body.hasMore === true };
    }

    /*
     * Changes to one conversation's copy, one at a time. The read someone is
     * waiting on and the backfill of older messages both land here, and two
     * of them merging from the same starting point would drop what the other
     * added.
     */
    #heldChange<T>(sessionId: string, change: () => Promise<T>): Promise<T> {
        const previous = this.#heldLocks.get(sessionId) ?? Promise.resolve();
        const next = previous.then(change, change);
        const settled = next.catch(() => undefined);
        this.#heldLocks.set(sessionId, settled);
        void settled.then(() => {
            if (this.#heldLocks.get(sessionId) === settled) this.#heldLocks.delete(sessionId);
        });
        return next;
    }

    /** Remembers a conversation's copy, in memory for the next read and on disk for the next start. */
    #hold(sessionId: string, conversation: RelayCachedConversation, save: boolean): void {
        this.#held.delete(sessionId);
        this.#held.set(sessionId, conversation);
        // The eight read last stay in memory; the rest are on disk.
        for (const id of this.#held.keys()) {
            if (this.#held.size <= 8) break;
            this.#held.delete(id);
        }
        if (save) void this.#cache?.messagesSave(sessionId, conversation);
    }

    /** Drops a conversation's copy: it was deleted, or cleared, somewhere. */
    #forget(sessionId: string): void {
        this.#held.delete(sessionId);
        void this.#cache?.messagesDrop(sessionId);
    }

    /** Every message after `afterSeq`, a page at a time. */
    async #messagesAfter(sessionId: string, afterSeq: number): Promise<RelayCachedMessage[]> {
        const fresh: RelayCachedMessage[] = [];
        let after = afterSeq;
        for (;;) {
            const page = await this.#messagesPage(
                sessionId,
                `after_seq=${after}&limit=${RELAY_MESSAGES_PAGE}`,
            );
            fresh.push(...page.messages);
            const last = page.messages.at(-1);
            if (!page.hasMore || !last || last.seq <= after) return fresh;
            after = last.seq;
        }
    }

    /*
     * A conversation's copy, and whether it came from this computer because
     * the relay did not answer.
     *
     * A copy is brought forward from its newest message, and every number it
     * is missing is asked for again in the same read (see
     * RelayCachedConversation): a message the relay made visible a moment
     * after the one above it is picked up here rather than skipped for good.
     * The newest message is checked to still be there first: a conversation
     * cleared elsewhere keeps numbering where it was, and without the check the
     * copy would go on showing everything that was cleared. A conversation with
     * no copy starts from its newest page, and the older ones are read after.
     */
    #messages(
        sessionId: string,
    ): Promise<{ conversation: RelayCachedConversation; offline: boolean }> {
        /*
         * Every new message nudges the window to read again, and a busy agent
         * sends them faster than a read takes. A read not yet started already
         * answers every nudge that arrives before it starts, so they share it
         * rather than queue one full read each behind the lock.
         */
        const waiting = this.#messagesWaiting.get(sessionId);
        if (waiting) return waiting;
        const read = this.#heldChange(sessionId, async () => {
            if (this.#messagesWaiting.get(sessionId) === read)
                this.#messagesWaiting.delete(sessionId);
            return this.#messagesRead(sessionId);
        });
        this.#messagesWaiting.set(sessionId, read);
        void read
            .catch(() => undefined)
            .then(() => {
                if (this.#messagesWaiting.get(sessionId) === read)
                    this.#messagesWaiting.delete(sessionId);
            });
        return read;
    }

    async #messagesRead(
        sessionId: string,
    ): Promise<{ conversation: RelayCachedConversation; offline: boolean }> {
        {
            const held =
                this.#held.get(sessionId) ??
                (await this.#cache?.messages(sessionId).catch(() => undefined));
            try {
                const newest = held?.messages.at(-1);
                if (held && newest) {
                    const runs = relayCachedHoleRuns(held.holes, RELAY_HOLE_RUNS_PER_READ);
                    const [anchor, forward, ...refilled] = await Promise.all([
                        this.#messagesPage(sessionId, `before_seq=${newest.seq + 1}&limit=1`),
                        this.#messagesAfter(sessionId, newest.seq),
                        ...runs.map((run) =>
                            this.#messagesPage(
                                sessionId,
                                `after_seq=${run.from - 1}&limit=${Math.min(run.to - run.from + 1, RELAY_MESSAGES_PAGE)}`,
                            ),
                        ),
                    ]);
                    if (anchor.messages[0]?.id === newest.id) {
                        const checked = new Set<number>();
                        for (const run of runs)
                            for (let seq = run.from; seq <= run.to; seq += 1) checked.add(seq);
                        const fresh = [...forward, ...refilled.flatMap((page) => page.messages)];
                        const messages =
                            fresh.length === 0
                                ? held.messages
                                : relayCachedMessagesMerge(held.messages, fresh);
                        const next = {
                            messages,
                            ...relayCachedSettle(messages, held, checked, Date.now()),
                        };
                        const changed =
                            fresh.length > 0 ||
                            next.settledSeq !== held.settledSeq ||
                            JSON.stringify(next.holes) !== JSON.stringify(held.holes);
                        this.#hold(sessionId, next, changed);
                        return { conversation: next, offline: false };
                    }
                }
                const latest = await this.#messagesPage(
                    sessionId,
                    `before_seq=${RELAY_SEQ_NEWEST}&limit=${RELAY_MESSAGES_PAGE}`,
                );
                const messages = relayCachedMessagesMerge([], latest.messages);
                const start = { settledSeq: (messages[0]?.seq ?? 1) - 1, holes: {} };
                const next = {
                    messages,
                    ...relayCachedSettle(messages, start, new Set(), Date.now()),
                };
                this.#hold(sessionId, next, true);
                if (latest.hasMore && messages[0]) this.#backfill(sessionId, messages[0].seq);
                return { conversation: next, offline: false };
            } catch (error) {
                if (!held) throw error;
                console.warn("[relay] Showing this computer's copy of a conversation", error);
                this.#hold(sessionId, held, false);
                return { conversation: held, offline: true };
            }
        }
    }

    /*
     * The older part of a conversation read here for the first time, a page at
     * a time after the newest one is on screen, until the copy is full or the
     * conversation has no more. Stops quietly: what is missing is read the
     * next time the conversation has no copy. Only adds below the copy's
     * oldest message, so how far the copy is settled does not change.
     */
    #backfill(sessionId: string, beforeSeq: number): void {
        void (async () => {
            let before = beforeSeq;
            for (;;) {
                const page = await this.#messagesPage(
                    sessionId,
                    `before_seq=${before}&limit=${RELAY_MESSAGES_PAGE}`,
                );
                const full = await this.#heldChange(sessionId, async () => {
                    const held =
                        this.#held.get(sessionId) ??
                        (await this.#cache?.messages(sessionId).catch(() => undefined));
                    // Cleared or deleted meanwhile: nothing to add older messages to.
                    if (!held || held.messages.length === 0) return true;
                    const messages = relayCachedMessagesMerge(page.messages, held.messages);
                    this.#hold(sessionId, { ...held, messages }, true);
                    return messages.length >= RELAY_CACHE_MAX_MESSAGES_KEPT;
                });
                const oldest = page.messages.reduce(
                    (lowest, message) => Math.min(lowest, message.seq),
                    before,
                );
                if (full || !page.hasMore || oldest >= before) return;
                before = oldest;
            }
        })().catch((error: unknown) =>
            console.warn("[relay] Reading a conversation's older messages stopped", error),
        );
    }

    /*
    Asks the machine this conversation runs on to do something.

    Encrypted under the session's own key and sent as an acknowledged call: the
    relay forwards bytes it cannot read, and the agent on the other end is the
    one that answers. Everything about the shape is the phone's, because that
    agent has one reader, not one per client.
    */
    async #ask<Result>(sessionId: string, verb: string, params: unknown): Promise<Result> {
        const socket = this.#socket;
        // Not a silent no-op: on the other end is a machine that either
        // answers or does not, and a control that quietly did nothing is
        // worse than one that is not offered.
        if (!socket) throw new Error(t("还没有连上账号的中继"));
        const encryption = this.#encryption!.getSessionEncryption(sessionId);
        if (!encryption) throw new Error(t("这段对话无法用当前账号的密钥打开"));
        const answer = await socket.rpc(
            relayRpcMethod(sessionId, verb),
            await encryption.encryptRaw(params),
        );
        if (!answer.ok) throw new Error(answer.error || t("那台机器拒绝了这次操作"));
        // Answered under the same key it was asked under. The relay carried
        // bytes it could not read in either direction.
        return (await encryption.decryptRaw(answer.result)) as Result;
    }

    browserControl(
        sessionId: string,
        request: import("@kissopen/kissopen-agent-client").BrowserControlRequest,
    ) {
        return this.#ask<import("@kissopen/kissopen-agent-client").BrowserControlResponse>(
            sessionId,
            "browserControl",
            request,
        );
    }

    /**
     * Clears an assistant's conversation: its agent deletes every message and
     * starts over, and the relay's copy is replaced by an empty one. The
     * assistant stays. A working agent refuses, with its own reason; an agent
     * too old to know the request says nothing this desktop can read, and is
     * reported as needing an update.
     */
    async clear(sessionId: string): Promise<void> {
        const answer = await this.#ask<{
            success?: boolean;
            message?: string;
            error?: string;
        }>(sessionId, "clearConversation", {});
        if (answer?.success === true) {
            this.#forget(sessionId);
            return;
        }
        if (answer?.success === false && answer.message)
            throw new Error(
                answer.message.includes("stop it before clearing")
                    ? t("助手正在工作，先停止它再清空")
                    : answer.message,
            );
        throw new Error(t("云端助手需要更新后才能清空对话"));
    }

    /**
     * Archives a conversation, the way the phone does: its agent is asked to
     * archive it, and the agent marks it archived for every client. Nothing is
     * lost; it leaves the lists. The agent has to be reachable to do it.
     */
    async archive(sessionId: string): Promise<void> {
        if (this.#sessions.get(sessionId)?.metadata?.bot)
            throw new Error(t("这是助手的长期对话，不能归档"));
        try {
            const answer = await this.#ask<{
                success?: boolean;
                error?: unknown;
                message?: unknown;
            } | null>(sessionId, "killSession", {});
            // An empty/undecodable acknowledgement is not an archive. In
            // particular, it must reach the machine fallback rather than
            // silently leaving the conversation in the open tab strip.
            if (answer?.success !== true || answer.error) {
                throw new Error(
                    typeof answer?.error === "string"
                        ? answer.error
                        : typeof answer?.message === "string"
                          ? answer.message
                          : t("没能归档这段对话。"),
                );
            }
        } catch (error) {
            // A conversation its agent holds no live connection for — one it
            // archived itself, or one past its connection limit — answers
            // nothing; its machine is always there and can archive it instead.
            if (!(await this.#archiveThroughMachine(sessionId))) throw error;
        }
    }

    /** Asks the conversation's machine to archive it; false when it cannot. */
    async #archiveThroughMachine(sessionId: string): Promise<boolean> {
        const socket = this.#socket;
        const machineId = this.#sessions.get(sessionId)?.machineId;
        const encryption = machineId
            ? this.#encryption?.getMachineEncryption(machineId)
            : undefined;
        if (!socket || !machineId || !encryption) return false;
        const answer = await socket.rpc(
            `${machineId}:archive-kissopen-session`,
            await encryption.encryptRaw({ sessionId }),
        );
        if (!answer.ok) return false;
        const result = (await encryption.decryptRaw(answer.result)) as {
            success?: boolean;
            error?: unknown;
        } | null;
        return result?.success === true && !result.error;
    }

    /**
     * Deletes a conversation for good. Its agent archives it first, so it does
     * not publish the conversation again, and only then is the relay's copy —
     * its messages and files — removed. An agent that cannot be reached leaves
     * the conversation where it is rather than half gone.
     */
    async remove(sessionId: string): Promise<void> {
        if (this.#sessions.get(sessionId)?.metadata?.bot)
            throw new Error(t("这是助手的长期对话，不能删除"));
        const remove = this.#transport.delete?.bind(this.#transport);
        if (remove === undefined) throw new Error(t("这个版本还不能删除对话"));
        try {
            await this.#command(sessionId, "killSession", {});
        } catch {
            throw new Error(t("云端助手现在连不上，稍后再删"));
        }
        const response = await remove({
            serverUrl: this.#credentials.serverUrl,
            token: this.#credentials.token,
            path: `/v1/sessions/${encodeURIComponent(sessionId)}`,
        });
        if (response.status !== 200 && response.status !== 404)
            throw new Error(t("删除失败（{status}）", { status: response.status }));
        this.#raw.delete(sessionId);
        this.#forget(sessionId);
        if (this.#sessions.delete(sessionId)) this.#announce();
    }

    /*
     * A call whose answer only says whether it worked. The agent reports a
     * refusal inside that answer — an answer it could not read, a question no
     * longer waiting — and ignoring it showed the reader nothing while the card
     * simply stayed.
     */
    async #command(sessionId: string, verb: string, params: unknown): Promise<void> {
        const answer = await this.#ask<{ success?: boolean; error?: unknown } | null>(
            sessionId,
            verb,
            params,
        );
        if (answer && typeof answer === "object" && (answer.success === false || answer.error)) {
            throw new Error(
                t("那台机器没有接受这次操作：{reason}", {
                    reason: typeof answer.error === "string" ? answer.error : t("原因未知"),
                }),
            );
        }
    }

    /*
    One session, as the shared Git reader needs it.

    That reader is the phone's, moved into the shared package: what it decodes
    is not obvious — a side arrives base64 or not, a file may be binary, an
    image, a rename, or too large to diff — and a second implementation here
    would show the same change differently on a phone and on this desktop.

    It is given the session rather than reaching for one, so the only thing
    this file contributes is the wire.
    */
    #gitSession(sessionId: string): AgentGitSession {
        return {
            rpc: (method, params) => this.#ask(sessionId, method, params),
            metadata: this.#sessions.get(sessionId)?.metadata,
        };
    }

    /**
     * What this session's checkout looks like right now: the branch, the
     * comparison base, and every file that differs from it.
     *
     * Refused by the shared reader when the session does not advertise the
     * Git surface, rather than asked and left waiting for an answer that is
     * not coming.
     */
    async gitState(sessionId: string): Promise<KissopenAgentGitState> {
        return getKissopenAgentGitState(this.#gitSession(sessionId));
    }

    /*
    The terminals standing in one session's folder.

    Four ordinary calls, answered once each. The session refuses them outright
    when its machine offers no terminals, which is why they are asked rather
    than assumed: a reader told "no terminals" would start one, and a machine
    that cannot start one has to say so in those words.
    */
    async terminalList(sessionId: string): Promise<unknown> {
        return this.#ask(sessionId, "terminalList", {});
    }

    async terminalCreate(sessionId: string, request: unknown): Promise<unknown> {
        return this.#ask(sessionId, "terminalCreate", request);
    }

    async terminalResize(sessionId: string, request: unknown): Promise<unknown> {
        return this.#ask(sessionId, "terminalResize", request);
    }

    async terminalStop(sessionId: string, request: unknown): Promise<unknown> {
        return this.#ask(sessionId, "terminalStop", request);
    }

    /**
     * Attaches to one terminal there, answering the handle to address it by.
     *
     * The stream stays open and carries the machine's own attach protocol.
     * Nothing here reads those bytes: what they mean is settled on the other
     * side, and a second opinion would be a second thing to keep true.
     */
    async terminalAttach(
        sessionId: string,
        terminalId: string,
        listener: RelayTerminalListener,
    ): Promise<number> {
        const socket = this.#socket;
        if (!socket) throw new Error(t("还没有连上账号的中继"));
        // Sealed under the session's own key, like every call to it. A session
        // this account cannot open is not one it can watch a terminal in.
        const cipher = this.#encryption?.getSessionEncryption(sessionId);
        if (!cipher) throw new Error(t("这段对话无法用当前账号的密钥打开"));
        return await this.#terminals.attach(socket, sessionId, terminalId, listener, cipher);
    }

    /** Sends what the reader typed into one attachment. */
    async terminalWrite(handle: number, chunk: Uint8Array): Promise<void> {
        await this.#terminals.write(handle, chunk);
    }

    /** Lets go of one attachment. The terminal itself lives on without it. */
    terminalDetach(handle: number): void {
        this.#terminals.close(handle);
    }

    /** Project metadata has independent disk and network reads, with no silent fallback. */
    async projectFileRead(
        sessionId: string,
        path: string,
        options: {
            readonly source: "cache" | "remote";
            readonly machineId: string;
            readonly projectId: string;
            readonly projectPath: string;
        },
    ): Promise<Uint8Array | undefined> {
        if (path !== ".kissopen/board.json" && path !== ".kissopen/project.json")
            throw new Error("Only project board metadata can be read through this channel.");
        const session = this.#sessions.get(sessionId);
        const machineId = session?.machineId;
        const place = session?.metadata?.path;
        if (
            !machineId ||
            typeof place !== "string" ||
            !place ||
            machineId !== options.machineId ||
            session?.projectId !== options.projectId ||
            place !== options.projectPath
        )
            throw new Error(t("暂时无法定位这个项目。"));
        if (options.source === "cache") return this.#cache?.file(machineId, place, path);
        if (!this.#connected) throw new Error(t("还没有连上账号的中继"));
        // A fresh read must never silently return cached bytes: the UI needs
        // to distinguish a verified update from an offline copy.
        const bytes = await this.#fileReadThere(sessionId, path);
        const text = Buffer.from(bytes).toString("utf8");
        const readable =
            path === ".kissopen/board.json"
                ? "document" in kissopenAgentBoardParse(text)
                : kissopenAgentProjectParse(text) !== undefined;
        // A half-written or malformed update must not replace a usable disk copy.
        if (readable) await this.#cache?.fileSave(machineId, place, path, bytes);
        return bytes;
    }

    /** Ordinary file previews retain their existing remote-first fallback policy. */
    async fileRead(sessionId: string, path: string): Promise<Uint8Array> {
        const session = this.#sessions.get(sessionId);
        const cache = this.#cache;
        const machineId = session?.machineId;
        const place = typeof session?.metadata?.path === "string" ? session.metadata.path : "";
        if (!cache || !machineId) return this.#fileReadThere(sessionId, path);
        /*
         * Every file read there is kept here, up to a size, by the machine and
         * the folder it came from. The read there is still made; the copy is
         * what is shown when that machine cannot be reached, and a file it
         * says is gone is dropped from here too, so a deleted board does not
         * live on in this computer's copy.
         */
        const kept = cache.file(machineId, place, path).catch(() => undefined);
        const there = this.#fileReadThere(sessionId, path).then(
            async (bytes) => {
                await cache.fileSave(machineId, place, path, bytes);
                return bytes;
            },
            async (error: unknown) => {
                if (error instanceof RelayFileRefused) {
                    await cache.fileDrop(machineId, place, path);
                    throw error;
                }
                const copy = await kept;
                if (!copy) throw error;
                console.warn("[relay] Showing this computer's copy of a file", error);
                return copy;
            },
        );
        /*
         * A project's own files — the board, project.json — are read every
         * minute, and a sleeping machine can take the relay's whole timeout to
         * not answer. With a copy here, the window waits a moment for the
         * fresh one and is then given the copy; the fresh one still lands in
         * the copy for the next read.
         */
        if (!path.replace(/\\/g, "/").split("/").includes(".kissopen")) return there;
        const copy = await kept;
        if (!copy) return there;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const waited = new Promise<Uint8Array>((resolve) => {
            timer = setTimeout(() => resolve(copy), RELAY_KEPT_FILE_WAIT_MS);
        });
        try {
            return await Promise.race([there, waited]);
        } finally {
            clearTimeout(timer);
            there.catch(() => undefined);
        }
    }

    async #fileReadThere(sessionId: string, path: string): Promise<Uint8Array> {
        /*
         * A project's board and project.json are asked of its machine first.
         * A conversation answers only while its agent holds it connected, and
         * a project nobody has spoken in since the agent restarted has none —
         * its board then stayed empty however often it was asked. An agent too
         * old to serve this answers nothing useful, and the conversation is
         * asked as before.
         */
        const name = /^\.kissopen\/(board\.json|project\.json)$/.exec(
            path.replace(/\\/g, "/"),
        )?.[1];
        const session = this.#sessions.get(sessionId);
        const place = typeof session?.metadata?.path === "string" ? session.metadata.path : "";
        if (name && place && session?.machineId) {
            const read = await this.#projectFileThroughMachine(
                session.machineId,
                place,
                name,
            ).catch((error: unknown) => {
                if (error instanceof RelayFileRefused) throw error;
                return undefined;
            });
            if (read) return read;
        }
        return this.#fileReadThroughSession(sessionId, path);
    }

    /** One of a project's own files, read by the machine it is on; undefined when that machine does not serve it. */
    async #projectFileThroughMachine(
        machineId: string,
        place: string,
        name: string,
    ): Promise<Uint8Array | undefined> {
        const socket = this.#socket;
        const encryption = this.#encryption?.getMachineEncryption(machineId);
        if (!socket || !encryption) return undefined;
        const answer = await socket.rpc(
            `${machineId}:read-kissopen-project-file`,
            await encryption.encryptRaw({ directory: place, name }),
        );
        if (!answer.ok) return undefined;
        const result = (await encryption.decryptRaw(answer.result)) as {
            success?: boolean;
            content?: string;
            error?: string;
        } | null;
        if (result?.success === true && typeof result.content === "string")
            return Buffer.from(result.content, "base64");
        if (result?.success === false)
            throw new RelayFileRefused(result.error || t("那台机器没有给出这个文件"));
        return undefined;
    }

    async #fileReadThroughSession(sessionId: string, path: string): Promise<Uint8Array> {
        type Answer = {
            success?: boolean;
            content?: string;
            size?: number;
            error?: string;
        };
        // A refusal arrives as an answer, not as a throw: the agent says why —
        // too large, not there, not inside the workspace — and that sentence is
        // what the reader is shown.
        const part = async (offset: number): Promise<Answer & { content: string }> => {
            const answer = await this.#ask<Answer>(sessionId, "readFile", {
                path,
                offset,
                length: RELAY_READ_PART_BYTES,
            });
            if (answer?.success !== true || typeof answer.content !== "string")
                throw new RelayFileRefused(answer?.error || t("那台机器没有给出这个文件"));
            return answer as Answer & { content: string };
        };
        /*
         * Read in parts, the way the phone reads: one answer must fit the
         * relay's envelope, so a whole read stops at half a megabyte, and a
         * deck or a PDF is usually larger. An agent too old to read in parts
         * ignores the range and answers with the whole file, without a size;
         * that answer is the file.
         */
        const first = await part(0);
        if (typeof first.size !== "number") return Buffer.from(first.content, "base64");
        const size = first.size;
        if (size > RELAY_READ_MAX_FILE_BYTES) throw new Error(t("文件超过 32 MB，无法在这里预览"));
        const chunks = [Buffer.from(first.content, "base64")];
        let read = chunks[0]!.byteLength;
        while (read < size) {
            const next = await part(read);
            // A file that shrank while it was read ends early rather than loops.
            if (typeof next.size === "number" && next.size !== size)
                throw new Error(t("文件在读取时被修改了，请重新打开"));
            const bytes = Buffer.from(next.content, "base64");
            if (bytes.byteLength === 0) break;
            chunks.push(bytes);
            read += bytes.byteLength;
        }
        return Buffer.concat(chunks);
    }

    /**
     * One folder of the workspace a conversation works in.
     *
     * Asked only of a session that advertises the method: an agent too old to
     * list folders would leave the call unanswered until it timed out, and the
     * panel would say "loading" for that long about nothing. Entries that are
     * neither files nor folders are left out; there is nothing to open in one.
     */
    async directoryList(
        sessionId: string,
        path: string,
    ): Promise<{ entries: RelayDirectoryEntry[]; truncated: boolean }> {
        const metadata = this.#sessions.get(sessionId)?.metadata;
        if (!rigHasRpcMethod(metadata, "listDirectory"))
            throw new Error(t("那台机器上的助手还不能列出文件夹，更新后再试"));
        const answer = await this.#ask<{
            success?: boolean;
            entries?: { name?: unknown; type?: unknown; size?: unknown; modified?: unknown }[];
            truncated?: boolean;
            error?: string;
        }>(sessionId, "listDirectory", { path });
        if (answer?.success !== true || !Array.isArray(answer.entries))
            throw new Error(answer?.error || t("那台机器没有列出这个文件夹"));
        const entries: RelayDirectoryEntry[] = [];
        for (const entry of answer.entries) {
            if (typeof entry?.name !== "string") continue;
            if (entry.type !== "file" && entry.type !== "directory") continue;
            entries.push({
                name: entry.name,
                kind: entry.type,
                ...(typeof entry.size === "number" ? { size: entry.size } : {}),
                ...(typeof entry.modified === "number" ? { modified: entry.modified } : {}),
            });
        }
        return { entries, truncated: answer.truncated === true };
    }

    /**
     * Sends one file into the workspace a conversation works in, in parts.
     *
     * The same part size reads use, for the same reason: every part is one
     * call the relay has to answer within its timeout on a slow connection.
     * Parts go in order and each names where it starts, so the other machine
     * refuses one that does not follow and nothing is stitched in wrong. The
     * file lands under a free name; where is the answer.
     */
    async fileUpload(sessionId: string, path: string, bytes: Uint8Array): Promise<string> {
        const metadata = this.#sessions.get(sessionId)?.metadata;
        if (!rigHasRpcMethod(metadata, "uploadFile"))
            throw new Error(t("那台机器上的助手还不能接收文件，更新后再试"));
        if (bytes.byteLength > RELAY_READ_MAX_FILE_BYTES)
            throw new Error(t("文件超过 32 MB，不能上传"));
        const uploadId = randomUUID().replaceAll("-", "");
        let offset = 0;
        for (;;) {
            const end = Math.min(bytes.byteLength, offset + RELAY_READ_PART_BYTES);
            const done = end === bytes.byteLength;
            const answer = await this.#ask<{
                success?: boolean;
                done?: boolean;
                path?: string;
                error?: string;
            }>(sessionId, "uploadFile", {
                path,
                uploadId,
                offset,
                content: Buffer.from(bytes.subarray(offset, end)).toString("base64"),
                done,
            });
            if (answer?.success !== true)
                throw new Error(answer?.error || t("那台机器没有收下这个文件"));
            if (done) {
                if (typeof answer.path !== "string")
                    throw new Error(t("那台机器没有说文件存在哪里"));
                return answer.path;
            }
            offset = end;
        }
    }

    /** The two sides of one changed file, ready to be drawn as a diff. */
    async gitFile(
        sessionId: string,
        base: string,
        file: KissopenAgentGitFile,
    ): Promise<KissopenAgentFileContent> {
        return readKissopenAgentGitFile(this.#gitSession(sessionId), base, file);
    }

    /**
     * Answers a tool call that is waiting on a person.
     *
     * `requestId` is the request's own key in the agent state, not the tool
     * call's id: a subagent's request is published under a scoped key and must
     * be answered under that same key, or the agent keeps waiting.
     */
    async decide(sessionId: string, requestId: string, approved: boolean): Promise<void> {
        await this.#command(sessionId, "permission", relayPermissionAnswer(requestId, approved));
    }

    /**
     * Answers a question the agent put to the person, with the same command
     * the phone answers it: each question's chosen words, by question id.
     */
    async answerQuestion(
        sessionId: string,
        requestId: string,
        answers: Readonly<Record<string, readonly string[]>>,
    ): Promise<void> {
        await this.#command(sessionId, "communication", {
            id: requestId,
            status: "answered",
            answers,
        });
    }

    /** Takes a question away unanswered; the agent goes on without it. */
    async cancelQuestion(sessionId: string, requestId: string): Promise<void> {
        await this.#command(sessionId, "communication", { id: requestId, status: "dismissed" });
    }

    /**
     * Stops the run in progress.
     *
     * Refused rather than attempted when the session says it cannot be
     * stopped: an agent that does not publish the capability will not answer,
     * and the reader would be left watching a button that does nothing.
     */
    async abort(sessionId: string): Promise<void> {
        const metadata = this.#sessions.get(sessionId)?.metadata;
        if (!rigCanAbort(metadata)) throw new Error(t("这段对话不支持中断"));
        // A Rig session takes no reason: it writes its own. Every other agent
        // puts this text into the transcript as the tool result, which is what
        // the next turn reads to find out why it was interrupted.
        await this.#command(
            sessionId,
            "abort",
            isRigMetadata(metadata) ? {} : { reason: RELAY_ABORT_REASON },
        );
    }

    /**
     * Says something in a conversation on another machine.
     *
     * The relay authorises this on the account alone, so this desktop is as
     * entitled to it as the phone. The agent on the other end cannot tell
     * which of the account's clients typed it, and should not: it is the same
     * person either way.
     */
    async say(
        sessionId: string,
        text: string,
        mode?: { model?: string; modelProviderId?: string; effort?: string },
        files: readonly RelayFile[] = [],
        displayText?: string,
    ): Promise<void> {
        /*
         * Files are put into the store before the message that talks about
         * them is composed, so a failed upload fails the whole send. The
         * alternative — sending the text anyway — asks the agent about a
         * picture that is not there.
         */
        const stored = [];
        for (const file of files)
            stored.push(
                await relayAttachmentUpload(
                    this.#transport,
                    this.#credentials,
                    this.#encryption!,
                    sessionId,
                    file,
                ),
            );
        const localId = relaySendLocalId();
        const body = await relaySendBody(
            this.#encryption!,
            sessionId,
            text,
            localId,
            mode,
            stored,
            displayText,
        );
        const response = await this.#transport.post({
            serverUrl: this.#credentials.serverUrl,
            token: this.#credentials.token,
            path: `/v3/sessions/${encodeURIComponent(sessionId)}/messages`,
            body,
        });
        if (response.status !== 200)
            throw new Error(t("发送失败（{status}）", { status: response.status }));
    }

    #listen(): void {
        const socket = this.#transport.connect({
            serverUrl: this.#credentials.serverUrl,
            token: this.#credentials.token,
        });
        this.#socket = socket;
        socket.on("connect", () => {
            this.#connected = true;
            this.#announce();
            if (this.#everConnected || this.#stale) void this.#catchUp();
            this.#everConnected = true;
        });
        socket.on("disconnect", () => {
            this.#connected = false;
            // Nobody is saying these conversations work while the socket is
            // down, and a "stopped" said in the gap never arrives. The agents
            // that still work say so again within a minute of reconnecting.
            const working = [...this.#thinking.keys()];
            this.#thinking.clear();
            for (const sessionId of working)
                for (const listener of this.#activity) listener(sessionId, false);
            this.#announce();
        });
        socket.on("update", (payload) => {
            this.#update(payload).catch((error: unknown) =>
                console.warn("[relay] An update could not be applied", error),
            );
        });
        /*
         * Whether a session is working arrives here, not in the REST record:
         * the relay carries presence as ephemeral state, because it is true
         * only for as long as it is being said. It is also the one thing that
         * tells a reader whether they are waiting, so a transcript without it
         * looks finished the moment it is opened.
         */
        socket.on("ephemeral", (payload) => {
            const body = payload as { type?: string; id?: string; thinking?: boolean };
            if (body?.type !== "activity" || typeof body.id !== "string") return;
            const was = this.#thinking.get(body.id) ?? false;
            const now = body.thinking === true;
            if (was === now) return;
            if (now) this.#thinking.set(body.id, true);
            else this.#thinking.delete(body.id);
            for (const listener of this.#activity) listener(body.id, now);
        });
    }

    /**
     * Applies one durable change.
     *
     * Unknown shapes are ignored rather than thrown: the relay carries every
     * kind of change the account can make, including ones a desktop of this
     * version has no opinion about, and stopping the stream over one of them
     * would take the rest down with it.
     */
    async #update(payload: unknown): Promise<void> {
        const envelope = payload as { body?: { t?: string }; seq?: number; createdAt?: number };
        const body = envelope?.body;
        if (!body || typeof body.t !== "string") return;
        // The relay sends a new session's fields directly in the body, not
        // under a `session` key; reading only the key dropped every session
        // created while this desktop was running.
        if (body.t === "new-session") {
            const named = body as unknown as { session?: RawSession } & Partial<RawSession>;
            const session = named.session ?? (named as RawSession);
            if (!session?.id) return;
            this.#liveNamed.set(session.id, Date.now());
            const key = session.dataEncryptionKey ? decodeBase64(session.dataEncryptionKey) : null;
            await this.#encryption!.initializeSessions(new Map([[session.id, key]]));
            await this.#applySession(session);
            await this.#projectsCatchUp(session.projectId);
            this.#announce();
            return;
        }
        /*
         * A change to a conversation the relay already listed. This carries
         * only what changed — a new name, the agent's state, its project —
         * each as a value with the version the relay now holds. It is merged
         * into the record the relay gave last time, exactly as the phone does;
         * a conversation this desktop has not listed yet is left to the next
         * full load. The agent's state is what carries a question waiting for
         * an answer, so whoever is reading that conversation is told to ask
         * again, the same way a new message tells them.
         */
        if (body.t === "update-session") {
            const patch = body as unknown as SessionPatch;
            const previous = patch.id ? this.#raw.get(patch.id) : undefined;
            if (!previous) return;
            this.#liveNamed.set(previous.id, Date.now());
            await this.#applySession({
                ...previous,
                ...(typeof envelope.seq === "number" ? { seq: envelope.seq } : {}),
                ...(typeof envelope.createdAt === "number"
                    ? { updatedAt: envelope.createdAt }
                    : {}),
                ...(patch.metadata
                    ? { metadata: patch.metadata.value, metadataVersion: patch.metadata.version }
                    : {}),
                ...(patch.agentState
                    ? {
                          agentState: patch.agentState.value,
                          agentStateVersion: patch.agentState.version,
                      }
                    : {}),
                ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
            });
            await this.#projectsCatchUp(patch.projectId);
            this.#announce();
            if (patch.agentState) for (const listener of this.#arrivals) listener(previous.id);
            return;
        }
        // The relay names the deleted session `sid` here, unlike the `id` of
        // its other session updates.
        if (body.t === "delete-session") {
            const named = body as unknown as { sid?: string; id?: string };
            const id = named.sid ?? named.id;
            if (!id) return;
            this.#raw.delete(id);
            this.#forget(id);
            if (this.#sessions.delete(id)) this.#announce();
            return;
        }
        if (body.t === "new-machine" || body.t === "update-machine") {
            await this.#loadMachines();
            this.#announce();
            return;
        }
        /*
         * A project made or renamed while this desktop was running. Its name
         * is encrypted in the record, not in the update, so the list is read
         * again; without this a project that arrived after start stayed
         * nameless until the desktop restarted.
         */
        if (body.t === "new-project" || body.t === "update-project") {
            await this.#loadProjects();
            this.#announce();
            return;
        }
        /*
         * A new message in the conversation somebody is reading.
         *
         * Only a nudge is sent, not the message: the relay's update carries
         * one record, and splicing that into a transcript here would mean
         * reducing the same stream in two places. The window asks again, and
         * the reducer stays the single place that decides what a conversation
         * looks like.
         */
        if (body.t === "new-message") {
            const sessionId = (body as unknown as { sid?: string }).sid;
            if (sessionId) for (const listener of this.#arrivals) listener(sessionId);
        }
    }

    /*
     * Everything that changed while the socket was down.
     *
     * The relay does not replay updates to a reconnecting reader, so what
     * happened in the gap — a reply, a question, a new conversation — was
     * simply never seen, and the open conversation stayed as it was until the
     * app restarted. The lists are read again, and every conversation is told
     * it may have news, which makes the one being read ask again.
     */
    async #catchUp(): Promise<void> {
        try {
            await this.#loadMachines();
            await this.#loadProjects();
            await this.#loadSessions();
            this.#stale = false;
        } catch (error) {
            console.warn("[relay] Catching up after a reconnect failed", error);
        }
        this.#announce();
        for (const sessionId of this.#sessions.keys())
            for (const listener of this.#arrivals) listener(sessionId);
    }

    /** Called when a conversation starts or stops working. */
    onActivity(listener: (sessionId: string, thinking: boolean) => void): () => void {
        this.#activity.add(listener);
        return () => this.#activity.delete(listener);
    }

    /** Whether the relay currently says this conversation is working. */
    thinking(sessionId: string): boolean {
        return this.#thinking.get(sessionId) ?? false;
    }

    /** Called with a session id whenever that conversation gains a message. */
    onArrival(listener: (sessionId: string) => void): () => void {
        this.#arrivals.add(listener);
        return () => this.#arrivals.delete(listener);
    }

    #announce(): void {
        const snapshot = this.snapshot();
        for (const listener of this.#listeners) listener(snapshot);
    }
}
