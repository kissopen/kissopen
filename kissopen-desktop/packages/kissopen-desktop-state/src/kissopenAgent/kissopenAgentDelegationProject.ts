import type {
    ConversationDelegationEntry,
    ConversationEntry,
} from "../conversation/conversationEntry.js";
import type { SubagentSummary } from "./kissopenAgentTypes.js";

export type PlaceableSubagent = SubagentSummary & {
    readonly parentToolCallId: string;
};

/**
 * Direct children which can be placed on exactly one parent tool row.
 *
 * A missing parent id has no transcript location. More than one direct child
 * claiming the same call, or more than one row reusing that call id, is
 * ambiguous. Every such row deliberately stays an ordinary tool row instead of
 * silently hiding children or attaching one child to several historical calls.
 */
export function kissopenAgentDelegatedChildrenByRow(input: {
    readonly parentSessionId: string;
    readonly parentToolCalls: readonly {
        readonly rowId: string;
        readonly toolCallId: string;
    }[];
    readonly subagents: readonly SubagentSummary[];
}): ReadonlyMap<string, PlaceableSubagent> {
    const rowByToolCall = new Map<string, string>();
    const ambiguousToolCalls = new Set<string>();
    for (const parent of input.parentToolCalls) {
        if (rowByToolCall.has(parent.toolCallId)) {
            ambiguousToolCalls.add(parent.toolCallId);
            continue;
        }
        rowByToolCall.set(parent.toolCallId, parent.rowId);
    }

    const childByToolCall = new Map<string, PlaceableSubagent>();
    for (const subagent of input.subagents) {
        const parentToolCallId = subagent.parentToolCallId;
        if (
            subagent.parentSessionId !== input.parentSessionId ||
            parentToolCallId === undefined ||
            !rowByToolCall.has(parentToolCallId)
        )
            continue;
        if (childByToolCall.has(parentToolCallId)) {
            ambiguousToolCalls.add(parentToolCallId);
            continue;
        }
        childByToolCall.set(parentToolCallId, { ...subagent, parentToolCallId });
    }

    const childByRow = new Map<string, PlaceableSubagent>();
    for (const [toolCallId, child] of childByToolCall) {
        if (ambiguousToolCalls.has(toolCallId)) continue;
        const rowId = rowByToolCall.get(toolCallId);
        if (rowId) childByRow.set(rowId, child);
    }
    return childByRow;
}

/** Replaces one spawn tool row without changing that row's render identity. */
export function kissopenAgentDelegationEntryProject(
    child: PlaceableSubagent,
    parent: Pick<Exclude<ConversationEntry, { kind: "message" }>, "id" | "sequence">,
): ConversationDelegationEntry {
    return {
        kind: "delegation",
        id: parent.id,
        sequence: parent.sequence,
        child: {
            sessionId: child.id,
            parentToolCallId: child.parentToolCallId,
            description: child.description,
            ...(child.taskName === undefined ? {} : { taskName: child.taskName }),
            modelId: child.modelId,
            status: child.status,
            createdAt: child.createdAt,
            ...(child.activeSince === undefined ? {} : { activeSince: child.activeSince }),
            ...(child.elapsedMs === undefined ? {} : { elapsedMs: child.elapsedMs }),
            ...(child.totalTokens === undefined ? {} : { totalTokens: child.totalTokens }),
        },
    };
}
