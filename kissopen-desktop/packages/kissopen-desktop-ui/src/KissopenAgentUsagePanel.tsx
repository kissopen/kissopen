import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import type {
    KissopenAgentSessionUsage,
    KissopenAgentUsageGroup,
    KissopenAgentUsageQuota,
    KissopenAgentUsageQuotaWindow,
} from "kissopen-desktop-state";
import { USAGE_CRITICAL_PERCENT, usagePercentClamp, usageWindowTone } from "./usageTone";

export type KissopenAgentUsagePanelProps = {
    /** The projected usage snapshot; omit while the first load is in flight. */
    usage?: KissopenAgentSessionUsage;
    /** True while a load/poll is in flight (shows a subtle loading affordance). */
    loading?: boolean;
    /** Displayable error from a failed load; replaces the body when set. */
    error?: string;
    /** `panel` fills and scrolls a side-panel tab; the default is inline content. */
    placement?: "content" | "panel";
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

const TOKENS = new Intl.NumberFormat("en-US");
const TOKENS_COMPACT = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});
const COST = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatTokens(value: number, compact = false): string {
    return (compact ? TOKENS_COMPACT : TOKENS).format(value);
}

function formatCost(value: number): string {
    // Sub-cent costs still read meaningfully at four decimals; larger ones use two.
    return value > 0 && value < 0.01 ? `$${value.toFixed(4)}` : COST.format(value);
}

const QUOTA_LABELS: Record<KissopenAgentUsageQuotaWindow["kind"], string> = {
    fiveHour: "5 hours",
    weekly: "Week",
};

/** Formats an epoch-millis reset time as a short local day/time. */
function formatReset(resetsAt: number): string {
    return new Date(resetsAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function GroupRow(props: { compact: boolean; group: KissopenAgentUsageGroup }) {
    const { group } = props;
    const cacheTokens = group.cacheReadTokens + group.cacheWriteTokens;
    const number = (value: number) => formatTokens(value, props.compact);
    const exactTitle = (value: number) => (props.compact ? formatTokens(value) : undefined);
    return (
        <tr
            className="kissopen-agent-usage__row"
            data-kissopen-desktop-ui="kissopen-agent-usage-group"
        >
            <th className="kissopen-agent-usage__model" scope="row" title={group.modelId}>
                {group.modelId}
            </th>
            <td className="kissopen-agent-usage__num" title={exactTitle(group.inputTokens)}>
                {number(group.inputTokens)}
            </td>
            <td className="kissopen-agent-usage__num" title={exactTitle(group.outputTokens)}>
                {number(group.outputTokens)}
            </td>
            <td className="kissopen-agent-usage__num" title={exactTitle(cacheTokens)}>
                {number(cacheTokens)}
            </td>
            <td className="kissopen-agent-usage__num" title={exactTitle(group.totalTokens)}>
                {number(group.totalTokens)}
            </td>
            <td className="kissopen-agent-usage__num">{formatCost(group.cost)}</td>
        </tr>
    );
}

function QuotaRow(props: { quota: KissopenAgentUsageQuota }) {
    const { quota } = props;
    return (
        <div
            className="kissopen-agent-usage__quota"
            data-kissopen-desktop-ui="kissopen-agent-usage-quota"
        >
            <span className="kissopen-agent-usage__quota-provider">{quota.providerId}</span>
            {quota.windows.length === 0 ? (
                <span className="kissopen-agent-usage__quota-empty">{t("No limits reported")}</span>
            ) : (
                quota.windows.map((window) => {
                    const percent = usagePercentClamp(window.usedPercent);
                    return (
                        <span
                            className="kissopen-agent-usage__quota-window"
                            data-kissopen-desktop-ui="kissopen-agent-usage-quota-window"
                            data-tone={usageWindowTone(percent)}
                            key={window.kind}
                        >
                            <span className="kissopen-agent-usage__quota-label">
                                {t(QUOTA_LABELS[window.kind])}
                            </span>
                            <span className="kissopen-agent-usage__quota-bar" aria-hidden="true">
                                <span
                                    className="kissopen-agent-usage__quota-fill"
                                    data-full={percent >= USAGE_CRITICAL_PERCENT ? "" : undefined}
                                    style={{ width: `${String(percent)}%` }}
                                />
                            </span>
                            <span
                                aria-label={t("{percent}% of {label} used", {
                                    percent: Math.round(percent),
                                    label: t(QUOTA_LABELS[window.kind]),
                                })}
                                className="kissopen-agent-usage__quota-percent"
                                role="img"
                            >
                                {Math.round(percent)}%
                            </span>
                            <span className="kissopen-agent-usage__quota-reset">
                                {t("resets {time}", { time: formatReset(window.resetsAt) })}
                            </span>
                        </span>
                    );
                })
            )}
        </div>
    );
}

/**
 * KissopenAgentUsagePanel — presentational token/cost accounting for a session (`/usage`).
 * Renders per-model token+cost groups, a session total, an approximate
 * context-window occupancy line, and any provider rate-limit windows. Purely
 * driven by a `KissopenAgentSessionUsage` snapshot plus loading/error flags, so the owning
 * surface fetches (and polls while visible) and passes the result down. Holds no
 * state and starts no work of its own.
 *
 * It is a content block rather than a card: the reading is named and framed by
 * the side-panel tab or other surface that carries it, so it neither repeats
 * that title nor draws a second border inside the first one.
 *
 * A rate-limit window is drawn with the same grammar the provider-usage page
 * uses — name, measure, share, reset, in fixed columns, and monochrome until
 * the share is worth colouring — so the same limit read here and read there is
 * recognisably the same reading rather than two unrelated charts.
 */
export function KissopenAgentUsagePanel(props: KissopenAgentUsagePanelProps) {
    const { usage } = props;
    const panel = props.placement === "panel";
    const content = (
        <section
            className={["kissopen-agent-usage", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-usage-panel"
            data-loading={props.loading ? "" : undefined}
            data-placement={panel ? "panel" : undefined}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {props.error !== undefined ? (
                <p
                    className="kissopen-agent-usage__error"
                    data-kissopen-desktop-ui="kissopen-agent-usage-error"
                >
                    {props.error}
                </p>
            ) : usage === undefined ? (
                <p
                    className="kissopen-agent-usage__empty"
                    data-kissopen-desktop-ui="kissopen-agent-usage-empty"
                >
                    {t("Loading usage…")}
                </p>
            ) : (
                <>
                    <div
                        className="kissopen-agent-usage__totals"
                        data-kissopen-desktop-ui="kissopen-agent-usage-totals"
                    >
                        <span className="kissopen-agent-usage__total">
                            <span className="kissopen-agent-usage__total-value">
                                {formatTokens(usage.totalTokens)}
                            </span>
                            <span className="kissopen-agent-usage__total-label">{t("tokens")}</span>
                        </span>
                        <span className="kissopen-agent-usage__total">
                            <span className="kissopen-agent-usage__total-value">
                                {formatCost(usage.totalCost)}
                            </span>
                            <span className="kissopen-agent-usage__total-label">{t("cost")}</span>
                        </span>
                    </div>

                    {usage.groups.length > 0 ? (
                        <table
                            className="kissopen-agent-usage__table"
                            data-kissopen-desktop-ui="kissopen-agent-usage-table"
                        >
                            <thead>
                                <tr>
                                    <th scope="col">{t("Model")}</th>
                                    <th scope="col">{t("In")}</th>
                                    <th scope="col">{t("Out")}</th>
                                    <th scope="col">{t("Cache")}</th>
                                    <th scope="col">{t("Total")}</th>
                                    <th scope="col">{t("Cost")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usage.groups.map((group) => (
                                    <GroupRow
                                        compact={panel}
                                        group={group}
                                        key={`${group.providerId}:${group.modelId}`}
                                    />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="kissopen-agent-usage__empty">{t("No model usage yet.")}</p>
                    )}

                    {usage.context ? (
                        <p
                            className="kissopen-agent-usage__context"
                            data-kissopen-desktop-ui="kissopen-agent-usage-context"
                        >
                            {t(
                                usage.context.approximate
                                    ? "Context: {tokens} tokens (approximate) on {model}"
                                    : "Context: {tokens} tokens on {model}",
                                {
                                    tokens: formatTokens(usage.context.totalTokens),
                                    model: usage.context.modelId ?? "",
                                },
                            )}
                        </p>
                    ) : null}

                    {usage.quotas.length > 0 ? (
                        <div
                            className="kissopen-agent-usage__quotas"
                            data-kissopen-desktop-ui="kissopen-agent-usage-quotas"
                        >
                            {usage.quotas.map((quota) => (
                                <QuotaRow key={quota.providerId} quota={quota} />
                            ))}
                        </div>
                    ) : null}
                </>
            )}
        </section>
    );
    return panel ? (
        <div
            className="kissopen-agent-usage-panel-scroll"
            data-kissopen-desktop-ui="kissopen-agent-usage-panel-scroll"
        >
            <div className="kissopen-agent-usage-panel-scroll__content">{content}</div>
        </div>
    ) : (
        content
    );
}
