import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import type { DelegatedAgentSummary } from "kissopen-desktop-state";
import { elapsedTimeFormat } from "./elapsedTimeFormat";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export type DelegatedAgentActivityProps = {
    child: DelegatedAgentSummary;
    /**
     * Reference epoch millis a running child clocks its elapsed time against.
     * The owner supplies one shared clock so no row runs a timer of its own.
     */
    now?: number;
    /** Freezes the preparing spinner on one frame for deterministic fixtures. */
    spinnerFrame?: number;
    /** Opens the selected child session. */
    onSelect?: (sessionId: string) => void;
    /** The side panel uses the same row grammar with its own 8px inset. */
    placement?: "transcript" | "panel";
    /** Optional panel wording for a settled child. */
    completedLabel?: string;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

const STATUS_LABELS: Record<DelegatedAgentSummary["status"], string> = {
    idle: "Idle",
    queued: "Queued",
    running: "Running",
    completed: "Completed",
    aborted: "Stopped",
    suspended: "Suspended",
    error: "Failed",
    archived: "Closed",
};

const TOKENS = new Intl.NumberFormat("en-US");

function taskLabel(child: DelegatedAgentSummary): string {
    return child.taskName ?? child.description;
}

/**
 * How long this child has been working. A run still going counts up from when
 * it started against the shared clock; a settled one keeps what it recorded.
 */
function childElapsed(child: DelegatedAgentSummary, now: number | undefined): number | undefined {
    if (child.status === "running" && child.activeSince !== undefined && now !== undefined)
        return (child.elapsedMs ?? 0) + Math.max(0, now - child.activeSince);
    return child.elapsedMs;
}

/** Compact visible state label used in the row's facts line. */
function statusLabel(status: DelegatedAgentSummary["status"]): string {
    return STATUS_LABELS[status].toLocaleLowerCase("en-US");
}

/**
 * One delegated child in the same grammar as ordinary tool activity. The task
 * and model are the Agent call's arguments; elapsed and token facts sit beneath
 * them, aligned with the tool name rather than the glyph. Only a child still
 * being prepared spins.
 */
export function DelegatedAgentActivity(props: DelegatedAgentActivityProps) {
    const child = props.child;
    const preparing = child.status === "idle" || child.status === "queued";
    const elapsed = childElapsed(child, props.now);
    const status =
        child.status === "completed"
            ? (props.completedLabel ?? STATUS_LABELS.completed).toLocaleLowerCase("en-US")
            : statusLabel(child.status);
    const label = taskLabel(child);
    const className = ["kissopen-delegated-agent", props.className].filter(Boolean).join(" ");
    const accessibleFacts = [
        `model ${child.modelId}`,
        child.status === "completed"
            ? (props.completedLabel ?? STATUS_LABELS.completed)
            : STATUS_LABELS[child.status],
        ...(elapsed === undefined ? [] : [elapsedTimeFormat(elapsed)]),
        ...(child.totalTokens === undefined ? [] : [`${TOKENS.format(child.totalTokens)} tokens`]),
    ];
    const accessibleLabel = `${props.onSelect ? "Open delegated task" : "Delegated task"} ${label}, ${accessibleFacts.join(", ")}`;
    const rowContent = (
        <>
            <span
                aria-hidden="true"
                className="kissopen-delegated-agent__glyph"
                data-kissopen-desktop-ui="delegated-agent-glyph"
            >
                {preparing ? (
                    <Spinner
                        frame={props.spinnerFrame}
                        label={t("Preparing {label}", { label })}
                        size={12}
                        tone="muted"
                        variant="circle"
                    />
                ) : (
                    <Icon name="agents" size={12} />
                )}
            </span>
            <span className="kissopen-delegated-agent__content">
                <span className="kissopen-delegated-agent__primary">
                    <span className="kissopen-delegated-agent__verb">{t("Agent")}</span>
                    <span className="kissopen-delegated-agent__arguments">
                        <span className="kissopen-delegated-agent__task">{label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="kissopen-delegated-agent__model">{child.modelId}</span>
                    </span>
                </span>
                <span className="kissopen-delegated-agent__meta">
                    <span>{status}</span>
                    {elapsed === undefined ? null : (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>{elapsedTimeFormat(elapsed)}</span>
                        </>
                    )}
                    {child.totalTokens === undefined ? null : (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>
                                {t("{count} tokens", { count: TOKENS.format(child.totalTokens) })}
                            </span>
                        </>
                    )}
                </span>
            </span>
        </>
    );

    return (
        <div
            className={className}
            data-kissopen-desktop-ui="delegated-agent"
            data-placement={props.placement ?? "transcript"}
            data-status={child.status}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {props.onSelect ? (
                <button
                    aria-label={accessibleLabel}
                    className="kissopen-delegated-agent__row"
                    data-interactive=""
                    onClick={() => props.onSelect?.(child.sessionId)}
                    type="button"
                >
                    {rowContent}
                </button>
            ) : (
                <div
                    aria-label={accessibleLabel}
                    className="kissopen-delegated-agent__row"
                    role="group"
                >
                    {rowContent}
                </div>
            )}
        </div>
    );
}
