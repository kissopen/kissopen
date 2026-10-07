import * as inspector from "node:inspector";

/**
 * Starts the Electron main-process inspector on loopback and returns the
 * debugger's WebSocket URL. Node keeps one inspector per process, so repeated
 * requests are idempotent and return the existing endpoint.
 */
export function desktopMainInspectorStart(): string {
    const existing = inspector.url();
    if (existing) return existing;
    inspector.open(0, "127.0.0.1", false);
    const started = inspector.url();
    if (!started) throw new Error("The Electron main-process inspector did not start.");
    return started;
}

/** Stops the main-process inspector without affecting the Electron process. */
export function desktopMainInspectorStop(): void {
    if (inspector.url()) inspector.close();
}
