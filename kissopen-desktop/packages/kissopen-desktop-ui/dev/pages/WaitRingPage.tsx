import { AgentWorkingStatus } from "../../src/AgentWorkingStatus";
import { Spinner } from "../../src/Spinner";
import { WaitRing, waitRemainingLabel } from "../../src/WaitRing";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-172";

/* Every time here is pinned so the page renders the same twice: the product
   passes a ticking clock, the blueprint passes these. */
const STARTED_AT = Date.parse("2026-08-01T09:00:00Z");

const column = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: "16px",
};

const row = {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    gap: "10px",
    fontFamily: "var(--kissopen-font-mono)",
    fontSize: "16px",
    lineHeight: "24px",
    color: "var(--text-secondary)",
};

export function WaitRingPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The share of a scheduled wait already spent, as a filling arc. It stands in a spinner's box and takes the same space, but it measures a known interval instead of saying that something is happening. It carries no text: the row it sits in owns the type."
            title="Wait ring"
        >
            <Specimen
                detail="14px box · 2px stroke · fill is the share of the interval already spent, from 12 o'clock"
                label="Across one interval"
                number="01"
                stage="surface"
            >
                <div style={column}>
                    {[0, 5, 15, 20].map((minutes) => (
                        <span key={minutes} style={row}>
                            <WaitRing
                                finishAt={STARTED_AT + 20 * 60_000}
                                now={STARTED_AT + minutes * 60_000}
                                startedAt={STARTED_AT}
                            />
                            {`${(minutes / 20) * 100}%`}
                        </span>
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="both are 14px tall and centre on the same line · the ring is square where the braille cell is half-width, so entering a wait moves the text after it by 7px"
                label="Against the spinner it replaces"
                number="02"
                stage="surface"
            >
                <div style={column}>
                    <span style={row}>
                        <Spinner size={14} tone="muted" variant="braille-2" />
                        Thinking
                    </span>
                    <span style={row}>
                        <WaitRing
                            finishAt={STARTED_AT + 3_600_000}
                            now={STARTED_AT + 1_654_000}
                            startedAt={STARTED_AT}
                        />
                        {`Wait for ${waitRemainingLabel(1_946_000)}`}
                    </span>
                </div>
            </Specimen>

            <Specimen
                detail="the ring and countdown replace only the loader and the phase word · the turn clock stays · hover names the day the wait ends on · C-154 shows the column it shares with the rows above it"
                label="In the working status"
                number="03"
                stage="surface"
            >
                <div style={column}>
                    <AgentWorkingStatus elapsedMs={32_000} phase="thinking" />
                    <AgentWorkingStatus
                        elapsedMs={228_000}
                        phase="callingTools"
                        wait={{
                            startedAt: STARTED_AT,
                            dueAt: STARTED_AT + 3_600_000,
                            now: STARTED_AT + 1_654_000,
                        }}
                    />
                    <AgentWorkingStatus
                        elapsedMs={3_612_000}
                        phase="callingTools"
                        wait={{
                            startedAt: STARTED_AT,
                            dueAt: STARTED_AT + 172_800_000,
                            now: STARTED_AT + 21_600_000,
                        }}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="seconds · minutes and seconds · hours and minutes · days and hours — the two largest units that still say something"
                label="Countdown units"
                number="04"
                stage="surface"
            >
                <div style={column}>
                    {[42_000, 252_000, 5_400_000, 189_000_000].map((remaining) => (
                        <span key={remaining} style={row}>
                            <WaitRing
                                finishAt={STARTED_AT + remaining}
                                now={STARTED_AT}
                                startedAt={STARTED_AT - remaining}
                            />
                            {`Wait for ${waitRemainingLabel(remaining)}`}
                        </span>
                    ))}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
