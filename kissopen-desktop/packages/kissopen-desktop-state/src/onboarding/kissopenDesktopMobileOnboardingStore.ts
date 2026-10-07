import { t } from "../i18n/locale.js";
import type { KissopenIntegration } from "@kissopen/kissopen-agent-client";
import { kissopenAgentUserError } from "../kissopenAgent/kissopenAgentSupport.js";
import { kissopenMobileLegacyLink } from "./kissopenMobileLegacyLink.js";
import type {
    KissopenDesktopMobileStep,
    KissopenMobileOnboardingSnapshot,
    KissopenMobileOnboardingStore,
    KissopenMobileOnboardingStoreOptions,
} from "./kissopenMobileOnboardingStore.js";

/** Desktop-only consent, app-install gate, and handoff; no legacy work on subscription. */
export function kissopenDesktopMobileOnboardingStoreCreate(
    options: KissopenMobileOnboardingStoreOptions,
): KissopenMobileOnboardingStore {
    const listeners = new Set<() => void>();
    let snapshot: KissopenMobileOnboardingSnapshot = options.initialSkipped
        ? { status: "skipped" }
        : { status: "desktop", step: { kind: "intro" } };
    let consented = false;
    let skipped = options.initialSkipped === true;
    let continued = false;
    let disposed = false;
    let generation = 0;
    let platform: "ios" | "android" = "ios";
    let integration: KissopenIntegration | undefined;
    let network: AbortController | undefined;
    let networkError: string | undefined;
    let reading = false;
    let transportOnline = false;
    let prepared = false;
    let preparing = false;
    let preparationError: string | undefined;
    let appReady = false;
    let pairing = false;
    let pairingError: string | undefined;
    let linking = false;
    let linkAttempted = false;
    let linked = false;
    let linkError: string | undefined;

    const active = () => !disposed && !skipped && !continued && listeners.size > 0;
    const errorMessage = (error: unknown) => kissopenAgentUserError(error).message;
    const step = (): KissopenDesktopMobileStep => {
        if (!consented)
            return {
                kind: "intro",
                ...(integration?.configured ? { alreadyLinked: true } : {}),
            };
        if (linked && integration?.configured) {
            const online = integration.status === "connected" && transportOnline && !networkError;
            return {
                kind: "connected",
                online,
                ...(!online
                    ? {
                          message:
                              networkError ??
                              t(
                                  "Your pairing is saved. This computer is reconnecting to KissOpen Mobile; remote control will be available when it is online.",
                              ),
                      }
                    : {}),
            };
        }
        // An unsuccessful read is not evidence that there is no saved pairing.
        // Keep its reason visible even when CLI preparation has already finished.
        if (!integration || networkError || reading)
            return {
                kind: "link",
                appReady: appReady || integration?.configured === true,
                phase:
                    networkError && !reading
                        ? { kind: "failed", message: networkError }
                        : { kind: "checking" },
            };
        if (integration.configured) {
            const message = preparationError ?? linkError;
            return {
                kind: "link",
                appReady: true,
                phase: message
                    ? { kind: "failed", message }
                    : { kind: prepared ? "finishing" : "preparing" },
            };
        }
        if (!appReady)
            return {
                kind: "get-app",
                platform,
                preparation: preparationError ? "failed" : prepared ? "ready" : "preparing",
                ...(preparationError || networkError
                    ? { message: preparationError ?? networkError }
                    : {}),
            };
        const message = pairingError ?? networkError;
        if (message) return { kind: "link", appReady: true, phase: { kind: "failed", message } };
        if (integration?.status === "pairing")
            return {
                kind: "link",
                appReady: true,
                phase: {
                    kind: "pairing",
                    data: integration.authorization.data,
                    expiresAt: integration.authorization.expiresAt,
                },
            };
        if (integration?.status === "failed" || integration?.status === "disabled")
            return {
                kind: "link",
                appReady: true,
                phase: {
                    kind: "failed",
                    message:
                        integration.status === "failed"
                            ? integration.error.message
                            : t("KissOpen Mobile is disabled in this KissOpen Agent installation."),
                },
            };
        return {
            kind: "link",
            appReady: true,
            phase: pairing
                ? { kind: "checking" }
                : {
                      kind: "failed",
                      message: t(
                          "The pairing code expired or was cancelled. Try again for a new code.",
                      ),
                  },
        };
    };
    const publish = () => {
        if (disposed) return;
        snapshot = skipped
            ? { status: "skipped" }
            : continued
              ? { status: "configured" }
              : { status: "desktop", step: step() };
        for (const listener of listeners) listener();
    };
    const stop = () => {
        network?.abort();
        network = undefined;
        transportOnline = false;
    };
    const currentFor = (request: number) => () => active() && request === generation;
    function adopt(next: KissopenIntegration, authoritative = false): void {
        if (!active()) return;
        if (!authoritative && integration && integration.version.localeCompare(next.version) > 0)
            return;
        integration = next;
        networkError = undefined;
        if (!next.configured) {
            linked = false;
            if (!linking) linkAttempted = false;
        }
        publish();
        advance();
    }
    function advance(): void {
        if (
            active() &&
            consented &&
            prepared &&
            !networkError &&
            transportOnline &&
            integration?.configured &&
            !linked &&
            !linkAttempted
        )
            link();
    }
    function prepare(): void {
        if (!active() || !consented || preparing) return;
        if (prepared) {
            advance();
            return;
        }
        preparing = true;
        preparationError = undefined;
        const current = currentFor(generation);
        publish();
        void (async () => {
            if (!options.prepareLegacyCli)
                throw new Error(
                    "This desktop version cannot prepare the KissOpen CLI. Update KissOpen and try again.",
                );
            await options.prepareLegacyCli();
            if (!current()) return;
            preparing = false;
            prepared = true;
            publish();
            advance();
        })().catch((error: unknown) => {
            if (!current()) return;
            preparing = false;
            preparationError = errorMessage(error);
            publish();
        });
    }
    function link(): void {
        const connect = options.connectLegacyCli;
        if (!active() || !consented || !prepared || !integration?.configured || !connect || linking)
            return;
        linking = true;
        linkAttempted = true;
        linkError = undefined;
        const current = currentFor(generation);
        publish();
        void kissopenMobileLegacyLink(options.client, connect, current).then(
            (next) => {
                if (!current() || !next) return;
                linking = false;
                linked = true;
                adopt(next);
                publish();
            },
            (error: unknown) => {
                if (!current()) return;
                linking = false;
                linkError = errorMessage(error);
                publish();
            },
        );
    }
    function pair(): void {
        if (!active() || !consented || !prepared || !appReady || pairing) return;
        pairing = true;
        pairingError = undefined;
        networkError = undefined;
        const current = currentFor(generation);
        publish();
        void (async () => {
            // Recheck saved authorization so a second window/phone cannot force a rescan.
            const saved = await options.client.getKissopenIntegration();
            if (!current()) return;
            if (
                saved.integration.configured ||
                saved.integration.status === "pairing" ||
                saved.integration.status === "disabled"
            ) {
                pairing = false;
                adopt(saved.integration);
                return;
            }
            const response = await options.client.startKissopenIntegration();
            if (!current()) {
                if (!disposed && skipped && response.integration.status === "pairing")
                    void options.client.cancelKissopenIntegration().catch(() => undefined);
                return;
            }
            pairing = false;
            adopt(response.integration);
        })().catch((error: unknown) => {
            if (!current()) return;
            pairing = false;
            pairingError = errorMessage(error);
            publish();
        });
    }
    async function read(signal: AbortSignal): Promise<void> {
        const response = await options.client.getKissopenIntegration({ signal });
        if (!signal.aborted) {
            transportOnline = true;
            adopt(response.integration);
        }
    }
    function retryRead(): void {
        if (!active() || reading) return;
        start();
        const signal = network?.signal;
        if (!signal) return;
        reading = true;
        const current = currentFor(generation);
        publish();
        void read(signal)
            .catch((error: unknown) => {
                if (!current() || signal.aborted) return;
                transportOnline = false;
                networkError = errorMessage(error);
            })
            .finally(() => {
                if (!current()) return;
                reading = false;
                publish();
                advance();
            });
    }
    async function follow(abort: AbortController): Promise<void> {
        for await (const input of options.sync.follow({
            signal: abort.signal,
            events: ["kissopen.integration.updated"],
        })) {
            if (abort.signal.aborted) return;
            try {
                if (input.kind === "error") throw input.error;
                if (input.kind === "bootstrap") {
                    if (!input.bootstrap.kissopenIntegration)
                        throw new Error(
                            "This KissOpen Agent does not support KissOpen Mobile pairing.",
                        );
                    transportOnline = true;
                    // A fresh daemon bootstrap establishes a new version baseline.
                    adopt(input.bootstrap.kissopenIntegration, true);
                } else if (
                    input.kind === "reconcile" ||
                    (input.kind === "update" && input.update.kind === "connected")
                ) {
                    await read(abort.signal);
                } else if (
                    input.kind === "update" &&
                    (input.update.kind === "disconnected" || input.update.kind === "draining")
                ) {
                    transportOnline = false;
                    networkError =
                        "KissOpen cannot reach the local KissOpen Agent. Reconnect and try again.";
                    publish();
                } else if (
                    input.kind === "update" &&
                    input.update.kind === "event" &&
                    input.update.event.type === "kissopen.integration.updated"
                ) {
                    adopt(input.update.event.payload.integration);
                }
            } catch (error) {
                if (abort.signal.aborted) return;
                transportOnline = false;
                networkError = errorMessage(error);
                publish();
            }
        }
    }
    function start(): void {
        if (!active() || network) return;
        const abort = new AbortController();
        network = abort;
        void follow(abort)
            .catch((error: unknown) => {
                if (abort.signal.aborted) return;
                transportOnline = false;
                networkError = errorMessage(error);
                publish();
            })
            .finally(() => {
                if (network === abort) {
                    network = undefined;
                    transportOnline = false;
                    publish();
                }
            });
    }
    return {
        get: () => snapshot,
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            start();
            return () => {
                listeners.delete(listener);
                if (listeners.size) return;
                generation += 1;
                reading = false;
                stop();
                if (preparing) {
                    preparing = false;
                    preparationError = "Setup paused. Try again to prepare the CLI.";
                }
                if (linking) {
                    linking = false;
                    linkError = "Setup paused. Try again to finish linking.";
                }
                if (pairing) {
                    pairing = false;
                    pairingError = "Setup paused. Try again to connect your phone.";
                }
                publish();
            };
        },
        kissopenMobileConnect() {
            if (!active() || snapshot.status !== "desktop") return;
            if (!consented) {
                consented = true;
                prepare();
                return;
            }
            if (snapshot.step.kind === "connected") {
                continued = true;
                publish();
                stop();
                return;
            }
            if (!prepared) prepare();
            if (!integration || networkError) {
                retryRead();
                return;
            }
            if (!prepared) return;
            if (integration?.configured) {
                link();
                return;
            }
            if (snapshot.step.kind === "get-app") {
                appReady = true;
                pair();
                return;
            }
            if (appReady) pair();
            else retryRead();
        },
        kissopenMobilePlatformSelect(value) {
            if (!active() || !consented || appReady) return;
            platform = value;
            publish();
        },
        kissopenMobileSkip() {
            if (!active()) return;
            const cancel = appReady && integration?.status === "pairing";
            skipped = true;
            generation += 1;
            stop();
            publish();
            options.onOutput?.({ type: "kissopenMobileSkipped" });
            if (cancel) void options.client.cancelKissopenIntegration().catch(() => undefined);
        },
        [Symbol.dispose]() {
            if (disposed) return;
            const cancel = !skipped && !continued && appReady && integration?.status === "pairing";
            disposed = true;
            generation += 1;
            stop();
            listeners.clear();
            if (cancel) void options.client.cancelKissopenIntegration().catch(() => undefined);
        },
    };
}
