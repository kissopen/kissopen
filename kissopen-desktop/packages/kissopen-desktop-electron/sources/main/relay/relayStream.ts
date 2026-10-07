/*
One byte stream to a machine on the relay.

The relay carries these for things that are not a question and an answer: a
terminal, whose two flows outlive any one message and must arrive in the order
they were sent. What rides here is the daemon's own attach protocol, which
already solves ordering, resize barriers, replay and backpressure — so this
carries bytes and does not look at them.

The chunk-by-chunk wait is the backpressure. A sender that did not wait would
be writing into this process rather than into the machine, and a terminal
nobody is reading would grow here until it stopped being a terminal.
*/
import { t } from "kissopen-desktop-state/i18n";
import type { RelaySocket } from "./relayTransport";

/** What the relay answers when a stream is opened. */
type OpenAnswer = { ok?: boolean; id?: string; error?: string };

/** One open stream, as the caller of this module holds it. */
export interface RelayStream {
    /** Sends one chunk, resolving once the machine has taken it. */
    write(chunk: Uint8Array): Promise<void>;
    /** Says this end is finished. Safe to call more than once. */
    close(error?: string): void;
    readonly closed: boolean;
}

/** What a stream reports back while it is open. */
export interface RelayStreamListener {
    /** One chunk from the machine, in the order it was sent. */
    data(chunk: Uint8Array): void;
    /** The stream ended. `error` says why, when it was not an ordinary close. */
    closed(error?: string): void;
}

/**
 * Opens a stream against a method the machine registered.
 *
 * The method is the same kind of name an RPC uses, so a machine offers a
 * stream the way it offers anything else; what differs is that this one stays
 * open. Throws when the machine will not take it, because a stream that was
 * refused is not a stream with no bytes — the caller has to know which.
 */
export async function relayStreamOpen(
    socket: RelaySocket,
    method: string,
    params: unknown,
    listener: RelayStreamListener,
): Promise<RelayStream> {
    const answer = (await socket.request("stream-open", { method, params })) as OpenAnswer;
    if (answer?.ok !== true || typeof answer.id !== "string")
        throw new Error(answer?.error || t("那台机器没有接受这条连接"));

    const id = answer.id;
    let closed = false;

    const stopData = socket.onStreamData((incoming) => {
        if (incoming.id !== id || closed) return;
        listener.data(incoming.chunk);
    });
    const stopClosed = socket.onStreamClosed((incoming) => {
        if (incoming.id !== id || closed) return;
        closed = true;
        stopData();
        stopClosed();
        listener.closed(incoming.error);
    });

    return {
        get closed() {
            return closed;
        },
        async write(chunk: Uint8Array) {
            if (closed) throw new Error(t("这条连接已经关了"));
            const sent = (await socket.request("stream-data", { id, chunk })) as {
                ok?: boolean;
                error?: string;
            };
            // A refusal is the far end gone or not reading. Either way this
            // stream is over: the chunks after it would arrive out of order,
            // and out of order is a corrupted screen rather than a late one.
            if (sent?.ok !== true) {
                closed = true;
                stopData();
                stopClosed();
                listener.closed(sent?.error ?? t("对端没有收下"));
                throw new Error(sent?.error || t("对端没有收下"));
            }
        },
        close(error?: string) {
            if (closed) return;
            closed = true;
            stopData();
            stopClosed();
            void socket
                .request("stream-close", { id, ...(error ? { error } : {}) })
                .catch(() => undefined);
            listener.closed(error);
        },
    };
}
