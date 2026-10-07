import { ConnectionHeader } from "../../src/ConnectionHeader";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-269";

/** A stand-in for the app the band pushes down, so the push is what is shown. */
const body = {
    alignItems: "center",
    background: "var(--surface)",
    color: "var(--text-secondary)",
    display: "flex",
    flex: "1 1 auto",
    fontSize: "12px",
    justifyContent: "center",
    minHeight: 0,
};

const frame = {
    border: "1px solid var(--border)",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column" as const,
    height: "160px",
    overflow: "hidden",
    width: "100%",
};

export function ConnectionHeaderPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The window saying it is out of touch with the machine, across its full width. It is a row in the window's column rather than an overlay, so it moves everything below it down and covers nothing. It never blocks: the app underneath stays mounted, readable, and editable, and only the actions that genuinely need the machine are disabled where they are. With nothing wrong it renders nothing and costs no height."
            title="Connection header"
        >
            <Specimen
                detail="Nothing wrong · the band is absent and the window is full height"
                label="Connected"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader />
                        <div style={body}>The app, at its full height</div>
                    </div>
                    <DimensionRule label="No band · no height taken" />
                </div>
            </Specimen>

            <Specimen
                detail="Dropped and being retried · the spinner says KISSOPEN is still trying"
                label="Disconnected"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader message="This Mac is unreachable." retrying />
                        <div style={body}>The app, pushed down by 32px</div>
                    </div>
                    <DimensionRule label="Band 32px · body gives back exactly 32px" />
                </div>
            </Specimen>

            <Specimen
                detail="Settled failure · no spinner, because nothing is being retried"
                label="Error"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader message="This KISSOPEN Agent connection is closed." />
                        <div style={body}>The app, still fully usable</div>
                    </div>
                    <DimensionRule label="Alert glyph replaces the spinner" />
                </div>
            </Specimen>

            <Specimen
                detail="As the window's top edge · the title bar's own 40px, so the traffic lights land centred in it, with 78px kept clear for them and mirrored on the right so the line stays on the window's centre. The band is the drag lane."
                label="Window controls"
                number="04"
                stage="chrome"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader
                            message="This Mac is unreachable."
                            retrying
                            windowControls
                        />
                        <div style={body}>The app, below the window chrome</div>
                    </div>
                    <DimensionRule label="Band 40px · 78px reservation both sides · line centred on the window" />
                </div>
            </Specimen>

            <Specimen
                detail="Full screen · the traffic lights are gone, so the band keeps nothing clear of them and goes back to its own short height"
                label="Full screen"
                number="05"
                stage="chrome"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader
                            message="This Mac is unreachable."
                            retrying
                            windowControls
                            windowFullScreen
                        />
                        <div style={body}>The app, below a band of ordinary height</div>
                    </div>
                    <DimensionRule label="Band 32px · no reservation · still the drag lane" />
                </div>
            </Specimen>

            <Specimen
                detail="A long reason truncates rather than growing the band to two lines"
                label="Long message"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ConnectionHeader
                            message="KISSOPEN Agent accepted the connection but did not answer the health check within the time allowed, and is being retried."
                            retrying
                        />
                        <div style={body}>The app, unmoved by the longer line</div>
                    </div>
                    <DimensionRule label="One line always · ellipsis past the width" />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
