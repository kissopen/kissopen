import { t } from "../i18n/locale.js";
import type {
    TerminalColorScheme,
    TerminalDriverCreate,
} from "../modules/terminal/terminalState.js";
import type { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import { kissopenAgentProjectAddError } from "./kissopenAgentProjectRegistration.js";
import {
    kissopenAgentBotSettingsStoreCreate,
    type KissopenAgentBotSettingsStore,
} from "./kissopenAgentBotSettings.js";
import type { MutationRejectedDelta } from "../kissopenAgentConnection/index.js";
import type { KissopenAgentConnection } from "../kissopenAgentConnection/index.js";
import {
    kissopenAgentTerminalOpen,
    type KissopenAgentTerminalHandle,
} from "./kissopenAgentTerminalStore.js";
import {
    kissopenAgentChatStoreCreate,
    type KissopenAgentChatDeps,
    type KissopenAgentChatOutput,
    type KissopenAgentChatStore,
    type KissopenAgentChatTranscriptConnect,
} from "./kissopenAgentChatStore.js";
import {
    kissopenAgentSessionListStoreCreate,
    type KissopenAgentSessionCatalogSource,
    type KissopenAgentSessionListOutput,
    type KissopenAgentSessionListStore,
} from "./kissopenAgentSessionListStore.js";
import type { KissopenAgentHostServices } from "./kissopenAgentHostServices.js";
import {
    kissopenAgentChangedFileProject,
    kissopenAgentModelCatalogProject,
    kissopenAgentTextDecodeBase64,
    kissopenAgentTextEncodeBase64,
} from "./kissopenAgentProject.js";
import type {
    KissopenAgentChangedFileDocument,
    KissopenAgentFileSearchResult,
    KissopenAgentGitChangedFile,
    KissopenAgentGroupId,
    KissopenAgentOpenInTarget,
    KissopenAgentOpenInTargets,
    KissopenAgentWorkspaceFileBytes,
    KissopenAgentWorkspaceFileDocument,
    KissopenAgentWorkspaceFileTreePage,
    KissopenAgentModelCatalog,
    KissopenAgentProjectId,
    KissopenAgentSessionId,
} from "./kissopenAgentTypes.js";
import {
    kissopenAgentModelStoreCreate,
    type KissopenAgentModelStore,
} from "./kissopenAgentModelStore.js";
import { kissopenAgentModelCatalogFollow } from "./kissopenAgentModelCatalogFollow.js";
import type { KissopenAgentModelPreferencePersistence } from "./kissopenAgentModelStore.js";
import {
    kissopenAgentWorkspaceMemoryStoreCreate,
    type KissopenAgentWorkspaceMemoryPersistence,
    type KissopenAgentWorkspaceMemoryStore,
} from "./kissopenAgentWorkspaceMemory.js";
import {
    kissopenAgentInboxStoreCreate,
    type KissopenAgentInboxSource,
    type KissopenAgentInboxStore,
} from "./kissopenAgentInboxStore.js";
import {
    kissopenAgentInstructionsStoreCreate,
    type KissopenAgentInstructionsStore,
} from "./kissopenAgentInstructionsStore.js";
import {
    kissopenAgentSecurityPolicyStoreCreate,
    type KissopenAgentSecurityPolicyStore,
} from "./kissopenAgentSecurityPolicyStore.js";
import {
    kissopenAgentSecretsStoreCreate,
    type KissopenAgentSecretsStore,
} from "./kissopenAgentSecretsStore.js";
import {
    kissopenAgentProviderUsageStoreCreate,
    type KissopenAgentProviderUsageSource,
    type KissopenAgentProviderUsageStore,
} from "./kissopenAgentProviderUsageStore.js";
import {
    kissopenAgentProfileStoreCreate,
    type KissopenAgentProfileActions,
    type KissopenAgentProfileSource,
    type KissopenAgentProfileStore,
} from "./kissopenAgentProfileStore.js";
import {
    kissopenAgentProvidersStoreCreate,
    type KissopenAgentProvidersStore,
} from "./kissopenAgentProvidersStore.js";
import {
    kissopenAgentIntegrationStoreCreate,
    type KissopenAgentIntegrationStore,
} from "./kissopenAgentIntegrationStore.js";
import {
    kissopenAgentCloudStoreCreate,
    type KissopenAgentCloudHost,
    type KissopenAgentCloudStore,
} from "./kissopenAgentCloudStore.js";
import {
    kissopenAgentTeamsStoreCreate,
    type KissopenAgentTeamsStore,
} from "./kissopenAgentTeamsStore.js";

/** A disposable view lease on one retained session chat store. */
export interface KissopenAgentChatHandle {
    readonly store: KissopenAgentChatStore;
    [Symbol.dispose](): void;
}

/** One daemon hint that says which workspace files must be read again. */
export interface KissopenAgentWorkspaceFilesChanged {
    readonly groupId: KissopenAgentGroupId;
    /** Relative paths, or `null` when every materialized path may have changed. */
    readonly paths: readonly string[] | null;
}

export interface KissopenAgentWorkspaceClient {
    /** One model/capability/default/last-used authority for this daemon connection. */
    readonly models: KissopenAgentModelStore;
    /**
     * What this Kissopen Agent remembers between runs: each group's tabs and which sessions
     * have unseen finished work. Shared by the list and the workspace so both
     * read and write the one document the host persists.
     */
    readonly memory: KissopenAgentWorkspaceMemoryStore;
    /** Loads (once) and returns the model catalog; cached for the client's lifetime. */
    catalogRead(): Promise<KissopenAgentModelCatalog>;
    /** The single session-list store; materialized on first access. */
    sessionList(): KissopenAgentSessionListStore;
    /**
     * The single inbox store for this Kissopen Agent: every question its agents are waiting
     * on. Materialized on first access and shared, because the sidebar's pending
     * count and the open inbox are the same queue seen twice. Unavailable when the
     * host supplied no question feed, so a surface can say so instead of showing
     * an inbox that is empty for the wrong reason.
     */
    inbox(): KissopenAgentInboxStore | undefined;
    /**
     * The single provider-usage store for this KISSOPEN Agent: how much of each account's
     * plan its agents have spent. Materialized on first access and shared, so a
     * second surface reading the same accounts costs no extra daemon reads.
     * Unavailable when the host supplied no usage feed, so a surface can say the
     * machine does not report usage rather than showing an account list that is
     * empty for the wrong reason.
     */
    providerUsage(): KissopenAgentProviderUsageStore | undefined;
    /** The installation-wide Kissopen Mobile connection, materialized on first access. */
    kissopenIntegration(): KissopenAgentIntegrationStore;
    /** The installation-wide WorkOS account, materialized on first access. */
    cloud(): KissopenAgentCloudStore;
    /** WorkOS organizations shown as teams, on agents that support the organization API. */
    teams(): KissopenAgentTeamsStore;
    /** The one host-owned identity work is authored as. */
    profile(): KissopenAgentProfileStore | undefined;
    /**
     * Which model providers this Kissopen Agent will use, as the Providers settings
     * category reads and changes them. Materialized on first access and shared;
     * every configuration the daemon confirms through it also replaces the
     * catalog `models` holds, so a provider switched off stops being offered.
     */
    providers(): KissopenAgentProvidersStore;
    /**
     * This Kissopen Agent's own machine-wide instructions, as one editable document.
     * Materialized on first access and shared, so the settings window and
     * anything else showing them are looking at the same draft.
     */
    instructions(): KissopenAgentInstructionsStore;
    /** This KISSOPEN Agent's machine-wide permission-review policy, as one editable document. */
    securityPolicy(): KissopenAgentSecurityPolicyStore;
    /** The assistant settings dialog: one assistant's identity, person, and core files. */
    botSettings(): KissopenAgentBotSettingsStore;
    /** Global write-only environment bundles, materialized while Settings reads them. */
    secrets(): KissopenAgentSecretsStore;
    /** Reads one bounded page of one checkout directory. */
    workspaceFileTreeRead(
        groupId: KissopenAgentGroupId,
        path: string,
        cursor?: string,
    ): Promise<KissopenAgentWorkspaceFileTreePage>;
    /**
     * Searches one checkout for `@`-mention candidates. A pure query: the result
     * is transient composer typeahead and never enters a durable snapshot.
     */
    filesSearch(
        groupId: KissopenAgentGroupId,
        query: string,
        limit?: number,
    ): Promise<readonly KissopenAgentFileSearchResult[]>;
    /**
     * Reads one existing text file from a project/worktree checkout. A file
     * belongs to the checkout rather than to any conversation open over it, so
     * it is addressed by the group.
     */
    workspaceFileRead(
        groupId: KissopenAgentGroupId,
        path: string,
        signal?: AbortSignal,
    ): Promise<KissopenAgentWorkspaceFileDocument>;
    /**
     * The bytes of one file, base64, as the daemon sent them. For a file that is
     * not text — a picture the agent generated, which lives outside the checkout
     * and is read by its absolute path — where decoding to text would ruin it.
     */
    workspaceFileReadBase64(
        groupId: KissopenAgentGroupId,
        path: string,
        signal?: AbortSignal,
    ): Promise<string>;
    /**
     * This computer, by the id the daemon registered under with KISSOPEN;
     * undefined before it has paired. It is how the account's schedules name
     * this machine.
     */
    machineIdRead(signal?: AbortSignal): Promise<string | undefined>;
    /** Follows file-change hints only while a workspace surface is materialized. */
    workspaceFilesSubscribe(
        listener: (change: KissopenAgentWorkspaceFilesChanged) => void,
    ): () => void;
    /**
     * Reads one workspace file as bytes, for showing it rather than editing it.
     * Makes no claim that the file is text, so an image or a video arrives whole.
     */
    workspaceFileBytesRead(
        groupId: KissopenAgentGroupId,
        path: string,
        signal?: AbortSignal,
    ): Promise<KissopenAgentWorkspaceFileBytes>;
    /**
     * Where one HTML document of a checkout is served as a page, for a viewer
     * that renders the document rather than its source.
     */
    htmlPreviewOpen(groupId: KissopenAgentGroupId, path: string): Promise<string>;
    /** Writes one existing text file back to its checkout. */
    workspaceFileWrite(
        groupId: KissopenAgentGroupId,
        path: string,
        content: string,
        expectedHash: string | null,
    ): Promise<void>;
    /** Where a file the reader chose lives on this machine, when it lives anywhere. */
    attachmentSourcePath(file: File): string | undefined;
    /**
     * Whether an agent working in this group could open that path where it lies,
     * which is true exactly when its work happens on the reader's own machine.
     */
    attachmentSourceReachable(groupId: KissopenAgentGroupId, sourcePath: string): Promise<boolean>;
    /**
     * Copies an attached file into a project or worktree checkout by value,
     * answering with the path it landed on relative to that checkout.
     */
    attachmentWrite(
        groupId: KissopenAgentGroupId,
        name: string,
        content: string,
    ): Promise<{ readonly path: string }>;
    /**
     * Registers one folder on this KISSOPEN Agent's machine as a project and resolves with
     * the identity Kissopen Agent gave it. Nothing is started in it: a project is a folder
     * Kissopen Agent knows about, and a conversation in it is a separate decision.
     *
     * Kissopen Agent is authoritative for what may become a project and answers by
     * canonical path, so registering a folder it already holds returns the
     * project it already has rather than a second copy of it. A refusal arrives
     * as a displayable `UserError`.
     */
    projectAdd(path: string): Promise<KissopenAgentProjectId>;
    projectCreate(name: string): Promise<KissopenAgentProjectId>;
    /** Applications this host can open a project or worktree directory in. */
    openInTargetsRead(): Promise<KissopenAgentOpenInTargets>;
    /**
     * Opens one project or worktree root in one of those applications, and makes
     * it the one this machine opened most recently.
     */
    openIn(groupId: KissopenAgentGroupId, target: KissopenAgentOpenInTarget): Promise<void>;
    /** Opens one document in the application this machine uses for its type. */
    fileOpenDefault(groupId: KissopenAgentGroupId, path: string): Promise<void>;
    /** Reads one changed text file from a project/worktree checkout. */
    changedFileRead(
        groupId: KissopenAgentGroupId,
        path: string,
        change: KissopenAgentGitChangedFile,
        signal?: AbortSignal,
    ): Promise<KissopenAgentChangedFileDocument>;
    /**
     * Acquires a retained chat store for one session. Concurrent and later
     * acquisitions share its messages and model state. Releasing the last lease
     * pauses this store's projection; the KISSOPEN Agent-wide SSE cache continues following
     * the session and catches the store up when it is acquired again. A bounded
     * recent-chat cache disposes released stores when the live-store limit is exceeded.
     */
    chat(sessionId: KissopenAgentSessionId): Promise<KissopenAgentChatHandle>;
    /** Stops background synchronization for an archived chat; its store remains subject to the bounded cache. */
    chatArchive(sessionId: KissopenAgentSessionId): void;
    /** Lets a restored chat resume background synchronization when it is acquired again. */
    chatRestore(sessionId: KissopenAgentSessionId): void;
    /**
     * Opens one interactive terminal in a session's working directory. Unlike a
     * chat store these are not shared or reference-counted: two terminals in the
     * same session are two separate shells, which is the whole point of being able
     * to open more than one. Disposing the handle stops the remote terminal.
     */
    terminalOpen(sessionId: KissopenAgentSessionId): KissopenAgentTerminalHandle;
    [Symbol.dispose](): void;
}

export interface KissopenAgentWorkspaceClientDeps {
    readonly connectLegacyCli?: () => Promise<void>;
    readonly prepareLegacyCli?: () => Promise<void>;
    readonly client: KissopenAgentClient;
    readonly cloudHost: KissopenAgentCloudHost;
    readonly connection: KissopenAgentConnection;
    readonly hostServices: KissopenAgentHostServices;
    /** Stream-owned read authority for the project/workspace/session catalog. */
    readonly catalogSource: KissopenAgentSessionCatalogSource;
    /**
     * Stream-owned feed of the questions this Kissopen Agent's agents are waiting on.
     * Omitted leaves the inbox unavailable rather than empty.
     */
    readonly inboxSource?: KissopenAgentInboxSource;
    /**
     * Repeating read of each provider account's plan usage. Omitted leaves usage
     * unavailable rather than empty.
     */
    readonly providerUsageSource?: KissopenAgentProviderUsageSource;
    /** Host-only profile read and mutation. Omitted on a node connection. */
    readonly profileSource?: KissopenAgentProfileSource;
    readonly profileActions?: KissopenAgentProfileActions;
    /** Opens the core transcript stream for one materialized chat. */
    readonly transcriptConnect: KissopenAgentChatTranscriptConnect;
    /** Maximum number of leased chat stores that may keep a live transcript subscription. */
    readonly maxLiveChatSubscriptions?: number;
    /** Terminal failures emitted by the shared Kissopen Agent mutation authority. */
    readonly connectMutationSubscribe: (
        listener: (rejection: MutationRejectedDelta) => void,
    ) => () => void;
    readonly sessionListOutput?: (event: KissopenAgentSessionListOutput) => void;
    readonly chatOutput?: (
        sessionId: KissopenAgentSessionId,
        event: KissopenAgentChatOutput,
    ) => void;
    readonly modelPreferencePersistence?: KissopenAgentModelPreferencePersistence;
    /** Where this Kissopen Agent's tab and read memory is kept; omitted keeps it in memory. */
    readonly workspaceMemoryPersistence?: KissopenAgentWorkspaceMemoryPersistence;
    /**
     * Builds the driver behind a terminal: the app-layer machinery that owns the
     * terminal protocol client and the VT emulator. Omitting it leaves terminals
     * unavailable — they report that instead of failing silently — which is what an
     * app with no emulator to offer should do.
     */
    readonly terminalDriverCreate?: TerminalDriverCreate;
    /**
     * The appearance a terminal opened right now should run in, read once per
     * terminal. It is a function rather than a value because the window's theme
     * changes over the life of this client, and each terminal keeps whichever
     * appearance was current when it started.
     */
    readonly terminalColorScheme: () => TerminalColorScheme;
}

interface ChatBinding {
    count: number;
    readonly storePromise: Promise<KissopenAgentChatStore>;
    store?: KissopenAgentChatStore;
    activeUnsubscribe?: () => void;
    archived: boolean;
    lastUsedOrder: number;
    /** Ignores the archived snapshot retained until an unarchive is confirmed. */
    restoring: boolean;
}

async function workspaceFileTreeRead(
    client: Pick<KissopenAgentClient, "getFileTree">,
    groupId: KissopenAgentGroupId,
    path: string,
    cursor?: string,
): Promise<KissopenAgentWorkspaceFileTreePage> {
    const page = await client.getFileTree(groupId, {
        ...(path === "" ? {} : { path }),
        ...(cursor === undefined ? {} : { cursor }),
        limit: 500,
    });
    const entries = page.entries.flatMap((entry) => {
        // `.git` is never a browsable project entry. Older daemons exposed it
        // and then refused expansion; newer ones omit it at the source.
        if (entry.name === ".git" || entry.type === "other") return [];
        return [
            {
                kind: entry.type === "directory" ? ("directory" as const) : ("file" as const),
                name: entry.name,
                path: entry.path,
                size: entry.size,
                modified: entry.modified,
            },
        ];
    });
    return {
        entries,
        ...(page.nextCursor === null ? {} : { nextCursor: page.nextCursor }),
    };
}

async function changedFileRead(
    client: Pick<KissopenAgentClient, "readFile" | "readFileRevision">,
    groupId: KissopenAgentGroupId,
    path: string,
    change: KissopenAgentGitChangedFile,
    signal?: AbortSignal,
): Promise<KissopenAgentChangedFileDocument> {
    const oldPath = change.previousPath ?? path;
    const oldContent =
        change.status === "added" ||
        change.status === "untracked" ||
        change.baseRevision === undefined
            ? ""
            : kissopenAgentTextDecodeBase64(
                  (
                      await client.readFileRevision(
                          groupId,
                          { path: oldPath, revision: change.baseRevision },
                          { signal },
                      )
                  ).content,
              );
    const current =
        change.status === "deleted" ? undefined : await client.readFile(groupId, path, { signal });
    return kissopenAgentChangedFileProject({
        path,
        ...(oldPath === path ? {} : { oldPath }),
        oldContent,
        newContent: current === undefined ? "" : kissopenAgentTextDecodeBase64(current.content),
        ...(current === undefined ? {} : { hash: current.hash }),
    });
}

/**
 * Composition root for a direct Kissopen Agent client: it owns the stateless `/v0`
 * client, the live connection, model store, session list, and retained chats.
 * Chat projections run only while leased; their state remains in memory, while
 * the one connection-wide SSE cache follows materialized sessions between views.
 */
export function kissopenAgentWorkspaceClientCreate(
    deps: KissopenAgentWorkspaceClientDeps,
): KissopenAgentWorkspaceClient {
    const configuredMaxLiveChatSubscriptions = deps.maxLiveChatSubscriptions;
    const maxLiveChatSubscriptions =
        configuredMaxLiveChatSubscriptions === undefined ||
        !Number.isFinite(configuredMaxLiveChatSubscriptions)
            ? 8
            : Math.max(1, Math.floor(configuredMaxLiveChatSubscriptions));
    const models = kissopenAgentModelStoreCreate({
        catalogRead: async () =>
            kissopenAgentModelCatalogProject((await deps.client.getConfig()).config),
        ...(deps.modelPreferencePersistence
            ? { preferencePersistence: deps.modelPreferencePersistence }
            : {}),
    });
    const modelCatalogStop = kissopenAgentModelCatalogFollow(
        deps.client,
        deps.connection.sync,
        models,
    );
    const memory = kissopenAgentWorkspaceMemoryStoreCreate(deps.workspaceMemoryPersistence);
    let sessionListStore: KissopenAgentSessionListStore | undefined;
    let inboxStore: KissopenAgentInboxStore | undefined;
    let providerUsageStore: KissopenAgentProviderUsageStore | undefined;
    let kissopenIntegrationStore: KissopenAgentIntegrationStore | undefined;
    let cloudStore: KissopenAgentCloudStore | undefined;
    let teamsStore: KissopenAgentTeamsStore | undefined;
    let profileStore: KissopenAgentProfileStore | undefined;
    let providersStore: KissopenAgentProvidersStore | undefined;
    let instructionsStore: KissopenAgentInstructionsStore | undefined;
    let securityPolicyStore: KissopenAgentSecurityPolicyStore | undefined;
    let botSettings: KissopenAgentBotSettingsStore | undefined;
    let secretsStore: KissopenAgentSecretsStore | undefined;
    const chats = new Map<KissopenAgentSessionId, ChatBinding>();
    let disposed = false;
    let chatUseOrder = 0;

    /**
     * A released chat has no transcript listener, but its ChatStore used to
     * remain in this map forever (including its mutation listener and projected
     * entries). Keep a small recent set and dispose the oldest released stores;
     * the connection-wide session cache remains responsible for complete
     * inactive messages.
     */
    const evictReleasedChats = (protectedSessionId?: KissopenAgentSessionId): void => {
        while (chats.size > maxLiveChatSubscriptions) {
            const candidate = [...chats.entries()]
                .filter(
                    ([sessionId, binding]) =>
                        sessionId !== protectedSessionId &&
                        binding.count === 0 &&
                        binding.store !== undefined &&
                        !binding.store.hasPendingMutations(),
                )
                .sort((left, right) => left[1].lastUsedOrder - right[1].lastUsedOrder)[0];
            if (candidate === undefined) return;
            const [sessionId, binding] = candidate;
            binding.activeUnsubscribe?.();
            binding.activeUnsubscribe = undefined;
            binding.store?.[Symbol.dispose]();
            chats.delete(sessionId);
        }
    };

    const admitChat = (sessionId: KissopenAgentSessionId): void => {
        evictReleasedChats(sessionId);
        const binding = chats.get(sessionId);
        if (binding !== undefined && binding.count > 0) return;
        const live = [...chats.values()].filter((candidate) => candidate.count > 0).length;
        if (live >= maxLiveChatSubscriptions) {
            throw new Error(
                t("The maximum of {value} live chat subscriptions is already in use.", {
                    value: String(maxLiveChatSubscriptions),
                }),
            );
        }
    };

    const chatDeactivate = (binding: ChatBinding): void => {
        binding.activeUnsubscribe?.();
        binding.activeUnsubscribe = undefined;
    };

    const chatActivate = (binding: ChatBinding): void => {
        const store = binding.store;
        if (
            store === undefined ||
            binding.archived ||
            binding.count === 0 ||
            binding.activeUnsubscribe !== undefined
        ) {
            return;
        }
        const archivedRead = (): void => {
            const archived = store.get().archived;
            // Restoring starts against the last archived snapshot. Keep this
            // watcher alive until the connection publishes the host's false;
            // only a later true is another archive.
            if (binding.restoring) {
                if (archived) return;
                binding.restoring = false;
            }
            binding.archived = archived;
            if (archived) chatDeactivate(binding);
        };
        const unsubscribe = store.subscribe(archivedRead);
        binding.activeUnsubscribe = unsubscribe;
        archivedRead();
    };

    return {
        models,
        memory,
        catalogRead: () => models.load().then((snapshot) => snapshot.catalog),
        changedFileRead: (groupId, path, change, signal) =>
            changedFileRead(deps.client, groupId, path, change, signal),
        workspaceFileTreeRead: (groupId, path, cursor) =>
            workspaceFileTreeRead(deps.client, groupId, path, cursor),
        filesSearch: async (groupId, query, limit) =>
            (
                await deps.client.searchFiles(groupId, {
                    query,
                    ...(limit === undefined ? {} : { limit }),
                })
            ).files.map((file) => ({ fileName: file.fileName, path: file.path })),
        workspaceFileRead: async (groupId, path, signal) => {
            const file = await deps.client.readFile(groupId, path, { signal });
            return { path, content: kissopenAgentTextDecodeBase64(file.content), hash: file.hash };
        },
        machineIdRead: async (signal) =>
            (await deps.client.getKissopenIntegration({ signal })).integration?.machineId ??
            undefined,
        workspaceFileReadBase64: async (groupId, path, signal) =>
            (await deps.client.readFile(groupId, path, { signal })).content,
        workspaceFilesSubscribe(listener) {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            const connection = deps.connection.connectGroups({
                onChange: () => undefined,
                onDelta: (delta) => {
                    if (delta.type !== "files_changed") return;
                    listener({
                        groupId: delta.workspaceId as KissopenAgentGroupId,
                        paths: delta.paths,
                    });
                },
            });
            return () => connection.close();
        },
        workspaceFileBytesRead: (groupId, path, signal) =>
            deps.hostServices.workspaceFileBytesRead(groupId, path, signal),
        htmlPreviewOpen: (groupId, path) => deps.hostServices.htmlPreviewOpen(groupId, path),
        workspaceFileWrite: async (groupId, path, content, expectedHash) => {
            await deps.client.writeFile(groupId, {
                path,
                content: kissopenAgentTextEncodeBase64(content),
                expectedHash,
            });
        },
        attachmentSourcePath: (file) => deps.hostServices.attachmentSourcePath(file),
        attachmentSourceReachable: (groupId, sourcePath) =>
            deps.hostServices.attachmentSourceReachable(groupId, sourcePath),
        attachmentWrite: (groupId, name, content) =>
            deps.hostServices.attachmentWrite(groupId, name, content),
        async projectCreate(name) {
            try {
                const project = await deps.connection.projects.create(name);
                return project.id as KissopenAgentProjectId;
            } catch (error) {
                throw kissopenAgentProjectAddError(error, name);
            }
        },
        async projectAdd(path) {
            // Registration is the daemon's own decision, so it goes directly
            // through the connection actions: the daemon validates the folder,
            // names the project, and is idempotent by canonical path. A
            // connection without project actions cannot ask, and says so rather
            // than pretending the folder was added.
            try {
                const project = await deps.connection.projects.add(path);
                return project.id as KissopenAgentProjectId;
            } catch (error) {
                throw kissopenAgentProjectAddError(error, path);
            }
        },
        openInTargetsRead: () => deps.hostServices.openInTargetsRead(),
        openIn: (groupId, target) => deps.hostServices.openIn(groupId, target),
        fileOpenDefault: (groupId, path) => deps.hostServices.fileOpenDefault(groupId, path),
        sessionList() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            if (!sessionListStore) {
                sessionListStore = kissopenAgentSessionListStoreCreate({
                    client: deps.client,
                    catalogSource: deps.catalogSource,
                    connectActions: deps.connection,
                    connectMutationSubscribe: deps.connectMutationSubscribe,
                    output: deps.sessionListOutput,
                });
            }
            return sessionListStore;
        },
        inbox() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            const source = deps.inboxSource;
            if (!source) return undefined;
            inboxStore ??= kissopenAgentInboxStoreCreate({
                source,
                output: (event) => {
                    const store = inboxStore;
                    if (!store) return;
                    deps.connection.answerUserInput(event.sessionId, event.requestId, {
                        answers: event.answers,
                    });
                    store.inboxInput({ type: "itemAnswerSucceeded", itemId: event.itemId });
                },
            });
            return inboxStore;
        },
        providerUsage() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            const source = deps.providerUsageSource;
            if (!source) return undefined;
            providerUsageStore ??= kissopenAgentProviderUsageStoreCreate({ source });
            return providerUsageStore;
        },
        kissopenIntegration() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            kissopenIntegrationStore ??= kissopenAgentIntegrationStoreCreate({
                client: deps.client,
                sync: deps.connection.sync,
                connectLegacyCli: deps.connectLegacyCli,
                prepareLegacyCli: deps.prepareLegacyCli,
            });
            return kissopenIntegrationStore;
        },
        cloud() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            cloudStore ??= kissopenAgentCloudStoreCreate({
                client: deps.client,
                sync: deps.connection.sync,
                host: deps.cloudHost,
            });
            return cloudStore;
        },
        teams() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            teamsStore ??= kissopenAgentTeamsStoreCreate({ client: deps.client });
            return teamsStore;
        },
        profile() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            if (!deps.profileSource || !deps.profileActions) return undefined;
            profileStore ??= kissopenAgentProfileStoreCreate({
                source: deps.profileSource,
                actions: deps.profileActions,
            });
            return profileStore;
        },
        providers() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            providersStore ??= kissopenAgentProvidersStoreCreate({
                client: deps.client,
                catalogChanged: (catalog) => models.catalogChanged(catalog),
            });
            return providersStore;
        },
        instructions() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            instructionsStore ??= kissopenAgentInstructionsStoreCreate({ client: deps.client });
            return instructionsStore;
        },
        botSettings() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            botSettings ??= kissopenAgentBotSettingsStoreCreate({
                client: deps.client,
                catalogRead: () => models.load().then((snapshot) => snapshot.catalog),
            });
            return botSettings;
        },
        securityPolicy() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            securityPolicyStore ??= kissopenAgentSecurityPolicyStoreCreate({ client: deps.client });
            return securityPolicyStore;
        },
        secrets() {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            secretsStore ??= kissopenAgentSecretsStoreCreate({ client: deps.client });
            return secretsStore;
        },
        async chat(sessionId) {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            let binding = chats.get(sessionId);
            admitChat(sessionId);
            if (!binding) {
                const storePromise = models.load().then(({ catalog }) => {
                    const chatDeps: KissopenAgentChatDeps = {
                        catalog,
                        catalogSubscribe: (listener) =>
                            models.subscribe(() => {
                                const snapshot = models.get();
                                if (snapshot.type === "ready") listener(snapshot.catalog);
                            }),
                        transcriptConnect: deps.transcriptConnect,
                        connectActions: deps.connection,
                        connectMutationSubscribe: deps.connectMutationSubscribe,
                        selectionUsed: (selection) => models.selectionUsed(selection),
                        modelSelect: (current, input) => models.modelSelect(current, input),
                        output: deps.chatOutput
                            ? (event) => deps.chatOutput?.(sessionId, event)
                            : undefined,
                    };
                    const store = kissopenAgentChatStoreCreate(sessionId, chatDeps);
                    const current = chats.get(sessionId);
                    if (current) {
                        current.store = store;
                        chatActivate(current);
                    }
                    return store;
                });
                binding = {
                    count: 0,
                    storePromise,
                    archived: false,
                    lastUsedOrder: 0,
                    restoring: false,
                };
                chats.set(sessionId, binding);
            }
            binding.count += 1;
            binding.lastUsedOrder = ++chatUseOrder;
            chatActivate(binding);
            let store: KissopenAgentChatStore;
            try {
                store = await binding.storePromise;
            } catch (error) {
                const current = chats.get(sessionId);
                if (current === binding) chats.delete(sessionId);
                throw error;
            }
            evictReleasedChats(sessionId);
            let released = false;
            return {
                store,
                [Symbol.dispose]() {
                    if (released) return;
                    released = true;
                    const current = chats.get(sessionId);
                    if (!current) return;
                    current.count -= 1;
                    if (current.count <= 0) {
                        current.count = 0;
                        chatDeactivate(current);
                        evictReleasedChats(sessionId);
                    }
                },
            };
        },
        chatArchive(sessionId) {
            const binding = chats.get(sessionId);
            if (!binding) return;
            binding.archived = true;
            binding.restoring = false;
            chatDeactivate(binding);
        },
        chatRestore(sessionId) {
            const binding = chats.get(sessionId);
            if (!binding) return;
            binding.archived = false;
            binding.restoring = true;
            chatActivate(binding);
        },
        terminalOpen(sessionId) {
            if (disposed) throw new Error("The KissOpen Agent client is disposed.");
            return kissopenAgentTerminalOpen(
                {
                    client: deps.client,
                    hostServices: deps.hostServices,
                    colorScheme: deps.terminalColorScheme(),
                    ...(deps.terminalDriverCreate
                        ? { driverCreate: deps.terminalDriverCreate }
                        : {}),
                },
                sessionId,
            );
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            modelCatalogStop();
            models[Symbol.dispose]();
            sessionListStore?.[Symbol.dispose]();
            sessionListStore = undefined;
            inboxStore?.[Symbol.dispose]();
            inboxStore = undefined;
            providerUsageStore?.[Symbol.dispose]();
            providerUsageStore = undefined;
            kissopenIntegrationStore?.[Symbol.dispose]();
            cloudStore?.[Symbol.dispose]();
            teamsStore?.[Symbol.dispose]();
            kissopenIntegrationStore = undefined;
            cloudStore = undefined;
            teamsStore = undefined;
            profileStore?.[Symbol.dispose]();
            profileStore = undefined;
            providersStore?.[Symbol.dispose]();
            providersStore = undefined;
            instructionsStore?.[Symbol.dispose]();
            instructionsStore = undefined;
            securityPolicyStore?.[Symbol.dispose]();
            securityPolicyStore = undefined;
            botSettings?.[Symbol.dispose]();
            botSettings = undefined;
            secretsStore?.[Symbol.dispose]();
            secretsStore = undefined;
            deps.catalogSource[Symbol.dispose]();
            for (const binding of chats.values()) {
                chatDeactivate(binding);
                binding.store?.[Symbol.dispose]();
            }
            chats.clear();
        },
    };
}
