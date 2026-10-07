/*
The real relay transport: socket.io for updates, fetch for the rest.

Separated from the reader so that the reader can be tested against a relay a
test drives, and so the things that only matter to a real network — the socket
path, reconnection, timeouts — live in one place.
*/
import { t } from "kissopen-desktop-state/i18n";
import { io, type Socket } from "socket.io-client";
import type { RelayRpcResult, RelaySocket, RelayTransport } from "./relayTransport";

/**
 * Where the relay's socket lives. Not the origin: the relay serves its REST
 * API from the root and its updates from here.
 */
const SOCKET_PATH = "/v1/updates";

/** How long a REST call may take before it is treated as a failure. */
const REQUEST_TIMEOUT_MS = 30_000;

/*
How long to wait for a machine to answer a call.

A computer on the other end may be asleep, and a control the reader pressed
should say so rather than hang; but giving up before the relay does was worse.
The relay itself waits up to about 47 seconds for the machine, so a call this
side had already reported as unanswered could still land afterwards — an
answer or a Stop taking effect after the reader was told it had not, and a
retry racing it. This waits just past the relay.
*/
const RPC_TIMEOUT_MS = 50_000;

/**
 * Identifies this client to the relay, in the form the other clients use
 * (`platform/version`). It is used for metrics and for telling one of a
 * person's clients from another, not for access.
 */
function clientId(version: string): string {
    return `desktop/${version}`;
}

export function relayTransportLive(version: string): RelayTransport {
    return {
        connect({ serverUrl, token }): RelaySocket {
            const socket: Socket = io(serverUrl, {
                path: SOCKET_PATH,
                /*
                A callback, not a literal: socket.io re-invokes it on every
                connect and reconnect. With a literal, a socket that connected
                once would keep replaying whatever was true then — which, for
                a machine that sleeps and wakes, is most of the time.

                user-scoped is what a reader is: the relay then sends this
                connection every change in the account, from any machine,
                rather than one session's.
                */
                auth: (cb: (data: Record<string, unknown>) => void) =>
                    cb({
                        token,
                        clientType: "user-scoped",
                        kissopenClient: clientId(version),
                        // A desktop window is a surface the person is looking
                        // at when it exists at all; it is not a phone that gets
                        // backgrounded by the system.
                        appState: "active",
                    }),
                transports: ["websocket"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: Infinity,
            });
            return {
                on(event: string, listener: (payload: never) => void) {
                    socket.on(event, listener as (...args: unknown[]) => void);
                },
                async request(event: string, payload: unknown): Promise<unknown> {
                    return await socket
                        .timeout(RPC_TIMEOUT_MS)
                        .emitWithAck(event, payload)
                        .catch(() => {
                            throw new Error(t("中继没有应答"));
                        });
                },
                onStreamData(listener: (incoming: { id: string; chunk: Uint8Array }) => void) {
                    /*
                     * Acknowledged as it is handed on, which is what lets the
                     * far end's writer feel this end's pace: the relay holds
                     * its sender until this returns.
                     */
                    const receive = (
                        payload: { id?: unknown; chunk?: unknown },
                        ack?: (answer: unknown) => void,
                    ) => {
                        const chunk = payload?.chunk;
                        if (typeof payload?.id !== "string" || !(chunk instanceof Uint8Array)) {
                            ack?.({ ok: false, error: "Invalid chunk" });
                            return;
                        }
                        listener({ id: payload.id, chunk });
                        ack?.({ ok: true });
                    };
                    socket.on("stream-data", receive);
                    return () => socket.off("stream-data", receive);
                },
                onStreamClosed(listener: (incoming: { id: string; error?: string }) => void) {
                    const receive = (payload: { id?: unknown; error?: unknown }) => {
                        if (typeof payload?.id !== "string") return;
                        listener({
                            id: payload.id,
                            ...(typeof payload.error === "string" ? { error: payload.error } : {}),
                        });
                    };
                    socket.on("stream-closed", receive);
                    return () => socket.off("stream-closed", receive);
                },
                async rpc(method: string, params: string): Promise<RelayRpcResult> {
                    /*
                     * A silent failure here would be the worst kind: the reader
                     * pressed Approve and nothing happened, on a machine that
                     * may simply be asleep. Say which it was.
                     */
                    const answer = await socket
                        .timeout(RPC_TIMEOUT_MS)
                        .emitWithAck("rpc-call", { method, params })
                        .catch(() => {
                            throw new Error(t("那台机器没有应答"));
                        });
                    return answer as RelayRpcResult;
                },
                close() {
                    socket.close();
                },
            } as RelaySocket;
        },

        async get(options) {
            return call(version, options, undefined);
        },

        async post(options) {
            return call(version, options, options.body);
        },

        async delete(options) {
            return call(version, options, undefined, "DELETE");
        },
    };
}

/*
One authenticated request to the relay.

redirect: "error" on both: the relay is named by the business server, and
following a redirect would carry this account's bearer somewhere it was never
sent.
*/
async function call(
    version: string,
    options: { serverUrl: string; token: string; path: string },
    body: string | undefined,
    method: "GET" | "POST" | "DELETE" = body === undefined ? "GET" : "POST",
): Promise<{ status: number; text: string }> {
    const response = await fetch(new URL(options.path, options.serverUrl), {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
            Authorization: `Bearer ${options.token}`,
            "X-KISSOPEN-Client": clientId(version),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body }),
    });
    return { status: response.status, text: await response.text() };
}
