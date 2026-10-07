import { ConversationUsageLimitCard } from "../../src/ConversationUsageLimitCard";
import { ConversationView } from "../../src/ConversationView";
import { agentAuthor, type ComposerSnapshot, type ConversationEntry } from "kissopen-desktop-state";
import { useState } from "react";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-313";
const composer: ComposerSnapshot = {
    agentUserIds: [],
    attachments: [],
    capabilities: { commands: [], mentions: false, shellMode: false },
    focused: false,
    mentionCandidates: [],
    revision: 0,
    scopeId: "usage-card",
    submission: { status: "idle" },
    text: "",
};
const entries: readonly ConversationEntry[] = [
    {
        kind: "notice",
        id: "quota",
        sequence: "1",
        variant: "notice",
        level: "error",
        text: "Usage limit",
        usageLimit: { code: "usage_limit", resetAt: Date.UTC(2026, 9, 3, 9) },
    },
    {
        kind: "turnStatus",
        id: "failed-turn",
        sequence: "2",
        status: "failed",
        reason: "error",
        durationMs: 1000,
    },
];
export function ConversationUsageLimitCardPage() {
    const [opened, setOpened] = useState(false);
    const onUsageOpen = () => setOpened(true);
    return (
        <ComponentPage
            number={componentNumber}
            title="ConversationUsageLimitCard"
            summary="Account allowance exhaustion stops retries and offers Usage, without provider details."
        >
            <Specimen
                number="01"
                label="Renewing allowance"
                detail="Known recovery time"
                stage="app"
            >
                <div style={{ width: 700 }}>
                    <ConversationUsageLimitCard
                        resetAt={Date.UTC(2026, 9, 3, 9)}
                        onUsageOpen={onUsageOpen}
                    />
                </div>
            </Specimen>
            <Specimen
                number="02"
                label="Free allowance"
                detail="No invented recovery time"
                stage="app"
            >
                <div style={{ width: 390, containerType: "inline-size" }}>
                    <ConversationUsageLimitCard onUsageOpen={onUsageOpen} />
                </div>
            </Specimen>
            {[700, 390].map((width, index) => (
                <Specimen
                    key={width}
                    number={`0${index + 3}`}
                    label={`Transcript at ${width}px`}
                    detail="Virtualized card keeps the failed footer below it"
                    stage="app"
                >
                    <div
                        style={{
                            width,
                            height: 440,
                            display: "flex",
                            overflow: "hidden",
                            border: "1px solid var(--divider)",
                        }}
                    >
                        <ConversationView
                            conversationId={`quota-${width}`}
                            entries={entries}
                            agentAuthor={agentAuthor}
                            composer={composer}
                            onComposerSend={() => undefined}
                            onComposerValueChange={() => undefined}
                            onUsageOpen={onUsageOpen}
                            style={{ flex: "1 1 auto", minWidth: 0 }}
                        />
                    </div>
                </Specimen>
            ))}
            {opened && <p data-testid="usage-opened">Usage opened</p>}
        </ComponentPage>
    );
}
