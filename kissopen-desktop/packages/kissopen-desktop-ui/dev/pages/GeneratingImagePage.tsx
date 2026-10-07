import { GeneratingImage, imageGenerationProgress } from "../../src/GeneratingImage";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-149";

const row: Record<string, string> = {
    display: "flex",
    flexDirection: "row",
    gap: "24px",
    alignItems: "flex-start",
};

export function GeneratingImagePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A picture on its way, drawn as a halftone field that fills in as the estimate climbs, with the percentage in the corner."
            title="GeneratingImage"
        >
            <Specimen
                detail="still frames at 0%, 40% and 76%, 320 px square · the badge reads the label as given"
                label="Filling in"
                number="01"
                stage="surface"
            >
                <div style={row}>
                    {[0, 0.4, 0.76].map((progress) => (
                        <GeneratingImage
                            height={320}
                            key={progress}
                            label={`${Math.round(progress * 100)}%`}
                            progress={progress}
                            still
                            width={320}
                        />
                    ))}
                </div>
            </Specimen>
            <Specimen
                detail="live · the field drifts while it waits, and the estimate is the curve a half-minute wait follows"
                label="Waiting"
                number="02"
                stage="surface"
            >
                <div style={row}>
                    <GeneratingImage
                        height={320}
                        label={`${Math.round(imageGenerationProgress(12_000) * 100)}%`}
                        progress={imageGenerationProgress(12_000)}
                        width={320}
                    />
                    <GeneratingImage height={240} progress={0.3} still width={360} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
