import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
    BrowserCommand,
    BrowserControlRequest,
    BrowserControlResponse,
} from "@kissopen/kissopen-agent-client";
import { KissopenAgentApiError } from "@kissopen/kissopen-agent-client";
import type { DesktopBrowserAutomationEvent } from "../shared/browserAutomation";
import { DesktopBrowserAutomation } from "./browserAutomation";

vi.mock("./browserPlaywright", () => ({
    BrowserPlaywright: class {
        async connect() {}
        async execute() {
            return { ok: true, text: "Observed" };
        }
        close() {}
    },
}));
const scope = { kind: "relay" as const, sessionId: "session", workspaceId: "workspace" };
const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};
function fixture() {
    let account = "alice";
    const owner = Object.assign(new EventEmitter(), {
        id: 1,
        isDestroyed: () => false,
    }) as unknown as WebContents;
    const guest = Object.assign(new EventEmitter(), {
        id: 2,
        hostWebContents: owner,
        isDestroyed: () => false,
        stop: vi.fn(),
    }) as unknown as WebContents;
    const events: DesktopBrowserAutomationEvent[] = [];
    const requests: BrowserControlRequest[] = [];
    let tabId = "";
    const commands: BrowserCommand[] = [];
    const request = vi.fn(
        async (_scope: unknown, value: BrowserControlRequest): Promise<BrowserControlResponse> => {
            requests.push(value);
            if (value.action === "attach") tabId = value.tabId;
            const command = value.action === "poll" ? commands.shift() : undefined;
            return { ok: true, paused: value.action === "pause", ...(command ? { command } : {}) };
        },
    );
    const navigate = vi.fn(async () => {});
    const automation = new DesktopBrowserAutomation({
        account: () => account,
        request,
        publish: (_owner, event) => events.push(event),
        navigate,
    });
    const command = (operation: BrowserCommand["operation"]) =>
        commands.push({
            id: "command".padEnd(32, "0"),
            tabId,
            expiresAt: Date.now() + 25000,
            operation,
        });
    return {
        automation,
        owner,
        guest,
        events,
        requests,
        request,
        navigate,
        command,
        tab: () => tabId,
        account: (value: string) => {
            account = value;
        },
    };
}
afterEach(() => vi.useRealTimers());

describe("visible browser native ownership", () => {
    it("does not revoke a running page when an already active lease is resumed", async () => {
        const f = fixture();
        await f.automation.start(f.owner, "binding", scope);
        const previousEvents = f.events.length;
        await f.automation.action(f.owner, f.tab(), "resume");
        expect(f.events).toHaveLength(previousEvents);
        expect(f.requests.filter((value) => value.action === "resume")).toHaveLength(0);
        expect(f.automation.scope(f.owner, f.tab())).toEqual(scope);
        f.automation.closeAll();
    });
    it("negotiates legacy attachments once without retrying page actions", async () => {
        const f = fixture();
        f.request.mockImplementationOnce(async () => {
            throw new KissopenAgentApiError(400, "Unsupported field", "invalid_request", null);
        });
        await f.automation.start(f.owner, "binding", scope);
        expect(f.request.mock.calls[0]![1]).toMatchObject({
            action: "attach",
            capabilities: ["batch", "wait"],
        });
        const retry = f.request.mock.calls[1]![1];
        expect(retry.action).toBe("attach");
        expect(retry).not.toHaveProperty("capabilities");
        expect(retry.leaseId).toBe(f.request.mock.calls[0]![1].leaseId);
        expect(f.request.mock.calls.filter((call) => call[1].action === "attach")).toHaveLength(2);
        f.automation.closeAll();
    });
    it("reconnects the task's same page with a fresh lease and no replayed navigation", async () => {
        vi.useFakeTimers();
        const f = fixture();
        await f.automation.start(f.owner, "first", scope);
        const firstTab = f.tab();
        f.command({ action: "navigate", url: "https://example.com" });
        await vi.advanceTimersByTimeAsync(800);
        f.automation.bind(f.owner, firstTab, f.guest);
        await settle();
        f.automation.stop(f.owner, "first");
        await f.automation.start(f.owner, "second", scope);
        expect(f.tab()).toBe(firstTab);
        expect(f.events.at(-1)).toMatchObject({ kind: "open", tabId: firstTab });
        f.automation.bind(f.owner, firstTab, f.guest);
        f.command({ action: "read" });
        await vi.advanceTimersByTimeAsync(800);
        expect(f.navigate).toHaveBeenCalledTimes(1);
        const leases = f.requests.filter((request) => request.action === "attach");
        expect(leases[0]!.leaseId).not.toBe(leases[1]!.leaseId);
        expect(f.requests.at(-1)).toMatchObject({
            action: "complete",
            result: { ok: true, text: "Observed" },
        });
        f.automation.closeAll();
    });

    it("keeps tasks isolated and closing an inactive page does not revoke the current task", async () => {
        vi.useFakeTimers();
        const f = fixture();
        await f.automation.start(f.owner, "first", scope);
        const firstTab = f.tab();
        f.command({ action: "navigate", url: "https://example.com" });
        await vi.advanceTimersByTimeAsync(800);
        f.automation.bind(f.owner, firstTab, f.guest);
        await settle();
        await f.automation.start(f.owner, "other", { ...scope, sessionId: "other" });
        const otherTab = f.tab();
        expect(otherTab).not.toBe(firstTab);
        expect(() => f.automation.scope(f.owner, firstTab)).toThrow();
        const revocations = f.requests.filter((request) => request.action === "revoke").length;
        await f.automation.action(f.owner, firstTab, "close");
        expect(f.automation.scope(f.owner, otherTab).kind).toBe("relay");
        expect(f.requests.filter((request) => request.action === "revoke")).toHaveLength(
            revocations,
        );
        await f.automation.start(f.owner, "again", scope);
        expect(f.tab()).not.toBe(firstTab);
        f.automation.closeAll();
    });

    it("does not reuse retained task pages across account changes", async () => {
        const f = fixture();
        await f.automation.start(f.owner, "alice", scope);
        const alice = f.tab();
        f.account("bob");
        f.automation.closeAll();
        await f.automation.start(f.owner, "bob", scope);
        expect(f.tab()).not.toBe(alice);
        expect(() => f.automation.scope(f.owner, alice)).toThrow();
        f.automation.closeAll();
    });
    it("opens, binds and navigates only the requested guest", async () => {
        vi.useFakeTimers();
        const f = fixture();
        await f.automation.start(f.owner, "binding", scope);
        f.command({ action: "navigate", url: "https://example.com" });
        await vi.advanceTimersByTimeAsync(800);
        expect(f.events).toContainEqual(expect.objectContaining({ kind: "open", tabId: f.tab() }));
        const foreign = Object.assign(new EventEmitter(), {
            hostWebContents: {},
        }) as unknown as WebContents;
        expect(() => f.automation.bind(f.owner, f.tab(), foreign)).toThrow("another window");
        expect(() => f.automation.bind(f.owner, "wrong", f.guest)).toThrow();
        f.automation.bind(f.owner, f.tab(), f.guest);
        await settle();
        expect(f.navigate).toHaveBeenCalledExactlyOnceWith(f.guest, scope, "https://example.com/");
        expect(f.requests).toContainEqual(
            expect.objectContaining({
                action: "complete",
                result: expect.objectContaining({ ok: true }),
            }),
        );
        f.automation.closeAll();
    });
    it("account changes reject commands before opening a page", async () => {
        vi.useFakeTimers();
        const f = fixture();
        await f.automation.start(f.owner, "binding", scope);
        f.command({ action: "navigate", url: "https://example.com" });
        f.account("bob");
        await vi.advanceTimersByTimeAsync(800);
        expect(f.events.some((event) => event.kind === "open")).toBe(false);
        expect(f.navigate).not.toHaveBeenCalled();
        expect(() => f.automation.scope(f.owner, f.tab())).toThrow();
    });
    it("replacing a conversation revokes the old lease without stale unmount closing the new one", async () => {
        const f = fixture();
        await f.automation.start(f.owner, "first", scope);
        const before = f.tab();
        await f.automation.start(f.owner, "second", { ...scope, sessionId: "other" });
        f.automation.stop(f.owner, "first");
        expect(() => f.automation.scope(f.owner, before)).toThrow();
        expect(f.automation.scope(f.owner, f.tab()).kind).toBe("relay");
        expect(f.requests.filter((value) => value.action === "revoke")).toHaveLength(1);
        f.owner.emit("destroyed");
        expect(() => f.automation.scope(f.owner, f.tab())).toThrow();
    });
    it("keeps pause/resume ordered and does not let an old resume override takeover", async () => {
        const f = fixture();
        await f.automation.start(f.owner, "binding", scope);
        const pause = f.automation.action(f.owner, f.tab(), "pause");
        const resume = f.automation.action(f.owner, f.tab(), "resume");
        const takeover = f.automation.action(f.owner, f.tab(), "pause");
        await Promise.all([pause, resume, takeover]);
        expect(
            f.requests
                .filter((value) => value.action === "pause" || value.action === "resume")
                .map((value) => value.action),
        ).toEqual(["pause", "resume", "pause"]);
        expect(f.events.at(-1)).toMatchObject({ kind: "state", state: "paused" });
        f.automation.closeAll();
    });
    it("tab destruction and takeover cancel control without replay", async () => {
        vi.useFakeTimers();
        const f = fixture();
        await f.automation.start(f.owner, "binding", scope);
        f.command({ action: "navigate", url: "https://example.com" });
        await vi.advanceTimersByTimeAsync(800);
        f.automation.bind(f.owner, f.tab(), f.guest);
        await settle();
        f.guest.emit("before-input-event");
        await settle();
        expect(f.events.at(-1)).toMatchObject({ state: "active" });
        await f.automation.action(f.owner, f.tab(), "pause");
        expect(f.events.at(-1)).toMatchObject({ state: "paused" });
        f.guest.emit("destroyed");
        expect(f.events.at(-1)).toMatchObject({ state: "closed" });
        expect(() => f.automation.scope(f.owner, f.tab())).toThrow();
    });
});
