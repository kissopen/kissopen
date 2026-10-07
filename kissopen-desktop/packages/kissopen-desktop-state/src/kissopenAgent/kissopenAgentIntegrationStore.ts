import type { KissopenAgentClient, KissopenIntegration } from "@kissopen/kissopen-agent-client";
import { createStore } from "zustand/vanilla";
import type { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";
import { kissopenAgentSyncRead } from "../kissopenAgentConnection/kissopenAgentSyncRead.js";
import type { KissopenAgentSync } from "../kissopenAgentConnection/kissopenAgentSync.js";
import { kissopenDesktopMobileOnboardingStoreCreate } from "../onboarding/kissopenDesktopMobileOnboardingStore.js";
import type {
    KissopenDesktopMobileStep,
    KissopenMobileOnboardingStore,
} from "../onboarding/kissopenMobileOnboardingStore.js";

export type KissopenAgentIntegrationStatus =
    | "loading"
    | "disabled"
    | "disconnected"
    | "pairing"
    | "connecting"
    | "connected"
    | "failed"
    | "unavailable";

/** The Kissopen Mobile connection as the Kissopen settings category reads it. */
export interface KissopenAgentIntegrationSnapshot {
    /** Undefined until the daemon has reported whether it holds a pairing. */
    readonly configured?: boolean;
    /** True while this window is waiting for the daemon to confirm an unlink. */
    readonly disconnecting: boolean;
    /** True while this window is waiting for the daemon to start pairing. */
    readonly pairingStarting: boolean;
    /** True while this window is waiting for the daemon to cancel pairing. */
    readonly pairingCanceling: boolean;
    /** Why the live integration state could not be read. */
    readonly error?: UserError;
    /** Why the last unlink was refused. Cleared by the next attempt. */
    readonly disconnectError?: UserError;
    /** Why the last pairing action was refused. Cleared by the next attempt. */
    readonly pairingError?: UserError;
    /** The opaque QR authorization supplied only while pairing is active. */
    readonly pairing?: {
        readonly data: string;
        readonly expiresAt: number;
    };
    /** The daemon's own detail for a disconnected or failed integration. */
    readonly message?: string;
    readonly status: KissopenAgentIntegrationStatus;
    /** Projection of the shared first-run flow while local setup is open. */
    readonly setup?: KissopenDesktopMobileStep;
}

/** One installation-wide KISSOPEN Mobile integration, read while its surface is open. */
export interface KissopenAgentIntegrationStore {
    get(): KissopenAgentIntegrationSnapshot;
    subscribe(listener: () => void): () => void;
    /** Unlinks this KISSOPEN Agent installation from KISSOPEN Mobile. */
    kissopenIntegrationDisconnect(): void;
    /** Starts pairing this KISSOPEN Agent installation with KISSOPEN Mobile. */
    kissopenIntegrationPair(): void;
    /** Cancels the pairing authorization currently shown by this window. */
    kissopenIntegrationPairingCancel(): void;
    /** Present only for the local Desktop; remote Agents retain Agent-only pairing. */
    readonly mobileSetup?: {
        start(): void;
        continue(): void;
        close(): void;
        platformSelect(platform: "ios" | "android"): void;
    };
    [Symbol.dispose](): void;
}

export interface KissopenAgentIntegrationStoreDeps {
    readonly connectLegacyCli?: () => Promise<void>;
    readonly prepareLegacyCli?: () => Promise<void>;
    readonly sync: KissopenAgentSync;
    readonly client: Pick<
        KissopenAgentClient,
        | "cancelKissopenIntegration"
        | "disconnectKissopenIntegration"
        | "getKissopenIntegration"
        | "startKissopenIntegration"
    >;
}

const EMPTY: KissopenAgentIntegrationSnapshot = {
    disconnecting: false,
    pairingCanceling: false,
    pairingStarting: false,
    status: "loading",
};

/**
 * Creates the settings projection of KISSOPEN Mobile's daemon-owned integration.
 *
 * The constructor opens nothing. The first subscriber reads one race-free
 * shared bootstrap or a narrow integration read, then follows the connection's
 * shared stream. Every server response is a complete replacement, so the
 * store never reconstructs connection state from event order.
 */
export function kissopenAgentIntegrationStoreCreate(
    deps: KissopenAgentIntegrationStoreDeps,
): KissopenAgentIntegrationStore {
    const store = createStore<KissopenAgentIntegrationSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    let controller: AbortController | undefined;
    let disposed = false;
    let version: string | undefined;
    let setup: KissopenMobileOnboardingStore | undefined;
    let setupUnsubscribe: (() => void) | undefined;

    const setupClose = (): void => {
        const closing = setup;
        setup = undefined;
        setupUnsubscribe?.();
        setupUnsubscribe = undefined;
        closing?.[Symbol.dispose]();
        const { setup: _closed, ...current } = store.getState();
        store.setState(current, true);
    };
    const setupStart = (): void => {
        if (disposed || listeners.size === 0 || setup || !deps.connectLegacyCli) return;
        const session = kissopenDesktopMobileOnboardingStoreCreate({
            client: deps.client,
            sync: deps.sync,
            connectLegacyCli: deps.connectLegacyCli,
            prepareLegacyCli: deps.prepareLegacyCli,
        });
        setup = session;
        const project = () => {
            if (setup !== session) return;
            const snapshot = session.get();
            if (snapshot.status === "desktop") store.setState({ setup: snapshot.step });
            else setupClose();
        };
        setupUnsubscribe = session.subscribe(project);
        project();
    };

    const integrationAdopt = (integration: KissopenIntegration): void => {
        if (version !== undefined && version.localeCompare(integration.version) >= 0) {
            // A successful bootstrap or stream event also proves transport has
            // recovered when its integration version did not need replacing.
            const { error: _cleared, ...current } = store.getState();
            if (_cleared) store.setState(current, true);
            return;
        }
        version = integration.version;
        const current = store.getState();
        store.setState(
            {
                ...integrationProject(integration),
                disconnecting: current.disconnecting,
                pairingCanceling: current.pairingCanceling,
                ...(current.setup ? { setup: current.setup } : {}),
                pairingStarting: current.pairingStarting,
                ...(integration.configured && current.disconnectError
                    ? { disconnectError: current.disconnectError }
                    : {}),
                ...(!integration.configured && current.pairingError
                    ? { pairingError: current.pairingError }
                    : {}),
            },
            true,
        );
    };

    const follow = async (active: AbortController): Promise<void> => {
        const integrationRead = () =>
            kissopenAgentSyncRead(
                active.signal,
                () => deps.client.getKissopenIntegration({ signal: active.signal }),
                (error) => store.setState({ error: kissopenAgentUserError(error) }, false),
            );
        for await (const input of deps.sync.follow({
            signal: active.signal,
            events: ["kissopen.integration.updated"],
        })) {
            try {
                if (input.kind === "error") throw input.error;
                if (input.kind === "bootstrap" || input.kind === "reconcile") {
                    const integration =
                        input.kind === "bootstrap"
                            ? input.bootstrap.kissopenIntegration
                            : (await integrationRead()).integration;
                    if (active.signal.aborted) return;
                    if (input.kind === "bootstrap") version = undefined;
                    if (!integration) {
                        const setup = store.getState().setup;
                        store.setState(
                            { ...EMPTY, status: "unavailable", ...(setup ? { setup } : {}) },
                            true,
                        );
                        continue;
                    }
                    integrationAdopt(integration);
                    continue;
                }
                const update = input.update;
                if (update.kind === "connected" && store.getState().error) {
                    const response = await integrationRead();
                    if (!active.signal.aborted) integrationAdopt(response.integration);
                }
                if (update.kind === "event" && update.event.type === "kissopen.integration.updated")
                    integrationAdopt(update.event.payload.integration);
            } catch (error) {
                if (!active.signal.aborted)
                    store.setState({ error: kissopenAgentUserError(error) }, false);
            }
        }
    };

    const followEnsure = (): void => {
        if (disposed || listeners.size === 0 || controller !== undefined) return;
        const active = new AbortController();
        controller = active;
        void follow(active)
            .catch((error: unknown) => {
                if (disposed || active.signal.aborted) return;
                store.setState({ error: kissopenAgentUserError(error) }, false);
            })
            .finally(() => {
                if (controller === active) controller = undefined;
            });
    };

    return {
        get: () => store.getState(),
        ...(deps.connectLegacyCli
            ? {
                  mobileSetup: {
                      start: setupStart,
                      continue: () => setup?.kissopenMobileConnect(),
                      close: () => setup?.kissopenMobileSkip(),
                      platformSelect: (platform: "ios" | "android") =>
                          setup?.kissopenMobilePlatformSelect(platform),
                  },
              }
            : {}),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            if (listeners.size === 1) followEnsure();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size !== 0) return;
                controller?.abort();
                controller = undefined;
                setupClose();
            };
        },
        kissopenIntegrationDisconnect() {
            const current = store.getState();
            if (disposed || current.configured !== true || current.disconnecting) return;
            const { disconnectError: _cleared, ...rest } = current;
            store.setState({ ...rest, disconnecting: true }, true);
            void deps.client.disconnectKissopenIntegration().then(
                (response) => {
                    if (disposed) return;
                    integrationAdopt(response.integration);
                    store.setState({ disconnecting: false }, false);
                },
                (error: unknown) => {
                    if (disposed) return;
                    store.setState(
                        { disconnectError: kissopenAgentUserError(error), disconnecting: false },
                        false,
                    );
                },
            );
        },
        kissopenIntegrationPair() {
            if (deps.connectLegacyCli) {
                setupStart();
                return;
            }
            const current = store.getState();
            if (
                disposed ||
                current.configured !== false ||
                current.pairingStarting ||
                (current.status !== "disconnected" && current.status !== "failed")
            )
                return;
            const { pairingError: _cleared, ...rest } = current;
            store.setState({ ...rest, pairingStarting: true }, true);
            void deps.client.startKissopenIntegration().then(
                (response) => {
                    if (disposed) return;
                    integrationAdopt(response.integration);
                    store.setState({ pairingStarting: false }, false);
                },
                (error: unknown) => {
                    if (disposed) return;
                    store.setState(
                        { pairingError: kissopenAgentUserError(error), pairingStarting: false },
                        false,
                    );
                },
            );
        },
        kissopenIntegrationPairingCancel() {
            const current = store.getState();
            if (disposed || current.status !== "pairing" || current.pairingCanceling) return;
            const { pairingError: _cleared, ...rest } = current;
            store.setState({ ...rest, pairingCanceling: true }, true);
            void deps.client.cancelKissopenIntegration().then(
                (response) => {
                    if (disposed) return;
                    integrationAdopt(response.integration);
                    store.setState({ pairingCanceling: false }, false);
                },
                (error: unknown) => {
                    if (disposed) return;
                    store.setState(
                        { pairingCanceling: false, pairingError: kissopenAgentUserError(error) },
                        false,
                    );
                },
            );
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            setupClose();
            controller?.abort();
            controller = undefined;
            listeners.clear();
        },
    };
}

function integrationProject(integration: KissopenIntegration): KissopenAgentIntegrationSnapshot {
    return {
        configured: integration.configured,
        disconnecting: false,
        pairingCanceling: false,
        pairingStarting: false,
        status: integration.status,
        ...(integration.status === "pairing"
            ? {
                  pairing: {
                      data: integration.authorization.data,
                      expiresAt: integration.authorization.expiresAt,
                  },
              }
            : {}),
        ...((integration.status === "disconnected" || integration.status === "failed") &&
        integration.error
            ? { message: integration.error.message }
            : {}),
    };
}

const UNAVAILABLE: KissopenAgentIntegrationSnapshot = {
    disconnecting: false,
    pairingCanceling: false,
    pairingStarting: false,
    status: "unavailable",
};

/** A settled stand-in when this window has no Kissopen Agent integration source. */
export const kissopenAgentIntegrationStoreNoop: KissopenAgentIntegrationStore = {
    get: () => UNAVAILABLE,
    subscribe: () => () => undefined,
    kissopenIntegrationDisconnect: () => undefined,
    kissopenIntegrationPair: () => undefined,
    kissopenIntegrationPairingCancel: () => undefined,
    [Symbol.dispose]: () => undefined,
};
