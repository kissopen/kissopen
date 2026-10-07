import { useState } from "react";
import { Button } from "../../src/Button";
import { KissopenLogoIntro } from "../../src/KissopenLogoIntro";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-307";

const column: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
};

const stage: Record<string, string> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "480px",
    height: "240px",
};

export function KissopenLogoIntroPage() {
    // Remounting by key is what replays the intro on its own clock.
    const [take, setTake] = useState(0);
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The official KissOpen mark plays one opacity relay and then rests unchanged. No glow, scaling or completion flash."
            title="Kissopen logo intro"
        >
            <Specimen
                detail="One 1.8s opacity relay, then the unchanged mark. No camera motion, glow or completion flash."
                label="Intro"
                number="01"
                stage="surface"
            >
                <div style={column}>
                    <div style={stage}>
                        <KissopenLogoIntro clock="mount" key={take} size={96} />
                    </div>
                    <Button onClick={() => setTake((value) => value + 1)} size="small">
                        Play again
                    </Button>
                    <DimensionRule label="96px mark · plays once, holds the original artwork" />
                </div>
            </Specimen>

            <Specimen
                detail="motion=still and reduced motion: identical static geometry, no glow in either appearance."
                label="Finished frame"
                number="02"
                stage="surface"
            >
                <div style={{ ...stage, gap: "48px" }}>
                    <KissopenLogoIntro motion="still" size={96} />
                    <KissopenLogoIntro motion="still" size={160} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
