import type { WebContents } from "electron";
import { desktopCdpSharedAcquire } from "./desktopCdpShared";

export interface DesktopProfilerCdp {
    sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
}

export async function desktopProfilerCdpStart(
    webContents: WebContents,
    onMessage: (method: string, params: Record<string, unknown>) => void,
    onDetached: (reason: string) => void,
): Promise<DesktopProfilerCdp> {
    const lease = await desktopCdpSharedAcquire(webContents, "profiler");
    let closed = false;
    const removeMessage = lease.onMessage((method, params) => {
        if (!closed) onMessage(method, params);
    });
    const removeDetached = lease.onDetached((reason) => {
        if (closed) return;
        closed = true;
        removeMessage();
        removeDetached();
        onDetached(reason);
    });

    return {
        sendCommand: (method, params) => {
            if (closed)
                return Promise.reject(new Error("The renderer profiler debugger is detached."));
            return lease.sendCommand(method, params);
        },
        async close() {
            if (closed) return;
            closed = true;
            removeMessage();
            removeDetached();
            await lease.release();
        },
    };
}
