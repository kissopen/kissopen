import { t } from "kissopen-desktop-state";
import { AppCommunityAccountSettings } from "../components/AppCommunityAccountSettings";
import { AppAccountSecuritySettings } from "../components/AppAccountSecuritySettings";
import { useCloudDestinations } from "../cloudDestinations";
import { useSyncExternalStore } from "react";
import type {
    AppearanceStore,
    ExperimentsStore,
    KissopenAgentInstructionsSnapshot,
    KissopenAgentDebugLogSnapshot,
    KissopenAgentSecurityPolicySnapshot,
    KissopenAgentSecret,
    KissopenAgentModelCatalog,
    KissopenAgentModelKey,
    KissopenAgentPermissionMode,
    KissopenAgentProviderEntry,
    KissopenAgentSettingsSnapshot,
    KissopenAgentSettingsStore,
    KissopenAgentThinkingLevel,
    KissopenAgentWindowStore,
    TitleShimmerStore,
} from "kissopen-desktop-state";
import {
    KISSOPEN_AGENT_INSTRUCTIONS_MAX_BYTES,
    KISSOPEN_AGENT_SECURITY_POLICY_MAX_BYTES,
    kissopenAgentModelKey,
    kissopenAgentPermissionLabel,
    kissopenAgentThinkingLabel,
    experimentsStoreNoop,
    kissopenAgentCloudStoreNoop,
    kissopenAgentAvailabilityProject,
    kissopenAgentIntegrationStoreNoop,
    kissopenAgentProfileStoreNoop,
    kissopenAgentProviderUsageStoreNoop,
    kissopenAgentProvidersStoreNoop,
    kissopenAgentSecretsStoreNoop,
    kissopenAgentWindowStoreNoop,
    localePreference,
    localePreferenceChange,
    localePreferenceChangeable,
    titleShimmerStoreNoop,
} from "kissopen-desktop-state";
import {
    EmptyState,
    KissopenAgentGeneralSettings,
    KissopenAgentDebugLogPanel,
    KissopenAgentDebugSettings,
    KissopenAgentInstructionsSettings,
    KissopenAgentProviderSettings,
    KissopenAgentUsageSettings,
    KissopenAgentProfilerSettings,
    KissopenAgentProfileSettings,
    KissopenAgentSecretSettings,
    KissopenAgentSettingsShell,
    KissopenAgentStateSettings,
    providerAccountName,
    type KissopenAgentProviderRow,
    type KissopenAgentSecretRow,
    type KissopenAgentSettingsCategory,
    type KissopenAgentStateDocument,
} from "kissopen-desktop-ui";
import { KissopenAgentVersionProvider } from "../KissopenAgentVersionProvider";
import type { SelectOption } from "kissopen-desktop-ui";
import {
    type AppApplicationIdentity,
    hostKissopenAgent,
    type AppKissopenAgentDirectoryStore,
} from "../AppKissopenAgentView";

/** The categories the local settings window offers, in the order they are listed. */
export const KISSOPEN_AGENT_SETTINGS_CATEGORIES: readonly KissopenAgentSettingsCategory[] = [
    { icon: "settings", id: "general", label: t("General") },
    // The signed-in application account, separate from the local Git author.
    { icon: "users", id: "profile", label: t("Profile") },
    { icon: "lock", id: "security", label: t("Security") },
    // Community builds relabel this category as the local Git author identity.
    { icon: "branch", id: "account", label: t("Github account") },
    { icon: "doc", id: "instructions", label: t("Instructions") },
    { icon: "lock", id: "secrets", label: t("Secrets") },
    { icon: "globe", id: "providers", label: t("Providers") },
    { icon: "zap", id: "usage", label: t("Usage") },
    { icon: "code", id: "debug", label: t("Dev Tools") },
];

export const KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY = "general";

/** True when `section` addresses a category this window actually has. */
export function kissopenAgentSettingsCategoryExists(section: string): boolean {
    return KISSOPEN_AGENT_SETTINGS_CATEGORIES.some((category) => category.id === section);
}

export interface AppKissopenAgentDebugTargetSnapshot {
    readonly error?: string;
    readonly status: "stopped" | "starting" | "running" | "stopping" | "unavailable" | "error";
    readonly url?: string;
}

/** The native debugger state projected into the settings route. */
export interface AppKissopenAgentDebugSnapshot {
    readonly daemon: AppKissopenAgentDebugTargetSnapshot;
    readonly daemonConnected: boolean;
    readonly error?: string;
    readonly loading: boolean;
    readonly main: AppKissopenAgentDebugTargetSnapshot;
    readonly renderer: AppKissopenAgentDebugTargetSnapshot;
    readonly supported: boolean;
}

/** Framework-neutral adapter for the desktop debugger capability. */
export interface AppKissopenAgentDebugStore {
    get(): AppKissopenAgentDebugSnapshot;
    subscribe(listener: () => void): () => void;
    debugAllStart(): void;
    debugAllStop(): void;
    daemonInspectorStart(): void;
    daemonInspectorStop(): void;
    mainInspectorStart(): void;
    mainInspectorStop(): void;
    rendererInspectorStart(): void;
    rendererInspectorStop(): void;
}

/** One Kissopen Agent version the person may run, published or already downloaded. */
export interface AppKissopenAgentDaemonVersion {
    readonly downloaded: boolean;
    readonly prerelease: boolean;
    readonly version: string;
}

/** One agent the daemon is still waiting on, and the stage it is finishing. */
export interface AppKissopenAgentDrainAgent {
    readonly id: string;
    readonly stage: "inference" | "tools" | "compaction" | "settlement";
}

/** One runtime component whose admitted work has not drained yet. */
export interface AppKissopenAgentDrainComponent {
    readonly name: string;
    readonly count: number;
    readonly agents?: readonly AppKissopenAgentDrainAgent[];
    readonly truncated?: boolean;
}

/** Why the daemon is being taken down and brought back. */
export type AppKissopenAgentDaemonRestartReason = "install" | "restart";

/** The steps a restart runs through, in the order it runs them. */
export type AppKissopenAgentDaemonRestartStep =
    | "draining"
    | "stopping"
    | "starting"
    | "reconnecting";

/**
 * Where a deliberate agent restart has got to. Every fact here is the daemon's
 * own report of itself, so a surface showing it states rather than estimates.
 */
export type AppKissopenAgentDaemonInstall =
    /** No restart running — and how a finished one ends, so the screen leaves. */
    | { readonly phase: "idle" }
    | {
          readonly phase: "draining";
          readonly reason: AppKissopenAgentDaemonRestartReason;
          readonly version: string;
          readonly waitingFor: readonly AppKissopenAgentDrainComponent[];
          /**
           * The most open work this drain has held at once, which the share
           * already finished is measured against.
           */
          readonly waitingPeak: number;
          /** The drain has run long enough to be worth offering a way out of. */
          readonly killable: boolean;
      }
    | {
          readonly phase: "stopping";
          readonly reason: AppKissopenAgentDaemonRestartReason;
          readonly version: string;
          /** The drain was cut short, so work was interrupted rather than finished. */
          readonly killed: boolean;
      }
    | {
          readonly phase: "starting";
          readonly reason: AppKissopenAgentDaemonRestartReason;
          readonly version: string;
      }
    | {
          readonly phase: "reconnecting";
          readonly reason: AppKissopenAgentDaemonRestartReason;
          readonly version: string;
      }
    | {
          readonly phase: "error";
          readonly reason: AppKissopenAgentDaemonRestartReason;
          readonly version: string;
          readonly message: string;
          /** The step that was running when it failed. */
          readonly failedAt: AppKissopenAgentDaemonRestartStep;
      };

/** The managed KISSOPEN Agent installation projected into General settings. */
export interface AppKissopenAgentDaemonSnapshot {
    readonly availableVersion?: string;
    readonly error?: string;
    readonly installedVersion?: string;
    readonly managed: boolean;
    readonly message?: string;
    readonly operation: "idle" | "checking" | "downloading" | "upgrading";
    readonly runningVersion?: string;
    readonly runtime: "stopped" | "starting" | "ready";
    readonly updateAvailable: boolean;
    /** Newest first; empty until the first catalog read answers. */
    readonly versions: readonly AppKissopenAgentDaemonVersion[];
    /** A downloaded version waiting on the person to install it. */
    readonly readyVersion?: string;
    readonly install: AppKissopenAgentDaemonInstall;
}

export interface AppKissopenAgentDaemonStore {
    daemonCheck(): void;
    /** Drains and restarts the local daemon onto the downloaded version. */
    daemonInstall(): void;
    /** Hands the window back once a failed install has been read. */
    daemonInstallDismiss(): void;
    /** Stops waiting for the drain and takes the daemon down now. */
    daemonInstallKill(): void;
    /** Drains and restarts the daemon on the version it is already running. */
    daemonRestart(): void;
    daemonUpgrade(): void;
    daemonVersionSelect(version: string): void;
    get(): AppKissopenAgentDaemonSnapshot;
    subscribe(listener: () => void): () => void;
}

export interface AppKissopenAgentProfilerCapabilities {
    readonly liveDebuggerAttach: boolean;
    readonly nativeTrace: boolean;
    readonly processMetrics: boolean;
    readonly reactAttribution: boolean;
    readonly reactDevtoolsProfiling: boolean;
    readonly rendererMetrics: boolean;
}

export interface AppKissopenAgentProfilerSnapshot {
    readonly artifactPath?: string;
    readonly capabilities: AppKissopenAgentProfilerCapabilities;
    readonly error?: string;
    readonly partialReason?: string;
    readonly status:
        | "stopped"
        | "starting"
        | "running"
        | "stopping"
        | "partial"
        | "error"
        | "unavailable";
}

/** Framework-neutral adapter for the native renderer profiler capability. */
export interface AppKissopenAgentProfilerStore {
    get(): AppKissopenAgentProfilerSnapshot;
    profilerStart(): void;
    profilerStop(): void;
    subscribe(listener: () => void): () => void;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    security: "Password, two-factor authentication and linked sign-in providers",
    debug: "Inspect live state, KissOpen and KissOpen Agent debugger endpoints, and renderer profiles",
    general: "How this window looks and what a new session starts with",
    account: "Local author identity and KissOpen account connection",
    instructions: "Machine-wide agent guidance and permission-review policy",
    secrets: "Write-only environment bundles this KissOpen Agent can provide to agents",
    providers: "Every model provider this KissOpen Agent daemon knows about",
    usage: "How much of each provider account's plan this machine has spent",
};

const PERMISSION_MODES: readonly KissopenAgentPermissionMode[] = [
    "auto",
    "workspace_write",
    "read_only",
    "full_access",
];

export interface AppKissopenAgentSettingsViewProps {
    readonly communityAccount?: import("../auth/communityAccount").CommunityAccount;
    /** The application's own version and update state; native shell only. */
    readonly application?: AppApplicationIdentity;
    /** Restarts into an update already downloaded. */
    readonly onApplicationInstall?: () => void;
    appearance: AppearanceStore;
    /** Managed KISSOPEN Agent controls, present only in the native desktop shell. */
    daemon?: AppKissopenAgentDaemonStore;
    /**
     * Whether this window offers the features that are not finished yet. Absent
     * in a host that remembers no such choice, which withholds them.
     */
    experiments?: ExperimentsStore;
    /** Every KISSOPEN Agent in this window, including the one whose catalog is read. */
    debug?: AppKissopenAgentDebugStore;
    profiler?: AppKissopenAgentProfilerStore;
    kissopenAgents: AppKissopenAgentDirectoryStore;
    onClose(): void;
    onCategorySelect(id: string): void;
    platform?: "desktop" | "web";
    section: string;
    settings: KissopenAgentSettingsStore;
    /** Window-local preference for animated activity titles. */
    titleShimmer?: TitleShimmerStore;
    windowState?: KissopenAgentWindowStore;
}

/**
 * Local route glue for the settings window. It subscribes once each to the
 * appearance, model-catalog, and preference stores and projects the catalog into
 * the props the shared `kissopen-desktop-ui` settings surfaces take; every layout and
 * visual decision lives there.
 */
export function AppKissopenAgentSettingsView(props: AppKissopenAgentSettingsViewProps) {
    const cloudDestinations = useCloudDestinations();
    const categories = props.communityAccount
        ? KISSOPEN_AGENT_SETTINGS_CATEGORIES.map((category) =>
              category.id === "account" ? { ...category, label: t("Local identity") } : category,
          )
        : KISSOPEN_AGENT_SETTINGS_CATEGORIES;
    // Dev Tools prints every store snapshot verbatim, so the stores an ordinary
    // category would materialize only while it is open are materialized there
    // too. Reading raw state means reading the live thing, not a stale copy.
    const stateOpen = props.section === "debug";
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const experimentsStore = props.experiments ?? experimentsStoreNoop;
    const experiments = useSyncExternalStore(
        experimentsStore.subscribe,
        experimentsStore.get,
        experimentsStore.get,
    );
    const titleShimmerStore = props.titleShimmer ?? titleShimmerStoreNoop;
    const titleShimmer = useSyncExternalStore(
        titleShimmerStore.subscribe,
        titleShimmerStore.get,
        titleShimmerStore.get,
    );
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const host = hostKissopenAgent(directory);
    const hostAvailability = host?.session
        ? kissopenAgentAvailabilityProject(host.session.connection.get(), true, {
              status: host.status,
              ...(host.message === undefined ? {} : { message: host.message }),
          })
        : undefined;
    const unavailable =
        hostAvailability?.online === false
            ? (hostAvailability.refusal ?? hostAvailability.message)
            : host?.session
              ? undefined
              : "The local KissOpen Agent is unavailable.";
    const kissopenAgentOnline = (): boolean => {
        const current = hostKissopenAgent(props.kissopenAgents.get());
        return current?.session
            ? kissopenAgentAvailabilityProject(current.session.connection.get(), true, {
                  status: current.status,
                  ...(current.message === undefined ? {} : { message: current.message }),
              }).online
            : false;
    };
    // The catalog shown is this machine's: providers are configured in the Kissopen Agent
    // the window runs on, and the defaults chosen here are the window's own.
    const modelStore = host?.session?.models;
    const models = useSyncExternalStore(
        modelStore?.subscribe ?? noSubscribe,
        modelStore?.get ?? modelsUnloaded,
        modelStore?.get ?? modelsUnloaded,
    );
    const settings = useSyncExternalStore(
        props.settings.subscribe,
        props.settings.get,
        props.settings.get,
    );
    const profileStore =
        (props.section === "account" || stateOpen ? host?.session?.profile?.() : undefined) ??
        kissopenAgentProfileStoreNoop;
    const profile = useSyncExternalStore(
        profileStore.subscribe,
        profileStore.get,
        profileStore.get,
    );
    // Only the state inspector in Dev Tools still reads this snapshot; the
    // account page no longer shows the connection.
    const cloudStore =
        (stateOpen ? host?.session?.cloud?.() : undefined) ?? kissopenAgentCloudStoreNoop;
    const cloud = useSyncExternalStore(cloudStore.subscribe, cloudStore.get, cloudStore.get);
    const kissopenIntegrationStore =
        (stateOpen ? host?.session?.kissopenIntegration?.() : undefined) ??
        kissopenAgentIntegrationStoreNoop;
    const kissopenIntegration = useSyncExternalStore(
        kissopenIntegrationStore.subscribe,
        kissopenIntegrationStore.get,
        kissopenIntegrationStore.get,
    );
    // Subscribing is what starts the read, so the instructions are asked for
    // only while this window is open, and only once however often it is.
    const instructionsStore = host?.session?.instructions;
    const instructions = useSyncExternalStore(
        instructionsStore?.subscribe ?? noSubscribe,
        instructionsStore?.get ?? instructionsUnavailable,
        instructionsStore?.get ?? instructionsUnavailable,
    );
    const securityPolicyStore = host?.session?.securityPolicy;
    const securityPolicy = useSyncExternalStore(
        securityPolicyStore?.subscribe ?? noSubscribe,
        securityPolicyStore?.get ?? securityPolicyUnavailable,
        securityPolicyStore?.get ?? securityPolicyUnavailable,
    );
    // Secrets are safe metadata only. The store starts its repeating read while
    // this category (or raw Dev Tools state) watches it and stops immediately
    // when the surface leaves.
    const secretsStore =
        (props.section === "secrets" || stateOpen ? host?.session?.secrets?.() : undefined) ??
        kissopenAgentSecretsStoreNoop;
    const secrets = useSyncExternalStore(
        secretsStore.subscribe,
        secretsStore.get,
        secretsStore.get,
    );
    // Usage also watches enablement so disabled accounts disappear without
    // discarding their stored usage. Poll only while either surface is open.
    const providersStore =
        (props.section === "providers" || props.section === "usage" || stateOpen
            ? host?.session?.providers
            : undefined) ?? kissopenAgentProvidersStoreNoop;
    const providers = useSyncExternalStore(
        providersStore.subscribe,
        providersStore.get,
        providersStore.get,
    );
    const usageOpen = props.section === "usage";
    const usageStore =
        (usageOpen || stateOpen ? host?.session?.providerUsage : undefined) ??
        kissopenAgentProviderUsageStoreNoop;
    const usage = useSyncExternalStore(usageStore.subscribe, usageStore.get, usageStore.get);
    const clockStore = usageOpen ? host?.session?.clock : undefined;
    const currentTime = useSyncExternalStore(
        clockStore?.subscribe ?? noSubscribe,
        clockStore?.get ?? clockStopped,
        clockStore?.get ?? clockStopped,
    );
    const windowStateStore = props.windowState ?? kissopenAgentWindowStoreNoop;
    const windowState = useSyncExternalStore(
        windowStateStore.subscribe,
        windowStateStore.get,
        windowStateStore.get,
    );
    const debugStore = (props.section === "debug" ? props.debug : undefined) ?? debugStoreNoop;
    const debug = useSyncExternalStore(debugStore.subscribe, debugStore.get, debugStore.get);
    const debugLogStore = props.section === "debug" ? host?.session?.debugLog : undefined;
    const debugLog = useSyncExternalStore(
        debugLogStore?.subscribe ?? noSubscribe,
        debugLogStore?.get ?? debugLogEmpty,
        debugLogStore?.get ?? debugLogEmpty,
    );
    const profilerStore =
        (props.section === "debug" ? props.profiler : undefined) ?? profilerStoreNoop;
    const profiler = useSyncExternalStore(
        profilerStore.subscribe,
        profilerStore.get,
        profilerStore.get,
    );
    const daemonStore = (props.section === "general" ? props.daemon : undefined) ?? daemonStoreNoop;
    const daemon = useSyncExternalStore(daemonStore.subscribe, daemonStore.get, daemonStore.get);
    const daemonView: AppKissopenAgentDaemonSnapshot = {
        ...daemon,
        ...(host?.version ? { runningVersion: host.version } : {}),
        runtime:
            host?.status === "connected"
                ? "ready"
                : host?.status === "connecting"
                  ? "starting"
                  : "stopped",
    };
    const catalog = models.type === "ready" ? models.catalog : undefined;
    const selection = defaultSelection(catalog, settings);
    const model = catalog?.providers
        .flatMap((provider) => provider.models.map((entry) => ({ provider, model: entry })))
        .find(
            (entry) =>
                entry.provider.id === selection.providerId && entry.model.id === selection.modelId,
        );
    const effort =
        model?.model && !model.model.thinkingLevels.includes(settings.defaultEffort)
            ? model.model.defaultThinkingLevel
            : settings.defaultEffort;
    const content = (
        <KissopenAgentSettingsShell
            activeCategoryId={props.section}
            categories={categories}
            description={
                props.communityAccount && props.section === "account"
                    ? t("Local Git author name and email, separate from your signed-in account")
                    : CATEGORY_DESCRIPTIONS[props.section] === undefined
                      ? undefined
                      : t(CATEGORY_DESCRIPTIONS[props.section]!)
            }
            onCategorySelect={props.onCategorySelect}
            onClose={props.onClose}
            title={
                categories.find((category) => category.id === props.section)?.label ?? "Settings"
            }
            windowControls={props.platform === "desktop"}
            windowFullScreen={windowState.fullScreen}
            connectionRail={windowState.connectionRail}
        >
            {props.section === "debug" ? (
                <>
                    <KissopenAgentStateSettings
                        documents={stateDocuments({
                            appearance,
                            cloud,
                            experiments,
                            kissopenIntegration,
                            instructions,
                            models,
                            profile,
                            providers,
                            secrets,
                            securityPolicy,
                            settings,
                            titleShimmer,
                            usage,
                            windowState,
                        })}
                    />
                    <KissopenAgentDebugLogPanel
                        discardedEntries={debugLog.discardedEntries}
                        entries={debugLog.entries}
                    />
                    <KissopenAgentDebugSettings
                        daemon={debug.daemon}
                        daemonConnected={debug.daemonConnected}
                        error={debug.error}
                        loading={debug.loading}
                        main={debug.main}
                        onAllStart={debugStore.debugAllStart}
                        onAllStop={debugStore.debugAllStop}
                        onDaemonStart={debugStore.daemonInspectorStart}
                        onDaemonStop={debugStore.daemonInspectorStop}
                        onMainStart={debugStore.mainInspectorStart}
                        onMainStop={debugStore.mainInspectorStop}
                        onRendererStart={debugStore.rendererInspectorStart}
                        onRendererStop={debugStore.rendererInspectorStop}
                        renderer={debug.renderer}
                        supported={debug.supported}
                    />
                    <KissopenAgentProfilerSettings
                        artifactPath={profiler.artifactPath}
                        capabilities={profiler.capabilities}
                        error={profiler.error}
                        onStart={profilerStore.profilerStart}
                        onStop={profilerStore.profilerStop}
                        partialReason={profiler.partialReason}
                        status={profiler.status}
                        supported={profiler.status !== "unavailable"}
                    />
                </>
            ) : props.section === "account" ? (
                // This daemon-owned identity is not the OAuth account.
                <KissopenAgentProfileSettings
                    dirty={profile.dirty}
                    email={profile.email}
                    loading={profile.loading}
                    name={profile.name}
                    onEmailChange={(value) => profileStore.emailUpdate(value)}
                    onNameChange={(value) => profileStore.displayNameUpdate(value)}
                    onRevert={() => profileStore.profileRevert()}
                    onSave={() => {
                        if (kissopenAgentOnline()) void profileStore.profileSave();
                    }}
                    saving={profile.saving}
                    {...(profile.photo === undefined ? {} : { imageUrl: profile.photo.imageUrl })}
                    {...(profile.error ? { error: profile.error.message } : {})}
                    {...(profile.saveError ? { saveError: profile.saveError } : {})}
                    {...(unavailable === undefined ? {} : { unavailable })}
                />
            ) : props.section === "instructions" ? (
                <KissopenAgentInstructionsSettings
                    documents={[
                        {
                            bytes: instructions.bytes,
                            description: t(
                                "Given to every agent this machine starts, on top of the project's own AGENTS.md.",
                            ),
                            dirty: instructions.dirty,
                            error: documentError(instructionsStore, instructions),
                            id: "agents",
                            label: t("AGENTS.md"),
                            loading: documentLoading(instructionsStore, instructions),
                            maximumBytes: KISSOPEN_AGENT_INSTRUCTIONS_MAX_BYTES,
                            onRevert: () => instructionsStore?.revert(),
                            onSave: () => {
                                if (kissopenAgentOnline()) instructionsStore?.save();
                            },
                            onValueChange: (value) => instructionsStore?.draftUpdate(value),
                            path: INSTRUCTIONS_PATH,
                            placeholder: t("Anything every agent on this machine should know…"),
                            saveError: instructions.saveError?.message,
                            saving: instructions.saving,
                            value: instructions.draft,
                            ...(unavailable === undefined
                                ? {}
                                : {
                                      saveDisabled: true,
                                      saveDisabledReason: unavailable,
                                  }),
                        },
                        {
                            bytes: securityPolicy.bytes,
                            description: t(
                                "Applied when this machine reviews whether an agent action is allowed.",
                            ),
                            dirty: securityPolicy.dirty,
                            error: documentError(securityPolicyStore, securityPolicy),
                            id: "security",
                            label: t("SECURITY.md"),
                            loading: documentLoading(securityPolicyStore, securityPolicy),
                            maximumBytes: KISSOPEN_AGENT_SECURITY_POLICY_MAX_BYTES,
                            onRevert: () => securityPolicyStore?.revert(),
                            onSave: () => {
                                if (kissopenAgentOnline()) securityPolicyStore?.save();
                            },
                            onValueChange: (value) => securityPolicyStore?.draftUpdate(value),
                            path: SECURITY_POLICY_PATH,
                            placeholder: t("Rules for deciding which agent actions are allowed…"),
                            saveError: securityPolicy.saveError?.message,
                            saving: securityPolicy.saving,
                            value: securityPolicy.draft,
                            ...(unavailable === undefined
                                ? {}
                                : {
                                      saveDisabled: true,
                                      saveDisabledReason: unavailable,
                                  }),
                        },
                    ]}
                />
            ) : props.section === "providers" ? (
                <KissopenAgentProviderSettings
                    onCustomRead={(id, signal) => providersStore.customProviderRead(id, signal)}
                    onCustomDiscoverExisting={(id, input, signal) =>
                        providersStore.customProviderDiscoverExisting(
                            id,
                            {
                                baseUrl: input.baseUrl,
                                ...(input.apiKey.trim() ? { apiKey: input.apiKey.trim() } : {}),
                            },
                            signal,
                        )
                    }
                    onCustomUpdate={(id, input) =>
                        providersStore.customProviderUpdate(id, {
                            ...input,
                            apiKey: input.apiKey.trim() || undefined,
                        })
                    }
                    onCustomDelete={(id) => providersStore.customProviderDelete(id)}
                    onCustomDiscover={(input, signal) =>
                        providersStore.customProviderDiscover(input, signal)
                    }
                    onCustomSave={(input) => providersStore.customProviderSave(input)}
                    loading={providers.loading}
                    onModelEnabledChange={(id, enabled) =>
                        kissopenAgentOnline()
                            ? props.settings.modelEnabledUpdate(
                                  id as KissopenAgentModelKey,
                                  enabled,
                              )
                            : undefined
                    }
                    onProviderEnabledChange={(id, enabled) => {
                        if (kissopenAgentOnline())
                            providersStore.providerEnabledUpdate(id, enabled);
                    }}
                    providers={providerRows(providers.providers, settings, selection)}
                    {...(providers.error ? { error: providers.error.message } : {})}
                    {...(providers.saveError ? { saveError: providers.saveError.message } : {})}
                    {...(unavailable === undefined ? {} : { unavailable })}
                />
            ) : props.section === "usage" ? (
                <KissopenAgentUsageSettings
                    loading={usage.loading || providers.loading}
                    providers={usage.providers.flatMap((entry) => {
                        const provider = providers.providers.find(
                            (candidate) => candidate.id === entry.providerId && candidate.enabled,
                        );
                        return provider
                            ? [
                                  {
                                      ...entry,
                                      ...(provider.name === undefined
                                          ? {}
                                          : { name: provider.name }),
                                  },
                              ]
                            : [];
                    })}
                    readingTime={usageReadingTime}
                    {...(clockStore ? { currentTime } : {})}
                    {...(usage.error || providers.error
                        ? { error: usage.error ?? providers.error }
                        : {})}
                />
            ) : props.section === "secrets" ? (
                <KissopenAgentSecretSettings
                    loading={secrets.loading}
                    onSecretCreate={(input) =>
                        kissopenAgentOnline()
                            ? secretsStore.secretCreate(input)
                            : Promise.reject(
                                  new Error(
                                      unavailable ?? t("The local KissOpen Agent is unavailable."),
                                  ),
                              )
                    }
                    secrets={secretRows(secrets.secrets)}
                    {...(secrets.error ? { error: secrets.error.message } : {})}
                    {...(unavailable === undefined ? {} : { unavailable })}
                />
            ) : props.section === "security" && props.communityAccount ? (
                <AppAccountSecuritySettings account={props.communityAccount} />
            ) : props.section === "profile" ? (
                (cloudDestinations.profileSettings ??
                (props.communityAccount ? (
                    <AppCommunityAccountSettings account={props.communityAccount} />
                ) : (
                    (cloudDestinations.profileSettings ?? (
                        <EmptyState
                            description={t("登录KissOpen后，这里会显示你的资料与使用情况。")}
                            icon="users"
                            size="panel"
                            title={t("尚未登录")}
                        />
                    ))
                )))
            ) : (
                <KissopenAgentGeneralSettings
                    {...(props.application
                        ? {
                              application: props.application,
                              ...(props.onApplicationInstall
                                  ? { onApplicationInstall: props.onApplicationInstall }
                                  : {}),
                          }
                        : {})}
                    {...(props.daemon
                        ? {
                              agent: daemonView,
                              onAgentCheck: daemonStore.daemonCheck,
                              onAgentRestart: daemonStore.daemonRestart,
                              onAgentUpgrade: daemonStore.daemonUpgrade,
                              onAgentVersionSelect: daemonStore.daemonVersionSelect,
                          }
                        : {})}
                    appearance={appearance.mode}
                    {...(localePreferenceChangeable()
                        ? { language: localePreference(), onLanguageChange: localePreferenceChange }
                        : {})}
                    defaultModelKey={
                        selection.modelId
                            ? kissopenAgentModelKey(selection.providerId, selection.modelId)
                            : undefined
                    }
                    effort={effort}
                    effortOptions={(model?.model.thinkingLevels ?? []).map((level) => ({
                        label:
                            model?.model.customReasoning === null
                                ? t("Service default")
                                : kissopenAgentThinkingLabel(level),
                        value: level,
                    }))}
                    error={models.type === "error" ? models.error.message : undefined}
                    loading={models.type !== "ready" && models.type !== "error"}
                    modelOptions={modelOptions(catalog, settings)}
                    onAppearanceChange={(mode) => props.appearance.appearanceSelect(mode)}
                    onScrollbarVisibilityChange={(visibility) =>
                        props.appearance.scrollbarVisibilitySelect(visibility)
                    }
                    onTitleShimmerChange={(enabled) =>
                        titleShimmerStore.titleShimmerUpdate(enabled)
                    }
                    onDefaultModelChange={(key) => {
                        const [providerId, ...rest] = key.split(":");
                        const modelId = rest.join(":");
                        const selected = catalog?.providers
                            .find((provider) => provider.id === providerId)
                            ?.models.find((candidate) => candidate.id === modelId);
                        if (!providerId || !selected) return;
                        if (!kissopenAgentOnline()) return;
                        props.settings.defaultModelUpdate(providerId, modelId);
                        props.settings.defaultEffortUpdate(selected.defaultThinkingLevel);
                    }}
                    onEffortChange={(effort) => {
                        if (kissopenAgentOnline())
                            props.settings.defaultEffortUpdate(
                                effort as KissopenAgentThinkingLevel,
                            );
                    }}
                    onPermissionModeChange={(mode) => {
                        if (kissopenAgentOnline())
                            props.settings.defaultPermissionModeUpdate(
                                mode as KissopenAgentPermissionMode,
                            );
                    }}
                    permissionMode={settings.defaultPermissionMode}
                    permissionModeOptions={PERMISSION_MODES.map((mode) => ({
                        label: kissopenAgentPermissionLabel(mode),
                        value: mode,
                    }))}
                    scrollbarVisibility={appearance.scrollbarVisibility}
                    titleShimmerEnabled={titleShimmer.titleShimmerEnabled}
                    {...(unavailable === undefined ? {} : { unavailable })}
                />
            )}
        </KissopenAgentSettingsShell>
    );
    return (
        <KissopenAgentVersionProvider lastKnownVersion={host?.version}>
            {content}
        </KissopenAgentVersionProvider>
    );
}

/** Every store snapshot Dev Tools prints, in the order the window reads them. */
function stateDocuments(snapshots: {
    readonly appearance: unknown;
    readonly cloud: unknown;
    readonly experiments: unknown;
    readonly kissopenIntegration: unknown;
    readonly instructions: unknown;
    readonly models: unknown;
    readonly profile: unknown;
    readonly providers: unknown;
    readonly secrets: unknown;
    readonly securityPolicy: unknown;
    readonly settings: unknown;
    readonly titleShimmer: unknown;
    readonly usage: unknown;
    readonly windowState: unknown;
}): readonly KissopenAgentStateDocument[] {
    return [
        {
            description: t("WorkOS account authentication"),
            id: "cloud",
            label: t("Cloud"),
            value: stateText(snapshots.cloud),
        },
        {
            description: t("The identity this machine authors work as"),
            id: "profile",
            label: t("Profile"),
            value: stateText(snapshots.profile),
        },
        {
            description: t("This KissOpen Agent's connection to KissOpen Mobile"),
            id: "kissopen-integration",
            label: t("Mobile integration"),
            value: stateText(snapshots.kissopenIntegration),
        },
        {
            description: t("Model providers and their saved configuration"),
            id: "providers",
            label: t("Providers"),
            value: stateText(snapshots.providers),
        },
        {
            description: t("Safe secret metadata; stored values never enter this snapshot"),
            id: "secrets",
            label: t("Secrets"),
            value: stateText(snapshots.secrets),
        },
        {
            description: t("The model catalog and last-used selection"),
            id: "models",
            label: t("Models"),
            value: stateText(snapshots.models),
        },
        {
            description: t("What each provider account's plan has spent"),
            id: "usage",
            label: t("Provider usage"),
            value: stateText(snapshots.usage),
        },
        {
            description: t("Defaults a new session starts with"),
            id: "settings",
            label: t("Settings"),
            value: stateText(snapshots.settings),
        },
        {
            description: t("Machine-wide AGENTS.md, as stored and as drafted"),
            id: "instructions",
            label: t("Instructions"),
            value: stateText(snapshots.instructions),
        },
        {
            description: t("Machine-wide SECURITY.md, as stored and as drafted"),
            id: "security-policy",
            label: t("Security policy"),
            value: stateText(snapshots.securityPolicy),
        },
        {
            description: t("Theme and scrollbar preferences for this window"),
            id: "appearance",
            label: t("Appearance"),
            value: stateText(snapshots.appearance),
        },
        {
            description: t("Whether unfinished features are offered"),
            id: "experiments",
            label: t("Experiments"),
            value: stateText(snapshots.experiments),
        },
        {
            description: t("Whether activity titles animate"),
            id: "title-shimmer",
            label: t("Title shimmer"),
            value: stateText(snapshots.titleShimmer),
        },
        {
            description: t("Full-screen and window chrome state"),
            id: "window",
            label: t("Window"),
            value: stateText(snapshots.windowState),
        },
    ];
}

/**
 * One snapshot as text. A snapshot is an ordinary immutable value, but it may
 * carry the two shapes JSON has no notation for — a `Set`, a `Map` — and a
 * `UserError`, whose message is the whole point of it and which serializes to
 * `{}` untouched. Each is written out as itself so the printed value says what
 * the store actually holds.
 */
function stateText(snapshot: unknown): string {
    return JSON.stringify(snapshot, stateReplacer, 2) ?? String(snapshot);
}

function stateReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Set) return [...value];
    if (value instanceof Map) return Object.fromEntries(value);
    if (value instanceof Error) return { message: value.message, name: value.name };
    return value;
}

/**
 * Where the daemon keeps its global instructions. The path is fixed by Kissopen Agent
 * itself and is shown rather than asked for, so it is plain what a save changes.
 */
const INSTRUCTIONS_PATH = "~/KISSOPEN/Config/AGENTS.md";
const SECURITY_POLICY_PATH = "~/KISSOPEN/Config/SECURITY.md";

const noSubscribe = () => () => undefined;
const UNLOADED = { type: "loading" } as const;
const modelsUnloaded = () => UNLOADED;
/** Stands in while no Kissopen Agent on this machine is connected to read the time from. */
const clockStopped = () => 0;

function usageReadingTime(capturedAt: number): string {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(capturedAt));
}

const EMPTY_DEBUG_LOG: KissopenAgentDebugLogSnapshot = { discardedEntries: 0, entries: [] };
const debugLogEmpty = () => EMPTY_DEBUG_LOG;
const debugStopped: AppKissopenAgentDebugTargetSnapshot = { status: "stopped" };
const debugUnavailable: AppKissopenAgentDebugSnapshot = {
    daemon: debugStopped,
    daemonConnected: false,
    loading: false,
    main: debugStopped,
    renderer: debugStopped,
    supported: false,
};
const debugStoreNoop: AppKissopenAgentDebugStore = {
    get: () => debugUnavailable,
    subscribe: noSubscribe,
    debugAllStart: () => undefined,
    debugAllStop: () => undefined,
    daemonInspectorStart: () => undefined,
    daemonInspectorStop: () => undefined,
    mainInspectorStart: () => undefined,
    mainInspectorStop: () => undefined,
    rendererInspectorStart: () => undefined,
    rendererInspectorStop: () => undefined,
};
const profilerUnavailable: AppKissopenAgentProfilerSnapshot = {
    capabilities: {
        liveDebuggerAttach: false,
        nativeTrace: false,
        processMetrics: false,
        reactAttribution: false,
        reactDevtoolsProfiling: false,
        rendererMetrics: false,
    },
    status: "unavailable",
};
const profilerStoreNoop: AppKissopenAgentProfilerStore = {
    get: () => profilerUnavailable,
    profilerStart: () => undefined,
    profilerStop: () => undefined,
    subscribe: noSubscribe,
};
const daemonUnavailable: AppKissopenAgentDaemonSnapshot = {
    install: { phase: "idle" },
    managed: false,
    operation: "idle",
    runtime: "stopped",
    updateAvailable: false,
    versions: [],
};
const daemonStoreNoop: AppKissopenAgentDaemonStore = {
    daemonCheck: () => undefined,
    daemonInstall: () => undefined,
    daemonInstallDismiss: () => undefined,
    daemonInstallKill: () => undefined,
    daemonRestart: () => undefined,
    daemonUpgrade: () => undefined,
    daemonVersionSelect: () => undefined,
    get: () => daemonUnavailable,
    subscribe: noSubscribe,
};

const INSTRUCTIONS_UNAVAILABLE: KissopenAgentInstructionsSnapshot = {
    stored: { type: "unloaded" },
    draft: "",
    dirty: false,
    bytes: 0,
    saving: false,
};
/** Stands in while no Kissopen Agent on this machine is connected to read them from. */
const instructionsUnavailable = () => INSTRUCTIONS_UNAVAILABLE;
const SECURITY_POLICY_UNAVAILABLE: KissopenAgentSecurityPolicySnapshot = INSTRUCTIONS_UNAVAILABLE;
const securityPolicyUnavailable = () => SECURITY_POLICY_UNAVAILABLE;

function documentError(
    store: { get(): KissopenAgentInstructionsSnapshot } | undefined,
    snapshot: KissopenAgentInstructionsSnapshot,
): string | undefined {
    return store === undefined
        ? "This window is not connected to a KissOpen Agent on this machine."
        : snapshot.stored.type === "error"
          ? snapshot.stored.error.message
          : undefined;
}

function documentLoading(
    store: { get(): KissopenAgentInstructionsSnapshot } | undefined,
    snapshot: KissopenAgentInstructionsSnapshot,
): boolean {
    return (
        store !== undefined && snapshot.stored.type !== "ready" && snapshot.stored.type !== "error"
    );
}

/** The chosen default, falling back to whatever the catalog itself defaults to. */
function defaultSelection(
    catalog: KissopenAgentModelCatalog | undefined,
    settings: KissopenAgentSettingsSnapshot,
): { providerId: string; modelId: string } {
    return {
        modelId: settings.defaultModelId ?? catalog?.defaultModelId ?? "",
        providerId: settings.defaultProviderId ?? catalog?.defaultProviderId ?? "",
    };
}

/** Every model a usable provider offers, labelled "Provider · Model" for one flat picker. */
function modelOptions(
    catalog: KissopenAgentModelCatalog | undefined,
    settings: KissopenAgentSettingsSnapshot,
): readonly SelectOption[] {
    return (catalog?.providers ?? []).flatMap((provider) =>
        provider.models
            .filter(
                (model) =>
                    !settings.disabledModels.has(kissopenAgentModelKey(provider.id, model.id)),
            )
            .map((model) => ({
                disabled: provider.disabledReason !== undefined,
                label: `${provider.name ?? providerAccountName(provider.id)} · ${model.name}`,
                value: kissopenAgentModelKey(provider.id, model.id),
            })),
    );
}

function providerRows(
    providers: readonly KissopenAgentProviderEntry[],
    settings: KissopenAgentSettingsSnapshot,
    selection: { providerId: string; modelId: string },
): readonly KissopenAgentProviderRow[] {
    return providers.map((provider) => ({
        custom: provider.custom,
        enabled: provider.enabled,
        id: provider.id,
        models: provider.models.map((model) => ({
            contextWindow: model.contextWindow,
            customReasoning: model.customReasoning,
            efforts:
                model.customReasoning === null
                    ? [t("Service default")]
                    : model.thinkingLevels.map(kissopenAgentThinkingLabel),
            enabled: !settings.disabledModels.has(kissopenAgentModelKey(provider.id, model.id)),
            id: kissopenAgentModelKey(provider.id, model.id),
            isDefault: provider.id === selection.providerId && model.id === selection.modelId,
            modelId: model.id,
            name: model.name,
        })),
        name: provider.name ?? providerAccountName(provider.id),
        saving: provider.saving,
        serviceTiers: provider.serviceTiers.map((tier) => (tier === "fast" ? t("Fast") : tier)),
        status: provider.disabledReason ?? "ready",
    }));
}

/** Safe secret metadata with its timestamp localized for the settings list. */
function secretRows(secrets: readonly KissopenAgentSecret[]): readonly KissopenAgentSecretRow[] {
    return secrets.map((secret) => ({
        availableToAgents: secret.availableToAgents,
        description: secret.description,
        environmentVariables: secret.environmentVariables,
        id: secret.id,
        managed: secret.managed,
        updatedAt: new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(secret.updatedAt)),
    }));
}
