import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { Badge, type BadgeVariant } from "./Badge";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { ScrollArea } from "./Scrollbar";
export type BuildProgressStatus = "pending" | "building" | "ready" | "failed";
export type BuildProgressPanelProps = {
    className?: string;
    "data-testid"?: string;
    title: string;
    status: BuildProgressStatus;
    progress: number;
    statusLabel: string;
    currentLogLine?: string;
    log?: string;
    logTruncated?: boolean;
    error?: string;
    retrying?: boolean;
    onRetry?: () => void;
};
type StatusBadge = {
    variant: BadgeVariant;
    label: string;
    icon?: IconName;
};
const statusBadges: Record<BuildProgressStatus, StatusBadge> = {
    pending: { variant: "neutral", label: "QUEUED" },
    building: { variant: "info", label: "BUILDING" },
    ready: { variant: "success", label: "READY", icon: "check-circle" },
    failed: { variant: "danger", label: "FAILED" },
};
/**
 * C-063 BuildProgressPanel — onboarding-sized live view of one durable agent
 * base-image build. Shows the phase badge, a deterministic progress bar, the
 * current human phase + percent, the latest single log line, a retained
 * scrollable log, and (on failure) the error with a Retry action.
 *
 * Props only, screenshot-deterministic: no state, no timers, no animation. The
 * bar width is driven purely by `progress` (clamped 0..100), and `retrying`
 * shows a static, non-animated ring rather than a spinner.
 */
export function BuildProgressPanel(props: BuildProgressPanelProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "title",
        "status",
        "progress",
        "statusLabel",
        "currentLogLine",
        "log",
        "logTruncated",
        "error",
        "retrying",
        "onRetry",
    ]);
    const clamped = () => Math.max(0, Math.min(100, local.progress));
    const pct = () => Math.round(clamped());
    const fillPct = () => (local.status === "ready" ? 100 : pct());
    const badge = () => statusBadges[local.status];
    return (
        <div
            className={["kissopen-build-progress", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="build-progress"
            data-status={local.status}
            data-testid={local["data-testid"]}
        >
            <div
                className="kissopen-build-progress__header"
                data-kissopen-desktop-ui="build-progress-header"
            >
                <span
                    className="kissopen-build-progress__title"
                    data-kissopen-desktop-ui="build-progress-title"
                >
                    {local.title}
                </span>
                <Badge
                    className="kissopen-build-progress__badge"
                    icon={badge().icon}
                    label={badge().label}
                    variant={badge().variant}
                />
            </div>

            <div
                className="kissopen-build-progress__track"
                data-kissopen-desktop-ui="build-progress-track"
            >
                <div
                    className="kissopen-build-progress__fill"
                    data-kissopen-desktop-ui="build-progress-fill"
                    style={{ width: `${fillPct()}%` }}
                />
            </div>

            <div
                className="kissopen-build-progress__status-line"
                data-kissopen-desktop-ui="build-progress-status-line"
            >
                <span
                    className="kissopen-build-progress__status-label"
                    data-kissopen-desktop-ui="build-progress-status-label"
                >
                    {local.statusLabel}
                </span>
                <span
                    className="kissopen-build-progress__percent"
                    data-kissopen-desktop-ui="build-progress-percent"
                >
                    {pct()}%
                </span>
            </div>

            {local.currentLogLine && local.status !== "ready" ? (
                <div
                    className="kissopen-build-progress__current"
                    data-kissopen-desktop-ui="build-progress-current"
                >
                    <span
                        className="kissopen-build-progress__current-icon"
                        data-kissopen-desktop-ui="build-progress-current-icon"
                    >
                        <Icon name="terminal" size={12} />
                    </span>
                    <span
                        className="kissopen-build-progress__current-text"
                        data-kissopen-desktop-ui="build-progress-current-text"
                    >
                        {local.currentLogLine}
                    </span>
                </div>
            ) : null}

            {local.log
                ? ((log) => (
                      <div
                          className="kissopen-build-progress__log-block"
                          data-kissopen-desktop-ui="build-progress-log-block"
                      >
                          {local.logTruncated ? (
                              <span
                                  className="kissopen-build-progress__truncated"
                                  data-kissopen-desktop-ui="build-progress-truncated"
                              >
                                  {t("Earlier log truncated")}
                              </span>
                          ) : null}
                          <ScrollArea
                              axes="both"
                              className="kissopen-build-progress__log"
                              data-kissopen-desktop-ui="build-progress-log"
                              viewportClassName="kissopen-build-progress__log-viewport"
                          >
                              <pre className="kissopen-build-progress__log-inner">
                                  <code>{log}</code>
                              </pre>
                          </ScrollArea>
                      </div>
                  ))(local.log)
                : null}

            {local.status === "failed" ? (
                <div
                    className="kissopen-build-progress__error"
                    data-kissopen-desktop-ui="build-progress-error"
                >
                    {local.error ? (
                        <span
                            className="kissopen-build-progress__error-text"
                            data-kissopen-desktop-ui="build-progress-error-text"
                        >
                            {local.error}
                        </span>
                    ) : null}
                    <div
                        className="kissopen-build-progress__actions"
                        data-kissopen-desktop-ui="build-progress-actions"
                    >
                        {local.retrying ? (
                            <span
                                className="kissopen-build-progress__spinner"
                                data-kissopen-desktop-ui="build-progress-spinner"
                            />
                        ) : null}
                        <Button
                            disabled={local.retrying}
                            onClick={() => local.onRetry?.()}
                            size="medium"
                            variant="secondary"
                        >
                            {t("Retry build")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
