import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";

/** A `kissopen-desktop-state` handle whose owner must release it. */
type Disposable = { [Symbol.dispose](): void };

/**
 * Leases one disposable `kissopen-desktop-state` handle for as long as a surface needs it,
 * re-leasing when `key` changes and releasing on unmount.
 *
 * `kissopen-desktop-state` hands out per-entity handles that the holder must dispose, and a
 * React component's mount lifetime is the only thing that knows when a surface
 * has stopped needing one. That is a genuine imperative lifetime boundary with no
 * declarative or event-driven equivalent, which is why this file — and only this
 * file — keeps a layout effect. Every surface that needs a lease calls this
 * instead of repeating the acquire/dispose dance, so the exception exists once
 * and is reviewable in one place.
 *
 * The leased handle is held in a tiny external store rather than React state, so
 * the application layer keeps no product state of its own and the value is read
 * back through `useSyncExternalStore` like every other snapshot.
 *
 * `key` is the identity of the thing being leased. A changed key disposes the
 * previous handle before acquiring the next, and an `undefined` key means the
 * surface wants nothing leased. Only the key decides when to re-lease, so
 * `acquire` may be an inline closure without causing a lease per render.
 */
export function useDisposableLease<Handle extends Disposable>(
    key: string | undefined,
    acquire: () => Handle,
): Handle | undefined {
    // Identity contract: this box is the subscription target for the whole
    // mounted lifetime. Recreating it would drop the listener and the handle, so
    // it is memoized on no dependencies rather than left to render memoization.
    const box = useMemo(() => leaseBoxCreate<Handle>(), []);
    const handle = useSyncExternalStore(box.subscribe, box.get, box.get);
    // eslint-disable-next-line kissopen-react/no-layout-effect -- acquiring and releasing a disposable state handle is an imperative lifetime boundary with no declarative equivalent; cleanup is complete
    useLayoutEffect(() => {
        if (key === undefined) return;
        const leased = acquire();
        box.set(leased);
        return () => {
            leased[Symbol.dispose]();
            box.set(undefined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` alone is the lease identity; `acquire` is an inline closure rebuilt every render and must not re-lease
    }, [key, box]);
    // The lease is taken after render, so the handle trails the key by one commit.
    // Reporting a handle while the key is absent would hand back the old lease.
    return key === undefined ? undefined : handle;
}

interface LeaseBox<Handle> {
    get(): Handle | undefined;
    set(value: Handle | undefined): void;
    subscribe(listener: () => void): () => void;
}

/** A one-slot external store, so the leased handle never lives in React state. */
function leaseBoxCreate<Handle>(): LeaseBox<Handle> {
    let current: Handle | undefined;
    const listeners = new Set<() => void>();
    return {
        get: () => current,
        set(value) {
            if (current === value) return;
            current = value;
            for (const listener of listeners) listener();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
