import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import {
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Menu } from "./Menu";
import { Spinner } from "./Spinner";
import { Ionicon } from "./vectorIcons/VectorIcon";

/** What the viewer is looking at, once the caller has resolved the recording. */
export type VideoViewerContent =
    | { readonly type: "loading" }
    | { readonly type: "error"; readonly message: string }
    /** An address the browser can stream: an app-served asset or an object URL. */
    | { readonly type: "url"; readonly url: string }
    /** Nothing to show — the bytes are not a video this surface can play. */
    | { readonly type: "unavailable" };

export type VideoViewerProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    content: VideoViewerContent;
    /** Accessible name of the recording — usually the file's name. */
    name: string;
    /**
     * Trailing controls in the bar, e.g. Open in a window of its own. Drawn only
     * while there is something to play: a recording this build cannot decode is
     * not one another window of ours would have better luck with.
     */
    actions?: ReactNode;
    /**
     * Takes keyboard focus on mount. For a surface that is only this recording —
     * a window of its own — so its transport keys work without a click first.
     */
    autoFocus?: boolean;
    /** Reported once metadata arrives, so the caller can state the frame size. */
    onNaturalSize?: (size: { readonly width: number; readonly height: number }) => void;
};

/** How far the arrow keys and the timeline's own keys move through a recording. */
const SEEK_STEP = 5;
/** The longer jump, on the keys a video player has always put it on. */
const SEEK_STEP_LONG = 10;
const VOLUME_STEP = 0.05;
/** The speeds worth offering: half and double, approached in readable quarters. */
const RATES: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** Where an unrecognized rate is treated as sitting when stepping from it. */
const RATE_NORMAL = RATES.indexOf(1);
/**
 * How long the controls stay up after the pointer stops. Long enough to cross
 * the bar and press something, short enough that the picture is not permanently
 * half-covered by a bar nobody is using.
 */
const CONTROLS_IDLE_MS = 2500;
/**
 * The coarsest the idle question is ever asked. A pointer crossing the frame
 * reports dozens of times a second, and re-arming a timer on each report would
 * be a timer churning at pointer rate to answer something that only changes
 * every couple of seconds. Instead one timer runs and re-arms itself for the
 * time actually remaining.
 */
const IDLE_TICK_MS = 500;

interface VideoSize {
    readonly width: number;
    readonly height: number;
}

/**
 * What the reader chose, which belongs to them rather than to a file: the same
 * hand that muted one recording expects the next one to still be muted. It
 * therefore survives a change of source, while everything about the playback
 * itself does not.
 */
interface VideoSettings {
    readonly volume: number;
    readonly muted: boolean;
    readonly rate: number;
    /** Whether the trailing readout counts down rather than stating the length. */
    readonly remaining: boolean;
}

const SETTINGS_INITIAL: VideoSettings = { volume: 1, muted: false, rate: 1, remaining: false };

/**
 * Where the recording is, as its own events reported it.
 *
 * Every field is a projection of the media element rather than a second opinion
 * about it: a command sets a property on the element, the element says what
 * happened, and this is what it said. That is why there is no animation loop
 * here — the element already reports time, buffering, volume, rate and failure,
 * and any clock this viewer ran itself would eventually disagree with it.
 *
 * It is keyed by the address so a different recording starts clean without an
 * effect to reset it: state that does not belong to this URL is simply not this
 * URL's state.
 */
interface VideoPlaybackState {
    readonly url: string;
    readonly status: "opening" | "ready" | "failed" | "blocked";
    /** Why it failed, in the reader's terms. Present only when `failed`. */
    readonly failure?: string;
    /** Seconds, or non-finite while unknown — metadata pending, or open-ended. */
    readonly duration: number;
    readonly time: number;
    /** The run holding `time` that has arrived, as `[from, to]` in seconds. */
    readonly buffered: readonly [number, number];
    readonly playing: boolean;
    /** Playback is held up by the network or the decoder rather than by a person. */
    readonly waiting: boolean;
    readonly ended: boolean;
    readonly natural?: VideoSize;
    readonly pictureInPicture: boolean;
}

function playbackInitial(url: string): VideoPlaybackState {
    return {
        url,
        status: "opening",
        duration: Number.NaN,
        time: 0,
        buffered: [0, 0],
        playing: false,
        waiting: false,
        ended: false,
        pictureInPicture: false,
    };
}

/** Whether a length is a real one, as opposed to pending or open-ended. */
function lengthKnown(duration: number): boolean {
    return Number.isFinite(duration) && duration > 0;
}

/**
 * A position in the recording, written the way a person reads one. Hours appear
 * only when there are hours, so a two-minute clip is not padded out to `0:01:07`.
 */
function timeFormat(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = whole % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return hours > 0
        ? `${String(hours)}:${pad(minutes)}:${pad(rest)}`
        : `${String(minutes)}:${pad(rest)}`;
}

/**
 * The same position, said out loud rather than drawn. It floors for the reason
 * the clock does: a reader told "2 minutes 46 seconds" while the clock beside it
 * reads 2:45 has been given two different answers to one question.
 */
function timeSpoken(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0 seconds";
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    const parts: string[] = [];
    if (minutes > 0) parts.push(`${String(minutes)} minute${minutes === 1 ? "" : "s"}`);
    if (rest > 0 || minutes === 0) parts.push(`${String(rest)} second${rest === 1 ? "" : "s"}`);
    return parts.join(" ");
}

/** A speed, written as the multiplier it is: `1×`, `1.25×`, `2×`. */
function rateFormat(rate: number): string {
    return `${String(Number(rate.toFixed(2)))}×`;
}

/**
 * Why a recording will not play, in the reader's terms rather than the standard's.
 *
 * The unsupported case is the one worth naming carefully. No engine separates
 * "these bytes are not a format I know" from "no bytes I could use arrived":
 * Chromium reports both as `DEMUXER_ERROR_COULD_NOT_OPEN`, and WebKit says
 * nothing at all. So the message names both possibilities rather than asserting
 * the one it cannot actually tell. What it must not do is suggest trying again
 * somewhere else, since the window it would open runs the very same decoders —
 * which is also why the transport, and the host's own actions with it, are not
 * drawn over a failure at all.
 */
function failureMessage(error: MediaError | null): string {
    switch (error?.code) {
        case 1:
            return "Playback was stopped before the video could be read.";
        case 2:
            return "The video could not be loaded from the workspace.";
        case 3:
            return "The video is damaged, or its data could not be decoded.";
        case 4:
            return "KissOpen cannot play this video: its format is one this build cannot decode, or the file did not arrive.";
        default:
            return "The video could not be played.";
    }
}

/**
 * The run of the recording that has arrived around `time`, as a pair.
 *
 * Both ends are kept rather than only the far one. Seeking into a part of a long
 * file that has not been fetched leaves a hole behind the playhead, and a bar
 * drawn from zero to the far end would claim that hole had arrived — which is a
 * statement about the transfer that is simply not true.
 */
function bufferedRun(ranges: TimeRanges, time: number): readonly [number, number] {
    for (let index = 0; index < ranges.length; index += 1) {
        const start = ranges.start(index);
        const end = ranges.end(index);
        if (start <= time + 0.25 && end >= time) return [start, end];
    }
    return [0, 0];
}

/**
 * The part of the recording that can be moved to now.
 *
 * A file of known length can be moved to anywhere in it. An open-ended one can
 * only be moved within the window the engine is still holding, and that window
 * does not have to begin at zero: a live stream that has been running for an
 * hour may only reach back a few minutes. Asking for zero there is asking for
 * something that no longer exists.
 */
function seekableRange(
    element: HTMLVideoElement,
    duration: number,
): readonly [number, number] | undefined {
    if (lengthKnown(duration)) return [0, duration];
    const ranges = element.seekable;
    if (ranges.length === 0) return undefined;
    const start = ranges.start(0);
    const end = ranges.end(ranges.length - 1);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : undefined;
}

/**
 * C-236 VideoViewer — one recording, played properly.
 *
 * The single video surface in the product: the file viewer's video branch and
 * the desktop's separate preview window are both this component, so the
 * transport, the timeline and the keyboard behave the same wherever a recording
 * is opened. It fills whatever region it is given and never fetches the file
 * itself — the caller resolves the address, and the browser's own media pipeline
 * streams it by range from there. Nothing is buffered, decoded, or re-encoded in
 * JavaScript on the way, so a two-hour capture costs what watching the part you
 * are watching costs.
 *
 * Every reading it shows comes from a media event. There is no animation loop
 * and nothing is polled: the element reports time, buffering, volume, rate and
 * failure, and the controls are a drawing of what it last said.
 */
export function VideoViewer(props: VideoViewerProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "content",
        "name",
        "actions",
        "autoFocus",
        "onNaturalSize",
    ]);
    const root = useRef<HTMLDivElement>(null);
    const frameElement = useRef<HTMLDivElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const [settings, setSettings] = useState<VideoSettings>(SETTINGS_INITIAL);
    const [state, setState] = useState<VideoPlaybackState>(() => playbackInitial(""));
    const [fullscreen, setFullscreen] = useState(false);
    // What a keyboard command settled on, said out loud once. The bar states
    // these facts in view of anyone who can see it; a key pressed on the picture
    // is the case where nothing changes near where the reader is looking.
    const [spoken, setSpoken] = useState("");
    // Whether the pointer has been over the picture recently. The bar also comes
    // back for a paused recording and for focus, which are decided from the
    // state below and in CSS, so this is only the pointer's part of the answer.
    const [stirred, setStirred] = useState(true);
    const [rateMenuOpen, setRateMenuOpen] = useState(false);
    /** Whether the pointer is on the controls themselves, which pins them up. */
    const [overControls, setOverControls] = useState(false);
    // A drag in progress, remembered against the recording it is dragging: if the
    // source is replaced mid-drag, a position measured against the old length
    // must not be drawn over the new one.
    const [scrub, setScrub] = useState<{
        readonly pointerId: number;
        readonly time: number;
        readonly url: string;
    }>();

    const url = local.content.type === "url" ? local.content.url : "";
    // State from a previous address is not this address's state. Comparing here
    // rather than resetting in an effect keeps the first frame of a new
    // recording correct instead of showing the previous one's position for a beat.
    const live = state.url === url ? state : playbackInitial(url);
    const duration = live.duration;
    const known = lengthKnown(duration);
    const showing =
        local.content.type === "url" && live.status !== "failed" && live.status !== "opening";
    // While a scrub is in the reader's hand the timeline follows the hand rather
    // than the decoder: a seek across a long file resolves in its own time, and a
    // handle that snapped back to the last decoded position under the finger
    // would feel like the recording was fighting the drag.
    const dragging = scrub?.url === url ? scrub : undefined;
    const position = dragging?.time ?? live.time;

    /**
     * What a replacement element must be born with. The element is the authority
     * on volume, rate and mute — this only says what to hand the next one, since
     * a new source is a new element and a new element starts at the defaults.
     */
    const born = useRef(settings);
    // eslint-disable-next-line kissopen-react/no-layout-effect -- the committed settings are what the create-once attach callback below must see; assigning them here rather than during render leaves render itself pure
    useLayoutEffect(() => {
        born.current = settings;
    });

    const stateSet = (change: Partial<VideoPlaybackState>): void => {
        setState((previous) => ({
            ...(previous.url === url ? previous : playbackInitial(url)),
            ...change,
        }));
    };

    /* ---- Idleness ---------------------------------------------------------
     * When the pointer was last seen, and the one timer watching for it to stop.
     * Neither is drawn from directly, so neither is state: they only decide when
     * `stirred` turns over.
     */
    const stirredAt = useRef(0);
    const idleTimer = useRef<ReturnType<typeof setTimeout>>(null);

    const idleWatch = (): void => {
        if (idleTimer.current !== null) return;
        idleTimer.current = setTimeout(function tick() {
            const since = Date.now() - stirredAt.current;
            if (since < CONTROLS_IDLE_MS) {
                idleTimer.current = setTimeout(
                    tick,
                    Math.max(IDLE_TICK_MS, CONTROLS_IDLE_MS - since),
                );
                return;
            }
            idleTimer.current = null;
            setStirred(false);
        }, CONTROLS_IDLE_MS);
    };

    /** The picture was touched, so the controls are wanted for a while yet. */
    const stir = (): void => {
        stirredAt.current = Date.now();
        if (!stirred) setStirred(true);
        idleWatch();
    };

    /* ---- Commands ---------------------------------------------------------
     * Each one asks the element and then claims nothing about the result: the
     * element answers with an event, and that event is what moves the drawing.
     */

    const playToggle = (): void => {
        const element = video.current;
        if (!element || !showing) return;
        // Pressing play is a reason to see the controls, and a reason for them
        // to start counting down again once playback is under way.
        stir();
        if (element.paused) {
            // A recording watched to the end and pressed again starts over,
            // which is what pressing play on a finished thing has always meant.
            if (live.ended) element.currentTime = 0;
            void element.play().catch((error: unknown) => {
                // A refusal is the browser's to make and worth saying plainly.
                // Anything else has already arrived as an `error` event.
                if (error instanceof DOMException && error.name === "NotAllowedError")
                    stateSet({ status: "blocked" });
            });
            return;
        }
        element.pause();
    };

    /**
     * Clicking the picture, which is both how most recordings get started and
     * how the viewer is handed the keyboard.
     *
     * The surface that takes the click is a button, and a clicked button takes
     * focus. Left there, focus would sit on a control that is out of the tab
     * order and answers nothing but Space — so a reader who clicked to play and
     * then pressed an arrow key would find the transport dead. Focus belongs on
     * the frame, which is the focusable stand-in for the picture and the element
     * that answers every transport key.
     */
    const pictureActivate = (): void => {
        frameElement.current?.focus({ preventScroll: true });
        playToggle();
    };

    const seekTo = (seconds: number): void => {
        const element = video.current;
        if (!element || !showing) return;
        const range = seekableRange(element, duration);
        // An open-ended recording states its end as `Infinity`, as `NaN`, or not
        // at all depending on the engine, and offers no window at all until it
        // has one — all of which mean the same thing: there is nothing to hold a
        // target inside, so the target stands as asked. What must not happen
        // either way is handing the element something that is not a number,
        // which is a thrown exception rather than a seek.
        const target = range ? Math.min(Math.max(seconds, range[0]), range[1]) : seconds;
        if (!Number.isFinite(target) || target < 0) return;
        element.currentTime = target;
    };

    const seekBy = (delta: number): void => {
        const element = video.current;
        if (element) seekTo(element.currentTime + delta);
    };

    const volumeSet = (value: number): number => {
        const element = video.current;
        const next = Math.min(1, Math.max(0, value));
        if (!element) return next;
        element.volume = next;
        // Moving the level off zero is how a person unmutes, and leaving the
        // mute flag set would make the control appear not to work at all.
        element.muted = next === 0;
        return next;
    };

    const muteToggle = (): void => {
        const element = video.current;
        if (!element) return;
        // Unmuting something whose level is also zero has to give it one back,
        // or the reader presses the button and still hears nothing.
        if (element.muted && element.volume === 0) element.volume = 0.5;
        element.muted = !element.muted;
    };

    const rateSet = (rate: number): void => {
        const element = video.current;
        if (element) element.playbackRate = rate;
    };

    const rateStep = (direction: 1 | -1): void => {
        const from = RATES.indexOf(settings.rate);
        const next =
            RATES[
                Math.min(RATES.length - 1, Math.max(0, (from < 0 ? RATE_NORMAL : from) + direction))
            ];
        if (next === undefined) return;
        rateSet(next);
        setSpoken(rateFormat(next));
    };

    const fullscreenToggle = (): void => {
        const element = root.current;
        if (!element) return;
        // The whole viewer goes full screen rather than the video element, so the
        // controls in full screen are these ones. Handing the element itself to
        // the browser would swap in a second, differently designed transport at
        // exactly the size where ours matters most.
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void element.requestFullscreen().catch(() => undefined);
    };

    const pictureInPictureToggle = (): void => {
        const element = video.current;
        if (!element) return;
        if (document.pictureInPictureElement)
            void document.exitPictureInPicture().catch(() => undefined);
        else void element.requestPictureInPicture().catch(() => undefined);
    };

    const wanted = local.autoFocus === true;
    // eslint-disable-next-line kissopen-react/no-layout-effect -- move real keyboard focus to the frame on mount
    useLayoutEffect(() => {
        if (wanted) frameElement.current?.focus({ preventScroll: true });
    }, [wanted]);

    /**
     * The media element, and everything about one that has to be done
     * imperatively: the properties that are not attributes, the two lifecycle
     * events React does not carry, and letting the decoder go when it goes.
     *
     * Created once, so React never sees a changed ref and tears the element down
     * mid-playback. The cleanup runs when the element really goes — the source
     * changed, or the viewer was closed.
     */
    const videoAttach = useRef((element: HTMLVideoElement | null) => {
        video.current = element;
        if (!element) return;
        // A new element is a new beginning, said rather than inferred. Keying the
        // readings by address during render is enough to draw a *different*
        // recording correctly, but not to reopen the *same* one: a file that
        // failed to decode and is opened again arrives at the address it failed
        // at, and stored state saying so would hold the old error over an element
        // that had not been given its chance to speak. The element knows which
        // address it was born for, so it is the one that says so.
        setState(playbackInitial(element.getAttribute("src") ?? ""));
        const start = born.current;
        element.volume = start.volume;
        element.muted = start.muted;
        element.playbackRate = start.rate;
        const entered = () => setState((previous) => ({ ...previous, pictureInPicture: true }));
        const left = () => setState((previous) => ({ ...previous, pictureInPicture: false }));
        element.addEventListener("enterpictureinpicture", entered);
        element.addEventListener("leavepictureinpicture", left);
        return () => {
            element.removeEventListener("enterpictureinpicture", entered);
            element.removeEventListener("leavepictureinpicture", left);
            // Stop the transfer and let the decoder go now rather than whenever
            // the element is collected: a viewer that has been closed must not
            // still be pulling a file across the proxy behind the reader.
            element.pause();
            element.removeAttribute("src");
            element.load();
            if (video.current === element) video.current = null;
        };
    }).current;

    /**
     * The viewer's own box, for the one thing only the document can report —
     * whether this is the element the browser has taken full screen — and for
     * retiring the idle timer when the viewer goes.
     */
    const rootAttach = useRef((element: HTMLDivElement | null) => {
        root.current = element;
        if (!element) return;
        const changed = () => setFullscreen(document.fullscreenElement === element);
        document.addEventListener("fullscreenchange", changed);
        return () => {
            document.removeEventListener("fullscreenchange", changed);
            if (idleTimer.current !== null) clearTimeout(idleTimer.current);
            idleTimer.current = null;
            if (root.current === element) root.current = null;
        };
    }).current;

    /* ---- Keys ------------------------------------------------------------- */

    const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        // Only the frame's own keys. A button or the timeline holding focus is
        // being operated on its own terms, and Space on a button has to press
        // that button rather than also start the recording behind it.
        if (event.target !== event.currentTarget) return;
        if (event.metaKey || event.ctrlKey || event.altKey || !showing) return;
        const key = event.key;
        // Both ends are asked for past what can exist, and `seekTo` brings them
        // back to the real edges — which for an open-ended recording are the
        // edges of the window still being held, not zero and the length.
        const seekEdge = (far: boolean): void => {
            const element = video.current;
            const range = element ? seekableRange(element, duration) : undefined;
            if (range) seekTo(far ? range[1] : range[0]);
            else if (!far) seekTo(0);
        };
        if (key === " " || key === "k") playToggle();
        else if (key === "ArrowLeft") seekBy(-SEEK_STEP);
        else if (key === "ArrowRight") seekBy(SEEK_STEP);
        else if (key === "j") seekBy(-SEEK_STEP_LONG);
        else if (key === "l") seekBy(SEEK_STEP_LONG);
        else if (key === "Home") seekEdge(false);
        else if (key === "End") seekEdge(true);
        else if (key === "ArrowUp")
            setSpoken(
                `Volume ${String(Math.round(volumeSet(settings.volume + VOLUME_STEP) * 100))}%`,
            );
        else if (key === "ArrowDown")
            setSpoken(
                `Volume ${String(Math.round(volumeSet(settings.volume - VOLUME_STEP) * 100))}%`,
            );
        else if (key === "m") {
            muteToggle();
            setSpoken(settings.muted ? "Sound on" : "Muted");
        } else if (key === "f") fullscreenToggle();
        else if (key === "p") pictureInPictureToggle();
        else if (key === "," || key === "<") rateStep(-1);
        else if (key === "." || key === ">") rateStep(1);
        else if (key >= "0" && key <= "9" && known) seekTo((duration * Number(key)) / 10);
        else return;
        // A key is a deliberate command, so the controls come back to show what
        // it did even when the pointer has been still for a while.
        stir();
        event.preventDefault();
    };

    /* ---- Drawing ---------------------------------------------------------- */

    // Only what the element itself reported. A failure the caller handed over
    // arrives as content and is drawn by the stage, which has no element to
    // reconcile it with.
    const failure = live.status === "failed" ? live.failure : undefined;
    // The bar is drawn only over something that can actually be played. A
    // recording that failed to decode, a file with no viewer, and one still
    // opening have nothing to transport, and a row of dead controls over a
    // failure notice would only invite pressing them.
    const controls =
        local.content.type === "url" && live.status !== "failed" && failure === undefined;
    // Never while the pointer is actually on the controls. The countdown measures
    // time since the pointer last moved, and a hand that has arrived at the
    // panel and stopped — on its way to press something — is exactly the case
    // where no more movement is coming. Letting it run out there would take the
    // controls away from under a hand already reaching for them.
    const idle =
        live.playing && !stirred && !rateMenuOpen && !overControls && dragging === undefined;

    return (
        <div
            {...rest}
            className={["kissopen-video-viewer", local.className].filter(Boolean).join(" ")}
            data-fullscreen={fullscreen ? "" : undefined}
            data-kissopen-desktop-ui="video-viewer"
            data-idle={idle ? "" : undefined}
            data-testid={local["data-testid"]}
            // The pointer is watched here, around the whole viewer, rather than
            // on the picture alone. The control panel floats over the picture but
            // is a sibling of it, so a hand reaching down from the picture to the
            // panel would otherwise be reported as having left — hiding the panel
            // out from under the very pointer travelling towards it, which puts
            // the controls beyond reach for as long as the recording plays.
            onPointerDown={stir}
            onPointerLeave={() => {
                // The pointer left the viewer altogether, which is a clearer
                // statement than waiting out the rest of its timer.
                stirredAt.current = 0;
                if (live.playing) setStirred(false);
            }}
            onPointerMove={stir}
            ref={rootAttach}
            style={local.style}
        >
            <div
                aria-label={t("{name}, video", { name: local.name })}
                className="kissopen-video-viewer__frame"
                data-kissopen-desktop-ui="video-viewer-frame"
                onKeyDown={keyDown}
                ref={frameElement}
                role="group"
                // The frame is where the transport keys are answered, so it has
                // to take keyboard focus for them to be reachable at all without
                // a pointer.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable playback surface
                tabIndex={0}
            >
                <VideoViewerStage
                    attach={videoAttach}
                    content={local.content}
                    failure={failure}
                    name={local.name}
                    onActivate={pictureActivate}
                    onFullscreen={fullscreenToggle}
                    onNaturalSize={local.onNaturalSize}
                    onSettings={setSettings}
                    onState={stateSet}
                    state={live}
                    url={url}
                />
            </div>
            {controls ? (
                <div
                    className="kissopen-video-viewer__bar"
                    data-kissopen-desktop-ui="video-viewer-bar"
                    onPointerEnter={() => setOverControls(true)}
                    onPointerLeave={() => setOverControls(false)}
                >
                    <VideoViewerTimeline
                        buffered={live.buffered}
                        disabled={!showing}
                        duration={duration}
                        name={local.name}
                        onScrub={setScrub}
                        onSeek={seekTo}
                        scrub={dragging}
                        time={position}
                        url={url}
                    />
                    <div
                        className="kissopen-video-viewer__transport"
                        data-kissopen-desktop-ui="video-viewer-transport"
                    >
                        <div className="kissopen-video-viewer__group">
                            <Button
                                aria-label={
                                    live.playing ? "Pause" : live.ended ? "Play again" : "Play"
                                }
                                disabled={!showing}
                                iconOnly
                                onClick={playToggle}
                                size="small"
                                variant="ghost"
                            >
                                <Ionicon name={live.playing ? "pause" : "play"} size={14} />
                            </Button>
                            <VideoViewerClock
                                duration={duration}
                                onToggle={() =>
                                    setSettings((previous) => ({
                                        ...previous,
                                        remaining: !previous.remaining,
                                    }))
                                }
                                remaining={settings.remaining}
                                time={position}
                            />
                        </div>
                        <div className="kissopen-video-viewer__group">
                            <VideoViewerVolume
                                disabled={!showing}
                                muted={settings.muted}
                                onMuteToggle={muteToggle}
                                onVolume={volumeSet}
                                volume={settings.volume}
                            />
                            <VideoViewerRate
                                disabled={!showing}
                                onOpen={setRateMenuOpen}
                                onRate={rateSet}
                                open={rateMenuOpen}
                                rate={settings.rate}
                            />
                            {document.pictureInPictureEnabled ? (
                                <Button
                                    aria-label={
                                        live.pictureInPicture
                                            ? "Bring the video back"
                                            : "Play in a floating window"
                                    }
                                    aria-pressed={live.pictureInPicture}
                                    disabled={!showing}
                                    iconOnly
                                    onClick={pictureInPictureToggle}
                                    size="small"
                                    variant="ghost"
                                >
                                    <Ionicon name="tv-outline" size={14} />
                                </Button>
                            ) : null}
                            {document.fullscreenEnabled ? (
                                <Button
                                    aria-label={fullscreen ? "Leave full screen" : "Full screen"}
                                    aria-pressed={fullscreen}
                                    iconOnly
                                    onClick={fullscreenToggle}
                                    size="small"
                                    variant="ghost"
                                >
                                    <Ionicon
                                        name={fullscreen ? "contract-outline" : "expand-outline"}
                                        size={14}
                                    />
                                </Button>
                            ) : null}
                            {/* Only once the element has actually opened the
                                file. The host's action is typically "open this
                                somewhere else", and offering it before the
                                decoder has spoken means offering it for a file
                                that may be about to prove undecodable — sending
                                the reader to a second window running the very
                                same decoders to watch it fail again. */}
                            {showing ? local.actions : null}
                        </div>
                    </div>
                </div>
            ) : null}
            {/* Said out loud, never drawn: a key pressed on the picture changes
                something the bar states plainly for anyone who can see it, and
                nowhere at all for anyone who cannot. */}
            <span
                aria-live="polite"
                className="kissopen-video-viewer__announcement"
                data-kissopen-desktop-ui="video-viewer-announcement"
                role="status"
            >
                {spoken}
            </span>
        </div>
    );
}

/**
 * The recording itself, or the reason there is none. Every state that cannot
 * play says so in the same centred notice, so a format nothing here can decode
 * and a file that is gone read as one kind of answer rather than two broken ones.
 */
function VideoViewerStage(props: {
    attach: (element: HTMLVideoElement | null) => void | (() => void);
    content: VideoViewerContent;
    failure?: string;
    name: string;
    onActivate: () => void;
    onFullscreen: () => void;
    onNaturalSize?: (size: VideoSize) => void;
    onSettings: (update: (previous: VideoSettings) => VideoSettings) => void;
    onState: (change: Partial<VideoPlaybackState>) => void;
    state: VideoPlaybackState;
    url: string;
}) {
    // Taken apart rather than read through `props`: the attach callback below is
    // handed to `ref`, and a props object with a ref among its members is one
    // that nothing else may be read from during render.
    const {
        attach,
        content,
        failure,
        name,
        onActivate,
        onFullscreen,
        onNaturalSize,
        onSettings,
        onState,
        state,
        url,
    } = props;
    if (content.type === "unavailable")
        return (
            <VideoViewerNotice
                detail={t("This file is not a video KissOpen can play.")}
                name={name}
                title={t("{name} has no preview", { name })}
            />
        );
    if (content.type === "loading") return <VideoViewerOpening name={name} />;
    // A failure the caller already knows about has no file behind it to mount.
    if (content.type === "error")
        return <VideoViewerNotice detail={content.message} name={name} tone="danger" />;
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a workspace file has no caption track to offer */}
            <video
                aria-label={name}
                className="kissopen-video-viewer__video"
                data-kissopen-desktop-ui="video-viewer-video"
                // A different recording is a different element. Putting a new
                // address on the same one leaves the previous transfer running
                // and its decoded frames held; this is a real lifetime boundary,
                // so it is written as one.
                key={url}
                onCanPlay={() => onState({ waiting: false })}
                onDurationChange={(event) => onState({ duration: event.currentTarget.duration })}
                onEnded={() => onState({ ended: true, playing: false, waiting: false })}
                onError={(event) =>
                    onState({
                        status: "failed",
                        failure: failureMessage(event.currentTarget.error),
                        playing: false,
                        waiting: false,
                    })
                }
                onLoadedMetadata={(event) => {
                    const element = event.currentTarget;
                    const natural = { width: element.videoWidth, height: element.videoHeight };
                    onNaturalSize?.(natural);
                    onState({ status: "ready", duration: element.duration, natural });
                }}
                // Nothing is waiting on the network once a person has stopped it
                // on purpose. Without this, a transfer that stalls while paused
                // leaves a spinner turning over a still frame with no `playing`
                // event ever coming to take it down.
                onPause={() => onState({ playing: false, waiting: false })}
                onPlay={() => onState({ playing: true, ended: false, status: "ready" })}
                onPlaying={() => onState({ playing: true, waiting: false })}
                onProgress={(event) => {
                    const element = event.currentTarget;
                    onState({ buffered: bufferedRun(element.buffered, element.currentTime) });
                }}
                onRateChange={(event) => {
                    const rate = event.currentTarget.playbackRate;
                    onSettings((previous) => ({ ...previous, rate }));
                }}
                onSeeked={(event) => {
                    const element = event.currentTarget;
                    onState({
                        time: element.currentTime,
                        buffered: bufferedRun(element.buffered, element.currentTime),
                        waiting: false,
                    });
                }}
                // A stall is only a wait if something was expected to be moving.
                onStalled={(event) => {
                    if (!event.currentTarget.paused) onState({ waiting: true });
                }}
                onTimeUpdate={(event) => {
                    const element = event.currentTarget;
                    onState({
                        time: element.currentTime,
                        buffered: bufferedRun(element.buffered, element.currentTime),
                    });
                }}
                onVolumeChange={(event) => {
                    const volume = event.currentTarget.volume;
                    const muted = event.currentTarget.muted;
                    onSettings((previous) => ({ ...previous, volume, muted }));
                }}
                onWaiting={() => onState({ waiting: true })}
                playsInline
                // Only enough to learn the shape and the length of the file. The
                // rest arrives by range as it is watched, which is the whole
                // reason the media element does the fetching and this does not.
                preload="metadata"
                ref={attach}
                src={content.url}
            />
            {/* The picture is also the play button: a click anywhere on the
                recording is the oldest control in the medium. It is deliberately
                out of the tab order — the frame around it is the focusable
                surface, and it answers the same Space with far more besides. */}
            <button
                aria-label={state.playing ? `Pause ${name}` : `Play ${name}`}
                className="kissopen-video-viewer__surface"
                data-kissopen-desktop-ui="video-viewer-surface"
                onClick={onActivate}
                onDoubleClick={onFullscreen}
                tabIndex={-1}
                type="button"
            />
            {/* Over the element rather than instead of it. The element is what
                reported the failure and what would report a recovery, so tearing
                it out to show the news would leave the address remembered as
                failed with nothing left that could ever say otherwise — and the
                same file, opened a second time, would show a stale error without
                being tried at all. */}
            {failure !== undefined ? (
                <VideoViewerNotice detail={failure} name={name} tone="danger" />
            ) : null}
            {state.status === "opening" ? <VideoViewerOpening name={name} /> : null}
            {state.status === "blocked" ? (
                <div
                    className="kissopen-video-viewer__notice"
                    data-kissopen-desktop-ui="video-viewer-blocked"
                >
                    <Icon name="play" size={20} />
                    <span className="kissopen-video-viewer__notice-title">
                        {t("{name} is ready to play", { name })}
                    </span>
                    <span className="kissopen-video-viewer__notice-detail">
                        {t("The browser would not start it on its own. Press play to watch it.")}
                    </span>
                </div>
            ) : null}
            {state.pictureInPicture ? (
                <div
                    className="kissopen-video-viewer__notice"
                    data-kissopen-desktop-ui="video-viewer-detached"
                >
                    <Ionicon name="tv-outline" size={20} />
                    <span className="kissopen-video-viewer__notice-title">
                        {t("Playing in a floating window")}
                    </span>
                    <span className="kissopen-video-viewer__notice-detail">
                        {t("The controls here still run it.")}
                    </span>
                </div>
            ) : null}
            {state.waiting && state.status === "ready" ? (
                <div
                    aria-label={t("Buffering")}
                    className="kissopen-video-viewer__buffering"
                    data-kissopen-desktop-ui="video-viewer-buffering"
                    role="status"
                >
                    <Spinner size={20} />
                </div>
            ) : null}
        </>
    );
}

/**
 * The timeline: where the recording is, how much of it has arrived, and the one
 * control that moves it. It is a real slider rather than a decorated bar, so it
 * is reachable by Tab and moved by the arrow keys without a pointer at all.
 */
function VideoViewerTimeline(props: {
    buffered: readonly [number, number];
    disabled: boolean;
    duration: number;
    name: string;
    onScrub: (
        scrub:
            | { readonly pointerId: number; readonly time: number; readonly url: string }
            | undefined,
    ) => void;
    onSeek: (seconds: number) => void;
    scrub?: { readonly pointerId: number; readonly time: number };
    time: number;
    url: string;
}) {
    const known = lengthKnown(props.duration);
    const track = useRef<HTMLDivElement>(null);
    const along = (seconds: number): number =>
        known ? Math.min(1, Math.max(0, seconds / props.duration)) : 0;
    // An open-ended recording has no position to mark along a length that does
    // not exist, so the track is drawn empty rather than inventing one.
    const played = along(props.time);
    // Drawn where it actually is rather than from the start: after a seek into
    // an unfetched part of a long file, what has arrived is a run in the middle,
    // and painting it from zero would claim the skipped part had arrived too.
    const bufferedFrom = along(props.buffered[0]);
    const bufferedTo = along(props.buffered[1]);
    const inert = props.disabled || !known;

    /**
     * Where along the recording a point on the track is. Held inside the
     * recording, because a drag with the pointer captured carries on past both
     * ends of the track and a position outside the file is not one.
     */
    const timeAt = (clientX: number): number => {
        const element = track.current;
        if (!element) return 0;
        const box = element.getBoundingClientRect();
        if (box.width <= 0) return 0;
        const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
        return ratio * props.duration;
    };

    const pointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (inert || event.button !== 0) return;
        const time = timeAt(event.clientX);
        event.currentTarget.setPointerCapture(event.pointerId);
        props.onScrub({ pointerId: event.pointerId, time, url: props.url });
        props.onSeek(time);
    };

    const pointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (props.scrub?.pointerId !== event.pointerId) return;
        const time = timeAt(event.clientX);
        props.onScrub({ pointerId: event.pointerId, time, url: props.url });
        props.onSeek(time);
    };

    const pointerRelease = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (props.scrub?.pointerId !== event.pointerId) return;
        props.onScrub(undefined);
    };

    const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        if (inert) return;
        const key = event.key;
        if (key === "ArrowLeft") props.onSeek(props.time - SEEK_STEP);
        else if (key === "ArrowRight") props.onSeek(props.time + SEEK_STEP);
        else if (key === "PageDown") props.onSeek(props.time - SEEK_STEP_LONG);
        else if (key === "PageUp") props.onSeek(props.time + SEEK_STEP_LONG);
        else if (key === "Home") props.onSeek(0);
        else if (key === "End") props.onSeek(props.duration);
        else return;
        // The frame answers the same arrows, and this is the control the reader
        // put their focus on.
        event.stopPropagation();
        event.preventDefault();
    };

    return (
        <div
            aria-disabled={inert || undefined}
            aria-label={t("Seek through {name}", { name: props.name })}
            aria-valuemax={known ? Math.round(props.duration) : undefined}
            aria-valuemin={known ? 0 : undefined}
            aria-valuenow={known ? Math.floor(props.time) : undefined}
            aria-valuetext={
                known
                    ? `${timeSpoken(props.time)} of ${timeSpoken(props.duration)}`
                    : "Length unknown"
            }
            className="kissopen-video-viewer__timeline"
            data-kissopen-desktop-ui="video-viewer-timeline"
            data-scrubbing={props.scrub ? "" : undefined}
            onKeyDown={keyDown}
            onLostPointerCapture={pointerRelease}
            onPointerCancel={pointerRelease}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerRelease}
            ref={track}
            role="slider"
            tabIndex={inert ? -1 : 0}
        >
            <span
                className="kissopen-video-viewer__track"
                data-kissopen-desktop-ui="video-viewer-track"
            >
                <span
                    className="kissopen-video-viewer__buffered"
                    data-kissopen-desktop-ui="video-viewer-buffered"
                    style={{
                        left: `${String(bufferedFrom * 100)}%`,
                        width: `${String(Math.max(0, bufferedTo - bufferedFrom) * 100)}%`,
                    }}
                />
                <span
                    className="kissopen-video-viewer__played"
                    data-kissopen-desktop-ui="video-viewer-played"
                    style={{ width: `${String(played * 100)}%` }}
                />
            </span>
            <span
                className="kissopen-video-viewer__handle"
                data-kissopen-desktop-ui="video-viewer-handle"
                style={{ left: `${String(played * 100)}%` }}
            />
        </div>
    );
}

/**
 * Where the recording is, and either how much is left or how long it runs. The
 * trailing half is a button because which of those two a person wants is a
 * preference, and the only honest way to offer both is to let them say.
 */
function VideoViewerClock(props: {
    duration: number;
    onToggle: () => void;
    remaining: boolean;
    time: number;
}) {
    const known = lengthKnown(props.duration);
    const trailing = props.remaining
        ? `-${timeFormat(Math.max(0, props.duration - props.time))}`
        : timeFormat(props.duration);
    return (
        <span
            className="kissopen-video-viewer__clock"
            data-kissopen-desktop-ui="video-viewer-clock"
        >
            <span
                className="kissopen-video-viewer__elapsed"
                data-kissopen-desktop-ui="video-viewer-elapsed"
            >
                {timeFormat(props.time)}
            </span>
            {known ? (
                <button
                    aria-label={
                        props.remaining
                            ? "Show the whole length instead of what is left"
                            : "Show what is left instead of the whole length"
                    }
                    className="kissopen-video-viewer__total"
                    data-kissopen-desktop-ui="video-viewer-total"
                    onClick={props.onToggle}
                    type="button"
                >
                    {trailing}
                </button>
            ) : (
                <span
                    className="kissopen-video-viewer__total"
                    data-kissopen-desktop-ui="video-viewer-total"
                >
                    {t("live")}
                </span>
            )}
        </span>
    );
}

/**
 * Mute, and a level beside it. The slider is the part that needs room, so it is
 * the part that goes when there is none: the button and the up and down keys
 * carry the whole capability in a panel too narrow for both.
 */
function VideoViewerVolume(props: {
    disabled: boolean;
    muted: boolean;
    onMuteToggle: () => void;
    onVolume: (value: number) => void;
    volume: number;
}) {
    const level = props.muted ? 0 : props.volume;
    const glyph =
        level === 0
            ? "volume-mute"
            : level < 0.34
              ? "volume-low"
              : level < 0.67
                ? "volume-medium"
                : "volume-high";
    return (
        <span
            className="kissopen-video-viewer__volume"
            data-kissopen-desktop-ui="video-viewer-volume"
        >
            <Button
                aria-label={props.muted ? "Unmute" : "Mute"}
                aria-pressed={props.muted}
                disabled={props.disabled}
                iconOnly
                onClick={props.onMuteToggle}
                size="small"
                variant="ghost"
            >
                <Ionicon name={glyph} size={14} />
            </Button>
            <input
                aria-label={t("Volume")}
                className="kissopen-video-viewer__level"
                data-kissopen-desktop-ui="video-viewer-level"
                disabled={props.disabled}
                max={1}
                min={0}
                onChange={(event) => props.onVolume(Number(event.currentTarget.value))}
                step={0.01}
                type="range"
                value={level}
            />
        </span>
    );
}

/** The speed, and the short list of speeds worth having. */
function VideoViewerRate(props: {
    disabled: boolean;
    onOpen: (open: boolean) => void;
    onRate: (rate: number) => void;
    open: boolean;
    rate: number;
}) {
    return (
        <span
            className="kissopen-video-viewer__rate"
            data-kissopen-desktop-ui="video-viewer-rate"
            onBlur={(event) => {
                // Focus left the button and its list together, which is what
                // dismissing this means whether it was a key or a click.
                if (!event.currentTarget.contains(event.relatedTarget)) props.onOpen(false);
            }}
            onKeyDown={(event) => {
                if (event.key !== "Escape" || !props.open) return;
                props.onOpen(false);
                // Claimed, so a window that closes on Escape stays open for a
                // press that was only meant to put this list away.
                event.preventDefault();
                event.stopPropagation();
            }}
        >
            <Button
                aria-expanded={props.open}
                aria-haspopup="menu"
                aria-label={t("Playback speed, {rateFormat}", {
                    rateFormat: rateFormat(props.rate),
                })}
                disabled={props.disabled}
                onClick={() => props.onOpen(!props.open)}
                size="small"
                variant="ghost"
            >
                {rateFormat(props.rate)}
            </Button>
            {props.open ? (
                <span
                    className="kissopen-video-viewer__rates"
                    data-kissopen-desktop-ui="video-viewer-rates"
                >
                    <Menu
                        items={RATES.map((rate) => ({
                            kind: "item" as const,
                            id: String(rate),
                            label: rateFormat(rate),
                            ...(rate === props.rate ? { icon: "check" as const } : {}),
                        }))}
                        onSelect={(id) => {
                            props.onRate(Number(id));
                            props.onOpen(false);
                        }}
                        width={132}
                    />
                </span>
            ) : null}
        </span>
    );
}

function VideoViewerOpening(props: { name: string }) {
    return (
        <div
            className="kissopen-video-viewer__notice"
            data-kissopen-desktop-ui="video-viewer-loading"
        >
            <Spinner size={16} />
            <span className="kissopen-video-viewer__notice-title">
                {t("Opening {name}…", { name: props.name })}
            </span>
        </div>
    );
}

function VideoViewerNotice(props: {
    detail: string;
    name: string;
    title?: string;
    tone?: "danger";
}) {
    return (
        <div
            className="kissopen-video-viewer__notice"
            data-kissopen-desktop-ui={
                props.tone === "danger" ? "video-viewer-error" : "video-viewer-unavailable"
            }
            data-tone={props.tone}
            // A failure is the one notice that arrives late. The others are the
            // first thing drawn and are read as part of the region; this one
            // replaces a picture the reader was already watching, and without
            // being announced it would be a silent stop for anyone not looking.
            role={props.tone === "danger" ? "alert" : undefined}
        >
            <Icon name={props.tone === "danger" ? "close" : "play"} size={20} />
            <span className="kissopen-video-viewer__notice-title">
                {props.title ?? t("{name} could not be played", { name: props.name })}
            </span>
            <span className="kissopen-video-viewer__notice-detail">{props.detail}</span>
        </div>
    );
}
