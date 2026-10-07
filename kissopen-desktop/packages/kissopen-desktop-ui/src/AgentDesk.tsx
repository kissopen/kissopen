import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes } from "react";
import { Avatar, type ToneName } from "./Avatar";
import { Badge } from "./Badge";
import { Icon, type IconName } from "./Icon";
import { ScrollArea } from "./Scrollbar";
export type DeskRun = {
    agent: string;
    detail?: string;
    eta?: string;
    id: string;
    initials: string;
    progress?: number;
    title: string;
    tone?: ToneName;
};
export type DeskListItem = {
    icon?: IconName;
    id: string;
    meta?: string;
    title: string;
};
export type AgentDeskProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & {
    done?: DeskListItem[];
    onItemSelect?: (id: string) => void;
    queued?: DeskListItem[];
    running: DeskRun[];
    runningLabel?: string;
    style?: CSSProperties;
    title?: string;
};
function clampProgress(value: number | undefined) {
    return Math.min(100, Math.max(0, value ?? 0));
}
/**
 * AgentDesk — the docked right-panel overview of agent activity: running
 * tiles with a brand-gradient progress bar, dashed queued rows, and
 * done-today rows. Fluid width (designed for the 340px AppShell panel),
 * fills its container's height, and scrolls its body.
 */
export function AgentDesk(props: AgentDeskProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "done",
        "onItemSelect",
        "queued",
        "running",
        "runningLabel",
        "style",
        "title",
    ]);
    const runningLabel = () => local.runningLabel ?? `${local.running.length} RUNNING`;
    return (
        <div
            {...rest}
            className={["kissopen-agent-desk", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="agent-desk"
            style={local.style}
        >
            <header
                className="kissopen-agent-desk__header"
                data-kissopen-desktop-ui="agent-desk-header"
            >
                <Icon className="kissopen-agent-desk__spark" name="spark" size={16} />
                <span
                    className="kissopen-agent-desk__title"
                    data-kissopen-desktop-ui="agent-desk-title"
                >
                    {local.title ?? t("Agent desk")}
                </span>
                <Badge
                    className="kissopen-agent-desk__count"
                    label={runningLabel()}
                    variant="accent"
                />
            </header>
            <ScrollArea
                className="kissopen-agent-desk__body"
                data-kissopen-desktop-ui="agent-desk-body"
                viewportClassName="kissopen-agent-desk__body-viewport"
            >
                <div
                    className="kissopen-agent-desk__body-content"
                    data-kissopen-desktop-ui="agent-desk-body-content"
                >
                    {local.running.map((run) => (
                        <section
                            aria-label={`${run.agent} · ${run.title}`}
                            className="kissopen-agent-desk__run"
                            key={run.id}
                            data-kissopen-desktop-ui="agent-desk-run"
                        >
                            <div
                                className="kissopen-agent-desk__run-head"
                                data-kissopen-desktop-ui="agent-desk-run-head"
                            >
                                <Avatar
                                    aria-label={run.agent}
                                    initials={run.initials}
                                    size="xs"
                                    tone={run.tone}
                                    type="agent"
                                />
                                <span
                                    className="kissopen-agent-desk__run-title"
                                    data-kissopen-desktop-ui="agent-desk-run-title"
                                >
                                    {run.title}
                                </span>
                                {run.eta ? (
                                    <span
                                        className="kissopen-agent-desk__run-eta"
                                        data-kissopen-desktop-ui="agent-desk-run-eta"
                                    >
                                        {run.eta}
                                    </span>
                                ) : null}
                            </div>
                            {run.detail ? (
                                <div
                                    className="kissopen-agent-desk__run-detail"
                                    data-kissopen-desktop-ui="agent-desk-run-detail"
                                >
                                    {run.detail}
                                </div>
                            ) : null}
                            {run.progress !== undefined ? (
                                <div
                                    aria-valuemax={100}
                                    aria-valuemin={0}
                                    aria-valuenow={clampProgress(run.progress)}
                                    className="kissopen-agent-desk__run-track"
                                    data-kissopen-desktop-ui="agent-desk-run-track"
                                    role="progressbar"
                                >
                                    <div
                                        className="kissopen-agent-desk__run-fill"
                                        data-kissopen-desktop-ui="agent-desk-run-fill"
                                        style={{ width: `${clampProgress(run.progress)}%` }}
                                    />
                                </div>
                            ) : null}
                        </section>
                    ))}
                    {(local.queued?.length ?? 0) > 0 ? (
                        <>
                            <div
                                className="kissopen-agent-desk__section-label"
                                data-kissopen-desktop-ui="agent-desk-section-label"
                                data-section="queued"
                            >
                                {t("Queued")}
                            </div>
                            {(local.queued ?? []).map((item) => (
                                <button
                                    className="kissopen-agent-desk__queued"
                                    key={item.id}
                                    data-kissopen-desktop-ui="agent-desk-queued"
                                    onClick={() => local.onItemSelect?.(item.id)}
                                    type="button"
                                >
                                    <Icon
                                        className="kissopen-agent-desk__row-icon"
                                        name={item.icon ?? "clock"}
                                        size={14}
                                    />
                                    <span
                                        className="kissopen-agent-desk__row-title"
                                        data-kissopen-desktop-ui="agent-desk-row-title"
                                    >
                                        {item.title}
                                    </span>
                                    {item.meta ? (
                                        <span
                                            className="kissopen-agent-desk__row-meta"
                                            data-kissopen-desktop-ui="agent-desk-row-meta"
                                        >
                                            {item.meta}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </>
                    ) : null}
                    {(local.done?.length ?? 0) > 0 ? (
                        <>
                            <div
                                className="kissopen-agent-desk__section-label"
                                data-kissopen-desktop-ui="agent-desk-section-label"
                                data-section="done"
                            >
                                {t("Done today")}
                            </div>
                            {(local.done ?? []).map((item) => (
                                <button
                                    className="kissopen-agent-desk__done"
                                    key={item.id}
                                    data-kissopen-desktop-ui="agent-desk-done"
                                    onClick={() => local.onItemSelect?.(item.id)}
                                    type="button"
                                >
                                    <Icon
                                        className="kissopen-agent-desk__row-icon"
                                        name={item.icon ?? "check"}
                                        size={14}
                                    />
                                    <span
                                        className="kissopen-agent-desk__row-title"
                                        data-kissopen-desktop-ui="agent-desk-row-title"
                                    >
                                        {item.title}
                                    </span>
                                    {item.meta ? (
                                        <span
                                            className="kissopen-agent-desk__row-meta"
                                            data-kissopen-desktop-ui="agent-desk-row-meta"
                                        >
                                            {item.meta}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}
