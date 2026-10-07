import type {
    KissopenAgentNavigationOrderDocument,
    KissopenAgentNavigationOrderPersistence,
} from "kissopen-desktop-state";

const NAVIGATION_ORDER_KEY = "kissopen.sidebar-order.v1";

/**
 * Where the order the reader arranged the sidebar's pinned rows in is kept on
 * this machine. It is the window's, not a Kissopen Agent's: the inbox and development tools are here
 * whether or not any machine is reachable, so an arrangement that lived inside a
 * connection would come undone every time one went away.
 */
export function desktopNavigationOrderPersistence(): KissopenAgentNavigationOrderPersistence {
    return {
        read() {
            try {
                const value = localStorage.getItem(NAVIGATION_ORDER_KEY);
                return value
                    ? (JSON.parse(value) as KissopenAgentNavigationOrderDocument)
                    : undefined;
            } catch {
                return undefined;
            }
        },
        write(document) {
            try {
                localStorage.setItem(NAVIGATION_ORDER_KEY, JSON.stringify(document));
            } catch {
                // A storage-denied renderer still keeps the arrangement for as
                // long as the window stays open.
            }
        },
    };
}
