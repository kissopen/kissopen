import { type CSSProperties } from "react";
import { TurnSummary } from "../../src/TurnSummary";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-164";

const column: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "640px",
};

export function TurnSummaryPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The neutral settled footer for a turn: total duration, token detail on hover, steering boundary, and final-message copy confirmation. Failure detail belongs to ConversationErrorCard above it."
            title="Turn summary"
        >
            <Specimen
                detail="Message-sized type · hover reveals used tokens and final context · copy changes to a check after success"
                label="Reply finished"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={column}>
                        <TurnSummary
                            copyText="The migration completed successfully."
                            durationMs={104_000}
                            finalContextTokens={184_320}
                            status="complete"
                            usedTokens={42_781}
                        />
                        <TurnSummary copyText="Done." durationMs={7_000} status="complete" />
                    </div>
                    <DimensionRule label="640 px wide · 16/24 message type" />
                </div>
            </Specimen>
            <Specimen
                detail="The footer describes the reply, not completion of the objective; its error card carries any failure"
                label="After an error"
                number="02"
                stage="surface"
            >
                <div style={column}>
                    <TurnSummary
                        copyText="The provider connection failed."
                        durationMs={41_000}
                        status="complete"
                    />
                    <TurnSummary copyText="The run stopped." status="complete" />
                    <TurnSummary durationMs={18_000} status="steered" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
