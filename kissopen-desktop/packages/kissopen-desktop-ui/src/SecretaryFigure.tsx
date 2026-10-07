import { secretaryStillUrl, secretaryVideoUrl } from "./assets";

interface SecretaryFigureProps {
    /** What the figure stands beside, for assistive technology; the picture itself says nothing more. */
    readonly label: string;
    /** Edge of the round portrait, in pixels. */
    readonly size: number;
    /**
     * `still` shows one frame instead of the loop, for a blueprint or test that
     * must look the same every time. The product leaves it to the person's
     * motion preference.
     */
    readonly motion?: "auto" | "still";
}

/*
React sets `muted` as a property, not as the attribute, and Chromium decides
whether a clip may start on its own from the attribute: left to `autoPlay` the
loop sat on its first frame. Muted and started here, it plays like any silent
clip; a refusal leaves the poster, which is the still frame anyway.
*/
function startSilently(video: HTMLVideoElement | null): void {
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    void video.play().catch(() => undefined);
}

/**
 * 小秘书, the product's own face on the pages where it speaks for itself —
 * setting up, starting, reconnecting. A short loop of her waving, silent, in a
 * round portrait; a person who has asked the system for less motion sees one
 * still frame of it instead.
 */
export function SecretaryFigure(props: SecretaryFigureProps) {
    const still =
        props.motion === "still" ||
        (typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return (
        <span
            aria-label={props.label}
            className="kissopen-secretary-figure"
            data-kissopen-desktop-ui="secretary-figure"
            role="img"
            style={{ width: props.size, height: props.size }}
        >
            {still ? (
                <img
                    alt=""
                    className="kissopen-secretary-figure__media"
                    draggable={false}
                    src={secretaryStillUrl}
                />
            ) : (
                <video
                    aria-hidden="true"
                    autoPlay
                    className="kissopen-secretary-figure__media"
                    disablePictureInPicture
                    loop
                    muted
                    playsInline
                    poster={secretaryStillUrl}
                    preload="auto"
                    ref={startSilently}
                    src={secretaryVideoUrl}
                />
            )}
        </span>
    );
}
