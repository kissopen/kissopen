/*
Ties the relay reader to who is signed in.

One place decides when this desktop starts and stops reading the account's
relay, so that no caller has to remember both halves. The rule is the whole
module: signed in means reading, signed out means not, and a sign-out takes
effect before anything else is allowed to happen.

Kept apart from the service so the service stays testable without Electron,
and apart from kissopenCloud.ts so that file keeps doing one thing.
*/
import { t } from "kissopen-desktop-state/i18n";
import { hostname, homedir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { appVersion } from "../appVersion";
import { desktopIpc } from "../../shared/desktopContract";
import type {
    KissopenAgentGitFile,
    RelayCommandResult,
    RelayFileRead,
    RelayDirectory,
    RelayFileUploaded,
    RelayTerminalAttached,
    RelayTerminalResult,
    RelayTerminalsResult,
    RelayConversation,
    RelayGitFile,
    RelayGitState,
    RelayState,
} from "../../shared/relayContract";
import type { RelayAttachment } from "../../shared/desktopContract";
import { RelayService } from "./relayService";
import { relayPlatformReady } from "./relayPlatform";
import { relayTransportLive } from "./relayTransportLive";

let service: RelayService | undefined;
let latest: RelayState = null;
/** The id the local Agent says it registered under, once read from it. */
let localMachineId: string | undefined;
const accountListeners = new Set<() => void>();
export function relayAccountId(): string | undefined {
    return service?.account;
}
export function relayAccountChanged(listener: () => void): () => void {
    accountListeners.add(listener);
    return () => accountListeners.delete(listener);
}
export function relayBrowserControl(
    sessionId: string,
    request: import("@kissopen/kissopen-agent-client").BrowserControlRequest,
) {
    if (!service) throw new Error("The account relay is unavailable.");
    return service.browserControl(sessionId, request);
}

/**
 * The local Agent said which machine it is.
 *
 * From then on this is the answer — for the executor asking which runs are
 * addressed here, and for the roster's badges, which the reader redraws.
 */
export function relayLocalMachineIdSet(machineId: string | undefined): void {
    if (machineId === localMachineId) return;
    localMachineId = machineId;
    service?.localMachineSet(machineId);
}

/** Sends the relay to every open window. A window that opens later asks. */
function publish(state: RelayState): void {
    latest = state;
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(desktopIpc.relayChanged, state);
    }
}

type Call = (path: string) => Promise<{ status: number; text: string }>;

function ensure(post: Call, get: Call): RelayService {
    if (!service) {
        service = new RelayService({
            credentials: { post },
            transport: relayTransportLive(appVersion),
            publish,
            // Unattended: a relay that cannot be reached is a quiet degradation,
            // not something to interrupt the person over. The window shows what
            // it has, which is this machine.
            report: (message) => console.warn("[relay]", message),
            local: { host: hostname(), homeDir: homedir() },
            cacheRoot: join(app.getPath("userData"), "relay-cache"),
            cloudBotId: async () => {
                // The same question the phone asks, answered by the same
                // route. An account without a cloud workspace simply has no
                // bot, and nothing is badged as the cloud.
                // GET, never POST: POST provisions a workspace, and drawing a
                // badge must not create a container for somebody who has none.
                const response = await get("/cloud/workspace");
                if (response.status !== 200) return undefined;
                const body = JSON.parse(response.text) as { bot_id?: string };
                return body.bot_id || undefined;
            },
            active: (sessionId, running) => {
                for (const window of BrowserWindow.getAllWindows()) {
                    if (!window.isDestroyed())
                        window.webContents.send(desktopIpc.relayActivity, sessionId, running);
                }
            },
            arrived: (sessionId) => {
                for (const window of BrowserWindow.getAllWindows()) {
                    if (!window.isDestroyed())
                        window.webContents.send(desktopIpc.relayArrival, sessionId);
                }
            },
        });
    }
    return service;
}

/**
 * The account signed in, or was found to still be signed in.
 *
 * Safe to call on every check: the service ignores a repeat of the account it
 * is already reading.
 */
export function relayAccountPresent(userId: string, post: Call, get: Call): void {
    if (service?.account !== userId) for (const listener of accountListeners) listener();
    // The shared core has to have its primitives before the reader decodes the
    // account's secret, which is the first thing it does.
    void relayPlatformReady()
        .then(() => ensure(post, get).start(userId))
        .catch((error: unknown) => {
            const message = (error as Error).message;
            console.warn("[relay]", message);
            publish({ machines: [], projects: [], sessions: [], error: message });
        });
}

/**
 * Makes sure the account has a cloud workspace, and tells the reader its bot.
 *
 * The same route the phone calls on open, for the same reason: a person who
 * signed in should find their assistant waiting rather than a note to go and
 * open it somewhere else. The server's ensure is idempotent — a second call
 * for a provisioned account is a cheap read — so this runs on every sign-in
 * check. A 503 is a server with no cloud at all, and then there is nothing to
 * do here and nothing to say; the config already tells the window so.
 *
 * Never throws: provisioning is a convenience on the sign-in path, and a
 * failure here must not look like a failure to sign in.
 */
export async function relayCloudWorkspaceEnsure(post: Call): Promise<void> {
    try {
        const response = await post("/cloud/workspace");
        if (response.status !== 200) return;
        const body = JSON.parse(response.text) as { bot_id?: string };
        service?.cloudBotSet(body.bot_id || undefined);
    } catch (error) {
        console.warn("[relay] cloud workspace", (error as Error).message);
    }
}

/**
 * The account signed out, or its token stopped being accepted. Only a sign-out
 * the person asked for (`forget`) removes this computer's copy of the account;
 * an expired token signed back in as the same person finds it still here.
 */
export function relayAccountAbsent(forget = false): void {
    for (const listener of accountListeners) listener();
    service?.stop(forget);
}

/** One conversation from another machine. Never throws across the boundary. */
export async function relayConversationRead(sessionId: string): Promise<RelayConversation> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.conversation(sessionId);
}

/** Says something in a conversation on another machine. */
export async function relaySaySend(
    sessionId: string,
    text: string,
    mode?: { model?: string; modelProviderId?: string; effort?: string },
    files: readonly RelayAttachment[] = [],
    displayText?: string,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    /*
     * Read back through a fresh view: structured clone hands the bytes over as
     * whatever the window put in, and the encryptor has to see exactly these
     * rather than whatever buffer they happen to sit inside.
     */
    return service.say(
        sessionId,
        text,
        mode,
        files.map((file) => ({ ...file, bytes: new Uint8Array(file.bytes) })),
        displayText,
    );
}

/**
 * Says something to the account's cloud bot, wherever it is being held.
 *
 * The bar at the bottom of the screen names no session, because a person
 * summoning it has not chosen one — they have something to say. It goes to the
 * cloud workspace rather than to this computer so that it works the same when
 * this computer has no agent installed, which is the ordinary case the product
 * is built for.
 *
 * Answers with the session it landed in, so the caller can open it.
 */
export async function relayCloudSay(
    text: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    const sessionId = service.cloudSessionId();
    if (!sessionId) return { ok: false, error: t("这个账号还没有云端工作空间") };
    const sent = await service.say(sessionId, text);
    return sent.ok ? { ok: true, sessionId } : { ok: false, error: sent.error };
}

/** Answers a question the agent put to the person. */
export async function relayAnswerQuestion(
    sessionId: string,
    requestId: string,
    answers: Readonly<Record<string, readonly string[]>>,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.answerQuestion(sessionId, requestId, answers);
}

/** Takes such a question away unanswered. */
export async function relayCancelQuestion(
    sessionId: string,
    requestId: string,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.cancelQuestion(sessionId, requestId);
}

/** Answers a tool call that is waiting on a person. */
export async function relayDecideRequest(
    sessionId: string,
    requestId: string,
    approved: boolean,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.decide(sessionId, requestId, approved);
}

/** Stops the run in progress on another machine. */
export async function relayAbortRun(sessionId: string): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.abort(sessionId);
}

/** Clears an assistant's conversation through its agent. */
export async function relayClearSession(sessionId: string): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.clear(sessionId);
}

/** Archives a conversation through its agent. */
export async function relayArchiveSession(sessionId: string): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.archive(sessionId);
}

/** Deletes a conversation for good. */
export async function relayDeleteSession(sessionId: string): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.remove(sessionId);
}

/** Tells every open window something about one attachment. */
function announce(channel: string, handle: number, value?: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(channel, handle, value);
    }
}

/*
The terminals of a session on another machine.

The attachment's bytes are pushed to every open window rather than answered:
they arrive when the terminal produces them, not when anybody asked. The
handle is what tells one attachment from another, and a window that was never
given one cannot name it.
*/
export async function relayTerminalList(sessionId: string): Promise<RelayTerminalsResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.terminalList(sessionId);
}

export async function relayTerminalCreate(
    sessionId: string,
    request: { cols?: number; rows?: number; colorScheme?: "light" | "dark" },
): Promise<RelayTerminalResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.terminalCreate(sessionId, request);
}

export async function relayTerminalResize(
    sessionId: string,
    terminalId: string,
    cols: number,
    rows: number,
): Promise<RelayTerminalResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.terminalResize(sessionId, terminalId, cols, rows);
}

export async function relayTerminalStop(
    sessionId: string,
    terminalId: string,
): Promise<RelayTerminalResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.terminalStop(sessionId, terminalId);
}

export async function relayTerminalAttach(
    sessionId: string,
    terminalId: string,
): Promise<RelayTerminalAttached> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.terminalAttach(sessionId, terminalId, {
        data: (handle, chunk) => announce(desktopIpc.relayTerminalData, handle, chunk),
        closed: (handle, error) => announce(desktopIpc.relayTerminalClosed, handle, error),
    });
}

export async function relayTerminalWrite(
    handle: number,
    chunk: Uint8Array,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    // A fresh view over the bytes structured clone handed across: the stream
    // must see exactly these, not whatever buffer they arrived inside.
    return service.terminalWrite(handle, new Uint8Array(chunk));
}

export function relayTerminalDetach(handle: number): void {
    service?.terminalDetach(handle);
}

/** What the checkout on another machine looks like right now. */
export async function relayGitStateRead(sessionId: string): Promise<RelayGitState> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.gitState(sessionId);
}

/**
 * Opens a file that is on another machine, in an application on this one.
 *
 * What a link in a remote conversation does when it is followed. The opener
 * comes from the desktop rather than from here, so this module still knows
 * nothing about Electron.
 */
export async function relayFileOpen(
    sessionId: string,
    path: string,
    open: (path: string) => Promise<string>,
): Promise<RelayCommandResult> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.fileOpen(sessionId, path, open);
}

/** The bytes of one file on another machine, base64. */
export async function relayFileRead(
    sessionId: string,
    path: string,
    project?: unknown,
): Promise<RelayFileRead> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.fileRead(sessionId, path, project);
}

/** One file sent to another machine. */
export async function relayFileUpload(
    sessionId: string,
    path: string,
    bytes: Uint8Array,
): Promise<RelayFileUploaded> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.fileUpload(sessionId, path, bytes);
}

/** One folder on another machine. */
export async function relayDirectoryList(sessionId: string, path: string): Promise<RelayDirectory> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.directoryList(sessionId, path);
}

/** The two sides of one changed file on another machine. */
export async function relayGitFileRead(
    sessionId: string,
    gitBase: string,
    file: KissopenAgentGitFile,
): Promise<RelayGitFile> {
    if (!service) return { ok: false, error: t("还没有连上账号的 relay") };
    return service.gitFile(sessionId, gitBase, file);
}

/** The relay as it stands, for a window that has just opened. */
export function relayCurrent(): RelayState {
    return latest;
}

/**
 * This computer, by the id the relay knows it under.
 *
 * Matched rather than known — see relayMachineKind — and undefined until the
 * roster has been read. The executor for scheduled runs asks this on every
 * poll, so it needs no telling when the answer arrives.
 *
 * A computer can match more than one registration: an Agent reinstalled, or a
 * second profile of it, registers again under a new id and the old one stays
 * in the roster. The one that is live, or was most recently, is the one whose
 * daemon this desktop is standing next to.
 */
export function relayLocalMachineId(): string | undefined {
    if (localMachineId) return localMachineId;
    const candidates = (latest?.machines ?? []).filter((machine) => machine.kind === "this");
    candidates.sort(
        (left, right) =>
            Number(right.active) - Number(left.active) || right.activeAt - left.activeAt,
    );
    return candidates[0]?.id;
}
