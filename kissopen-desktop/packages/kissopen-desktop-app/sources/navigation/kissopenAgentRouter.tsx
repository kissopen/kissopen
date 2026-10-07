import {
    t,
    type DictationStore,
    type KissopenAgentDocumentConversionOpener,
} from "kissopen-desktop-state";
import {
    createRootRouteWithContext,
    createRoute,
    createRouter,
    Outlet,
    redirect,
    useNavigate,
    useParams,
    useRouteContext,
    useRouter,
} from "@tanstack/react-router";
import {
    kissopenAgentHistoryCreate,
    type KissopenAgentRouterHistory,
} from "./kissopenAgentHistory";
import { kissopenAgentRoutePathParse } from "./kissopenAgentRoute";
import { useSyncExternalStore } from "react";
import { KissopenAgentOnboardingBoundary } from "../components/KissopenAgentOnboardingBoundary";
import type {
    AppearanceStore,
    CommandPaletteStore,
    ExperimentsStore,
    KissopenAgentGroupId,
    KissopenAgentFileTabKind,
    KissopenAgentNavigationOrderStore,
    KissopenAgentSidebarCollapseStore,
    KissopenAgentSidebarVisibilityStore,
    KissopenAgentSessionId,
    KissopenAgentSessionLocation,
    KissopenAgentSettingsStore,
    TitleShimmerStore,
    KissopenAgentWindowStore,
    KissopenAgentWorkspaceStore,
} from "kissopen-desktop-state";
import {
    SplashScreen,
    type BrowserContentRenderer,
    type HtmlPreviewRenderer,
    type LivePerformanceStore,
    type MediaWindowOpener,
} from "kissopen-desktop-ui";
import {
    AppKissopenAgentView,
    type AppApplicationIdentity,
    type AppBuildIdentity,
    type AppKissopenAgentDirectoryStore,
    type AppKissopenAgentUpdate,
} from "../AppKissopenAgentView";
import {
    AppKissopenAgentSettingsView,
    KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY,
    kissopenAgentSettingsCategoryExists,
    type AppKissopenAgentDaemonStore,
    type AppKissopenAgentDebugStore,
    type AppKissopenAgentProfilerStore,
} from "../views/AppKissopenAgentSettingsView";

/**
 * Everything the local route tree needs that the URL does not address: the
 * directory of Kissopen Agents this window can work in — each carrying its own connection,
 * workspace, host, clock, and model catalog — the window's own preferences, and
 * the appearance selection. It is the local counterpart of `AppRouterContext`
 * and is supplied to `RouterProvider` once the directory exists, so the router
 * can be constructed before any KISSOPEN Agent connects.
 */
export interface KissopenAgentRouterContext {
    readonly communityAccount?: import("../auth/communityAccount").CommunityAccount;
    /** A remote daemon uses its own setup inside this connection's router. */
    readonly connectionOnboarding?: boolean;
    /** Native Chromium guest renderer, present only in packaged Electron. */
    readonly browserContent?: BrowserContentRenderer;
    readonly browserAutomation?: import("kissopen-desktop-ui").BrowserAutomationRenderer;
    /** Renders one HTML workspace file as a page, in a host that has an engine. */
    readonly htmlPreview?: HtmlPreviewRenderer;
    /**
     * Opens Scheduled tasks with a task an assistant proposed. The account's
     * destinations belong to the host, so the host supplies where it goes.
     */
    readonly onScheduleProposalOpen?: (request: string) => void;
    /** Opens Scheduled tasks at a task the agent created, by its ID. */
    readonly onScheduledTaskOpen?: (scheduleId: string) => void;
    /** Speaking into a composer; the account's transcription, supplied by the host. */
    readonly dictation?: DictationStore;
    /**
     * Shows one workspace picture or recording in a window outside this one.
     * Present only in a shell that has separate windows to open, which is
     * packaged Electron.
     */
    readonly mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    readonly documentConversion?: KissopenAgentDocumentConversionOpener;
    readonly debug?: AppKissopenAgentDebugStore;
    /** Live renderer diagnostics, present only in an explicitly debug-launched desktop window. */
    readonly performance?: LivePerformanceStore;
    readonly daemon?: AppKissopenAgentDaemonStore;
    readonly profiler?: AppKissopenAgentProfilerStore;
    readonly kissopenAgents: AppKissopenAgentDirectoryStore;
    /** This build's development identity; absent in the packaged product. */
    readonly buildIdentity?: AppBuildIdentity;
    /** The application's own version and update state; native shell only. */
    readonly application?: AppApplicationIdentity;
    /** Restarts into an update already downloaded. */
    readonly onApplicationInstall?: () => void;
    readonly appearance: AppearanceStore;
    /** The window's own local preferences: default model, effort, and permissions. */
    readonly settings: KissopenAgentSettingsStore;
    /**
     * Where this window remembers the order the reader arranged the sidebar's
     * pinned rows in. Absent in a host that keeps no such record, which leaves
     * the rows in the order the window offers them.
     */
    readonly navigationOrder?: KissopenAgentNavigationOrderStore;
    /**
     * Where this window remembers which sidebar rows the reader folded shut.
     * Absent in a host that keeps no such record, which leaves every row open.
     */
    readonly sidebarCollapse?: KissopenAgentSidebarCollapseStore;
    /** Whether this window's left side is folded away; shared by every connection. */
    readonly sidebarVisibility?: KissopenAgentSidebarVisibilityStore;
    /**
     * Whether this window offers the features that are not finished yet. Absent
     * in a host that remembers no such choice, which withholds them.
     */
    readonly experiments?: ExperimentsStore;
    /** Window-local preference for animated activity titles. */
    readonly titleShimmer?: TitleShimmerStore;
    /**
     * What the window's command palette is showing and asking. Absent in a host
     * that offers no palette, which leaves Command-K unbound.
     */
    readonly commandPalette?: CommandPaletteStore;
    /**
     * Which shell hosts this router. The Electron window has no native title bar,
     * so the workspace draws the traffic-light inset and drag lanes itself; the
     * browser development mode renders ordinary web chrome.
     */
    readonly platform?: "desktop" | "web";
    /**
     * The window's own chrome state. Full screen takes the native controls away,
     * so the inset the workspace reserves for them has to follow the window
     * rather than the platform.
     */
    readonly windowState?: KissopenAgentWindowStore;
    /** Desktop-shell update state; absent when this route tree runs as plain web UI. */
    readonly update?: AppKissopenAgentUpdate;
    readonly onUpdateApply?: () => void;
}

const rootRoute = createRootRouteWithContext<KissopenAgentRouterContext>()({
    component: KissopenAgentRoot,
});

function KissopenAgentRoot() {
    const context = useRouteContext({ strict: false }) as KissopenAgentRouterContext;
    if (!context.kissopenAgents) return null;
    return <KissopenAgentRootContent context={context} />;
}

function KissopenAgentRootContent({ context }: { readonly context: KissopenAgentRouterContext }) {
    const directory = useSyncExternalStore(
        context.kissopenAgents.subscribe,
        context.kissopenAgents.get,
        context.kissopenAgents.get,
    );
    const entry = directory.kissopenAgents[0];
    // Sessions survive reconnects. Only the first connection gets a splash;
    // an already materialized workspace must keep its mounted UI and drafts.
    const setup = entry?.setup;
    if (!context.connectionOnboarding) return <Outlet />;
    const content = entry?.session ? (
        <Outlet />
    ) : (
        <SplashScreen
            note={
                entry?.message ??
                t("Connecting to {label}…", { label: entry?.label ?? "KissOpen Agent" })
            }
        />
    );
    if (!setup) return content;
    return (
        <KissopenAgentOnboardingBoundary
            store={setup.onboarding}
            welcome={setup.welcome}
            appearance={context.appearance}
            profile={setup.profile}
            online={entry?.status === "connected"}
            onRetry={setup.retry}
        >
            {content}
        </KissopenAgentOnboardingBoundary>
    );
}

/**
 * The Kissopen Agent a bare address lands on: the first one in the window, which is the
 * machine this window runs on. The default is read rather than written down so
 * this file never names one Kissopen Agent as special.
 */
function kissopenAgentDefaultId(context: KissopenAgentRouterContext | undefined): string {
    return context?.kissopenAgents?.get().kissopenAgents[0]?.id ?? "local";
}

/**
 * Redirects to one machine's list. The router helper's generic path type does not
 * retain this locally assembled tree, so `kissopenAgentRouterCreate` checks the path here.
 */
function kissopenAgentListRedirect(kissopenAgentId: string): never {
    throw redirect({ params: { kissopenAgentId }, replace: true, to: "/chats/$kissopenAgentId" });
}

/** The addressed Kissopen Agent's workspace store, absent while that KISSOPEN Agent is not connected. */
function kissopenAgentWorkspace(
    context: KissopenAgentRouterContext,
    kissopenAgentId: string,
): KissopenAgentWorkspaceStore | undefined {
    // A window that has not been given a directory yet has no agent to activate.
    // The callers already treat an absent workspace as "not listed" and say so;
    // reading through the missing store instead turns that into a crash dialog.
    if (!context.kissopenAgents) return undefined;
    context.kissopenAgents.kissopenAgentActivate(kissopenAgentId);
    return context.kissopenAgents
        .get()
        .kissopenAgents.find((kissopenAgent) => kissopenAgent.id === kissopenAgentId)?.session
        ?.workspace;
}

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: ({ context }) => kissopenAgentListRedirect(kissopenAgentDefaultId(context)),
});

const chatsRootRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/chats",
    beforeLoad: ({ context }) => kissopenAgentListRedirect(kissopenAgentDefaultId(context)),
});

/**
 * The workspace layout is pathless so the shell, session list, and open
 * transcript keep one instance while the addressed machine and conversation
 * change underneath them.
 */
const workspaceRoute = createRoute({
    component: KissopenAgentWorkspaceLayout,
    getParentRoute: () => rootRoute,
    id: "_workspace",
});

/**
 * Addressing one KISSOPEN Agent without a conversation releases whichever one was open in
 * it. Materialization is a store concern applied on navigation; the URL alone
 * says which KISSOPEN Agent and which conversation that is.
 */
const chatsIndexRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    loader: ({ context, params }) => {
        kissopenAgentWorkspace(context, params.kissopenAgentId)?.conversationClose();
    },
    path: "/chats/$kissopenAgentId",
});

/**
 * Addressing a project or worktree without one of its sessions: the group's tabs
 * are on screen but no session is open, so any previous one is released.
 */
const groupRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    loader: ({ context, params }) => {
        kissopenAgentWorkspace(context, params.kissopenAgentId)?.groupOpen(
            params.groupId as KissopenAgentGroupId,
        );
    },
    path: "/chats/$kissopenAgentId/$groupId",
});

/** Addressing one session materializes it, releasing the previous one. */
const chatRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    loader: ({ context, params }) => {
        const groupId = params.groupId as KissopenAgentGroupId;
        kissopenAgentWorkspace(context, params.kissopenAgentId)?.conversationOpen(
            params.chatId as KissopenAgentSessionId,
            groupId,
        );
    },
    path: "/chats/$kissopenAgentId/$groupId/$chatId",
});

/** A file presentation carried explicitly by its durable address. */
function kissopenAgentFileTabKindParse(value: string): KissopenAgentFileTabKind | undefined {
    return value === "file" || value === "diff" || value === "media" || value === "document"
        ? value
        : undefined;
}

/** A file opened over an empty workspace, with no session behind it. */
const groupFileRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    loader: ({ context, params }) => {
        const groupId = params.groupId as KissopenAgentGroupId;
        const workspace = kissopenAgentWorkspace(context, params.kissopenAgentId);
        const fileKind = kissopenAgentFileTabKindParse(params.fileKind);
        if (!fileKind)
            throw redirect({
                params: { groupId, kissopenAgentId: params.kissopenAgentId },
                replace: true,
                to: "/chats/$kissopenAgentId/$groupId",
            });
        workspace?.groupOpen(groupId);
        workspace?.filePreview(groupId, params.filePath, fileKind);
    },
    path: "/chats/$kissopenAgentId/$groupId/file/$fileKind/$filePath",
});

/** A file opened over one addressed session in its workspace. */
const chatFileRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    loader: ({ context, params }) => {
        const groupId = params.groupId as KissopenAgentGroupId;
        const workspace = kissopenAgentWorkspace(context, params.kissopenAgentId);
        const fileKind = kissopenAgentFileTabKindParse(params.fileKind);
        if (!fileKind)
            throw redirect({
                params: {
                    chatId: params.chatId,
                    groupId,
                    kissopenAgentId: params.kissopenAgentId,
                },
                replace: true,
                to: "/chats/$kissopenAgentId/$groupId/$chatId",
            });
        workspace?.conversationOpen(params.chatId as KissopenAgentSessionId, groupId);
        workspace?.filePreview(groupId, params.filePath, fileKind);
    },
    path: "/chats/$kissopenAgentId/$groupId/$chatId/file/$fileKind/$filePath",
});

/**
 * Where a session is started on one machine. Arriving materializes the draft —
 * the task written on a previous visit is offered back, because the store keeps
 * it until a session actually starts — and the surface then holds the whole
 * content region until the reader goes somewhere else or the new session takes
 * them there.
 */
const sessionCreateRoute = createRoute({
    component: KissopenAgentCreateRoute,
    getParentRoute: () => rootRoute,
    loader: ({ context, params }) => {
        kissopenAgentWorkspace(context, params.kissopenAgentId)?.createOpen();
    },
    path: "/create/$kissopenAgentId",
});

/**
 * One machine's inbox of agent questions. The KISSOPEN Agent is in the address because the
 * queue is that machine's — its agents are the ones waiting — so the window's
 * back and forward move between machines' inboxes rather than between two views
 * of one ambiguous list.
 */
const inboxRoute = createRoute({
    component: KissopenAgentInboxRoute,
    getParentRoute: () => rootRoute,
    path: "/inbox/$kissopenAgentId",
});

/**
 * The component workbench, addressed without a Kissopen Agent because it renders component
 * pages rather than anything a machine holds. The route is registered only in a
 * development build, which is also the only build whose sidebar offers it.
 */
const blueprintRoute = createRoute({
    component: KissopenAgentBlueprintRoute,
    getParentRoute: () => rootRoute,
    path: "/blueprint",
});

const settingsIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    beforeLoad: () => {
        throw redirect({
            params: { section: KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY },
            replace: true,
            to: "/settings/$section",
        });
    },
});

/**
 * One settings category, addressed the same way a conversation is: the URL names
 * which category is open, so the window's back/forward and its permanent category
 * column agree without a second selection living in a store.
 */
const settingsSectionRoute = createRoute({
    component: KissopenAgentSettingsRoute,
    getParentRoute: () => rootRoute,
    path: "/settings/$section",
    beforeLoad: ({ params }) => {
        if (!kissopenAgentSettingsCategoryExists(params.section))
            throw redirect({
                params: { section: KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY },
                replace: true,
                to: "/settings/$section",
            });
    },
});

const routeTree = rootRoute.addChildren([
    indexRoute,
    chatsRootRoute,
    workspaceRoute.addChildren([
        chatsIndexRoute,
        groupRoute,
        chatRoute,
        groupFileRoute,
        chatFileRoute,
    ]),
    inboxRoute,
    sessionCreateRoute,
    ...(import.meta.env.DEV ? [blueprintRoute] : []),
    settingsIndexRoute,
    settingsSectionRoute,
]);

/**
 * The inbox address renders the same window a conversation does: the shell and
 * its sidebar stay, and only the content area changes, so working through
 * questions is not leaving the workspace.
 */
function KissopenAgentInboxRoute() {
    return <KissopenAgentWorkspaceLayout inbox />;
}

/**
 * The Create address renders the same window a conversation does: the shell and
 * its sidebar stay, and only the content area changes, so starting a session is
 * not leaving the workspace.
 */
function KissopenAgentCreateRoute() {
    return <KissopenAgentWorkspaceLayout create />;
}

/**
 * The workbench address renders the same window a conversation does: the shell
 * and its sidebar stay, and only the content area changes.
 */
function KissopenAgentBlueprintRoute() {
    return <KissopenAgentWorkspaceLayout blueprint />;
}

function KissopenAgentWorkspaceLayout(
    props: {
        blueprint?: boolean;
        create?: boolean;
        inbox?: boolean;
    } = {},
) {
    // Read loosely because this component renders under several routes, which
    // makes every context member optional; the provider supplies all of them
    // together, so it is read back as the whole context it was given.
    const context = useRouteContext({ strict: false }) as unknown as KissopenAgentRouterContext;
    const navigate = useNavigate();
    const router = useRouter();
    // `strict: false` because a KISSOPEN Agent's list carries only `kissopenAgentId`, and a group
    // carries no `chatId`.
    const params = useParams({ strict: false });
    // The router is constructed before RouterProvider supplies the real context,
    // so the very first render of a deep-linked URL can arrive with an empty
    // context; the provider's context lands on the next synchronous pass.
    if (!context.kissopenAgents) return null;
    return (
        <AppKissopenAgentView
            appearance={context.appearance}
            browserContent={context.browserContent}
            browserAutomation={context.browserAutomation}
            buildIdentity={context.buildIdentity}
            performance={context.performance}
            htmlPreview={context.htmlPreview}
            mediaWindow={context.mediaWindow}
            documentConversion={context.documentConversion}
            {...(context.onScheduleProposalOpen
                ? { onScheduleProposalOpen: context.onScheduleProposalOpen }
                : {})}
            {...(context.onScheduledTaskOpen
                ? { onScheduledTaskOpen: context.onScheduledTaskOpen }
                : {})}
            {...(context.dictation ? { dictation: context.dictation } : {})}
            chatId={params.chatId}
            groupId={params.groupId}
            {...(context.daemon ? { daemon: context.daemon } : {})}
            {...(context.experiments ? { experiments: context.experiments } : {})}
            {...(context.titleShimmer ? { titleShimmer: context.titleShimmer } : {})}
            {...(context.commandPalette ? { commandPalette: context.commandPalette } : {})}
            {...(context.navigationOrder ? { navigationOrder: context.navigationOrder } : {})}
            {...(context.sidebarCollapse ? { sidebarCollapse: context.sidebarCollapse } : {})}
            {...(context.sidebarVisibility ? { sidebarVisibility: context.sidebarVisibility } : {})}
            createOpen={props.create}
            inboxOpen={props.inbox}
            blueprintOpen={props.blueprint}
            // Offered only where the route exists, which is what puts the
            // workbench row in a development sidebar and nowhere else.
            {...(import.meta.env.DEV
                ? { onBlueprintOpen: () => void navigate({ to: "/blueprint" }) }
                : {})}
            onCreateOpen={() =>
                void navigate({
                    params: {
                        kissopenAgentId: params.kissopenAgentId ?? kissopenAgentDefaultId(context),
                    },
                    to: "/create/$kissopenAgentId",
                })
            }
            onInboxOpen={() =>
                void navigate({
                    params: {
                        kissopenAgentId: params.kissopenAgentId ?? kissopenAgentDefaultId(context),
                    },
                    to: "/inbox/$kissopenAgentId",
                })
            }
            onUpdateApply={context.onUpdateApply}
            platform={context.platform}
            kissopenAgentId={params.kissopenAgentId ?? kissopenAgentDefaultId(context)}
            kissopenAgents={context.kissopenAgents}
            update={context.update}
            windowState={context.windowState}
            onChatSelect={(kissopenAgentId, groupId, chatId, replace) =>
                void navigate(
                    groupId === undefined
                        ? { params: { kissopenAgentId }, replace, to: "/chats/$kissopenAgentId" }
                        : chatId
                          ? {
                                params: { chatId, groupId, kissopenAgentId },
                                replace,
                                to: "/chats/$kissopenAgentId/$groupId/$chatId",
                            }
                          : {
                                params: { groupId, kissopenAgentId },
                                replace,
                                to: "/chats/$kissopenAgentId/$groupId",
                            },
                )
            }
            onChatClose={(kissopenAgentId, groupId, chatId, fallbackChatId) => {
                const changed = router.history.sessionForget(
                    kissopenAgentId,
                    groupId,
                    chatId,
                    fallbackChatId,
                );
                if (changed && router.history.subscribers.size === 0)
                    void router.load({ action: { type: "REPLACE" } });
                return changed;
            }}
            onFileClose={(kissopenAgentId, groupId, path) => {
                // The route helper owns history repair; the surface owns the
                // tab bytes and closes those immediately after this callback.
                kissopenAgentRouterFileForget(router, kissopenAgentId, groupId, path);
            }}
            onFileSelect={(kissopenAgentId, groupId, chatId, path, fileKind, replace) => {
                if (chatId) {
                    void navigate({
                        params: { chatId, fileKind, filePath: path, groupId, kissopenAgentId },
                        replace,
                        to: "/chats/$kissopenAgentId/$groupId/$chatId/file/$fileKind/$filePath",
                    });
                    return;
                }
                void navigate({
                    params: { fileKind, filePath: path, groupId, kissopenAgentId },
                    replace,
                    to: "/chats/$kissopenAgentId/$groupId/file/$fileKind/$filePath",
                });
            }}
            onSettingsOpen={() =>
                void navigate({
                    params: { section: KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY },
                    to: "/settings/$section",
                })
            }
            // Settings has one destination per category, and the palette offers
            // them by name. The address stays this file's business: the view is
            // handed the one destination it asked for and never the router.
            onSettingsSectionOpen={(section) =>
                void navigate({
                    params: {
                        section: kissopenAgentSettingsCategoryExists(section)
                            ? section
                            : KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY,
                    },
                    to: "/settings/$section",
                })
            }
        />
    );
}

/**
 * Local route glue. Leaving settings addresses the conversation list rather than
 * popping history, so the way out is the same wherever the window was opened
 * from — including a cold start straight onto a settings URL.
 */
function KissopenAgentSettingsRoute() {
    const context = useRouteContext({ strict: false }) as unknown as KissopenAgentRouterContext;
    const navigate = useNavigate();
    const params = useParams({ strict: false });
    return (
        <AppKissopenAgentSettingsView
            communityAccount={context.communityAccount}
            {...(context.application ? { application: context.application } : {})}
            {...(context.onApplicationInstall
                ? { onApplicationInstall: context.onApplicationInstall }
                : {})}
            appearance={context.appearance}
            {...(context.daemon ? { daemon: context.daemon } : {})}
            {...(context.debug ? { debug: context.debug } : {})}
            {...(context.profiler ? { profiler: context.profiler } : {})}
            {...(context.experiments ? { experiments: context.experiments } : {})}
            onCategorySelect={(section) =>
                void navigate({ params: { section }, to: "/settings/$section" })
            }
            onClose={() => void navigate({ to: "/chats" })}
            kissopenAgents={context.kissopenAgents}
            platform={context.platform}
            section={params.section ?? KISSOPEN_AGENT_SETTINGS_DEFAULT_CATEGORY}
            settings={context.settings}
            {...(context.titleShimmer ? { titleShimmer: context.titleShimmer } : {})}
            windowState={context.windowState}
        />
    );
}

/**
 * Creates the router that owns the local window's location lifetime. Local
 * sessions are grouped by the daemon's projects, so their address is the group —
 * the project, or the worktree inside it, by the durable id the daemon assigned
 * it, which keeps a filesystem layout out of the URL and survives a rename — and
 * then the session inside it. The machine comes first, because the same project
 * name may exist on several of them: `/chats/$kissopenAgentId/$groupId/$chatId`. It stays
 * one stable address, so the UI never keeps a second competing selection in a
 * store.
 */
export function kissopenAgentRouterCreate(history: KissopenAgentRouterHistory = defaultHistory()) {
    return createRouter({
        context: undefined as unknown as KissopenAgentRouterContext,
        defaultPreload: false,
        history,
        routeTree,
        // The application owns scrolling inside its own scrollports; letting the
        // router restore or reset window scroll would fight them.
        scrollRestoration: () => false,
        scrollToTopSelectors: [],
    });
}

/**
 * Addresses one local session: the single place that turns a session's location
 * into a local URL. The desktop shell never hand-builds one.
 */
export function kissopenAgentRouterConversationOpen(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
    location: KissopenAgentSessionLocation,
): void {
    void router.navigate({
        params: { chatId: location.sessionId, groupId: location.groupId, kissopenAgentId },
        to: "/chats/$kissopenAgentId/$groupId/$chatId",
    });
}

/**
 * Addresses a group that holds no conversation yet, such as a worktree the
 * reader has just added. The conversation started in it re-addresses the same
 * group through `kissopenAgentRouterConversationOpen` once it exists.
 */
export function kissopenAgentRouterGroupOpen(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
    groupId: string,
): void {
    void router.navigate({
        params: { groupId, kissopenAgentId },
        to: "/chats/$kissopenAgentId/$groupId",
    });
}

/** Opens a local library file in the workspace's real viewer, never an external app. */
export function kissopenAgentRouterFileOpen(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
    groupId: string,
    filePath: string,
    fileKind: KissopenAgentFileTabKind,
): void {
    void router.navigate({
        params: { kissopenAgentId, groupId, filePath, fileKind },
        to: "/chats/$kissopenAgentId/$groupId/file/$fileKind/$filePath",
    });
}

/**
 * Shows one KISSOPEN Agent's work home: no project open, so the page that
 * starts one. Choosing 工作 in the window's navigation lands here, rather than
 * back in whichever project was open last.
 */
export function kissopenAgentRouterHomeOpen(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
): void {
    void router.navigate({ params: { kissopenAgentId }, to: "/chats/$kissopenAgentId" });
}

/** Shows one KISSOPEN Agent's Create surface. */
export function kissopenAgentRouterCreateOpen(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
): void {
    void router.navigate({ params: { kissopenAgentId }, to: "/create/$kissopenAgentId" });
}

/**
 * Removes a closed file tab from this window's navigation stack. A current file
 * lands on the nearest surviving destination; a file that was the window's only
 * destination uncovers its addressed session or workspace.
 */
export function kissopenAgentRouterFileForget(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
    groupId: string,
    path: string,
): void {
    const changed = router.history.fileForget(kissopenAgentId, groupId, path);
    if (changed && router.history.subscribers.size === 0)
        void router.load({ action: { type: "REPLACE" } });
}

/**
 * Takes a group that stopped existing out of this window's navigation — archived
 * here, or from another window or machine.
 *
 * Every remembered address naming it goes, not just the one on screen: one
 * archive kills the workspace and each conversation opened inside it. The stack
 * is an array rather than the browser's, so they are removed outright.
 *
 * It moves nobody who was not standing on what went. A KISSOPEN Agent reports the removal
 * whether or not this window shows it, so a reader on another project, the KISSOPEN Agent's
 * list, or settings keeps their place while dead addresses drop from behind.
 */
export function kissopenAgentRouterGroupForget(
    router: KissopenAgentRouter,
    kissopenAgentId: string,
    groupId: string,
): void {
    const changed = router.history.groupForget(kissopenAgentId, groupId);
    // A rendered window is subscribed to its own history and reloads from the
    // notification above. One that is not — a window still starting up — has to
    // be told, the same way the router tells itself when it commits a location
    // with nothing listening.
    if (changed && router.history.subscribers.size === 0)
        void router.load({ action: { type: "REPLACE" } });
}

/**
 * Creates deterministic local-router history for application and navigation
 * tests. The starting point is given as a URL because that is what those tests
 * are about — which place a URL addresses — and it is parsed here exactly as one
 * arriving from the document would be.
 */
export function kissopenAgentMemoryHistoryCreate(
    initialUrl = "/chats/local",
): KissopenAgentRouterHistory {
    const route = kissopenAgentRoutePathParse(initialUrl);
    return kissopenAgentHistoryCreate({ initialEntries: route ? [route] : [] });
}

/**
 * The stack every window navigates. It is this application's own array rather
 * than the browser's, so an address that stops existing can be removed from it;
 * the document URL only mirrors where the reader is. A window given somewhere to
 * keep it reopens where it was left.
 */
function defaultHistory(): KissopenAgentRouterHistory {
    return kissopenAgentHistoryCreate();
}

export type KissopenAgentRouter = ReturnType<typeof kissopenAgentRouterCreate>;

/**
 * Registers this window's route tree as the one every router helper is typed
 * against. There is exactly one router in this application, so `navigate`,
 * `redirect`, and `useParams` can name its addresses directly and a path or
 * parameter that does not exist stops being a compile error waiting to happen.
 */
declare module "@tanstack/react-router" {
    interface Register {
        router: KissopenAgentRouter;
    }
}
