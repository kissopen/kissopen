import { createStore } from "zustand/vanilla";
import type { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";

/** One rate-limit or spend window a provider reports, as a share already spent. */
export interface KissopenAgentProviderUsageWindow {
    /** How much of the window is gone, 0–100. */
    readonly usedPercent: number;
    /** When the window starts over, in milliseconds. */
    readonly resetsAt?: number;
    /** When the current window began, in milliseconds. */
    readonly startsAt?: number;
    /** How long one window lasts, in milliseconds. */
    readonly durationMs?: number;
}

/** Money the account can still spend once its rate-limit window is used up. */
export interface KissopenAgentProviderUsageCredits {
    readonly available: boolean;
    readonly unlimited: boolean;
    readonly remainingCents?: number;
    readonly usedPercent?: number;
}

/** One provider reading, carrying plan quota or absolute token usage when reported. */
export interface KissopenAgentProviderUsageReading {
    /** When the daemon took this reading, in milliseconds. */
    readonly capturedAt: number;
    readonly planName?: string;
    /** True when every window this account has is spent. */
    readonly exhausted?: boolean;
    readonly fiveHour?: KissopenAgentProviderUsageWindow;
    readonly weekly?: KissopenAgentProviderUsageWindow;
    readonly monthly?: KissopenAgentProviderUsageWindow;
    readonly credits?: KissopenAgentProviderUsageCredits;
    /**
     * Absolute token counts reported by Kissopen Agent. These stay separated by
     * model because tokens from different models are not comparable.
     */
    readonly models?: readonly KissopenAgentProviderModelTokenUsage[];
}

export interface KissopenAgentProviderTokenCounts {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheWriteTokens: number;
}

export interface KissopenAgentProviderModelTokenUsage {
    readonly modelId: string;
    readonly hour?: KissopenAgentProviderTokenCounts;
    readonly day?: KissopenAgentProviderTokenCounts;
    readonly week?: KissopenAgentProviderTokenCounts;
    readonly month?: KissopenAgentProviderTokenCounts;
}

/**
 * One provider account as the usage surface shows it. A provider with no reading
 * is still listed: knowing an account is configured but unread is different from
 * not having it at all, and the reason lives on the same row.
 *
 * Display names come from the configured catalog. Stable provider IDs remain
 * the identity and accounting key, even when two accounts have the same label.
 */
export interface KissopenAgentProviderUsageEntry {
    readonly providerId: string;
    readonly name?: string;
    readonly usage?: KissopenAgentProviderUsageReading;
    /** When the daemon last tried this provider, in milliseconds. */
    readonly checkedAt?: number;
    /** Why the daemon's own last read of this provider failed. */
    readonly error?: string;
}

/**
 * One reading of every provider account, with how that read went.
 *
 * The daemon reports usage on request rather than pushing it, so the source
 * repeats the read for as long as something is watching. State says where that
 * cycle is: `loading` is only true before the first answer, and a later failure
 * leaves the readings already held in place, because a read that could not reach
 * the daemon does not make what we last saw untrue.
 */
export interface KissopenAgentProviderUsageSourceReading {
    readonly providers: readonly KissopenAgentProviderUsageEntry[];
    readonly loading: boolean;
    /** When the last successful read finished, in milliseconds. */
    readonly loadedAt?: number;
    /** Why the last attempt failed, when it failed. */
    readonly error?: string;
}

/**
 * The provider-usage feed for one Kissopen Agent. Subscribing starts the reading cycle and
 * releasing the last subscriber stops it, so a machine nobody is looking at is
 * not polled.
 */
export interface KissopenAgentProviderUsageSource {
    subscribe(
        listener: (reading: KissopenAgentProviderUsageSourceReading) => void,
        onError: (error: unknown) => void,
    ): () => void;
}

export interface KissopenAgentProviderUsageSnapshot {
    /** Every configured provider account, in the order the daemon reports them. */
    readonly providers: readonly KissopenAgentProviderUsageEntry[];
    /** True until the first reading arrives, so "no providers" is not claimed early. */
    readonly loading: boolean;
    /** When the last successful reading was taken, in milliseconds. */
    readonly loadedAt?: number;
    /** Set when the feed itself failed; the retained readings stay visible beneath it. */
    readonly error?: UserError;
}

export interface KissopenAgentProviderUsageStore {
    get(): KissopenAgentProviderUsageSnapshot;
    subscribe(listener: () => void): () => void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentProviderUsageStoreDeps {
    readonly source: KissopenAgentProviderUsageSource;
}

/**
 * How much of each provider account's plan this Kissopen Agent has spent, as one surface.
 *
 * The store owns no schedule of its own: the source repeats the daemon read
 * while anything is subscribed, and every reading it reports replaces the list
 * wholesale. There is nothing to act on here — usage is read, never changed — so
 * the store has no actions and emits no output, and the first subscriber
 * starting the cycle is what keeps a closed screen from polling a machine.
 */
export function kissopenAgentProviderUsageStoreCreate(
    deps: KissopenAgentProviderUsageStoreDeps,
): KissopenAgentProviderUsageStore {
    const store = createStore<KissopenAgentProviderUsageSnapshot>()(() => ({
        providers: [],
        loading: true,
    }));

    const listeners = new Set<() => void>();
    let unsubscribeSource: (() => void) | undefined;
    let disposed = false;

    const start = (): void => {
        if (disposed || unsubscribeSource) return;
        unsubscribeSource = deps.source.subscribe(
            (reading) => {
                if (disposed) return;
                const current = store.getState();
                const error =
                    reading.error === undefined
                        ? undefined
                        : current.error?.message === reading.error
                          ? current.error
                          : kissopenAgentUserError(reading.error);
                if (
                    current.providers === reading.providers &&
                    current.loading === reading.loading &&
                    current.loadedAt === reading.loadedAt &&
                    current.error === error
                )
                    return;
                store.setState(
                    {
                        providers: reading.providers,
                        loading: reading.loading,
                        ...(reading.loadedAt === undefined ? {} : { loadedAt: reading.loadedAt }),
                        ...(error === undefined ? {} : { error }),
                    },
                    true,
                );
            },
            (error) => {
                if (disposed) return;
                const current = store.getState();
                const failure = kissopenAgentUserError(error);
                if (current.loading === false && current.error?.message === failure.message) return;
                store.setState({ error: failure, loading: false }, false);
            },
        );
    };

    const stop = (): void => {
        unsubscribeSource?.();
        unsubscribeSource = undefined;
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            start();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size === 0) stop();
            };
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            stop();
            listeners.clear();
        },
    };
}

const INERT_SNAPSHOT: KissopenAgentProviderUsageSnapshot = { providers: [], loading: false };

/**
 * Usage for a Kissopen Agent that reports none. It is permanently empty and settled rather
 * than loading, so a surface that must subscribe unconditionally reads "nothing
 * to report" instead of waiting forever for a reading that is not coming.
 */
export const kissopenAgentProviderUsageStoreNoop: KissopenAgentProviderUsageStore = {
    get: () => INERT_SNAPSHOT,
    subscribe: () => () => undefined,
    [Symbol.dispose]: () => undefined,
};
