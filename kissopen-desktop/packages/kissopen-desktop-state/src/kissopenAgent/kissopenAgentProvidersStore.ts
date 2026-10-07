import { createStore } from "zustand/vanilla";
import type { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import type {
    CustomProviderDiscovery,
    CustomProviderDiscoveryResponse,
    CustomProviderSave,
    CustomProviderUpdate,
    CustomProviderDetailsResponse,
    CustomProviderExistingDiscovery,
    ConfigResponse,
    CustomProviderReasoningUpdate,
} from "@kissopen/kissopen-agent-client";
import type { UserError } from "../types.js";
import { kissopenAgentModelCatalogProject } from "./kissopenAgentProject.js";
import { kissopenAgentUserError, referencesPreserve } from "./kissopenAgentSupport.js";
import type {
    KissopenAgentModelCatalog,
    KissopenAgentModelProvider,
} from "./kissopenAgentTypes.js";

/**
 * One provider as the Providers category reads it: what the daemon says it
 * offers, plus whether a change this window asked for has been answered yet.
 */
export interface KissopenAgentProviderEntry extends KissopenAgentModelProvider {
    /** This window has asked for a change the daemon has not confirmed yet. */
    readonly saving: boolean;
}

export interface KissopenAgentProvidersSnapshot {
    /** Every provider the daemon knows about, in the order it reports them. */
    readonly providers: readonly KissopenAgentProviderEntry[];
    /** True until the first answer arrives, so "no providers" is not claimed early. */
    readonly loading: boolean;
    /** Why the provider list could not be read; retained readings stay beneath it. */
    readonly error?: UserError;
    /** Why the last enablement change was refused. Cleared by the next attempt. */
    readonly saveError?: UserError;
}

/**
 * The Providers settings category: every provider this Kissopen Agent knows about
 * and whether it may be used.
 *
 * Enablement is the daemon's own durable configuration rather than a preference
 * of this window, so switching a provider off here switches it off for every
 * agent on the machine. The store never guesses the outcome: a change marks the
 * provider as waiting, and the configuration the daemon answers with is what the
 * surface then shows.
 */
export interface KissopenAgentProvidersStore {
    get(): KissopenAgentProvidersSnapshot;
    subscribe(listener: () => void): () => void;
    /** Asks the daemon to start or stop using one provider machine-wide. */
    providerEnabledUpdate(providerId: string, enabled: boolean): void;
    customProviderDiscover(
        input: CustomProviderDiscovery,
        signal: AbortSignal,
    ): Promise<CustomProviderDiscoveryResponse>;
    customProviderSave(input: Omit<CustomProviderSave, "mutationId">): Promise<void>;
    customProviderRead(
        providerId: string,
        signal: AbortSignal,
    ): Promise<CustomProviderDetailsResponse>;
    customProviderDiscoverExisting(
        providerId: string,
        input: CustomProviderExistingDiscovery,
        signal: AbortSignal,
    ): Promise<CustomProviderDiscoveryResponse>;
    customProviderUpdate(
        providerId: string,
        input: Omit<CustomProviderUpdate, "mutationId">,
    ): Promise<void>;
    customProviderDelete(providerId: string): Promise<void>;
    customProviderReasoningUpdate(
        providerId: string,
        input: Omit<CustomProviderReasoningUpdate, "mutationId">,
    ): Promise<void>;
    [Symbol.dispose](): void;
}

export interface KissopenAgentProvidersStoreDeps {
    readonly client: Pick<
        KissopenAgentClient,
        | "getConfig"
        | "patchConfig"
        | "discoverCustomProvider"
        | "saveCustomProvider"
        | "updateCustomProviderReasoning"
        | "getCustomProvider"
        | "updateCustomProvider"
        | "deleteCustomProvider"
        | "discoverExistingCustomProvider"
    >;
    /**
     * Hands on the catalog the daemon has just confirmed. Enabling a provider
     * changes what every picker in the window may offer, so the one catalog
     * authority is told rather than left holding the configuration from before.
     */
    readonly catalogChanged?: (catalog: KissopenAgentModelCatalog) => void;
}

const EMPTY: KissopenAgentProvidersSnapshot = { providers: [], loading: true };

/**
 * How often the open category re-reads the daemon's configuration. Providers
 * have no realtime channel yet, so the surface polls while it is watched and
 * stops the moment nobody is.
 */
const PROVIDERS_POLL_INTERVAL_MS = 4_000;

export function kissopenAgentProvidersStoreCreate(
    deps: KissopenAgentProvidersStoreDeps,
): KissopenAgentProvidersStore {
    const store = createStore<KissopenAgentProvidersSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    /** Providers whose requested change the daemon has not answered yet. */
    const saving = new Set<string>();
    const customRequests = new Set<AbortController>();
    let disposed = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timerCancel = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };

    const schedule = (): void => {
        if (disposed || listeners.size === 0 || timer !== undefined) return;
        timer = setTimeout(() => {
            timer = undefined;
            load();
        }, PROVIDERS_POLL_INTERVAL_MS);
    };

    /**
     * Replaces the list with the one the daemon has just confirmed. Rows the
     * answer leaves unchanged keep their identity, so a poll every few seconds
     * does not replace every card in the category.
     */
    const settle = (catalog: KissopenAgentModelCatalog): void => {
        const current = store.getState();
        const providers = referencesPreserve(
            current.providers,
            catalog.providers.map((provider) => providerEntry(provider, saving.has(provider.id))),
        );
        const { error: _cleared, ...rest } = current;
        store.setState({ ...rest, providers, loading: false }, true);
        deps.catalogChanged?.(catalog);
    };

    /** Re-marks the rows waiting on an answer without re-reading the daemon. */
    const savingPublish = (): void => {
        const current = store.getState();
        const providers = referencesPreserve(
            current.providers,
            current.providers.map((provider) =>
                provider.saving === saving.has(provider.id)
                    ? provider
                    : { ...provider, saving: saving.has(provider.id) },
            ),
        );
        if (providers === current.providers) return;
        store.setState({ providers }, false);
    };

    const load = (): void => {
        if (disposed || listeners.size === 0 || controller !== undefined) return;
        timerCancel();
        const currentController = new AbortController();
        controller = currentController;
        void deps.client.getConfig({ signal: currentController.signal }).then(
            (response) => {
                if (disposed || controller !== currentController) return;
                controller = undefined;
                settle(kissopenAgentModelCatalogProject(response.config));
                schedule();
            },
            (error: unknown) => {
                if (
                    disposed ||
                    controller !== currentController ||
                    currentController.signal.aborted
                )
                    return;
                controller = undefined;
                // A failed refresh never empties a list the daemon has already
                // answered: only the first read has nothing to keep, and it owns
                // the error surface.
                if (store.getState().loading)
                    store.setState({ error: kissopenAgentUserError(error), loading: false }, false);
                schedule();
            },
        );
    };

    const connectionMutation = async (
        providerId: string,
        run: (mutationId: string, signal: AbortSignal) => Promise<ConfigResponse>,
    ): Promise<void> => {
        if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
        if (saving.has(providerId))
            throw new Error("This provider is already being updated. Please wait.");
        const request = new AbortController();
        customRequests.add(request);
        saving.add(providerId);
        savingPublish();
        timerCancel();
        controller?.abort();
        controller = undefined;
        try {
            const response = await run(crypto.randomUUID(), request.signal);
            saving.delete(providerId);
            if (!disposed) settle(kissopenAgentModelCatalogProject(response.config));
        } catch (error) {
            throw kissopenAgentUserError(error);
        } finally {
            saving.delete(providerId);
            customRequests.delete(request);
            if (!disposed) savingPublish();
            schedule();
        }
    };

    return {
        get: () => store.getState(),
        async customProviderRead(providerId, signal) {
            if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
            const request = new AbortController();
            customRequests.add(request);
            try {
                return await deps.client.getCustomProvider(providerId, {
                    signal: AbortSignal.any([signal, request.signal]),
                });
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                customRequests.delete(request);
            }
        },
        async customProviderDiscoverExisting(providerId, input, signal) {
            if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
            const request = new AbortController();
            customRequests.add(request);
            try {
                return await deps.client.discoverExistingCustomProvider(providerId, input, {
                    signal: AbortSignal.any([signal, request.signal]),
                });
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                customRequests.delete(request);
            }
        },
        customProviderUpdate: (providerId, input) =>
            connectionMutation(providerId, (mutationId, signal) =>
                deps.client.updateCustomProvider(providerId, { ...input, mutationId }, { signal }),
            ),
        customProviderDelete: (providerId) =>
            connectionMutation(providerId, (mutationId, signal) =>
                deps.client.deleteCustomProvider(providerId, { mutationId }, { signal }),
            ),
        async customProviderDiscover(input, signal) {
            if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
            const request = new AbortController();
            customRequests.add(request);
            try {
                return await deps.client.discoverCustomProvider(input, {
                    signal: AbortSignal.any([signal, request.signal]),
                });
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                customRequests.delete(request);
            }
        },
        async customProviderSave(input) {
            if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
            const request = new AbortController();
            customRequests.add(request);
            timerCancel();
            controller?.abort();
            controller = undefined;
            try {
                const response = await deps.client.saveCustomProvider(
                    { ...input, mutationId: crypto.randomUUID() },
                    { signal: request.signal },
                );
                if (!disposed) settle(kissopenAgentModelCatalogProject(response.config));
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                customRequests.delete(request);
                schedule();
            }
        },
        async customProviderReasoningUpdate(providerId, input) {
            if (disposed) throw new Error("The local KissOpen Agent is unavailable.");
            const request = new AbortController();
            customRequests.add(request);
            timerCancel();
            controller?.abort();
            controller = undefined;
            try {
                const response = await deps.client.updateCustomProviderReasoning(
                    providerId,
                    { ...input, mutationId: crypto.randomUUID() },
                    { signal: request.signal },
                );
                if (!disposed) settle(kissopenAgentModelCatalogProject(response.config));
            } catch (error) {
                throw kissopenAgentUserError(error);
            } finally {
                customRequests.delete(request);
                schedule();
            }
        },
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            if (listeners.size === 1) load();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size !== 0) return;
                timerCancel();
                controller?.abort();
                controller = undefined;
            };
        },
        providerEnabledUpdate(providerId, enabled) {
            if (disposed || saving.has(providerId)) return;
            saving.add(providerId);
            const { saveError: _cleared, ...rest } = store.getState();
            store.setState(rest, true);
            savingPublish();
            // The poll would otherwise land mid-write and show the configuration
            // from before the change as though the change had not been made.
            timerCancel();
            controller?.abort();
            controller = undefined;
            void deps.client.patchConfig({ providers: { [providerId]: { enabled } } }).then(
                (response) => {
                    if (disposed) return;
                    saving.delete(providerId);
                    settle(kissopenAgentModelCatalogProject(response.config));
                    schedule();
                },
                (error: unknown) => {
                    if (disposed) return;
                    saving.delete(providerId);
                    savingPublish();
                    store.setState({ saveError: kissopenAgentUserError(error) }, false);
                    schedule();
                },
            );
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            timerCancel();
            controller?.abort();
            controller = undefined;
            saving.clear();
            for (const request of customRequests) request.abort();
            customRequests.clear();
            listeners.clear();
        },
    };
}

function providerEntry(
    provider: KissopenAgentModelProvider,
    saving: boolean,
): KissopenAgentProviderEntry {
    return { ...provider, saving };
}

const INERT_SNAPSHOT: KissopenAgentProvidersSnapshot = { providers: [], loading: false };

/**
 * The providers of a Kissopen Agent this window cannot reach. It is permanently
 * empty and settled, so the category says the machine is unavailable instead of
 * claiming it has no providers.
 */
export const kissopenAgentProvidersStoreNoop: KissopenAgentProvidersStore = {
    customProviderRead: () => Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    customProviderDiscoverExisting: () =>
        Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    customProviderUpdate: () =>
        Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    customProviderDelete: () =>
        Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    get: () => INERT_SNAPSHOT,
    subscribe: () => () => undefined,
    providerEnabledUpdate: () => undefined,
    customProviderDiscover: () =>
        Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    customProviderSave: () => Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    customProviderReasoningUpdate: () =>
        Promise.reject(new Error("The local KissOpen Agent is unavailable.")),
    [Symbol.dispose]: () => undefined,
};
