import { t } from "../i18n/locale.js";
import type { KissopenAgentClient, KissopenIntegration } from "@kissopen/kissopen-agent-client";
import { kissopenAgentUserError } from "../kissopenAgent/kissopenAgentSupport.js";
import type { KissopenAgentSync } from "../kissopenAgentConnection/kissopenAgentSync.js";
import { kissopenAgentSyncRead } from "../kissopenAgentConnection/kissopenAgentSyncRead.js";
import { kissopenDesktopMobileOnboardingStoreCreate } from "./kissopenDesktopMobileOnboardingStore.js";

export type KissopenMobileLinkPhase =
    | { readonly kind: "checking" | "preparing" | "finishing" }
    | { readonly kind: "pairing"; readonly data: string; readonly expiresAt: number }
    | { readonly kind: "failed"; readonly message: string };

export type KissopenDesktopMobileStep =
    | { readonly kind: "intro"; readonly alreadyLinked?: boolean }
    | {
          readonly kind: "get-app";
          readonly platform: "ios" | "android";
          readonly preparation: "preparing" | "ready" | "failed";
          readonly message?: string;
      }
    | { readonly kind: "link"; readonly appReady: boolean; readonly phase: KissopenMobileLinkPhase }
    | { readonly kind: "connected"; readonly online: boolean; readonly message?: string };

export type KissopenMobileOnboardingSnapshot =
    | { readonly status: "desktop"; readonly step: KissopenDesktopMobileStep }
    | { readonly status: "checking" }
    | {
          readonly message?: string;
          readonly pending: boolean;
          readonly status: "offer";
      }
    | {
          /** Opaque data supplied by Kissopen Agent, rendered only as a QR code. */
          readonly data: string;
          readonly expiresAt: number;
          readonly status: "pairing";
      }
    | { readonly status: "configured" }
    | { readonly status: "disabled" }
    | { readonly status: "skipped" }
    | {
          readonly message: string;
          readonly pending: boolean;
          readonly status: "failed";
      };

export type KissopenMobileOnboardingOutput = { readonly type: "kissopenMobileSkipped" };

export interface KissopenMobileOnboardingStore {
    get(): KissopenMobileOnboardingSnapshot;
    subscribe(listener: () => void): () => void;
    kissopenMobileConnect(): void;
    kissopenMobileSkip(): void;
    kissopenMobilePlatformSelect(platform: "ios" | "android"): void;
    [Symbol.dispose](): void;
}

export interface KissopenMobileOnboardingStoreOptions {
    readonly sync: KissopenAgentSync;
    readonly client: Pick<
        KissopenAgentClient,
        "cancelKissopenIntegration" | "getKissopenIntegration" | "startKissopenIntegration"
    >;
    readonly initialSkipped?: boolean;
    /** Local desktop only; remote Kissopen Agents retain their Agent-only pairing. */
    readonly connectLegacyCli?: () => Promise<void>;
    readonly prepareLegacyCli?: () => Promise<void>;
    readonly onOutput?: (output: KissopenMobileOnboardingOutput) => void;
}

const CHECKING: KissopenMobileOnboardingSnapshot = { status: "checking" };
const CONFIGURED: KissopenMobileOnboardingSnapshot = { status: "configured" };
const DISABLED: KissopenMobileOnboardingSnapshot = { status: "disabled" };
const SKIPPED: KissopenMobileOnboardingSnapshot = { status: "skipped" };

function resolved(snapshot: KissopenMobileOnboardingSnapshot): boolean {
    return (
        snapshot.status === "configured" ||
        snapshot.status === "disabled" ||
        snapshot.status === "skipped"
    );
}

/**
 * The optional Kissopen Mobile step, backed by one authoritative daemon snapshot
 * and its realtime replacements.
 *
 * The constructor opens nothing. The first subscriber takes a race-free
 * shared bootstrap or a narrow integration read and follows the connection's
 * shared journal; the last subscriber aborts its read immediately. Configured, disabled, and skipped
 * are terminal for onboarding, so they stop transport even while the screen
 * that follows remains mounted.
 */
export function kissopenMobileOnboardingStoreCreate(
    options: KissopenMobileOnboardingStoreOptions,
): KissopenMobileOnboardingStore {
    if (options.connectLegacyCli) return kissopenDesktopMobileOnboardingStoreCreate(options);
    const listeners = new Set<() => void>();
    let snapshot: KissopenMobileOnboardingSnapshot = options.initialSkipped ? SKIPPED : CHECKING;
    let version: string | undefined;
    let networkAbort: AbortController | undefined;
    let mutation = 0;
    let disposed = false;

    const publish = (next: KissopenMobileOnboardingSnapshot): void => {
        if (disposed) return;
        snapshot = next;
        for (const listener of listeners) listener();
    };
    const networkStop = (): void => {
        networkAbort?.abort();
        networkAbort = undefined;
    };
    const integrationAdopt = (integration: KissopenIntegration): void => {
        if (disposed || snapshot.status === "skipped") return;
        if (version !== undefined) {
            const order = version.localeCompare(integration.version);
            if (order > 0 || (order === 0 && snapshot.status !== "failed")) return;
        }
        version = integration.version;
        if (integration.configured) {
            publish(CONFIGURED);
            networkStop();
            return;
        }
        switch (integration.status) {
            case "disabled":
                publish(DISABLED);
                networkStop();
                return;
            case "disconnected":
                publish({
                    ...(integration.error ? { message: integration.error.message } : {}),
                    pending: false,
                    status: "offer",
                });
                return;
            case "pairing":
                publish({
                    data: integration.authorization.data,
                    expiresAt: integration.authorization.expiresAt,
                    status: "pairing",
                });
                return;
            case "failed":
                publish({ message: integration.error.message, pending: false, status: "failed" });
                return;
        }
    };
    const follow = async (abort: AbortController): Promise<void> => {
        const integrationRead = () =>
            kissopenAgentSyncRead(
                abort.signal,
                () => options.client.getKissopenIntegration({ signal: abort.signal }),
                (error) =>
                    publish({
                        message: t(
                            "KissOpen could not read KissOpen Mobile setup. {kissopenAgentUserError}",
                            { kissopenAgentUserError: kissopenAgentUserError(error).message },
                        ),
                        pending: false,
                        status: "failed",
                    }),
            );
        for await (const input of options.sync.follow({
            signal: abort.signal,
            events: ["kissopen.integration.updated"],
        })) {
            try {
                if (input.kind === "error") throw input.error;
                if (
                    input.kind === "bootstrap" ||
                    input.kind === "reconcile" ||
                    (input.kind === "update" &&
                        input.update.kind === "connected" &&
                        snapshot.status === "failed")
                ) {
                    const integration =
                        input.kind === "bootstrap"
                            ? input.bootstrap.kissopenIntegration
                            : (await integrationRead()).integration;
                    if (abort.signal.aborted) return;
                    if (input.kind === "bootstrap") version = undefined;
                    if (!integration) {
                        publish({
                            message: t("This KissOpen Agent does not support KissOpen Mobile pairing."),
                            pending: false,
                            status: "failed",
                        });
                        continue;
                    }
                    integrationAdopt(integration);
                    if (abort.signal.aborted || resolved(snapshot)) return;
                    continue;
                }
                const update = input.update;
                if (
                    update.kind === "event" &&
                    update.event.type === "kissopen.integration.updated"
                ) {
                    integrationAdopt(update.event.payload.integration);
                    if (abort.signal.aborted || resolved(snapshot)) return;
                }
            } catch (error) {
                if (!abort.signal.aborted)
                    publish({
                        message: t(
                            "KissOpen could not read KissOpen Mobile setup. {kissopenAgentUserError}",
                            { kissopenAgentUserError: kissopenAgentUserError(error).message },
                        ),
                        pending: false,
                        status: "failed",
                    });
            }
        }
    };
    const networkEnsure = (): void => {
        if (disposed || listeners.size === 0 || networkAbort || resolved(snapshot)) return;
        const abort = new AbortController();
        networkAbort = abort;
        void follow(abort)
            .catch((error: unknown) => {
                if (abort.signal.aborted) return;
                publish({
                    message: t(
                        "KissOpen could not read KissOpen Mobile setup. {kissopenAgentUserError}",
                        { kissopenAgentUserError: kissopenAgentUserError(error).message },
                    ),
                    pending: false,
                    status: "failed",
                });
            })
            .finally(() => {
                if (networkAbort === abort) networkAbort = undefined;
            });
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            if (listeners.size === 1) networkEnsure();
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    networkStop();
                    mutation += 1;
                    if (
                        (snapshot.status === "offer" || snapshot.status === "failed") &&
                        snapshot.pending
                    )
                        snapshot = {
                            status: "failed",
                            pending: false,
                            message: t(
                                "Setup paused. Try again to finish connecting KissOpen Mobile.",
                            ),
                        };
                }
            };
        },
        kissopenMobileConnect() {
            if (
                disposed ||
                (snapshot.status !== "offer" && snapshot.status !== "failed") ||
                snapshot.pending
            )
                return;
            const request = ++mutation;
            publish({ ...snapshot, pending: true });
            void options.client.startKissopenIntegration().then(
                (response) => {
                    if (request !== mutation || snapshot.status === "skipped") {
                        if (
                            !disposed &&
                            snapshot.status === "skipped" &&
                            !response.integration.configured &&
                            response.integration.status === "pairing"
                        )
                            void options.client.cancelKissopenIntegration().catch(() => undefined);
                        return;
                    }
                    integrationAdopt(response.integration);
                    networkEnsure();
                },
                (error: unknown) => {
                    if (request !== mutation || resolved(snapshot)) return;
                    publish({
                        message: t(
                            "KissOpen Mobile could not start pairing. {kissopenAgentUserError}",
                            { kissopenAgentUserError: kissopenAgentUserError(error).message },
                        ),
                        pending: false,
                        status: "failed",
                    });
                },
            );
        },
        kissopenMobileSkip() {
            if (disposed || resolved(snapshot)) return;
            const cancelPairing = snapshot.status === "pairing";
            mutation += 1;
            publish(SKIPPED);
            networkStop();
            options.onOutput?.({ type: "kissopenMobileSkipped" });
            if (cancelPairing)
                void options.client.cancelKissopenIntegration().catch(() => undefined);
        },
        kissopenMobilePlatformSelect() {},
        [Symbol.dispose]() {
            disposed = true;
            mutation += 1;
            networkStop();
            listeners.clear();
        },
    };
}
