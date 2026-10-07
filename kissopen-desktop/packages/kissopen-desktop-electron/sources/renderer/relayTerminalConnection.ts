/*
A terminal on another machine, as the window's own terminal driver wants it.

`TerminalConnection` is a duplex of bytes with a pause and a resume — nothing
about where the bytes come from. That is why the driver, the emulator and the
whole attach protocol work here unchanged: what differs between a shell on
this computer and one on a Mac across the room is only which pipe the bytes
came down.

The pipe itself is the main process's, because the relay credential is. This
side holds the handle it was given and the bytes it was sent.
*/
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type { TerminalConnection } from "kissopen-desktop-state";

/**
 * Attaches to one terminal and answers the channel for it.
 *
 * The attachment is asked for as this is built, so a channel exists from the
 * first moment a caller has one — the driver may write into it before the
 * machine has answered, and those bytes wait rather than being lost.
 */
export function relayTerminalConnection(
    bridge: KissopenDesktopBridge,
    sessionId: string,
    terminalId: string,
): TerminalConnection {
    const data: ((chunk: Uint8Array) => void)[] = [];
    const errors: ((error: Error) => void)[] = [];
    const closes: (() => void)[] = [];

    /** Bytes that arrived while the reader was paused, in the order they came. */
    const held: Uint8Array[] = [];
    /** What the caller wrote before the machine answered. */
    const queued: Uint8Array[] = [];

    let handle: number | undefined;
    let paused = false;
    let destroyed = false;
    let failure: Error | undefined;

    const deliver = (chunk: Uint8Array) => {
        if (destroyed) return;
        if (paused || data.length === 0) {
            held.push(chunk);
            return;
        }
        for (const listener of data) listener(chunk);
    };

    const drain = () => {
        while (!paused && !destroyed && held.length > 0 && data.length > 0) {
            const chunk = held.shift()!;
            for (const listener of data) listener(chunk);
        }
    };

    const fail = (error: Error) => {
        if (destroyed) return;
        failure = error;
        destroyed = true;
        for (const listener of errors) listener(error);
        for (const listener of closes) listener();
    };

    const finish = () => {
        if (destroyed) return;
        destroyed = true;
        for (const listener of closes) listener();
    };

    /*
     * What arrived before this side learned its own number.
     *
     * The machine starts sending the moment it is attached to — a terminal
     * replays its screen — and that can be under way before the answer
     * carrying the handle has come back across the process boundary. Without
     * this, the first thing a reader sees would be whatever came after the
     * screen they were supposed to be given.
     */
    let early: { incoming: number; chunk?: Uint8Array; error?: string; ended?: true }[] | undefined =
        [];

    const receive = (incoming: number, chunk: Uint8Array) => {
        if (handle === undefined) {
            early?.push({ incoming, chunk });
            return;
        }
        if (incoming === handle) deliver(chunk);
    };

    const ended = (incoming: number, error?: string) => {
        if (handle === undefined) {
            early?.push({ incoming, ...(error === undefined ? {} : { error }), ended: true });
            return;
        }
        if (incoming !== handle) return;
        stopData();
        stopClosed();
        if (error === undefined) finish();
        else fail(new Error(error));
    };

    const stopData = bridge.relayTerminalDataSubscribe(receive);
    const stopClosed = bridge.relayTerminalClosedSubscribe(ended);

    /** Replays what was held, in the order it came, now that it is addressed. */
    const catchUp = () => {
        const waiting = early ?? [];
        early = undefined;
        for (const item of waiting) {
            if (item.ended) ended(item.incoming, item.error);
            else if (item.chunk) receive(item.incoming, item.chunk);
        }
    };

    /*
     * Opening is asynchronous and the channel is not: the driver is handed
     * this and may write immediately. What it writes before the machine has
     * answered is held here and sent in order once there is somewhere to send
     * it, which is the same promise the pipe makes afterwards.
     */
    const opening = bridge
        .relayTerminalAttach(sessionId, terminalId)
        .then((answer) => {
            if (destroyed) {
                if (answer.ok) bridge.relayTerminalDetach(answer.handle);
                return;
            }
            if (!answer.ok) {
                early = undefined;
                fail(new Error(answer.error));
                return;
            }
            handle = answer.handle;
            catchUp();
            const pending = queued.splice(0, queued.length);
            return pending.reduce(
                (order, chunk) => order.then(() => send(chunk)),
                Promise.resolve(),
            );
        })
        .catch((error: unknown) => {
            fail(error instanceof Error ? error : new Error(String(error)));
        });

    /** One chunk out, in the order it was written. */
    const send = async (chunk: Uint8Array) => {
        if (handle === undefined || destroyed) return;
        const sent = await bridge.relayTerminalWrite(handle, chunk);
        if (!sent.ok) fail(new Error(sent.error));
    };

    /*
     * Writes are chained so they reach the machine in the order the driver
     * made them. Out of order, an escape sequence split across two chunks is
     * not late — it is two different sequences.
     */
    let writing: Promise<unknown> = opening;

    return {
        on(_event: "data", listener: (chunk: Uint8Array) => void) {
            data.push(listener);
            drain();
        },
        once(event: "error" | "close", listener: never) {
            if (event === "error") {
                errors.push(listener as unknown as (error: Error) => void);
                // A channel that already failed still owes its reason to a
                // listener that arrives afterwards.
                if (failure) (listener as unknown as (error: Error) => void)(failure);
                return;
            }
            closes.push(listener as unknown as () => void);
            if (destroyed && !failure) (listener as unknown as () => void)();
        },
        write(chunk: Uint8Array) {
            if (destroyed) return;
            if (handle === undefined) {
                queued.push(chunk);
                return;
            }
            writing = writing.then(() => send(chunk)).catch(() => undefined);
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
            drain();
        },
        destroy(error?: Error) {
            if (destroyed) return;
            stopData();
            stopClosed();
            if (handle !== undefined) bridge.relayTerminalDetach(handle);
            if (error) fail(error);
            else finish();
        },
        get destroyed() {
            return destroyed;
        },
    };
}
