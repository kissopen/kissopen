import type { DotLottieWorker } from "@lottiefiles/dotlottie-web";
// Vite emits the ThorVG binary as an ordinary build asset and hands back its
// local URL. The renderer must never reach a CDN for it: the desktop window's
// Content-Security-Policy allows `script-src 'self' 'wasm-unsafe-eval'` and
// nothing off-origin, and art that needs the network is art that is missing
// when the network is.
import wasmUrl from "@lottiefiles/dotlottie-web/dotlottie-player.wasm?url";

/**
 * Every scene on the screen shares this one worker. dotLottie keys its worker
 * pool by id, so a second empty state does not mean a second thread, a second
 * WASM instantiation, or a second copy of the runtime's heap.
 */
export const LOTTIE_WORKER_ID = "kissopen-empty-state";

/**
 * Frames are drawn on a worker thread against an OffscreenCanvas. The main
 * thread hands over the canvas once and afterwards only sends play, pause, and
 * seek; it runs no timer, no requestAnimationFrame loop, and no per-frame React
 * render, which is the whole reason this renderer was chosen over lottie-web.
 */
type Runtime = { DotLottieWorker: typeof DotLottieWorker };

let pending: Promise<Runtime> | undefined;

/**
 * Makes a bundler-emitted asset path absolute against the page.
 *
 * Both the WASM binary and the animation JSON are fetched by code running
 * inside a Blob-URL worker, whose own base URL is `blob:` and therefore resolves
 * nothing. A root-relative path that works perfectly on the page throws
 * "Failed to parse URL" in there. Worse, dotLottie answers a failed WASM fetch
 * by silently retrying against unpkg.com, so a path this function did not fix
 * would not fail loudly — it would quietly start loading Kissopen's renderer from
 * a CDN.
 */
export function assetUrlAbsolute(url: string): string {
    return new URL(url, globalThis.location.href).href;
}

/**
 * Loads the worker runtime once and hands the same promise to every later
 * caller. Nothing here runs at import time: the ~150 KB of runtime JavaScript
 * and the 1.8 MB WASM binary are fetched the first time a screen is actually
 * empty, and never on a screen that has something to show.
 */
export function dotLottieRuntimeLoad(): Promise<Runtime> {
    pending ??= import("@lottiefiles/dotlottie-web").then((module) => {
        module.DotLottieWorker.setWasmUrl(assetUrlAbsolute(wasmUrl));
        return { DotLottieWorker: module.DotLottieWorker };
    });
    return pending;
}

/**
 * The reduced-motion preference as an external store, so a component can read
 * it with `useSyncExternalStore` instead of mirroring it into React state, and
 * so playback and rendering answer to the same source.
 *
 * The preference decides more than playback: under it a scene is a still
 * picture with no replay control at all, which is a rendering decision and has
 * to be available while rendering. One `MediaQueryList` is shared by every
 * subscriber, and it is created lazily so importing this module touches
 * nothing. jsdom and older engines have no `matchMedia`; a scene that cannot
 * ask treats the answer as "no preference" and animates.
 */
let motionQuery: MediaQueryList | null | undefined;

function reducedMotionList(): MediaQueryList | null {
    motionQuery ??=
        typeof globalThis.matchMedia === "function"
            ? globalThis.matchMedia("(prefers-reduced-motion: reduce)")
            : null;
    return motionQuery;
}

/** Subscribes to preference changes; returns the matching unsubscribe. */
export function reducedMotionSubscribe(onChange: () => void): () => void {
    const query = reducedMotionList();
    if (query === null) return () => {};
    query.addEventListener("change", onChange);
    return () => {
        query.removeEventListener("change", onChange);
    };
}

/** The preference right now. False wherever the question cannot be asked. */
export function reducedMotionGet(): boolean {
    return reducedMotionList()?.matches ?? false;
}

/**
 * The pixel ratio a scene renders at. Capped at 2 because a scene is at most
 * 128px on a side: past 2 the extra samples cost worker memory and fill rate
 * that no one can see, and a 3x display would otherwise quietly multiply the
 * buffer by 2.25 for nothing.
 */
export function scenePixelRatio(view: Window): number {
    return Math.min(view.devicePixelRatio || 1, 2);
}
