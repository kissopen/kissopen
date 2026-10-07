import type { Plugin } from "vite";

/**
 * Keeps the public Vite integration boundary stable for consumers that compile
 * the desktop UI package.
 */
export function lottieLocalWasmPlugin(): Plugin {
    return { name: "kissopen-desktop-lottie-local-wasm" };
}
