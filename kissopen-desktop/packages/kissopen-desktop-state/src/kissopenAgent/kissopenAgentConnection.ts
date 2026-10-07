import { t } from "../i18n/locale.js";
import type { KissopenAgentDebugLogInput } from "./kissopenAgentDebugLogStore.js";

/**
 * Minimal Kissopen Agent daemon health as observed over the injected HTTP probe. This is
 * deliberately a small subset of Kissopen Agent's protocol health: connection tracking only
 * needs the liveness status and version, never the model catalog or sessions.
 */
export type KissopenAgentDaemonHealth =
    | { readonly status: "starting"; readonly version: string }
    | { readonly status: "ready"; readonly version: string }
    | { readonly status: "error"; readonly version: string; readonly message: string };

/** Immutable connection surface: whether the transport reaches the daemon and how healthy it is. */
export interface KissopenAgentConnectionSnapshot {
    /** Transport reachability, independent of daemon health. */
    readonly connection: "connecting" | "connected" | "disconnected";
    /** Daemon liveness reported by the last successful probe. */
    readonly daemon: "unknown" | "starting" | "ready" | "error";
    /** Daemon version from the last successful probe, when known. */
    readonly version?: string;
    /** Human-readable error detail for a daemon error or a probe failure. */
    readonly message?: string;
    /** Consecutive failed reconnect attempts; zero while connected. */
    readonly attempt: number;
}

/**
 * Product-facing availability for one already-known KISSOPEN Agent.
 *
 * Connection and daemon health remain the transport facts above. This projection
 * adds the one lifetime fact a surface needs to interpret them: whether this KISSOPEN Agent
 * has materialized confirmed state before. That is what distinguishes an initial
 * connection from a reconnect without making `session` presence double as a
 * connectivity flag.
 */
export type KissopenAgentAvailabilityState =
    | "connecting"
    | "online"
    | "reconnecting"
    | "offline"
    | "error";

export interface KissopenAgentAvailabilitySnapshot {
    readonly state: KissopenAgentAvailabilityState;
    readonly online: boolean;
    /** Last confirmed state may be shown, but network actions must not run. */
    readonly stale: boolean;
    /** Displayable reason for disabling an action that needs this KISSOPEN Agent. */
    readonly refusal?: string;
    /** Short in-context status for a lane, banner, terminal, or sidebar. */
    readonly message: string;
}

/** Outer route state, such as a host's current link to one remote Kissopen Agent. */
export interface KissopenAgentAvailabilityLink {
    readonly status: "connecting" | "connected" | "disconnected" | "error";
    readonly message?: string;
}

/**
 * Projects transport health into the closed availability vocabulary shared by
 * product surfaces. `materialized` means the Kissopen Agent has already supplied stores and
 * confirmed state in this app lifetime; losing it is therefore a reconnect, not
 * another startup.
 */
export function kissopenAgentAvailabilityProject(
    snapshot: KissopenAgentConnectionSnapshot,
    materialized: boolean,
    link?: KissopenAgentAvailabilityLink,
): KissopenAgentAvailabilitySnapshot {
    if (link?.status === "error") {
        const detail = link.message ?? t("This KissOpen Agent reported an error.");
        return {
            message: materialized
                ? t("{detail} Showing the last confirmed state.", { detail })
                : detail,
            online: false,
            refusal: t("This KissOpen Agent is unavailable. {detail}", { detail }),
            stale: materialized,
            state: "error",
        };
    }

    if (link?.status === "disconnected") {
        const detail = link.message ?? t("This KissOpen Agent is offline.");
        return {
            message: materialized
                ? t("{detail} Showing the last confirmed state while reconnecting automatically.", {
                      detail,
                  })
                : detail,
            online: false,
            refusal: t("{detail} Reconnecting automatically.", { detail }),
            stale: materialized,
            state: materialized ? "offline" : "connecting",
        };
    }

    if (link?.status === "connecting") {
        const detail = link.message ?? t("Connecting to this KissOpen Agent.");
        return {
            message: materialized
                ? t("{detail} Showing the last confirmed state.", { detail })
                : detail,
            online: false,
            refusal: materialized
                ? "This KissOpen Agent is reconnecting."
                : "This KissOpen Agent is still connecting.",
            stale: materialized,
            state: materialized ? "reconnecting" : "connecting",
        };
    }

    if (snapshot.connection === "connected" && snapshot.daemon === "ready")
        return {
            message: snapshot.version
                ? `KissOpen Agent ${snapshot.version} is online.`
                : "KissOpen Agent is online.",
            online: true,
            stale: false,
            state: "online",
        };

    if (snapshot.connection === "connected" && snapshot.daemon === "error") {
        const detail = snapshot.message ?? t("The KissOpen Agent daemon reported an error.");
        return {
            message: detail,
            online: false,
            refusal: t("This KissOpen Agent is unavailable. {detail}", { detail }),
            stale: materialized,
            state: "error",
        };
    }

    // Nothing has resolved yet in this connection's lifetime: no probe has
    // succeeded and none has failed. That is a first connection even on a KISSOPEN Agent
    // this app has seen before, because there is no confirmed state that has
    // been lost — and calling it a reconnect is what makes every page load flash
    // a "reconnecting" banner for as long as the first probe takes.
    const pristine =
        snapshot.connection === "connecting" &&
        snapshot.daemon === "unknown" &&
        snapshot.attempt === 0;

    if (!materialized || pristine)
        return {
            message:
                snapshot.connection === "disconnected"
                    ? "Waiting for this KissOpen Agent to become reachable."
                    : "Connecting to this KissOpen Agent…",
            online: false,
            refusal: "This KissOpen Agent is still connecting.",
            stale: false,
            state: "connecting",
        };

    if (snapshot.connection === "connecting" || snapshot.daemon === "starting")
        return {
            message: t("Reconnecting to this KissOpen Agent. Showing the last confirmed state."),
            online: false,
            refusal: "This KissOpen Agent is reconnecting.",
            stale: true,
            state: "reconnecting",
        };

    return {
        message:
            snapshot.attempt > 1
                ? t("This KissOpen Agent is offline. Reconnect attempt {attempt} is automatic.", {
                      attempt: snapshot.attempt,
                  })
                : "This KissOpen Agent is offline. Reconnecting automatically.",
        online: false,
        refusal: "This KissOpen Agent is offline. Reconnecting automatically.",
        stale: true,
        state: "offline",
    };
}

export interface KissopenAgentConnectionStore {
    get(): KissopenAgentConnectionSnapshot;
    subscribe(listener: () => void): () => void;
    /** Cancels any pending backoff and probes immediately, resetting the attempt count. */
    retry(): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentConnectionLoaderOptions {
    /**
     * Injected daemon health fetch. Transport, URL, and credentials are owned by
     * the caller so this state package never sees a socket or token.
     */
    readonly probe: () => Promise<KissopenAgentDaemonHealth>;
    /** Poll interval, in milliseconds, while a probe has succeeded (connected). */
    readonly heartbeatMs?: number;
    /** Consecutive failed probes tolerated before reporting a live KISSOPEN Agent as lost. */
    readonly failureTolerance?: number;
    /** Reconnect delay for the given zero-based failure index, in milliseconds. */
    readonly backoff?: (attempt: number) => number;
    readonly now?: () => number;
    readonly setTimer?: (handler: () => void, milliseconds: number) => unknown;
    readonly clearTimer?: (handle: unknown) => void;
    readonly onDebugEntry?: (entry: KissopenAgentDebugLogInput) => void;
}

const DEFAULT_HEARTBEAT_MS = 2_000;
/**
 * Consecutive refused probes tolerated before a live connection is called lost.
 *
 * One refused heartbeat is a moment, not a state. A daemon busy enough to miss a
 * probe, a machine waking up, or a page reloading mid-heartbeat all recover
 * inside the first backoff, and announcing each of them turns every surface's
 * connection banner into a flicker that says nothing anyone can act on. Silence
 * still has to be reported — so this only defers the report by the couple of
 * hundred milliseconds it takes to find out, and the attempt count keeps
 * running underneath so the eventual message is truthful about how long.
 *
 * It applies only after a probe has succeeded: a connection that has never
 * answered has nothing to protect and says so immediately.
 */
const DEFAULT_FAILURE_TOLERANCE = 2;

function defaultBackoff(attempt: number): number {
    return Math.min(5_000, 250 * 2 ** Math.min(attempt, 5));
}

function snapshotsEqual(
    left: KissopenAgentConnectionSnapshot,
    right: KissopenAgentConnectionSnapshot,
): boolean {
    return (
        left.connection === right.connection &&
        left.daemon === right.daemon &&
        left.version === right.version &&
        left.message === right.message &&
        left.attempt === right.attempt
    );
}

/**
 * Owns the reliability contract for one HTTP connection to a Kissopen Agent daemon: it
 * probes on the first subscriber, heartbeats to detect drops, and reconnects
 * with capped exponential backoff. The constructor opens no timers or transport;
 * all timing is injectable so tests drive it deterministically. Realtime health
 * is a delivery hint — the durable snapshot is only ever the last probe result.
 */
export function kissopenAgentConnectionLoaderCreate(
    options: KissopenAgentConnectionLoaderOptions,
): KissopenAgentConnectionStore {
    const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    const failureTolerance = options.failureTolerance ?? DEFAULT_FAILURE_TOLERANCE;
    const backoff = options.backoff ?? defaultBackoff;
    const setTimer =
        options.setTimer ?? ((handler, milliseconds) => setTimeout(handler, milliseconds));
    const clearTimer =
        options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    const listeners = new Set<() => void>();
    let snapshot: KissopenAgentConnectionSnapshot = {
        connection: "connecting",
        daemon: "unknown",
        attempt: 0,
    };
    let active = false;
    let disposed = false;
    let timer: unknown;
    // Refused probes since the last success, including the ones being waited out
    // before anything is said. `snapshot.attempt` only carries the ones already
    // reported, so it cannot double as this.
    let failures = 0;
    // Invalidates in-flight probes when the loader stops, disposes, or retries so
    // a late resolution cannot revive or corrupt a newer connection lifetime.
    let generation = 0;

    const publish = (next: KissopenAgentConnectionSnapshot): void => {
        if (snapshotsEqual(snapshot, next)) return;
        const previous = snapshot;
        snapshot = next;
        options.onDebugEntry?.({
            detail: JSON.stringify({ previous, next }, null, 2),
            level: next.connection === "disconnected" ? "warning" : "info",
            message: `Health state changed: ${next.connection}/${next.daemon}`,
            source: "health",
        });
        for (const listener of listeners) listener();
    };

    const cancelTimer = (): void => {
        if (timer !== undefined) {
            clearTimer(timer);
            timer = undefined;
        }
    };

    const schedule = (handler: () => void, milliseconds: number): void => {
        cancelTimer();
        timer = setTimer(() => {
            timer = undefined;
            handler();
        }, milliseconds);
    };

    const probeNow = (): void => {
        cancelTimer();
        const current = ++generation;
        void options.probe().then(
            (health) => {
                if (disposed || !active || current !== generation) return;
                failures = 0;
                publish({
                    connection: "connected",
                    daemon: health.status,
                    version: health.version,
                    ...(health.status === "error" ? { message: health.message } : {}),
                    attempt: 0,
                });
                // Keep polling on every success: while starting to observe the
                // ready transition, and while ready to detect a silent drop.
                schedule(probeNow, heartbeatMs);
            },
            (error: unknown) => {
                if (disposed || !active || current !== generation) return;
                const previous = failures;
                failures += 1;
                options.onDebugEntry?.({
                    detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
                    level: "warning",
                    message: `Health probe failed (attempt ${failures})`,
                    source: "health",
                });
                // Keep the last confirmed state on screen while a live connection
                // misses a beat or two; say nothing until the silence outlasts
                // what a recovering daemon takes to answer again.
                if (snapshot.connection !== "connected" || failures > failureTolerance)
                    publish({
                        connection: "disconnected",
                        daemon: "unknown",
                        message: error instanceof Error ? error.message : String(error),
                        attempt: failures,
                    });
                schedule(probeNow, backoff(previous));
            },
        );
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1 && !disposed) {
                active = true;
                failures = 0;
                options.onDebugEntry?.({
                    detail: JSON.stringify(snapshot, null, 2),
                    level: "info",
                    message: t("Health monitor started"),
                    source: "health",
                });
                probeNow();
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    active = false;
                    generation += 1;
                    cancelTimer();
                    options.onDebugEntry?.({
                        level: "info",
                        message: t("Health monitor stopped"),
                        source: "health",
                    });
                }
            };
        },
        retry() {
            if (disposed) return;
            options.onDebugEntry?.({
                level: "info",
                message: t("Immediate health retry requested"),
                source: "health",
            });
            generation += 1;
            cancelTimer();
            failures = 0;
            publish({ connection: "connecting", daemon: "unknown", attempt: 0 });
            if (active) probeNow();
        },
        [Symbol.dispose]() {
            if (disposed) return;
            options.onDebugEntry?.({
                level: "info",
                message: t("Health monitor disposed"),
                source: "health",
            });
            disposed = true;
            active = false;
            generation += 1;
            cancelTimer();
        },
    };
}
