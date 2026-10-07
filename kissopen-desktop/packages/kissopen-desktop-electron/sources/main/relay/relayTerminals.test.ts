/*
Holding the attachments a window cannot hold itself.

The window is given a number, not a stream: the relay credential and the
account keys live in this process, so the stream does too. What these hold is
that a number addresses exactly one attachment, stops addressing it once it
ends, and that a window going away lets go of all of them.
*/
import { describe, it, expect } from "vitest";
import { RelayTerminals } from "./relayTerminals";
import type { RelaySocket } from "./relayTransport";
import { localeSet } from "kissopen-desktop-state/i18n";

// These messages are written in Chinese and asserted as written.
localeSet("zh");

/** A relay that accepts every stream and records what was sent. */
function fakeSocket() {
    const sent: { event: string; payload: unknown }[] = [];
    const data = new Set<(incoming: { id: string; chunk: Uint8Array }) => void>();
    const closed = new Set<(incoming: { id: string; error?: string }) => void>();
    let streams = 0;
    const socket = {
        request: async (event: string, payload: unknown) => {
            sent.push({ event, payload });
            if (event === "stream-open") return { ok: true, id: `s${String(++streams)}` };
            return { ok: true };
        },
        onStreamData(listener: (incoming: { id: string; chunk: Uint8Array }) => void) {
            data.add(listener);
            return () => data.delete(listener);
        },
        onStreamClosed(listener: (incoming: { id: string; error?: string }) => void) {
            closed.add(listener);
            return () => closed.delete(listener);
        },
    } as unknown as RelaySocket;
    return {
        socket,
        sent,
        push: (incoming: { id: string; chunk: Uint8Array }) => {
            for (const listener of [...data]) listener(incoming);
        },
        end: (incoming: { id: string; error?: string }) => {
            for (const listener of [...closed]) listener(incoming);
        },
    };
}

const listener = () => ({
    chunks: [] as Uint8Array[],
    ends: [] as (string | undefined)[],
    data(_handle: number, chunk: Uint8Array) {
        this.chunks.push(chunk);
    },
    closed(_handle: number, error?: string) {
        this.ends.push(error);
    },
});

describe("attachments held for the window", () => {
    it("attaches against the session's own method", async () => {
        const relay = fakeSocket();
        const terminals = new RelayTerminals();
        await terminals.attach(relay.socket, "sess-1", "term-1", listener());
        expect(relay.sent[0]).toEqual({
            event: "stream-open",
            payload: { method: "sess-1:terminalAttach", params: { terminalId: "term-1" } },
        });
    });

    // Two attachments are two handles, each carrying only its own bytes.
    it("keeps two attachments apart", async () => {
        const relay = fakeSocket();
        const terminals = new RelayTerminals();
        const first = listener();
        const second = listener();
        const one = await terminals.attach(relay.socket, "sess-1", "term-1", first);
        const two = await terminals.attach(relay.socket, "sess-1", "term-2", second);
        expect(one).not.toBe(two);

        relay.push({ id: "s1", chunk: new Uint8Array([1]) });
        relay.push({ id: "s2", chunk: new Uint8Array([2]) });
        expect(first.chunks).toEqual([new Uint8Array([1])]);
        expect(second.chunks).toEqual([new Uint8Array([2])]);
    });

    /*
     * A handle stops addressing anything once its stream ends. Writing to a
     * number that has been reused or was never given out must not reach
     * somebody else's terminal.
     */
    it("stops answering for a handle once its stream ended", async () => {
        const relay = fakeSocket();
        const terminals = new RelayTerminals();
        const heard = listener();
        const handle = await terminals.attach(relay.socket, "sess-1", "term-1", heard);
        relay.end({ id: "s1", error: "disconnected" });
        expect(heard.ends).toEqual(["disconnected"]);
        await expect(terminals.write(handle, new Uint8Array([1]))).rejects.toThrow("已经不在了");
    });

    it("refuses a handle it never gave out", async () => {
        const terminals = new RelayTerminals();
        await expect(terminals.write(404, new Uint8Array([1]))).rejects.toThrow("已经不在了");
    });

    it("sends what the reader typed", async () => {
        const relay = fakeSocket();
        const terminals = new RelayTerminals();
        const handle = await terminals.attach(relay.socket, "sess-1", "term-1", listener());
        await terminals.write(handle, new Uint8Array([65]));
        expect(relay.sent[1]).toMatchObject({
            event: "stream-data",
            payload: { id: "s1", chunk: new Uint8Array([65]) },
        });
    });

    // A window that closed takes its attachments with it.
    it("lets go of every attachment at once", async () => {
        const relay = fakeSocket();
        const terminals = new RelayTerminals();
        const one = await terminals.attach(relay.socket, "sess-1", "term-1", listener());
        const two = await terminals.attach(relay.socket, "sess-1", "term-2", listener());
        terminals.closeAll();
        await expect(terminals.write(one, new Uint8Array([1]))).rejects.toThrow("已经不在了");
        await expect(terminals.write(two, new Uint8Array([1]))).rejects.toThrow("已经不在了");
        expect(relay.sent.filter((entry) => entry.event === "stream-close")).toHaveLength(2);
    });
});
