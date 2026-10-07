import { SecretaryFigure } from "../../src/SecretaryFigure";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-299";

export function SecretaryFigurePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="小秘书, the product's own face on setup, startup and reconnect pages: a silent looping clip of her waving in a round portrait, or one still frame when the person prefers less motion. Shown here held still, so the page is the same every time."
            title="Secretary figure"
        >
            <Specimen
                detail="Round portrait · 3px light ring · soft halo · still frame"
                label="Sizes"
                number="01"
                stage="app"
            >
                <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
                    <SecretaryFigure label="小秘书" motion="still" size={72} />
                    <SecretaryFigure label="小秘书" motion="still" size={120} />
                    <SecretaryFigure label="小秘书" motion="still" size={160} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
