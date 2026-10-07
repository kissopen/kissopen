import type { LocalWebBuild } from "./localWebBuild";

const updatePollIntervalMs = 15_000;

export type LocalWebUpdateSnapshot =
    | { readonly status: "current" }
    | {
          readonly buildId: string;
          readonly status: "available";
          readonly version: string;
      };

export interface LocalWebUpdateStore {
    get(): LocalWebUpdateSnapshot;
    subscribe(listener: () => void): () => void;
}

function manifestRead(value: unknown): LocalWebBuild | undefined {
    if (!value || typeof value !== "object") return undefined;
    const candidate = value as Partial<LocalWebBuild>;
    if (typeof candidate.buildId !== "string" || typeof candidate.version !== "string")
        return undefined;
    if (!candidate.buildId || !candidate.version) return undefined;
    return { buildId: candidate.buildId, version: candidate.version };
}

/**
 * Polls the tiny same-origin Pages manifest only while the renderer is visible.
 * A changed build is terminal for this page lifetime: subscribers retain the
 * available snapshot until the desktop host restarts into the new deployment.
 */
export function localWebUpdateStoreCreate(build?: LocalWebBuild): LocalWebUpdateStore {
    let snapshot: LocalWebUpdateSnapshot = { status: "current" };
    let interval: number | undefined;
    let request: AbortController | undefined;
    const listeners = new Set<() => void>();

    const publish = (next: LocalWebUpdateSnapshot) => {
        snapshot = next;
        for (const listener of listeners) listener();
    };
    const pollingStop = () => {
        if (interval !== undefined) window.clearInterval(interval);
        interval = undefined;
        request?.abort();
        request = undefined;
    };
    const check = async () => {
        if (!build || request || snapshot.status === "available") return;
        const controller = new AbortController();
        request = controller;
        try {
            const url = new URL("/local-web-version.json", window.location.href);
            url.searchParams.set("build", build.buildId);
            url.searchParams.set("at", String(Date.now()));
            const response = await fetch(url, {
                cache: "no-store",
                headers: { accept: "application/json" },
                signal: controller.signal,
            });
            if (!response.ok) return;
            const latest = manifestRead(await response.json());
            if (!latest || latest.buildId === build.buildId) return;
            publish({ ...latest, status: "available" });
            pollingStop();
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            // The manifest is only a delivery hint. Offline and transient Pages
            // failures leave the current UI intact; the next visible poll retries.
        } finally {
            if (request === controller) request = undefined;
        }
    };
    const pollingStart = () => {
        if (
            !build ||
            interval !== undefined ||
            snapshot.status === "available" ||
            document.visibilityState !== "visible"
        )
            return;
        void check();
        interval = window.setInterval(() => void check(), updatePollIntervalMs);
    };
    const visibilityChanged = () => {
        if (document.visibilityState === "visible") pollingStart();
        else pollingStop();
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1 && build) {
                document.addEventListener("visibilitychange", visibilityChanged);
                pollingStart();
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0 && build) {
                    document.removeEventListener("visibilitychange", visibilityChanged);
                    pollingStop();
                }
            };
        },
    };
}
