import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import type { ConversationComputeState } from "kissopen-desktop-state";
import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { ScrollingText } from "./ScrollingText";
import { Ionicon, type IoniconName } from "./vectorIcons/VectorIcon";

export interface ConversationComputeEventProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    /** Time spent preparing so far, when the daemon measured it. */
    readonly elapsedMs?: number;
    /** The instance every event of one materialization shares. */
    readonly instanceId: string;
    /** The provider's own sentence about this step. */
    readonly message: string;
    /** Start with the detail list open (blueprint/tests). */
    readonly defaultExpanded?: boolean;
    /** Controlled disclosure state for a virtualized transcript row. */
    readonly expanded?: boolean;
    /** Reports disclosure changes so an owner can rebuild modeled row geometry. */
    readonly onExpandedChange?: (expanded: boolean) => void;
    /** Materialization progress, when the provider reports one. */
    readonly percent?: number;
    /** The provider's step name inside the lifecycle, such as `pulling_image`. */
    readonly phase: string;
    /** The compute provider plugin that owns the instance. */
    readonly provider: string;
    readonly state: ConversationComputeState;
    readonly style?: CSSProperties;
    /** The daemon's complete line, copied verbatim when a reader reports it. */
    readonly text: string;
}

/**
 * What each lifecycle state is called and what it is drawn with. The wording is
 * the reader's, not the protocol's: a person waiting on a session wants to know
 * whether the machine is coming, here, gone, or broken.
 */
const STATES: Record<
    ConversationComputeState,
    {
        readonly label: string;
        readonly glyph: IoniconName;
        readonly tone: "busy" | "done" | "idle" | "error";
    }
> = {
    unprovisioned: { label: t("Compute not started"), glyph: "cube-outline", tone: "idle" },
    provisioning: { label: t("Preparing compute"), glyph: "hourglass-outline", tone: "busy" },
    ready: { label: t("Compute ready"), glyph: "checkmark-circle-outline", tone: "done" },
    /* No machine can be had at all — a different thing from one that broke on
       the way up, and the only one of these a reader cannot wait out. */
    unavailable: { label: t("Compute unavailable"), glyph: "cloud-offline-outline", tone: "error" },
    stopped: { label: t("Compute stopped"), glyph: "stop-circle-outline", tone: "idle" },
    failed: { label: t("Compute failed"), glyph: "alert-circle-outline", tone: "error" },
};

/** A duration a reader can read at a glance, from KISSOPEN Agent's millisecond measure. */
function elapsedLabel(elapsedMs: number): string {
    const seconds = Math.round(elapsedMs / 1_000);
    if (seconds < 60) return `${String(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes)}m ${String(seconds % 60)}s`;
}

/**
 * ConversationComputeEvent — one durable compute lifecycle row in a transcript.
 *
 * A session whose workspace has to be materialized first spends its opening
 * seconds waiting on a machine, and when a provider breaks it never gets one at
 * all. Both belong in the transcript, in order, beside the messages they hold
 * up: this row keeps the same one-line rhythm as a tool call so a run of
 * progress notices reads as a list rather than as an interruption, and a failure
 * takes the error treatment so it cannot be skimmed past.
 *
 * The line a reader always gets is the daemon's own sentence. The provider,
 * phase, and instance behind it are one disclosure away rather than crowding the
 * row, and they are the fields a reader repeats when reporting a broken
 * provider. Nothing here is derived from anything but the values KISSOPEN Agent published.
 */
export function ConversationComputeEvent(props: ConversationComputeEventProps) {
    const [ownOpen, setOwnOpen] = useState(props.defaultExpanded ?? false);
    const open = props.expanded ?? ownOpen;
    const setOpen = (next: boolean) => {
        if (props.expanded === undefined) setOwnOpen(next);
        props.onExpandedChange?.(next);
    };
    const state = STATES[props.state];
    const progress =
        props.percent === undefined ? undefined : `${String(Math.round(props.percent))}%`;
    const elapsed = props.elapsedMs === undefined ? undefined : elapsedLabel(props.elapsedMs);
    return (
        <div
            className={["kissopen-conversation-compute", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="conversation-compute"
            data-state={props.state}
            data-testid={props["data-testid"]}
            data-tone={state.tone}
            style={props.style}
        >
            <div
                className="kissopen-conversation-compute__row"
                data-kissopen-desktop-ui="conversation-compute-row"
            >
                <span
                    aria-hidden="true"
                    className="kissopen-conversation-compute__icon"
                    data-kissopen-desktop-ui="conversation-compute-icon"
                >
                    <Ionicon name={state.glyph} size={14} />
                </span>
                <span
                    className="kissopen-conversation-compute__label"
                    data-kissopen-desktop-ui="conversation-compute-label"
                >
                    {state.label}
                </span>
                {/* The provider's sentence scrolls sideways rather than ending in
                    an ellipsis: a failure a reader cannot finish reading is not a
                    report. */}
                <ScrollingText
                    className="kissopen-conversation-compute__message"
                    data-kissopen-desktop-ui="conversation-compute-message"
                >
                    {props.message}
                </ScrollingText>
                {progress === undefined ? null : (
                    <span
                        className="kissopen-conversation-compute__metric"
                        data-kissopen-desktop-ui="conversation-compute-percent"
                    >
                        {progress}
                    </span>
                )}
                {elapsed === undefined ? null : (
                    <span
                        className="kissopen-conversation-compute__metric"
                        data-kissopen-desktop-ui="conversation-compute-elapsed"
                    >
                        {elapsed}
                    </span>
                )}
                <button
                    aria-expanded={open}
                    className="kissopen-conversation-compute__toggle"
                    data-kissopen-desktop-ui="conversation-compute-toggle"
                    onClick={() => setOpen(!open)}
                    type="button"
                >
                    <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
                    {open ? "Hide details" : "Details"}
                </button>
                <CopyButton
                    data-kissopen-desktop-ui="conversation-compute-copy"
                    label={t("Copy compute event")}
                    text={props.text}
                />
            </div>
            {open ? (
                <div
                    className="kissopen-conversation-compute__details"
                    data-kissopen-desktop-ui="conversation-compute-details"
                >
                    <ComputeDetail label={t("Provider")} value={props.provider} />
                    <ComputeDetail label={t("Phase")} value={props.phase} />
                    <ComputeDetail label={t("Instance")} value={props.instanceId} />
                    {elapsed === undefined ? null : (
                        <ComputeDetail label={t("Elapsed")} value={elapsed} />
                    )}
                </div>
            ) : null}
        </div>
    );
}

function ComputeDetail(props: { readonly label: string; readonly value: string }) {
    return (
        <span
            className="kissopen-conversation-compute__detail"
            data-kissopen-desktop-ui="conversation-compute-detail"
        >
            <span className="kissopen-conversation-compute__detail-label">{props.label}</span>
            <span className="kissopen-conversation-compute__detail-value">{props.value}</span>
        </span>
    );
}
