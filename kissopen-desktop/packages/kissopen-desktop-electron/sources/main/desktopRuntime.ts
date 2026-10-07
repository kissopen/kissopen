import { join } from "node:path";
import type {
    DesktopBrowserProxyTarget,
    DesktopRuntimeSnapshot,
    DesktopStartRequest,
    DesktopTopology,
    DesktopTopologyTarget,
    DesktopUpdateSnapshot,
} from "../shared/desktopContract";
import {
    desktopSettingsActivate,
    desktopSettingsRead,
    desktopSettingsWrite,
    desktopTopologyIdCreate,
    type DesktopSettings,
} from "./desktopSettings";
import {
    desktopActiveTarget,
    desktopStartRequestValidate,
    desktopTopologyRequest,
    desktopTopologyTarget,
} from "./runtimeValidation";
import {
    localKissopenAgentConnectorCreate,
    type LocalKissopenAgentConnection,
    type LocalKissopenAgentConnector,
} from "./localKissopenAgent";
import { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import type {
    LocalKissopenAgentOnboardingState,
    LocalKissopenAgentProfile,
} from "./localOnboarding";
import {
    kissopenAgentDaemonConnectionUnavailable,
    type KissopenAgentDaemonInspectorResponse,
    type KissopenAgentDaemonInspectorStopResponse,
} from "./kissopenAgentDaemonClient";
import type { HtmlPreviewProxyHandle } from "./htmlPreviewProxy";
import {
    kissopenAgentRendererOrigin,
    type KissopenAgentRendererProxy,
} from "./kissopenAgentRendererProxy";
import {
    kissopenAgentHttpProxyCreate,
    type KissopenAgentHttpProxyHandle,
} from "./kissopenAgentHttpProxy";
import type { Duplex } from "node:stream";

export type KissopenAgentHttpProxyStart = (
    connection: LocalKissopenAgentConnection,
    onConnectionError: (error: unknown) => void,
) => Promise<KissopenAgentHttpProxyHandle>;

const idleUpdate: DesktopUpdateSnapshot = { status: "idle" };
/**
 * How long to wait before each fresh attempt at reaching the daemon.
 *
 * A daemon Kissopen just asked to start is not listening the instant the command
 * returns, and a socket refused half a second into a cold boot is not a broken
 * machine — it is a machine that is still waking up. Reporting the first refusal
 * as a failure puts a "could not reach KISSOPEN Agent" screen in front of someone whose Kissopen Agent
 * was about to answer, so the first few refusals are simply waited out. The
 * delays grow so a genuinely dead daemon still gives up quickly.
 */
const connectAttemptDelaysMs: readonly number[] = [0, 400, 1_200, 2_500];
const onboardingRequestTimeoutMs = 5_000;

export interface DesktopRuntimePaths {
    readonly root: string;
}

export interface DesktopRuntimeOptions {
    readonly rendererProxy?: KissopenAgentRendererProxy;
    readonly localKissopenAgentConnector?: LocalKissopenAgentConnector;
    readonly kissopenAgentHttpProxyStart?: KissopenAgentHttpProxyStart;
    /**
     * The exact hosted or development renderer origin. It is the only browser
     * origin the loopback Kissopen Agent proxy answers cross-origin.
     */
    readonly rendererOrigin?: string;
    /** The window's HTML preview proxy, so a KISSOPEN Agent's documents can be published. */
    readonly htmlPreview?: HtmlPreviewProxyHandle;
    /** The system's file opener (Electron's `shell.openPath`). */
    readonly fileOpen?: (path: string) => Promise<string>;
}

/** Owns the active local-Kissopen Agent topology and one immutable renderer snapshot. */
export class DesktopRuntime implements AsyncDisposable {
    private activationGeneration = 0;
    /** Advances whenever the daemon backing the stable local proxy changes. */
    private connectionGeneration = 0;
    private activeTopology?: DesktopTopology;
    private closed = false;
    private closeTask?: Promise<void>;
    private readonly listeners = new Set<(snapshot: DesktopRuntimeSnapshot) => void>();
    private operation = Promise.resolve();
    private persistOnSuccess = false;
    private reconnectTask?: Promise<void>;
    private kissopenAgentConnection?: LocalKissopenAgentConnection;
    private kissopenAgentClient?: {
        readonly generation: number;
        readonly client: KissopenAgentClient;
    };
    private kissopenAgentProxy?: KissopenAgentHttpProxyHandle;
    private settings?: DesktopSettings;
    private snapshotValue: DesktopRuntimeSnapshot;
    private readonly connector: LocalKissopenAgentConnector;
    private readonly proxyStart: KissopenAgentHttpProxyStart;
    private readonly rendererHttpUrl: string | undefined;

    private constructor(
        private readonly paths: DesktopRuntimePaths,
        settings: DesktopSettings | undefined,
        options: DesktopRuntimeOptions,
    ) {
        this.settings = settings;
        this.rendererHttpUrl = options.rendererProxy ? kissopenAgentRendererOrigin : undefined;
        this.connector = options.localKissopenAgentConnector ?? localKissopenAgentConnectorCreate();
        this.proxyStart =
            options.kissopenAgentHttpProxyStart ??
            ((connection, onConnectionError) =>
                kissopenAgentHttpProxyCreate({
                    client: connection.client,
                    onConnectionError,
                    ...(options.rendererProxy ? { rendererProxy: options.rendererProxy } : {}),
                    ...(options.rendererOrigin ? { allowedOrigin: options.rendererOrigin } : {}),
                    ...(options.htmlPreview ? { htmlPreview: options.htmlPreview } : {}),
                    ...(options.fileOpen ? { fileOpen: options.fileOpen } : {}),
                }));
        const configuredActive = settings?.topologies.find(
            ({ id }) => id === settings.activeTopologyId,
        );
        const active = configuredActive ??
            settings?.topologies[0] ?? {
                id: desktopTopologyIdCreate(),
                mode: "local" as const,
            };
        if (!settings?.topologies.some(({ id }) => id === active.id)) this.persistOnSuccess = true;
        this.activeTopology = active;
        this.snapshotValue = {
            phase: "starting",
            message: "Connecting to your local WorPar Agent daemon…",
            request: desktopTopologyRequest(active),
            targets: this.targets(),
            update: idleUpdate,
        };
    }

    static async create(
        paths: DesktopRuntimePaths,
        options: DesktopRuntimeOptions = {},
    ): Promise<DesktopRuntime> {
        const settings = await desktopSettingsRead(join(paths.root, "desktop-settings.json"));
        const runtime = new DesktopRuntime(paths, settings, options);
        if (runtime.activeTopology)
            void runtime
                .serial(() =>
                    runtime.startValidated(runtime.activeTopology!, runtime.persistOnSuccess),
                )
                .catch(() => undefined);
        return runtime;
    }

    get(): DesktopRuntimeSnapshot {
        return this.snapshotValue;
    }

    subscribe(listener: (snapshot: DesktopRuntimeSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    localInspectorStart(
        expectedConnectionId: number,
    ): Promise<KissopenAgentDaemonInspectorResponse> {
        return this.serial(async () => {
            const client = this.localConnectionRequire(expectedConnectionId).client;
            const result = await client.startInspector();
            this.localConnectionRequire(expectedConnectionId);
            return result;
        });
    }

    localInspectorStop(
        expectedConnectionId: number,
    ): Promise<KissopenAgentDaemonInspectorStopResponse> {
        return this.serial(async () => {
            const client = this.localConnectionRequire(expectedConnectionId).client;
            const result = await client.stopInspector();
            this.localConnectionRequire(expectedConnectionId);
            return result;
        });
    }

    /** Resolves Kissopen Agent's complete ordered onboarding contract for this daemon. */
    localOnboardingResolve(
        expectedConnectionId: number,
    ): Promise<LocalKissopenAgentOnboardingState> {
        return this.serial(() => this.localOnboardingResolveOnce(expectedConnectionId));
    }

    private async localOnboardingResolveOnce(
        expectedConnectionId: number,
    ): Promise<LocalKissopenAgentOnboardingState> {
        const connection = this.localConnectionRequire(expectedConnectionId);
        const client = this.localKissopenAgentClient();
        if (!client) throw new Error("The local WorPar Agent daemon is unavailable.");
        const state = await connectedKissopenAgentOnboardingResolve(client);
        if (
            this.snapshotValue.phase !== "ready" ||
            this.snapshotValue.connectionId !== expectedConnectionId ||
            this.kissopenAgentConnection !== connection
        )
            throw new Error("The local WorPar Agent changed while WorPar was examining it.");
        return state;
    }

    async localOnboardingProfileCreate(
        expectedConnectionId: number,
        input: { readonly email: string; readonly name: string },
    ): Promise<LocalKissopenAgentProfile> {
        return this.serial(async () => {
            this.localConnectionRequire(expectedConnectionId);
            const client = this.localKissopenAgentClient();
            if (!client) throw new Error("The local WorPar Agent daemon is unavailable.");
            const current = await client.getProfile();
            return (
                await client.updateProfile(input, {
                    ifMatch: current.profile.version,
                })
            ).profile;
        });
    }

    localOnboardingFreshness(expectedConnectionId: number): Promise<"fresh" | "used"> {
        return this.serial(async () => {
            this.localConnectionRequire(expectedConnectionId);
            const client = this.localKissopenAgentClient();
            if (!client) throw new Error("The local WorPar Agent daemon is unavailable.");
            const catalog = await client.listProjects();
            this.localConnectionRequire(expectedConnectionId);
            return catalog.projects.length > 0 ? "used" : "fresh";
        });
    }

    localOnboardingProjectAdd(
        expectedConnectionId: number,
        path: string,
    ): Promise<{ readonly path: string }> {
        return this.serial(async () => {
            this.localConnectionRequire(expectedConnectionId);
            const client = this.localKissopenAgentClient();
            if (!client) throw new Error("The local WorPar Agent daemon is unavailable.");
            await client.registerProject({ path });
            return { path };
        });
    }

    private localConnectionRequire(expectedConnectionId: number): LocalKissopenAgentConnection {
        if (
            this.snapshotValue.phase !== "ready" ||
            this.snapshotValue.mode !== "local" ||
            this.snapshotValue.connectionId !== expectedConnectionId ||
            !this.kissopenAgentConnection
        )
            throw new Error("The local WorPar Agent changed before WorPar could finish.");
        return this.kissopenAgentConnection;
    }

    /** The one shared KISSOPEN Agent HTTP client for this local activation. */
    private localKissopenAgentClient(): KissopenAgentClient | undefined {
        const endpoint = this.localKissopenAgentEndpoint();
        if (!endpoint) return undefined;
        const generation = this.connectionGeneration;
        if (this.kissopenAgentClient?.generation !== generation) {
            this.kissopenAgentClient = {
                client: new KissopenAgentClient({
                    endpoint,
                    token: "kissopen-local-capability",
                }),
                generation,
            };
        }
        return this.kissopenAgentClient.client;
    }

    /** The capability-scoped raw daemon endpoint for local mode. */
    private localKissopenAgentEndpoint(): string | undefined {
        if (this.snapshotValue.phase !== "ready" || this.snapshotValue.mode !== "local")
            return undefined;
        const endpoint = this.kissopenAgentProxy?.url;
        return endpoint ? endpoint.replace(/\/$/u, "") : undefined;
    }

    /** Opens a workspace tunnel through its owning host-published connection. */
    browserControl(target: DesktopBrowserProxyTarget, agentId: string, request: import("@kissopen/kissopen-agent-client").BrowserControlRequest) {
        return this.browserClient(target).browserControl(agentId, request);
    }

    /** Opens a workspace tunnel through its owning host-published connection. */
    openHttpProxy(target: DesktopBrowserProxyTarget): Promise<Duplex> {
        return this.browserClient(target).openWorkspaceHttpProxy(target.workspaceId);
    }

    browserServiceResolve(
        target: DesktopBrowserProxyTarget,
        selector: { readonly id: string } | { readonly port: number },
        signal: AbortSignal,
    ): Promise<string> {
        return this.browserClient(target).browserServiceResolve(
            target.workspaceId,
            selector,
            signal,
        );
    }

    openServiceHttpProxy(
        target: DesktopBrowserProxyTarget,
        serviceId: string,
        signal: AbortSignal,
    ): Promise<Duplex> {
        return this.browserClient(target).openWorkspaceServiceProxy(
            target.workspaceId,
            serviceId,
            signal,
        );
    }

    private browserClient(target: DesktopBrowserProxyTarget) {
        if (
            this.snapshotValue.phase !== "ready" ||
            this.snapshotValue.mode !== "local" ||
            !this.kissopenAgentConnection
        )
            throw new Error("The local WorPar Agent daemon is unavailable.");
        const host = this.kissopenAgentConnection.client;
        return target.connectionId === null ? host : host.connection(target.connectionId);
    }

    start(request: DesktopStartRequest): Promise<void> {
        return this.serial(async () => {
            desktopStartRequestValidate(request);
            const topology = this.activeTopology ?? {
                id: desktopTopologyIdCreate(),
                mode: "local" as const,
            };
            await this.startValidated(topology, true);
        });
    }

    retry(): Promise<void> {
        return this.serial(async () => {
            if (!this.activeTopology) throw new Error("There is no desktop topology to retry.");
            // A retry started from a failure keeps that failure on screen and
            // only marks itself as running, so the window can put the waiting on
            // the button the person pressed instead of replacing what they were
            // reading with a loading screen and then the same error again.
            const failure = this.snapshotValue.phase === "error" ? this.snapshotValue : undefined;
            if (failure) this.publish({ ...failure, retrying: true });
            await this.startValidated(this.activeTopology, this.persistOnSuccess, !!failure);
        });
    }

    /** Reconnects one failed normal-daemon transport and coalesces concurrent IPC failures. */
    reconnectLocal(error: unknown): Promise<void> {
        if (!kissopenAgentDaemonConnectionUnavailable(error)) return Promise.resolve();
        if (this.reconnectTask) return this.reconnectTask;
        const topology = this.activeTopology;
        const generation = this.activationGeneration;
        const failedConnection = this.kissopenAgentConnection;
        const proxy = this.kissopenAgentProxy;
        if (
            !topology ||
            topology.mode !== "local" ||
            this.closed ||
            this.snapshotValue.phase !== "ready" ||
            this.snapshotValue.mode !== "local" ||
            !failedConnection ||
            !proxy
        )
            return Promise.resolve();
        const task = this.serial(async () => {
            if (
                this.closed ||
                this.activationGeneration !== generation ||
                this.activeTopology?.id !== topology.id ||
                this.snapshotValue.phase !== "ready" ||
                this.kissopenAgentConnection !== failedConnection ||
                this.kissopenAgentProxy !== proxy
            )
                return;
            const replacement = await this.connector.connect();
            if (
                this.closed ||
                this.activationGeneration !== generation ||
                this.activeTopology?.id !== topology.id ||
                this.snapshotValue.phase !== "ready" ||
                this.kissopenAgentConnection !== failedConnection ||
                this.kissopenAgentProxy !== proxy
            ) {
                replacement.close();
                return;
            }
            try {
                proxy.replace({
                    client: replacement.client,
                });
            } catch (replaceError) {
                replacement.close();
                throw replaceError;
            }
            this.kissopenAgentConnection = replacement;
            this.kissopenAgentClient = undefined;
            failedConnection.close();
            const snapshot = this.snapshotValue;
            if (snapshot.phase === "ready") {
                const connectionId = ++this.connectionGeneration;
                this.publish({
                    ...snapshot,
                    activeTarget: {
                        ...snapshot.activeTarget,
                        kissopenAgentVersion: replacement.version,
                    },
                    connectionId,
                });
            }
        });
        const tracked = task.finally(() => {
            if (this.reconnectTask === tracked) this.reconnectTask = undefined;
        });
        this.reconnectTask = tracked;
        return tracked;
    }

    reset(): Promise<void> {
        return this.serial(async () => {
            const topology = this.activeTopology ?? {
                id: desktopTopologyIdCreate(),
                mode: "local" as const,
            };
            await this.startValidated(topology, this.persistOnSuccess);
        });
    }

    topologySelect(topologyId: string): Promise<void> {
        return this.serial(async () => {
            if (
                this.snapshotValue.phase === "ready" &&
                this.snapshotValue.activeTargetId === topologyId
            )
                return;
            const topology = this.settings?.topologies.find(({ id }) => id === topologyId);
            if (!topology) throw new Error("The selected WorPar topology does not exist.");
            await this.startValidated(topology, true);
        });
    }

    updateSet(update: DesktopUpdateSnapshot): void {
        this.publish({ ...this.snapshotValue, update } as DesktopRuntimeSnapshot);
    }

    close(): Promise<void> {
        this.closeTask ??= this.closeOnce();
        return this.closeTask;
    }

    async [Symbol.asyncDispose](): Promise<void> {
        await this.close();
    }

    private async closeOnce(): Promise<void> {
        this.closed = true;
        this.activationGeneration += 1;
        await this.serial(async () => this.localDispose());
    }

    /**
     * Reaches the daemon, waiting out the refusals that a starting daemon gives.
     *
     * Only a connection that failed for a reason another attempt could change is
     * retried: a missing agent and a daemon that refuses on its own terms
     * — no signed-in coding assistant, for instance — will answer exactly the
     * same way in two seconds, and waiting on them only makes the window feel
     * broken. Returns nothing when this activation was superseded while waiting.
     */
    private async connectAttempt(
        generation: number,
    ): Promise<LocalKissopenAgentConnection | undefined> {
        let failure: unknown;
        for (const [index, delay] of connectAttemptDelaysMs.entries()) {
            if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            if (generation !== this.activationGeneration) return undefined;
            try {
                return await this.connector.connect();
            } catch (error) {
                failure = error;
                if (index === connectAttemptDelaysMs.length - 1) break;
                if (!connectAttemptRetryable(error)) break;
            }
        }
        throw failure;
    }

    private async startValidated(
        topology: DesktopTopology,
        persist: boolean,
        inPlace = false,
    ): Promise<void> {
        if (this.closed) throw new Error("The desktop runtime is closed.");
        const generation = ++this.activationGeneration;
        this.localDispose();
        this.activeTopology = topology;
        this.persistOnSuccess = persist;
        const request = desktopTopologyRequest(topology);
        if (!inPlace)
            this.publish({
                phase: "starting",
                message: "Connecting to your local WorPar Agent daemon…",
                request,
                targets: this.targets(),
                update: this.snapshotValue.update,
            });
        try {
            const connection = await this.connectAttempt(generation);
            if (connection === undefined) return;
            if (generation !== this.activationGeneration) {
                connection.close();
                return;
            }
            this.kissopenAgentConnection = connection;
            const connectionId = ++this.connectionGeneration;
            const proxy = await this.proxyStart(connection, (error) => {
                void this.reconnectLocal(error).catch(() => undefined);
            });
            if (generation !== this.activationGeneration) {
                proxy.close();
                connection.close();
                this.kissopenAgentConnection = undefined;
                return;
            }
            this.kissopenAgentProxy = proxy;
            const kissopenAgentVersion = connection.version;
            const kissopenAgentHttpUrl = this.rendererHttpUrl ?? proxy.url;
            if (this.persistOnSuccess) {
                const settings = desktopSettingsActivate(this.settings, topology);
                await desktopSettingsWrite(
                    join(this.paths.root, "desktop-settings.json"),
                    settings,
                );
                this.settings = settings;
                this.persistOnSuccess = false;
            }
            if (generation !== this.activationGeneration) return;
            const activeTarget = desktopActiveTarget(
                topology,
                kissopenAgentVersion,
                kissopenAgentHttpUrl,
            );
            this.publish({
                phase: "ready",
                activeTarget,
                activeTargetId: activeTarget.id,
                connectionId,
                mode: topology.mode,
                targets: this.targets(),
                update: this.snapshotValue.update,
            });
        } catch (error) {
            this.localDispose();
            if (generation !== this.activationGeneration) return;
            this.publish({
                phase: "error",
                message: displayError(error),
                request,
                retryable: true,
                targets: this.targets(),
                update: this.snapshotValue.update,
            });
            throw error;
        }
    }

    private localDispose(): void {
        this.kissopenAgentClient = undefined;
        this.kissopenAgentProxy?.close();
        this.kissopenAgentProxy = undefined;
        this.kissopenAgentConnection?.close();
        this.kissopenAgentConnection = undefined;
    }

    private publish(snapshot: DesktopRuntimeSnapshot): void {
        this.snapshotValue = snapshot;
        for (const listener of this.listeners) listener(snapshot);
    }

    private serial<T>(work: () => Promise<T>): Promise<T> {
        const next = this.operation.then(work, work);
        this.operation = next.then(
            () => undefined,
            () => undefined,
        );
        return next;
    }

    private targets(): readonly DesktopTopologyTarget[] {
        const configured = this.settings?.topologies ?? [];
        const active =
            this.activeTopology && !configured.some(({ id }) => id === this.activeTopology?.id)
                ? [this.activeTopology]
                : [];
        return [...configured, ...active].map(desktopTopologyTarget);
    }
}

/**
 * Whether waiting and asking again could plausibly answer differently.
 *
 * Only the transport's own refusals qualify — a socket that is not there yet, a
 * connection dropped mid-handshake, an attempt that timed out. Anything the
 * daemon said deliberately, and anything about this machine's setup, is a fact
 * rather than a moment, and repeating the question just delays saying so.
 */
function connectAttemptRetryable(error: unknown): boolean {
    return kissopenAgentDaemonConnectionUnavailable(error);
}

function displayError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Resolves onboarding from the daemon Kissopen has already authenticated.
 *
 * The shell owns native setup work, but it does not interpret the Kissopen Agent
 * protocol version. The hosted renderer can move independently of the packaged
 * shell, so compatibility belongs to the renderer connection that actually
 * consumes the protocol. Main asks only for daemon-owned onboarding state.
 */
async function connectedKissopenAgentOnboardingResolve(
    client: KissopenAgentClient,
): Promise<LocalKissopenAgentOnboardingState> {
    try {
        let state = await client.getOnboarding({
            signal: AbortSignal.timeout(onboardingRequestTimeoutMs),
        });
        // A provider that can answer is what "installed" means for this product.
        // The remaining steps are preferences — a git identity, a first project,
        // a phone — and each has a home in settings, so none of them is worth
        // holding the first window hostage. Marking it here is idempotent.
        if (!state.completed && state.steps.providers.done) {
            await client
                .completeOnboarding({ signal: AbortSignal.timeout(onboardingRequestTimeoutMs) })
                .catch(() => undefined);
            state = await client.getOnboarding({
                signal: AbortSignal.timeout(onboardingRequestTimeoutMs),
            });
        }
        const profileDone = state.steps.profile.done;
        if (!state.steps.providers.done) return { profileDone, state: "provider_setup" };
        // A signed-in account is enough to start working. The git identity is a
        // preference, not a precondition, so it lives in KISSOPEN Agent settings
        // rather than in front of the first screen; `profileDone` still travels
        // so callers can prompt for it where it actually matters.
        return { profileDone, state: "complete" };
    } catch (error) {
        return kissopenAgentUnreachableState(error);
    }
}

function kissopenAgentUnreachableState(error: unknown): LocalKissopenAgentOnboardingState {
    return {
        message: displayError(error).slice(0, 2_048) || "WorPar Agent could not be reached.",
        state: "kissopen_agent_unreachable",
    };
}

export { kissopenAgentDaemonConnectionUnavailable };
