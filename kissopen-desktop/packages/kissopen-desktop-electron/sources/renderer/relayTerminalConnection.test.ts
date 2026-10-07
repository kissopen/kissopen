/*
A terminal's bytes, on the near side of the process boundary.

What these hold is the three things this side owes the driver: the screen the
machine sends arrives even when it beats the handle across, what was typed
before there was anywhere to send it is sent afterwards in order, and letting
go stops both.
*/
import { describe, it, expect } from "vitest";
import { relayTerminalConnection } from "./relayTerminalConnection";
import type { KissopenDesktopBridge } from "../shared/desktopContract";

/** A bridge that answers the attach when told to, not before. */
function fakeBridge(handle = 7) {
    const data: ((handle: number, chunk: Uint8Array) => void)[] = [];
    const closed: ((handle: number, error?: string) => void)[] = [];
    const written: Uint8Array[] = [];
    const detached: number[] = [];
    let answer: ((value: { ok: true; handle: number }) => void) | undefined;
    const attached = new Promise<{ ok: true; handle: number }>((resolve) => {
        answer = resolve;
    });
    const bridge = {
        relayTerminalAttach: () => attached,
        relayTerminalWrite: async (_handle: number, chunk: Uint8Array) => {
            written.push(chunk);
            return { ok: true as const };
        },
        relayTerminalDetach: (given: number) => {
            detached.push(given);
        },
        relayTerminalDataSubscribe(listener: (handle: number, chunk: Uint8Array) => void) {
            data.push(listener);
            return () => data.splice(data.indexOf(listener), 1);
        },
        relayTerminalClosedSubscribe(listener: (handle: number, error?: string) => void) {
            closed.push(listener);
            return () => closed.splice(closed.indexOf(listener), 1);
        },
    } as unknown as KissopenDesktopBridge;
    return {
        bridge,
        handle,
        written,
        detached,
        push: (given: number, chunk: Uint8Array) => {
            for (const listener of [...data]) listener(given, chunk);
        },
        end: (given: number, error?: string) => {
            for (const listener of [...closed]) listener(given, error);
        },
        open: async () => {
            answer?.({ ok: true, handle });
            await Promise.resolve();
            await Promise.resolve();
        },
    };
}

describe("a remote terminal's channel", () => {
    /*
     * A terminal replays its screen the moment it is attached to, which can
     * be under way before the answer carrying the handle has come back. Those
     * bytes are the first thing the reader is owed, not the first thing lost.
     */
    it("keeps bytes that arrive before the handle does", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        const seen: Uint8Array[] = [];
        channel.on("data", (chunk) => seen.push(chunk));

        relay.push(relay.handle, new Uint8Array([1]));
        expect(seen).toEqual([]);
        await relay.open();
        expect(seen).toEqual([new Uint8Array([1])]);
    });

    it("ignores another attachment's bytes", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        const seen: Uint8Array[] = [];
        channel.on("data", (chunk) => seen.push(chunk));

        relay.push(relay.handle + 1, new Uint8Array([9]));
        await relay.open();
        relay.push(relay.handle + 1, new Uint8Array([9]));
        expect(seen).toEqual([]);
    });

    // Split across two chunks, an escape sequence out of order is not late.
    it("sends what was typed before the handle, in order", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        channel.write(new Uint8Array([1]));
        channel.write(new Uint8Array([2]));
        await relay.open();
        channel.write(new Uint8Array([3]));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(relay.written).toEqual([
            new Uint8Array([1]),
            new Uint8Array([2]),
            new Uint8Array([3]),
        ]);
    });

    it("holds bytes while paused and gives them back on resume", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        const seen: Uint8Array[] = [];
        channel.on("data", (chunk) => seen.push(chunk));
        await relay.open();

        channel.pause();
        relay.push(relay.handle, new Uint8Array([1]));
        expect(seen).toEqual([]);
        channel.resume();
        expect(seen).toEqual([new Uint8Array([1])]);
    });

    it("ends when the machine ends it, and says why", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        await relay.open();
        const failures: Error[] = [];
        channel.once("error", ((error: Error) => failures.push(error)) as never);

        relay.end(relay.handle, "掉线了");
        expect(failures.map((error) => error.message)).toEqual(["掉线了"]);
        expect(channel.destroyed).toBe(true);
    });

    // Letting go is this window's business; the terminal lives on without it.
    it("lets the attachment go when destroyed", async () => {
        const relay = fakeBridge();
        const channel = relayTerminalConnection(relay.bridge, "sess-1", "term-1");
        await relay.open();
        channel.destroy();
        expect(relay.detached).toEqual([relay.handle]);
        expect(channel.destroyed).toBe(true);
    });
});
