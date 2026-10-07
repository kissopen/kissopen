import { t } from "kissopen-desktop-state";
import { terminalDriverCreate, type AppKissopenAgentSetup } from "kissopen-desktop-app";
import {
    connectKissopenAgent,
    describeServerCompatibility,
    KissopenAgentClient,
    kissopenAgentWorkspaceClientCreate,
    kissopenAgentClockStoreCreate,
    kissopenAgentDebugLogStoreCreate,
    kissopenAgentWorkspaceStoreCreate,
    kissopenAgentOnboardingStoreCreate,
    welcomeStoreCreate,
    type WelcomeStore,
    type KissopenAgentOnboardingStore,
    KissopenAgentApiError,
    type MutationRejectedDelta,
    type KissopenAgentWorkspaceClient,
    type KissopenAgentClockStore,
    type KissopenAgentCloudHost,
    type KissopenAgentCloudStore,
    type KissopenAgentTeamsStore,
    type KissopenAgentConnection,
    type KissopenAgentConnectionSnapshot,
    type KissopenAgentConnectionStore,
    type KissopenAgentDebugLogInput,
    type KissopenAgentDebugLogStore,
    type KissopenAgentHost,
    type KissopenAgentIntegrationStore,
    type KissopenAgentInstructionsStore,
    type KissopenAgentModelPreferencePersistence,
    type KissopenAgentModelStore,
    type KissopenAgentProfileStore,
    type KissopenAgentProviderUsageStore,
    type KissopenAgentProvidersStore,
    type KissopenAgentSecurityPolicyStore,
    type KissopenAgentSecretsStore,
    type KissopenAgentBotSettingsStore,
    type KissopenAgentSessionLocation,
    type KissopenAgentWorkspaceMemoryDocument,
    type KissopenAgentWorkspaceMemoryPersistence,
    type KissopenAgentWorkspaceStore,
    type ServerCompatibility,
    type TerminalColorScheme,
} from "kissopen-desktop-state";
import { completionChimePlay } from "./completionChime";
import { desktopBrowserMessagePrepare } from "./desktopBrowserSession";
import { desktopViewPreferencesPersistence } from "./desktopViewPreferences";
import { desktopWelcomePersistence } from "./desktopWelcome";
import { kissopenAgentCatalogSourceCreate } from "./kissopenAgentCatalogSource";
import { kissopenAgentHostServicesCreate } from "./kissopenAgentHostServices";
import { kissopenAgentProfileSourceCreate } from "./kissopenAgentProfileSource";
import { kissopenAgentTranscriptConnectCreate } from "./kissopenAgentTranscriptSource";
import { kissopenAgentUsageSourceCreate } from "./kissopenAgentUsageSource";

export interface KissopenAgentProtocolMismatch {
    readonly message: string;
}

function protocolMismatchOf(
    compatibility: ServerCompatibility,
): KissopenAgentProtocolMismatch | undefined {
    if (compatibility.status === "checking" || compatibility.status === "compatible")
        return undefined;
    return {
        message: describeServerCompatibility(compatibility),
    };
}

const WORKSPACE_MEMORY_PREFIX = "kissopen.kissopen-agent.workspace-memory.v1:";
const RETRY_MS = 1_000;

function workspaceMemoryPersistence(
    kissopenAgentId: string,
): KissopenAgentWorkspaceMemoryPersistence {
    const key = `${WORKSPACE_MEMORY_PREFIX}${kissopenAgentId}`;
    return {
        read() {
            try {
                const value = localStorage.getItem(key);
                return value
                    ? (JSON.parse(value) as KissopenAgentWorkspaceMemoryDocument)
                    : undefined;
            } catch {
                return undefined;
            }
        },
        write(document) {
            try {
                localStorage.setItem(key, JSON.stringify(document));
            } catch {
                // Storage-denied windows retain the in-memory store for this run.
            }
        },
    };
}

export interface KissopenAgentSession {
    readonly welcome: WelcomeStore;
    readonly onboarding: KissopenAgentOnboardingStore;
    readonly connection: KissopenAgentConnectionStore;
    readonly cloud: () => KissopenAgentCloudStore;
    readonly teams: () => KissopenAgentTeamsStore;
    readonly debugLog: KissopenAgentDebugLogStore;
    readonly host: KissopenAgentHost;
    readonly models: KissopenAgentModelStore;
    readonly kissopenIntegration: () => KissopenAgentIntegrationStore;
    readonly profile: () => KissopenAgentProfileStore | undefined;
    readonly providerUsage: KissopenAgentProviderUsageStore | undefined;
    readonly providers: KissopenAgentProvidersStore;
    readonly workspace: KissopenAgentWorkspaceStore;
    readonly instructions: KissopenAgentInstructionsStore;
    readonly securityPolicy: KissopenAgentSecurityPolicyStore;
    readonly secrets: () => KissopenAgentSecretsStore;
    readonly botSettings: () => KissopenAgentBotSettingsStore;
    readonly clock: KissopenAgentClockStore;
}

export interface KissopenAgentSessionDeps {
    readonly conversationOpen: (location: KissopenAgentSessionLocation) => void;
    readonly groupOpen: (groupId: string) => void;
    /** Shows the Create surface, which a project started from a goal is ready in. */
    readonly createOpen?: () => void;
    /**
     * Takes a group gone from the host's catalog out of this window's
     * navigation. Every remembered place inside it goes too, so no Back returns
     * to a row that no longer exists.
     */
    readonly groupForget: (groupId: string) => void;
    /** Announces that this connection's session is ready or has been replaced. */
    readonly changed: () => void;
    readonly unavailable?: (error: unknown) => void;
    readonly compatibility?: (mismatch: KissopenAgentProtocolMismatch | undefined) => void;
}

export interface KissopenAgentConnectionHandle {
    readonly setup: AppKissopenAgentSetup | undefined;
    readonly sync: import("kissopen-desktop-state").KissopenAgentSync;
    get(): KissopenAgentSession | undefined;
    /**
     * Why this connection has nothing to hand over, when that is a failure. A
     * daemon that is merely still starting is not one: see `starting`.
     */
    failure(): string | undefined;
    /** The daemon is up and has said it is not finished starting yet. */
    starting(): boolean;
    dispose(): void;
}

/**
 * Whether the daemon refused because it has not finished starting.
 *
 * KISSOPEN Agent has its own word for this and sends it: `not_initialized` means the
 * daemon is up, listening, and not ready to answer for its contents yet. That is
 * a startup, not a failure, and reading it from the code the daemon sends is the
 * whole of the test — the sentence beside it is for people, and matching on it
 * would make KISSOPEN's boot depend on Kissopen Agent's wording.
 *
 * The chain is walked because the refusal reaches here wrapped: a catalog read
 * fails as a `UserError` carrying whatever actually refused as its cause.
 */
function daemonStarting(error: unknown): boolean {
    for (let current = error; current instanceof Error; current = current.cause) {
        if (current instanceof KissopenAgentApiError && current.code === "not_initialized")
            return true;
    }
    return false;
}

function snapshotsEqual(
    left: KissopenAgentConnectionSnapshot,
    right: KissopenAgentConnectionSnapshot,
): boolean {
    return (
        left.connection === right.connection &&
        left.daemon === right.daemon &&
        left.message === right.message &&
        left.attempt === right.attempt
    );
}

/**
 * Projects the connection's managed update-feed lifecycle into the host
 * availability store. It opens no transport of its own: `/health` remains the
 * one startup gate inside `connectKissopenAgent`, and the shared client owns
 * reconnect state.
 */
function streamConnectionStoreCreate(
    connection: KissopenAgentConnection,
): KissopenAgentConnectionStore {
    const listeners = new Set<() => void>();
    let snapshot: KissopenAgentConnectionSnapshot = {
        attempt: 0,
        connection: "connecting",
        daemon: "unknown",
    };
    let sourceState: ReturnType<
        ReturnType<KissopenAgentConnection["connectGroups"]>["state"]
    >["connection"] = "connecting";
    let disposed = false;

    const publish = (next: KissopenAgentConnectionSnapshot): void => {
        if (snapshotsEqual(snapshot, next)) return;
        snapshot = next;
        for (const listener of listeners) listener();
    };

    const source = connection.connectGroups({
        onChange: (_projects, state) => {
            const previous = sourceState;
            sourceState = state.connection;
            if (state.connection === "live") {
                publish({ attempt: 0, connection: "connected", daemon: "ready" });
                return;
            }
            if (state.connection === "connecting") {
                publish({ attempt: 0, connection: "connecting", daemon: "unknown" });
                return;
            }
            const attempt =
                state.connection === "reconnecting" && previous !== "reconnecting"
                    ? snapshot.attempt + 1
                    : snapshot.attempt;
            publish({
                attempt,
                connection: "disconnected",
                daemon: "unknown",
                // A closed connection is a fact about this Kissopen Agent worth stating.
                // Reconnecting is not: the window's own header says the machine
                // is unreachable, and naming the transport that is retrying
                // tells a reader nothing they can act on.
                ...(state.connection === "closed"
                    ? { message: t("This KissOpen Agent connection is closed.") }
                    : {}),
            });
        },
        onError: (error) => {
            publish({
                attempt: Math.max(1, snapshot.attempt),
                connection: "disconnected",
                daemon: "unknown",
                message: error instanceof Error ? error.message : String(error),
            });
        },
    });

    return {
        get: () => snapshot,
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        retry: () => connection.retry(),
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            source.close();
            listeners.clear();
        },
    };
}

/**
 * Opens the local daemon's Kissopen Agent connection and composes its live product
 * state with the small set of services that remain owned by the desktop host.
 */
export function kissopenAgentConnectionOpen(input: {
    readonly prepareLegacyCli?: () => Promise<void>;
    readonly connectLegacyCli?: () => Promise<void>;
    readonly cloudHost: KissopenAgentCloudHost;
    readonly host: KissopenAgentHost;
    readonly deps: KissopenAgentSessionDeps;
    readonly modelPreferencePersistence: KissopenAgentModelPreferencePersistence;
    readonly kissopenAgentId: string;
    readonly browserConnectionId: string | null;
    /**
     * Where the daemon answers. The proxy forwards the daemon's own `/v0`
     * namespace as it stands, so this one origin serves the protocol client,
     * the catalog, and the desktop-local host routes alike.
     */
    readonly kissopenAgentHttpUrl: string;
    readonly client?: KissopenAgentClient;
    readonly hostServicesUrl?: string;
    /**
     * The window's appearance right now, read again for every terminal this
     * connection opens. A terminal is started in it and keeps it afterwards.
     */
    readonly terminalColorScheme: () => TerminalColorScheme;
}): KissopenAgentConnectionHandle {
    let disposed = false;
    let session: KissopenAgentSession | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let compatibilityFailure: string | undefined;
    let catalogFailure: string | undefined;
    let catalogStarting = false;
    const { store: debugLog, writer: debugLogWriter } = kissopenAgentDebugLogStoreCreate();
    const debugEntry = (entry: KissopenAgentDebugLogInput): void =>
        debugLogWriter.entryAppend(entry);
    debugEntry({
        detail: JSON.stringify({ kissopenAgentHttpUrl: input.kissopenAgentHttpUrl }, null, 2),
        level: "info",
        message: t("Opening local KissOpen Agent connection"),
        source: "connection",
    });
    const directClient =
        input.client ??
        new KissopenAgentClient({
            endpoint: input.kissopenAgentHttpUrl,
            token: "kissopen-local-capability",
        });
    const mutationListeners = new Set<(rejection: MutationRejectedDelta) => void>();
    const agentConnection: KissopenAgentConnection = connectKissopenAgent({
        client: directClient,
        endpoint: input.kissopenAgentHttpUrl,
        token: "kissopen-local-capability",
        onDebugEntry: debugEntry,
        onMutationRejected: (rejection) => {
            for (const listener of mutationListeners) listener(rejection);
        },
        onCompatibilityChange: (compatibility) => {
            if (disposed) return;
            const mismatch = protocolMismatchOf(compatibility);
            compatibilityFailure = mismatch?.message;
            input.deps.compatibility?.(mismatch);
            input.deps.changed();
        },
        onTopLevelSessionFinished: () => completionChimePlay(),
        beforeUserMessageSend: (agentId) =>
            desktopBrowserMessagePrepare({
                kind: "local",
                agentId,
                connectionId: input.browserConnectionId,
            }),
    });
    const profile = kissopenAgentProfileSourceCreate(directClient, agentConnection.sync, () => {
        if (!session) agentConnection.retry();
    });
    const catalogSource = kissopenAgentCatalogSourceCreate(
        agentConnection,
        input.kissopenAgentHttpUrl,
    );
    const hostServices = kissopenAgentHostServicesCreate(
        input.hostServicesUrl ?? input.kissopenAgentHttpUrl,
        input.kissopenAgentHttpUrl,
    );
    const welcome = welcomeStoreCreate(desktopWelcomePersistence(input.kissopenAgentId));
    const onboarding = kissopenAgentOnboardingStoreCreate(directClient, agentConnection.sync, {
        setupActive: input.kissopenAgentId !== "local" && welcome.get().welcomeAcknowledged,
        // A phone signed in to the same KISSOPEN account reaches this computer
        // on its own, so setup never asks to pair one.
        mobileSkipped: true,
        connectLegacyCli: input.connectLegacyCli,
        prepareLegacyCli: input.prepareLegacyCli,
    });
    const client: KissopenAgentWorkspaceClient = kissopenAgentWorkspaceClientCreate({
        client: directClient,
        connectLegacyCli: input.connectLegacyCli,
        prepareLegacyCli: input.prepareLegacyCli,
        cloudHost: input.cloudHost,
        connection: agentConnection,
        hostServices,
        modelPreferencePersistence: input.modelPreferencePersistence,
        workspaceMemoryPersistence: workspaceMemoryPersistence(input.kissopenAgentId),
        catalogSource,
        profileActions: profile.actions,
        profileSource: profile.source,
        providerUsageSource: kissopenAgentUsageSourceCreate(directClient),
        transcriptConnect: kissopenAgentTranscriptConnectCreate(agentConnection),
        connectMutationSubscribe: (listener) => {
            mutationListeners.add(listener);
            return () => mutationListeners.delete(listener);
        },
        terminalDriverCreate,
        terminalColorScheme: input.terminalColorScheme,
    });
    // Keep account authentication subscribed for this connection's lifetime so
    // browser callbacks are handled even when Settings is closed or reloading.
    const cloudStore = client.cloud();
    const profileStore = client.profile();
    const accountKeepWarm: (() => void)[] = [];
    const setup: AppKissopenAgentSetup | undefined = profileStore
        ? { welcome, onboarding, profile: profileStore, retry: () => agentConnection.retry() }
        : undefined;

    let workspace: KissopenAgentWorkspaceStore | undefined;
    let workspaceKeepWarm: (() => void) | undefined;
    let modelsLoading = false;
    const modelsLoad = (): void => {
        retry = undefined;
        const startup = onboarding.get();
        if (
            disposed ||
            session ||
            modelsLoading ||
            !startup.available ||
            !(startup.state?.completed || startup.state?.steps.profile.done) ||
            startup.error
        )
            return;
        // Profile completion is the first authorized opportunity to load the
        // workspace. Warm its empty state and bot catalog alongside models,
        // while onboarding is still on the steps before first-project setup.
        if (!workspace) {
            workspace = kissopenAgentWorkspaceStoreCreate(client, {
                host: input.host,
                viewPreferences: desktopViewPreferencesPersistence(input.kissopenAgentId),
                output: (event) => {
                    switch (event.type) {
                        case "conversationOpenRequested":
                            input.deps.conversationOpen(event.location);
                            return;
                        case "groupOpenRequested":
                            input.deps.groupOpen(event.groupId);
                            return;
                        case "createOpenRequested":
                            input.deps.createOpen?.();
                            return;
                        case "addressedGroupRemoved":
                            input.deps.groupForget(event.groupId);
                            return;
                    }
                },
            });
            workspaceKeepWarm = workspace.subscribe(() => undefined);
        }
        const preparedWorkspace = workspace;
        modelsLoading = true;
        debugEntry({
            level: "info",
            message: t("Loading model catalog"),
            source: "catalog",
        });
        void client.models.load().then(
            (modelSnapshot) => {
                modelsLoading = false;
                if (disposed) return;
                accountKeepWarm.push(cloudStore.subscribe(() => undefined));
                debugEntry({
                    detail: JSON.stringify(
                        {
                            models: modelSnapshot.catalog.providers.reduce(
                                (count, provider) => count + provider.models.length,
                                0,
                            ),
                            providers: modelSnapshot.catalog.providers.length,
                        },
                        null,
                        2,
                    ),
                    level: "info",
                    message: t("Model catalog loaded"),
                    source: "catalog",
                });
                session = {
                    welcome,
                    onboarding,
                    cloud: () => cloudStore,
                    teams: () => client.teams(),
                    connection: streamConnectionStoreCreate(agentConnection),
                    debugLog,
                    host: input.host,
                    kissopenIntegration: () => client.kissopenIntegration(),
                    models: client.models,
                    profile: () => profileStore,
                    providerUsage: client.providerUsage(),
                    providers: client.providers(),
                    workspace: preparedWorkspace,
                    instructions: client.instructions(),
                    securityPolicy: client.securityPolicy(),
                    secrets: () => client.secrets(),
                    botSettings: () => client.botSettings(),
                    clock: kissopenAgentClockStoreCreate(),
                };
                debugEntry({
                    level: "info",
                    message: t("KissOpen Agent product stores materialized"),
                    source: "sync",
                });
                catalogFailure = undefined;
                catalogStarting = false;
                input.deps.changed();
                // The directory now owns the live workspace subscription.
                workspaceKeepWarm?.();
                workspaceKeepWarm = undefined;
            },
            (error: unknown) => {
                modelsLoading = false;
                if (disposed) return;
                // A daemon that is still starting is the ordinary first seconds
                // of a cold machine, not a fault: it is reported as the wait it
                // is, at the level a wait belongs, and the same retry brings the
                // catalog in as soon as the daemon will answer for it.
                const starting = daemonStarting(error);
                debugEntry({
                    detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
                    level: starting ? "info" : "error",
                    message: starting
                        ? `KissOpen Agent is still starting; asking again in ${RETRY_MS} ms`
                        : `Model catalog failed; retrying in ${RETRY_MS} ms`,
                    source: "catalog",
                });
                catalogStarting = starting;
                catalogFailure = starting
                    ? undefined
                    : error instanceof Error && error.message
                      ? error.message
                      : t("KissOpen could not read this KissOpen Agent's model catalog.");
                if (!starting) input.deps.unavailable?.(error);
                input.deps.changed();
                retry = setTimeout(modelsLoad, RETRY_MS);
            },
        );
    };
    accountKeepWarm.push(
        onboarding.subscribe(() => {
            if (!retry) modelsLoad();
            if (!session) input.deps.changed();
        }),
        ...(profileStore ? [profileStore.subscribe(() => undefined)] : []),
    );

    return {
        setup,
        get: () => session,
        sync: agentConnection.sync,
        failure: () =>
            compatibilityFailure ??
            (session ? undefined : (catalogFailure ?? onboarding.get().error)),
        starting: () => !session && catalogStarting,
        dispose() {
            if (disposed) return;
            debugEntry({
                level: "info",
                message: t("Disposing local KissOpen Agent connection"),
                source: "connection",
            });
            disposed = true;
            if (retry) clearTimeout(retry);
            workspaceKeepWarm?.();
            workspace?.[Symbol.dispose]();
            if (session) {
                session.connection[Symbol.dispose]();
                session.clock[Symbol.dispose]();
                session = undefined;
            }
            for (const unsubscribe of accountKeepWarm) unsubscribe();
            onboarding[Symbol.dispose]();
            client[Symbol.dispose]();
            mutationListeners.clear();
            agentConnection.close();
        },
    };
}
