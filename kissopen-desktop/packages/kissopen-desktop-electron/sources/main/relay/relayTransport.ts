/*
How this process reaches the relay.

An interface rather than socket.io and fetch directly, for two reasons. The
tests need a relay they can drive, and driving a real one to reproduce a
reconnect or a dropped update is not a test anybody maintains. And the main
process should be able to change how it makes requests — proxies, timeouts,
certificate handling — without that reaching the code that reads conversations.
*/

/** One live connection to the relay, as this client needs it. */
export interface RelaySocket {
    /** Fires for every durable change the account makes anywhere. */
    on(event: "update", listener: (payload: unknown) => void): void;
    /** Fires for presence and other state that is not worth storing. */
    on(event: "ephemeral", listener: (payload: unknown) => void): void;
    on(event: "connect", listener: () => void): void;
    on(event: "disconnect", listener: (reason: string) => void): void;
    /*
    Asks the machine on the other end to do something, and waits for it.

    Approving a tool call and stopping a run are not records to be appended:
    they are answers a paused agent is blocking on, and the relay carries them
    as acknowledged calls over this same socket rather than through REST. The
    method name is `<sessionId>:<verb>` and the params are already encrypted
    under that session's key, exactly as the phone sends them — the relay
    forwards bytes it cannot read.
    */
    rpc(method: string, params: string): Promise<RelayRpcResult>;
    /*
    Asks the relay something and waits for its answer.

    Wider than `rpc`, which speaks one session's encrypted calls. A stream is
    opened, fed and closed with plain events the relay itself answers, because
    the relay is the one routing it — what travels inside it is still opaque
    to the relay, and still the machine's own protocol.
    */
    request(event: string, payload: unknown): Promise<unknown>;
    /** One chunk arriving on some open stream. Returns the unsubscribe. */
    onStreamData(listener: (incoming: { id: string; chunk: Uint8Array }) => void): () => void;
    /** A stream ended, from the far end or from the relay. */
    onStreamClosed(listener: (incoming: { id: string; error?: string }) => void): () => void;
    close(): void;
}

/** What the machine answered. `result` is ciphertext under the session key. */
export type RelayRpcResult = { ok: true; result: string } | { ok: false; error?: string };

export interface RelayTransport {
    /**
     * Opens a user-scoped connection.
     *
     * User-scoped is what a reader is: the relay sends this connection every
     * change in the account, from any machine, rather than one session's.
     */
    connect(options: { serverUrl: string; token: string }): RelaySocket;
    /** An authenticated GET against the relay's REST API. */
    get(options: {
        serverUrl: string;
        token: string;
        path: string;
    }): Promise<{ status: number; text: string }>;
    /**
     * An authenticated POST. Used for sending, which the relay authorises on
     * the account alone — this desktop is as entitled to it as the phone.
     */
    post(options: {
        serverUrl: string;
        token: string;
        path: string;
        body: string;
    }): Promise<{ status: number; text: string }>;
    /**
     * An authenticated DELETE. Taking a conversation off the relay is the one
     * use; a transport without it cannot delete, and says so.
     */
    delete?(options: {
        serverUrl: string;
        token: string;
        path: string;
    }): Promise<{ status: number; text: string }>;
}
