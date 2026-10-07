import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { KissopenLogoIntro } from "./KissopenLogoIntro";
import { SegmentedProgress, type SegmentedProgressSegment } from "./SegmentedProgress";
import { WindowDragRegion } from "./TitleBar";

export interface SplashScreenProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    /** Accessible name for the mark, e.g. the product it is starting. */
    readonly label?: string;
    /**
     * A single quiet reassurance line under the mark, e.g. "Still starting KISSOPEN Agent…".
     * Absent by default: most loads resolve before there is anything worth
     * saying, and the mark stays optically centered whether or not this is set.
     */
    readonly note?: string;
    /**
     * The named steps of the start this screen is covering, and where it has
     * got to in them. Absent by default, for the same reason the note is: a load
     * that resolves in a few frames has nothing to report, and the steps belong
     * to whatever is running them rather than to this screen.
     */
    readonly steps?: readonly SegmentedProgressSegment[];
    /** Names the sequence for a screen reader when steps are shown. */
    readonly stepsLabel?: string;
    /**
     * `still` shows the logo animation's finished frame from the start, for a
     * blueprint or a screenshot. Reduced motion does the same on its own.
     */
    readonly motion?: "auto" | "still";
}

/** The finished app-icon tile's side: large enough for the full four-turn roll. */
const SPLASH_MARK_SIZE = 96;

/**
 * C-161 SplashScreen — what the window holds while the app decides what to show:
 * the workspace surface with the KissOpen logo animation centered on it, and
 * nothing else by default. The paper's edge runs in and rolls up, the app-icon
 * tile lands over it, and the finished mark holds for as long as the screen is
 * up (see `KissopenLogoIntro`). The animation keeps one clock for the whole
 * window, so a start that passes the splash from the startup screen to the boot
 * cover to the router plays one continuous intro instead of restarting it.
 *
 * It carries no spinner; the optional `note` and `steps` exist for the case that
 * isn't instant — a local KISSOPEN Agent that has to start — and neither shifts
 * the mark's position when it appears. They are held back for the first moments
 * by the stylesheet rather than by a timer here, so a start that resolves
 * quickly shows the mark alone and a start that does not explains itself. The
 * owner crossfades this screen to whatever resolves — the sign-in card or the
 * workspace — so the mark dissolves rather than cutting away. Props only: no
 * timers and no product state.
 */
export function SplashScreen(props: SplashScreenProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "label",
        "note",
        "steps",
        "stepsLabel",
        "motion",
    ]);
    return (
        <div
            className={["kissopen-splash-screen", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="splash-screen"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <WindowDragRegion />
            <div className="kissopen-splash-screen__body">
                <KissopenLogoIntro
                    className="kissopen-splash-screen__mark"
                    data-kissopen-desktop-ui="splash-screen-mark"
                    label={local.label ?? t("KissOpen")}
                    motion={local.motion}
                    size={SPLASH_MARK_SIZE}
                />
                {local.note !== undefined || local.steps !== undefined ? (
                    <div
                        className="kissopen-splash-screen__below"
                        data-kissopen-desktop-ui="splash-screen-below"
                    >
                        {local.steps !== undefined ? (
                            <SegmentedProgress
                                data-testid="splash-screen-progress"
                                label={local.stepsLabel ?? t("Startup progress")}
                                segments={local.steps}
                            />
                        ) : null}
                        {local.note !== undefined ? (
                            <div
                                className="kissopen-splash-screen__note"
                                data-kissopen-desktop-ui="splash-screen-note"
                            >
                                {local.note}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
