import type {
    KissopenAgentSidebarCollapseDocument,
    KissopenAgentSidebarCollapsePersistence,
} from "kissopen-desktop-state";

const SIDEBAR_COLLAPSE_KEY = "kissopen.sidebar-collapse.v1";

/**
 * Where the sidebar rows the reader folded shut are kept on this machine. It is
 * the window's record, not a KISSOPEN Agent's: a project folded away is folded away whether
 * or not the machine holding it is answering, and a fold that lived inside a
 * connection would unfold itself every time one dropped.
 */
export function desktopSidebarCollapsePersistence(): KissopenAgentSidebarCollapsePersistence {
    return {
        read() {
            try {
                const value = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
                return value
                    ? (JSON.parse(value) as KissopenAgentSidebarCollapseDocument)
                    : undefined;
            } catch {
                return undefined;
            }
        },
        write(document) {
            try {
                localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(document));
            } catch {
                // A storage-denied renderer still keeps the folding for as long
                // as the window stays open.
            }
        },
    };
}
