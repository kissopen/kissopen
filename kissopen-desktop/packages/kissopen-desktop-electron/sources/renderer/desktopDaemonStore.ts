import type {
    AppKissopenAgentDaemonSnapshot,
    AppKissopenAgentDaemonStore,
} from "kissopen-desktop-app";
import type { DesktopDaemonSnapshot, KissopenDesktopBridge } from "../shared/desktopContract";

const initial: AppKissopenAgentDaemonSnapshot = {
    install: { phase: "idle" },
    managed: true,
    operation: "checking",
    runtime: "stopped",
    updateAvailable: false,
    versions: [],
};

/** Adapts the narrow native daemon bridge into the settings surface store. */
export function desktopDaemonStoreCreate(
    bridge: KissopenDesktopBridge,
): AppKissopenAgentDaemonStore {
    const listeners = new Set<() => void>();
    let snapshot = initial;
    let unsubscribe: (() => void) | undefined;
    let eventReceived = false;
    let revision = 0;

    const publish = (next: AppKissopenAgentDaemonSnapshot): void => {
        revision += 1;
        snapshot = next;
        for (const listener of listeners) listener();
    };
    const set = (next: DesktopDaemonSnapshot): void => publish(daemonProject(next));

    const fail = (error: unknown): void =>
        publish({ ...snapshot, error: displayError(error), operation: "idle" });
    const busy = (): boolean =>
        snapshot.operation === "upgrading" || snapshot.operation === "downloading";

    return {
        daemonCheck() {
            if (busy() || snapshot.operation === "checking") return;
            publish({ ...snapshot, error: undefined, operation: "checking" });
            // A disabled check can complete without emitting a native event.
            // Read its final state, preserving events received during the read.
            void bridge
                .daemonCheck()
                .then(async () => {
                    const readRevision = revision;
                    const next = await bridge.daemonGet();
                    if (revision === readRevision) set(next);
                })
                .catch(fail);
        },
        daemonInstall() {
            if (busy() || snapshot.install.phase !== "idle" || !snapshot.readyVersion) return;
            publish({
                ...snapshot,
                error: undefined,
                install: {
                    killable: false,
                    phase: "draining",
                    reason: "install",
                    version: snapshot.readyVersion,
                    waitingFor: [],
                    waitingPeak: 0,
                },
            });
            void bridge.daemonInstall().catch(fail);
        },
        daemonInstallDismiss() {
            if (snapshot.install.phase === "idle") return;
            const { error: _error, ...current } = snapshot;
            publish({ ...current, install: { phase: "idle" } });
            void bridge.daemonInstallDismiss().catch(fail);
        },
        daemonInstallKill() {
            if (snapshot.install.phase !== "draining") return;
            void bridge.daemonInstallKill().catch(fail);
        },
        daemonRestart() {
            if (busy() || snapshot.install.phase !== "idle" || !snapshot.installedVersion) return;
            publish({
                ...snapshot,
                error: undefined,
                install: {
                    killable: false,
                    phase: "draining",
                    reason: "restart",
                    version: snapshot.installedVersion,
                    waitingFor: [],
                    waitingPeak: 0,
                },
            });
            void bridge.daemonRestart().catch(fail);
        },
        daemonUpgrade() {
            if (busy()) return;
            publish({ ...snapshot, error: undefined, operation: "upgrading" });
            void bridge.daemonUpgrade().catch(fail);
        },
        daemonVersionSelect(version) {
            if (busy() || version === snapshot.installedVersion) return;
            publish({ ...snapshot, error: undefined, operation: "upgrading" });
            void bridge.daemonVersionSelect(version).catch(fail);
        },
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) {
                eventReceived = false;
                unsubscribe = bridge.daemonSubscribe((next) => {
                    eventReceived = true;
                    set(next);
                });
                void bridge.daemonGet().then(
                    (next) => {
                        if (!eventReceived) set(next);
                    },
                    (error: unknown) =>
                        publish({
                            ...snapshot,
                            error: displayError(error),
                            operation: "idle",
                        }),
                );
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size > 0) return;
                unsubscribe?.();
                unsubscribe = undefined;
            };
        },
    };
}

function daemonProject(snapshot: DesktopDaemonSnapshot): AppKissopenAgentDaemonSnapshot {
    return {
        ...(snapshot.availableVersion ? { availableVersion: snapshot.availableVersion } : {}),
        ...(snapshot.error ? { error: snapshot.error } : {}),
        ...(snapshot.installedVersion ? { installedVersion: snapshot.installedVersion } : {}),
        ...(snapshot.message ? { message: snapshot.message } : {}),
        managed: snapshot.managed,
        ...(snapshot.readyVersion ? { readyVersion: snapshot.readyVersion } : {}),
        install: snapshot.install,
        // The settings surface has no first install to describe — it exists only
        // once there is a working agent to open settings against — so the one
        // operation it cannot be looking at is reported as what it is from that
        // surface's point of view: bytes arriving.
        operation: snapshot.operation === "installing" ? "downloading" : snapshot.operation,
        runtime: snapshot.runtime,
        updateAvailable: snapshot.updateAvailable,
        versions: snapshot.versions,
    };
}

function displayError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
