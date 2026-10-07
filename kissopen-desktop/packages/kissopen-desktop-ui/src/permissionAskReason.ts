import { t } from "kissopen-desktop-state";
import type { ConversationToolCall } from "kissopen-desktop-state";

/**
 * What the card says about a call the agent has stopped on.
 *
 * Deliberately a statement of fact rather than advice: nobody assessed this
 * call, so there is nothing to warn about and nothing to reassure with. It
 * says what is waiting and leaves the judgement to the reader.
 *
 * Written here because two places need the same string — the card renders it
 * and the virtualized transcript measures it to decide how tall the row is.
 * Two spellings would leave the row the wrong height.
 */
export function permissionAskReason(tool: ConversationToolCall): string {
    return t("{tool} is waiting for your decision before it runs.", {
        tool: tool.display ?? tool.toolName,
    });
}
