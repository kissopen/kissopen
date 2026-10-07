import { t } from "kissopen-desktop-state";
import type { ReactNode } from "react";
import type {
    KissopenAgentProviderModelTokenUsage,
    KissopenAgentProviderTokenCounts,
    KissopenAgentProviderUsageEntry,
    KissopenAgentProviderUsageWindow,
    UserError,
} from "kissopen-desktop-state";
import { Badge } from "../../Badge";
import { AccountPlanSummary, type AccountPlanSummaryProps } from "../../AccountPlanSummary";
import { Banner } from "../../Banner";
import { EmptyState } from "../../EmptyState";
import type { UsageWindowTone } from "../../usageTone";
import { usagePercentClamp, usageWindowTone } from "../../usageTone";
import { Ionicon } from "../../vectorIcons/VectorIcon";
import { providerAccountName } from "./providerAccountName";
import { Button } from "../../Button";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface KissopenAgentUsageSettingsProps {
    /**
     * KISSOPEN's own plan, read the same way and drawn the same way as the
     * machine's other accounts. It is the same shape deliberately: one page
     * answering one question should not have two looks.
     */
    kissopen?: KissopenAgentProviderUsageEntry;
    planOverview?: AccountPlanSummaryProps;
    /** Opens the plan catalogue, which is a page of its own. */
    onViewPlans?: () => void;
    /**
     * KISSOPEN points bought or granted and not yet spent. They are used once
     * the plan's window is full, so they sit under the plan's own usage.
     */
    points?: number;
    /** Only enabled provider accounts, in the order they should be read. */
    providers: readonly KissopenAgentProviderUsageEntry[];
    /** True before the first reading arrives, so "no accounts" is not claimed early. */
    loading?: boolean;
    /** The reading itself failed; whatever was already read stays legible beneath it. */
    error?: UserError;
    /** Renders when a reading (or a failed attempt) was taken, the way the rest of the app renders time. */
    readingTime?: (capturedAt: number) => string | undefined;
    /** Current epoch millis used to render live time remaining until each reported reset. */
    currentTime?: number;
}

/** An account is in one of these; the first three come straight from its worst window. */
type UsageTone = UsageWindowTone | "spent" | "unread" | "error";

const TONE_LABELS: Record<UsageTone, string> = {
    ample: "Room left",
    warning: "Running low",
    critical: "Nearly spent",
    spent: "Spent",
    unread: "Not read yet",
    error: "Could not be read",
};

/** The rolling windows a token count is reported for, widest reading last. */
const TOKEN_WINDOWS = [
    { key: "hour", label: t("Hour") },
    { key: "day", label: t("Day") },
    { key: "week", label: t("Week") },
    { key: "month", label: t("Month") },
] as const;

const TOKENS = new Intl.NumberFormat("en-US");
const TOKENS_COMPACT = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});

/**
 * The Usage category: how much of each provider account's plan this machine has
 * spent.
 *
 * A person opens this category to learn one thing: whether they can keep
 * working. So the answer is the content and nothing is drawn around it — an
 * account is a name with its windows listed beneath, and the only rule here is
 * the one that separates one account from the next.
 *
 * A window is one line: what it is, how much of it is gone drawn across the
 * middle of the column, the share as a number, and when it starts over. Putting
 * the measure between the name and the number keeps the three readings about
 * one window together, which a name at the far left and a number at the far
 * right could not do.
 *
 * Beneath the windows an account lists what it actually spent, by model and by
 * rolling window. A plan share and a token count answer different questions —
 * "may I keep working" and "on what did this machine spend" — so the counts stay
 * their own reading rather than being folded into a bar, and they are never
 * summed across models, whose tokens are not comparable quantities.
 *
 * Colour answers "can I keep working" and nothing else. Each account carries one
 * dot in the status vocabulary the rest of the app uses — green for room left,
 * orange for running low, red for nearly spent, spent, or failed to read, and
 * grey for an account nothing has been read from yet — so the whole answer is
 * readable down the left edge. The window bars stay the ink of the text until
 * a share crosses into warning, which keeps the coloured bar meaning "this one",
 * not "this is a bar".
 *
 * It renders exactly what it is handed. It reads nothing and refreshes nothing:
 * the owner keeps the readings current for as long as this category is open.
 */
export function KissopenAgentUsageSettings(props: KissopenAgentUsageSettingsProps) {
    const providers = props.providers;
    return (
        <>
            {/* KISSOPEN's own plan comes first: it is the one account the reader
                is billed for here, and the machine's other assistant accounts
                are context for it rather than the other way round. */}
            {props.kissopen ? (
                <KissopenAgentSettingsSection
                    description={t("聊天与工作共用同一份用量。用完之后，等窗口重置即可继续。")}
                    title={t("KissOpen")}
                >
                    <div
                        className="kissopen-agent-usage-settings__providers"
                        data-kissopen-desktop-ui="kissopen-agent-usage-settings-kissopen"
                    >
                        {props.planOverview && <AccountPlanSummary {...props.planOverview} />}
                        <ProviderSection
                            {...(props.onViewPlans
                                ? {
                                      action: (
                                          <Button
                                              onClick={props.onViewPlans}
                                              size="small"
                                              variant="secondary"
                                          >
                                              {t("查看套餐")}
                                          </Button>
                                      ),
                                  }
                                : {})}
                            currentTime={props.currentTime}
                            provider={props.kissopen}
                            {...(props.readingTime ? { readingTime: props.readingTime } : {})}
                        />
                        {props.points !== undefined && (
                            <div
                                className="kissopen-agent-usage-settings__points"
                                data-kissopen-desktop-ui="kissopen-agent-usage-settings-points"
                            >
                                <span className="kissopen-agent-usage-settings__points-label">
                                    {t("点数余额")}
                                </span>
                                <span className="kissopen-agent-usage-settings__points-value">
                                    {t("{count} 点", { count: props.points })}
                                </span>
                                <span className="kissopen-agent-usage-settings__points-note">
                                    {t("套餐额度用完后自动使用")}
                                </span>
                                {props.onViewPlans && (
                                    <Button
                                        onClick={props.onViewPlans}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {t("购买点数")}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </KissopenAgentSettingsSection>
            ) : null}
            {props.error ? (
                <Banner tone="danger" title={t("Usage may be out of date")}>
                    {props.error.message}
                </Banner>
            ) : null}

            {providers.length === 0 &&
            props.kissopen &&
            !props.loading ? null : providers.length === 0 ? (
                <EmptyState
                    // A category-wide wait, like the inbox and the plugin
                    // catalogue. The settled version asks the reader to go and
                    // sign in somewhere else, which is not something artwork
                    // here can help with.
                    animation={props.loading ? "brand-loading" : undefined}
                    description={
                        props.loading
                            ? "Reading what this machine's provider accounts have spent."
                            : "Sign in to a coding assistant on this machine and its plan appears here."
                    }
                    icon={props.loading ? "clock" : "zap"}
                    title={props.loading ? "Loading usage…" : "No provider accounts"}
                />
            ) : (
                <KissopenAgentSettingsSection
                    description={usageSubtitle(providers)}
                    title={t("Provider accounts")}
                >
                    <div
                        className="kissopen-agent-usage-settings__providers"
                        data-kissopen-desktop-ui="kissopen-agent-usage-settings-providers"
                    >
                        {providers.map((provider) => (
                            <ProviderSection
                                currentTime={props.currentTime}
                                key={provider.providerId}
                                provider={provider}
                                {...(props.readingTime ? { readingTime: props.readingTime } : {})}
                            />
                        ))}
                    </div>
                </KissopenAgentSettingsSection>
            )}
        </>
    );
}

function ProviderSection(props: {
    currentTime?: number;
    provider: KissopenAgentProviderUsageEntry;
    readingTime?: (capturedAt: number) => string | undefined;
    /** Sits with the plan name, because that is what it acts on. */
    action?: ReactNode;
}) {
    const { provider } = props;
    const usage = provider.usage;
    const tone = providerTone(provider);
    // A failed read still has an attempt behind it, and when that attempt
    // happened is the whole difference between "signed out a minute ago" and
    // "signed out since yesterday".
    const stamp = usage ? usage.capturedAt : provider.checkedAt;
    const taken = stamp === undefined ? undefined : props.readingTime?.(stamp);
    return (
        <section
            className="kissopen-agent-usage-settings__provider"
            data-kissopen-desktop-ui="kissopen-agent-usage-settings-provider"
            data-provider={provider.providerId}
            data-tone={tone}
        >
            <header className="kissopen-agent-usage-settings__provider-header">
                <span className="kissopen-agent-usage-settings__identity">
                    <span
                        aria-label={TONE_LABELS[tone]}
                        className="kissopen-agent-usage-settings__dot"
                        data-kissopen-desktop-ui="kissopen-agent-usage-settings-dot"
                        role="img"
                    />
                    <span
                        className="kissopen-agent-usage-settings__name"
                        data-kissopen-desktop-ui="kissopen-agent-usage-settings-provider-name"
                    >
                        {provider.name ?? providerAccountName(provider.providerId)}
                    </span>
                    {usage?.planName ? (
                        <span className="kissopen-agent-usage-settings__plan">
                            {usage.planName}
                        </span>
                    ) : null}
                    {props.action}
                </span>
                <span className="kissopen-agent-usage-settings__provider-meta">
                    {usage?.exhausted ? (
                        <span data-kissopen-desktop-ui="kissopen-agent-usage-settings-exhausted">
                            <Badge label={t("Spent")} variant="danger" />
                        </span>
                    ) : null}
                    {taken ? (
                        <span className="kissopen-agent-usage-settings__taken">{taken}</span>
                    ) : null}
                </span>
            </header>

            {provider.error !== undefined ? (
                <p
                    className="kissopen-agent-usage-settings__note"
                    data-kissopen-desktop-ui="kissopen-agent-usage-settings-provider-error"
                    data-note="error"
                >
                    <Ionicon
                        className="kissopen-agent-usage-settings__note-icon"
                        name="alert-circle-outline"
                        size={16}
                    />
                    <span>{provider.error}</span>
                </p>
            ) : null}

            {usage === undefined ? (
                provider.error === undefined ? (
                    <p className="kissopen-agent-usage-settings__note" data-note="unread">
                        <Ionicon
                            className="kissopen-agent-usage-settings__note-icon"
                            name="time-outline"
                            size={16}
                        />
                        <span>{t("This account has not been read yet.")}</span>
                    </p>
                ) : null
            ) : (
                <>
                    {hasWindows(provider) ? (
                        <div className="kissopen-agent-usage-settings__windows">
                            <UsageWindow
                                currentTime={props.currentTime}
                                label={t("5 hours")}
                                window={usage.fiveHour}
                            />
                            <UsageWindow
                                currentTime={props.currentTime}
                                label={t("Week")}
                                window={usage.weekly}
                            />
                            <UsageWindow
                                currentTime={props.currentTime}
                                label={t("Month")}
                                window={usage.monthly}
                            />
                            {usage.credits ? (
                                <div
                                    className="kissopen-agent-usage-settings__credits"
                                    data-kissopen-desktop-ui="kissopen-agent-usage-settings-credits"
                                >
                                    <span className="kissopen-agent-usage-settings__window-label">
                                        {t("Credits")}
                                    </span>
                                    <span className="kissopen-agent-usage-settings__credits-value">
                                        {creditsText(
                                            usage.credits.available,
                                            usage.credits.unlimited,
                                            usage.credits.remainingCents,
                                        )}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {usage.models && usage.models.length > 0 ? (
                        <ModelTokens models={usage.models} />
                    ) : null}

                    {!hasWindows(provider) && !(usage.models && usage.models.length > 0) ? (
                        <p className="kissopen-agent-usage-settings__note" data-note="idle">
                            <Ionicon
                                className="kissopen-agent-usage-settings__note-icon"
                                name="remove-outline"
                                size={16}
                            />
                            <span>{t("This account has spent nothing this machine can see.")}</span>
                        </p>
                    ) : null}
                </>
            )}
        </section>
    );
}

/**
 * One reported window on a single line: its name, then the share drawn across
 * the middle of the column, then that share as a number, then when it starts
 * over. The measure runs the width the column can spare so a few percent is
 * still a visible difference.
 *
 * A vendor that does not report a window is not shown a line for it: an empty
 * track would read as "none of it used", which is the opposite of "we were not
 * told".
 */
function UsageWindow(props: {
    currentTime?: number;
    label: string;
    window?: KissopenAgentProviderUsageWindow;
}) {
    const window = props.window;
    if (!window) return null;
    const percent = usagePercentClamp(window.usedPercent);
    const tone = usageWindowTone(percent);
    const reset =
        window.resetsAt !== undefined && props.currentTime !== undefined
            ? resetTimeRemaining(window.resetsAt, props.currentTime)
            : undefined;
    return (
        <div
            className="kissopen-agent-usage-settings__window"
            data-kissopen-desktop-ui="kissopen-agent-usage-settings-window"
            data-tone={tone}
        >
            <span className="kissopen-agent-usage-settings__window-label">{props.label}</span>
            <span
                aria-hidden="true"
                className="kissopen-agent-usage-settings__track"
                data-kissopen-desktop-ui="kissopen-agent-usage-settings-track"
            >
                <span
                    className="kissopen-agent-usage-settings__fill"
                    data-kissopen-desktop-ui="kissopen-agent-usage-settings-fill"
                    style={{ width: `${String(percent)}%` }}
                />
            </span>
            <span
                aria-label={t("{percent}% of {label} used", {
                    percent: Math.round(percent),
                    label: props.label,
                })}
                className="kissopen-agent-usage-settings__percent"
                role="img"
            >
                {Math.round(percent)}%
            </span>
            <span
                className="kissopen-agent-usage-settings__reset"
                data-kissopen-desktop-ui="kissopen-agent-usage-settings-reset"
            >
                {reset ?? ""}
            </span>
        </div>
    );
}

/**
 * What the account spent, one row per model and one column per rolling window.
 *
 * Models are the rows because tokens from two models are not the same quantity:
 * there is no honest total across them, so the reading stops at the model that
 * earned it. A cell is that model's whole spend in that window — input, output,
 * and both halves of the cache — rounded for scanning, with the exact counts on
 * the cell for anyone who needs them. A window a model spent nothing in is a
 * dash rather than a zero, so the numbers that exist are what the eye lands on.
 */
function ModelTokens(props: { models: readonly KissopenAgentProviderModelTokenUsage[] }) {
    return (
        // Tokens by model are a genuine two-dimensional matrix: four numeric
        // columns must share one measured width down every model row, which a
        // flex row per model could not guarantee.
        <table
            className="kissopen-agent-usage-settings__models"
            data-kissopen-desktop-ui="kissopen-agent-usage-settings-models"
        >
            <thead>
                <tr>
                    <th scope="col">{t("Model")}</th>
                    {TOKEN_WINDOWS.map((window) => (
                        <th data-column="window" key={window.key} scope="col">
                            {window.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {props.models.map((model) => (
                    <tr
                        className="kissopen-agent-usage-settings__model-row"
                        data-kissopen-desktop-ui="kissopen-agent-usage-settings-model"
                        key={model.modelId}
                    >
                        <th
                            className="kissopen-agent-usage-settings__model"
                            scope="row"
                            title={model.modelId}
                        >
                            {model.modelId}
                        </th>
                        {TOKEN_WINDOWS.map((window) => {
                            const counts = model[window.key];
                            return (
                                <td
                                    className="kissopen-agent-usage-settings__tokens"
                                    data-kissopen-desktop-ui="kissopen-agent-usage-settings-tokens"
                                    data-empty={counts === undefined ? "" : undefined}
                                    key={window.key}
                                    {...(counts ? { title: tokensTitle(counts) } : {})}
                                >
                                    {counts === undefined
                                        ? "—"
                                        : TOKENS_COMPACT.format(tokensTotal(counts))}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Everything one model consumed in a window; cache is spend too, so it counts. */
function tokensTotal(counts: KissopenAgentProviderTokenCounts): number {
    return (
        counts.inputTokens + counts.outputTokens + counts.cacheReadTokens + counts.cacheWriteTokens
    );
}

/** The exact counts behind a rounded cell, for the reader who wants them. */
function tokensTitle(counts: KissopenAgentProviderTokenCounts): string {
    return [
        `Input ${TOKENS.format(counts.inputTokens)}`,
        `Output ${TOKENS.format(counts.outputTokens)}`,
        t("Cache read {TOKENS}", { TOKENS: TOKENS.format(counts.cacheReadTokens) }),
        t("Cache write {TOKENS}", { TOKENS: TOKENS.format(counts.cacheWriteTokens) }),
    ].join(" · ");
}

/** Whether this account reported any plan share at all, credits included. */
function hasWindows(provider: KissopenAgentProviderUsageEntry): boolean {
    const usage = provider.usage;
    if (usage === undefined) return false;
    return (
        usage.fiveHour !== undefined ||
        usage.weekly !== undefined ||
        usage.monthly !== undefined ||
        usage.credits !== undefined
    );
}

/**
 * The one state an account is in, which its dot reports. A read that failed and
 * a read that never happened are different answers to "can I keep working", so
 * they are separate states rather than one grey absence; otherwise the account
 * takes the tone of its tightest window.
 */
function providerTone(provider: KissopenAgentProviderUsageEntry): UsageTone {
    if (provider.error !== undefined) return "error";
    const usage = provider.usage;
    if (usage === undefined) return "unread";
    if (usage.exhausted) return "spent";
    const windows = [usage.fiveHour, usage.weekly, usage.monthly].filter(
        (window): window is KissopenAgentProviderUsageWindow => window !== undefined,
    );
    if (windows.length === 0) return "ample";
    return usageWindowTone(
        Math.max(...windows.map((window) => usagePercentClamp(window.usedPercent))),
    );
}

function resetTimeRemaining(resetsAt: number, currentTime: number): string {
    const remainingMinutes = Math.ceil((resetsAt - currentTime) / 60_000);
    if (remainingMinutes <= 0) return "reset due";
    if (remainingMinutes < 60) return `resets in ${String(remainingMinutes)}m`;

    const remainingHours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    if (remainingHours < 24)
        return `resets in ${String(remainingHours)}h${minutes === 0 ? "" : ` ${String(minutes)}m`}`;

    const days = Math.floor(remainingHours / 24);
    const hours = remainingHours % 24;
    return `resets in ${String(days)}d${hours === 0 ? "" : ` ${String(hours)}h`}`;
}

function creditsText(
    available: boolean,
    unlimited: boolean,
    remainingCents: number | undefined,
): string {
    if (unlimited) return "Unlimited";
    if (!available) return "None left";
    if (remainingCents === undefined) return "Available";
    return `$${(remainingCents / 100).toFixed(2)} left`;
}

/** How many accounts are listed, and how many of them are already spent. */
function usageSubtitle(providers: readonly KissopenAgentProviderUsageEntry[]): string {
    const spent = providers.filter((provider) => provider.usage?.exhausted).length;
    const accounts = `${String(providers.length)} account${providers.length === 1 ? "" : "s"}`;
    return spent === 0 ? accounts : `${accounts} · ${String(spent)} spent`;
}
