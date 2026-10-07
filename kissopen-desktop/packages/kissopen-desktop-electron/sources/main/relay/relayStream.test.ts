/*
The client end of a relay byte stream.

A terminal rides this, so the failures worth holding are the quiet ones: a
chunk that was never taken but reported as sent, a stream that keeps writing
after the far end has gone, chunks from somebody else's stream delivered into
this one.
*/
import { describe, it, expect, vi } from "vitest";
import { relayStreamOpen } from "./relayStream";
import type { RelaySocket } from "./relayTransport";
import { localeSet } from "kissopen-desktop-state/i18n";

// These messages are written in Chinese and asserted as written.
localeSet("zh");

/** A relay this test drives: it records requests and can push events. */
function fakeSocket(answers: Record<string, unknown> = {}) {
    const requests: { event: string; payload: unknown }[] = [];
    const data = new Set<(incoming: { id: string; chunk: Uint8Array }) => void>();
    const closed = new Set<(incoming: { id: string; error?: string }) => void>();
    const socket = {
        request: async (event: string, payload: unknown) => {
            requests.push({ event, payload });
            return answers[event] ?? { ok: true };
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
        requests,
        push: (incoming: { id: string; chunk: Uint8Array }) => {
            for (const listener of [...data]) listener(incoming);
        },
        end: (incoming: { id: string; error?: string }) => {
            for (const listener of [...closed]) listener(incoming);
        },
        listeners: () => data.size + closed.size,
    };
}

const listener = () => ({
    chunks: [] as Uint8Array[],
    ends: [] as (string | undefined)[],
    data(chunk: Uint8Array) {
        this.chunks.push(chunk);
    },
    closed(error?: string) {
        this.ends.push(error);
    },
});

describe("a stream to a machine", () => {
    it("opens against the method the machine registered", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const heard = listener();
        await relayStreamOpen(relay.socket, "m1:terminalAttach", { terminalId: "t1" }, heard);
        expect(relay.requests[0]).toEqual({
            event: "stream-open",
            payload: { method: "m1:terminalAttach", params: { terminalId: "t1" } },
        });
    });

    /*
     * A refused stream is not a stream with no bytes in it. The caller has to
     * be able to tell those apart, so this throws rather than handing back
     * something that will never carry anything.
     */
    it("throws when the machine will not take it", async () => {
        const relay = fakeSocket({ "stream-open": { ok: false, error: "没有这个终端" } });
        await expect(
            relayStreamOpen(relay.socket, "m1:terminalAttach", {}, listener()),
        ).rejects.toThrow("没有这个终端");
    });

    it("delivers only its own chunks", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const heard = listener();
        await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, heard);
        relay.push({ id: "s1", chunk: new Uint8Array([1, 2]) });
        relay.push({ id: "another", chunk: new Uint8Array([9]) });
        expect(heard.chunks).toEqual([new Uint8Array([1, 2])]);
    });

    /*
     * The wait on each chunk is the backpressure: the writer learns the far
     * end's pace by being made to wait for it.
     */
    it("waits for the machine to take each chunk", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const stream = await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, listener());
        await stream.write(new Uint8Array([7]));
        expect(relay.requests[1]).toMatchObject({
            event: "stream-data",
            payload: { id: "s1", chunk: new Uint8Array([7]) },
        });
    });

    /*
     * A chunk the far end did not take ends the stream. The ones behind it
     * would arrive out of order, and out of order is a corrupted screen
     * rather than a late one.
     */
    it("ends the stream when a chunk is refused", async () => {
        const relay = fakeSocket({
            "stream-open": { ok: true, id: "s1" },
            "stream-data": { ok: false, error: "对端走了" },
        });
        const heard = listener();
        const stream = await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, heard);
        await expect(stream.write(new Uint8Array([1]))).rejects.toThrow("对端走了");
        expect(stream.closed).toBe(true);
        expect(heard.ends).toEqual(["对端走了"]);
        await expect(stream.write(new Uint8Array([2]))).rejects.toThrow("已经关了");
    });

    it("reports the far end closing, once", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const heard = listener();
        const stream = await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, heard);
        relay.end({ id: "s1", error: "disconnected" });
        relay.end({ id: "s1" });
        expect(heard.ends).toEqual(["disconnected"]);
        expect(stream.closed).toBe(true);
    });

    // Closing tells the relay and stops listening; a second close is quiet.
    it("closes once and lets go of its listeners", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const heard = listener();
        const stream = await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, heard);
        expect(relay.listeners()).toBe(2);
        stream.close();
        stream.close();
        expect(heard.ends).toHaveLength(1);
        expect(relay.listeners()).toBe(0);
        expect(relay.requests.some((request) => request.event === "stream-close")).toBe(true);
    });

    // Chunks that arrive after the close belong to nobody.
    it("ignores what arrives after it closed", async () => {
        const relay = fakeSocket({ "stream-open": { ok: true, id: "s1" } });
        const heard = listener();
        const stream = await relayStreamOpen(relay.socket, "m1:terminalAttach", {}, heard);
        stream.close();
        relay.push({ id: "s1", chunk: new Uint8Array([5]) });
        expect(heard.chunks).toEqual([]);
    });
});
