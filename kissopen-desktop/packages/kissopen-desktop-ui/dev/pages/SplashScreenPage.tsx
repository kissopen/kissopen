import { SplashScreen } from "../../src/SplashScreen";
import type { SegmentedProgressSegment } from "../../src/SegmentedProgress";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-161";

/** A start that has reached its middle step, as the desktop boot reports one. */
const bootSteps: readonly SegmentedProgressSegment[] = [
    { id: "agent", label: "Starting KISSOPEN Agent", state: "done" },
    { id: "connect", label: "Connecting", state: "running" },
    { id: "projects", label: "Loading projects", state: "pending" },
];
export function SplashScreenPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="What the window holds while the app resolves: the 一起卷 logo animation centered on the workspace surface — the line rolls up and the app-icon tile lands over it, then holds — with no spinner and an optional reassurance note. Shown here at its finished frame (motion=still); the live intro is on the Kissopen logo intro page."
            title="Splash screen"
        >
            <Specimen
                detail="Fills its host · 96px logo tile centered on both axes · workspace surface"
                label="Starting"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "640px", height: "400px" }}>
                        <SplashScreen motion="still" />
                    </div>
                    <DimensionRule label="640 × 400 host · tile 96 × 96" />
                </div>
            </Specimen>

            <Specimen
                detail="A narrow host keeps the mark centered and unscaled"
                label="Narrow host"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "280px", height: "240px" }}>
                        <SplashScreen label="KISSOPEN Place" motion="still" />
                    </div>
                    <DimensionRule label="280 × 240 host · tile stays 96 × 96" />
                </div>
            </Specimen>

            <Specimen
                detail="A slow local KISSOPEN Agent start adds a quiet note below the mark; the mark itself does not move"
                label="With a note"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "640px", height: "400px" }}>
                        <SplashScreen motion="still" note="Still starting KISSOPEN Agent…" />
                    </div>
                    <DimensionRule label="640 × 400 host · tile 96 × 96 · note centered below" />
                </div>
            </Specimen>

            <Specimen
                detail="A start long enough to explain names its steps below the mark. Both the bar and the note arrive 600ms in, so a start that beats them shows the mark alone"
                label="With progress"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ width: "640px", height: "400px" }}>
                        <SplashScreen motion="still" steps={bootSteps} />
                    </div>
                    <DimensionRule label="Bar 420 wide · 16 below the mark · mark stays put" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
