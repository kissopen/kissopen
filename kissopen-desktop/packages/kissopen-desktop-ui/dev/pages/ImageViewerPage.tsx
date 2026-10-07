import { type ReactNode } from "react";
import { Button } from "../../src/Button";
import { ImageViewer } from "../../src/ImageViewer";
import { Ionicon } from "../../src/vectorIcons/VectorIcon";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-235";

/* Deterministic, offline specimens: inline SVG, so the workbench never waits on
   a network fetch to take a screenshot and every run measures the same pixels. */
function svg(width: number, height: number, body: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">${body}</svg>`,
    )}`;
}

/** Larger than any specimen frame: opens fitted, and pans once magnified. */
const wide = svg(
    1600,
    1000,
    `<rect width="1600" height="1000" fill="#1f2a44"/>
     <circle cx="480" cy="380" r="220" fill="#2baccc"/>
     <rect x="760" y="520" width="640" height="340" rx="28" fill="#e0a458"/>
     <path d="M0 1000 L500 620 L900 1000 Z" fill="#3fb950"/>`,
);
/** Smaller than the frame: fitting must not magnify it into a blur. */
const tiny = svg(
    48,
    48,
    `<rect width="48" height="48" rx="8" fill="#2baccc"/>
     <path d="M12 30 L22 18 L30 28 L36 22 L36 36 L12 36 Z" fill="#ffffff"/>`,
);
/** Transparent everywhere but the mark, so the checker behind it is the subject. */
const transparent = svg(
    320,
    320,
    `<circle cx="160" cy="160" r="120" fill="none" stroke="#e0a458" stroke-width="24"/>
     <path d="M160 70 L160 250 M70 160 L250 160" stroke="#2baccc" stroke-width="18"/>`,
);

function frame(children: ReactNode, height = 360, width = 560) {
    return (
        <div
            style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: "10px",
                height: `${String(height)}px`,
                overflow: "hidden",
                width: `${String(width)}px`,
            }}
        >
            {children}
        </div>
    );
}

export function ImageViewerPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One picture, looked at properly: a frame that fills its region and a 40px tool bar that states the magnification and changes it. Pinch or Cmd-wheel magnifies under the pointer, a scroll or a drag moves a magnified picture, and 0, 1, +, - and the arrows do the same from the keyboard."
            title="ImageViewer"
        >
            <Specimen
                detail="Opens fitted · 40px tool bar · drag to pan once magnified"
                label="Larger than the frame"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <ImageViewer content={{ type: "url", url: wide }} name="relay-field.svg" />,
                    )}
                    <DimensionRule label="560 × 360 px region · 40 px tool bar" />
                </div>
            </Specimen>

            <Specimen
                detail="Fitting never magnifies: 48 px stays 48 px"
                label="Smaller than the frame"
                number="02"
                stage="surface"
            >
                {frame(<ImageViewer content={{ type: "url", url: tiny }} name="badge.svg" />, 240)}
            </Specimen>

            <Specimen
                detail="The checker rides the picture rather than the room, and keeps its step in both appearances"
                label="Transparency"
                number="03"
                stage="surface"
            >
                {frame(
                    <ImageViewer content={{ type: "url", url: transparent }} name="target.svg" />,
                    280,
                )}
            </Specimen>

            <Specimen
                detail="A host that has a window of its own contributes the control; elsewhere it is absent, not inert"
                label="Host action"
                number="04"
                stage="surface"
            >
                {frame(
                    <ImageViewer
                        actions={
                            <>
                                <Button
                                    aria-label="Open in a new window"
                                    iconOnly
                                    size="small"
                                    variant="ghost"
                                >
                                    <Ionicon name="open-outline" size={14} />
                                </Button>
                                <span className="kissopen-image-viewer__divider" />
                            </>
                        }
                        content={{ type: "url", url: wide }}
                        name="relay-field.svg"
                    />,
                    280,
                )}
            </Specimen>

            <Specimen
                detail='tone="immersive" · no frame and no ruled bar of its own — the dark around it is the room, as in the full-window Lightbox'
                label="Immersive tone"
                number="05"
                stage="surface"
            >
                <div className="kissopen-theme-dark" style={{ display: "flex" }}>
                    <div
                        style={{
                            background: "var(--surface-high)",
                            display: "flex",
                            height: "280px",
                            overflow: "hidden",
                            width: "560px",
                        }}
                    >
                        <ImageViewer
                            content={{ type: "url", url: wide }}
                            name="relay-field.svg"
                            tone="immersive"
                        />
                    </div>
                </div>
            </Specimen>

            <Specimen
                detail="Opening, unviewable, and failed — one shape of answer"
                label="States"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(<ImageViewer content={{ type: "loading" }} name="scan.tiff" />, 200)}
                    {frame(
                        <ImageViewer content={{ type: "unavailable" }} name="archive.tar.gz" />,
                        200,
                    )}
                    {frame(
                        <ImageViewer
                            content={{
                                type: "error",
                                message: "The file is no longer in the workspace.",
                            }}
                            name="removed.png"
                        />,
                        200,
                    )}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
