import { type CSSProperties } from "react";
import { Button } from "../../src/Button";
import { Tooltip } from "../../src/Tooltip";
import { TurnSummary } from "../../src/TurnSummary";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-179";

const label: CSSProperties = {
    fontFamily: "var(--kissopen-font-ui)",
    fontSize: "13px",
    color: "var(--text)",
};

export function TooltipPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Secondary detail held behind a trigger and revealed on hover or focus — the house replacement for the native title attribute. The bubble is an overlay anchored to its trigger, so the row it explains never changes size. Specimens force it open; in the product it waits out a 180 ms dwell on hover and appears at once on keyboard focus."
            title="Tooltip"
        >
            <Specimen
                detail="24px bubble · 12/16 Figtree in 3/8 padding inside a 1px hairline · 6px control radius · held 4px clear of the trigger and centered on it"
                label="Placement"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "64px" }}>
                        <Tooltip label="Used 42,781 tokens" open placement="top">
                            <Button size="small" variant="secondary">
                                Above
                            </Button>
                        </Tooltip>
                        <Tooltip label="Used 42,781 tokens" open placement="bottom">
                            <Button size="small" variant="secondary">
                                Below
                            </Button>
                        </Tooltip>
                    </div>
                    <DimensionRule label="bubble 24 px high · 4 px clear of the trigger · centered on it" />
                </div>
            </Specimen>

            <Specimen
                detail="The bubble takes its content width up to 320px, then wraps. It leaves the flow entirely, so neither trigger moves when it opens."
                label="Length"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "56px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "96px" }}>
                        <Tooltip label="42,781" open placement="bottom">
                            <span style={label}>Short</span>
                        </Tooltip>
                        <Tooltip
                            label="Used 42,781 tokens · Final context 184,320 tokens · The bubble caps at 320 px and wraps rather than running off the surface."
                            open
                            placement="bottom"
                        >
                            <span style={label}>Wrapped</span>
                        </Tooltip>
                    </div>
                    <DimensionRule label="content width · 320 px cap before wrapping" />
                </div>
            </Specimen>

            <Specimen
                detail="Its first use: exact token counts behind a settled turn. Hover the words rather than the row — the row runs the full transcript width and is mostly empty. Hover this specimen to see the real dwell."
                label="In a turn summary"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                    <div style={{ paddingTop: "32px", width: "640px" }}>
                        <TurnSummary
                            copyText="The migration completed successfully."
                            durationMs={104_000}
                            finalContextTokens={184_320}
                            status="complete"
                            usedTokens={42_781}
                        />
                    </div>
                    <DimensionRule label="640 px transcript measure · bubble anchored to the label" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
