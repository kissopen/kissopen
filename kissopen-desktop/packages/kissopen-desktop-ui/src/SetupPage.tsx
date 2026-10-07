import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { Banner } from "./Banner";
import type { Dimension } from "./dimensions";
import { LottieScene, type LottieSceneName } from "./LottieScene";
import { SecretaryFigure } from "./SecretaryFigure";
import { KissopenLoader, type KissopenLoaderVariant } from "./KissopenLoader";
import { OnboardingSky } from "./OnboardingSky";
import { ScrollArea } from "./Scrollbar";
import type { ThemeMode } from "./ThemeScope";
import { WindowDragRegion } from "./TitleBar";

/** Keep the workspace mounted while first-run draft preparation finishes. */
export function SetupHandoff(props: {
    readonly children: ReactNode;
    readonly error?: string;
    readonly busy?: boolean;
    readonly onRetry: () => void;
}) {
    return (
        <div className="kissopen-setup-handoff" data-kissopen-desktop-ui="setup-handoff">
            {props.error ? (
                <Banner
                    tone="neutral"
                    action={
                        props.busy ? undefined : { label: t("Try again"), onClick: props.onRetry }
                    }
                >
                    {props.error}
                </Banner>
            ) : null}
            <div className="kissopen-setup-handoff__content">{props.children}</div>
        </div>
    );
}

/**
 * How far a running action has got, for the few that can say.
 *
 * Most of setup's actions are a request and an answer with nothing in between,
 * and those keep the spinner. This is for the one kind that takes long enough to
 * be watched — bytes arriving — and it is deliberately not a general "percent
 * complete": `waiting` is the honest state for work that is running but has
 * nothing measured yet, and it is a state every such action passes through both
 * before and after the part that counts.
 */
export type SetupPageProgress =
    | { readonly kind: "waiting" }
    | {
          readonly kind: "measured";
          /** What has arrived, in the flow's own words, beside the label. */
          readonly detail?: string;
          /** The share provably done, 0 to 1. */
          readonly fraction: number;
      };

/** The one thing this page is asking for, if it is asking for anything. */
export interface SetupPageAction {
    readonly label: string;
    readonly disabled?: boolean;
    /** Omit for the standard full-width action; set for a compact centred action. */
    readonly width?: Dimension;
    /**
     * This action is running. The spinner goes on the button and the page keeps
     * everything else exactly where it was: an attempt started from here is not
     * a new step, and swapping the page for a waiting screen would take away the
     * error the person is still reading.
     */
    readonly busy?: boolean;
    /**
     * Reported instead of the spinner while this action is busy, when the flow
     * has something measurable to report. The button gives way to the bar in
     * place, at the same height, so pressing it changes what the page says
     * rather than where anything sits.
     */
    readonly progress?: SetupPageProgress;
    onSelect(): void;
}

export interface SetupPageProps {
    /** A retained, compact stage indicator above the scrolling page content. */
    readonly steps?: ReactNode;
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    /** Optional first-run scenery. Other setup-shaped system screens stay plain. */
    readonly backdrop?: { readonly appearance: ThemeMode; readonly kind: "sky" };
    /**
     * Stable identity of the setup stage. Changing it dissolves the new page
     * content into the retained frame; updates within one stage stay still.
     */
    readonly transitionKey?: string;
    /**
     * The animation that says what is happening. Omitted by a page whose body is
     * already its own picture — the install terminal, or the two-panel fork.
     */
    readonly scene?: LottieSceneName;
    /**
     * 小秘书 in place of a scene, for the pages where the product speaks for
     * itself. Takes precedence over `scene`.
     */
    readonly figure?: "secretary";
    /** `still` holds the figure on one frame, for blueprints and tests. */
    readonly figureMotion?: "auto" | "still";
    /**
     * The brand mark, waiting, in place of the scene. For the steps that are
     * purely a wait on the machine — starting, restarting, probing — where a
     * scene would play once and then hold a still frame under copy that is
     * still saying something is happening. Ignored when `scene` is set.
     */
    readonly loader?: KissopenLoaderVariant;
    /** Compact illustration for steps whose QR code is the main visual. */
    readonly sceneSize?: number;
    readonly title: string;
    readonly copy?: string;
    /**
     * A command the reader is meant to run themselves, shown selectable in the
     * monospace face. Present only when there is genuinely something to type: a
     * page that offers a command it does not need is a page that looks broken.
     */
    readonly command?: string;
    /** This page's own body, when it has one: a fork, a terminal, a notice. */
    readonly children?: ReactNode;
    readonly action?: SetupPageAction;
}

/**
 * C-252 SetupPage — one step of setup, as one centred page.
 *
 * Every state of first-run setup is the same shape: a picture that says what is
 * happening, a sentence naming it, a line explaining it, and at most one thing
 * to do. So they are all this component, and the only thing that changes
 * between them is which of those four are filled in.
 *
 * Onboarding may supply a compact stage indicator. It stays outside the
 * transitioning content and reports actual stages, not individual loading states.
 *
 * The scene is illustration and never information. `LottieScene` renders
 * nothing until its worker runtime arrives, and nothing at all in an engine that
 * cannot have one, so the title and copy carry the whole meaning of every page
 * and its stage keeps a fixed square whether the art comes or not.
 *
 * It fills the window of an Electron app that draws no native title bar, so it
 * owns the drag lane across its own top edge, out of the flow, the way every
 * other full-window state does.
 *
 * Props only: what a step means and what its action does belong to the flow.
 */
export function SetupPage(props: SetupPageProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "backdrop",
        "transitionKey",
        "scene",
        "figure",
        "figureMotion",
        "loader",
        "sceneSize",
        "title",
        "copy",
        "command",
        "children",
        "action",
        "steps",
    ]);
    return (
        <div
            className={["kissopen-setup-page", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="setup-page"
            data-appearance={local.backdrop?.appearance}
            data-backdrop={local.backdrop?.kind}
            data-transition={local.transitionKey === undefined ? undefined : ""}
            data-testid={local["data-testid"]}
            data-steps={local.steps ? "true" : undefined}
            style={local.style}
        >
            {local.backdrop ? <OnboardingSky appearance={local.backdrop.appearance} /> : null}
            <WindowDragRegion />
            {local.steps ? <div className="kissopen-setup-page__steps">{local.steps}</div> : null}
            <ScrollArea
                axes="both"
                className="kissopen-setup-page__scroll"
                viewportClassName="kissopen-setup-page__scroll-viewport"
            >
                <div
                    className="kissopen-setup-page__body"
                    data-kissopen-desktop-ui="setup-page-body"
                    key={local.transitionKey}
                >
                    <div className="kissopen-setup-page__heading">
                        {local.figure !== undefined ||
                        local.scene !== undefined ||
                        local.loader !== undefined ? (
                            <span
                                className="kissopen-setup-page__stage"
                                data-kissopen-desktop-ui="setup-page-stage"
                                style={
                                    local.sceneSize === undefined
                                        ? undefined
                                        : { width: local.sceneSize, height: local.sceneSize }
                                }
                            >
                                {local.figure === "secretary" ? (
                                    <SecretaryFigure
                                        label={local.title}
                                        motion={local.figureMotion ?? "auto"}
                                        size={local.sceneSize ?? 120}
                                    />
                                ) : local.scene !== undefined ? (
                                    <LottieScene
                                        name={local.scene}
                                        // The picture repeats what the title already says, so
                                        // the only thing worth offering is one more play.
                                        replayLabel={local.title}
                                        size={local.sceneSize ?? 120}
                                    />
                                ) : (
                                    <KissopenLoader
                                        // The title is what the wait is; the mark only says
                                        // that it is still going.
                                        label={local.title}
                                        // Smaller than the square it sits in. The mark is a
                                        // rule of the page rather than an illustration of it,
                                        // and drawn at the scene's own size it would read as
                                        // the brand being presented to someone who is only
                                        // waiting. The box is unchanged either way, so a step
                                        // that moves between a scene and a wait does not move
                                        // the title.
                                        size={(local.sceneSize ?? 120) * 0.6}
                                        variant={local.loader}
                                    />
                                )}
                            </span>
                        ) : null}
                        <h1
                            className="kissopen-setup-page__title"
                            data-kissopen-desktop-ui="setup-page-title"
                        >
                            {local.title}
                        </h1>
                    </div>
                    {local.copy === undefined ? null : (
                        <p
                            className="kissopen-setup-page__copy"
                            data-kissopen-desktop-ui="setup-page-copy"
                        >
                            {local.copy}
                        </p>
                    )}
                    {local.command === undefined ? null : (
                        <code
                            className="kissopen-setup-page__command"
                            data-kissopen-desktop-ui="setup-page-command"
                        >
                            {local.command}
                        </code>
                    )}
                    {local.children === undefined ? null : (
                        <div
                            className="kissopen-setup-page__slot"
                            data-kissopen-desktop-ui="setup-page-slot"
                        >
                            {local.children}
                        </div>
                    )}
                    {local.action
                        ? ((action) =>
                              action.busy && action.progress ? (
                                  <SetupProgress label={action.label} progress={action.progress} />
                              ) : (
                                  <Button
                                      disabled={action.disabled}
                                      loading={action.busy}
                                      onClick={action.onSelect}
                                      size="large"
                                      {...(action.width === undefined
                                          ? { fullWidth: true }
                                          : { width: action.width })}
                                  >
                                      {action.label}
                                  </Button>
                              ))(local.action)
                        : null}
                </div>
            </ScrollArea>
        </div>
    );
}

/**
 * The action's own progress, in the place the action was.
 *
 * A bar rather than a spinner because a download has a length: a spinner says
 * only that something is happening, which someone watching a first install
 * already knows and is not what they are waiting to learn. It occupies the same
 * height as the button it replaces, so the page does not move when it appears.
 *
 * `waiting` is drawn as a sweep across the empty track instead of an empty bar.
 * A bar sitting at zero looks stuck, and the two moments this state covers —
 * before the first byte, and while what arrived is being checked and unpacked —
 * are exactly when someone is most likely to think it has died.
 */
export interface SetupProgressProps {
    readonly label: string;
    readonly progress: SetupPageProgress;
    /** Uses the light ink intended for a photographic or dark backdrop. */
    readonly tone?: "default" | "inverse";
}

export function SetupProgress(props: SetupProgressProps) {
    const measured = props.progress.kind === "measured" ? props.progress : undefined;
    const fraction = measured ? Math.min(1, Math.max(0, measured.fraction)) : 0;
    return (
        <div
            className="kissopen-setup-page__progress"
            data-kissopen-desktop-ui="setup-page-progress"
            data-state={props.progress.kind}
            data-tone={props.tone ?? "default"}
        >
            <span
                aria-label={props.label}
                aria-valuemax={100}
                aria-valuemin={0}
                // Absent while nothing is measured, which is what tells a screen
                // reader this is indeterminate rather than stalled at zero.
                aria-valuenow={measured ? Math.round(fraction * 100) : undefined}
                className="kissopen-setup-page__progress-track"
                data-kissopen-desktop-ui="setup-page-progress-track"
                role="progressbar"
            >
                <span
                    className="kissopen-setup-page__progress-fill"
                    data-kissopen-desktop-ui="setup-page-progress-fill"
                    style={measured ? { width: `${String(fraction * 100)}%` } : undefined}
                />
            </span>
            <span
                className="kissopen-setup-page__progress-line"
                data-kissopen-desktop-ui="setup-page-progress-line"
            >
                <span className="kissopen-setup-page__progress-label">{props.label}</span>
                {measured?.detail === undefined ? null : (
                    <span className="kissopen-setup-page__progress-detail">{measured.detail}</span>
                )}
            </span>
        </div>
    );
}
