import { t } from "kissopen-desktop-state";
import { Fragment, type CSSProperties } from "react";

export interface KissopenAgentActivityControlProps {
    readonly agents?: number;
    readonly backgroundTerminals?: number;
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly disabled?: boolean;
    readonly onClick?: () => void;
    readonly style?: CSSProperties;
}

/** Fixed height of the one-line transcript activity entry, including its row box. */
export const KISSOPEN_AGENT_ACTIVITY_CONTROL_TRANSCRIPT_HEIGHT = 24;

function count(value: number | undefined): number {
    return Math.max(0, Math.floor(value ?? 0));
}

function noun(value: number, singular: string): string {
    return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

/**
 * One bounded affordance for live delegated agents and background terminals.
 * The detailed collection lives in the side panel; the transcript keeps only
 * the current live counts, as quiet trailing text on the working-status line.
 * The turn's own loader already says work is running, so this summary carries
 * no second spinner.
 */
export function KissopenAgentActivityControl(props: KissopenAgentActivityControlProps) {
    const agents = count(props.agents);
    const terminals = count(props.backgroundTerminals);
    if (agents + terminals === 0) return null;
    const summaryParts = [
        ...(terminals > 0 ? [{ id: "terminals", label: noun(terminals, "Terminal") }] : []),
        ...(agents > 0 ? [{ id: "agents", label: noun(agents, "Agent") }] : []),
    ];
    const fullSummary = summaryParts.map((part) => part.label).join(" · ");
    return (
        <div
            className="kissopen-agent-activity-transcript"
            data-kissopen-desktop-ui="kissopen-agent-activity-entry"
            style={props.style}
        >
            <button
                aria-label={t("Open session details: {fullSummary}", { fullSummary })}
                className={["kissopen-agent-activity-transcript__row", props.className]
                    .filter(Boolean)
                    .join(" ")}
                data-kissopen-desktop-ui="kissopen-agent-activity-control"
                data-testid={props["data-testid"]}
                disabled={props.disabled || props.onClick === undefined}
                onClick={props.onClick}
                title={t("Open session details: {fullSummary}", { fullSummary })}
                type="button"
            >
                <span className="kissopen-agent-activity-transcript__primary">
                    {summaryParts.map((part, index) => (
                        <Fragment key={part.id}>
                            {index > 0 ? (
                                <span
                                    aria-hidden="true"
                                    className="kissopen-agent-activity-transcript__separator"
                                >
                                    ·
                                </span>
                            ) : null}
                            <span>{part.label}</span>
                        </Fragment>
                    ))}
                </span>
            </button>
        </div>
    );
}
