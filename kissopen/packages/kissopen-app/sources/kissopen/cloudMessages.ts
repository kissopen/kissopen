import type { Message as DisplayMessage } from '@/sync/typesMessage';
import type { ConversationDetail } from './api/types';
import { t } from '@/text';

/** Project the server snapshot plus its subsequent deltas into Kissopen's renderer.
 * The last assistant row keeps its identity during streaming and completion. */
export function cloudMessages(conversation: ConversationDetail | undefined, liveText: string): DisplayMessage[] {
    if (!conversation) return [];
    const last = conversation.messages.length - 1;
    return conversation.messages.map((message, index) => ({
        kind: message.role === 'user' ? 'user-text' as const : 'agent-text' as const,
        id: message.id, localId: null, createdAt: index,
        text: index === last && message.role === 'assistant' && liveText
            ? liveText
            : message.content || (message.status === 'failed' ? t('kissopen.conversation.replyIncomplete') : message.status === 'cancelled' ? t('kissopen.conversation.generationStopped') : ''),
    }));
}
