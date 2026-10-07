import { type CSSProperties } from "react";
import type { ConversationComputeNoticeEntry } from "kissopen-desktop-state";
import { ConversationComputeEvent } from "../../src/ConversationComputeEvent";
import { ConversationEntryView } from "../../src/ConversationEntryView";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-240";

const transcript: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "760px",
};

/**
 * One session waiting on its machine: the provider is asked for an instance, the
 * image is pulled, the workspace is copied, and the agent finally gets a place to
 * work. Every value is shaped exactly as Kissopen Agent's compute preparation notice sends
 * it, so the fixture and the product row are the same row.
 */
const preparation: readonly ConversationComputeNoticeEntry[] = [
    {
        kind: "notice",
        variant: "compute",
        id: "message:cmp1",
        sequence: "1",
        state: "unprovisioned",
        phase: "requested",
        provider: "docker-compute",
        instanceId: "cmi_p7a3k2m9x4",
        message: "Waiting for a compute instance.",
        text: "Preparing compute: Waiting for a compute instance.",
    },
    {
        kind: "notice",
        variant: "compute",
        id: "message:cmp2",
        sequence: "2",
        state: "provisioning",
        phase: "pulling_image",
        provider: "docker-compute",
        instanceId: "cmi_p7a3k2m9x4",
        message: "Pulling node:22-bookworm.",
        percent: 42,
        elapsedMs: 18_000,
        text: "Preparing compute: Pulling node:22-bookworm. (18s)",
    },
    {
        kind: "notice",
        variant: "compute",
        id: "message:cmp3",
        sequence: "3",
        state: "provisioning",
        phase: "copying_workspace",
        provider: "docker-compute",
        instanceId: "cmi_p7a3k2m9x4",
        message: "Copying the workspace into the container.",
        percent: 88,
        elapsedMs: 41_000,
        text: "Preparing compute: Copying the workspace into the container. (41s)",
    },
    {
        kind: "notice",
        variant: "compute",
        id: "message:cmp4",
        sequence: "4",
        state: "ready",
        phase: "ready",
        provider: "docker-compute",
        instanceId: "cmi_p7a3k2m9x4",
        message: "Compute is ready.",
        elapsedMs: 47_000,
        text: "Compute is ready. (47s)",
    },
];

export function ConversationComputeEventPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A compute lifecycle row on the activity rail: state glyph, reader-facing label, the provider's own sentence, live progress, and the provider/phase/instance behind it one disclosure away."
            title="Conversation compute event"
        >
            <Specimen
                detail="32px activity rhythm · progress and elapsed in tabular figures · ready is the one state with a colour"
                label="Preparation, start to ready"
                number="01"
                stage="surface"
            >
                <div style={transcript}>
                    {preparation.map((entry) => (
                        <ConversationEntryView entry={entry} key={entry.id} />
                    ))}
                    <DimensionRule label="760 px row · 32 px compact activity height" />
                </div>
            </Specimen>
            <Specimen
                detail="a failed provider keeps the error treatment and its exact reason; a stopped instance reads as neither progress nor failure"
                label="Failure and stop"
                number="02"
                stage="surface"
            >
                <div style={transcript}>
                    <ConversationComputeEvent
                        instanceId="cmi_p7a3k2m9x4"
                        message="The provider plugin exited before the instance was ready."
                        phase="failed"
                        provider="docker-compute"
                        state="failed"
                        elapsedMs={12_000}
                        text="Compute preparation failed: The provider plugin exited before the instance was ready. (12s)"
                    />
                    <ConversationComputeEvent
                        instanceId="cmi_p7a3k2m9x4"
                        message="The instance was stopped."
                        phase="stopped"
                        provider="docker-compute"
                        state="stopped"
                        text="Compute preparation stopped: The instance was stopped."
                    />
                </div>
            </Specimen>
            <Specimen
                detail="a long provider reason scrolls sideways behind a fade instead of truncating · the copy action and disclosure reveal on hover"
                label="Long reason"
                number="03"
                stage="surface"
            >
                <div style={transcript}>
                    <ConversationComputeEvent
                        instanceId="cmi_p7a3k2m9x4"
                        message="No capacity is available for this provider right now: every configured machine is already running another workspace, and the request was not queued because the session's preparation budget expired first."
                        phase="failed"
                        provider="docker-compute"
                        state="failed"
                        elapsedMs={182_000}
                        text="Compute preparation failed: No capacity is available for this provider right now."
                    />
                </div>
            </Specimen>
            <Specimen
                detail="the disclosure open: provider, phase, instance, and elapsed are the fields a reader quotes when a provider is broken"
                label="Details open"
                number="04"
                stage="surface"
            >
                <div style={transcript}>
                    <ConversationComputeEvent
                        defaultExpanded
                        elapsedMs={41_000}
                        instanceId="cmi_p7a3k2m9x4"
                        message="Copying the workspace into the container."
                        percent={88}
                        phase="copying_workspace"
                        provider="docker-compute"
                        state="provisioning"
                        text="Preparing compute: Copying the workspace into the container. (41s)"
                    />
                    <ConversationComputeEvent
                        defaultExpanded
                        elapsedMs={12_000}
                        instanceId="cmi_p7a3k2m9x4"
                        message="The provider plugin exited before the instance was ready."
                        phase="failed"
                        provider="docker-compute"
                        state="failed"
                        text="Compute preparation failed: The provider plugin exited before the instance was ready. (12s)"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="the compact case: no progress, no elapsed, one line and nothing else"
                label="Compact"
                number="05"
                stage="surface"
            >
                <div style={transcript}>
                    <ConversationComputeEvent
                        instanceId="cmi_p7a3k2m9x4"
                        message="Starting."
                        phase="requested"
                        provider="docker-compute"
                        state="provisioning"
                        text="Preparing compute: Starting."
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
