import type {
    KissopenAgentClient,
    KissopenAgentEvent,
    KissopenAgentUpdate,
} from "@kissopen/kissopen-agent-client";

type DesktopBootstrap = Awaited<ReturnType<KissopenAgentClient["getDesktopBootstrap"]>>;

/** The only authenticated state available before a team member has a profile. */
export interface KissopenAgentOnboardingInput {
    readonly onboarding: Awaited<ReturnType<KissopenAgentClient["getOnboarding"]>>;
    readonly profile: DesktopBootstrap["profile"];
}

/** Private authoritative input to feature stores, never a product/UI snapshot. */
export type KissopenAgentSyncInput =
    | { readonly kind: "bootstrap"; readonly bootstrap: DesktopBootstrap }
    | { readonly kind: "reconcile" }
    | { readonly kind: "update"; readonly update: KissopenAgentUpdate }
    | { readonly kind: "error"; readonly error: Error };

type QueuedSyncInput =
    | KissopenAgentSyncInput
    | { readonly kind: "onboarding"; readonly input: KissopenAgentOnboardingInput | undefined };

/** One connection's transport input. Following it never opens another request or SSE stream. */
export interface KissopenAgentSync {
    follow(options: {
        readonly signal: AbortSignal;
        readonly events: readonly KissopenAgentEvent["type"][];
        /** Opts into narrow startup reads, without releasing protected surface reads. */
        readonly onOnboarding?: (input: KissopenAgentOnboardingInput | undefined) => void;
    }): AsyncIterable<KissopenAgentSyncInput>;
}

/**
 * The connection privately writes its bootstrap and ordered transport updates.
 * No aggregate product state or historical bootstrap is retained here. A late
 * surface reconciles its own endpoint with its subscription already installed.
 * Before bootstrap, only the narrow onboarding input is replayed to opted-in
 * consumers. It is discarded on bootstrap or failed reachability; ordinary
 * surfaces remain parked until protected synchronization is initialized.
 */
export function kissopenAgentSyncCreate() {
    const listeners = new Set<(input: QueuedSyncInput) => void>();
    let initialized = false;
    let closed = false;
    let connectionUpdate: KissopenAgentUpdate | undefined;
    let onboarding: KissopenAgentOnboardingInput | undefined;
    const onboardingPublish = (input: KissopenAgentOnboardingInput | undefined): void => {
        if (closed) return;
        onboarding = input;
        publish({ kind: "onboarding", input });
    };
    const publish = (input: QueuedSyncInput): void => {
        if (closed) return;
        for (const listener of listeners) listener(input);
    };
    const source: KissopenAgentSync = {
        async *follow({ signal, events, onOnboarding }) {
            if (closed || signal.aborted) return;
            const queue: QueuedSyncInput[] = [];
            let wake: (() => void) | undefined;
            const notify = (): void => {
                wake?.();
                wake = undefined;
            };
            const receive = (input: QueuedSyncInput): void => {
                if (input.kind === "onboarding" && !onOnboarding) return;
                if (
                    input.kind === "update" &&
                    input.update.kind === "event" &&
                    !events.includes(input.update.event.type)
                )
                    return;
                if (input.kind === "bootstrap") queue.length = 0;
                // A slow endpoint cannot accumulate an unbounded journal. The
                // authoritative narrow read repairs discarded delivery hints.
                if (queue.length >= 64) {
                    queue.length = 0;
                    // Before bootstrap there is no authorized reconciliation
                    // route for ordinary surfaces. Only replay narrow input.
                    if (initialized) queue.push({ kind: "reconcile" });
                    else if (onOnboarding) queue.push({ kind: "onboarding", input: onboarding });
                }
                queue.push(input);
                notify();
            };
            listeners.add(receive);
            signal.addEventListener("abort", notify, { once: true });
            try {
                if (onOnboarding && onboarding) receive({ kind: "onboarding", input: onboarding });
                if (initialized) {
                    receive({ kind: "reconcile" });
                    if (connectionUpdate) receive({ kind: "update", update: connectionUpdate });
                }
                while (!closed && !signal.aborted) {
                    const next = queue.shift();
                    // Consumer callbacks run in their follower, never inside
                    // the connection loop, and retain ordering with errors.
                    if (next?.kind === "onboarding") onOnboarding?.(next.input);
                    else if (next) yield next;
                    else
                        await new Promise<void>((resolve) => {
                            wake = resolve;
                        });
                }
            } finally {
                listeners.delete(receive);
                signal.removeEventListener("abort", notify);
                queue.length = 0;
            }
        },
    };
    return {
        source,
        writer: {
            onboardingReceived(input: KissopenAgentOnboardingInput): void {
                onboardingPublish(input);
            },
            onboardingUnavailable(): void {
                onboardingPublish(undefined);
            },
            bootstrapReceived(bootstrap: DesktopBootstrap): void {
                onboarding = undefined;
                initialized = true;
                publish({ kind: "bootstrap", bootstrap });
            },
            updateReceived(update: KissopenAgentUpdate): void {
                if (
                    update.kind === "connected" ||
                    update.kind === "disconnected" ||
                    update.kind === "draining"
                )
                    connectionUpdate = update;
                publish({ kind: "update", update });
            },
            errorReceived(error: unknown): void {
                onboardingPublish(undefined);
                publish({
                    kind: "error",
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            },
            close(): void {
                closed = true;
                // Wake parked iterators so their finally blocks release listeners.
                for (const listener of listeners) listener({ kind: "reconcile" });
                listeners.clear();
                onboarding = undefined;
            },
        },
    };
}
