import { lazy, Suspense } from "react";

/**
 * The Blueprint component workbench, mounted inside the app so a development
 * build can browse every component page without a second dev server. It is the
 * same workbench the standalone Blueprint serves and owns all of its own visuals,
 * so this view only places it in the content area.
 *
 * The workbench is loaded lazily: it pulls in every component page and its
 * fixtures, and nothing but this development-only screen ever asks for them.
 */
const Workbench = lazy(async () => ({
    default: (await import("kissopen-desktop-ui/blueprint")).Workbench,
}));

export function BlueprintView() {
    return (
        <Suspense fallback={null}>
            {/* The window's address belongs to its own router, so the workbench
                keeps its page selection to itself rather than writing a hash. */}
            <Workbench hashAddressed={false} />
        </Suspense>
    );
}
