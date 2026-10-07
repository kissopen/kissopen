import { type ReactNode } from "react";
import { Button } from "../../src/Button";
import { VideoViewer } from "../../src/VideoViewer";
import { Ionicon } from "../../src/vectorIcons/VectorIcon";
import { ComponentPage, DimensionRule, Specimen } from "../kit";
import { videoClipOpen, videoClipPortrait, videoClipWide } from "./videoClips";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-236";

function frame(children: ReactNode, height = 340, width = 560) {
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

export function VideoViewerPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One recording, played properly: a frame that fills its region and a control panel that floats over the bottom of it. The panel states where the recording is and what is left of it, and leaves while the recording plays and nobody is touching it. Space plays, the arrows seek and set the level, J and L jump ten seconds, M mutes, F fills the screen, and the digits jump through the recording by tenths."
            title="VideoViewer"
        >
            <Specimen
                detail="Paused, so the panel is up · 12 px inset · 6 px radius · elapsed, track, and length"
                label="At rest"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(
                        <VideoViewer
                            content={{ type: "url", url: videoClipWide }}
                            name="capture.webm"
                        />,
                    )}
                    <DimensionRule label="560 × 340 px region · panel inset 12 px on three sides" />
                </div>
            </Specimen>

            <Specimen
                detail="Fitted to the frame, proportions kept: a tall recording letterboxes at its sides"
                label="Portrait"
                number="02"
                stage="surface"
            >
                {frame(
                    <VideoViewer
                        content={{ type: "url", url: videoClipPortrait }}
                        name="handheld.webm"
                    />,
                    340,
                    420,
                )}
            </Specimen>

            <Specimen
                detail="Under 400 px the level goes and mute stays: the capability survives, the room does not"
                label="In a side panel"
                number="03"
                stage="surface"
            >
                {frame(
                    <VideoViewer
                        content={{ type: "url", url: videoClipWide }}
                        name="capture.webm"
                    />,
                    300,
                    280,
                )}
            </Specimen>

            <Specimen
                detail="No length in the file, so there is no position to point at along one — the track is inert and says so"
                label="Open-ended"
                number="04"
                stage="surface"
            >
                {frame(
                    <VideoViewer
                        content={{ type: "url", url: videoClipOpen }}
                        name="stream.webm"
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="A host with a window of its own contributes the control; elsewhere it is absent, not inert"
                label="Host action"
                number="05"
                stage="surface"
            >
                {frame(
                    <VideoViewer
                        actions={
                            <Button
                                aria-label="Open in a new window"
                                iconOnly
                                size="small"
                                variant="ghost"
                            >
                                <Ionicon name="open-outline" size={14} />
                            </Button>
                        }
                        content={{ type: "url", url: videoClipWide }}
                        name="capture.webm"
                    />,
                    300,
                )}
            </Specimen>

            <Specimen
                detail="Opening, unplayable, and failed — one shape of answer, and no controls over any of them"
                label="States"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {frame(<VideoViewer content={{ type: "loading" }} name="capture.mov" />, 180)}
                    {frame(
                        <VideoViewer content={{ type: "unavailable" }} name="archive.tar.gz" />,
                        180,
                    )}
                    {frame(
                        <VideoViewer
                            content={{
                                type: "error",
                                message: "The file is no longer in the workspace.",
                            }}
                            name="removed.mp4"
                        />,
                        180,
                    )}
                </div>
            </Specimen>

            <Specimen
                detail="A format this build has no decoder for is said plainly, and is never offered somewhere else to try"
                label="Nothing can play it"
                number="07"
                stage="surface"
            >
                {frame(
                    <VideoViewer
                        content={{ type: "url", url: "data:video/x-fictional;base64,AAAA" }}
                        name="capture.mkv"
                    />,
                    180,
                )}
            </Specimen>
        </ComponentPage>
    );
}
