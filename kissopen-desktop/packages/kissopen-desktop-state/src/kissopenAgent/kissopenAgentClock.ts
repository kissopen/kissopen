/**
 * A tiny memory-only clock surface: a monotonically advancing "now" (epoch ms)
 * that React surfaces read to render relative timestamps without calling
 * `Date.now()` in render. It exists because relative times ("2m ago") must come
 * from observable state, not an impure render-time read; the ticking value is the
 * only thing this store owns.
 *
 * Following the state principles, the constructor opens no timer. The interval
 * starts on the first subscriber and stops on the last unsubscribe, so a
 * backgrounded surface with no subscribers does no work.
 */
export interface KissopenAgentClockStore {
    /** Current reference time in epoch milliseconds. */
    get(): number;
    subscribe(listener: () => void): () => void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentClockStoreOptions {
    /** Tick cadence in milliseconds; each tick republishes `now`. Defaults to 1s. */
    readonly intervalMs?: number;
    readonly now?: () => number;
    readonly setInterval?: (handler: () => void, milliseconds: number) => unknown;
    readonly clearInterval?: (handle: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 1_000;

/**
 * Creates a clock store. Timing is injectable so tests advance it deterministically
 * without real timers. Publishes a fresh `now` on every tick and notifies listeners
 * only when the value actually advanced.
 */
export function kissopenAgentClockStoreCreate(
    options: KissopenAgentClockStoreOptions = {},
): KissopenAgentClockStore {
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const now = options.now ?? Date.now;
    const startInterval =
        options.setInterval ?? ((handler, milliseconds) => setInterval(handler, milliseconds));
    const stopInterval =
        options.clearInterval ??
        ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));

    const listeners = new Set<() => void>();
    let current = now();
    let timer: unknown;
    let disposed = false;

    const tick = (): void => {
        const next = now();
        if (next === current) return;
        current = next;
        for (const listener of listeners) listener();
    };

    return {
        get: () => current,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1 && !disposed) {
                current = now();
                timer = startInterval(tick, intervalMs);
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0 && timer !== undefined) {
                    stopInterval(timer);
                    timer = undefined;
                }
            };
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            listeners.clear();
            if (timer !== undefined) {
                stopInterval(timer);
                timer = undefined;
            }
        },
    };
}
