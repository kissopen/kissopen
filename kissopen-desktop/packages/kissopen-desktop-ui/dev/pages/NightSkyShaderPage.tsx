import { NightSkyShader } from "../../src/NightSkyShader";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-272";

function SkyFrame(props: { height: number; motion?: "auto" | "still"; width: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: props.width }}>
            <NightSkyShader
                motion={props.motion}
                style={{ height: props.height, width: props.width }}
            />
            <DimensionRule label={`${props.width}px × ${props.height}px`} />
        </div>
    );
}

export function NightSkyShaderPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="A transparent, generated night sky rendered as one full-screen WebGL triangle. Three seeded star layers visibly drift and twinkle at different rates above a faint galactic band; the centre remains quieter than the edges so product copy stays dominant. It pauses offscreen and while the window is hidden. Reduced motion draws one deterministic frame and starts no render loop."
            title="NightSkyShader"
        >
            <Specimen
                detail="Live GPU motion at a wide desktop aspect ratio. The nearer star layer drifts fastest, the two smaller layers establish parallax, and each star owns a distinct twinkle phase."
                label="Animated desktop field"
                number="01"
                stage="surface"
            >
                <SkyFrame height={576} width={1024} />
            </Specimen>

            <Specimen
                detail="The deterministic reduced-motion frame in the minimum onboarding window. Resolution follows the canvas box at up to 2× device pixels while the shader's coordinates preserve round stars instead of stretching them."
                label="Minimum window, still"
                number="02"
                stage="surface"
            >
                <SkyFrame height={480} motion="still" width={720} />
            </Specimen>
        </ComponentPage>
    );
}
