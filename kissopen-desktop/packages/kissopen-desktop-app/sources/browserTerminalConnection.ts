import type { TerminalConnection } from "kissopen-desktop-state";

/**
 * The subprotocol a terminal attachment asks for. Every desktop terminal bridge
 * accepts this name, so one connection implementation reaches every workspace.
 */
export const TERMINAL_PROTOCOL = "kissopen2-terminal.v1";

/**
 * Turns a base URL and an attach path into the WebSocket URL for it. An absolute
 * `http(s)` base yields an absolute URL; a same-origin base (`""`, or the dev
 * bridge's root-relative endpoint) resolves against the current page so the
 * socket stays on the origin that served the app.
 */
export function terminalSocketUrl(base: string, path: string): string {
    const url = new URL(`${base}${path}`, globalThis.location?.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
}

/** Copies a protocol frame into a fresh ArrayBuffer the DOM WebSocket accepts. */
function toArrayBuffer(chunk: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer;
}

/**
 * Wraps a browser WebSocket as the transport-neutral terminal byte channel the
 * binary protocol drives. Outbound frames buffer until the socket opens; inbound
 * frames buffer while the protocol has paused for backpressure; `error`/`close`
 * fan out to every registered listener so both the protocol and the owning store
 * observe the same lifecycle.
 */
export class BrowserTerminalConnection implements TerminalConnection {
    private readonly socket: WebSocket;
    private readonly dataListeners = new Set<(chunk: Uint8Array) => void>();
    private readonly closeListeners = new Set<() => void>();
    private readonly errorListeners = new Set<(error: Error) => void>();
    private readonly outbound: Uint8Array[] = [];
    private readonly inbound: Uint8Array[] = [];
    private paused = false;
    private opened = false;
    private closedFlag = false;

    constructor(url: string, protocols: readonly string[]) {
        this.socket = new WebSocket(url, protocols as string[]);
        this.socket.binaryType = "arraybuffer";
        this.socket.onopen = () => {
            this.opened = true;
            for (const chunk of this.outbound.splice(0)) this.socket.send(toArrayBuffer(chunk));
        };
        this.socket.onmessage = (event) => {
            const chunk =
                event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : undefined;
            if (!chunk) return;
            if (this.paused) this.inbound.push(chunk);
            else for (const listener of this.dataListeners) listener(chunk);
        };
        this.socket.onerror = () => {
            const error = new Error("The terminal connection failed.");
            const listeners = [...this.errorListeners];
            this.errorListeners.clear();
            for (const listener of listeners) listener(error);
        };
        this.socket.onclose = () => {
            this.closedFlag = true;
            const listeners = [...this.closeListeners];
            this.closeListeners.clear();
            for (const listener of listeners) listener();
        };
    }

    on(_event: "data", listener: (chunk: Uint8Array) => void): void {
        this.dataListeners.add(listener);
    }

    once(event: "error", listener: (error: Error) => void): void;
    once(event: "close", listener: () => void): void;
    once(event: "error" | "close", listener: ((error: Error) => void) & (() => void)): void {
        if (event === "error") this.errorListeners.add(listener);
        else this.closeListeners.add(listener);
    }

    write(chunk: Uint8Array): void {
        if (this.closedFlag) return;
        if (this.opened && this.socket.readyState === WebSocket.OPEN)
            this.socket.send(toArrayBuffer(chunk));
        else this.outbound.push(chunk);
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
        for (const chunk of this.inbound.splice(0))
            for (const listener of this.dataListeners) listener(chunk);
    }

    destroy(error?: Error): void {
        if (this.closedFlag) return;
        this.closedFlag = true;
        // Node `Duplex.destroy(error)` semantics: a protocol decode/validation
        // failure must reach the error listeners once, before the close, instead
        // of being swallowed into a silent reconnect.
        if (error) {
            const listeners = [...this.errorListeners];
            this.errorListeners.clear();
            for (const listener of listeners) listener(error);
        }
        try {
            this.socket.close();
        } catch {
            // Closing an already-closed socket is fine.
        }
    }

    get destroyed(): boolean {
        return this.closedFlag;
    }
}
