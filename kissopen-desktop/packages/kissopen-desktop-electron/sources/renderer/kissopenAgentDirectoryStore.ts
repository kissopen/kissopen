import { t } from "kissopen-desktop-state";
import {
    KissopenAgentClient,
    kissopenAgentConnectionsStoreCreate,
    kissopenAgentNodeStoreCreate,
    type KissopenAgentConnectionsStore,
    type KissopenAgentNodeIdentity,
    type KissopenAgentNodeStore,
} from "kissopen-desktop-state";
import type {
    KissopenAgentBot,
    KissopenAgentBotAddSnapshot,
    KissopenAgentConnectionSnapshot,
    KissopenAgentHost,
    KissopenAgentModelPreferencePersistence,
    KissopenAgentCloudHost,
    KissopenAgentProjectAddSnapshot,
    KissopenAgentProjectGroup,
    KissopenAgentSessionLocation,
    TerminalColorScheme,
} from "kissopen-desktop-state";
import { browserOpenOffer } from "./browserOpenRoute";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import {
    kissopenAgentConnectionOpen,
    type KissopenAgentConnectionHandle,
    type KissopenAgentProtocolMismatch,
    type KissopenAgentSession,
} from "./kissopenAgentConnection";
import type { DesktopRuntimeStore } from "./runtimeStore";

export const LOCAL_KISSOPEN_AGENT_ID = "local";
const PROJECT_ADD_IDLE: KissopenAgentProjectAddSnapshot = { pending: false };
const BOT_ADD_IDLE: KissopenAgentBotAddSnapshot = { pending: false };

export interface KissopenAgentDirectoryEntry {
    readonly id: string;
    readonly remoteId?: string;
    readonly label: string;
    /** What this Kissopen Agent's own daemon says it is called and looks like, once known. */
    readonly node?: KissopenAgentNodeIdentity;
    readonly status: "connecting" | "connected" | "disconnected" | "error";
    readonly protocolMismatch?: KissopenAgentProtocolMismatch;
    readonly message?: string;
    readonly version?: string;
    readonly projects: readonly KissopenAgentProjectGroup[];
    /** This KISSOPEN Agent's bots, shown under their own heading above its projects. */
    readonly bots: readonly KissopenAgentBot[];
    readonly projectsStatus: "loading" | "ready" | "error";
    readonly projectAdd: KissopenAgentProjectAddSnapshot;
    readonly botAdd: KissopenAgentBotAddSnapshot;
    readonly session?: KissopenAgentSession;
    readonly setup?: KissopenAgentConnectionHandle["setup"];
}

export interface KissopenAgentDirectorySnapshot {
    readonly activeKissopenAgentId?: string;
    readonly kissopenAgents: readonly KissopenAgentDirectoryEntry[];
    readonly error?: string;
    readonly reordering?: boolean;
    readonly reorderError?: string;
}

export interface KissopenAgentDirectoryStore {
    get(): KissopenAgentDirectorySnapshot;
    subscribe(listener: () => void): () => void;
    kissopenAgentActivate(id: string): void;
    kissopenAgentReorder(id: string, afterId: string | null): void;
}

export interface KissopenAgentDirectoryDeps {
    readonly prepareLegacyCli?: () => Promise<void>;
    readonly connectLegacyCli?: () => Promise<void>;
    readonly cloudHostFor: (id: string) => KissopenAgentCloudHost;
    readonly conversationOpen: (
        kissopenAgentId: string,
        location: KissopenAgentSessionLocation,
    ) => void;
    readonly groupOpen: (kissopenAgentId: string, groupId: string) => void;
    /** Shows one KISSOPEN Agent's Create surface. */
    readonly createOpen?: (kissopenAgentId: string) => void;
    /**
     * Takes a group that stopped existing out of the window's navigation. Both
     * identities travel: the window addresses one KISSOPEN Agent at a time, and a
     * background one reporting a removal must not move the reader.
     */
    readonly groupForget: (kissopenAgentId: string, groupId: string) => void;
    /** Desktop-wide model memory for this window's Kissopen Agent connection. */
    readonly modelPreferencePersistence: (id: string) => KissopenAgentModelPreferencePersistence;
    /**
     * Whether the local daemon is mid-restart. Remote connections are proxied
     * through it, and a restarting daemon comes back reporting an empty
     * connection registry for a beat before it repopulates. That empty read is
     * not a real removal, so while it is true the last-known remotes are kept
     * mounted — they show their own disconnected state — rather than being pruned
     * and taking the connection rail and every remote workspace down with them.
     * Absent on a host with no managed daemon, which never restarts one.
     */
    readonly localRestarting?: () => boolean;
    /**
     * The window's current appearance, read whenever a terminal is opened. A
     * terminal runs in the appearance it was started in for the rest of its life,
     * so this is read once per shell rather than followed.
     */
    readonly terminalColorScheme: () => TerminalColorScheme;
}

interface LocalKissopenAgent {
    connection?: KissopenAgentConnectionHandle;
    connectionUnsubscribe?: () => void;
    workspaceUnsubscribe?: () => void;
    node?: KissopenAgentNodeStore;
    nodeUnsubscribe?: () => void;
    protocolMismatch?: KissopenAgentProtocolMismatch;
    url?: string;
    entry: KissopenAgentDirectoryEntry;
}

function projectsRead(
    session: KissopenAgentSession,
): Pick<
    KissopenAgentDirectoryEntry,
    "bots" | "projects" | "projectsStatus" | "projectAdd" | "botAdd"
> {
    const workspace = session.workspace.get();
    const projects = workspace.list.projects;
    return {
        bots: workspace.list.bots,
        projects: projects.type === "ready" ? projects.value : [],
        projectsStatus:
            projects.type === "ready" ? "ready" : projects.type === "error" ? "error" : "loading",
        projectAdd: workspace.projectAdd,
        botAdd: workspace.botAdd,
    };
}

function projectsMatch(
    entry: KissopenAgentDirectoryEntry,
    next: Pick<
        KissopenAgentDirectoryEntry,
        "bots" | "projects" | "projectsStatus" | "projectAdd" | "botAdd"
    >,
): boolean {
    return (
        entry.bots === next.bots &&
        entry.projects === next.projects &&
        entry.projectsStatus === next.projectsStatus &&
        entry.projectAdd === next.projectAdd &&
        entry.botAdd === next.botAdd
    );
}

function connectionRead(
    kissopenAgent: LocalKissopenAgent,
    connection: KissopenAgentConnectionSnapshot,
): Pick<KissopenAgentDirectoryEntry, "message" | "status" | "version"> {
    if (connection.connection === "connecting")
        return {
            status: "connecting",
            message: t("Connecting to this KissOpen Agent."),
            version: connection.version ?? kissopenAgent.entry.version,
        };
    if (connection.connection === "disconnected")
        return {
            status: "disconnected",
            message: connection.message ?? t("This KissOpen Agent is disconnected."),
            version: connection.version ?? kissopenAgent.entry.version,
        };
    if (connection.daemon === "starting")
        return {
            status: "connecting",
            message: t("This KissOpen Agent is starting."),
            version: connection.version ?? kissopenAgent.entry.version,
        };
    if (connection.daemon === "error")
        return {
            status: "error",
            message: connection.message ?? t("This KissOpen Agent reported an error."),
            version: connection.version ?? kissopenAgent.entry.version,
        };
    return {
        status: connection.daemon === "ready" ? "connected" : "connecting",
        message:
            connection.daemon === "ready"
                ? kissopenAgent.protocolMismatch?.message
                : t("Waiting for this KissOpen Agent to become ready."),
        version: connection.version ?? kissopenAgent.entry.version,
    };
}

/**
 * Composes one ordinary connection per host-published entry. The state package
 * owns membership and selection; this adapter supplies desktop capabilities.
 */
export function kissopenAgentDirectoryStoreCreate(
    bridge: KissopenDesktopBridge,
    runtime: DesktopRuntimeStore,
    deps: KissopenAgentDirectoryDeps,
): KissopenAgentDirectoryStore {
    const listeners = new Set<() => void>();
    const kissopenAgent: LocalKissopenAgent = {
        entry: {
            id: LOCAL_KISSOPEN_AGENT_ID,
            label: t("This Mac"),
            bots: [],
            projects: [],
            projectsStatus: "loading",
            projectAdd: PROJECT_ADD_IDLE,
            botAdd: BOT_ADD_IDLE,
            status: "connecting",
        },
    };
    let snapshot: KissopenAgentDirectorySnapshot = { kissopenAgents: [] };
    let runtimeUnsubscribe: (() => void) | undefined;
    let browserOpenUnsubscribe: (() => void) | undefined;
    const remotes = new Map<string, LocalKissopenAgent>();
    let roster: KissopenAgentConnectionsStore | undefined;
    let rosterUnsubscribe: (() => void) | undefined;

    const host: KissopenAgentHost = {
        applicationMenuOpen: () => void bridge.applicationMenuOpen().catch(() => undefined),
        directoryPick: () => bridge.directoryPick(),
    };

    const publish = (): void => {
        const membership = roster?.get();
        const orderedRemotes =
            membership?.items.flatMap((item) => {
                const remote = remotes.get(item.id);
                return remote ? [remote.entry] : [];
            }) ?? [];
        // Retain remotes held through a local restart, in their last visible order.
        const orderedIds = new Set(orderedRemotes.map((entry) => entry.id));
        for (const entry of snapshot.kissopenAgents) {
            const remote = remotes.get(entry.id);
            if (remote && !orderedIds.has(entry.id)) {
                orderedRemotes.push(remote.entry);
                orderedIds.add(entry.id);
            }
        }
        for (const remote of remotes.values())
            if (!orderedIds.has(remote.entry.id)) orderedRemotes.push(remote.entry);
        snapshot = {
            activeKissopenAgentId: roster?.get().selectedId ?? LOCAL_KISSOPEN_AGENT_ID,
            kissopenAgents: [kissopenAgent.entry, ...orderedRemotes],
            reordering: membership?.reordering,
            reorderError: membership?.reorderError,
            ...(roster?.get().error ? { error: roster.get().error } : {}),
        };
        for (const listener of listeners) listener();
    };

    const connectionClose = (kissopenAgent: LocalKissopenAgent): void => {
        kissopenAgent.connectionUnsubscribe?.();
        kissopenAgent.connectionUnsubscribe = undefined;
        kissopenAgent.workspaceUnsubscribe?.();
        kissopenAgent.workspaceUnsubscribe = undefined;
        kissopenAgent.nodeUnsubscribe?.();
        kissopenAgent.nodeUnsubscribe = undefined;
        kissopenAgent.node?.[Symbol.dispose]();
        kissopenAgent.node = undefined;
        kissopenAgent.connection?.dispose();
        kissopenAgent.connection = undefined;
        kissopenAgent.url = undefined;
        // The last known name and picture stay: a machine that dropped off is
        // still the same machine, and its tile must not go blank.
        kissopenAgent.entry = {
            ...kissopenAgent.entry,
            bots: [],
            projects: [],
            projectsStatus: "loading",
            projectAdd: PROJECT_ADD_IDLE,
            botAdd: BOT_ADD_IDLE,
            session: undefined,
            setup: undefined,
        };
    };

    const connectionOpen = (
        kissopenAgent: LocalKissopenAgent,
        client: KissopenAgentClient,
        hostServicesUrl: string,
    ): void => {
        const kissopenAgentHttpUrl = client.endpoint.replace(/\/$/u, "");
        connectionClose(kissopenAgent);
        kissopenAgent.url = kissopenAgentHttpUrl;
        kissopenAgent.connection = kissopenAgentConnectionOpen({
            cloudHost: deps.cloudHostFor(kissopenAgent.entry.id),
            connectLegacyCli:
                kissopenAgent.entry.id === LOCAL_KISSOPEN_AGENT_ID
                    ? deps.connectLegacyCli
                    : undefined,
            prepareLegacyCli:
                kissopenAgent.entry.id === LOCAL_KISSOPEN_AGENT_ID
                    ? deps.prepareLegacyCli
                    : undefined,
            host: kissopenAgent.entry.remoteId
                ? {
                      projectSource: "repository",
                      applicationMenuOpen: host.applicationMenuOpen,
                      directoryPick: async () => undefined,
                  }
                : host,
            kissopenAgentId: kissopenAgent.entry.id,
            browserConnectionId: kissopenAgent.entry.remoteId ?? null,
            client,
            hostServicesUrl,
            kissopenAgentHttpUrl,
            modelPreferencePersistence: deps.modelPreferencePersistence(kissopenAgent.entry.id),
            terminalColorScheme: deps.terminalColorScheme,
            deps: {
                conversationOpen: (location) =>
                    deps.conversationOpen(kissopenAgent.entry.id, location),
                groupOpen: (groupId) => deps.groupOpen(kissopenAgent.entry.id, groupId),
                createOpen: () => deps.createOpen?.(kissopenAgent.entry.id),
                groupForget: (groupId) => deps.groupForget(kissopenAgent.entry.id, groupId),
                compatibility: (mismatch) => {
                    if (kissopenAgent.protocolMismatch?.message === mismatch?.message) return;
                    kissopenAgent.protocolMismatch = mismatch;
                    const {
                        protocolMismatch: _protocolMismatch,
                        message: _message,
                        ...entry
                    } = kissopenAgent.entry;
                    kissopenAgent.entry = mismatch
                        ? {
                              ...entry,
                              protocolMismatch: mismatch,
                              message: mismatch.message,
                          }
                        : entry;
                    publish();
                },
                unavailable: (error) => {
                    if (kissopenAgent.connection?.get() || kissopenAgent.entry.session) return;
                    const message = error instanceof Error ? error.message : String(error);
                    if (
                        kissopenAgent.entry.status === "error" &&
                        kissopenAgent.entry.message === message
                    )
                        return;
                    kissopenAgent.entry = { ...kissopenAgent.entry, status: "error", message };
                    publish();
                },
                changed: () => {
                    const session = kissopenAgent.connection?.get();
                    kissopenAgent.entry = {
                        ...kissopenAgent.entry,
                        setup: kissopenAgent.connection?.setup,
                    };
                    // A daemon that has not finished starting is a machine on
                    // its way up, so it holds the connecting state it was
                    // already in rather than becoming a failure the window has
                    // to report and the reader has to dismiss.
                    if (kissopenAgent.connection?.starting() === true) {
                        kissopenAgent.entry = {
                            ...kissopenAgent.entry,
                            status: "connecting",
                            message: t("KissOpen Agent is starting."),
                            projectsStatus: "loading",
                        };
                        publish();
                        return;
                    }
                    const failure = kissopenAgent.connection?.failure();
                    if (failure) {
                        kissopenAgent.entry = {
                            ...kissopenAgent.entry,
                            status: "error",
                            message: failure,
                            projectsStatus: "error",
                        };
                        publish();
                        return;
                    }
                    if (!session) {
                        kissopenAgent.entry = {
                            ...kissopenAgent.entry,
                            status: "connecting",
                            message: t("Connecting to this KissOpen Agent."),
                            projectsStatus: "loading",
                        };
                        publish();
                        return;
                    }
                    const sessionChanged = kissopenAgent.entry.session !== session;
                    if (sessionChanged) {
                        kissopenAgent.connectionUnsubscribe?.();
                        kissopenAgent.workspaceUnsubscribe?.();
                        kissopenAgent.workspaceUnsubscribe = session.workspace.subscribe(() => {
                            if (kissopenAgent.entry.session !== session) return;
                            // The workspace also announces every open-transcript
                            // delta. None of that belongs to this directory
                            // projection; republishing it would synchronously
                            // render the entire app shell once per token.
                            const projects = projectsRead(session);
                            if (projectsMatch(kissopenAgent.entry, projects)) return;
                            kissopenAgent.entry = { ...kissopenAgent.entry, ...projects };
                            publish();
                        });
                        kissopenAgent.connectionUnsubscribe = session.connection.subscribe(() => {
                            if (kissopenAgent.entry.session !== session) return;
                            kissopenAgent.entry = {
                                ...kissopenAgent.entry,
                                ...connectionRead(kissopenAgent, session.connection.get()),
                            };
                            publish();
                        });
                    }
                    kissopenAgent.entry = {
                        ...kissopenAgent.entry,
                        ...projectsRead(session),
                        ...connectionRead(kissopenAgent, session.connection.get()),
                        session,
                    };
                    publish();
                },
            },
        });
        // The installation's own name and picture ride the same sync feed as
        // the rest of this connection, so the rail tile follows a rename or a
        // new picture as soon as the daemon announces it.
        const node = kissopenAgentNodeStoreCreate(client, kissopenAgent.connection.sync);
        kissopenAgent.node = node;
        kissopenAgent.nodeUnsubscribe = node.subscribe(() => {
            if (kissopenAgent.node !== node) return;
            const { node: identity } = node.get();
            if (identity === kissopenAgent.entry.node) return;
            const { node: _node, ...entry } = kissopenAgent.entry;
            kissopenAgent.entry = identity === undefined ? entry : { ...entry, node: identity };
            publish();
        });
    };

    const localReconcile = (): void => {
        const value = runtime.get();
        const target =
            value && value.phase === "ready" && value.activeTarget.mode === "local"
                ? value.activeTarget
                : undefined;
        if (!target) {
            const unavailable =
                value?.phase === "starting"
                    ? { status: "connecting" as const, message: value.message }
                    : value?.phase === "error"
                      ? { status: "error" as const, message: value.message }
                      : {
                            status: kissopenAgent.entry.session
                                ? ("disconnected" as const)
                                : ("connecting" as const),
                            message: kissopenAgent.entry.session
                                ? "The local KissOpen Agent is disconnected."
                                : "Connecting to the local KissOpen Agent.",
                        };
            kissopenAgent.entry = { ...kissopenAgent.entry, ...unavailable };
            publish();
            return;
        }
        const starting = kissopenAgent.connection?.starting() === true;
        const failure = starting ? undefined : kissopenAgent.connection?.failure();
        kissopenAgent.entry = {
            ...kissopenAgent.entry,
            ...(failure
                ? { status: "error" as const, message: failure }
                : starting
                  ? { status: "connecting" as const, message: t("KissOpen Agent is starting.") }
                  : kissopenAgent.entry.session
                    ? connectionRead(kissopenAgent, kissopenAgent.entry.session.connection.get())
                    : {
                          status: "connecting" as const,
                          message: t("Connecting to this KissOpen Agent."),
                      }),
            version: target.kissopenAgentVersion,
        };
        const base = target.kissopenAgentHttpUrl.replace(/\/$/u, "");
        if (kissopenAgent.url !== base) {
            rosterUnsubscribe?.();
            roster?.[Symbol.dispose]();
            const client = new KissopenAgentClient({
                endpoint: base,
                token: "kissopen-local-capability",
            });
            connectionOpen(kissopenAgent, client, base);
            roster = kissopenAgentConnectionsStoreCreate(client, kissopenAgent.connection!.sync);
            rosterUnsubscribe = roster.subscribe(() => {
                const membership = roster!.get();
                // A local restart takes the daemon down and brings it back with an
                // empty registry for a beat. Pruning against that would collapse
                // the rail and unmount every remote workspace, so known remotes
                // are held through it and reconciled once the daemon reports its
                // real membership again.
                const localRestarting = deps.localRestarting?.() === true;
                for (const [id, remote] of remotes) {
                    if (membership.items.some((item) => item.id === id)) continue;
                    if (localRestarting) continue;
                    connectionClose(remote);
                    remotes.delete(id);
                }
                for (const item of membership.items) {
                    if (!item.remoteId) continue;
                    let remote = remotes.get(item.id);
                    if (!remote) {
                        remote = {
                            entry: {
                                id: item.id,
                                remoteId: item.remoteId,
                                label: item.name,
                                bots: [],
                                projects: [],
                                projectsStatus: "loading",
                                projectAdd: PROJECT_ADD_IDLE,
                                botAdd: BOT_ADD_IDLE,
                                status: "connecting",
                            },
                        };
                        remotes.set(item.id, remote);
                        connectionOpen(
                            remote,
                            client.connection(item.remoteId),
                            `${base}/connections/${item.remoteId}`,
                        );
                    } else if (remote.entry.label !== item.name)
                        remote.entry = { ...remote.entry, label: item.name };
                }
                publish();
            });
        }
        publish();
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) {
                runtimeUnsubscribe = runtime.subscribe(localReconcile);
                browserOpenUnsubscribe = bridge.browserOpenSubscribe((url) => {
                    /*
                     * Whoever the reader is looking at gets it first.
                     *
                     * A project on another machine has a panel of its own, and
                     * its tabs are that project's: a link followed out of that
                     * conversation belongs beside it, not beside whatever this
                     * machine's workspace happens to be showing behind it.
                     */
                    if (browserOpenOffer(url)) return;
                    /*
                     * Otherwise this machine's own panel, which is the whole
                     * point of having a browser in the window: the page opens
                     * beside the thing that named it.
                     *
                     * Its tabs belong to the open project, though, so there is
                     * not always one to put a tab in — a reader with no
                     * project addressed, or on a computer with no local Agent
                     * at all, which is an ordinary way to use the cloud
                     * assistant. Their own browser is the answer then. Doing
                     * nothing was the answer before, and a link that does
                     * nothing reads as broken.
                     */
                    const placed = snapshot.kissopenAgents
                        .find((entry) => entry.id === snapshot.activeKissopenAgentId)
                        ?.session?.workspace.panel.browserAdd(url);
                    if (placed !== true) void bridge.linkOpen(url);
                });
                localReconcile();
            }
            return () => {
                listeners.delete(listener);
                if (listeners.size > 0) return;
                runtimeUnsubscribe?.();
                runtimeUnsubscribe = undefined;
                browserOpenUnsubscribe?.();
                browserOpenUnsubscribe = undefined;
                rosterUnsubscribe?.();
                rosterUnsubscribe = undefined;
                roster?.[Symbol.dispose]();
                roster = undefined;
                for (const remote of remotes.values()) connectionClose(remote);
                remotes.clear();
                connectionClose(kissopenAgent);
                snapshot = { kissopenAgents: [] };
            };
        },
        kissopenAgentActivate(id) {
            roster?.connectionSelect(id);
        },
        kissopenAgentReorder(id, afterId) {
            roster?.connectionReorder(id, afterId);
        },
    };
}
