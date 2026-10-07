import { KissopenLoader } from "../../src/KissopenLoader";
import { SetupPage } from "../../src/SetupPage";
import { ComponentPage, DimensionRule, FullScreenSpecimen, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-290";

const column: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
};

const row: Record<string, string> = {
    display: "flex",
    alignItems: "flex-end",
    gap: "40px",
    flexWrap: "wrap",
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

/** The sizes the product asks for, on both sides of each simplification threshold. */
const SIZES: readonly number[] = [128, 96, 72, 56, 40, 32, 24];

/**
 * The first specimens are live, which is unusual for a blueprint page and is
 * the point of this one: the component is its motion. The still specimen and
 * the setup page below hold the drawn mark, so a screenshot of them is stable.
 */
export function KissopenLoaderPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="KissOpen VI loader: the two wedges approach by at most 2 units and return. Compact marks alternate opacity; reduced motion remains static."
            title="Kissopen loader"
        >
            <Specimen
                detail="1.6s · cubic-bezier(.4,0,.2,1) · ±2 units at 46–58% · slit never closes"
                label="Loop"
                number="01"
                stage="surface"
            >
                <div style={column}>
                    <div style={row}>
                        <div style={cell}>
                            <KissopenLoader label="Unframed loader" size={160} />
                            <span style={caption}>unframed · 160</span>
                        </div>
                        <div style={cell}>
                            <KissopenLoader framed label="Framed loader" size={128} />
                            <span style={caption}>framed · 128</span>
                        </div>
                    </div>
                    <DimensionRule label="1.6s loop · 12-unit slit · at most 2 units inward per wedge" />
                </div>
            </Specimen>

            <Specimen
                detail="Identical geometry at every size; at 24px and below use a 1.2s opacity relay"
                label="Sizes"
                number="02"
                stage="surface"
            >
                <div style={row}>
                    {SIZES.map((size) => (
                        <div key={size} style={cell}>
                            <KissopenLoader label={`${String(size)} pixel loader`} size={size} />
                            <span style={caption}>{size}px</span>
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="motion=still and reduced motion show the unmodified mark at rest, without glow"
                label="Still"
                number="03"
                stage="surface"
            >
                <div style={row}>
                    {[96, 56, 32].map((size) => (
                        <div key={size} style={cell}>
                            <KissopenLoader
                                label={`Still ${String(size)} pixel loader`}
                                motion="still"
                                size={size}
                            />
                            <span style={caption}>still · {size}px</span>
                        </div>
                    ))}
                    <div style={cell}>
                        <KissopenLoader
                            framed
                            label="Still framed loader"
                            motion="still"
                            size={96}
                        />
                        <span style={caption}>still · framed</span>
                    </div>
                </div>
            </Specimen>

            <FullScreenSpecimen
                detail="Under a restart's copy: a loop rather than a play-once scene, because a held last frame under copy still saying “shutting down” reads as the restart having stalled"
                label="In a setup page"
                number="04"
            >
                <SetupPage
                    copy="Letting the agent finish what it is holding before it goes away."
                    loader="relay"
                    title="Restarting KISSOPEN Agent"
                />
            </FullScreenSpecimen>
        </ComponentPage>
    );
}
