import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { WebContents } from "electron";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { desktopCdpSharedAcquire } from "./desktopCdpShared";

const LOOPBACK_HOST = "127.0.0.1";
const MAXIMUM_MESSAGE_BYTES = 4 * 1024 * 1024;

export interface DesktopRendererDebugger {
    readonly url: string;
    close(): Promise<void>;
}

interface CdpRequest {
    readonly id: number;
    readonly method: string;
    readonly params?: Record<string, unknown>;
    readonly sessionId?: string;
}

export async function desktopRendererDebuggerStart(
    webContents: WebContents,
    onDetached: (reason: string) => void,
): Promise<DesktopRendererDebugger> {
    if (webContents.isDestroyed()) throw new Error("The WorPar renderer is not available.");

    const cdp = await desktopCdpSharedAcquire(webContents, "renderer-debugger");
    const token = randomBytes(24).toString("hex");
    const path = `/cdp/${token}`;
    const server = new WebSocketServer({
        host: LOOPBACK_HOST,
        maxPayload: MAXIMUM_MESSAGE_BYTES,
        path,
        perMessageDeflate: false,
        port: 0,
    });
    let client: WebSocket | undefined;
    let closed = false;

    const send = (socket: WebSocket, message: object): void => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const closeServer = (): Promise<void> =>
        new Promise((resolve) => {
            for (const socket of server.clients) socket.terminate();
            try {
                server.close(() => resolve());
            } catch {
                resolve();
            }
        });
    const removeMessage = cdp.onMessage((method, params, sessionId) => {
        if (!client) return;
        send(client, {
            method,
            params,
            ...(sessionId === undefined ? {} : { sessionId }),
        });
    });
    let removeDetached = (): void => undefined;
    const serverFailed = (error: Error): void => {
        if (closed) return;
        closed = true;
        client = undefined;
        removeMessage();
        removeDetached();
        void closeServer()
            .then(() => cdp.release())
            .finally(() => onDetached(`relay failed: ${error.message}`));
    };
    removeDetached = cdp.onDetached((reason) => {
        if (closed) return;
        closed = true;
        client = undefined;
        removeMessage();
        removeDetached();
        void closeServer().finally(() => {
            server.removeListener("error", serverFailed);
            onDetached(reason);
        });
    });

    try {
        await serverListening(server);
    } catch (error) {
        closed = true;
        removeMessage();
        removeDetached();
        await closeServer();
        await cdp.release();
        throw error;
    }

    server.on("error", serverFailed);
    server.on("connection", (socket) => {
        if (client && client.readyState !== WebSocket.CLOSED) {
            socket.close(1013, "A debugger is already attached");
            return;
        }
        client = socket;
        socket.on("message", (data, binary) => {
            if (binary) {
                socket.close(1003, "CDP messages must be JSON text");
                return;
            }
            const request = cdpRequestParse(data);
            if (!request) {
                socket.close(1007, "Invalid CDP request");
                return;
            }
            void cdp.sendCommand(request.method, request.params, request.sessionId).then(
                (result) => send(socket, { id: request.id, result }),
                (error: unknown) =>
                    send(socket, {
                        error: {
                            code: -32_000,
                            message:
                                error instanceof Error ? error.message : "The CDP command failed.",
                        },
                        id: request.id,
                    }),
            );
        });
        socket.once("close", () => {
            if (client === socket) {
                client = undefined;
                // A disconnected external client may have started a trace.
                // End only the trace owned by this shared lease; a live Kissopen
                // profiler trace remains untouched and continues to stream.
                void cdp.endOwnedTracing();
            }
        });
    });

    const address = server.address() as AddressInfo;
    return {
        url: `ws://${LOOPBACK_HOST}:${address.port}${path}`,
        async close() {
            if (closed) return;
            closed = true;
            client = undefined;
            removeMessage();
            removeDetached();
            await closeServer();
            server.removeListener("error", serverFailed);
            await cdp.release();
        },
    };
}

function serverListening(server: WebSocketServer): Promise<void> {
    return new Promise((resolve, reject) => {
        const listening = () => {
            server.removeListener("error", failed);
            resolve();
        };
        const failed = (error: Error) => {
            server.removeListener("listening", listening);
            reject(error);
        };
        server.once("listening", listening);
        server.once("error", failed);
    });
}

function cdpRequestParse(data: RawData): CdpRequest | undefined {
    let candidate: unknown;
    try {
        candidate = JSON.parse(data.toString());
    } catch {
        return undefined;
    }
    if (
        !isRecord(candidate) ||
        typeof candidate.id !== "number" ||
        !Number.isInteger(candidate.id) ||
        candidate.id < 0
    )
        return undefined;
    if (typeof candidate.method !== "string" || candidate.method.length === 0) return undefined;
    if (candidate.params !== undefined && !isRecord(candidate.params)) return undefined;
    if (candidate.sessionId !== undefined && typeof candidate.sessionId !== "string")
        return undefined;
    return {
        id: candidate.id as number,
        method: candidate.method,
        ...(candidate.params === undefined
            ? {}
            : { params: candidate.params as Record<string, unknown> }),
        ...(candidate.sessionId === undefined ? {} : { sessionId: candidate.sessionId }),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
