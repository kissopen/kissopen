import { ContextMeter } from "../../src/ContextMeter";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-159";
export function ContextMeterPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="How much of the model's context window the conversation has spent, as a 64px bar at the end of the composer's control row. Pointing at it slides the percentage and token counts out to its left; it stays muted until compacting is the next thing to do. The 3px notch marks where the daemon compacts on its own, which for a 1M Claude model is 400k, well short of the window."
            title="Context meter"
        >
            <Specimen
                detail="64px track · 4px width fill · secondary text at 72% · hover reveals the tabular percentage and counts · the 3px notch sits at the model's own compaction point"
                label="Ample"
                number="01"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "16px",
                    }}
                >
                    <ContextMeter totalTokens={200_000} usedTokens={16_000} />
                    <ContextMeter
                        compactTokens={400_000}
                        totalTokens={1_000_000}
                        usedTokens={120_000}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="warning colour within a fifth of the compaction point · error colour at the point itself, when the next turn compacts · without a published point the notch falls back to three quarters"
                label="Compaction due"
                number="02"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "16px",
                    }}
                >
                    <ContextMeter
                        compactTokens={400_000}
                        totalTokens={1_000_000}
                        usedTokens={330_000}
                    />
                    <ContextMeter
                        approximate
                        compactTokens={400_000}
                        totalTokens={1_000_000}
                        usedTokens={405_000}
                    />
                    <ContextMeter totalTokens={200_000} usedTokens={158_000} />
                    <ContextMeter totalTokens={200_000} usedTokens={200_000} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
