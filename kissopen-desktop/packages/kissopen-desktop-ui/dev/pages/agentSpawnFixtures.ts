import type { ConversationToolCall } from "kissopen-desktop-state";

const grok = { modelId: "xai/grok-4.6", providerId: "grok", name: "Grok 4.6" };

export const agentSpawnRunning: ConversationToolCall = {
    toolCallId: "spawn-running",
    toolName: "create_agent",
    arguments: { name: "Review the change", model: "xai/grok-4.6", provider: "grok" },
    status: "running",
    failed: false,
    presentation: { type: "agentSpawn", model: grok },
};

export const agentSpawnCompleted: ConversationToolCall = {
    ...agentSpawnRunning,
    toolCallId: "spawn-completed",
    status: "success",
    presentation: {
        type: "agentSpawn",
        model: grok,
        agentId: "gkq8eh6n4j3pz2t9yd7w5cxa",
    },
    display: "Sub-agent created and initial message delivered.",
};

export const agentSpawnUnresolved: ConversationToolCall = {
    ...agentSpawnRunning,
    toolCallId: "spawn-unresolved",
    presentation: { type: "agentSpawn" },
};

export const agentSpawnFailed: ConversationToolCall = {
    ...agentSpawnRunning,
    toolCallId: "spawn-failed",
    status: "failed",
    failed: true,
    failure: { kind: "execution_failed", message: "The provider is unavailable." },
};

export const agentSpawnStopped: ConversationToolCall = {
    ...agentSpawnRunning,
    toolCallId: "spawn-stopped",
    status: "stopped",
    failure: { kind: "interrupted", message: "Stopped before creating the sub-agent." },
};

export const agentSpawnRows: readonly ConversationToolCall[] = [
    agentSpawnUnresolved,
    agentSpawnRunning,
    agentSpawnCompleted,
    agentSpawnFailed,
    agentSpawnStopped,
    {
        ...agentSpawnFailed,
        toolCallId: "spawn-unresolved-failed",
        presentation: { type: "agentSpawn" },
        failure: { kind: "invalid_arguments", message: "No matching model is available." },
    },
    {
        ...agentSpawnRunning,
        toolCallId: "spawn-awaiting-approval",
        status: "awaitingApproval",
    },
    {
        ...agentSpawnCompleted,
        toolCallId: "spawn-other-model",
        presentation: {
            type: "agentSpawn",
            model: { modelId: "anthropic/opus-5", providerId: "claude_extra", name: "Opus 5 1M" },
            agentId: "pz8b5nk3s7dr2j4qx6hv9cwa",
        },
    },
];
