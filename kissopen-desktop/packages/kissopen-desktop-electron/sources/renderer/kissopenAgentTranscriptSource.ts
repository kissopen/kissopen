import type {
    KissopenAgentAnsweredUserInput,
    KissopenAgentChatTranscriptConnect,
    KissopenAgentConnection,
} from "kissopen-desktop-state";

const NO_ANSWERED_INPUTS: readonly KissopenAgentAnsweredUserInput[] = [];

/**
 * Adapts one Kissopen Agent session subscription to the retained chat store.
 *
 * Reconnection, gap recovery, and transcript hydration belong to the shared
 * connection itself. This boundary supplies the state package's answer-history
 * slot, which the current agent API does not expose independently.
 */
export function kissopenAgentTranscriptConnectCreate(
    connection: KissopenAgentConnection,
): KissopenAgentChatTranscriptConnect {
    return (options) => {
        const session = connection.connectSession({
            sessionId: options.sessionId,
            onChange: (elements, state) => options.onChange(elements, state, NO_ANSWERED_INPUTS),
            onError: options.onError,
        });
        return {
            close: () => session.close(),
            loadMore: (token) => session.loadMore(token),
        };
    };
}
