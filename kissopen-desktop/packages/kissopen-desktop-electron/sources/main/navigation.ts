import type { DesktopRuntimeSnapshot } from "../shared/desktopContract";

/** Allows only the packaged renderer document, or the configured development origin. */
export function rendererNavigationAllowed(
    candidateValue: string,
    rendererValue: string,
    development: boolean,
): boolean {
    try {
        const candidate = new URL(candidateValue);
        const renderer = new URL(rendererValue);
        if (development) return candidate.origin === renderer.origin;
        return (
            candidate.protocol === "file:" &&
            candidate.host === renderer.host &&
            candidate.pathname === renderer.pathname &&
            candidate.search === renderer.search
        );
    } catch {
        return false;
    }
}

/** Allows the hosted local renderer to remain on its one build-pinned HTTPS origin. */
export function localWebNavigationAllowed(candidateValue: string, rendererOrigin: string): boolean {
    try {
        const candidate = new URL(candidateValue);
        return candidate.protocol === "https:" && candidate.origin === rendererOrigin;
    } catch {
        return false;
    }
}

export type DesktopWindowTarget = { key: "local"; kind: "local" };

/** The desktop product always renders its local Kissopen Agent client. */
export function desktopWindowTarget(_snapshot: DesktopRuntimeSnapshot): DesktopWindowTarget {
    return { key: "local", kind: "local" };
}
