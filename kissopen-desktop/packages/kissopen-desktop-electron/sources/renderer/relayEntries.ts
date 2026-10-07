/*
A relay conversation, in the transcript vocabulary the window already draws.

Both halves of this desktop end at `ConversationEntry`: the local Agent reaches
it through the daemon projection, and a relay session reaches it through here.
That is what lets one conversation component draw both — a tool call from
another machine is the same kind of row as a tool call from this one, and was
never going to be honestly represented as a line of text.

Reasoning, tool calls and their results become activity rows. Text becomes
messages. Nothing is flattened into prose on the way.
*/
import { messageSortKey } from "@kissopen/kissopen-sync/typesMessage";
import type { Message, ToolCall } from "@kissopen/kissopen-sync/typesMessage";
import type { AgentState } from "@kissopen/kissopen-sync/storageTypes";
import type { RelayTurn } from "../shared/relayContract";
import type {
    ConversationActivityStatus,
    ConversationAuthor,
    ConversationEntry,
    ConversationToolCall,
} from "kissopen-desktop-state";
import {
    SCHEDULED_TASK_CREATE_TOOL,
    scheduleProposalFailed,
    scheduledTaskOutcomeParse,
    t,
} from "kissopen-desktop-state";

/*
The reader, as the transcript identifies them.

A message needs an author with this id for the view to treat it as the
reader's own — sender-less rows are drawn as somebody unknown, on the wrong
side. The id is a constant rather than the account's: a relay conversation is
read by whoever holds this window, and every message in it that is not the
agent's is theirs.
*/
export const RELAY_VIEWER_ID = "relay-viewer";

export const READER_AUTHOR = {
    id: RELAY_VIEWER_ID,
    displayName: t("你"),
    username: "you",
    kind: "human" as const,
};

/**
 * The agent side of a relay conversation when the product itself speaks — the
 * cloud assistant, or a conversation with no assistant of its own: the 卷 mark
 * beside the product's name, read in the window's language when used.
 */
export const AGENT_AUTHOR: ConversationAuthor = {
    id: "kissopen-agent",
    get displayName() {
        return t("KissOpen");
    },
    username: "kissopen",
    kind: "agent",
    brand: true,
};

/**
 * Who a relay conversation's agent messages are from. A cloud conversation is
 * the product's own assistant; a conversation that belongs to an assistant on
 * a machine speaks under that assistant's name. The relay publishes no
 * assistant picture, so such an assistant shows its initials.
 */
export function relayAgentAuthor(input: {
    readonly cloud: boolean;
    readonly assistant?: { readonly name: string; readonly username: string };
}): ConversationAuthor {
    if (input.cloud || input.assistant === undefined) return AGENT_AUTHOR;
    return {
        id: AGENT_AUTHOR.id,
        displayName: input.assistant.name,
        username: input.assistant.username,
        kind: "agent",
    };
}

/**
 * Ordering key, in the space the transcript compares.
 *
 * Padded so string order is arrival order. Tool calls nest under the message
 * that made them in the shared model, and are flattened here in place, so a
 * child's key has to sort between its parent and whatever came next.
 */
export function sequenceOf(index: number, child = 0): string {
    return `${String(index).padStart(9, "0")}.${String(child).padStart(4, "0")}`;
}

function statusOf(tool: ToolCall): ConversationActivityStatus {
    // A call waiting on a person is not a call that is running: the reader can
    // act on one and only wait on the other, and the row says which.
    if (tool.permission?.status === "pending") return "awaitingApproval";
    if (tool.state === "running") return "running";
    return tool.state === "error" ? "failed" : "success";
}

function toolOf(tool: ToolCall, id: string): ConversationToolCall {
    // A task the agent created reports in its result, which is where its
    // outcome is read from; the row draws it the way this computer's does.
    const scheduled =
        tool.name === SCHEDULED_TASK_CREATE_TOOL && tool.state !== "running"
            ? scheduledTaskOutcomeParse(tool.result)
            : undefined;
    return {
        toolCallId: tool.callId ?? id,
        toolName: tool.name,
        arguments: (tool.input ?? {}) as ConversationToolCall["arguments"],
        status: statusOf(tool),
        failed: tool.state === "error",
        // A picture the tool made travels with its result on the phone's wire;
        // it is the one typed presentation that crosses the relay.
        ...(tool.presentation?.type === "image_generation"
            ? {
                  presentation: {
                      type: "imageGeneration" as const,
                      path: tool.presentation.path,
                      mediaType: tool.presentation.mediaType,
                      bytes: tool.presentation.bytes,
                      width: tool.presentation.width,
                      height: tool.presentation.height,
                      preview: `data:image/webp;base64,${tool.presentation.preview}`,
                  },
              }
            : scheduled
              ? { presentation: { type: "scheduledTask" as const, outcome: scheduled } }
              : {}),
        ...(tool.title || tool.description
            ? { display: tool.title ?? tool.description ?? "" }
            : {}),
    };
}

/**
 * Turns one reduced conversation into transcript rows.
 *
 * `sessionId` names the conversation every row belongs to; the window uses it
 * as the transcript's lifetime boundary.
 */
export function relayEntries(
    messages: readonly Message[],
    sessionId: string,
    agentState?: AgentState | null,
    turns?: readonly RelayTurn[],
    /** True while the relay says the conversation is working. */
    running = false,
    /** Who the agent's messages are from; the product unless given. */
    agentAuthor: ConversationAuthor = AGENT_AUTHOR,
): ConversationEntry[] {
    const entries: ConversationEntry[] = [];

    /*
     * Ordered the way the shared core orders a conversation, not the way the
     * reducer happened to return it. Using array position put a turn's tool
     * calls after everything that followed the turn — work from ten minutes
     * ago reading as the newest thing on screen.
     */
    const ordered = [...messages].sort((a, b) => messageSortKey(a) - messageSortKey(b));

    ordered.forEach((message, index) => {
        if (message.kind === "agent-text" && message.meta?.usageLimit !== undefined) {
            entries.push({
                kind: "notice",
                variant: "notice",
                level: "error",
                id: message.id,
                sequence: sequenceOf(index),
                text: message.text,
                usageLimit: message.meta.usageLimit,
            });
            return;
        }
        if (message.kind === "tool-call") {
            // A retired proposal the agent tried and recovered from shows nothing.
            if (scheduleProposalFailed(message.tool.name, message.tool.state === "error")) return;
            entries.push({
                kind: "agentActivity",
                id: message.id,
                sequence: sequenceOf(index),
                occurredAt: message.createdAt,
                activity: { kind: "tool", tool: toolOf(message.tool, message.id) },
            });
            // A tool call's children are its nested work, and they belong under
            // it in the order they happened rather than after the whole turn.
            message.children.forEach((child, childIndex) => {
                if (child.kind !== "tool-call") return;
                entries.push({
                    kind: "agentActivity",
                    id: child.id,
                    sequence: sequenceOf(index, childIndex + 1),
                    occurredAt: child.createdAt,
                    activity: { kind: "tool", tool: toolOf(child.tool, child.id) },
                });
            });
            return;
        }

        if (message.kind === "agent-text" && message.isThinking) {
            // Reasoning is not something the agent said to the reader; it is
            // work, and the transcript already has a row for work.
            entries.push({
                kind: "agentActivity",
                id: message.id,
                sequence: sequenceOf(index),
                occurredAt: message.createdAt,
                activity: {
                    kind: "reasoning",
                    text: message.text,
                    streaming: message.streaming === true && running,
                },
            });
            return;
        }

        if (message.kind === "agent-event") {
            // Events this build has no opinion about keep their place without
            // pretending to be speech.
            entries.push({
                kind: "notice",
                variant: "notice",
                level: "info",
                id: message.id,
                sequence: sequenceOf(index),
                text: message.event.type ?? "",
            });
            return;
        }

        const text = message.kind === "user-text" ? userText(message) : message.text;
        entries.push({
            kind: "message",
            source: "server",
            delivery: "sent",
            message: {
                id: message.id,
                chatId: sessionId,
                sessionId,
                sequence: sequenceOf(index),
                changePts: message.id,
                sender: message.kind === "user-text" ? READER_AUTHOR : agentAuthor,
                text,
                ...(message.kind === "agent-text"
                    ? {
                          generationStatus:
                              message.streaming && running
                                  ? ("streaming" as const)
                                  : ("complete" as const),
                      }
                    : {}),
                reactions: [],
                attachments: [],
                createdAt: new Date(message.createdAt).toISOString(),
            },
        });
        // The agent refused this message and said why; without the line the
        // message only sat there, as if nothing had happened.
        if (message.kind === "user-text" && message.sendError !== undefined) {
            entries.push({
                kind: "notice",
                variant: "notice",
                level: "error",
                id: `${message.id}:refused`,
                sequence: sequenceOf(index),
                text: t("这条消息没有发出去：{reason}", {
                    reason: message.sendError || t("对方没有说明原因"),
                }),
            });
        }
    });

    const pending = pendingRequests(ordered, agentState);
    return withTurnStatus(ordered, [...entries, ...pending], turns, running || pending.length > 0);
}

/*
 * Older cloud gateways routed a plain chat through their board-card runner.
 * Its stored text is the person's real message, but its display label says
 * "处理看板卡片：…". Only unwrap that legacy shape when the label's title is
 * also the beginning of the stored text; a genuine card has a different
 * instruction body and keeps its useful label.
 */
function userText(message: Extract<Message, { kind: "user-text" }>): string {
    const display = message.displayText?.trim();
    if (!display) return message.text;
    const legacy = /^处理看板卡片[：:]\s*(.+)$/u.exec(display);
    if (legacy?.[1] && message.text.trimStart().startsWith(legacy[1].trim())) return message.text;
    return display;
}

/*
The calls this conversation has stopped on, as rows a person can answer.

They come from the agent state rather than the message stream, because a
request is not something that was said: it is the agent standing still. The
state is the only place that says which ones are still open — a tool call in
the transcript looks the same whether its permission was granted a second ago
or is still being waited on.

The key is the request's own id, not the tool call's. A subagent publishes
under a scoped id (`agentID:toolUseID`) and only an answer under that same key
unblocks it; `toolUseId` is how the row finds the call it belongs to, and
nothing more.
*/
function pendingRequests(
    ordered: readonly Message[],
    agentState: AgentState | null | undefined,
): ConversationEntry[] {
    return [...pendingPermissions(ordered, agentState), ...pendingQuestions(ordered, agentState)];
}

/*
The questions the agent is waiting on.

They travel in the agent state as "communications", the phone's word for a
form the agent put to the person; the desktop draws each one as the question
prompt the local transcript uses, and answers it over the same command the
phone answers with. A kind this desktop does not know is still shown as a
question with nothing to pick, so a waiting agent is at least visible.
*/
function pendingQuestions(
    ordered: readonly Message[],
    agentState: AgentState | null | undefined,
): ConversationEntry[] {
    const communications = agentState?.communications;
    if (!communications) return [];
    return Object.entries(communications).map(([id, communication]) => {
        const form = communication.kind === "form" ? (communication.form ?? null) : null;
        return {
            kind: "request" as const,
            id: `question:${id}`,
            sequence: sequenceOf(ordered.length + 1),
            request: {
                kind: "userInput" as const,
                requestId: id,
                status: "pending" as const,
                questions: (form?.questions ?? []).map((question) => ({
                    id: question.id,
                    header: question.header,
                    question: question.question,
                    multiSelect: question.multiSelect === true,
                    required: question.required !== false,
                    options: question.options.map((option) => ({
                        label: option.label,
                        description: option.description ?? "",
                    })),
                })),
            },
        };
    });
}

function pendingPermissions(
    ordered: readonly Message[],
    agentState: AgentState | null | undefined,
): ConversationEntry[] {
    const requests = agentState?.requests;
    if (!requests) return [];
    return Object.entries(requests).map(([id, request]) => ({
        kind: "request" as const,
        id: `request:${id}`,
        // Last, because that is where the conversation has stopped. Nothing
        // that happened before it is waiting on anybody.
        sequence: sequenceOf(ordered.length + 1),
        request: {
            kind: "permissionAsk" as const,
            requestId: id,
            tool: {
                toolCallId: request.toolUseId ?? id,
                toolName: request.tool,
                arguments: (request.arguments ?? {}) as ConversationToolCall["arguments"],
                status: "awaitingApproval" as const,
                failed: false,
            },
        },
    }));
}

/*
Closes each of the agent's turns with the row that settles it.

That row is what carries "Completed in 13s" and the control that copies the
reply — both of which read as missing rather than absent when they are not
there, because every turn in the local transcript has them.

A turn is bounded by the `turn` marker the agent puts on its own messages.
Its duration and how it ended come from the agent's own turn-end event when
that was carried over; failing that — an older agent — the span from the
first of its messages to the last stands in, which a one-message reply makes
zero. Its copy text is the last thing the agent actually said, not its
reasoning and not a tool's name.
*/
function withTurnStatus(
    ordered: readonly Message[],
    entries: ConversationEntry[],
    reportedTurns?: readonly RelayTurn[],
    live = false,
): ConversationEntry[] {
    const reported = new Map((reportedTurns ?? []).map((turn) => [turn.turn, turn]));
    const turns = new Map<
        string,
        { first: number; last: number; reply: string; tools: number; index: number }
    >();

    /*
     * Where the wait began, for a turn whose agent did not say. The reader's
     * own message is what they were waiting from; measuring from the agent's
     * first row instead made a one-sentence reply take no time at all.
     */
    let lastUserAt: number | undefined;
    ordered.forEach((message, index) => {
        if (message.kind === "user-text") {
            lastUserAt = message.createdAt;
            return;
        }
        const turn = "turn" in message ? message.turn : undefined;
        if (!turn) return;
        const at = message.createdAt;
        const seen = turns.get(turn);
        const began = seen ? seen.first : Math.min(at, lastUserAt ?? at);
        const reply =
            message.kind === "agent-text" && !message.isThinking
                ? message.text
                : (seen?.reply ?? "");
        turns.set(turn, {
            first: began,
            last: seen ? Math.max(seen.last, at) : at,
            reply,
            tools: (seen?.tools ?? 0) + (message.kind === "tool-call" ? 1 : 0),
            index,
        });
    });

    const settled: ConversationEntry[] = [...entries];
    const newest = [...turns.values()].reduce((most, summary) => Math.max(most, summary.index), -1);
    for (const [turn, summary] of turns) {
        const ended = reported.get(turn);
        // The newest turn is not over while the conversation works or waits on
        // an answer: "Completed" under it read as finished while the agent was
        // stopped on a question.
        if (!ended && live && summary.index === newest) continue;
        settled.push({
            kind: "turnStatus",
            id: `turn:${turn}`,
            // Just past the turn's last row, so it closes that turn rather
            // than opening whatever follows.
            sequence: `${String(summary.index).padStart(9, "0")}.9999`,
            status:
                ended?.reason === "steering"
                    ? "steered"
                    : ended && ended.status !== "completed"
                      ? "failed"
                      : "complete",
            reason: ended?.reason ?? "completed",
            ...(summary.reply ? { copyText: summary.reply } : {}),
            durationMs: ended ? ended.elapsedMs : Math.max(0, summary.last - summary.first),
            ...(summary.tools > 0 ? { tools: summary.tools } : {}),
        });
    }

    return settled.sort((left, right) =>
        (left.kind === "message" ? left.message.sequence : left.sequence).localeCompare(
            right.kind === "message" ? right.message.sequence : right.sequence,
        ),
    );
}
