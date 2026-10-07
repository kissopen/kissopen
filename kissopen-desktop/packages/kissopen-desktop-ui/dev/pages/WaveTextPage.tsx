import { WaveText } from "../../src/WaveText";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-306";

const column: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
};

const row: Record<string, string> = {
    display: "flex",
    alignItems: "baseline",
    gap: "32px",
    flexWrap: "wrap",
};

const caption: Record<string, string> = {
    color: "var(--text-secondary)",
    fontFamily: "var(--kissopen-font-mono)",
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    width: "72px",
};

const PHASES: readonly number[] = [0, 0.25, 0.5, 0.75];

export function WaveTextPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The thinking label's shimmer from the Juan Thinking design: a light sweep moves across the label one character at a time — one colour, opacity 0.4 → 1 → 0.4, in the row's own type — over the thinking mark's 2.4s loop."
            title="Wave text"
        >
            <Specimen
                detail="Live · w = 0.5 − 0.5·cos(2π(t − i/(n+2))) · colour text when w > 0.5, neutral-500 otherwise · opacity 0.45 + 0.55·w · weight 500 · tracking 0.12em"
                label="Loop"
                number="01"
                stage="surface"
            >
                <div style={{ ...column, fontSize: "24px" }}>
                    <WaveText text="思考中" />
                    <WaveText text="卷卷思考中" />
                    <WaveText text="Thinking" />
                    <DimensionRule label="2400ms · per-character lag 1/(n+2)" />
                </div>
            </Specimen>

            <Specimen
                detail="phase parks the wave: four points of one lap"
                label="Still frames"
                number="02"
                stage="surface"
            >
                <div style={{ ...column, fontSize: "16px" }}>
                    {PHASES.map((phase) => (
                        <div key={phase} style={row}>
                            <span style={caption}>phase {phase}</span>
                            <WaveText phase={phase} text="思考中" />
                            <WaveText phase={phase} text="Generating tools" />
                        </div>
                    ))}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
