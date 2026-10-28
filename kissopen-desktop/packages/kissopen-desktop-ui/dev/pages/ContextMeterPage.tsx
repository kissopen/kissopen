import { ContextMeter } from "../../src/ContextMeter";
import { ComponentPage, Specimen } from "../kit";
import { useState } from "react";

function EditableContextSpecimen() {
    const [percent, setPercent] = useState<number | undefined>();
    return (
        <ContextMeter
            defaultOpen
            compactTokens={(percent ?? 70) * 10_000}
            modelName="claude-opus-5.5"
            totalTokens={1_000_000}
            usedTokens={277_800}
            compaction={{
                modelId: "example",
                overridePercent: percent,
                defaultPercent: 70,
                onChange: async (next) => {
                    setPercent(next ?? undefined);
                },
            }}
        />
    );
}

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-159";
export function ContextMeterPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A compact context indicator opens a detailed card with used, remaining and total tokens, the measured model and its effective automatic compaction threshold. Hover or focus previews the card; click pins it, and Escape or a click outside dismisses it."
            title="Context meter"
        >
            <Specimen
                detail="312px card · model comes from the catalog · token counts retain one decimal · brand accent marks usage and compaction"
                label="Context details"
                number="00"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                        width: 360,
                        height: 400,
                    }}
                >
                    <EditableContextSpecimen />
                </div>
            </Specimen>
            <Specimen
                detail="Capacity is known before the first provider report; usage stays unknown rather than claiming zero. Missing thresholds are stated explicitly."
                label="Measurement pending"
                number="00b"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                        width: 360,
                        height: 400,
                    }}
                >
                    <ContextMeter
                        defaultOpen
                        measured={false}
                        modelName="DeepSeek-V4.1-Flash"
                        totalTokens={1_048_576}
                        usedTokens={0}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="64px track · brand accent · hover or keyboard focus opens details · the notch marks the daemon's reported compaction point"
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
                detail="Warning colour near the reported compaction point · error colour at the point itself · an unknown threshold has no invented notch"
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
