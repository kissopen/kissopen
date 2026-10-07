import { randomBytes } from "node:crypto";
import {
    Agent,
    createServer,
    request as requestHttp,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import type { AddressInfo, Socket } from "node:net";
import type { Duplex } from "node:stream";

export const serviceBrowserAdmissionHeader = "X-KISSOPEN-Browser-Service-Request";
const maxConnections = 256;
const maxHeaderBytes = 64 * 1024;

interface Admission {
    readonly address: string;
    readonly method: string;
    readonly serviceId: string;
    readonly expiresAt: number;
}

export interface ServiceBrowserProxy {
    readonly port: number;
    readonly username: string;
    readonly password: string;
    authorize(address: string, method: string, serviceId: string): string;
    revoke(credential: string): void;
    connectionsClose(): void;
    close(): void;
}

/** A credentialed loopback HTTP front end, never an arbitrary forward proxy. */
export async function serviceBrowserProxyCreate(
    open: (serviceId: string, signal: AbortSignal) => Promise<Duplex>,
    privateSuffix: string,
): Promise<ServiceBrowserProxy> {
    const username = randomBytes(24).toString("base64url");
    const password = randomBytes(32).toString("base64url");
    const proxyAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    const websocketOrigins = new WeakMap<Duplex, string>();
    const admissions = new Map<string, Admission>();
    const sockets = new Set<Duplex>();
    const operations = new Set<AbortController>();
    let closed = false;
    const track = (socket: Duplex) => {
        sockets.add(socket);
        socket.on("error", () => socket.destroy());
        socket.once("close", () => sockets.delete(socket));
    };
    const consume = (request: IncomingMessage): Admission | undefined => {
        const credential = request.headers[serviceBrowserAdmissionHeader.toLowerCase()];
        if (typeof credential !== "string") return undefined;
        const admission = admissions.get(credential);
        admissions.delete(credential);
        const boundOrigin = websocketOrigins.get(request.socket);
        const target = request.url ?? "";
        if (boundOrigin && !/^\/(?!\/)/.test(target)) return undefined;
        const address = serviceBrowserAddress(
            boundOrigin ? new URL(target, boundOrigin).href : target,
        );
        if (
            !admission ||
            admission.expiresAt < Date.now() ||
            !address ||
            admission.address !== address.href ||
            admission.method !== request.method ||
            (boundOrigin !== undefined && address.origin !== boundOrigin) ||
            (request.headers.host !== address.host && request.headers.host !== `${address.host}:80`)
        )
            return undefined;
        return admission;
    };
    const forward = async (
        request: IncomingMessage,
        response: ServerResponse | undefined,
        client: Duplex,
        head: Buffer,
    ) => {
        const admission = consume(request);
        const upgrade = response === undefined;
        if (
            !admission ||
            operations.size >= maxConnections ||
            head.length > maxHeaderBytes ||
            (upgrade &&
                (request.method !== "GET" ||
                    request.headers.upgrade?.toLowerCase() !== "websocket"))
        ) {
            if (response) {
                response.writeHead(403);
                response.end("Private workspace service request denied.");
            } else
                client.end(
                    "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
                );
            return;
        }
        const controller = new AbortController();
        operations.add(controller);
        let tunnel: Duplex | undefined;
        let agent: Agent | undefined;
        let ended = false;
        const finish = () => {
            if (ended) return;
            ended = true;
            controller.abort();
            operations.delete(controller);
            client.off("close", finish);
            tunnel?.destroy();
            agent?.destroy();
        };
        client.once("close", finish);
        request.once("aborted", finish);
        response?.once("close", finish);
        response?.once("finish", finish);
        try {
            // The timeout bounds authentication and CONNECT, not a long-lived response.
            tunnel = await open(
                admission.serviceId,
                AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
            );
            if (ended || closed) {
                tunnel.destroy();
                finish();
                return;
            }
            track(tunnel);
            agent = new Agent({ keepAlive: false, maxSockets: 1 });
            let used = false;
            const endpoint = tunnel;
            agent.createConnection = () => {
                if (used || endpoint.destroyed)
                    throw new Error("The service connection has closed.");
                used = true;
                return endpoint as Socket;
            };
            const address = new URL(admission.address);
            const upstream = requestHttp(
                {
                    hostname: "workspace-service.invalid",
                    agent,
                    method: request.method,
                    path: address.pathname + address.search,
                    headers: forwardedHeaders(request, upgrade, true),
                    maxHeaderSize: maxHeaderBytes,
                },
                (incoming) => {
                    incoming.on("error", () => {
                        client.destroy();
                        finish();
                    });
                    incoming.once("aborted", () => {
                        client.destroy();
                        finish();
                    });
                    if (response) {
                        response.writeHead(
                            incoming.statusCode ?? 502,
                            incoming.statusMessage,
                            forwardedHeaders(incoming),
                        );
                        incoming.once("end", () => response.addTrailers(incoming.trailers));
                        incoming.pipe(response);
                    } else {
                        client.write(responseHead(incoming, false));
                        incoming.pipe(client);
                        client.once("finish", finish);
                    }
                },
            );
            upstream.once("upgrade", (incoming, socket, upstreamHead) => {
                if (
                    !upgrade ||
                    incoming.statusCode !== 101 ||
                    incoming.headers.upgrade?.toLowerCase() !== "websocket"
                ) {
                    socket.destroy();
                    finish();
                    return;
                }
                (client as Socket).setTimeout(0);
                client.write(responseHead(incoming, true));
                if (upstreamHead.length) client.write(upstreamHead);
                if (head.length) socket.write(head);
                socket.on("error", () => client.destroy());
                socket.once("close", () => {
                    client.destroy();
                    finish();
                });
                client.pipe(socket);
                socket.pipe(client);
            });
            upstream.once("error", () => {
                if (response && !response.headersSent) {
                    response.writeHead(502);
                    response.end("The workspace service is unavailable.");
                } else client.destroy();
                finish();
            });
            if (upgrade) upstream.end();
            else {
                request.once("end", () => upstream.addTrailers(request.trailers));
                request.pipe(upstream);
            }
        } catch {
            if (response && !response.headersSent) {
                response.writeHead(502);
                response.end("The workspace service is unavailable.");
            } else client.destroy();
            finish();
        }
    };
    const server = createServer(
        { maxHeaderSize: maxHeaderBytes, headersTimeout: 10_000, requestTimeout: 0 },
        (request, response) => {
            void forward(request, response, request.socket, Buffer.alloc(0));
        },
    );
    server.on("upgrade", (request, client, head) => {
        void forward(request, undefined, client, head);
    });
    // Chromium uses CONNECT even for ws://. That opens only another local
    // HTTP parser, never a raw destination. The inner Upgrade still requires
    // the one-use request admission before any service connection is opened.
    const websocketHttp = createServer(
        { maxHeaderSize: maxHeaderBytes, headersTimeout: 10_000, requestTimeout: 0 },
        (_request, response) => {
            response.writeHead(403, { connection: "close" });
            response.end();
        },
    );
    websocketHttp.on("upgrade", (request, client, head) => {
        void forward(request, undefined, client, head);
    });
    websocketHttp.on("connect", (_request, client) => client.destroy());
    websocketHttp.on("clientError", (_error, client) => client.destroy());
    server.on("connect", (request, client, head) => {
        const address = serviceBrowserAddress(`http://${request.url ?? ""}`);
        const label = address?.hostname.endsWith(privateSuffix)
            ? address.hostname.slice(0, -privateSuffix.length)
            : "";
        if (
            !address ||
            !/^s-[a-z][a-z0-9]{1,127}$/.test(label) ||
            request.url !== `${address.hostname}:80` ||
            head.length > maxHeaderBytes
        ) {
            client.destroy();
            return;
        }
        if (request.headers["proxy-authorization"] !== proxyAuthorization) {
            client.end(
                'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="KISSOPEN private service"\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
            );
            return;
        }
        (client as Socket).setTimeout(20_000, () => client.destroy());
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n", () => {
            if (client.destroyed) return;
            websocketOrigins.set(client, address.origin);
            if (head.length) client.unshift(head);
            websocketHttp.emit("connection", client);
            client.resume();
        });
    });
    server.on("clientError", (_error, client) => client.destroy());
    server.on("connection", (socket) => {
        if (sockets.size >= maxConnections * 2) {
            socket.destroy();
            return;
        }
        track(socket);
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const connectionsClose = () => {
        admissions.clear();
        for (const operation of operations) operation.abort();
        for (const socket of sockets) socket.destroy();
    };
    return {
        port: (server.address() as AddressInfo).port,
        username,
        password,
        authorize(address, method, serviceId) {
            for (const [key, admission] of admissions)
                if (admission.expiresAt < Date.now()) admissions.delete(key);
            if (closed || admissions.size >= maxConnections)
                throw new Error("The service browser is busy.");
            const normalized = serviceBrowserAddress(address);
            if (!normalized) throw new Error("Invalid service address.");
            const credential = randomBytes(32).toString("base64url");
            admissions.set(credential, {
                address: normalized.href,
                method,
                serviceId,
                expiresAt: Date.now() + 10_000,
            });
            return credential;
        },
        revoke: (credential) => {
            admissions.delete(credential);
        },
        connectionsClose,
        close() {
            closed = true;
            connectionsClose();
            server.close();
        },
    };
}

/** WebSocket and HTTP requests address the same application origin. */
export function serviceBrowserAddress(candidate: string): URL | undefined {
    try {
        const address = new URL(candidate);
        if (address.protocol === "ws:") address.protocol = "http:";
        if (
            address.protocol !== "http:" ||
            address.username ||
            address.password ||
            address.hash ||
            candidate.length > 65536
        )
            return undefined;
        return address;
    } catch {
        return undefined;
    }
}

function forwardedHeaders(message: IncomingMessage, upgrade = false, request = false): string[] {
    const omitted = new Set([
        "connection",
        "keep-alive",
        "proxy-connection",
        "proxy-authorization",
        "proxy-authenticate",
        "te",
        "transfer-encoding",
        "upgrade",
        serviceBrowserAdmissionHeader.toLowerCase(),
        "x-kissopen-service-authorization",
    ]);
    if (request) omitted.add("content-length");
    for (const name of (message.headers.connection ?? "").split(","))
        omitted.add(name.trim().toLowerCase());
    const headers: string[] = [];
    for (let i = 0; i < message.rawHeaders.length; i += 2) {
        const name = message.rawHeaders[i]!;
        if (!omitted.has(name.toLowerCase())) headers.push(name, message.rawHeaders[i + 1]!);
    }
    if (request) {
        if (message.headers["transfer-encoding"] !== undefined)
            headers.push("Transfer-Encoding", "chunked");
        else if (message.headers["content-length"] !== undefined)
            headers.push("Content-Length", message.headers["content-length"]);
    }
    if (upgrade) headers.push("Connection", "Upgrade", "Upgrade", "websocket");
    return headers;
}

function responseHead(response: IncomingMessage, upgrade: boolean): string {
    const headers = forwardedHeaders(response, upgrade);
    if (!upgrade) headers.push("Connection", "close");
    let result = `HTTP/1.1 ${String(response.statusCode ?? 502)} ${response.statusMessage ?? ""}\r\n`;
    for (let i = 0; i < headers.length; i += 2) result += `${headers[i]}: ${headers[i + 1]}\r\n`;
    return result + "\r\n";
}
