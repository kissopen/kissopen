import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import { BrowserPlaywright } from "./browserPlaywright";

describe("Playwright guest cleanup", () => {
    it("never touches Electron's destroyed debugger getter when a tab closes", () => {
        const guest = Object.assign(new EventEmitter(), { isDestroyed: () => true });
        Object.defineProperty(guest, "debugger", {
            get() {
                throw new Error("Object has been destroyed");
            },
        });
        const engine = new BrowserPlaywright(guest as unknown as WebContents, () => false);
        expect(() => engine.close()).not.toThrow();
        expect(() => engine.close()).not.toThrow();
    });
    it("does not detach someone else's debugger when attachment is refused", async () => {
        const detach = vi.fn();
        const debuggerApi = Object.assign(new EventEmitter(), { isAttached: () => true, detach });
        const guest = Object.assign(new EventEmitter(), {
            isDestroyed: () => false,
            debugger: debuggerApi,
        });
        const engine = new BrowserPlaywright(guest as unknown as WebContents, () => true);
        await expect(engine.connect()).rejects.toThrow("already being inspected");
        engine.close();
        expect(detach).not.toHaveBeenCalled();
    });
    it("refuses work after takeover before reading or interacting with the page", async () => {
        const guest = Object.assign(new EventEmitter(), { isDestroyed: () => false });
        const engine = new BrowserPlaywright(guest as unknown as WebContents, () => false);
        await expect(engine.execute({ action: "read" })).rejects.toThrow("stopped");
        await expect(engine.execute({ action: "fill", ref: "r1", text: "value" })).rejects.toThrow(
            "stopped",
        );
    });
});
