import { ZoomIndicator } from "../../src/ZoomIndicator";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-267";

/** The percentages a window actually lands on, from the floor to well past 1:1. */
const PERCENTS = [25, 50, 67, 80, 90, 100, 110, 125, 150, 175, 200, 300, 500];

/*
 * The read-out is `position: fixed` and takes itself away after a second, which
 * is right in a window and wrong on a page of specimens: fixed to the viewport,
 * every chip would stack in one place at the top of the workbench, and the fade
 * would empty the specimen before it could be looked at.
 *
 * So the page shows the chip as it is drawn rather than as it arrives: the
 * component in a frame that gives its `fixed` a containing block of its own, and
 * the animation paused at its first frame. What is being judged here is the
 * chip — its type, its padding, and whether a three-digit percentage fits — and
 * that is exactly what is left when the entrance is held still. Screenshots stay
 * identical run to run for the same reason.
 */
function Held(props: { percent: number }) {
    return (
        <div
            className="blueprint-zoom-frame"
            style={{
                /* A transform gives the chip's `fixed` a containing block here
                   instead of the workbench viewport, so each specimen holds its
                   own rather than all of them stacking at the top of the page. */
                position: "relative",
                display: "flex",
                width: "120px",
                height: "48px",
                border: "1px solid var(--divider)",
                borderRadius: "var(--kissopen-radius-sm)",
                transform: "translateZ(0)",
            }}
        >
            <ZoomIndicator percent={props.percent} />
        </div>
    );
}

export function ZoomIndicatorPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The window's zoom, said once at the top of the window and then gone, the way a browser says it. The View menu owns zooming; this only reports what it did."
            title="Zoom indicator"
        >
            <Specimen
                detail="Every percentage the View menu can reach, from the engine's floor to its ceiling. The chip is centred on the window's own axis and sized by its content, so a three-digit number widens it rather than crowding it; the type is the mono face at the same 10.8px the key caps use, which is where the resemblance ends — a cap holds key cells at fixed advances and a read-out holds a number."
                label="Every zoom the window reaches"
                number="267.1"
                stage="chrome"
            >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    {PERCENTS.map((percent) => (
                        <div
                            key={percent}
                            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                        >
                            <Held percent={percent} />
                            <DimensionRule label={`${percent}% · 22px tall · 10px each side`} />
                        </div>
                    ))}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
