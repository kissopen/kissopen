import {
    type KissopenAgentClient,
    type KissopenAgentProviderModelTokenUsage,
    type KissopenAgentProviderTokenCounts,
    type KissopenAgentProviderUsageEntry,
    type KissopenAgentProviderUsageReading,
    type KissopenAgentProviderUsageSource,
    type KissopenAgentProviderUsageWindow,
    type kissopenAgentProtocol,
    t,
} from "kissopen-desktop-state";

const POLL_MS = 5_000;

type UsageWindow = "hour" | "day" | "week" | "month";

const WINDOWS: readonly UsageWindow[] = ["hour", "day", "week", "month"];

/**
 * The product's own cloud provider. What stands behind it — which models,
 * from whom — is the service's business, not the reader's, so its spend is
 * one "cloud model" row; and it has no account of its own to report (the
 * plan's usage is the account section), so a missing account reading is not
 * a failure worth a red mark.
 */
const CLOUD_PROVIDER_ID = "kissopen";

/** Reads daemon token usage only while the Usage settings category is observed. */
export function kissopenAgentUsageSourceCreate(
    client: KissopenAgentClient,
): KissopenAgentProviderUsageSource {
    return {
        subscribe(listener) {
            let closed = false;
            let loading = false;
            let request: AbortController | undefined;
            let providers: readonly KissopenAgentProviderUsageEntry[] = [];
            let loadedAt: number | undefined;

            const load = (): void => {
                if (closed || loading) return;
                loading = true;
                request = new AbortController();
                void client.getUsage({ signal: request.signal }).then(
                    (usage) => {
                        loading = false;
                        if (closed) return;
                        loadedAt = Date.now();
                        providers = usageProject(usage, loadedAt);
                        listener({ loadedAt, loading: false, providers });
                    },
                    (error: unknown) => {
                        loading = false;
                        if (closed || request?.signal.aborted) return;
                        listener({
                            error: error instanceof Error ? error.message : String(error),
                            loading: false,
                            providers,
                            ...(loadedAt === undefined ? {} : { loadedAt }),
                        });
                    },
                );
            };

            listener({ loading: true, providers });
            load();
            const timer = setInterval(load, POLL_MS);
            return () => {
                if (closed) return;
                closed = true;
                clearInterval(timer);
                request?.abort();
            };
        },
    };
}

function usageProject(
    usage: kissopenAgentProtocol.DaemonUsageResponse,
    capturedAt: number,
): readonly KissopenAgentProviderUsageEntry[] {
    const providersById = new Map(
        (usage.providers ?? []).map((provider) => [provider.providerId, provider]),
    );
    const providerIds = new Set(providersById.keys());
    for (const window of WINDOWS)
        for (const providerId of Object.keys(usage[window])) providerIds.add(providerId);

    return [...providerIds].map((providerId) => {
        const provider = providersById.get(providerId);
        const perModel = modelsProject(
            usage,
            providerId,
            provider?.models.map((model) => model.id) ?? [],
        );
        const cloud = providerId === CLOUD_PROVIDER_ID;
        const models = cloud ? cloudModelsProject(perModel) : perModel;
        const reading = provider?.usage
            ? accountUsageProject(provider.usage, models)
            : models.length > 0
              ? { capturedAt, models }
              : undefined;
        return {
            providerId,
            ...(provider?.checkedAt == null ? {} : { checkedAt: provider.checkedAt }),
            ...(provider?.error == null || cloud ? {} : { error: provider.error }),
            ...(reading === undefined ? {} : { usage: reading }),
        };
    });
}

function accountUsageProject(
    usage: kissopenAgentProtocol.ProviderAccountUsage,
    models: readonly KissopenAgentProviderModelTokenUsage[],
): KissopenAgentProviderUsageReading {
    const fiveHour = windowProject(usage.windows.fiveHour);
    const weekly = windowProject(usage.windows.weekly);
    const monthly = windowProject(usage.windows.monthly);
    return {
        capturedAt: usage.capturedAt,
        exhausted: usage.exhausted,
        ...(usage.planName === null ? {} : { planName: usage.planName }),
        ...(fiveHour === undefined ? {} : { fiveHour }),
        ...(weekly === undefined ? {} : { weekly }),
        ...(monthly === undefined ? {} : { monthly }),
        ...(usage.credits === null
            ? {}
            : {
                  credits: {
                      available: usage.credits.available,
                      unlimited: usage.credits.unlimited,
                      ...(usage.credits.remainingCents === null
                          ? {}
                          : { remainingCents: usage.credits.remainingCents }),
                      ...(usage.credits.usedPercent === null
                          ? {}
                          : { usedPercent: usage.credits.usedPercent }),
                  },
              }),
        ...(models.length === 0 ? {} : { models }),
    };
}

function windowProject(
    window: kissopenAgentProtocol.ProviderAccountUsageWindow | null,
): KissopenAgentProviderUsageWindow | undefined {
    if (window === null) return undefined;
    return {
        usedPercent: window.usedPercent,
        ...(window.resetsAt === null ? {} : { resetsAt: window.resetsAt }),
        ...(window.startsAt === null ? {} : { startsAt: window.startsAt }),
        ...(window.durationMs === null ? {} : { durationMs: window.durationMs }),
    };
}

function modelsProject(
    usage: kissopenAgentProtocol.DaemonUsageResponse,
    providerId: string,
    configuredModelIds: readonly string[],
): readonly KissopenAgentProviderModelTokenUsage[] {
    // The provider entry is the authoritative complete catalog. Rolling token
    // windows are deliberately sparse, so deriving rows from them alone hides
    // every model that has not spent tokens during the reported periods.
    const modelIds = new Set(configuredModelIds);
    for (const window of WINDOWS)
        for (const modelId of Object.keys(usage[window][providerId] ?? {})) modelIds.add(modelId);

    return [...modelIds]
        .map(
            (modelId): KissopenAgentProviderModelTokenUsage => ({
                modelId,
                ...countsFor(usage.hour, providerId, modelId, "hour"),
                ...countsFor(usage.day, providerId, modelId, "day"),
                ...countsFor(usage.week, providerId, modelId, "week"),
                ...countsFor(usage.month, providerId, modelId, "month"),
            }),
        )
        .sort((left, right) => {
            // The daemon reports models keyed by an object, so their order is
            // whatever insertion produced. The account's heaviest model is the
            // one worth reading first, and the name settles a tie so the list
            // does not reshuffle between two readings that spent the same.
            const spent = monthTokens(right) - monthTokens(left);
            return spent === 0 ? left.modelId.localeCompare(right.modelId) : spent;
        });
}

/** The cloud provider's spend as one row: every model it served, summed per window. */
function cloudModelsProject(
    models: readonly KissopenAgentProviderModelTokenUsage[],
): readonly KissopenAgentProviderModelTokenUsage[] {
    const spent = models.filter((model) => WINDOWS.some((window) => model[window] !== undefined));
    if (spent.length === 0) return [];
    const sum = (
        window: UsageWindow,
    ): Partial<Record<UsageWindow, KissopenAgentProviderTokenCounts>> => {
        const counts = spent.flatMap((model) =>
            model[window] === undefined ? [] : [model[window]!],
        );
        if (counts.length === 0) return {};
        return {
            [window]: {
                inputTokens: counts.reduce((total, one) => total + one.inputTokens, 0),
                outputTokens: counts.reduce((total, one) => total + one.outputTokens, 0),
                cacheReadTokens: counts.reduce((total, one) => total + one.cacheReadTokens, 0),
                cacheWriteTokens: counts.reduce((total, one) => total + one.cacheWriteTokens, 0),
            },
        };
    };
    return [
        {
            modelId: t("云端模型"),
            ...sum("hour"),
            ...sum("day"),
            ...sum("week"),
            ...sum("month"),
        },
    ];
}

/** Everything one model consumed over the widest window the daemon reports. */
function monthTokens(model: KissopenAgentProviderModelTokenUsage): number {
    const counts = model.month;
    if (counts === undefined) return 0;
    return (
        counts.inputTokens + counts.outputTokens + counts.cacheReadTokens + counts.cacheWriteTokens
    );
}

function countsFor(
    usage: kissopenAgentProtocol.UsageBreakdown,
    providerId: string,
    modelId: string,
    window: UsageWindow,
): Partial<Record<UsageWindow, KissopenAgentProviderTokenCounts>> {
    const counts = usage[providerId]?.[modelId];
    return counts === undefined ? {} : { [window]: tokenCountsProject(counts) };
}

function tokenCountsProject(
    counts: kissopenAgentProtocol.ModelUsage,
): KissopenAgentProviderTokenCounts {
    return {
        cacheReadTokens: counts.cacheRead,
        cacheWriteTokens: counts.cacheWrite,
        inputTokens: counts.input,
        outputTokens: counts.output,
    };
}
