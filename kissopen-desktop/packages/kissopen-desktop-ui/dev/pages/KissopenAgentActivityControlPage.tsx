import {
    agentAuthor,
    kissopenAgentOwnerAuthor,
    type ComposerSnapshot,
    type ConversationEntry,
} from "kissopen-desktop-state";
import { ConversationView } from "../../src/ConversationView";
import { KissopenAgentActivityControl } from "../../src/KissopenAgentActivityControl";
import { ComponentPage, DimensionRule, Specimen } from "../kit";
import { conversationEntries } from "./kissopenAgentChatFixtures";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-264";

const noop = () => undefined;

const COMPOSER: ComposerSnapshot = {
    agentUserIds: [],
    attachments: [],
    capabilities: { commands: [], mentions: false, shellMode: false },
    focused: false,
    mentionCandidates: [],
    revision: 0,
    scopeId: "activity-control",
    submission: { status: "idle" },
    text: "",
};

/** The same transcript, closed by a settled turn the way a finished run ends. */
const SETTLED_ENTRIES: readonly ConversationEntry[] = [
    ...conversationEntries,
    {
        kind: "turnStatus",
        id: "turn-1",
        sequence: "99",
        status: "complete",
        reason: "completed",
        copyText: "The change is applied and tests pass.",
        durationMs: 261_000,
    },
];

/**
 * The transcript this entry lives in, at a chosen width. The summary is never
 * shown on its own: it is the trailing half of the working-status line, so the
 * specimen renders the conversation the product renders.
 */
function TranscriptStage(props: {
    readonly agents?: number;
    readonly delegatedElapsedMs?: number;
    readonly running?: boolean;
    readonly terminals?: number;
    readonly width: number;
}) {
    const activity =
        (props.agents ?? 0) + (props.terminals ?? 0) > 0 ? (
            <KissopenAgentActivityControl
                agents={props.agents}
                backgroundTerminals={props.terminals}
                onClick={noop}
            />
        ) : undefined;
    return (
        <div
            style={{
                border: "1px solid var(--divider)",
                borderRadius: "8px",
                display: "flex",
                height: "320px",
                overflow: "hidden",
                width: `${String(props.width)}px`,
            }}
        >
            <ConversationView
                activityControl={activity}
                activityTreatment="focused"
                agentAuthor={agentAuthor}
                composer={COMPOSER}
                composerPlaceholder="Message KISSOPEN…"
                conversationId="activity-control"
                delegatedAgents={props.agents}
                delegatedElapsedMs={props.delegatedElapsedMs}
                elapsedMs={28_000}
                entries={props.running === false ? SETTLED_ENTRIES : conversationEntries}
                motion="calm-typed"
                onComposerSend={noop}
                onComposerValueChange={noop}
                running={props.running ?? true}
                style={{ flex: "1 1 auto", minWidth: 0 }}
                viewerId={kissopenAgentOwnerAuthor.id}
                workingPhase="thinking"
            />
        </div>
    );
}

export function KissopenAgentActivityControlPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The live-work summary that shares one stable line with the working status, keeps that line saying the conversation is working in its subagents after the parent turn stops, and disappears only when no agent or terminal remains active."
            title="KissopenAgentActivityControl"
        >
            <Specimen
                detail="active agents and a background terminal end the turn's own status line — one loader and one line"
                label="On the status line"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <TranscriptStage agents={2} terminals={1} width={720} />
                    <DimensionRule label="720 px wide · one 36 px status line" />
                </div>
            </Specimen>

            <Specimen
                detail="a constrained pane keeps the status and activity on one line and truncates their text in place"
                label="Compact"
                number="02"
                stage="surface"
            >
                <TranscriptStage agents={2} terminals={1} width={320} />
            </Specimen>

            <Specimen
                detail="one long-running terminal outlives its parent turn, so the stable activity line remains with only the terminal count"
                label="No active turn"
                number="03"
                stage="surface"
            >
                <TranscriptStage running={false} terminals={1} width={720} />
            </Specimen>

            <Specimen
                detail="the turn ended and its delegated agents did not, so the line takes the dedicated subagent state and counts the children's own clock"
                label="Working in subagents"
                number="04"
                stage="surface"
            >
                <TranscriptStage
                    agents={2}
                    delegatedElapsedMs={61_000}
                    running={false}
                    width={720}
                />
            </Specimen>

            <Specimen
                detail="the same state for a child whose start the host never reported: the loader and the state, and no clock invented for it"
                label="Subagents without a clock"
                number="05"
                stage="surface"
            >
                <TranscriptStage agents={1} running={false} width={720} />
            </Specimen>

            <Specimen
                detail="settled agents and no live terminal produce no summary at all"
                label="Nothing running"
                number="06"
                stage="surface"
            >
                <TranscriptStage running={false} width={720} />
            </Specimen>
        </ComponentPage>
    );
}
