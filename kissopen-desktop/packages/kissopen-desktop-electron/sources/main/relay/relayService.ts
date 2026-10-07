/*
When this desktop is reading the account's relay, and when it stops.

The lifetime is the interesting part, not the plumbing. A reader that outlives
a sign-out keeps holding the previous account's credential and keeps reporting
its machines, so the rule here is narrow on purpose: one reader at a time, for
one account, and signing out tears it down before anything else happens.

Everything it needs arrives through `RelayServiceDeps`, so this can be tested
without Electron, a network or a keyring.
*/
import { t } from "kissopen-desktop-state/i18n";
import type { RelayCredentials, RelayCredentialsSource } from "./relayCredentials";
import { relayCredentialsFetch } from "./relayCredentials";
import type { RelayTransport } from "./relayTransport";
import { RelayReader, type RelaySnapshot } from "./relayReader";
import { relayFileOpenWith } from "./relayFileOpen";
import type { RelayFile } from "./relayAttachments";
import type { RelayTerminalListener } from "./relayTerminals";
import type {
    KissopenAgentGitFile,
    RelayCommandResult,
    RelayConversation,
    RelayFileRead,
    RelayProjectFileReadOptions,
    RelayDirectory,
    RelayFileUploaded,
    RelayGitFile,
    RelayGitState,
    RelayTerminal,
    RelayTerminalAttached,
    RelayTerminalResult,
    RelayTerminalsResult,
} from "../../shared/relayContract";
import type { RelayLocalIdentity } from "./relayMachineKind";
import { RelayCache } from "./relayCache";

export interface RelayServiceDeps {
    /** Reaches the business server for this account's relay identity. */
    readonly credentials: RelayCredentialsSource;
    readonly transport: RelayTransport;
    /** Where a snapshot goes. In the app, towards the window. */
    readonly publish: (snapshot: RelaySnapshot | null) => void;
    /** Reported rather than thrown: this runs unattended. */
    readonly report: (message: string) => void;
    /** A conversation on another machine gained a message. */
    readonly arrived: (sessionId: string) => void;
    /** A conversation started or stopped working. */
    readonly active: (sessionId: string, running: boolean) => void;
    /** What this computer looks like, for recognising it among the account's machines. */
    readonly local: RelayLocalIdentity;
    /**
     * The account's cloud bot, when the business server names one. Absent is
     * not an error: an account may simply have no cloud workspace, and then
     * nothing is badged as the cloud.
     */
    readonly cloudBotId: () => Promise<string | undefined>;
    /**
     * Where this computer keeps its copy of the account's other machines —
     * lists, conversations, project files — one folder per account inside.
     * Absent in tests and anywhere nothing should be written.
     */
    readonly cacheRoot?: string;
}

export class RelayService {
    #deps: RelayServiceDeps;
    #reader: RelayReader | undefined;
    /** This computer's copy of the account being read, when one is kept. */
    #cache: RelayCache | undefined;
    #userId: string | undefined;
    /**
     * Which start attempt is current.
     *
     * Signing out, or signing in as somebody else, can happen while a start is
     * still in flight. The token this bumps is what tells a late arrival that
     * it is no longer wanted, so its reader is closed instead of published.
     */
    #generation = 0;
    /**
     * A cloud bot learned while no reader was up to tell.
     *
     * Provisioning on sign-in and starting the reader race each other, and the
     * reader's own read of the bot can land before the workspace exists. What
     * arrives in that gap is kept here and handed to the reader once there is
     * one, rather than lost until the next sign-in check.
     */
    #cloudBotOverride: string | undefined;
    /** The id the local Agent registered under, once it has said. */
    #localMachineId: string | undefined;

    constructor(deps: RelayServiceDeps) {
        this.#deps = deps;
    }

    /** The account currently being read, if any. */
    get account(): string | undefined {
        return this.#userId;
    }

    /**
     * Starts reading for this account, replacing whatever was being read.
     *
     * Calling it again for the same account is a no-op, so a caller may say
     * this on every sign-in check without churning the connection.
     */
    async start(userId: string): Promise<void> {
        if (this.#userId === userId && this.#reader) return;
        this.stop();
        const generation = ++this.#generation;

        let credentials: RelayCredentials;
        try {
            credentials = await relayCredentialsFetch(this.#deps.credentials, userId);
        } catch (error) {
            this.#failed(generation, error);
            return;
        }
        if (generation !== this.#generation) return;

        const cloudBotId = await this.#deps.cloudBotId().catch(() => undefined);
        if (generation !== this.#generation) return;
        const reader = new RelayReader(
            credentials,
            this.#deps.transport,
            {
                ...this.#deps.local,
                ...(this.#localMachineId ? { machineId: this.#localMachineId } : {}),
            },
            cloudBotId,
            (this.#cache = this.#deps.cacheRoot
                ? new RelayCache(this.#deps.cacheRoot, credentials.serverUrl, userId)
                : undefined),
        );
        /*
         * Taken on before the relay has answered: the reader shows this
         * computer's copy of the lists first, and a conversation clicked in
         * that list is read from the copy too. A start that then fails with
         * nothing to show is undone below.
         */
        this.#reader = reader;
        this.#userId = userId;
        if (this.#cloudBotOverride !== undefined) reader.cloudBotSet(this.#cloudBotOverride);
        reader.onChange((snapshot) => {
            if (this.#reader === reader) this.#deps.publish(snapshot);
        });
        try {
            await reader.start();
        } catch (error) {
            reader.stop();
            if (this.#reader === reader) {
                this.#reader = undefined;
                this.#userId = undefined;
            }
            this.#failed(generation, error);
            return;
        }
        // The account may have changed while the relay was answering. Nothing
        // read under the old one is published.
        if (generation !== this.#generation) {
            reader.stop();
            return;
        }

        reader.onActivity((sessionId, running) => {
            if (this.#reader === reader) this.#deps.active(sessionId, running);
        });
        reader.onArrival((sessionId) => {
            if (this.#reader === reader) this.#deps.arrived(sessionId);
        });
        this.#deps.publish(reader.snapshot());
    }

    /**
     * Stops reading and says so.
     *
     * Publishing null rather than an empty snapshot: "nobody is signed in" and
     * "this account has nothing" are different, and a window that cannot tell
     * them apart shows an empty list to someone who has just been signed out.
     */
    stop(forget = false): void {
        this.#generation++;
        this.#reader?.stop();
        // A person signing out takes this computer's copy of their account with them.
        if (forget)
            void this.#cache
                ?.clear()
                .catch((error: unknown) => this.#deps.report((error as Error).message));
        this.#cache = undefined;
        this.#reader = undefined;
        this.#userId = undefined;
        this.#cloudBotOverride = undefined;
        this.#deps.publish(null);
    }

    snapshot(): RelaySnapshot | null {
        return this.#reader?.snapshot() ?? null;
    }

    browserControl(
        sessionId: string,
        request: import("@kissopen/kissopen-agent-client").BrowserControlRequest,
    ) {
        if (!this.#reader) throw new Error("The account relay is unavailable.");
        return this.#reader.browserControl(sessionId, request);
    }

    /** Says something in a conversation on another machine. */
    async say(
        sessionId: string,
        text: string,
        mode?: { model?: string; modelProviderId?: string; effort?: string },
        files: readonly RelayFile[] = [],
        /** The short label a person sees in place of `text`, for a message the product composed. */
        displayText?: string,
    ): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.say(sessionId, text, mode, files, displayText));
    }

    /**
     * The cloud bot became known, or changed.
     *
     * Kept as well as forwarded: a reader still starting gets it when it is up.
     */
    cloudBotSet(botId: string | undefined): void {
        this.#cloudBotOverride = botId;
        this.#reader?.cloudBotSet(botId);
    }

    /**
     * The local Agent said which machine it is.
     *
     * Kept as well as forwarded, like the cloud bot: a reader still starting
     * gets it when it is up.
     */
    localMachineSet(machineId: string | undefined): void {
        this.#localMachineId = machineId;
        this.#reader?.localSet({ ...this.#deps.local, ...(machineId ? { machineId } : {}) });
    }

    /**
     * The conversation the account's cloud bot is holding, when there is one.
     *
     * Synchronous and never throws: a caller asking this is deciding where to
     * put something, and "not yet" is an answer it can act on.
     */
    cloudSessionId(): string | undefined {
        return this.#reader?.cloudSessionId();
    }

    /** Answers a tool call that is waiting on a person. */
    async decide(
        sessionId: string,
        requestId: string,
        approved: boolean,
    ): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.decide(sessionId, requestId, approved));
    }

    /** Answers a question a session on another machine is waiting on. */
    async answerQuestion(
        sessionId: string,
        requestId: string,
        answers: Readonly<Record<string, readonly string[]>>,
    ): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.answerQuestion(sessionId, requestId, answers));
    }

    /** Dismisses such a question unanswered. */
    async cancelQuestion(sessionId: string, requestId: string): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.cancelQuestion(sessionId, requestId));
    }

    /** Stops the run in progress on another machine. */
    async abort(sessionId: string): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.abort(sessionId));
    }

    /** Clears an assistant's conversation through its agent; the assistant stays. */
    async clear(sessionId: string): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.clear(sessionId));
    }

    /** Archives a conversation through its agent. */
    async archive(sessionId: string): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.archive(sessionId));
    }

    /** Deletes a conversation for good. */
    async remove(sessionId: string): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.remove(sessionId));
    }

    /*
    The terminals of one session's folder, and one attachment to them.

    Answered rather than thrown, like everything else the window asks of
    another machine: it pressed something, and a failure is a sentence to show
    it. A machine whose agent has no terminals refuses in those words.
    */
    async terminalList(sessionId: string): Promise<RelayTerminalsResult> {
        return this.#terminalAnswer(async () => {
            const answer = (await this.#reader!.terminalList(sessionId)) as {
                success?: boolean;
                terminals?: RelayTerminal[];
                error?: string;
            };
            if (answer?.success !== true) throw new Error(answer?.error ?? t("读不到终端"));
            return { ok: true as const, terminals: answer.terminals ?? [] };
        });
    }

    async terminalCreate(
        sessionId: string,
        request: { cols?: number; rows?: number; colorScheme?: "light" | "dark" },
    ): Promise<RelayTerminalResult> {
        return this.#terminalOne(() => this.#reader!.terminalCreate(sessionId, request));
    }

    async terminalResize(
        sessionId: string,
        terminalId: string,
        cols: number,
        rows: number,
    ): Promise<RelayTerminalResult> {
        return this.#terminalOne(() =>
            this.#reader!.terminalResize(sessionId, { terminalId, cols, rows }),
        );
    }

    async terminalStop(sessionId: string, terminalId: string): Promise<RelayTerminalResult> {
        return this.#terminalOne(() => this.#reader!.terminalStop(sessionId, { terminalId }));
    }

    /** Attaches to one terminal, answering the handle to address it by. */
    async terminalAttach(
        sessionId: string,
        terminalId: string,
        listener: RelayTerminalListener,
    ): Promise<RelayTerminalAttached> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return {
                ok: true,
                handle: await this.#reader.terminalAttach(sessionId, terminalId, listener),
            };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    async terminalWrite(handle: number, chunk: Uint8Array): Promise<RelayCommandResult> {
        return this.#attempt(() => this.#reader!.terminalWrite(handle, chunk));
    }

    terminalDetach(handle: number): void {
        this.#reader?.terminalDetach(handle);
    }

    /** One terminal answered, or the reason there is none. */
    async #terminalOne(work: () => Promise<unknown>): Promise<RelayTerminalResult> {
        return this.#terminalAnswer(async () => {
            const answer = (await work()) as {
                success?: boolean;
                terminal?: RelayTerminal;
                error?: string;
            };
            if (answer?.success !== true || !answer.terminal)
                throw new Error(answer?.error ?? t("这台机器没有答应"));
            return { ok: true as const, terminal: answer.terminal };
        });
    }

    async #terminalAnswer<T extends { ok: true }>(
        work: () => Promise<T>,
    ): Promise<T | { ok: false; error: string }> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return await work();
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /** What the checkout on the other machine looks like right now. */
    async gitState(sessionId: string): Promise<RelayGitState> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return { ok: true, git: await this.#reader.gitState(sessionId) };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /**
     * Brings one file from that machine here and opens it.
     *
     * The opener belongs to the desktop rather than to the relay, so it is
     * given: this knows how to reach the file, not what this machine does with
     * a `.pptx`.
     */
    async fileOpen(
        sessionId: string,
        path: string,
        open: (path: string) => Promise<string>,
    ): Promise<RelayCommandResult> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        const reader = this.#reader;
        try {
            await relayFileOpenWith(path, (wanted) => reader.fileRead(sessionId, wanted), open);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /** The bytes of one file there, base64. */
    async fileRead(sessionId: string, path: string, project?: unknown): Promise<RelayFileRead> {
        if (project !== undefined) {
            const options = project as Partial<RelayProjectFileReadOptions> | null;
            const reader = this.#reader;
            if (
                !reader ||
                !options ||
                typeof options.accountId !== "string" ||
                options.accountId !== this.#userId ||
                typeof options.machineId !== "string" ||
                typeof options.projectId !== "string" ||
                typeof options.projectPath !== "string" ||
                (options.source !== "cache" && options.source !== "remote")
            ) {
                return { ok: false, reason: "unavailable", error: t("当前账号无法读取这个看板。") };
            }
            try {
                const bytes = await reader.projectFileRead(sessionId, path, {
                    source: options.source,
                    machineId: options.machineId,
                    projectId: options.projectId,
                    projectPath: options.projectPath,
                });
                // Never deliver another account's in-flight answer after a switch.
                if (reader !== this.#reader || options.accountId !== this.#userId)
                    return { ok: false, reason: "unavailable", error: t("账号已切换。") };
                return bytes === undefined
                    ? { ok: false, reason: "uncached", error: "" }
                    : { ok: true, base64: Buffer.from(bytes).toString("base64") };
            } catch (error) {
                return { ok: false, reason: "unavailable", error: (error as Error).message };
            }
        }
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            const bytes = await this.#reader.fileRead(sessionId, path);
            return { ok: true, base64: Buffer.from(bytes).toString("base64") };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /** One file sent there. */
    async fileUpload(
        sessionId: string,
        path: string,
        bytes: Uint8Array,
    ): Promise<RelayFileUploaded> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return { ok: true, path: await this.#reader.fileUpload(sessionId, path, bytes) };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /** One folder there. */
    async directoryList(sessionId: string, path: string): Promise<RelayDirectory> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return { ok: true, ...(await this.#reader.directoryList(sessionId, path)) };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /** The two sides of one changed file there. */
    async gitFile(
        sessionId: string,
        gitBase: string,
        file: KissopenAgentGitFile,
    ): Promise<RelayGitFile> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return { ok: true, content: await this.#reader.gitFile(sessionId, gitBase, file) };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /*
    One ask of another machine, answered rather than thrown.

    Every one of these is something the reader pressed, so a failure is a
    sentence to show them — not an exception crossing a process boundary as
    "Error invoking remote method".
    */
    async #attempt(work: () => Promise<void>): Promise<RelayCommandResult> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            await work();
            return { ok: true };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /**
     * One conversation, answered rather than thrown.
     *
     * The window asked for this because somebody clicked a row, so a failure
     * is something to show them in place of the conversation — not an
     * exception crossing a process boundary as "Error invoking remote method".
     */
    async conversation(sessionId: string): Promise<RelayConversation> {
        if (!this.#reader) return { ok: false, error: t("还没有连上账号的 relay") };
        try {
            return { ok: true, ...(await this.#reader.conversation(sessionId)) };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }

    /**
     * Says why the rest of the account is missing, to whoever is looking.
     *
     * Both reported and published. The report is for an operator reading logs;
     * the published state is for the person at the window, who would otherwise
     * see an account with one computer and no reason given.
     *
     * Silent when this attempt has already been superseded: a failure under the
     * previous account is not news for the current one.
     */
    #failed(generation: number, error: unknown): void {
        if (generation !== this.#generation) return;
        const message = (error as Error).message;
        this.#deps.report(message);
        this.#deps.publish({ machines: [], projects: [], sessions: [], error: message });
    }
}
