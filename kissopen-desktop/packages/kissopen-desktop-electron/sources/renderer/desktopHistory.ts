import type {
    KissopenAgentHistoryDocument,
    KissopenAgentHistoryPersistence,
} from "kissopen-desktop-app";

const HISTORY_KEY = "kissopen.router-history.v1";

/**
 * Where this window's navigation stack is kept between runs, so reopening lands
 * back on the conversation the reader was in. What comes back is whatever is
 * under that key — an older build's, truncated, hand-edited — so it is handed
 * over as `unknown` for the window owning the stack to parse.
 */
export function desktopHistoryPersistence(): KissopenAgentHistoryPersistence {
    return {
        read(): unknown {
            try {
                const value = localStorage.getItem(HISTORY_KEY);
                return value === null ? undefined : (JSON.parse(value) as unknown);
            } catch {
                return undefined;
            }
        },
        write(document: KissopenAgentHistoryDocument) {
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(document));
            } catch {
                // A storage-denied renderer still navigates; it simply opens at
                // its default address next time.
            }
        },
    };
}
