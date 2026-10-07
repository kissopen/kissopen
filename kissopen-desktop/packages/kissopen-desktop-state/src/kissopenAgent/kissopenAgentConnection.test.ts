import { describe, expect, it } from "vitest";
import {
    kissopenAgentConnectionLoaderCreate,
    type KissopenAgentConnectionLoaderOptions,
    type KissopenAgentDaemonHealth,
} from "./kissopenAgentConnection.js";

/** Deterministic timer queue: nothing fires until the test advances it. */
function timerHarness() {
    interface Scheduled {
        readonly handler: () => void;
        readonly delay: number;
        cancelled: boolean;
    }
    const scheduled: Scheduled[] = [];
    return {
        setTimer: (handler: () => void, delay: number): unknown => {
            const entry: Scheduled = { handler, delay, cancelled: false };
            scheduled.push(entry);
            return entry;
        },
        clearTimer: (handle: unknown): void => {
            (handle as Scheduled).cancelled = true;
        },
        /** Fires the single pending, non-cancelled timer with the given delay. */
        fire(expectedDelay?: number): void {
            const entry = scheduled.find((candidate) => !candidate.cancelled);
            if (!entry) throw new Error("No timer is pending.");
            if (expectedDelay !== undefined) expect(entry.delay).toBe(expectedDelay);
            entry.cancelled = true;
            entry.handler();
        },
        get pending(): number {
            return scheduled.filter((candidate) => !candidate.cancelled).length;
        },
    };
}

/** A probe whose every call is resolved or rejected by the test in order. */
function probeQueue() {
    const calls: Array<{
        resolve: (health: KissopenAgentDaemonHealth) => void;
        reject: (error: unknown) => void;
    }> = [];
    const probe = (): Promise<KissopenAgentDaemonHealth> =>
        new Promise((resolve, reject) => {
            calls.push({ resolve, reject });
        });
    return {
        probe,
        get count(): number {
            return calls.length;
        },
        /** Settles the most recent probe call and lets its microtask run. */
        async settle(
            index: number,
            result: KissopenAgentDaemonHealth | { error: unknown },
        ): Promise<void> {
            const call = calls[index];
            if (!call) throw new Error(`No probe call at index ${index}.`);
            if ("error" in result) call.reject(result.error);
            else call.resolve(result);
            await Promise.resolve();
            await Promise.resolve();
        },
    };
}

function loader(overrides: Partial<KissopenAgentConnectionLoaderOptions> = {}) {
    const timers = timerHarness();
    const probe = probeQueue();
    const store = kissopenAgentConnectionLoaderCreate({
        probe: probe.probe,
        heartbeatMs: 2_000,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        ...overrides,
    });
    return { store, timers, probe };
}

const ready: KissopenAgentDaemonHealth = { status: "ready", version: "1.2.3" };

describe("kissopenAgentConnectionLoaderCreate", () => {
    it("does not probe or open timers before the first subscriber", () => {
        const { store, timers, probe } = loader();
        expect(store.get()).toEqual({ connection: "connecting", daemon: "unknown", attempt: 0 });
        expect(probe.count).toBe(0);
        expect(timers.pending).toBe(0);
    });

    it("connecting -> ready on the first successful probe", async () => {
        const { store, probe } = loader();
        store.subscribe(() => undefined);
        expect(probe.count).toBe(1);
        await probe.settle(0, ready);
        expect(store.get()).toEqual({
            connection: "connected",
            daemon: "ready",
            version: "1.2.3",
            attempt: 0,
        });
    });

    it("reports daemon starting then ready, polling on the heartbeat", async () => {
        const { store, timers, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, { status: "starting", version: "1.2.3" });
        expect(store.get()).toMatchObject({ connection: "connected", daemon: "starting" });
        timers.fire(2_000);
        expect(probe.count).toBe(2);
        await probe.settle(1, ready);
        expect(store.get()).toMatchObject({ connection: "connected", daemon: "ready" });
    });

    it("surfaces a daemon error with its message while staying connected", async () => {
        const { store, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, { status: "error", version: "1.2.3", message: "no provider" });
        expect(store.get()).toEqual({
            connection: "connected",
            daemon: "error",
            version: "1.2.3",
            message: "no provider",
            attempt: 0,
        });
    });

    it("keeps a live connection through a missed heartbeat, then reconnects", async () => {
        const { store, timers, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, ready);
        // One refused heartbeat is a moment, not a state: the confirmed
        // connection stays on screen while the next attempt finds out.
        timers.fire(2_000);
        await probe.settle(1, { error: new Error("ECONNREFUSED") });
        expect(store.get()).toMatchObject({ connection: "connected", attempt: 0 });
        // First backoff is 250ms (2^0). It reconnects on success, having said
        // nothing about a drop that never happened.
        timers.fire(250);
        await probe.settle(2, ready);
        expect(store.get()).toMatchObject({ connection: "connected", attempt: 0 });
    });

    it("reports a live connection lost once the silence outlasts the tolerance", async () => {
        const { store, timers, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, ready);
        timers.fire(2_000);
        await probe.settle(1, { error: new Error("ECONNREFUSED") });
        timers.fire(250);
        await probe.settle(2, { error: new Error("ECONNREFUSED") });
        expect(store.get()).toMatchObject({ connection: "connected" });
        timers.fire(500);
        await probe.settle(3, { error: new Error("ECONNREFUSED") });
        expect(store.get()).toEqual({
            connection: "disconnected",
            daemon: "unknown",
            message: "ECONNREFUSED",
            attempt: 3,
        });
    });

    it("grows and caps the backoff across consecutive failures", async () => {
        const { store, timers, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, { error: new Error("down") });
        expect(store.get().attempt).toBe(1);
        timers.fire(250);
        await probe.settle(1, { error: new Error("down") });
        expect(store.get().attempt).toBe(2);
        timers.fire(500);
        await probe.settle(2, { error: new Error("down") });
        expect(store.get().attempt).toBe(3);
        timers.fire(1_000);
    });

    it("retry() collapses backoff and probes immediately, resetting attempt", async () => {
        const { store, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, { error: new Error("down") });
        expect(store.get()).toMatchObject({ connection: "disconnected", attempt: 1 });
        const pendingBefore = probe.count;
        store.retry();
        expect(store.get()).toEqual({ connection: "connecting", daemon: "unknown", attempt: 0 });
        expect(probe.count).toBe(pendingBefore + 1);
        await probe.settle(probe.count - 1, ready);
        expect(store.get()).toMatchObject({ connection: "connected", attempt: 0 });
    });

    it("ignores a stale probe resolution scheduled by a superseded backoff", async () => {
        const { store, probe } = loader();
        store.subscribe(() => undefined);
        await probe.settle(0, { error: new Error("down") });
        // retry() supersedes the in-flight nothing and starts a fresh probe.
        store.retry();
        // Resolve the retry probe.
        await probe.settle(probe.count - 1, ready);
        expect(store.get()).toMatchObject({ connection: "connected" });
    });

    it("stops probing when the last subscriber leaves and resumes on resubscribe", async () => {
        const { store, timers, probe } = loader();
        const unsubscribe = store.subscribe(() => undefined);
        await probe.settle(0, ready);
        expect(timers.pending).toBe(1);
        unsubscribe();
        expect(timers.pending).toBe(0);
        store.subscribe(() => undefined);
        expect(probe.count).toBe(2);
    });

    it("ignores a probe that resolves after the last subscriber left", async () => {
        const { store, probe } = loader();
        const unsubscribe = store.subscribe(() => undefined);
        unsubscribe();
        await probe.settle(0, ready);
        expect(store.get()).toEqual({ connection: "connecting", daemon: "unknown", attempt: 0 });
    });

    it("dispose stops timers and ignores later probe resolutions", async () => {
        const { store, timers, probe } = loader();
        store.subscribe(() => undefined);
        store[Symbol.dispose]();
        expect(timers.pending).toBe(0);
        await probe.settle(0, ready);
        expect(store.get().connection).not.toBe("connected");
        store.retry();
        expect(probe.count).toBe(1);
    });
});
