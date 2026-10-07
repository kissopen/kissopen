/**
 * A low-level, already authenticated bidirectional byte channel to one remote
 * terminal. It carries opaque binary protocol frames only: the transport owns
 * how those bytes reach the server (URL, credentials, WebSocket subprotocols),
 * and never surfaces any of that to product state or UI code. The method subset
 * mirrors the reader/writer surface the terminal protocol drives, so a concrete
 * connection can be a browser WebSocket wrapper or an in-memory test pair
 * without depending on Node stream internals.
 */
export interface TerminalConnection {
    /** Delivers each inbound binary frame exactly as received from the server. */
    on(event: "data", listener: (chunk: Uint8Array) => void): void;
    /** Reports a transport failure; the channel is unusable afterward. */
    once(event: "error", listener: (error: Error) => void): void;
    /** Reports that the channel closed after any final inbound frames. */
    once(event: "close", listener: () => void): void;
    /** Queues one outbound binary frame; buffered until the channel is open. */
    write(chunk: Uint8Array): void;
    /** Pauses inbound `data` delivery so the reader can apply backpressure. */
    pause(): void;
    /** Resumes inbound `data` delivery after a pause. */
    resume(): void;
    /** Tears the channel down, optionally reporting the cause to the peer. */
    destroy(error?: Error): void;
    /** True once the channel has been destroyed or closed. */
    readonly destroyed: boolean;
}
