import type { ConversationScheduledTask, ConversationToolCall } from "kissopen-desktop-state";
import { AgentActivityRow } from "../../src/AgentActivityRow";
import { ComponentPage, Specimen } from "../kit";
import { agentSpawnRows } from "./agentSpawnFixtures";
import {
    kissopenAgentAwaitingTool,
    kissopenAgentCompactionCompletedTool,
    kissopenAgentCompactionFailedTool,
    kissopenAgentCompactionRunningTool,
    kissopenAgentElevatedTool,
    kissopenAgentExecTool,
    kissopenAgentExplorationTool,
    kissopenAgentFailedTool,
    kissopenAgentFileDiffTool,
    kissopenAgentGenericTool,
    kissopenAgentMcpInterruptedTool,
    kissopenAgentMcpTool,
    kissopenAgentRunningTool,
    kissopenAgentStoppedTool,
    kissopenAgentTerminalTool,
} from "./kissopenAgentChatFixtures";

/** A task the assistant proposed, as the transcript carries it. */
const scheduleProposalTool: ConversationToolCall = {
    ...kissopenAgentGenericTool,
    toolCallId: "schedule-proposal",
    toolName: "propose_scheduled_task",
    arguments: { request: "每个工作日早上 9 点，汇总昨晚进来的邮件" },
    status: "success",
    failed: false,
};

/** A `create_scheduled_task` call, before and after the server answered. */
const scheduleCreateRequest = "每个工作日早上 9 点，汇总昨晚进来的邮件";
const scheduleCreateRunning: ConversationToolCall = {
    ...kissopenAgentGenericTool,
    toolCallId: "schedule-create-running",
    toolName: "create_scheduled_task",
    arguments: { request: scheduleCreateRequest },
    status: "running",
    failed: false,
};
const scheduleCreated = (
    toolCallId: string,
    schedule: Partial<ConversationScheduledTask>,
): ConversationToolCall => ({
    ...scheduleCreateRunning,
    toolCallId,
    status: "success",
    presentation: {
        type: "scheduledTask",
        outcome: {
            status: "created",
            schedule: {
                id: `schedule-${toolCallId}`,
                name: "汇总昨晚进来的邮件",
                instruction: "汇总昨晚进来的邮件，按紧急程度列出需要回复的几封。",
                target: "cloud",
                recurrence: "weekdays",
                weekday: 0,
                atMinute: 9 * 60,
                onceAt: 0,
                timezone: "Asia/Shanghai",
                nextRunAt: Date.UTC(2026, 8, 30, 1, 0),
                projectName: "",
                ...schedule,
            },
        },
    },
});
const scheduleCreateNeeds: ConversationToolCall = {
    ...scheduleCreateRunning,
    toolCallId: "schedule-create-needs",
    arguments: { request: "每天提醒我看一下报表" },
    status: "success",
    presentation: {
        type: "scheduledTask",
        outcome: {
            status: "needs",
            question: "每天几点提醒你？",
            choices: ["早上 9 点", "下午 6 点"],
        },
    },
};
const scheduleCreateFailed: ConversationToolCall = {
    ...scheduleCreateRunning,
    toolCallId: "schedule-create-failed",
    status: "success",
    presentation: {
        type: "scheduledTask",
        outcome: { status: "failed", error: "请先准备云端工作空间" },
    },
};

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-148";

export function AgentActivityRowPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One glanceable row per piece of agent activity — a tool call, a reasoning block, or a shell run — with a status dot, verb, subject, and an expandable detail body."
            title="AgentActivityRow"
        >
            <Specimen
                detail="Typed catalog names only · unresolved, running, success, failure, stopped, approval, and another provider · focused production treatment"
                label="Model-aware sub-agent spawning"
                number="spawn"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    {agentSpawnRows.map((tool) => (
                        <AgentActivityRow
                            activity={{ kind: "tool", tool }}
                            key={tool.toolCallId}
                            motion="calm"
                            singleLine
                            treatment="focused"
                        />
                    ))}
                </div>
            </Specimen>
            <Specimen
                detail="propose_scheduled_task · a card where the surface can open Scheduled tasks, an ordinary row where it cannot"
                label="Scheduled-task proposal"
                number="schedule"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleProposalTool }}
                        onScheduleProposalOpen={() => {}}
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleProposalTool }}
                        singleLine
                    />
                </div>
            </Specimen>
            <Specimen
                detail="create_scheduled_task · running row, created cards (weekdays in the cloud, weekly on this computer with a project, once on another machine), a time still to settle, and a failure; not a control where the surface cannot open Scheduled tasks"
                label="Scheduled task created"
                number="schedule-create"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleCreateRunning }}
                        motion="calm"
                        singleLine
                        treatment="focused"
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleCreated("weekdays", {}) }}
                        singleLine
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "tool",
                            tool: scheduleCreated("weekly", {
                                name: "整理本周进展，写成周报草稿发给我确认",
                                target: "machine:m1",
                                recurrence: "weekly",
                                weekday: 1,
                                atMinute: 10 * 60,
                                projectName: "assistant",
                            }),
                        }}
                        singleLine
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "tool",
                            tool: scheduleCreated("once", {
                                name: "检查发布结果",
                                target: "machine:m2",
                                recurrence: "once",
                                onceAt: Date.UTC(2026, 8, 30, 6, 0),
                            }),
                        }}
                        scheduleMachineName="MacBook Pro"
                        singleLine
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleCreateNeeds }}
                        motion="calm"
                        singleLine
                        treatment="focused"
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleCreateFailed }}
                        motion="calm"
                        singleLine
                        treatment="focused"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="create_scheduled_task · where the surface can open Scheduled tasks the created card is a button with a trailing chevron that opens that task; same 56px"
                label="Scheduled task created, openable"
                number="schedule-open"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: scheduleCreated("weekdays-open", {}) }}
                        onScheduledTaskOpen={() => {}}
                        singleLine
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "tool",
                            tool: scheduleCreated("weekly-open", {
                                name: "整理本周进展，写成周报草稿发给我确认，并附上下周的重点事项和需要我决定的问题",
                                target: "machine:m1",
                                recurrence: "weekly",
                                weekday: 1,
                                atMinute: 10 * 60,
                                projectName: "assistant",
                            }),
                        }}
                        onScheduledTaskOpen={() => {}}
                        singleLine
                    />
                </div>
            </Specimen>
            <Specimen
                detail="file diff, exec command, and background terminal, expanded"
                label="Rich tool bodies"
                number="01"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentFileDiffTool }}
                        defaultExpanded
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentExecTool }}
                        defaultExpanded
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentTerminalTool }}
                        defaultExpanded
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentExplorationTool }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="running, awaiting approval, elevated, failed, stopped, generic, and compaction lifecycle rows collapsed · trailing time reveals on row hover"
                label="Status treatments"
                number="02"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentRunningTool }}
                        time="10:42 AM"
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentAwaitingTool }}
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentElevatedTool }}
                    />
                    <AgentActivityRow activity={{ kind: "tool", tool: kissopenAgentFailedTool }} />
                    <AgentActivityRow activity={{ kind: "tool", tool: kissopenAgentStoppedTool }} />
                    <AgentActivityRow activity={{ kind: "tool", tool: kissopenAgentGenericTool }} />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentCompactionRunningTool }}
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentCompactionCompletedTool }}
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentCompactionFailedTool }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="MCP result rows and an interrupted MCP call"
                label="MCP calls"
                number="03"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow activity={{ kind: "tool", tool: kissopenAgentMcpTool }} />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: kissopenAgentMcpInterruptedTool }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="reasoning collapsed and expanded, plus a finished shell run"
                label="Reasoning and shell"
                number="04"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{
                            kind: "reasoning",
                            text: "The mutex is acquired non-atomically.\n\nA blocking lock removes the window entirely.",
                            streaming: true,
                        }}
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "reasoning",
                            text: "The mutex is acquired non-atomically.\n\nA blocking lock removes the window entirely.",
                            streaming: false,
                        }}
                        defaultExpanded
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "shell",
                            command: "git status --short",
                            output: " M packages/kissopen-desktop-ui/src/ConversationView.tsx\n",
                            exitCode: 0,
                            running: false,
                            timedOut: false,
                        }}
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "shell",
                            command: "pnpm build",
                            output: "error TS2322: Type mismatch",
                            exitCode: 1,
                            running: false,
                            timedOut: false,
                        }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="a command wider than its row scrolls sideways behind a 24px fade · detailed rows reveal copy metadata and the focused row overlays its start time without reflow"
                label="Overflowing subject"
                number="05"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "420px",
                    }}
                >
                    <AgentActivityRow activity={{ kind: "tool", tool: longExecTool }} />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: longExecTool }}
                        onToolSelect={() => undefined}
                        singleLine
                    />
                    <AgentActivityRow
                        activity={{ kind: "tool", tool: longExecTool }}
                        onToolSelect={() => undefined}
                        singleLine
                        time="10:45 AM"
                        treatment="focused"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="a collaborator's message collapsed to one line, and expanded onto the message it delivered · an unnamed sender falls back to its agent id"
                label="Agent message"
                number="06"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "720px",
                    }}
                >
                    <AgentActivityRow
                        activity={{
                            kind: "agentMessage",
                            agentId: "v2eibi1k9zgwde56wwuhrbku",
                            agentName: "Retry policy rewrite",
                            text: AGENT_MESSAGE_TEXT,
                        }}
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "agentMessage",
                            agentId: "v2eibi1k9zgwde56wwuhrbku",
                            agentName: "Retry policy rewrite",
                            text: AGENT_MESSAGE_TEXT,
                        }}
                        defaultExpanded
                    />
                    <AgentActivityRow
                        activity={{
                            kind: "agentMessage",
                            agentId: "v2eibi1k9zgwde56wwuhrbku",
                            text: AGENT_MESSAGE_TEXT,
                        }}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}

/** One collaborator's delivered message, envelope and all, as Kissopen Agent writes it. */
const AGENT_MESSAGE_TEXT = [
    "Message from agent v2eibi1k9zgwde56wwuhrbku:",
    "",
    "Read-only findings (no edits/tests).",
    "",
    "The retry budget is spent before the first backoff, so a failed call retries",
    "immediately three times and then reports the original error.",
].join("\n");

/** A command far wider than a 420px row, so the scroll and its fade are visible. */
const longExecTool: ConversationToolCall = {
    ...kissopenAgentExecTool,
    toolCallId: "tool-exec-long",
    presentation: {
        type: "execCommand",
        command: "pnpm --dir packages/kissopen-desktop-electron build",
        output: "Built the desktop renderer.",
    },
};
