import { type CSSProperties } from "react";
import type { ConversationDelegationChild } from "kissopen-desktop-state";
import { DelegatedAgentActivity } from "../../src/DelegatedAgentActivity";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-263";

const FIXED_NOW = 1_700_000_000_000;
const column: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "720px",
};
const interactive = () => undefined;

const idleChild = {
    sessionId: "child-idle",
    parentToolCallId: "spawn-idle",
    description: "Prepare the workspace",
    taskName: "prepare_workspace",
    modelId: "openai/gpt-5.6-luna",
    status: "idle",
    createdAt: FIXED_NOW - 2_000,
} satisfies ConversationDelegationChild;

const queuedChild = {
    ...idleChild,
    sessionId: "child-queued",
    parentToolCallId: "spawn-queued",
    description: "Review the transcript projection",
    taskName: "review_projection",
    status: "queued",
} satisfies ConversationDelegationChild;

const runningChild = {
    ...idleChild,
    sessionId: "child-running",
    parentToolCallId: "spawn-running",
    description: "Implement delegated-agent transcript",
    taskName: "implement_transcript",
    status: "running",
    activeSince: FIXED_NOW - 223_000,
    totalTokens: 18_420,
} satisfies ConversationDelegationChild;

const completedChild = {
    ...idleChild,
    sessionId: "child-completed",
    parentToolCallId: "spawn-completed",
    description: "Trace current layout behavior",
    taskName: "trace_layout",
    status: "completed",
    elapsedMs: 84_000,
    totalTokens: 7_205,
} satisfies ConversationDelegationChild;

function settledChild(
    status: "error" | "aborted" | "suspended" | "archived",
): ConversationDelegationChild {
    return {
        ...completedChild,
        sessionId: `child-${status}`,
        parentToolCallId: `spawn-${status}`,
        description: `${status} delegated task`,
        taskName: `${status}_task`,
        status,
    };
}

export function DelegatedAgentActivityPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A persistent inline transcript row for one delegated child: its task, model, live status, elapsed time, token use, and child-session destination."
            title="DelegatedAgentActivity"
        >
            <Specimen
                detail="idle readout without an action · queued row opens its child session"
                label="Preparing"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={column}>
                        <DelegatedAgentActivity
                            child={idleChild}
                            now={FIXED_NOW}
                            spinnerFrame={0}
                        />
                        <DelegatedAgentActivity
                            child={queuedChild}
                            now={FIXED_NOW}
                            onSelect={interactive}
                            spinnerFrame={2}
                        />
                    </div>
                    <DimensionRule label="720 px wide · 44 px row · 40 px button" />
                </div>
            </Specimen>

            <Specimen
                detail="fixed clock for screenshot-safe live elapsed time · recorded duration after completion"
                label="Running and completed"
                number="02"
                stage="surface"
            >
                <div style={column}>
                    <DelegatedAgentActivity
                        child={runningChild}
                        now={FIXED_NOW}
                        onSelect={interactive}
                    />
                    <DelegatedAgentActivity
                        child={completedChild}
                        now={FIXED_NOW}
                        onSelect={interactive}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="terminal and paused child states retain their recorded duration and token count"
                label="Exceptional outcomes"
                number="03"
                stage="surface"
            >
                <div style={column}>
                    {(["error", "aborted", "suspended", "archived"] as const).map((status) => (
                        <DelegatedAgentActivity
                            child={settledChild(status)}
                            key={status}
                            now={FIXED_NOW}
                            onSelect={interactive}
                        />
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="long task and model arguments ellipsize inside a constrained desktop transcript measure"
                label="Constrained content"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ ...column, width: "420px" }}>
                        <DelegatedAgentActivity
                            child={{
                                ...runningChild,
                                sessionId: "child-long",
                                taskName:
                                    "investigate_and_reconcile_every_delegated_agent_transcript_projection_edge_case",
                                modelId:
                                    "provider/a-very-long-model-identifier-with-a-large-context",
                            }}
                            now={FIXED_NOW}
                            onSelect={interactive}
                        />
                    </div>
                    <DimensionRule label="420 px constrained width · single-line ellipsis" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
