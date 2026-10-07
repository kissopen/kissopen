import type { UserError } from "../types.js";
import type { ConversationAuthor } from "./conversationAuthor.js";
import type { Loadable } from "./loadable.js";

/**
 * One row of a conversation list. `subtitle` is the second line a reader needs
 * to tell two similar conversations apart — the working directory for a local
 * session, the participants or last message for a shared chat — and `activity`
 * is the live marker every agent-driven conversation wants regardless of stack.
 */
export interface ConversationSummary {
    readonly id: string;
    readonly title: string;
    readonly subtitle?: string;
    /** What the conversation came to, in the host's own words, when it has said. */
    readonly recap?: string;
    readonly activity: "running" | "awaitingInput" | "waiting" | "idle";
    /** Epoch milliseconds of the newest content, for relative timestamps. */
    readonly updatedAt: number;
    readonly unread?: boolean;
    readonly mentions?: number;
    readonly avatarFileId?: string;
    readonly participants: readonly ConversationAuthor[];
}

/**
 * The immutable list surface: what is loaded and what failed. Which conversation
 * is open is deliberately absent — that is addressed by the URL and owned by the
 * router, so no list store carries a competing selection.
 */
export interface ConversationListSnapshot {
    readonly conversations: Loadable<readonly ConversationSummary[]>;
    /** Last failed create/fork/reset, surfaced without rejecting the action. */
    readonly mutationError?: UserError;
}
