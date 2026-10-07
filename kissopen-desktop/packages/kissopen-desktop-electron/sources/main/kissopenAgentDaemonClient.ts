import { connect as connectLocalSocket } from "node:net";
import { localAgentSocketPath } from "./localAgentSocketPath.js";
import { readFile } from "node:fs/promises";
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { Duplex } from "node:stream";
import {
    KissopenAgentApiError,
    KissopenAgentClient,
    WORKSPACE_SERVICE_AUTHORIZATION_HEADER,
    type AgentResponse,
    type Cuid2,
    type DrainResponse,
    type FileContentResponse,
    type HealthResponse,
    type InspectorStartedResponse,
    type InspectorStoppedResponse,
    type ShutdownResponse,
    type WorkspaceResponse,
    type WorkspaceService,
    type WriteFileRequest,
    type WriteFileResponse,
} from "@kissopen/kissopen-agent-client";
import { WebSocket, createWebSocketStream } from "ws";

/**
 * Largest terminal frame carried by either side of the desktop bridge.
 *
 * Kissopen Agent's terminal protocol uses bounded binary frames. This remains
 * deliberately larger than the protocol's own largest frame while refusing an
 * unbounded WebSocket payload before it can reach the renderer.
 */
export const KISSOPEN_AGENT_TERMINAL_MAX_WIRE_BYTES = 4 * 1024 * 1024;

export interface KissopenAgentDaemonClientOptions {
    readonly socketPath: string;
    readonly token: string;
    readonly connectionId?: string;
}

export interface KissopenAgentDaemonPaths {
    readonly socketPath: string;
    readonly tokenPath: string;
}

export interface KissopenAgentDaemonRawResponse {
    readonly statusCode: number;
    readonly headers: IncomingHttpHeaders;
    readonly body: IncomingMessage;
}

/** One runtime component whose admitted work has not finished draining. */
export type DrainWaitingFor = NonNullable<HealthResponse["drainWaitingFor"]>[number];

/** Where a debugger attaches once Kissopen Agent's inspector is listening. */
export type KissopenAgentDaemonInspectorResponse = InspectorStartedResponse;

/** Whether an inspector was listening before the stop request. */
export type KissopenAgentDaemonInspectorStopResponse = InspectorStoppedResponse;

/**
 * Authenticated Unix-socket boundary for KISSOPEN Agent.
 *
 * It intentionally does not reproduce the browser-safe KissopenAgentClient API.
 * The renderer already owns that client and reaches it through `rawRequest`.
 * Main only keeps the few transport operations a sandboxed browser cannot do:
 * health during bootstrap, terminal WebSockets, browser CONNECT tunnels, and
 * workspace file/path reads for native preview and Open In services.
 */
export class KissopenAgentDaemonClient {
    readonly socketPath: string;
    readonly #token: string;
    readonly #client: KissopenAgentClient;
    readonly #connectionId?: string;
    readonly #connections = new Map<string, KissopenAgentDaemonClient>();

    constructor(options: KissopenAgentDaemonClientOptions) {
        this.socketPath = options.socketPath;
        this.#token = options.token;
        this.#connectionId = options.connectionId;
        const client = new KissopenAgentClient({
            endpoint: "http://kissopen-agent/",
            token: options.token,
            fetch: (input, init) => unixSocketFetch(options.socketPath, input, init),
        });
        this.#client = options.connectionId ? client.connection(options.connectionId) : client;
    }

    connection(id: string): KissopenAgentDaemonClient {
        let client = this.#connections.get(id);
        if (!client) {
            client = new KissopenAgentDaemonClient({
                socketPath: this.socketPath,
                token: this.#token,
                connectionId: id,
            });
            this.#connections.set(id, client);
        }
        return client;
    }

    browserControl(
        agentId: string,
        request: import("@kissopen/kissopen-agent-client").BrowserControlRequest,
    ) {
        return this.#client.browserControl(
            agentId as import("@kissopen/kissopen-agent-client").Cuid2,
            request,
            { signal: AbortSignal.timeout(10000) },
        );
    }

    health(signal?: AbortSignal): Promise<HealthResponse> {
        return this.#client.getHealth(signal ? { signal } : undefined);
    }

    /** Main-only local theme transport; credentials never leave the daemon connection. */
    get themes() {
        return {
            capability: this.#client.getThemeGeneration.bind(this.#client),
            generate: this.#client.generateTheme.bind(this.#client),
        };
    }

    /** Main-only typed task projection; credentials remain inside the daemon transport. */
    get localTasks() {
        return {
            list: this.#client.listLocalTasks.bind(this.#client),
            create: this.#client.createLocalTask.bind(this.#client),
            get: this.#client.getLocalTask.bind(this.#client),
            update: this.#client.updateLocalTask.bind(this.#client),
            run: this.#client.runLocalTask.bind(this.#client),
            runs: this.#client.listLocalTaskRuns.bind(this.#client),
            read: this.#client.readLocalTaskRun.bind(this.#client),
            bootstrap: this.#client.getDesktopBootstrap.bind(this.#client),
            createAgent: this.#client.createAgent.bind(this.#client),
        };
    }

    /** Bounded mobile reads reuse the daemon's authoritative filesystem boundary. */
    get mobileLibrary() {
        return {
            bootstrap: this.#client.getDesktopBootstrap.bind(this.#client),
            directory: this.#client.getFileTree.bind(this.#client),
            read: this.#client.readFile.bind(this.#client),
        };
    }

    /**
     * Puts this daemon process into its sticky drain mode: it stops admitting
     * work and reports what is still finishing through `health`. There is no way
     * back out, which is why only a decided restart calls it.
     */
    drain(signal?: AbortSignal): Promise<DrainResponse> {
        return this.#client.drain(signal ? { signal } : undefined);
    }

    /** Asks the daemon to exit; it answers with its pid before going. */
    shutdown(signal?: AbortSignal): Promise<ShutdownResponse> {
        return this.#client.shutdown(signal ? { signal } : undefined);
    }

    startInspector(signal?: AbortSignal): Promise<KissopenAgentDaemonInspectorResponse> {
        return this.#client.startInspector(signal ? { signal } : undefined);
    }

    stopInspector(signal?: AbortSignal): Promise<KissopenAgentDaemonInspectorStopResponse> {
        return this.#client.stopInspector(signal ? { signal } : undefined);
    }

    getAgent(agentId: string, signal?: AbortSignal): Promise<AgentResponse> {
        return this.#client.getAgent(agentId as Cuid2, signal ? { signal } : undefined);
    }

    getWorkspace(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceResponse> {
        return this.#client.getWorkspace(workspaceId as Cuid2, signal ? { signal } : undefined);
    }

    readWorkspaceFile(
        workspaceId: string,
        filePath: string,
        signal?: AbortSignal,
    ): Promise<FileContentResponse> {
        return this.#client.readFile(
            workspaceId as Cuid2,
            filePath,
            signal ? { signal } : undefined,
        );
    }

    writeWorkspaceFile(
        workspaceId: string,
        request: WriteFileRequest,
        signal?: AbortSignal,
    ): Promise<WriteFileResponse> {
        return this.#client.writeFile(
            workspaceId as Cuid2,
            request,
            signal ? { signal } : undefined,
        );
    }

    /**
     * Opens one daemon request without interpreting its response.
     *
     * Only `/v0` is accepted. The renderer supplies ordinary HTTP headers, but
     * the daemon credential is always replaced here and never leaves main.
     */
    rawRequest(options: {
        readonly method: string;
        readonly path: string;
        readonly body?: Buffer;
        readonly headers?: Readonly<Record<string, string>>;
        readonly signal?: AbortSignal;
    }): Promise<KissopenAgentDaemonRawResponse> {
        const path = kissopenAgentPath(options.path);
        return new Promise((resolvePromise, reject) => {
            if (options.signal?.aborted) {
                reject(abortedError());
                return;
            }
            const headers: Record<string, string | number> = {
                accept: "application/json",
                ...options.headers,
                authorization: `Bearer ${this.#token}`,
            };
            if (options.body !== undefined) headers["content-length"] = options.body.byteLength;
            const request = httpRequest(
                {
                    headers,
                    method: options.method,
                    path,
                    socketPath: this.socketPath,
                },
                (response) => {
                    response.once("close", cleanup);
                    resolvePromise({
                        statusCode: response.statusCode ?? 500,
                        headers: response.headers,
                        body: response,
                    });
                },
            );
            const abort = () => request.destroy(abortedError());
            const cleanup = () => options.signal?.removeEventListener("abort", abort);
            options.signal?.addEventListener("abort", abort, { once: true });
            request.once("close", cleanup);
            request.once("error", reject);
            request.end(options.body);
        });
    }

    /** Opens `CONNECT /v0/workspaces/:workspaceId/proxy`. */
    openWorkspaceHttpProxy(workspaceId: string): Promise<Duplex> {
        // The SDK owns and validates the host-published connection prefix, just
        // as it does for ordinary HTTP requests and terminal attachments.
        const prefix = new URL(this.#client.endpoint).pathname.replace(/\/$/u, "");
        const path = `${prefix}/v0/workspaces/${encodeURIComponent(workspaceId)}/proxy`;
        return this.#openConnect(path);
    }

    /** Only explicitly started services can be selected; an ordinary host port is not exposed. */
    async browserServiceResolve(
        workspaceId: string,
        selector: { readonly id: string } | { readonly port: number },
        signal: AbortSignal,
    ): Promise<string> {
        let candidates: readonly WorkspaceService[];
        if ("id" in selector) {
            const result = await this.#client.getWorkspaceService(
                workspaceId as Cuid2,
                selector.id as Cuid2,
                { signal },
            );
            candidates = [result.service];
        } else {
            const result = await this.#client.listWorkspaceServices(
                workspaceId as Cuid2,
                { limit: 100 },
                { signal },
            );
            if (result.nextPageCursor !== null)
                throw new Error("The service catalog is incomplete.");
            candidates = result.services.filter((service) => service.port === selector.port);
        }
        const active = candidates.filter((service) => service.status === "running");
        if (active.length === 0)
            throw new Error(
                "No running sandboxed service matches this address. Ask the agent to start it with service_start.",
            );
        if (active.length !== 1)
            throw new Error(
                "More than one sandboxed service uses this port. Open its service-specific address instead.",
            );
        return active[0]!.id;
    }

    /** Both credentials stay in main and cover only this service's current execution. */
    async openWorkspaceServiceProxy(
        workspaceId: string,
        serviceId: string,
        signal: AbortSignal,
    ): Promise<Duplex> {
        const credential = await this.#client.issueWorkspaceServiceAccessToken(
            workspaceId as Cuid2,
            serviceId as Cuid2,
            { signal },
        );
        const path = new URL(
            this.#client.workspaceServiceProxyUrl(workspaceId as Cuid2, serviceId as Cuid2),
        ).pathname;
        return this.#openConnect(
            path,
            { [WORKSPACE_SERVICE_AUTHORIZATION_HEADER]: `Bearer ${credential.accessToken}` },
            signal,
        );
    }

    #openConnect(
        path: string,
        headers: Readonly<Record<string, string>> = {},
        signal?: AbortSignal,
    ): Promise<Duplex> {
        return new Promise((resolvePromise, reject) => {
            if (signal?.aborted) {
                reject(abortedError());
                return;
            }
            const request = httpRequest({
                // CONNECT must enter the daemon's tunnel router on a fresh connection.
                agent: false,
                headers: { ...headers, authorization: `Bearer ${this.#token}` },
                method: "CONNECT",
                path,
                socketPath: this.socketPath,
            });
            const abort = () => request.destroy(abortedError());
            const cleanup = () => signal?.removeEventListener("abort", abort);
            signal?.addEventListener("abort", abort, { once: true });
            request.once("close", cleanup);
            let settled = false;
            const fail = (statusCode: number | undefined): void => {
                if (settled) return;
                settled = true;
                cleanup();
                const status = statusCode ?? 500;
                reject(
                    new KissopenAgentDaemonHttpError(
                        status,
                        `KissOpen Agent browser proxy returned ${String(status)}.`,
                    ),
                );
            };
            request.once("connect", (response, socket, head) => {
                if (response.statusCode !== 200) {
                    socket.destroy();
                    fail(response.statusCode);
                    return;
                }
                if (settled) {
                    socket.destroy();
                    return;
                }
                settled = true;
                cleanup();
                if (head.length > 0) socket.unshift(head);
                resolvePromise(socket);
            });
            request.once("response", (response) => {
                response.resume();
                fail(response.statusCode);
            });
            request.once("error", (error) => {
                if (settled) return;
                settled = true;
                reject(error);
            });
            request.end();
        });
    }

    /**
     * Opens the binary Kissopen Agent terminal attachment as a byte stream.
     *
     * The workspace and terminal IDs are already authoritative `/v0`
     * identities; main performs no session lookup or legacy route projection.
     */
    attachTerminal(
        workspaceId: string,
        terminalId: string,
        connectionId?: string,
    ): Promise<Duplex> {
        const remote = connectionId ?? this.#connectionId;
        // The SDK validates the connection ID and owns the proxy prefix.
        const prefix = remote
            ? new URL(
                  this.#connectionId === remote
                      ? this.#client.endpoint
                      : this.#client.connection(remote).endpoint,
              ).pathname.replace(/\/$/u, "")
            : "";
        const path = `${prefix}/v0/workspaces/${encodeURIComponent(
            workspaceId,
        )}/terminals/${encodeURIComponent(terminalId)}/attach`;
        return new Promise((resolvePromise, reject) => {
            const socket = new WebSocket(`ws://kissopen-agent${path}`, {
                createConnection: () => connectLocalSocket(this.socketPath),
                handshakeTimeout: 10_000,
                headers: { authorization: `Bearer ${this.#token}` },
                maxPayload: KISSOPEN_AGENT_TERMINAL_MAX_WIRE_BYTES,
                perMessageDeflate: false,
            });
            let settled = false;
            const fail = (error: Error): void => {
                if (settled) return;
                settled = true;
                socket.terminate();
                reject(error);
            };
            const unexpected = (_request: unknown, response: { statusCode?: number }): void => {
                fail(
                    new KissopenAgentDaemonHttpError(
                        response.statusCode ?? 500,
                        "The KissOpen Agent terminal attachment was refused.",
                    ),
                );
            };
            socket.once("error", fail);
            socket.once("unexpected-response", unexpected);
            socket.once("open", () => {
                if (settled) return;
                settled = true;
                socket.off("error", fail);
                socket.off("unexpected-response", unexpected);
                resolvePromise(createWebSocketStream(socket, { allowHalfOpen: false }));
            });
        });
    }
}

/** Resolves the standard Kissopen Agent daemon endpoint and optional exact overrides. */
export function kissopenAgentDaemonPathsResolve(
    environment: NodeJS.ProcessEnv = process.env,
    homeDirectory = homedir(),
): KissopenAgentDaemonPaths {
    const configuredHome = environment.KISSOPEN_HOME_DIR?.trim();
    const kissopenHome =
        configuredHome === undefined || configuredHome.length === 0
            ? join(homeDirectory, ".kissopen")
            : configuredHome.startsWith("~")
              ? join(homeDirectory, configuredHome.slice(1))
              : isAbsolute(configuredHome)
                ? configuredHome
                : resolve(homeDirectory, configuredHome);
    const directory = join(kissopenHome, "agent");
    return {
        socketPath:
            environment.KISSOPEN_AGENT_SERVER_SOCKET_PATH?.trim() ||
            localAgentSocketPath(directory),
        tokenPath: environment.KISSOPEN_AGENT_SERVER_TOKEN_PATH?.trim() || join(directory, "token"),
    };
}

export async function kissopenAgentDaemonTokenRead(tokenPath: string): Promise<string | undefined> {
    try {
        return (await readFile(tokenPath, "utf8")).trim() || undefined;
    } catch {
        return undefined;
    }
}

/** A daemon response the caller could not use, preserving its HTTP status. */
export class KissopenAgentDaemonHttpError extends Error {
    constructor(
        readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = "KissopenAgentDaemonHttpError";
    }
}

/**
 * True when this immutable socket/token pair cannot be used again and the
 * desktop runtime must reconnect and reread the token.
 */
export function kissopenAgentDaemonConnectionUnavailable(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; current && depth < 4; depth += 1) {
        if (typeof current !== "object") return false;
        if (current instanceof KissopenAgentApiError)
            return current.status === 401 || current.status === 403;
        if (current instanceof KissopenAgentDaemonHttpError)
            return current.statusCode === 401 || current.statusCode === 403;
        const value = current as { readonly cause?: unknown; readonly code?: unknown };
        if (
            value.code === "ECONNREFUSED" ||
            value.code === "ECONNRESET" ||
            value.code === "EPIPE" ||
            value.code === "ENOENT"
        )
            return true;
        current = value.cause;
    }
    return false;
}

function kissopenAgentPath(path: string): string {
    let parsed: URL;
    try {
        parsed = new URL(path, "http://kissopen");
    } catch {
        throw new Error("The KissOpen Agent request path is invalid.");
    }
    if (
        parsed.origin !== "http://kissopen" ||
        (parsed.pathname !== "/v0" && !parsed.pathname.startsWith("/v0/"))
    )
        throw new Error("Only KissOpen Agent /v0 routes may cross the desktop bridge.");
    return `${parsed.pathname}${parsed.search}`;
}

function abortedError(): Error {
    return new Error("The KissOpen Agent request was aborted.");
}

async function unixSocketFetch(
    socketPath: string,
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined;
    return new Promise((resolvePromise, reject) => {
        if (request.signal.aborted) {
            reject(abortedError());
            return;
        }
        const outgoing = httpRequest(
            {
                headers: Object.fromEntries(request.headers.entries()),
                method: request.method,
                path: `${url.pathname}${url.search}`,
                socketPath,
            },
            (incoming) => {
                const chunks: Buffer[] = [];
                incoming.on("data", (chunk: Buffer | string) =>
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
                );
                incoming.once("error", reject);
                incoming.once("end", () => {
                    const headers = new Headers();
                    for (const [name, value] of Object.entries(incoming.headers)) {
                        if (Array.isArray(value))
                            for (const item of value) headers.append(name, item);
                        else if (value !== undefined) headers.set(name, value);
                    }
                    const payload = Buffer.concat(chunks);
                    resolvePromise(
                        new Response(payload.length === 0 ? null : new Uint8Array(payload), {
                            headers,
                            status: incoming.statusCode ?? 500,
                            statusText: incoming.statusMessage,
                        }),
                    );
                });
            },
        );
        const abort = () => outgoing.destroy(abortedError());
        const cleanup = () => request.signal.removeEventListener("abort", abort);
        request.signal.addEventListener("abort", abort, { once: true });
        outgoing.once("close", cleanup);
        outgoing.once("error", reject);
        outgoing.end(body);
    });
}
