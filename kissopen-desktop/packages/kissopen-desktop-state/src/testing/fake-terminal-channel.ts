import type { TerminalConnection } from "../transport.js";

/**
 * The test-side half of one terminal byte channel: what the client wrote, and the
 * levers a test pulls to act like the far end of the socket.
 */
export interface FakeTerminalChannel {
    /** Every outbound frame the client has written to this channel, in order. */
    readonly written: readonly Uint8Array[];
    /** Delivers one inbound frame to the client (buffered while it is paused). */
    emit(chunk: Uint8Array): void;
    /** Closes the channel normally. */
    close(): void;
    /** Breaks the channel with an error. */
    error(error: Error): void;
    /** True once either side tore the channel down. */
    readonly destroyed: boolean;
}

/**
 * An in-memory `TerminalConnection` and its far end. Desktop transports hand
 * terminals the same opaque byte channel, so they share this double instead of
 * duplicating buffering, pause/resume, and teardown semantics.
 */
export function fakeTerminalChannelCreate(): {
    readonly connection: TerminalConnection;
    readonly channel: FakeTerminalChannel;
} {
    const dataListeners = new Set<(chunk: Uint8Array) => void>();
    const closeListeners = new Set<() => void>();
    const errorListeners = new Set<(error: Error) => void>();
    const written: Uint8Array[] = [];
    const inbound: Uint8Array[] = [];
    let paused = false;
    let destroyed = false;
    const deliver = (chunk: Uint8Array): void => {
        if (paused) inbound.push(chunk);
        else for (const listener of dataListeners) listener(chunk);
    };
    const tearDown = (error?: Error): void => {
        if (destroyed) return;
        destroyed = true;
        if (error) for (const listener of errorListeners) listener(error);
        for (const listener of closeListeners) listener();
    };
    return {
        connection: {
            on: (_event, listener) => {
                dataListeners.add(listener);
            },
            once: (event, listener) => {
                if (event === "error") errorListeners.add(listener as (error: Error) => void);
                else closeListeners.add(listener as () => void);
            },
            write: (chunk) => {
                if (!destroyed) written.push(chunk);
            },
            pause: () => {
                paused = true;
            },
            resume: () => {
                paused = false;
                for (const chunk of inbound.splice(0)) deliver(chunk);
            },
            destroy: () => tearDown(),
            get destroyed() {
                return destroyed;
            },
        },
        channel: {
            get written() {
                return written;
            },
            emit: (chunk) => deliver(chunk),
            close: () => tearDown(),
            error: (error) => tearDown(error),
            get destroyed() {
                return destroyed;
            },
        },
    };
}
