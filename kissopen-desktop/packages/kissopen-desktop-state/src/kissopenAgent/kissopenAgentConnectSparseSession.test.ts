import { ChatStore, type ChatElement } from "../kissopenAgentConnection/index.js";
import { expect, it } from "vitest";
import { detachedProcessIdsUpdate } from "./kissopenAgentChatStore.js";

type ProtocolSession = Parameters<ChatStore["applySessionSnapshot"]>[0];

const fullSession = {
    id: "session-1",
    archived: false,
    backgroundProcesses: [
        { command: "sleep 120", cwd: "/workspace", sessionId: 7, status: "running" },
    ],
    cwd: "/workspace",
    externalTools: [],
    mcpServers: [],
    modelLocked: false,
    modelCatalog: {
        defaultModelId: "model",
        defaultProviderId: "provider",
        models: [],
        providers: [],
    },
    modelId: "model",
    models: [],
    ownerInstanceId: "owner",
    pendingExternalToolCalls: [],
    pendingSteeringMessages: [],
    pendingUserInputs: [],
    permissionMode: "auto",
    scope: { kind: "unsorted" },
    providerId: "provider",
    skills: [],
    snapshot: { messages: [] },
    status: "idle",
    subagents: [
        {
            id: "child-1",
            modelId: "model",
            parentSessionId: "session-1",
            status: "completed",
            updatedAt: 2,
        },
    ],
    tasks: [{ id: "task-1", subject: "Keep it", status: "completed" }],
    titleStatus: "idle",
    goal: {
        objective: "Keep the activity history",
        status: "complete",
        createdAt: 1,
        updatedAt: 2,
    },
} as unknown as ProtocolSession;

it("preserves omitted activity collections while allowing explicit clears", () => {
    const store = new ChatStore("session-1");
    store.applySessionSnapshot(fullSession);

    const sparseSession = {
        id: "session-1",
        archived: false,
        cwd: "/workspace",
        externalTools: [],
        mcpServers: [],
        modelLocked: false,
        modelCatalog: fullSession.modelCatalog,
        modelId: "model",
        models: [],
        ownerInstanceId: "owner",
        pendingExternalToolCalls: [],
        pendingSteeringMessages: [],
        pendingUserInputs: [],
        permissionMode: "auto",
        scope: { kind: "unsorted" },
        providerId: "provider",
        skills: [],
        status: "completed",
        titleStatus: "idle",
    } as unknown as ProtocolSession;

    store.applySessionSnapshot(sparseSession);
    expect(store.session().goal).toEqual(fullSession.goal);
    expect(store.session().tasks).toEqual(fullSession.tasks);
    expect(store.session().subagents).toEqual(fullSession.subagents);
    expect(store.session().backgroundProcesses).toEqual(fullSession.backgroundProcesses);

    store.applySessionSnapshot({
        ...sparseSession,
        backgroundProcesses: [],
        subagents: [],
        tasks: [],
        goal: undefined,
    } as unknown as ProtocolSession);
    expect(store.session().goal).toBeUndefined();
    expect(store.session().tasks).toEqual([]);
    expect(store.session().subagents).toEqual([]);
    expect(store.session().backgroundProcesses).toEqual([]);
});

it("keeps detached terminals outside the transcript while excluding foreground commands", () => {
    const foreground = [
        {
            kind: "tool_call",
            presentation: { kind: "command", command: "printf foreground" },
        },
    ] as unknown as ChatElement[];
    const detached = [
        {
            kind: "tool_call",
            presentation: {
                kind: "command",
                command: "sleep 120",
                terminalId: 7,
            },
        },
    ] as unknown as ChatElement[];
    const processes = [
        { command: "printf foreground", cwd: "/workspace", sessionId: 3, status: "running" },
        { command: "sleep 120", cwd: "/workspace", sessionId: 7, status: "running" },
    ] as const;

    const activeTurn = { runId: "run-1", startedAt: 1 };
    expect(detachedProcessIdsUpdate(new Set(), foreground, processes, activeTurn)).toEqual(
        new Set(),
    );
    expect(detachedProcessIdsUpdate(new Set(), detached, processes, activeTurn)).toEqual(
        new Set([7]),
    );
    expect(
        detachedProcessIdsUpdate(
            new Set(),
            [],
            [{ command: "sleep 120", cwd: "/workspace", sessionId: 9, status: "running" }],
            undefined,
        ),
    ).toEqual(new Set([9]));
});
