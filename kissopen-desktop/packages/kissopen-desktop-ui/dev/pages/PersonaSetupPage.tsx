import { PersonaSetup } from "../../src/PersonaSetup";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-292";

const noop = () => {};
const stage: Record<string, string> = { display: "flex", width: "1100px", height: "760px" };
const small: Record<string, string> = { display: "flex", width: "720px", height: "560px" };

export function PersonaSetupPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The three questions asked once after signing in: the reader's work, whether they lead people, and what they want help with. Every question may be left, and the whole thing can be skipped."
            title="PersonaSetup"
        >
            <Specimen
                detail="760px panel · 24px radius · steps across the top · skip on the right · chips 36px"
                label="First question"
                number="01"
                stage="app"
            >
                <div style={stage}>
                    <PersonaSetup onSubmit={noop} />
                </div>
                <DimensionRule label="title 26/700 · lead 14 · chip 36px · actions pinned to the panel's foot" />
            </Specimen>

            <Specimen
                detail="the answers could not be saved · the message sits above the buttons"
                label="Problem"
                number="02"
                stage="app"
            >
                <div style={stage}>
                    <PersonaSetup error="账号服务暂不可用" onSubmit={noop} />
                </div>
            </Specimen>

            <Specimen
                detail="a short window · the panel scrolls from the top instead of being cut"
                label="Short window"
                number="03"
                stage="app"
            >
                <div style={small}>
                    <PersonaSetup onSubmit={noop} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
