import { KissopenLockup } from "../../src/KissopenShell";
import { KissopenMark } from "../../src/KissopenMark";
import { NightSkyShader } from "../../src/NightSkyShader";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-304";

const row: Record<string, string> = {
    display: "flex",
    alignItems: "flex-end",
    gap: "32px",
    flexWrap: "wrap",
};

const column: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
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

/** Both sides of each simplification threshold, plus the sizes the product uses. */
const SIZES: readonly number[] = [160, 128, 96, 72, 40, 32, 24, 16];
const FRAMED_SIZES: readonly number[] = [128, 96, 64, 40, 32, 16];
const LOCKUP_HEIGHTS: readonly number[] = [16, 18, 30, 48];

export function KissopenMarkPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The official KissOpen double-wedge mark: fixed geometry, Blurple, no glow. The outlined wordmark is shared by every language."
            title="Kissopen mark"
        >
            <Specimen
                detail="Unframed · viewBox 13.5 14.5 37 35 · stroke 5 · round joins · no glow"
                label="Sizes"
                number="01"
                stage="surface"
            >
                <div style={column}>
                    <div style={row}>
                        {SIZES.map((size) => (
                            <div key={size} style={cell}>
                                <KissopenMark size={size} />
                                <span style={caption}>{size}px</span>
                            </div>
                        ))}
                    </div>
                    <DimensionRule label="Same geometry at every size · minimum 16px" />
                </div>
            </Specimen>

            <Specimen
                detail="Official app icon · Deep Indigo ground · 23% corner radius · 66% mark coverage"
                label="Framed"
                number="02"
                stage="surface"
            >
                <div style={row}>
                    {FRAMED_SIZES.map((size) => (
                        <div key={size} style={cell}>
                            <KissopenMark framed size={size} />
                            <span style={caption}>{size}px</span>
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="Blurple remains unchanged over both appearances. Use the light monochrome mark for low-contrast imagery."
                label="On the sky"
                number="03"
                stage="surface"
            >
                <div
                    style={{
                        display: "flex",
                        position: "relative",
                        width: "480px",
                        height: "220px",
                    }}
                >
                    <NightSkyShader motion="still" style={{ width: "480px", height: "220px" }} />
                    <div
                        style={{
                            // Laid over the backdrop: a centred flex row on top of the canvas.
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "48px",
                        }}
                    >
                        <KissopenMark size={128} tone="sky" />
                        <KissopenMark size={72} tone="sky" />
                    </div>
                </div>
            </Specimen>

            <Specimen
                detail="Official outlined Chakra Petch lockup · unchanged across languages · theme-specific light and dark assets"
                label="Lockup"
                number="04"
                stage="surface"
            >
                <div style={column}>
                    {LOCKUP_HEIGHTS.map((height) => (
                        <div
                            key={height}
                            style={{
                                ...row,
                                alignItems: "center",
                                ["--kissopen-lockup-height" as string]: `${String(height)}px`,
                            }}
                        >
                            <span style={{ ...caption, width: "48px" }}>{height}px</span>
                            <KissopenLockup language="zh" />
                            <KissopenLockup language="en" />
                        </div>
                    ))}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
