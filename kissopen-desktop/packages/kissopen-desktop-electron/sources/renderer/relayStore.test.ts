import { describe, it, expect, vi } from "vitest";
import { relayStoreCreate, relayMachineName, relaySessionName } from "./relayStore";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type { RelayState, RelayMachineView, RelaySessionView } from "../shared/relayContract";

function bridgeWith(initial: RelayState, options: { slow?: boolean } = {}) {
    let push: ((state: RelayState) => void) | undefined;
    let settle: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => (settle = resolve));
    const bridge = {
        relayGet: async () => {
            if (options.slow) await pending;
            return initial;
        },
        relaySubscribe: (listener: (state: RelayState) => void) => {
            push = listener;
            return () => (push = undefined);
        },
    } as unknown as KissopenDesktopBridge;
    return { bridge, emit: (state: RelayState) => push?.(state), settle: () => settle?.() };
}

const snapshot = (sessions: number): RelayState => ({
    machines: [],
    projects: [],
    sessions: Array.from({ length: sessions }, (_, i) => ({
        id: `s${i}`,
        seq: 1,
        active: true,
        updatedAt: i,
        machineId: undefined,
        projectId: undefined,
        metadata: null,
    })),
});

describe("the relay store", () => {
    it("starts with nothing and takes what the window asks for", async () => {
        const { bridge } = bridgeWith(snapshot(2));
        const store = relayStoreCreate(bridge);
        expect(store.getSnapshot()).toBeNull();
        await vi.waitFor(() => expect(store.getSnapshot()?.sessions).toHaveLength(2));
    });

    it("tells its listeners when the relay moves", async () => {
        const { bridge, emit } = bridgeWith(null);
        const store = relayStoreCreate(bridge);
        const listener = vi.fn();
        store.subscribe(listener);
        emit(snapshot(1));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()?.sessions).toHaveLength(1);
    });

    /*
     * The ask and the push race on every window open. A late answer to the ask
     * must not overwrite an update that has already arrived — that would show
     * the reader a list that goes backwards.
     */
    it("does not let a late answer undo an update that already arrived", async () => {
        const { bridge, emit, settle } = bridgeWith(snapshot(5), { slow: true });
        const store = relayStoreCreate(bridge);
        emit(snapshot(1));
        settle();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(store.getSnapshot()?.sessions).toHaveLength(1);
    });

    it("stops listening when disposed", () => {
        const { bridge, emit } = bridgeWith(null);
        const store = relayStoreCreate(bridge);
        const listener = vi.fn();
        store.subscribe(listener);
        store.dispose();
        emit(snapshot(1));
        expect(listener).not.toHaveBeenCalled();
    });
});

describe("naming what the relay carries", () => {
    const machine = (metadata: unknown): RelayMachineView =>
        ({ id: "m1", active: true, activeAt: 0, metadata }) as RelayMachineView;

    it("prefers the name a person chose for a machine", () => {
        expect(relayMachineName(machine({ displayName: "书房", host: "mac-studio" }))).toBe("书房");
        expect(relayMachineName(machine({ host: "mac-studio" }))).toBe("mac-studio");
    });

    // A blank row is worse than an id: the id is at least a thing that exists.
    it("falls back to the id when the metadata will not open", () => {
        expect(relayMachineName(machine(null))).toBe("m1");
    });

    const session = (metadata: unknown): RelaySessionView =>
        ({
            id: "s1",
            seq: 1,
            active: true,
            updatedAt: 0,
            machineId: undefined,
            metadata,
        }) as RelaySessionView;

    it("names a conversation by the title the agent wrote, else its working directory", () => {
        expect(
            relaySessionName(
                session({ path: "/Users/x/proj", summary: { text: "修好登录页", updatedAt: 1 } }),
            ),
        ).toBe("修好登录页");
        expect(
            relaySessionName(
                session({ path: "/Users/x/proj", summary: { text: " ", updatedAt: 1 } }),
            ),
        ).toBe("proj");
        expect(relaySessionName(session({ path: "/Users/x/proj" }))).toBe("proj");
        expect(relaySessionName(session({ path: "C:\\work\\thing" }))).toBe("thing");
        expect(relaySessionName(session({ path: "/" }))).toBe("/");
    });

    // Its place in the list is kept; only the name is missing.
    it("has no name for a conversation it cannot open", () => {
        expect(relaySessionName(session(null))).toBeNull();
    });
});
