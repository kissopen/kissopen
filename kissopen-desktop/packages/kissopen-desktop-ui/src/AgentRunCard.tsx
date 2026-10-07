import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Avatar, type ToneName } from "./Avatar";
import { Badge, type BadgeVariant } from "./Badge";
import { Button, type ButtonVariant } from "./Button";
import { compactCount, changeCountLabel } from "./countText";
import { Icon } from "./Icon";
export type AgentRunStatus = "queued" | "working" | "review" | "complete";
export type AgentRunStep = {
    label: string;
    status: "done" | "working" | "pending";
};
export type AgentRun = {
    agent: string;
    branch?: string;
    initials: string;
    /** 0..100, drives the working progress bar. */
    progress?: number;
    stats?: {
        added?: number;
        files?: number;
        note?: string;
        removed?: number;
        steps?: number;
    };
    status: AgentRunStatus;
    steps: AgentRunStep[];
    title: string;
    tone?: ToneName;
};
export type AgentRunAction = {
    id: string;
    label: string;
    variant?: ButtonVariant;
};
export type AgentRunCardProps = Omit<HTMLAttributes<HTMLElement>, "style"> & {
    actions?: AgentRunAction[];
    /** Diff snippet slot, rendered when expanded. */
    children?: ReactNode;
    expanded: boolean;
    onAction?: (id: string) => void;
    onExpandedChange: (expanded: boolean) => void;
    run: AgentRun;
    style?: CSSProperties;
};
const statusBadges: Record<
    AgentRunStatus,
    {
        label: string;
        variant: BadgeVariant;
    }
> = {
    complete: { label: "COMPLETED", variant: "success" },
    queued: { label: "QUEUED", variant: "neutral" },
    review: { label: t("NEEDS REVIEW"), variant: "success" },
    working: { label: "RUNNING", variant: "warning" },
};
function clampProgress(progress: number | undefined) {
    return Math.min(100, Math.max(0, progress ?? 0));
}
/** The hero card of the product: an agent run with status, diffstat, and steps. */
export function AgentRunCard(props: AgentRunCardProps) {
    const [local, rest] = partitionComponentProps(props, [
        "actions",
        "children",
        "className",
        "expanded",
        "onAction",
        "onExpandedChange",
        "run",
        "style",
    ]);
    const badge = () => statusBadges[local.run.status];
    const detail = () => {
        const stats = local.run.stats;
        if (!stats) return "";
        return [
            stats.files === undefined ? undefined : `${String(stats.files)} files`,
            stats.steps === undefined ? undefined : `${String(stats.steps)} steps`,
            stats.note,
        ]
            .filter(Boolean)
            .join(" · ");
    };
    return (
        <article
            {...rest}
            className={["kissopen-agent-run-card", local.className].filter(Boolean).join(" ")}
            data-expanded={local.expanded ? "" : undefined}
            data-kissopen-desktop-ui="agent-run-card"
            data-status={local.run.status}
            style={local.style}
        >
            {local.run.status === "working" ? (
                <div
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={clampProgress(local.run.progress)}
                    className="kissopen-agent-run-card__progress"
                    data-kissopen-desktop-ui="agent-run-card-progress"
                    role="progressbar"
                >
                    <div
                        className="kissopen-agent-run-card__progress-fill"
                        data-kissopen-desktop-ui="agent-run-card-progress-fill"
                        style={{ width: `${clampProgress(local.run.progress)}%` }}
                    />
                </div>
            ) : null}
            <header
                className="kissopen-agent-run-card__header"
                data-kissopen-desktop-ui="agent-run-card-header"
            >
                <Avatar
                    initials={local.run.initials}
                    size="sm"
                    tone={local.run.tone}
                    type="agent"
                />
                <span
                    className="kissopen-agent-run-card__name"
                    data-kissopen-desktop-ui="agent-run-card-name"
                >
                    <span
                        className="kissopen-agent-run-card__agent"
                        data-kissopen-desktop-ui="agent-run-card-agent"
                    >
                        {local.run.agent}
                    </span>
                    <span
                        className="kissopen-agent-run-card__kind"
                        data-kissopen-desktop-ui="agent-run-card-kind"
                    >
                        {t("· run")}
                    </span>
                </span>
                {local.run.status === "complete" ? (
                    <span
                        aria-hidden="true"
                        className="kissopen-agent-run-card__check"
                        data-kissopen-desktop-ui="agent-run-card-check"
                    >
                        <Icon name="check-circle" size={16} />
                    </span>
                ) : null}
                <Badge label={badge().label} variant={badge().variant} />
                <button
                    aria-expanded={local.expanded ? "true" : "false"}
                    aria-label={local.expanded ? "Collapse run details" : "Expand run details"}
                    className="kissopen-agent-run-card__toggle"
                    data-kissopen-desktop-ui="agent-run-card-toggle"
                    onClick={() => local.onExpandedChange(!local.expanded)}
                    type="button"
                >
                    <span
                        className="kissopen-agent-run-card__toggle-icon"
                        data-kissopen-desktop-ui="agent-run-card-toggle-icon"
                    >
                        <Icon name="chevron-down" size={16} />
                    </span>
                </button>
            </header>
            <h3
                className="kissopen-agent-run-card__title"
                data-kissopen-desktop-ui="agent-run-card-title"
            >
                {local.run.title}
            </h3>
            {local.run.stats
                ? ((stats) => (
                      <div
                          className="kissopen-agent-run-card__meta"
                          data-kissopen-desktop-ui="agent-run-card-meta"
                      >
                          {/* A side that changed nothing is not news; "+0" is
                              a number the reader has to read before learning
                              there was nothing to learn. */}
                          {stats.added ? (
                              <span
                                  aria-hidden="true"
                                  className="kissopen-agent-run-card__added"
                                  data-kissopen-desktop-ui="agent-run-card-added"
                              >
                                  +{compactCount(stats.added)}
                              </span>
                          ) : null}
                          {stats.removed ? (
                              <span
                                  aria-hidden="true"
                                  className="kissopen-agent-run-card__removed"
                                  data-kissopen-desktop-ui="agent-run-card-removed"
                              >
                                  &minus;{compactCount(stats.removed)}
                              </span>
                          ) : null}
                          {stats.added || stats.removed ? (
                              <span className="kissopen-visually-hidden">
                                  {changeCountLabel(stats.added ?? 0, stats.removed ?? 0)}
                              </span>
                          ) : null}
                          {detail() ? (
                              <span
                                  className="kissopen-agent-run-card__detail"
                                  data-kissopen-desktop-ui="agent-run-card-detail"
                              >
                                  {detail()}
                              </span>
                          ) : null}
                      </div>
                  ))(local.run.stats)
                : null}
            {local.run.branch
                ? ((branch) => (
                      <div
                          className="kissopen-agent-run-card__branch"
                          data-kissopen-desktop-ui="agent-run-card-branch"
                      >
                          <span
                              aria-hidden="true"
                              className="kissopen-agent-run-card__branch-icon"
                              data-kissopen-desktop-ui="agent-run-card-branch-icon"
                          >
                              <Icon name="branch" size={14} />
                          </span>
                          <span
                              className="kissopen-agent-run-card__branch-name"
                              data-kissopen-desktop-ui="agent-run-card-branch-name"
                          >
                              {branch}
                          </span>
                      </div>
                  ))(local.run.branch)
                : null}
            {local.expanded && local.run.steps.length > 0 ? (
                <ul
                    className="kissopen-agent-run-card__steps"
                    data-kissopen-desktop-ui="agent-run-card-steps"
                >
                    {local.run.steps.map((step, index) => (
                        <li
                            className="kissopen-agent-run-card__step"
                            key={`${step.label}-${index}`}
                            data-kissopen-desktop-ui="agent-run-card-step"
                            data-status={step.status}
                        >
                            <span
                                aria-hidden="true"
                                className="kissopen-agent-run-card__step-glyph"
                                data-kissopen-desktop-ui="agent-run-card-step-glyph"
                            >
                                {step.status === "done" ? (
                                    <Icon name="check-circle" size={16} />
                                ) : (
                                    <span
                                        className="kissopen-agent-run-card__step-dot"
                                        data-kissopen-desktop-ui="agent-run-card-step-dot"
                                    />
                                )}
                            </span>
                            <span
                                className="kissopen-agent-run-card__step-label"
                                data-kissopen-desktop-ui="agent-run-card-step-label"
                            >
                                {step.label}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {local.expanded && local.children ? (
                <div
                    className="kissopen-agent-run-card__body"
                    data-kissopen-desktop-ui="agent-run-card-body"
                >
                    {local.children}
                </div>
            ) : null}
            {local.actions?.length ? (
                <div
                    className="kissopen-agent-run-card__actions"
                    data-kissopen-desktop-ui="agent-run-card-actions"
                >
                    {local.actions.map((action) => (
                        <Button
                            key={action.id}
                            onClick={() => local.onAction?.(action.id)}
                            size="small"
                            variant={action.variant ?? "secondary"}
                        >
                            {action.label}
                        </Button>
                    ))}
                </div>
            ) : null}
        </article>
    );
}
