import { t } from "kissopen-desktop-state";
import type {
    AppKissopenAgentProfilerSnapshot,
    AppKissopenAgentProfilerStore,
} from "kissopen-desktop-app";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type { DesktopProfilerSnapshot } from "../shared/desktopProfiler";

const initialSnapshot: AppKissopenAgentProfilerSnapshot = {
    capabilities: {
        liveDebuggerAttach: false,
        nativeTrace: false,
        processMetrics: false,
        reactAttribution: false,
        reactDevtoolsProfiling: false,
        rendererMetrics: false,
    },
    status: "unavailable",
};

export function desktopProfilerStoreCreate(
    bridge: KissopenDesktopBridge,
): AppKissopenAgentProfilerStore {
    let snapshot = initialSnapshot;
    const listeners = new Set<() => void>();
    let closeBridge: (() => void) | undefined;
    let generation = 0;

    const publish = (): void => {
        for (const listener of listeners) listener();
    };
    const apply = (value: DesktopProfilerSnapshot): void => {
        snapshot = {
            ...(value.artifact ? { artifactPath: value.artifact.path } : {}),
            capabilities: value.capabilities,
            ...(value.error ? { error: value.error } : {}),
            ...(value.partialReason ? { partialReason: value.partialReason } : {}),
            status: value.status,
        };
        publish();
    };
    const failure = (error: unknown): void => {
        snapshot = {
            ...snapshot,
            error: error instanceof Error ? error.message : t("The profiler action failed."),
            status: "error",
        };
        publish();
    };
    const sourceOpen = (): void => {
        const current = ++generation;
        let eventReceived = false;
        closeBridge = bridge.profilerSubscribe((value) => {
            if (current !== generation) return;
            eventReceived = true;
            apply(value);
        });
        void bridge.profilerGet().then(
            (value) => {
                if (current === generation && !eventReceived) apply(value);
            },
            (error: unknown) => {
                if (current === generation) failure(error);
            },
        );
    };
    const action = (
        status: "starting" | "stopping",
        run: () => Promise<DesktopProfilerSnapshot>,
    ) => {
        if (snapshot.status === "starting" || snapshot.status === "stopping") return;
        snapshot = { ...snapshot, error: undefined, status };
        publish();
        void run().then(apply, failure);
    };

    return {
        get: () => snapshot,
        profilerStart: () => action("starting", () => bridge.profilerStart()),
        profilerStop: () => action("stopping", () => bridge.profilerStop()),
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) sourceOpen();
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    generation += 1;
                    closeBridge?.();
                    closeBridge = undefined;
                }
            };
        },
    };
}
