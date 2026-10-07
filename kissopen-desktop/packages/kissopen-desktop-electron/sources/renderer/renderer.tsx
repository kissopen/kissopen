// Must stay first: sets the interface language before any module reads it.
import "./localeBoot";
import {
    CommunityAccount,
    AppCommunityAccountBoundary,
    KissopenView,
    LocalLibraryView,
} from "kissopen-desktop-app";
import { CommunityAuthClient } from "@kissopen/kissopen-sync/communityAuth";
import { LOCALE_STORAGE_KEY, localePreferenceRead } from "./localeBoot";
import { type AppApplicationIdentity } from "kissopen-desktop-app";
import {
    scheduleDraftRequest,
    scheduleFocusRequest,
    scheduleDraftSubscribe,
    scheduleDraftTake,
    scheduleFocusSubscribe,
    scheduleFocusTake,
} from "./relayScheduleDraft";
import { kissopenRequestFailure } from "./kissopenRequestFailure";
import { LocalPluginsView } from "kissopen-desktop-app";
import { LocalPluginsStore } from "kissopen-desktop-state";
import { DesktopScheduledTasks } from "./desktopScheduledTasks";
import { dictationCurrent } from "./relayDictation";
import { localePreferenceBind, t } from "kissopen-desktop-state";
import { Activity, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import {
    DesktopStartupScreen,
    kissopenAgentHistoryCreate,
    kissopenAgentWelcomeSlides,
    kissopenAgentRouterConversationOpen,
    kissopenAgentRouterCreateOpen,
    kissopenAgentRouterGroupOpen,
    kissopenAgentRouterFileOpen,
    kissopenAgentRouterHomeOpen,
    kissopenAgentRouterGroupForget,
    kissopenAgentRouterCreate,
    type AppKissopenAgentDaemonStore,
    type AppKissopenAgentUpdate,
    type AppKissopenAgentDebugStore,
    type AppKissopenAgentProfilerStore,
    type KissopenAgentRouter,
} from "kissopen-desktop-app";
import {
    KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL,
    KissopenStore,
    localLibraryStoreCreate,
    type CommunityProfile,
    appearanceStoreCreate,
    commandPaletteStoreCreate,
    experimentsStoreCreate,
    titleShimmerStoreCreate,
    welcomeStoreCreate,
    kissopenAgentNavigationOrderStoreCreate,
    kissopenAgentSidebarCollapseStoreCreate,
    kissopenAgentSidebarVisibilityStoreCreate,
    kissopenAgentSettingsStoreCreate,
    type AppearanceStore,
    type CommandPaletteStore,
    type ExperimentsStore,
    type WelcomeStore,
    type KissopenAgentNavigationOrderStore,
    type KissopenAgentSidebarCollapseStore,
    type KissopenAgentSidebarVisibilityStore,
    type KissopenAgentSettingsStore,
    type TitleShimmerStore,
    type KissopenAgentWindowStore,
    type KissopenAgentModelPreferencePersistence,
    type KissopenAgentSessionId,
} from "kissopen-desktop-state";
import {
    CodeHighlightWorkers,
    filePreviewKind,
    EmptyState,
    LocalOnboardingScreen,
    SetupHandoff,
    SetupPage,
    ThemeScope,
    AgentInstallScreen,
    ConnectionHeader,
    WelcomeScreen,
    ZoomIndicator,
    ConnectionShell,
    ConnectionSurface,
    type AgentInstallView,
    type BrowserContentRenderer,
    type HtmlPreviewRenderer,
    type LivePerformanceStore,
    type MediaWindowOpener,
} from "kissopen-desktop-ui";
import type { KissopenAgentDocumentConversionOpener } from "kissopen-desktop-state";
import {
    mediaPreviewView,
    quickBarView,
    type DesktopConfig,
    type DesktopGuestKeyEvent,
    type DesktopRuntimeSnapshot,
    type DesktopUpdateSnapshot,
    type KissopenDesktopBridge,
} from "../shared/desktopContract";
import { desktopStartRequestFromValues, desktopStartupValues } from "./desktopStartupModel";
import { dockUnreadPublish } from "./dockUnread";
import { desktopRuntimeStoreCreate, type DesktopRuntimeStore } from "./runtimeStore";
import {
    localOnboardingStoreCreate,
    localOnboardingView,
    type LocalOnboardingStore,
} from "./localOnboardingStore";
import {
    LOCAL_KISSOPEN_AGENT_ID,
    kissopenAgentDirectoryStoreCreate,
    type KissopenAgentDirectoryStore,
} from "./kissopenAgentDirectoryStore";
import { startupValuesStoreCreate, type StartupValuesStore } from "./startupValuesStore";
import { browserDevBridgeCreate } from "./browserDevBridge";
import { appVersion } from "./appVersion";
import { localWebBuild } from "./localWebBuild";
import {
    localWebUpdateStoreCreate,
    type LocalWebUpdateSnapshot,
    type LocalWebUpdateStore,
} from "./localWebUpdateStore";
import { surfaceWindowStateStoreCreate, windowStateStoreCreate } from "./windowStateStore";
import { DesktopBrowserView } from "./desktopBrowserView";
import { DesktopBrowserSession, desktopBrowserMessageBridge } from "./desktopBrowserSession";
import { DesktopHtmlPreviewView } from "./desktopHtmlPreviewView";
import { desktopPreferencesCreate } from "./desktopPreferences";
import { desktopHistoryPersistence } from "./desktopHistory";
import { desktopConnectionUiCreate, type DesktopConnectionUi } from "./desktopConnectionUi";
import { desktopConnectionPreferencesCreate } from "./desktopConnectionPreferences";
import { desktopCloudAuthRouterCreate } from "./desktopCloudAuthRouter";
import { desktopDebugStoreCreate } from "./desktopDebugStore";
import { desktopProfilerStoreCreate } from "./desktopProfilerStore";
import { desktopMetricsStoreCreate } from "./desktopMetricsStore";
import { desktopDaemonStoreCreate } from "./desktopDaemonStore";
import { desktopExperimentsPersistence } from "./desktopExperiments";
import { desktopWelcomePersistence } from "./desktopWelcome";
import { desktopNavigationOrderPersistence } from "./desktopNavigationOrder";
import { desktopSidebarCollapsePersistence } from "./desktopSidebarCollapse";
import { DesktopBootGate } from "./DesktopBootGate";
import { desktopRestartStoreCreate, type DesktopRestartStore } from "./desktopRestartStore";
import {
    DesktopMediaPreviewWindow,
    desktopMediaPreviewEscapeBind,
    desktopMediaPreviewStoreCreate,
} from "./desktopMediaPreview";
import { documentConversionOpenerCreate } from "./documentConversion";
import { QuickBarSurface } from "./quickBarSurface";
import { libraryImageType, libraryThumbnail } from "./libraryThumbnail";

/**
 * Hands one workspace file to the shell to show in a window of its own. The
 * shell decides whether the address is one of its Kissopen Agents' and refuses otherwise,
 * so a failure here is reported rather than retried against another route.
 */
function desktopMediaWindowOpen(bridge: KissopenDesktopBridge): MediaWindowOpener {
    return (request) => {
        void bridge.mediaPreviewOpen(request.url).catch((error: unknown) => {
            console.error("Could not open the file in its own window.", error);
        });
    };
}

const desktopBrowserAutomationRender: import("kissopen-desktop-ui").BrowserAutomationRenderer = (
    props,
) => <DesktopBrowserSession {...props} />;
const desktopBrowserContentRender: BrowserContentRenderer = (props) => (
    <DesktopBrowserView {...props} />
);

const desktopHtmlPreviewRender: HtmlPreviewRenderer = (props) => (
    <DesktopHtmlPreviewView {...props} />
);

function desktopAction(operation: Promise<void>): void {
    void operation.catch(() => undefined);
}

/**
 * Publishes KISSOPEN's selected appearance source to Chromium. Electron applies it
 * process-wide, which is the boundary shared by browser guests, HTML previews,
 * and the separate media-preview window.
 */
function desktopAppearanceSynchronize(
    appearance: AppearanceStore,
    bridge: KissopenDesktopBridge,
): void {
    let published: "dark" | "light" | "system" | undefined;
    const publish = () => {
        const mode = appearance.get().mode;
        if (mode === published) return;
        published = mode;
        bridge.appearanceSet(mode);
    };
    publish();
    appearance.subscribe(publish);
}

interface WorkspaceUpdate {
    readonly action: "install" | "refresh";
    readonly snapshot: AppKissopenAgentUpdate;
}

function workspaceUpdate(
    native: DesktopUpdateSnapshot,
    hosted: LocalWebUpdateSnapshot,
): WorkspaceUpdate | undefined {
    if (
        native.status === "available" ||
        native.status === "downloading" ||
        native.status === "downloaded"
    )
        return {
            action: "install",
            snapshot: {
                action: "restart",
                ...(native.availableVersion ? { version: native.availableVersion } : {}),
                ...(native.message ? { detail: native.message } : {}),
                status: native.status,
            },
        };
    if (hosted.status !== "available") return undefined;
    const version =
        hosted.version !== localWebBuild?.version
            ? hosted.version
            : `build ${hosted.buildId.slice(0, 7)}`;
    return {
        action: "refresh",
        snapshot: { action: "refresh", status: "downloaded", version },
    };
}

/**
 * The application's identity as the settings page shows it. `WorkspaceUpdate`
 * exists only while an update is actually happening, because the sidebar row
 * is an interruption; settings wants the quiet answers too — "up to date", and
 * why the last check failed.
 */
function applicationIdentity(update: DesktopUpdateSnapshot): AppApplicationIdentity {
    return {
        version: appVersion,
        updateStatus: update.status,
        ...(update.availableVersion ? { availableVersion: update.availableVersion } : {}),
        ...(update.message ? { message: update.message } : {}),
    };
}

function ChoosingScreen(props: {
    bridge: KissopenDesktopBridge;
    update: DesktopUpdateSnapshot;
    values: StartupValuesStore;
}) {
    const values = useSyncExternalStore(props.values.subscribe, props.values.get, props.values.get);
    return (
        <DesktopStartupScreen
            onChange={props.values.change}
            onInstallUpdate={() => desktopAction(props.bridge.updateInstall())}
            onSubmit={() =>
                desktopAction(props.bridge.runtimeStart(desktopStartRequestFromValues(values)))
            }
            phase="choosing"
            update={props.update}
            values={values}
        />
    );
}

/**
 * Mounts the local workspace under its router once a connection exists. The
 * router owns which conversation is open, so the stores of a new connection are
 * handed to it as route context rather than as props to a screen.
 */
/**
 * Renders the whole desktop tree in the selected appearance. The store outlives
 * every daemon connection and every startup phase, so the startup screens and the
 * workspace are one themed subtree rather than two.
 */
function DesktopAppearance(props: { appearance: AppearanceStore; children: ReactNode }) {
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    return (
        <ThemeScope mode={appearance.mode} scrollbarVisibility={appearance.scrollbarVisibility}>
            {props.children}
        </ThemeScope>
    );
}

/**
 * Mounts the workspace router as soon as this window has a Kissopen Agent directory to
 * render. Which Kissopen Agent is on screen — and whether it has connected yet — is the
 * directory's business and the URL's, not this boundary's, so a machine that is
 * still connecting no longer holds the whole window on a startup screen.
 */
function KissopenAgentBoundary(props: {
    communityAccount?: CommunityAccount;
    appearance: AppearanceStore;
    commandPalette: CommandPaletteStore;
    daemon?: AppKissopenAgentDaemonStore;
    debug?: AppKissopenAgentDebugStore;
    performance?: LivePerformanceStore;
    profiler?: AppKissopenAgentProfilerStore;
    connectionOnboarding?: boolean;
    bridge: KissopenDesktopBridge;
    browserContent?: BrowserContentRenderer;
    browserAutomation?: import("kissopen-desktop-ui").BrowserAutomationRenderer;
    htmlPreview?: HtmlPreviewRenderer;
    mediaWindow?: MediaWindowOpener;
    documentConversion?: KissopenAgentDocumentConversionOpener;
    experiments: ExperimentsStore;
    platform: "desktop" | "web";
    router: KissopenAgentRouter;
    navigationOrder: KissopenAgentNavigationOrderStore;
    sidebarCollapse: KissopenAgentSidebarCollapseStore;
    sidebarVisibility: KissopenAgentSidebarVisibilityStore;
    kissopenAgents: KissopenAgentDirectoryStore;
    settings: KissopenAgentSettingsStore;
    titleShimmer: TitleShimmerStore;
    update?: WorkspaceUpdate;
    application?: AppApplicationIdentity;
    onApplicationInstall?: () => void;
    windowState: KissopenAgentWindowStore;
}) {
    const update = props.update;
    return (
        <RouterProvider
            context={{
                communityAccount: props.communityAccount,
                appearance: props.appearance,
                browserContent: props.browserContent,
                browserAutomation: props.browserAutomation,
                // A development window says which checkout it came from; the
                // packaged product supplies nothing and shows nothing.
                buildIdentity: props.bridge.buildIdentity,
                ...(props.application ? { application: props.application } : {}),
                ...(props.onApplicationInstall
                    ? { onApplicationInstall: props.onApplicationInstall }
                    : {}),
                commandPalette: props.commandPalette,
                connectionOnboarding: props.connectionOnboarding,
                ...(props.daemon ? { daemon: props.daemon } : {}),
                debug: props.debug,
                ...(props.performance ? { performance: props.performance } : {}),
                profiler: props.profiler,
                htmlPreview: props.htmlPreview,
                mediaWindow: props.mediaWindow,
                documentConversion: props.documentConversion,
                // 计划任务 is drawn by the relay workspace around this tree.
                onScheduleProposalOpen: scheduleDraftRequest,
                onScheduledTaskOpen: scheduleFocusRequest,
                // The mic in every composer: the account's transcription.
                ...(dictationCurrent() ? { dictation: dictationCurrent() } : {}),
                ...(update
                    ? {
                          onUpdateApply: () => {
                              if (update.action === "install")
                                  desktopAction(props.bridge.updateInstall());
                              else window.location.reload();
                          },
                          update: update.snapshot,
                      }
                    : {}),
                experiments: props.experiments,
                navigationOrder: props.navigationOrder,
                sidebarCollapse: props.sidebarCollapse,
                sidebarVisibility: props.sidebarVisibility,
                platform: props.platform,
                kissopenAgents: props.kissopenAgents,
                settings: props.settings,
                titleShimmer: props.titleShimmer,
                windowState: props.windowState,
            }}
            router={props.router}
        />
    );
}

/**
 * First-run setup, while there is any of it left to do.
 *
 * Within local mode it does own the whole window until the machine can actually
 * run KISSOPEN Agent and the person has answered the questions that follow, so the
 * workspace below is never mounted against a machine that is not ready. Which
 * stage is on is the main process's answer, so a restart, an interrupted
 * install, or a Kissopen Agent that disappeared resumes here rather than in a remembered
 * position.
 */
function DesktopOnboardingGate(props: {
    appearance: AppearanceStore;
    children: ReactNode;
    store: LocalOnboardingStore;
    welcome: WelcomeStore;
}) {
    const snapshot = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const welcome = useSyncExternalStore(
        props.welcome.subscribe,
        props.welcome.get,
        props.welcome.get,
    );
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    // Nothing has answered yet, so nothing is known to be owed. Deciding here
    // would put the welcome — a full-colour mark and a slogan — in front of a
    // machine that turns out to need no setup at all, for exactly as long as the
    // main process takes to say so. The boot cover holds the window meanwhile.
    if (!snapshot.onboarding) return null;
    const view = localOnboardingView(snapshot);
    // The welcome is only the deck. Going past it acknowledges it and nothing
    // more: whether this machine gets an agent is asked separately below, so a
    // person who only connects to a remote Agent is never made to install one.
    if (view && !welcome.welcomeAcknowledged)
        return (
            <WelcomeScreen
                appearance={appearance.mode}
                backdrop={{ kind: "sky" }}
                onAction={() => props.welcome.welcomeAcknowledge()}
                onAppearanceChange={(mode) => props.appearance.appearanceSelect(mode)}
                slides={kissopenAgentWelcomeSlides}
            />
        );
    /*
     * A machine with no agent and nobody asking for one.
     *
     * This is not a stage of setup — it is the window offering setup, in the
     * 工作 tab, while a remote Agent can still be connected. Choosing it
     * is what enables the renderer-owned automatic download and launch; every
     * machine operation then appears on the one setup surface that follows.
     * Recorded for good, so the next launch of this window resumes the
     * download rather than asking again.
     */
    if (
        view &&
        !snapshot.agentSetupActive &&
        (view.kind === "agent-setup" || view.kind === "node-missing")
    )
        return (
            <EmptyState
                icon="agents"
                emphasis="prominent"
                title={t("KissOpen Agent is not on this computer yet")}
                description={t(
                    "Set up KissOpen Agent to work with local projects and terminals, or connect to an Agent on another computer.",
                )}
                action={{
                    label: t("Set up this computer"),
                    onClick: () => {
                        props.store.agentSetupBegin();
                        props.welcome.agentSetupChoose();
                    },
                }}
            />
        );
    // The interface is the final onboarding step. Keep the sidebar (+) usable
    // while the secretary's unsent draft is being prepared in the background.
    if (!view || view.kind === "finishing")
        return (
            <SetupHandoff
                error={view?.message}
                busy={view?.busy}
                onRetry={() => props.store.chiefOfStaffSetup()}
            >
                {props.children}
            </SetupHandoff>
        );
    return (
        <LocalOnboardingScreen
            appearance={appearance.mode}
            showSteps
            onAssistantsContinue={() => props.store.assistantsContinue()}
            onConnectRetry={() => props.store.connectRetry()}
            onKissopenMobileConnect={() => props.store.kissopenMobileConnect()}
            onKissopenMobileSkip={() => props.store.kissopenMobileSkip()}
            onKissopenMobilePlatformSelect={(platform) =>
                props.store.kissopenMobilePlatformSelect(platform)
            }
            onProfileCreate={() => props.store.profileCreate()}
            onProfileEmailChange={(value) => props.store.profileEmailUpdate(value)}
            onProfileNameChange={(value) => props.store.profileNameUpdate(value)}
            onProjectChoose={() => props.store.projectChoose()}
            view={view}
        />
    );
}

/**
 * What KISSOPEN says for itself before it has been set up, in the order it says it.
 *
 * The words live here rather than in the component because they are the product
 * talking, not a layout: `WelcomeScreen` owns the centred column, the slideshow,
 * and the button, and this is the only place that decides what any of it means.
 * The order is the value hierarchy, not a feature tour. The mark names the
 * category and carries the whole summary: one harness for the whole team,
 * available in the terminal, on desktop, and on mobile. The next two slides
 * make the differentiators concrete — the team inside the live session first,
 * then every agent mixed in one harness. Open source and being yours to change
 * explain who controls the product; the final security slide closes with how
 * that control protects a corporate deployment and its mobile clients.
 */

/** True while the runtime is working on, or running, this machine's own Kissopen Agent. */
function desktopLocalPhase(snapshot: DesktopRuntimeSnapshot): boolean {
    if (snapshot.phase === "choosing") return false;
    if (snapshot.phase === "ready") return snapshot.mode === "local";
    return snapshot.request.mode === "local";
}

interface DesktopRendererProps {
    communityAccount: CommunityAccount;
    connectionUis: ReadonlyMap<string, DesktopConnectionUi>;
    appearance: AppearanceStore;
    commandPalette: CommandPaletteStore;
    daemon?: AppKissopenAgentDaemonStore;
    debug: AppKissopenAgentDebugStore;
    performance?: LivePerformanceStore;
    profiler: AppKissopenAgentProfilerStore;
    onboarding: LocalOnboardingStore;
    browserContent?: BrowserContentRenderer;
    browserAutomation?: import("kissopen-desktop-ui").BrowserAutomationRenderer;
    htmlPreview?: HtmlPreviewRenderer;
    mediaWindow?: MediaWindowOpener;
    documentConversion?: KissopenAgentDocumentConversionOpener;
    bridge: KissopenDesktopBridge;
    experiments: ExperimentsStore;
    navigationOrder: KissopenAgentNavigationOrderStore;
    sidebarCollapse: KissopenAgentSidebarCollapseStore;
    sidebarVisibility: KissopenAgentSidebarVisibilityStore;
    platform: "desktop" | "web";
    kissopenAgentRouter: KissopenAgentRouter;
    kissopenAgents: KissopenAgentDirectoryStore;
    settings: KissopenAgentSettingsStore;
    titleShimmer: TitleShimmerStore;
    startupValues: StartupValuesStore;
    store: DesktopRuntimeStore;
    welcome: WelcomeStore;
    localWebUpdate: LocalWebUpdateStore;
    windowState: KissopenAgentWindowStore;
    /**
     * What each connection surface lays out against: the window itself, or
     * the closed-inset arrangement while the connection rail owns the left edge.
     */
    surfaceWindowState: KissopenAgentWindowStore;
    /** The local agent's restart as the window shows it, held until it is connected again. */
    restart: DesktopRestartStore;
}

/**
 * The desktop's own screens: choosing where Kissopen should run, the startup and
 * failure states of that choice, and the workspace once a machine is connected.
 * First-run setup is layered over this rather than built into it, so the choice
 * itself is always reachable.
 */
function DesktopRenderer(props: DesktopRendererProps) {
    return (
        // Outside every screen below, so one mark spans the whole run-up to a
        // workspace instead of being unmounted and remounted as the window moves
        // between the screens that boot crosses.
        <DesktopBootGate
            onboarding={props.onboarding}
            kissopenAgents={props.kissopenAgents}
            runtime={props.store}
        >
            <DesktopScreens {...props} />
        </DesktopBootGate>
    );
}

function DesktopScreens(props: DesktopRendererProps) {
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const windowState = useSyncExternalStore(
        props.windowState.subscribe,
        props.windowState.get,
        props.windowState.get,
    );
    const sidebarVisibility = useSyncExternalStore(
        props.sidebarVisibility.subscribe,
        props.sidebarVisibility.get,
        props.sidebarVisibility.get,
    );
    const restart = useSyncExternalStore(
        props.restart.subscribe,
        props.restart.get,
        props.restart.get,
    );
    const main = props.connectionUis.get(LOCAL_KISSOPEN_AGENT_ID);
    const surfaceWindowState = props.surfaceWindowState;
    // Every connection rides through the local daemon, so while it is being
    // replaced nothing in this window is usable — the remotes on the rail no
    // more than the local surface. The restart takes the whole window, rail
    // included; the shell stays mounted but hidden so every surface keeps its
    // state for the moment the daemon is back. The screen outlasts the main
    // process's word for the restart: it stays until this window is connected
    // again and the catalog is read, so nothing half-built is ever handed back.
    const restarting = restart !== undefined;
    const shell = (
        <ConnectionShell
            items={directory.kissopenAgents.map((entry) => ({
                id: entry.id,
                // The rail names a machine the way its own daemon does. The
                // host's roster name stands in until that daemon has answered.
                label: entry.node?.name ?? entry.label,
                local: entry.id === LOCAL_KISSOPEN_AGENT_ID,
                status: entry.status,
                working:
                    entry.bots.some((bot) => bot.conversation.activity === "running") ||
                    entry.projects.some(
                        (project) =>
                            project.conversations.some(
                                (conversation) => conversation.activity === "running",
                            ) ||
                            project.worktrees.some((worktree) =>
                                worktree.conversations.some(
                                    (conversation) => conversation.activity === "running",
                                ),
                            ),
                    ),
                unread:
                    entry.bots.some((bot) => bot.conversation.unread) ||
                    entry.projects.some(
                        (project) =>
                            project.conversations.some((conversation) => conversation.unread) ||
                            project.worktrees.some((worktree) =>
                                worktree.conversations.some((conversation) => conversation.unread),
                            ),
                    ),
                ...(entry.node?.avatar ? { avatar: entry.node.avatar } : {}),
            }))}
            selectedId={directory.activeKissopenAgentId ?? LOCAL_KISSOPEN_AGENT_ID}
            onSelect={props.kissopenAgents.kissopenAgentActivate}
            onReorder={
                directory.kissopenAgents.some(
                    (entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID && entry.status === "connected",
                )
                    ? props.kissopenAgents.kissopenAgentReorder
                    : undefined
            }
            reordering={directory.reordering}
            reorderError={directory.reorderError}
            windowControls={props.platform === "desktop" && !windowState.fullScreen}
            collapsed={sidebarVisibility.hidden}
            // The roster is this computer's agent's answer. While that agent is
            // not up — not installed, or down, which the surface below already
            // says — a line about the roster being unavailable is only a second
            // voice saying the same thing.
            error={
                directory.kissopenAgents.some(
                    (entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID && entry.status === "connected",
                )
                    ? directory.error
                    : undefined
            }
        >
            <ConnectionSurface
                key={LOCAL_KISSOPEN_AGENT_ID}
                active={
                    !directory.activeKissopenAgentId ||
                    directory.activeKissopenAgentId === LOCAL_KISSOPEN_AGENT_ID
                }
            >
                <DesktopLocalScreens
                    {...props}
                    kissopenAgents={main?.directory ?? props.kissopenAgents}
                    windowState={surfaceWindowState}
                />
            </ConnectionSurface>
            {directory.kissopenAgents
                .filter((entry) => entry.id !== LOCAL_KISSOPEN_AGENT_ID)
                .map((entry) => {
                    const ui = props.connectionUis.get(entry.id);
                    if (!ui) return null;
                    return (
                        <ConnectionSurface
                            key={entry.id}
                            active={directory.activeKissopenAgentId === entry.id}
                        >
                            <DesktopConnectionHeader
                                platform="web"
                                kissopenAgents={ui.directory}
                                windowState={surfaceWindowState}
                            />
                            <KissopenAgentBoundary
                                appearance={props.appearance}
                                bridge={props.bridge}
                                browserContent={props.browserContent}
                                browserAutomation={props.browserAutomation}
                                commandPalette={ui.commandPalette}
                                connectionOnboarding
                                experiments={props.experiments}
                                htmlPreview={props.htmlPreview}
                                mediaWindow={props.mediaWindow}
                                documentConversion={props.documentConversion}
                                navigationOrder={ui.navigationOrder}
                                sidebarCollapse={ui.sidebarCollapse}
                                sidebarVisibility={ui.sidebarVisibility}
                                platform={props.platform}
                                router={ui.router}
                                kissopenAgents={ui.directory}
                                settings={ui.settings}
                                titleShimmer={props.titleShimmer}
                                windowState={surfaceWindowState}
                            />
                        </ConnectionSurface>
                    );
                })}
        </ConnectionShell>
    );
    return (
        <>
            <Activity mode={restarting ? "hidden" : "visible"}>{shell}</Activity>
            {restart ? (
                <DesktopAgentRestartWindow
                    daemon={props.daemon ?? unavailableDaemonStore}
                    view={restart}
                />
            ) : null}
        </>
    );
}

function DesktopLocalScreens(props: DesktopRendererProps) {
    const snapshot = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const hostedUpdate = useSyncExternalStore(
        props.localWebUpdate.subscribe,
        props.localWebUpdate.get,
        props.localWebUpdate.get,
    );
    const content = (
        <DesktopProtocolGate
            // A runtime that is still choosing, starting, or failing answers for
            // itself, and those screens are the more actionable ones: a version
            // gap learned from an earlier connection must not talk over the
            // reason this one is not up. The gate stays mounted across that so
            // the workspace below it is never rebuilt by the change.
            ready={snapshot?.phase === "ready"}
            kissopenAgents={props.kissopenAgents}
            {...(props.daemon ? { daemon: props.daemon } : {})}
        >
            <DesktopRuntimeContent {...props} hostedUpdate={hostedUpdate} snapshot={snapshot} />
        </DesktopProtocolGate>
    );
    // Local setup gates the workspace until this machine can run Kissopen Agent.
    const gated =
        !snapshot || !desktopLocalPhase(snapshot) ? (
            content
        ) : (
            <DesktopOnboardingGate
                appearance={props.appearance}
                store={props.onboarding}
                welcome={props.welcome}
            >
                {content}
            </DesktopOnboardingGate>
        );
    // A restart is not gated here: it takes the whole window, rail included,
    // so its screen lives in DesktopScreens above every connection surface.
    return gated;
}

/**
 * The workspace's own line about being out of touch with the machine.
 *
 * It reads the KISSOPEN Agent directory rather than any one surface, because losing the
 * machine is not a fact about a surface: every project, session, and terminal in
 * the workspace is equally out of reach, and saying so once at the top beats
 * saying it on each of them.
 *
 * It belongs to the workspace and settings alone. Every screen before them —
 * the welcome, first-run setup, choosing where KISSOPEN runs, starting, failing to
 * start, a protocol gap — is already the window's whole account of a machine
 * that is not connected, and a band repeating it above them would be a second
 * voice talking over the one the reader is meant to act on.
 *
 * Only a Kissopen Agent that has actually dropped gets a line. `connecting` is deliberately
 * silent — that is startup, and the boot cover is already speaking for it; a
 * band that appeared during every launch would mean nothing by the time it
 * mattered.
 */
function DesktopConnectionHeader(props: {
    platform: "desktop" | "web";
    kissopenAgents: KissopenAgentDirectoryStore;
    windowState: KissopenAgentWindowStore;
}) {
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const windowState = useSyncExternalStore(
        props.windowState.subscribe,
        props.windowState.get,
        props.windowState.get,
    );
    const lost = directory.kissopenAgents.find(
        (kissopenAgent) =>
            kissopenAgent.status === "disconnected" || kissopenAgent.status === "error",
    );
    if (!lost) return null;
    return (
        <ConnectionHeader
            message={lost.message ?? `${lost.label} is unreachable.`}
            // An error has settled; a disconnect is still being retried by the
            // connection's own backoff, and the spinner is the difference.
            retrying={lost.status === "disconnected"}
            // Only the Electron window hides its title bar and so hands this
            // band the traffic lights; the browser development server draws web
            // chrome above it and needs neither the inset nor the drag lane.
            windowControls={props.platform === "desktop"}
            // Full screen takes the lights away, and a connection rail beside
            // this band holds their lane instead; either way the band shaped
            // around them has to hear it, and no store the band could read
            // reports it, and no CSS query asks it.
            windowFullScreen={windowState.fullScreen || windowState.connectionRail}
        />
    );
}

/**
 * The whole window while the local machine's Kissopen Agent is being replaced.
 *
 * This is the entire tree for as long as a restart runs — not a screen over the
 * app, but the app's replacement. It renders one thing from one store, and that
 * store reaches the main process directly, so nothing here depends on a KISSOPEN Agent, a
 * session, a project, or a connection. That is what lets the rest be thrown
 * away: there is nothing left holding a reference to the machine going down.
 *
 * Only ever the local host. A KISSOPEN Agent on another machine is restarted by whoever
 * owns it and never touches this window.
 */
function DesktopAgentRestartWindow(props: {
    daemon: AppKissopenAgentDaemonStore;
    view: AgentInstallView;
}) {
    return (
        <AgentInstallScreen
            onDismiss={props.daemon.daemonInstallDismiss}
            onKill={props.daemon.daemonInstallKill}
            view={props.view}
        />
    );
}

/**
 * The window when this build and the host's Kissopen Agent cannot read each other.
 *
 * Every other unavailability in Kissopen belongs beside the Kissopen Agent it affects, and
 * this one deliberately does not. A version gap is not a connection that might
 * come back: the daemon is up, answering, and speaking a protocol this build has
 * no code for, so nothing behind this screen would work and nothing anyone does
 * in it would change that. Waiting is not one of the options, which is why it is
 * not shown as a state to wait in.
 *
 * It is the host alone. A node with the same gap is one machine of several
 * whose work is missing while the rest of the app still does its job, so that
 * stays a notice beside that node.
 */
function DesktopProtocolGate(props: {
    children: ReactNode;
    daemon?: AppKissopenAgentDaemonStore;
    /** False while the runtime still owns the window with a screen of its own. */
    ready: boolean;
    kissopenAgents: KissopenAgentDirectoryStore;
}) {
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const daemonStore = props.daemon ?? unavailableDaemonStore;
    const daemon = useSyncExternalStore(daemonStore.subscribe, daemonStore.get, daemonStore.get);
    const mismatch = props.ready
        ? directory.kissopenAgents.find(
              (kissopenAgent) => kissopenAgent.id === LOCAL_KISSOPEN_AGENT_ID,
          )?.protocolMismatch
        : undefined;
    if (!mismatch) return <>{props.children}</>;
    const upgrading = daemon.operation === "upgrading";
    return (
        <SetupPage
            {...(daemon.updateAvailable || upgrading
                ? {
                      action: {
                          busy: upgrading,
                          label: upgrading
                              ? t("Updating KissOpen Agent…")
                              : t("Update to {latest}", {
                                    latest: daemon.availableVersion ?? "latest",
                                }),
                          onSelect: daemonStore.daemonUpgrade,
                          width: 280,
                      },
                  }
                : {})}
            copy={`${mismatch.message} ${
                !daemon.managed
                    ? t(
                          "This daemon is supplied by an external development environment; update it there and reconnect.",
                      )
                    : daemon.error
                      ? t("KissOpen could not check for its update: {error}", {
                            error: daemon.error,
                        })
                      : daemon.updateAvailable || upgrading
                        ? t("Install the verified update to reconnect with the current protocol.")
                        : t("KissOpen is checking for a compatible update automatically.")
            }`}
            data-testid="desktop-protocol-screen"
            figure="secretary"
            title={t("KissOpen Agent is out of date")}
        />
    );
}

const unavailableDaemonSnapshot = {
    install: { phase: "idle" },
    managed: false,
    operation: "idle",
    runtime: "stopped",
    updateAvailable: false,
    versions: [],
} as const;
const unavailableDaemonStore: AppKissopenAgentDaemonStore = {
    daemonCheck: () => undefined,
    daemonInstall: () => undefined,
    daemonInstallDismiss: () => undefined,
    daemonInstallKill: () => undefined,
    daemonRestart: () => undefined,
    daemonUpgrade: () => undefined,
    daemonVersionSelect: () => undefined,
    get: () => unavailableDaemonSnapshot,
    subscribe: () => () => undefined,
};

function DesktopRuntimeContent(
    props: DesktopRendererProps & {
        hostedUpdate: LocalWebUpdateSnapshot;
        snapshot: DesktopRuntimeSnapshot | undefined;
    },
) {
    const { hostedUpdate, snapshot } = props;
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const materialized = directory.kissopenAgents.some((entry) => entry.session !== undefined);
    if (!snapshot && !materialized)
        return (
            <DesktopStartupScreen
                message={t("Reading desktop settings…")}
                onChange={() => undefined}
                onSubmit={() => undefined}
                phase="starting"
                values={desktopStartupValues()}
            />
        );
    if (snapshot?.phase === "choosing" && !materialized)
        return (
            <ChoosingScreen
                bridge={props.bridge}
                update={snapshot.update}
                values={props.startupValues}
            />
        );
    if (snapshot?.phase === "starting" && !materialized)
        return (
            <DesktopStartupScreen
                message={snapshot.message}
                onChange={() => undefined}
                onInstallUpdate={() => desktopAction(props.bridge.updateInstall())}
                onSubmit={() => undefined}
                phase="starting"
                update={snapshot.update}
                values={desktopStartupValues(snapshot.request)}
            />
        );
    if (snapshot?.phase === "error" && !materialized)
        return (
            <DesktopStartupScreen
                error={snapshot.message}
                onChange={() => undefined}
                onInstallUpdate={() => desktopAction(props.bridge.updateInstall())}
                onRetry={
                    snapshot.retryable
                        ? () => desktopAction(props.bridge.runtimeRetry())
                        : undefined
                }
                onSubmit={() => undefined}
                phase="error"
                update={snapshot.update}
                values={desktopStartupValues(snapshot.request)}
            />
        );

    // The workspace is mounted, so this is the first screen a dropped machine
    // can be reported against: the band is its outermost row and moves every
    // surface in it down rather than covering any of them.
    return (
        <div className="kissopen-connection-frame">
            <DesktopConnectionHeader
                platform={props.platform}
                kissopenAgents={props.kissopenAgents}
                windowState={props.windowState}
            />
            <div className="kissopen-connection-frame__body">
                <KissopenAgentBoundary
                    communityAccount={props.communityAccount}
                    appearance={props.appearance}
                    bridge={props.bridge}
                    commandPalette={props.commandPalette}
                    {...(props.daemon ? { daemon: props.daemon } : {})}
                    debug={props.debug}
                    {...(props.performance ? { performance: props.performance } : {})}
                    profiler={props.profiler}
                    browserContent={props.browserContent}
                    browserAutomation={props.browserAutomation}
                    htmlPreview={props.htmlPreview}
                    mediaWindow={props.mediaWindow}
                    documentConversion={props.documentConversion}
                    experiments={props.experiments}
                    navigationOrder={props.navigationOrder}
                    sidebarCollapse={props.sidebarCollapse}
                    sidebarVisibility={props.sidebarVisibility}
                    platform={props.platform}
                    router={props.kissopenAgentRouter}
                    kissopenAgents={props.kissopenAgents}
                    settings={props.settings}
                    titleShimmer={props.titleShimmer}
                    update={snapshot ? workspaceUpdate(snapshot.update, hostedUpdate) : undefined}
                    {...(snapshot ? { application: applicationIdentity(snapshot.update) } : {})}
                    onApplicationInstall={() => desktopAction(props.bridge.updateInstall())}
                    windowState={props.windowState}
                />
            </div>
        </div>
    );
}

// A shared dev server may also be loaded inside Electron. Its real preload
// bridge takes precedence over the browser-only meta tag, including for
// native window chrome, file picking and browser capabilities.
const browserLocal =
    !window.kissopenDesktop &&
    document.querySelector('meta[name="kissopen-browser-local"]')?.getAttribute("content") === "1";
const bridge = window.kissopenDesktop ?? (browserLocal ? browserDevBridgeCreate() : undefined);
const root = createRoot(document.getElementById("root")!);

/* The View menu owns zooming, so `bridge` is the only thing that hears of it.
   What is counted is how many times zoom was asked for, not what it came to:
   the count is the React key, so pressing ⌘0 twice at 100% shows the read-out
   twice, where keying on the percentage would remount nothing the second time
   and leave the fade to finish silently. Zero asks is a cold start, which shows
   nothing. The percentage is written in the same tick as the count. */
let zoomAsks = 0;
let zoomPercent = 100;
const zoomSubscribe = (listener: () => void) => {
    if (!bridge) return () => {};
    return bridge.zoomSubscribe((percent) => {
        zoomAsks += 1;
        zoomPercent = percent;
        listener();
    });
};

function DesktopZoomIndicator(): ReactNode {
    const asks = useSyncExternalStore(zoomSubscribe, () => zoomAsks);
    return asks === 0 ? undefined : <ZoomIndicator key={asks} percent={zoomPercent} />;
}
// The preview window is this same document, launched with the reduced bridge and
// loaded with the view it should mount. Deciding it here rather than after a
// round trip means the first frame is already the file instead of the whole
// application appearing for a beat.
const mediaPreviewBridge =
    new URLSearchParams(location.search).get(mediaPreviewView.key) === mediaPreviewView.value
        ? window.kissopenMediaPreview
        : undefined;
// The bar is the same document too, decided the same way and for the same
// reason: it stands over somebody else's screen, and a beat of the whole
// application appearing there first would be the wrong thing entirely.
const quickBarBridge =
    new URLSearchParams(location.search).get(quickBarView.key) === quickBarView.value
        ? window.kissopenQuickBar
        : undefined;
if (quickBarBridge) {
    const barBridge = quickBarBridge;
    document.documentElement.dataset.kissopenSurface = "overlay";
    root.render(
        <DesktopAppearance appearance={appearanceStoreCreate()}>
            <QuickBarSurface bridge={barBridge} />
        </DesktopAppearance>,
    );
} else if (mediaPreviewBridge) {
    const previewBridge = mediaPreviewBridge;
    desktopMediaPreviewEscapeBind(previewBridge);
    root.render(
        <DesktopAppearance appearance={appearanceStoreCreate()}>
            <DesktopMediaPreviewWindow store={desktopMediaPreviewStoreCreate(previewBridge)} />
        </DesktopAppearance>,
    );
} else if (bridge) {
    const desktopBridge = desktopBrowserMessageBridge(bridge);
    // Unsupported commercial document conversion is an explicit failure,
    // never an implicit request using the commercial account credential.
    const kissopenRequest = async (
        path: string,
        method: "GET" | "POST" = "GET",
        body?: Readonly<Record<string, unknown>>,
    ): Promise<{ status: number; text: string }> => {
        // Whatever goes wrong on the way is said in a sentence a person can act on.
        try {
            return await kissopenRequestSend(path, method, body);
        } catch (error) {
            throw kissopenRequestFailure(error);
        }
    };
    const kissopenRequestSend = async (
        path: string,
        method: "GET" | "POST",
        body?: Readonly<Record<string, unknown>>,
    ): Promise<{ status: number; text: string }> => {
        if (!desktopBridge.kissopenRequest)
            throw new Error(t("账号服务暂时无法连接，请稍后重试。"));
        return desktopBridge.kissopenRequest({ path, method, ...(body ? { body } : {}) });
    };

    // Documents no viewer here reads, shown as the PDF the account's server makes.
    const documentConversion = documentConversionOpenerCreate(kissopenRequest);

    const guestKeyUnsubscribe = desktopBridge.guestKeySubscribe((input: DesktopGuestKeyEvent) => {
        window.dispatchEvent(
            new KeyboardEvent(input.type, {
                altKey: input.altKey,
                bubbles: true,
                cancelable: true,
                code: input.code,
                ctrlKey: input.ctrlKey,
                isComposing: input.isComposing,
                key: input.key,
                location: input.location,
                metaKey: input.metaKey,
                repeat: input.repeat,
                shiftKey: input.shiftKey,
            }),
        );
    });
    window.addEventListener("unload", guestKeyUnsubscribe, { once: true });
    /** Window-owned stores shared by every independently retained connection UI. */
    interface DesktopShellStores {
        readonly appearance: AppearanceStore;
        readonly daemon?: AppKissopenAgentDaemonStore;
    }
    let shell: DesktopShellStores | undefined;
    /** Registrations outside React live until the window closes, including across daemon restarts. */
    const appDisposers: (() => void)[] = [];
    const appDispose = (): void => {
        for (const dispose of appDisposers.splice(0)) dispose();
    };
    window.addEventListener("unload", appDispose, { once: true });
    const start = (config: DesktopConfig): void => {
        const runtimeStore = desktopRuntimeStoreCreate(desktopBridge);
        // Whether this machine's owner has been welcomed. Acknowledging this
        // deck enters machine setup; it does not wait for machine work to finish.
        const welcome = welcomeStoreCreate(desktopWelcomePersistence());
        // The local router outlives any single daemon connection, so it is created
        // here and the session store navigates through it when a conversation it
        // created should be opened.
        const kissopenAgentHistory = kissopenAgentHistoryCreate({
            browser: false,
            persistence: desktopHistoryPersistence(),
        });
        const kissopenAgentRouter = kissopenAgentRouterCreate(kissopenAgentHistory);
        const accountOrigin =
            import.meta.env.VITE_KISSOPEN_COMMUNITY_AUTH_URL || "https://kissopen.com";
        const sessionRequest = async <T,>(
            path: string,
            method: "GET" | "POST" = "GET",
            body?: Readonly<Record<string, unknown>>,
        ): Promise<T> => {
            const response = await kissopenRequest(path, method, body);
            const data = JSON.parse(response.text) as T & { error?: string };
            if (response.status !== 200) throw new Error(data?.error || t("账号服务暂不可用"));
            return data;
        };
        const communityAccount = new CommunityAccount(new CommunityAuthClient(accountOrigin), {
            securityRequest: (path, body) => sessionRequest(path, body ? "POST" : "GET", body),
            securityUsernameSaved: () => accountStore.profileLoad(),
            open: (url) => desktopBridge.linkOpen(url),
            sessionRead: () => sessionRequest<CommunityProfile | null>("/auth/community/session"),
            sessionAccept: (token) =>
                sessionRequest<CommunityProfile>("/auth/community", "POST", { token }),
            sessionClear: async () => {
                await sessionRequest("/auth/logout", "POST", {});
                accountStore.accountSessionEnd();
            },
        });
        const accountStore = new KissopenStore({
            request: kissopenRequest,
            openUrl: async (url) => {
                await desktopBridge.linkOpen(url);
            },
            downloadText: async (name, text) => {
                const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = name;
                link.click();
                URL.revokeObjectURL(url);
            },
            signedOut: () => communityAccount.signOut(),
        });
        const localPlugins = new LocalPluginsStore(kissopenRequest);
        appDisposers.push(
            scheduleDraftSubscribe(() => {
                const draft = scheduleDraftTake();
                if (draft) accountStore.scheduleProposalOpen(draft);
            }),
            scheduleFocusSubscribe(() => {
                const id = scheduleFocusTake();
                if (id) accountStore.scheduleResultOpen(id);
            }),
        );
        // The shell's Back and Forward arrive as a direction and are walked here.
        appDisposers.push(
            desktopBridge.navigationStepSubscribe((step) => {
                const history = activeRouter().history;
                if (step.direction === "back") history.back();
                else history.forward();
            }),
        );
        // Chromium acts on macOS side buttons after mouseup, before auxclick is
        // guaranteed to arrive. Claim them in capture so only our stack moves.
        const sideButtonWalk = (event: MouseEvent): void => {
            if (event.button !== 3 && event.button !== 4) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const history = activeRouter().history;
            if (event.button === 3) history.back();
            else history.forward();
        };
        window.addEventListener("mouseup", sideButtonWalk, { capture: true });
        appDisposers.push(() =>
            window.removeEventListener("mouseup", sideButtonWalk, { capture: true }),
        );
        // Appearance, title motion, and model choices share one durable desktop
        // document. The adapter keeps its current value synchronous so writes
        // from any product store preserve changes already made by the others.
        const preferences = desktopPreferencesCreate(desktopBridge, config);
        // The saved choice is the authority; the renderer's startup copy only
        // exists to be readable before anything loads. When they disagree (a
        // cleared cache, a choice made elsewhere), adopt the saved one once.
        if (preferences.language !== localePreferenceRead()) {
            try {
                window.localStorage.setItem(LOCALE_STORAGE_KEY, preferences.language);
                if (window.localStorage.getItem(LOCALE_STORAGE_KEY) === preferences.language)
                    window.location.reload();
            } catch {
                // Without storage the window stays in the language it started in.
            }
        }
        localePreferenceBind(
            preferences.language,
            (next) => void preferences.languageChanged(next),
        );
        // Appearance is chosen for the window and shared by all connection UIs.
        shell ??= ((): DesktopShellStores => {
            const created = appearanceStoreCreate({
                mode: preferences.initialAppearance,
                scrollbarVisibility: preferences.initialScrollbarVisibility,
            });
            desktopAppearanceSynchronize(created, desktopBridge);
            created.subscribe(() => {
                const snapshot = created.get();
                preferences.appearanceChanged(snapshot.mode, snapshot.scrollbarVisibility);
            });
            const store = browserLocal ? undefined : desktopDaemonStoreCreate(desktopBridge);
            return { appearance: created, ...(store ? { daemon: store } : {}) };
        })();
        const { appearance, daemon } = shell;
        const debug = desktopDebugStoreCreate(desktopBridge);
        const livePerformance = desktopBridge.debugMetricsEnabled
            ? desktopMetricsStoreCreate()
            : undefined;
        const profiler = desktopProfilerStoreCreate(desktopBridge);
        // The main connection keeps the existing desktop defaults. Remote UIs
        // receive their own settings and model preference persistence below.
        const settings = kissopenAgentSettingsStoreCreate(preferences.initialSettings);
        appDisposers.push(settings.subscribe(() => preferences.settingsChanged(settings.get())));
        // How the reader arranged the sidebar's pinned rows. It is the window's
        // Those rows are window chrome whether or not any machine is reachable,
        // so the arrangement must outlive every connection this window makes.
        const navigationOrder = kissopenAgentNavigationOrderStoreCreate(
            desktopNavigationOrderPersistence(),
        );
        // Which projects the reader folded shut, kept beside that arrangement
        // and for the same reason: a fold is about this window's
        // sidebar, so no machine coming or going may undo it.
        const sidebarCollapse = kissopenAgentSidebarCollapseStoreCreate(
            desktopSidebarCollapsePersistence(),
        );
        // Whether the window's left side — sidebar and connection rail — is
        // folded away. Also the window's own: switching machines does not
        // bring the sidebar back, and the rail beside it goes with it.
        const sidebarVisibility = kissopenAgentSidebarVisibilityStoreCreate();
        // Whether this window offers the features that are not finished yet. It
        // is kept beside the arrangement above and for the same reason: it says
        // what this installation shows, so no machine has a say in it.
        const experiments = experimentsStoreCreate(desktopExperimentsPersistence());
        // Active-title motion is also this window's own choice. The store keeps
        // the product default in memory and writes only after the reader changes
        // the switch, so untouched installations follow future defaults.
        const titleShimmer = titleShimmerStoreCreate(preferences.titleShimmerPersistence);
        // What the command palette is currently showing and asking. It is this
        // window's transient view state, so it is created here beside the other
        // window-lifetime stores and deliberately given nothing to persist: an
        // open palette is a question in progress, not a place to come back to.
        const commandPalette = commandPaletteStoreCreate();
        const connectionUis = new Map<string, DesktopConnectionUi>();
        const auth = desktopCloudAuthRouterCreate(desktopBridge, (id) => {
            kissopenAgents.kissopenAgentActivate(id);
            const history = connectionUis.get(id)?.router.history;
            if (history && history.location.pathname !== "/settings/account")
                history.replace("/settings/account");
        });
        appDisposers.push(auth.dispose);
        const connectionPreferences = new Map<string, KissopenAgentModelPreferencePersistence>([
            [LOCAL_KISSOPEN_AGENT_ID, preferences.preferencePersistence],
        ]);
        const preferencesFor = (id: string): KissopenAgentModelPreferencePersistence => {
            let value = connectionPreferences.get(id);
            if (!value) {
                value = desktopConnectionPreferencesCreate(id);
                connectionPreferences.set(id, value);
            }
            return value;
        };
        // Every Kissopen Agent in this window, each with its own product stores. The router is
        // told to resolve its address again whenever the set of connected Kissopen Agents
        // changes, so a machine that connects after the URL already named it opens
        // the addressed conversation without the reader navigating twice.
        const kissopenAgents = kissopenAgentDirectoryStoreCreate(desktopBridge, runtimeStore, {
            cloudHostFor: auth.hostFor,
            connectLegacyCli: window.kissopenDesktop?.legacyCliConnect,
            prepareLegacyCli: window.kissopenDesktop?.legacyCliPrepare,
            conversationOpen: (kissopenAgentId, location) =>
                kissopenAgentRouterConversationOpen(
                    connectionUis.get(kissopenAgentId)?.router ?? kissopenAgentRouter,
                    kissopenAgentId,
                    location,
                ),
            groupOpen: (kissopenAgentId, groupId) =>
                kissopenAgentRouterGroupOpen(
                    connectionUis.get(kissopenAgentId)?.router ?? kissopenAgentRouter,
                    kissopenAgentId,
                    groupId,
                ),
            createOpen: (kissopenAgentId) =>
                kissopenAgentRouterCreateOpen(
                    connectionUis.get(kissopenAgentId)?.router ?? kissopenAgentRouter,
                    kissopenAgentId,
                ),
            groupForget: (kissopenAgentId, groupId) =>
                kissopenAgentRouterGroupForget(
                    connectionUis.get(kissopenAgentId)?.router ?? kissopenAgentRouter,
                    kissopenAgentId,
                    groupId,
                ),
            modelPreferencePersistence: preferencesFor,
            // Remote connections ride through the local daemon, so a local
            // restart must degrade the local surface alone rather than pruning
            // the remotes off the rail the instant the daemon reports an empty
            // registry on its way back up.
            ...(daemon ? { localRestarting: () => daemon.get().install.phase !== "idle" } : {}),
            // A shell is told which background it is drawing on when it starts and
            // never hears about it again, so every terminal takes the appearance
            // showing at the moment it is opened and keeps it.
            terminalColorScheme: () => appearance.get().appearance,
        });
        const localLibrary = localLibraryStoreCreate({
            subscribe: kissopenAgents.subscribe,
            get: () => {
                const entry = kissopenAgents
                    .get()
                    .kissopenAgents.find((agent) => agent.id === LOCAL_KISSOPEN_AGENT_ID);
                const workspace = entry?.session?.workspace;
                return {
                    visible: document.visibilityState === "visible",
                    ready:
                        entry?.status === "connected" &&
                        !!workspace &&
                        entry.projectsStatus === "ready",
                    ...(entry?.status === "error" ||
                    entry?.status === "disconnected" ||
                    entry?.projectsStatus === "error"
                        ? { error: t("本地 Agent 尚未连接，资料库中的文件仍保存在本机。") }
                        : {}),
                    projects: workspace
                        ? entry!.projects
                              .filter((project) => project.kind === "regular")
                              .map((project) => ({
                                  id: project.id,
                                  name: project.name,
                                  read: (folder: string) =>
                                      workspace.projectFolderRead(project.id, folder),
                                  open: (filePath: string) => {
                                      const preview = filePreviewKind(filePath);
                                      const fileKind =
                                          preview === "html"
                                              ? "document"
                                              : preview === "text" || preview === "markdown"
                                                ? "file"
                                                : "media";
                                      kissopenAgents.kissopenAgentActivate(LOCAL_KISSOPEN_AGENT_ID);
                                      kissopenAgentRouterFileOpen(
                                          connectionUis.get(LOCAL_KISSOPEN_AGENT_ID)?.router ??
                                              kissopenAgentRouter,
                                          LOCAL_KISSOPEN_AGENT_ID,
                                          project.id,
                                          filePath,
                                          fileKind,
                                      );
                                      accountStore.tabSelect("workspace");
                                  },
                                  thumbnail: async (filePath: string) => {
                                      const mime = libraryImageType(filePath);
                                      if (!mime) return undefined;
                                      const image = await workspace.pictureRead(
                                          project.id,
                                          filePath,
                                          mime,
                                      );
                                      return image ? libraryThumbnail(image) : undefined;
                                  },
                              }))
                        : [],
                };
            },
        });
        const windowState = windowStateStoreCreate(desktopBridge);
        // What the surfaces lay out against: the window itself, or the
        // closed-inset arrangement while the rail owns the window's left edge.
        const surfaceWindowState = surfaceWindowStateStoreCreate({
            windowState,
            sidebarVisibility,
            kissopenAgents,
        });
        // The restart screen outlives the main process's report of the restart
        // until this window has reconnected and read the catalog again.
        const restart = desktopRestartStoreCreate({
            daemon: daemon ?? unavailableDaemonStore,
            kissopenAgents,
        });
        function activeRouter(): KissopenAgentRouter {
            return (
                connectionUis.get(
                    kissopenAgents.get().activeKissopenAgentId ?? LOCAL_KISSOPEN_AGENT_ID,
                )?.router ?? kissopenAgentRouter
            );
        }
        // Native first-run setup retains its lifetime, while mobile pairing uses
        // the same local connection store and transport as the workspace.
        const onboardingStore = localOnboardingStoreCreate(desktopBridge, {
            agentSetupActive: welcome.get().agentSetupChosen,
            chiefOfStaff: {
                get: () => {
                    const entry = kissopenAgents
                        .get()
                        .kissopenAgents.find(
                            (candidate) => candidate.id === LOCAL_KISSOPEN_AGENT_ID,
                        );
                    return entry?.status === "connected" ? entry.session?.workspace : undefined;
                },
                subscribe: kissopenAgents.subscribe,
            },
            chiefOfStaffPrepare: async () => {
                const session = kissopenAgents
                    .get()
                    .kissopenAgents.find((entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID)?.session;
                const bot = session?.workspace
                    .get()
                    .list.bots.find((entry) => entry.systemKey === "chief_of_staff");
                if (!session || !bot) throw new Error(t("小秘书还没准备好，稍后再试。"));
                const location = await session.workspace.sessionLocationRead(
                    bot.conversation.id as KissopenAgentSessionId,
                );
                if (!location) throw new Error(t("小秘书的对话还没准备好。"));
                await session.workspace.draftAppend(
                    location.sessionId,
                    "Help me get started with KissOpen. Let’s choose one project or create a new one, " +
                        "then make one small change together. Ask before looking for local projects " +
                        "or changing anything.",
                );
                return () =>
                    kissopenAgentRouterConversationOpen(
                        connectionUis.get(LOCAL_KISSOPEN_AGENT_ID)?.router ?? kissopenAgentRouter,
                        LOCAL_KISSOPEN_AGENT_ID,
                        location,
                    );
            },
            kissopenMobile: {
                get: () =>
                    kissopenAgents
                        .get()
                        .kissopenAgents.find((entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID)
                        ?.session?.onboarding?.mobile,
                subscribe: kissopenAgents.subscribe,
            },
        });
        const uisReconcile = (): void => {
            const entries = kissopenAgents.get().kissopenAgents;
            for (const entry of entries) {
                if (connectionUis.has(entry.id)) continue;
                connectionUis.set(
                    entry.id,
                    desktopConnectionUiCreate({
                        id: entry.id,
                        directory: kissopenAgents,
                        preferences: preferencesFor(entry.id),
                        sidebarVisibility,
                        ...(entry.id === LOCAL_KISSOPEN_AGENT_ID
                            ? {
                                  main: {
                                      router: kissopenAgentRouter,
                                      settings,
                                      commandPalette,
                                      navigationOrder,
                                      sidebarCollapse,
                                  },
                              }
                            : {}),
                    }),
                );
            }
            for (const [id, ui] of connectionUis) {
                if (entries.some((entry) => entry.id === id)) continue;
                ui.dispose();
                connectionUis.delete(id);
            }
        };
        appDisposers.push(kissopenAgents.subscribe(uisReconcile));
        uisReconcile();
        appDisposers.push(() => {
            for (const ui of connectionUis.values()) ui.dispose();
            connectionUis.clear();
        });
        let materialized = "";
        appDisposers.push(
            kissopenAgents.subscribe(() => {
                const current = kissopenAgents
                    .get()
                    .kissopenAgents.map(
                        (kissopenAgent) =>
                            `${kissopenAgent.id}:${kissopenAgent.session ? "up" : "down"}`,
                    )
                    .join(",");
                if (current === materialized) return;
                materialized = current;
                void kissopenAgentRouter.invalidate();
            }),
        );
        // What is waiting for the person is a fact about the whole window, not
        // about the screen that happens to be open, so the Dock is marked from
        // the same directory the sidebar reads rather than from any one Kissopen Agent.
        appDisposers.push(
            dockUnreadPublish(kissopenAgents, (count) => desktopBridge.dockUnreadSet(count)),
        );
        // This window renders the Kissopen Agent tree directly rather than through `App`, so
        // it has to start the highlighting pool itself: without this the file
        // viewer and every diff in the primary desktop surface tokenize on the
        // main thread, which is exactly where a large file must not be parsed.
        root.render(
            <DesktopAppearance appearance={appearance}>
                <DesktopZoomIndicator />
                <AppCommunityAccountBoundary account={communityAccount}>
                    <CodeHighlightWorkers>
                        <KissopenView
                            store={accountStore}
                            communityAuthenticated
                            localLibrary={
                                <LocalLibraryView store={localLibrary} account={accountStore} />
                            }
                            plugins={<LocalPluginsView store={localPlugins} />}
                            scheduledTasks={
                                <DesktopScheduledTasks
                                    request={kissopenRequest}
                                    directory={kissopenAgents}
                                    account={accountStore}
                                />
                            }
                            appearance={appearance}
                            windowState={surfaceWindowState}
                            platform={browserLocal ? "web" : "desktop"}
                            onFileOpen={({ url, name }) =>
                                desktopBridge.kissopenFileOpen(url, name)
                            }
                        >
                            <DesktopRenderer
                                communityAccount={communityAccount}
                                connectionUis={connectionUis}
                                appearance={appearance}
                                commandPalette={commandPalette}
                                {...(daemon ? { daemon } : {})}
                                debug={debug}
                                {...(livePerformance ? { performance: livePerformance } : {})}
                                profiler={profiler}
                                onboarding={onboardingStore}
                                browserContent={
                                    browserLocal ? undefined : desktopBrowserContentRender
                                }
                                browserAutomation={
                                    browserLocal ? undefined : desktopBrowserAutomationRender
                                }
                                htmlPreview={browserLocal ? undefined : desktopHtmlPreviewRender}
                                bridge={desktopBridge}
                                mediaWindow={
                                    browserLocal ? undefined : desktopMediaWindowOpen(desktopBridge)
                                }
                                documentConversion={documentConversion}
                                experiments={experiments}
                                navigationOrder={navigationOrder}
                                sidebarCollapse={sidebarCollapse}
                                sidebarVisibility={sidebarVisibility}
                                // Only the Electron window hides its title bar; the browser
                                // development server renders the same tree with web chrome.
                                platform={browserLocal ? "web" : "desktop"}
                                kissopenAgentRouter={kissopenAgentRouter}
                                kissopenAgents={kissopenAgents}
                                localWebUpdate={localWebUpdateStoreCreate(localWebBuild)}
                                settings={settings}
                                titleShimmer={titleShimmer}
                                startupValues={startupValuesStoreCreate()}
                                store={runtimeStore}
                                welcome={welcome}
                                windowState={windowState}
                                surfaceWindowState={surfaceWindowState}
                                restart={restart}
                            />
                        </KissopenView>
                    </CodeHighlightWorkers>
                </AppCommunityAccountBoundary>
            </DesktopAppearance>,
        );
    };
    void desktopBridge.desktopConfigGet().then(start, (error: unknown) => {
        console.error("Could not read desktop preferences.", error);
        start({
            appearance: "system",
            defaultEffort: KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL,
            defaultPermissionMode: "auto",
            modelPreferences: [],
            scrollbarVisibility: "automatic",
            version: 1,
        });
    });
}
