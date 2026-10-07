import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { browserLocalKissopenAgentPlugin } from "./browserDevServer";
import type { LocalKissopenAgentConnection } from "./localKissopenAgent";
import {
    KissopenAgentDaemonHttpError,
    type KissopenAgentDaemonClient,
} from "./kissopenAgentDaemonClient";

const endpoint = "/__kissopen_local_kissopen_agent";

type Middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
) => void | Promise<void>;

interface Captured {
    status?: number;
    body: string;
    response: ServerResponse;
}

function fakeResponse(): Captured {
    const captured: Captured = { body: "", response: undefined as unknown as ServerResponse };
    let headersSent = false;
    const response = {
        get headersSent() {
            return headersSent;
        },
        writeHead(status: number) {
            captured.status = status;
            headersSent = true;
            return response;
        },
        write() {
            return true;
        },
        end(chunk?: string) {
            if (chunk) captured.body = chunk;
            return response;
        },
    } as unknown as ServerResponse;
    captured.response = response;
    return captured;
}

function healthReady(version: string) {
    return {
        status: "ready" as const,
        healthy: true,
        ready: true,
        version: { daemon: version, protocol: 17 },
    };
}

/** One daemon connection whose health answers from a scripted queue. */
function connectionWith(
    health: () => Promise<unknown>,
    close = vi.fn(),
): LocalKissopenAgentConnection {
    return {
        client: { health } as unknown as KissopenAgentDaemonClient,
        version: "0.0.55",
        close,
    };
}

function middlewareOf(plugin: ReturnType<typeof browserLocalKissopenAgentPlugin>): Middleware {
    let middleware: Middleware | undefined;
    const server = {
        config: { server: { host: "127.0.0.1", port: 5174 } },
        middlewares: {
            use: (handler: Middleware) => {
                middleware = handler;
            },
        },
        httpServer: undefined,
    };
    const configure = plugin.configureServer;
    if (typeof configure !== "function") throw new Error("The plugin registered no dev server.");
    (configure as (value: unknown) => void).call(plugin, server);
    if (!middleware) throw new Error("The plugin registered no middleware.");
    return middleware;
}

async function health(middleware: Middleware): Promise<Captured> {
    const request = new EventEmitter() as unknown as IncomingMessage;
    Object.assign(request, { method: "GET", url: `${endpoint}/health` });
    const captured = fakeResponse();
    await middleware(request, captured.response, () => undefined);
    return captured;
}

describe("browserLocalKissopenAgentPlugin", () => {
    it("reconnects with a fresh token after the daemon restarts", async () => {
        const staleClose = vi.fn();
        const connect = vi
            .fn<() => Promise<LocalKissopenAgentConnection>>()
            .mockResolvedValueOnce(
                connectionWith(
                    () => Promise.reject(new KissopenAgentDaemonHttpError(401, "invalid token")),
                    staleClose,
                ),
            )
            .mockResolvedValueOnce(connectionWith(() => Promise.resolve(healthReady("0.0.55"))));
        const middleware = middlewareOf(browserLocalKissopenAgentPlugin({ connect }));

        const failed = await health(middleware);
        expect(failed.status).toBe(401);

        const recovered = await health(middleware);
        expect(recovered.status).toBe(200);
        expect(JSON.parse(recovered.body)).toMatchObject({ status: "ready", version: "0.0.55" });
        expect(connect).toHaveBeenCalledTimes(2);
        expect(staleClose).toHaveBeenCalledOnce();
    });

    it("keeps one connection while the daemon answers", async () => {
        const connect = vi
            .fn<() => Promise<LocalKissopenAgentConnection>>()
            .mockResolvedValue(connectionWith(() => Promise.resolve(healthReady("0.0.55"))));
        const middleware = middlewareOf(browserLocalKissopenAgentPlugin({ connect }));

        expect((await health(middleware)).status).toBe(200);
        expect((await health(middleware)).status).toBe(200);
        expect(connect).toHaveBeenCalledOnce();
    });

    it("retries a connect that failed while the daemon was down", async () => {
        const connect = vi
            .fn<() => Promise<LocalKissopenAgentConnection>>()
            .mockRejectedValueOnce(
                new Error("Timed out while waiting for the normal KissOpen Agent daemon."),
            )
            .mockResolvedValueOnce(connectionWith(() => Promise.resolve(healthReady("0.0.55"))));
        const middleware = middlewareOf(browserLocalKissopenAgentPlugin({ connect }));

        expect((await health(middleware)).status).toBe(503);
        expect((await health(middleware)).status).toBe(200);
        expect(connect).toHaveBeenCalledTimes(2);
    });
});
