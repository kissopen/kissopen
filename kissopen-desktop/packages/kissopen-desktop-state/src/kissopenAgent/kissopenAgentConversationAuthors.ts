import { t } from "../i18n/locale.js";
import type { ConversationAuthor } from "../conversation/conversationAuthor.js";
import type { ConversationSummary } from "../conversation/conversationSummary.js";
import type { KissopenAgentSessionSummary } from "./kissopenAgentTypes.js";

/** Stable identity of the machine owner. */
export const kissopenAgentOwnerAuthor: ConversationAuthor = {
    id: "kissopen-agent:owner",
    displayName: "You",
    username: "you",
    kind: "human",
};

/** Stable identity of an agent-authored message projected into the human lane. */
export const kissopenAgentInboundAuthor: ConversationAuthor = {
    id: "kissopen-agent:inbound",
    displayName: "Agent",
    username: "agent",
    kind: "human",
};

/**
 * Stable identity of the agent running a conversation that has no assistant of
 * its own: the product, drawn as its mark beside its name. The name is read
 * when used rather than when this module loads, so it is always in the
 * window's language.
 */
export const agentAuthor: ConversationAuthor = {
    id: "kissopen-agent:agent",
    get displayName() {
        return t("KissOpen");
    },
    username: "kissopen",
    kind: "agent",
    agentRole: "default",
    brand: true,
};

/** The assistant a conversation belongs to, as its session reports it. */
export interface KissopenAgentAssistantIdentity {
    readonly name: string;
    readonly username: string;
    /** The assistant's picture, when it has one. */
    readonly avatarUrl?: string;
}

const assistantAuthors = new WeakMap<KissopenAgentAssistantIdentity, ConversationAuthor>();

/**
 * The author of an agent message: the conversation's own assistant, under its
 * name and picture, or the product when it has none. The id stays the agent's
 * one id either way — it is still this conversation's agent speaking — and the
 * same identity yields the same object, so a projection compares it cheaply.
 */
export function kissopenAgentAgentAuthor(
    assistant: KissopenAgentAssistantIdentity | undefined,
): ConversationAuthor {
    if (assistant === undefined) return agentAuthor;
    const cached = assistantAuthors.get(assistant);
    if (cached !== undefined) return cached;
    const author: ConversationAuthor = {
        id: agentAuthor.id,
        displayName: assistant.name,
        username: assistant.username,
        kind: "agent",
        agentRole: "default",
        ...(assistant.avatarUrl === undefined ? {} : { imageUrl: assistant.avatarUrl }),
    };
    assistantAuthors.set(assistant, author);
    return author;
}

/** True for a person-authored turn, excluding agent news projected into that lane. */
export function kissopenAgentHumanMessageAuthor(author: ConversationAuthor | undefined): boolean {
    return (
        author?.kind === "human" &&
        author.id !== kissopenAgentInboundAuthor.id &&
        !author.id.startsWith(`${kissopenAgentInboundAuthor.id}:`)
    );
}

export type KissopenAgentConversationSummaryInput = Omit<
    KissopenAgentSessionSummary,
    "projectId" | "worktreeId"
>;

function summaryTitle(session: KissopenAgentConversationSummaryInput): string {
    if (session.title && session.title.trim().length > 0) return session.title;
    if (session.recap && session.recap.trim().length > 0) return session.recap;
    return `Session ${session.id.slice(0, 8)}`;
}

/**
 * How live one session reads in a list. A session is working when its own turn
 * is running and equally when it is only its delegated agents that still are:
 * work handed to a child is work this session set in motion, so the row keeps
 * its marker until nothing of the session's is running anywhere.
 *
 * A scheduled wait is the low-priority modifier it has always been, and it only
 * describes the session's own turn — a session sitting in a wait while its
 * children work is working, not waiting.
 */
function summaryActivity(
    session: KissopenAgentConversationSummaryInput,
): ConversationSummary["activity"] {
    // Read or not, a chat whose turn is parked on an unanswered question is
    // waiting for the person; shown as idle, it read as finished.
    if (session.awaitingAnswer || session.unreadReason === "attention_needed")
        return "awaitingInput";
    if (session.activeSubagentCount > 0) return "running";
    if (session.status !== "running" && session.status !== "queued") return "idle";
    return session.wait === undefined ? "running" : "waiting";
}

/** Projects one Kissopen Agent session into the shared conversation-list row. */
export function kissopenAgentConversationSummaryProject(
    session: KissopenAgentConversationSummaryInput,
): ConversationSummary {
    const activity = summaryActivity(session);
    return {
        id: session.id,
        title: summaryTitle(session),
        subtitle: session.displayCwd || session.cwd,
        ...(session.recap?.trim() ? { recap: session.recap.trim() } : {}),
        activity,
        updatedAt: session.lastMessageAt ?? session.updatedAt,
        ...(session.unreadReason === undefined ? {} : { unread: true }),
        participants: [kissopenAgentOwnerAuthor, agentAuthor],
    };
}
