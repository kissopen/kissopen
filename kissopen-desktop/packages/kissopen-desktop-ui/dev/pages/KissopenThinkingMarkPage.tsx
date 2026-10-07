import { KissopenThinkingMark } from "../../src/KissopenThinkingMark";
import { WaveText } from "../../src/WaveText";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-305";

const row: Record<string, string> = {
    display: "flex",
    alignItems: "center",
    gap: "40px",
    flexWrap: "wrap",
};

const column: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
};

const cell: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
};

const caption: Record<string, string> = {
    color: "var(--text-secondary)",
    fontFamily: "var(--kissopen-font-mono)",
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
};

const inline: Record<string, string> = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "16px",
};

export function KissopenThinkingMarkPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The KissOpen mark alternates opacity while the Agent thinks. No glow, deformation or moving highlight."
            title="Kissopen thinking mark"
        >
            <Specimen
                detail="Live · alternate opacity 1 ↔ 0.28 · 1.2s · fixed geometry"
                label="Loop"
                number="01"
                stage="surface"
            >
                <div style={column}>
                    <div style={row}>
                        {[160, 96, 52, 28].map((size) => (
                            <div key={size} style={cell}>
                                <KissopenThinkingMark size={size} />
                                <span style={caption}>{size}px</span>
                            </div>
                        ))}
                    </div>
                    <DimensionRule label="1.2s opacity loop · static under reduced motion" />
                </div>
            </Specimen>

            <Specimen
                detail="motion=still always shows the canonical mark; no animated phase changes its shape"
                label="Still frames"
                number="02"
                stage="surface"
            >
                <div style={row}>
                    {[0.1, 0.3, 0.55, 0.8].map((phase) => (
                        <div key={phase} style={cell}>
                            <KissopenThinkingMark motion="still" phase={phase} size={96} />
                            <span style={caption}>phase {phase}</span>
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="Beside its label: the 22px mark, fixed stroke 5, no glow"
                label="With the label"
                number="03"
                stage="surface"
            >
                <div style={column}>
                    <div style={inline}>
                        <KissopenThinkingMark size={22} />
                        <WaveText text="思考中" />
                    </div>
                    <div style={inline}>
                        <KissopenThinkingMark size={22} />
                        <WaveText text="Thinking" />
                    </div>
                    <div style={inline}>
                        <KissopenThinkingMark motion="still" size={22} />
                        <WaveText phase={0.3} text="Thinking" />
                        <span style={caption}>still</span>
                    </div>
                </div>
            </Specimen>
        </ComponentPage>
    );
}
