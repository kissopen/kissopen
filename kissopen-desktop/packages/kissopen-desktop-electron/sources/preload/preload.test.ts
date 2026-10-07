import { contextBridge, ipcRenderer } from "electron";
import { expect, it, vi } from "vitest";
import { desktopIpc, type KissopenDesktopBridge } from "../shared/desktopContract";

vi.mock("electron", async () => {
    const { EventEmitter } = await import("node:events");
    return {
        contextBridge: { exposeInMainWorld: vi.fn() },
        ipcRenderer: new EventEmitter(),
        webUtils: {},
    };
});

it("retained pages share one IPC listener with independent, idempotent cleanup", async () => {
    await import("./preload");
    const bridge = vi
        .mocked(contextBridge.exposeInMainWorld)
        .mock.calls.find(([name]) => name === "kissopenDesktop")?.[1] as KissopenDesktopBridge;
    const subscribe = bridge.browserAutomationSubscribe!;
    const listeners = Array.from({ length: 20 }, () => vi.fn());
    const unsubscribe = listeners.map((listener) => subscribe(listener));
    const event = { kind: "state" as const, tabId: "fixture", state: "active" as const };
    expect(ipcRenderer.listenerCount(desktopIpc.browserAutomationEvent)).toBe(1);
    ipcRenderer.emit(desktopIpc.browserAutomationEvent, { nativeEvent: true }, event);
    for (const listener of listeners) expect(listener).toHaveBeenCalledExactlyOnceWith(event);
    for (const close of unsubscribe) {
        close();
        close();
    }
    expect(ipcRenderer.listenerCount(desktopIpc.browserAutomationEvent)).toBe(0);
    const shared = vi.fn();
    const first = subscribe(shared),
        second = subscribe(shared);
    ipcRenderer.emit(desktopIpc.browserAutomationEvent, {}, event);
    expect(shared).toHaveBeenCalledTimes(2);
    first();
    ipcRenderer.emit(desktopIpc.browserAutomationEvent, {}, event);
    expect(shared).toHaveBeenCalledTimes(3);
    second();
    expect(ipcRenderer.listenerCount(desktopIpc.browserAutomationEvent)).toBe(0);
});
