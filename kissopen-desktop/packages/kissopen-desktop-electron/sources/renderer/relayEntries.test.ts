/*
The projection that makes one transcript component serve both halves.

The local Agent reaches `ConversationEntry` through the daemon; a relay session
reaches it through here. What these tests hold is that a tool call from another
machine arrives as the same kind of row as a tool call from this one — because
an earlier version flattened it to a line of text, and a line of text cannot be
expanded, cannot show a failure, and cannot be waited on.
*/
import { describe, it, expect } from "vitest";
import { relayEntries, RELAY_VIEWER_ID } from "./relayEntries";
import type { Message, ToolCall } from "@kissopen/kissopen-sync/typesMessage";

const SESSION = "s1";

const userText = (id: string, text: string): Message =>
    ({ kind: "user-text", id, localId: null, createdAt: 1, text }) as Message;

const agentText = (id: string, text: string, isThinking = false): Message =>
    ({ kind: "agent-text", id, localId: null, createdAt: 2, text, isThinking }) as Message;

/** An agent message inside a named turn, at a given moment. */
const inTurn = (id: string, text: string, turn: string, createdAt: number): Message =>
    ({ kind: "agent-text", id, localId: null, createdAt, text, turn }) as Message;

const tool = (over: Partial<ToolCall> = {}): ToolCall =>
    ({
        name: "Bash",
        state: "completed",
        input: { command: "ls" },
        createdAt: 3,
        startedAt: 3,
        completedAt: 4,
        description: null,
        ...over,
    }) as ToolCall;

const toolCall = (id: string, call: ToolCall, children: Message[] = []): Message =>
    ({ kind: "tool-call", id, localId: null, createdAt: 3, tool: call, children }) as Message;

describe("a relay conversation as transcript rows", () => {
    it("puts what was said in message rows, with the agent named", () => {
        const [mine, theirs] = relayEntries(
            [userText("m1", "帮我看看"), agentText("m2", "好")],
            SESSION,
        );
        expect(mine.kind).toBe("message");
        expect(theirs.kind).toBe("message");
        if (mine.kind !== "message" || theirs.kind !== "message") return;
        // The reader needs an author with the viewer's id: the transcript
        // decides which side to draw a message on by comparing them, and a
        // sender-less row is drawn as somebody unknown, on the wrong side.
        expect(mine.message.sender?.id).toBe(RELAY_VIEWER_ID);
        expect(theirs.message.sender?.kind).toBe("agent");
    });

    /*
     * The row that matters. A tool call is work, not speech: it has a status
     * the reader watches, arguments they can open, and a failure they need to
     * see. None of that survives being turned into a sentence.
     */
    it("makes a tool call an activity row, not prose", () => {
        const [entry] = relayEntries([toolCall("t1", tool())], SESSION);
        expect(entry.kind).toBe("agentActivity");
        if (entry.kind !== "agentActivity" || entry.activity.kind !== "tool") return;
        expect(entry.activity.tool.toolName).toBe("Bash");
        expect(entry.activity.tool.arguments).toEqual({ command: "ls" });
        expect(entry.activity.tool.status).toBe("success");
    });

    it("says when a tool call failed", () => {
        const [entry] = relayEntries([toolCall("t1", tool({ state: "error" }))], SESSION);
        if (entry.kind !== "agentActivity" || entry.activity.kind !== "tool") throw new Error("shape");
        expect(entry.activity.tool.status).toBe("failed");
        expect(entry.activity.tool.failed).toBe(true);
    });

    // Waiting on a person and working are different things: a reader can act
    // on the first and can only wait on the second.
    it("tells a call waiting for approval from one that is running", () => {
        const waiting = relayEntries(
            [toolCall("t1", tool({ state: "running", permission: { id: "p1", status: "pending" } }))],
            SESSION,
        )[0];
        const running = relayEntries([toolCall("t2", tool({ state: "running" }))], SESSION)[0];
        if (waiting.kind !== "agentActivity" || waiting.activity.kind !== "tool") throw new Error("shape");
        if (running.kind !== "agentActivity" || running.activity.kind !== "tool") throw new Error("shape");
        expect(waiting.activity.tool.status).toBe("awaitingApproval");
        expect(running.activity.tool.status).toBe("running");
    });

    // Reasoning is the agent working, not the agent talking.
    it("makes thinking an activity row rather than a message", () => {
        const [entry] = relayEntries([agentText("m1", "先看看目录", true)], SESSION);
        expect(entry.kind).toBe("agentActivity");
        if (entry.kind !== "agentActivity") return;
        expect(entry.activity.kind).toBe("reasoning");
    });

    /*
     * Nested work belongs under the call that started it, in the order it
     * happened — not after the whole turn, where it would read as something
     * that came later.
     */
    it("keeps nested tool calls under their parent, in order", () => {
        const entries = relayEntries(
            [
                toolCall("parent", tool({ name: "Task" }), [
                    toolCall("child", tool({ name: "Read" })),
                ]),
                { ...(agentText("after", "做完了") as object), createdAt: 9 } as Message,
            ],
            SESSION,
        );
        expect(entries.map((entry) => entry.kind)).toEqual([
            "agentActivity",
            "agentActivity",
            "message",
        ]);
        const keys = entries.map((entry) =>
            entry.kind === "message" ? entry.message.sequence : entry.sequence,
        );
        expect([...keys].sort()).toEqual(keys);
    });

    /*
     * Every settled turn in the local transcript ends with a row carrying how
     * long it took and a control that copies the reply. Without it a remote
     * conversation reads as missing them rather than as not having them.
     */
    it("closes a turn with its duration and the reply to copy", () => {
        const entries = relayEntries(
            [inTurn("a", "在想", "t1", 1000), inTurn("b", "好了", "t1", 14000)],
            SESSION,
        );
        const settled = entries.find((entry) => entry.kind === "turnStatus");
        expect(settled).toBeDefined();
        if (settled?.kind !== "turnStatus") return;
        expect(settled.durationMs).toBe(13000);
        // The reply, not the reasoning and not a tool name.
        expect(settled.copyText).toBe("好了");
        // And it closes the turn rather than opening what follows.
        expect(entries.at(-1)).toBe(settled);
    });

    it("leaves a conversation with no turns alone", () => {
        const entries = relayEntries([userText("m1", "在")], SESSION);
        expect(entries.every((entry) => entry.kind !== "turnStatus")).toBe(true);
    });

    it("prefers the text a message says to display", () => {
        const message = {
            kind: "user-text",
            id: "m1",
            localId: null,
            createdAt: 1,
            text: "原文",
            displayText: "给人看的",
        } as Message;
        const [entry] = relayEntries([message], SESSION);
        if (entry.kind !== "message") throw new Error("shape");
        expect(entry.message.text).toBe("给人看的");
    });
});

describe("what a conversation is waiting on", () => {
    /*
     * A pending request lives in the agent state, not the message stream. That
     * is the whole reason it is read from there: a tool call in the transcript
     * looks exactly the same whether its permission was granted a second ago
     * or is still being waited on.
     */
    it("turns a request the agent is blocked on into a row that can be answered", () => {
        const entries = relayEntries([userText("m1", "跑一下")], SESSION, {
            requests: { "req-1": { tool: "Bash", arguments: { command: "rm -rf build" } } },
        } as never);
        const request = entries.find((entry) => entry.kind === "request");
        expect(request).toBeDefined();
        if (request?.kind !== "request") throw new Error("not a request row");
        expect(request.request.requestId).toBe("req-1");
        if (request.request.kind !== "permissionAsk") throw new Error("not an ask");
        expect(request.request.tool.toolName).toBe("Bash");
        expect(request.request.tool.status).toBe("awaitingApproval");
    });

    /*
     * The row's id is the request's own key, not the tool call's. A subagent
     * publishes under a scoped key and only an answer under that same key
     * unblocks it — answering under the tool id would leave it waiting.
     */
    it("answers under the request's key even when it names a different tool call", () => {
        const entries = relayEntries([], SESSION, {
            requests: { "agent-7:tool-3": { tool: "Write", arguments: {}, toolUseId: "tool-3" } },
        } as never);
        const [request] = entries.filter((entry) => entry.kind === "request");
        if (request?.kind !== "request" || request.request.kind !== "permissionAsk")
            throw new Error("not an ask");
        expect(request.request.requestId).toBe("agent-7:tool-3");
        expect(request.request.tool.toolCallId).toBe("tool-3");
    });

    // A conversation nobody is waiting on gains no row. The gate is a thing
    // that appears, and one that was always there would stop meaning anything.
    it("adds nothing when the agent is waiting on nobody", () => {
        const entries = relayEntries([userText("m1", "你好")], SESSION, {} as never);
        expect(entries.some((entry) => entry.kind === "request")).toBe(false);
    });

    // The gate is where the conversation stopped: nothing before it is waiting
    // on anybody, so it belongs after everything that already happened.
    it("puts the gate after the transcript it interrupted", () => {
        const entries = relayEntries([userText("m1", "跑"), agentText("m2", "好")], SESSION, {
            requests: { "req-1": { tool: "Bash", arguments: {} } },
        } as never);
        const at = entries.findIndex((entry) => entry.kind === "request");
        expect(at).toBe(entries.length - 1);
    });
});
