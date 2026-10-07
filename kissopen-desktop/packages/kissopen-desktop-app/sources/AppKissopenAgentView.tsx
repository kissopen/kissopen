import {
    kissopenBoardKey,
    kissopenProjectSetupCard,
    t,
    type KissopenBoardPlace,
    type KissopenBoardTiming,
    type KissopenAgentFileUploadSnapshot,
    type KissopenAgentFileUploadStore,
    type Schedule,
} from "kissopen-desktop-state";
import { useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { type CloudDestinations, useCloudDestinations } from "./cloudDestinations";
import type {
    AppearanceStore,
    CommandPaletteStore,
    ConversationEntry,
    ComposerSnapshot,
    ExperimentsStore,
    ConversationToolCall,
    KissopenAgentClockStore,
    KissopenAgentCloudStore,
    KissopenAgentTeamsStore,
    KissopenAgentFileTabKind,
    KissopenAgentFileTabSnapshot,
    KissopenAgentConnectionStore,
    KissopenAgentDebugLogStore,
    KissopenAgentConversationSnapshot,
    KissopenAgentFileLayout,
    KissopenAgentWorkspaceFiles,
    KissopenAgentFileScope,
    KissopenAgentFileViewMode,
    KissopenAgentHost,
    KissopenAgentIntegrationStore,
    KissopenAgentGroupId,
    KissopenAgentMenusSnapshot,
    KissopenAgentModelStore,
    KissopenAgentModelSelection,
    KissopenAgentNavigationOrderStore,
    KissopenAgentSidebarCollapseStore,
    KissopenAgentSidebarVisibilityStore,
    KissopenAgentPanelSnapshot,
    KissopenAgentProjectAddSnapshot,
    KissopenAgentBotAddSnapshot,
    KissopenAgentPanelStore,
    KissopenAgentPanelTabId,
    KissopenAgentPanelTabSnapshot,
    KissopenAgentPermissionMode,
    KissopenAgentProfileStore,
    KissopenAgentInboxItem,
    KissopenAgentInboxSnapshot,
    KissopenAgentInboxStore,
    KissopenAgentInstructionsStore,
    KissopenAgentSecurityPolicyStore,
    KissopenAgentSecretsStore,
    KissopenAgentAvailabilitySnapshot,
    KissopenAgentProviderUsageStore,
    KissopenAgentProvidersStore,
    KissopenAgentBot,
    KissopenAgentBotSettingsSnapshot,
    KissopenAgentBotSettingsStore,
    KissopenAgentDocumentConversionOpener,
    KissopenAgentDocumentConversionStore,
    KissopenAgentGroupLifecycle,
    KissopenAgentProjectGroup,
    KissopenAgentProjectId,
    KissopenAgentServiceTier,
    KissopenAgentSessionCreateInput,
    KissopenAgentSessionId,
    KissopenAgentSessionSummary,
    ScrollbarVisibility,
    ThemeMode,
    SubagentSummary,
    KissopenAgentTerminalStore,
    KissopenAgentThinkingLevel,
    TitleShimmerStore,
    KissopenAgentWindowStore,
    KissopenAgentWorkspaceSnapshot,
    KissopenAgentWorkspaceStore,
    KissopenAgentWorkingWait,
    KissopenAgentWorktreeId,
    DictationSnapshot,
    DictationStore,
} from "kissopen-desktop-state";
import {
    KISSOPEN_AGENT_PANEL_FILE_VIEW_ID,
    agentAuthor,
    commandPaletteStoreNoop,
    experimentsStoreNoop,
    kissopenAgentInboxStoreNoop,
    kissopenAgentNavigationOrderApply,
    kissopenAgentAvailabilityProject,
    kissopenAgentNavigationOrderStoreNoop,
    kissopenAgentSidebarCollapseStoreNoop,
    kissopenAgentSidebarVisibilityStoreNoop,
    kissopenAgentHumanMessageAuthor,
    kissopenAgentSessionGroupIdOf,
    kissopenAgentOwnerAuthor,
    kissopenAgentWindowStoreNoop,
    titleShimmerStoreNoop,
} from "kissopen-desktop-state";
import {
    type AgentWaitStatus,
    AppShell,
    APP_SHELL_PANEL_DEFAULT_WIDTH,
    type AppShellFocusedPane,
    Banner,
    BrowserPanel,
    DevBuildMenu,
    type BrowserContentRenderer,
    HtmlPreviewFrame,
    type HtmlPreviewRenderer,
    type LivePerformanceStore,
    type MediaWindowOpener,
    Button,
    ChannelHeader,
    CommandPalette,
    CommandPaletteResults,
    type CommandPaletteResultsRow,
    type CommandPaletteResultsSection,
    commandPaletteResultsRows,
    ContextMeter,
    ChangedFileDiff,
    ComposerFooterBar,
    ComposerModelControl,
    ConversationView,
    DeferredPane,
    EmptyState,
    FileBrowser,
    FileEditor,
    FilePreview,
    FormRow,
    type FilePreviewKind,
    fileIsOfficeDocument,
    filePreviewKind,
    Lightbox,
    MarkdownDocument,
    MenuButton,
    Modal,
    ModalOverlay,
    KissopenAgentActivityControl,
    KissopenAgentActivityPanel,
    KissopenAgentControlMenu,
    fileTreeBuild,
    fileTreeExpanded,
    fileTreeFlatten,
    fileNameCompare,
    type FileTreeExpansion,
    type FileTreeBuildEntry,
    KissopenAgentCreateSessionPage,
    KissopenAgentProjectCloneDialog,
    KissopenAgentProjectSettingsDialog,
    KissopenAgentBotSettingsDialog,
    KissopenAgentSessionControls,
    type KissopenAgentUserInputAnswerMap,
    KissopenAgentUsagePanel,
    PanelHeader,
    QuickActionsCard,
    type QuickActionsCardItem,
    SegmentedControl,
    Sidebar,
    SidebarFooter,
    SidebarUpdateAction,
    Switch,
    KissopenAgentInboxPage,
    TabbedPane,
    TextField,
    TerminalPanel,
    ToolCallPreview,
    TransferZone,
    type TabTransferTarget,
    WindowDragRegion,
    kissopenAgentComposerModelControlProps,
    sidebarReorderMove,
    type MenuItem,
    type FileTreeNode,
    type KeyboardShortcut,
    type SidebarItem,
    type SidebarNumberShortcutTarget,
    type SidebarReorder,
    type SidebarSection,
    type TabItem,
    WindowShortcuts,
    WorkspaceLifecycleLane,
    WorkspaceLifecycleNotice,
    type WorkStartExample,
    type WorkspaceLifecyclePhase,
    type ComposerDictation,
    type FileBrowserUploadNotice,
} from "kissopen-desktop-ui";
import { APP_SHORTCUTS } from "./appShortcuts";
import { KissopenAgentVersionProvider } from "./KissopenAgentVersionProvider";
import {
    COMMAND_PALETTE_PREVIEW_LIMIT,
    commandPaletteIndexMove,
    commandPaletteResults,
    commandPaletteRowAt,
    commandPaletteSuggestionRows,
    type CommandPaletteCommand,
    type CommandPaletteContext,
    type CommandPaletteRow,
    type CommandPaletteSettingRow,
    type CommandPaletteTab,
} from "./commandPaletteResults";
import { openExternalLink } from "./externalLink";
import { reactFrameInputUpdate, reactFrameSubscribe } from "./reactFrameSubscribe";
import { BlueprintView } from "./views/BlueprintView";
import type {
    AppKissopenAgentDaemonSnapshot,
    AppKissopenAgentDaemonStore,
} from "./views/AppKissopenAgentSettingsView";

const sidebarDaemonUnavailable: AppKissopenAgentDaemonSnapshot = {
    install: { phase: "idle" },
    managed: false,
    operation: "idle",
    runtime: "stopped",
    updateAvailable: false,
    versions: [],
};

/** Stands in wherever no machine-local agent is managed, such as a browser. */
const sidebarDaemonStoreNoop: AppKissopenAgentDaemonStore = {
    daemonCheck: () => undefined,
    daemonInstall: () => undefined,
    daemonInstallDismiss: () => undefined,
    daemonInstallKill: () => undefined,
    daemonRestart: () => undefined,
    daemonUpgrade: () => undefined,
    daemonVersionSelect: () => undefined,
    get: () => sidebarDaemonUnavailable,
    subscribe: () => () => undefined,
};

/**
 * What the sidebar has to say about the agent, if anything.
 *
 * Only two things are worth a row: a version being fetched, and one already
 * fetched and waiting to be installed. A check finding nothing, or an agent
 * managed outside Kissopen, is not news and takes no space.
 */
function agentUpdateOffer(daemon: AppKissopenAgentDaemonSnapshot):
    | {
          readonly detail?: string;
          readonly status: "downloading" | "downloaded";
          readonly version: string;
      }
    | undefined {
    if (!daemon.managed || daemon.install.phase !== "idle") return undefined;
    if (daemon.readyVersion !== undefined)
        return { status: "downloaded", version: daemon.readyVersion };
    if (daemon.operation === "downloading" && daemon.availableVersion !== undefined) {
        return {
            ...(daemon.message ? { detail: daemon.message } : {}),
            status: "downloading",
            version: daemon.availableVersion,
        };
    }
    return undefined;
}

export interface AppKissopenAgentUpdate {
    readonly action: "refresh" | "restart";
    readonly detail?: string;
    readonly status: "available" | "downloading" | "downloaded";
    readonly version?: string;
}

/** One Kissopen Agent this window can address, with its own catalog and surface stores. */
export interface AppKissopenAgentEntry {
    readonly id: string;
    /** Host-published connection identity; absent only for the host itself. */
    readonly remoteId?: string;
    readonly label: string;
    readonly status: "connecting" | "connected" | "disconnected" | "error";
    readonly message?: string;
    readonly version?: string;
    readonly projects: readonly KissopenAgentProjectGroup[];
    /**
     * This Kissopen Agent's bots. They are listed under a heading of their own
     * above its projects and are not projects: a bot offers no
     * new-conversation control and no settings, because it is one permanent
     * conversation with nothing to configure.
     */
    readonly bots: readonly KissopenAgentBot[];
    readonly projectsStatus: "loading" | "ready" | "error";
    /**
     * Where adding a folder to this KISSOPEN Agent as a project stands. Absent on a host
     * that does not report it, which reads as nothing being added — the same way
     * a host with no live stores supplies no `session`.
     */
    readonly projectAdd?: KissopenAgentProjectAddSnapshot;
    readonly botAdd?: KissopenAgentBotAddSnapshot;
    /** The live stores for this KISSOPEN Agent, present once its connection is up. */
    readonly session?: AppKissopenAgentSession;
    /** Authenticated setup is available before protected product stores load. */
    readonly setup?: AppKissopenAgentSetup;
}

export interface AppKissopenAgentSetup {
    readonly welcome: import("kissopen-desktop-state").WelcomeStore;
    readonly onboarding: import("kissopen-desktop-state").KissopenAgentOnboardingStore;
    readonly profile: KissopenAgentProfileStore;
    readonly retry: () => void;
}

export interface AppKissopenAgentSession {
    readonly welcome?: import("kissopen-desktop-state").WelcomeStore;
    readonly onboarding?: import("kissopen-desktop-state").KissopenAgentOnboardingStore;
    readonly clock: KissopenAgentClockStore;
    readonly connection: KissopenAgentConnectionStore;
    /** This KISSOPEN Agent installation's WorkOS account. */
    readonly cloud?: () => KissopenAgentCloudStore;
    /** WorkOS organizations, available on agents with the Teams API. */
    readonly teams?: () => KissopenAgentTeamsStore;
    /** This Kissopen Agent's retained connection, reconciliation, and SSE diagnostics. */
    readonly debugLog?: KissopenAgentDebugLogStore;
    readonly host: KissopenAgentHost;
    /** This KISSOPEN Agent's own model catalog, read by the settings window's pickers. */
    readonly models: KissopenAgentModelStore;
    /** This KISSOPEN Agent installation's live Kissopen Mobile integration. */
    readonly kissopenIntegration?: () => KissopenAgentIntegrationStore;
    readonly workspace: KissopenAgentWorkspaceStore;
    /**
     * Every question this Kissopen Agent's agents are waiting on. Absent when the machine
     * offers no question feed, which is why the inbox row is absent too rather
     * than opening onto an empty queue that means nothing.
     */
    readonly inbox?: KissopenAgentInboxStore;
    /**
     * How much of each provider account's plan this machine has spent, read by
     * the Usage settings category. Absent when the machine reports no usage,
     * which leaves that category saying so rather than listing accounts that
     * mean nothing.
     */
    readonly providerUsage?: KissopenAgentProviderUsageStore;
    /** The identity this Kissopen Agent authors work as, as its profile settings edit it. */
    readonly profile?: () => KissopenAgentProfileStore | undefined;
    /**
     * Which model providers this machine will use, as the Providers settings
     * category reads and switches them. Absent on a host that cannot change the
     * machine's configuration, which leaves that category saying so.
     */
    readonly providers?: KissopenAgentProvidersStore;
    /** This KISSOPEN Agent's machine-wide instructions, as the settings window edits them. */
    readonly instructions?: KissopenAgentInstructionsStore;
    /** This Kissopen Agent's machine-wide permission-review policy. */
    readonly securityPolicy?: KissopenAgentSecurityPolicyStore;
    /** This KISSOPEN Agent's global write-only environment bundles. */
    readonly secrets?: () => KissopenAgentSecretsStore;
    /** The assistant settings dialog: one assistant's identity, person, and core files. */
    readonly botSettings?: () => KissopenAgentBotSettingsStore;
}

export interface AppKissopenAgentDirectorySnapshot {
    /**
     * The Kissopen Agent this window is addressing, as `kissopenAgentActivate` last recorded it. It
     * is the synchronous authority on which machine is on screen, for the
     * decisions that cannot be taken at render time — whether an agent's
     * contribution may still be performed when someone presses it. A host that
     * records no addressed KISSOPEN Agent supplies nothing here, and such a press is inert
     * rather than aimed at a guess.
     */
    readonly activeKissopenAgentId?: string;
    readonly kissopenAgents: readonly AppKissopenAgentEntry[];
}

/** The KISSOPEN Agents this window can address. */
export interface AppKissopenAgentDirectoryStore {
    get(): AppKissopenAgentDirectorySnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * Records which KISSOPEN Agent the window is addressing. The URL decides it; the store
     * is told so that window-level events with no KISSOPEN Agent of their own — a URL handed
     * to the app to open — land in the workspace on screen.
     */
    kissopenAgentActivate(id: string): void;
}

/**
 * What a development window calls itself: the worktree or branch it was built
 * from, and the checkout worth copying out of it. A packaged KISSOPEN supplies
 * none — the product has one identity and does not have to announce it.
 */
/**
 * The application's own identity and update state, as the settings page shows
 * them. Separate from `AppBuildIdentity`, which names a development build.
 */
export interface AppApplicationIdentity {
    readonly version: string;
    readonly updateStatus:
        | "idle"
        | "checking"
        | "available"
        | "downloading"
        | "downloaded"
        | "error";
    readonly availableVersion?: string;
    readonly message?: string;
}

export interface AppBuildIdentity {
    readonly branch: string;
    readonly label: string;
    readonly path: string;
}

export interface AppKissopenAgentViewProps {
    /** The host KISSOPEN Agent this window is an interface onto, and what it currently holds. */
    kissopenAgents: AppKissopenAgentDirectoryStore;
    /**
     * Speaking into a composer. Transcription belongs to the account, so the
     * host that reaches the account supplies this; absent, no composer here
     * draws a mic.
     */
    dictation?: DictationStore;
    /**
     * Opens Scheduled tasks with a task an assistant here proposed. Scheduled
     * tasks belong to the account rather than to this machine, so the host that
     * reaches the account supplies this; absent, a proposal is an ordinary row.
     */
    onScheduleProposalOpen?: (request: string) => void;
    /** Opens Scheduled tasks at a task the agent created, by its ID. */
    onScheduledTaskOpen?: (scheduleId: string) => void;
    /**
     * This build's development identity, shown in the sidebar footer menu.
     * Absent in the packaged product, where there is nothing to tell apart.
     */
    buildIdentity?: AppBuildIdentity;
    /** Live renderer diagnostics, supplied only by an explicitly debug-launched desktop window. */
    performance?: LivePerformanceStore;
    /** Which Kissopen Agent the URL addresses; its projects and sessions fill the window. */
    kissopenAgentId: string;
    /** Theme selection behind the sidebar footer's appearance toggle. */
    appearance: AppearanceStore;
    /**
     * Where this surface is running. In the Electron shell the window has no
     * native title bar, so the shell owns the traffic-light inset and the drag
     * lanes and the sidebar heading gives its space up to them; the browser
     * development mode keeps the ordinary branded heading.
     */
    platform?: "desktop" | "web";
    /**
     * The window's own chrome. Entering macOS full screen takes the traffic
     * lights away, so the lane reserved for them closes with them and the sidebar
     * toggle returns to the window's left edge. The browser shell supplies no
     * such store and stays windowed.
     */
    windowState?: KissopenAgentWindowStore;
    /**
     * Where this window remembers the order the reader arranged its pinned rows
     * in. A host that keeps no such record supplies none, and the rows stay in
     * the order the window offers them rather than being arrangeable into an
     * order the next launch would forget.
     */
    navigationOrder?: KissopenAgentNavigationOrderStore;
    /**
     * Where this window remembers which projects and folders the reader folded
     * shut. A host that keeps no such record supplies none, and every row stays
     * open rather than offering a fold the next launch would forget.
     */
    sidebarCollapse?: KissopenAgentSidebarCollapseStore;
    /**
     * Whether this window's left side — the sidebar and the connection rail
     * beside it — is folded away. It belongs to the window, so every
     * connection reads and writes the same fold. A host that supplies none
     * leaves the fold to this view alone.
     */
    sidebarVisibility?: KissopenAgentSidebarVisibilityStore;
    /**
     * Whether this window offers the features that are not finished yet. A host
     * that remembers no such choice supplies none, and they stay withheld.
     */
    experiments?: ExperimentsStore;
    /**
     * Whether running session, project, and workspace titles shimmer. A host
     * without this preference uses the current product default.
     */
    titleShimmer?: TitleShimmerStore;
    /**
     * What the command palette is showing and asking. A host that supplies none
     * has no palette, and Command-K does nothing rather than opening a surface
     * whose query nothing is keeping.
     */
    commandPalette?: CommandPaletteStore;
    /** Native or hosted-renderer update projected by the desktop host. */
    update?: AppKissopenAgentUpdate;
    /** Applies the ready update. Absent in a plain browser surface. */
    onUpdateApply?: () => void;
    /**
     * The machine-local Kissopen Agent, supplied only by the native desktop shell.
     * The sidebar reads it to offer a downloaded agent update; a browser surface
     * manages no agent and is given none.
     */
    daemon?: AppKissopenAgentDaemonStore;
    /** Native page renderer supplied only by the packaged Electron host. */
    browserContent?: BrowserContentRenderer;
    browserAutomation?: import("kissopen-desktop-ui").BrowserAutomationRenderer;
    /**
     * Renders one HTML workspace file as a page. Supplied only by a host with an
     * engine to run it in; without one an HTML file opens as its source.
     */
    htmlPreview?: HtmlPreviewRenderer;
    /**
     * Shows one workspace picture or recording in a window of the host's own.
     * Supplied only by a host that has such a window; without one the file stays
     * in place.
     */
    mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    documentConversion?: KissopenAgentDocumentConversionOpener;
    /**
     * The addressed group — a project or one of its worktrees — and conversation,
     * read from the route by the caller. This surface never decides what is
     * shown; it renders the addressed group's sessions and asks for a different
     * address through `onChatSelect`.
     */
    groupId?: string;
    chatId?: string;
    /**
     * Addresses a Kissopen Agent, a group in it, and optionally one of that group's
     * sessions; no group means that KISSOPEN Agent's list.
     */
    onChatSelect(
        kissopenAgentId: string,
        groupId: string | undefined,
        chatId?: string,
        replace?: boolean,
    ): void;
    /** Removes an archived session's dead destinations from Back/Forward history. */
    onChatClose?(
        kissopenAgentId: string,
        groupId: string,
        chatId: string,
        fallbackChatId?: string,
    ): boolean;
    /** Removes every history visit to a file tab that the reader closed. */
    onFileClose(kissopenAgentId: string, groupId: string, path: string): void;
    /**
     * Addresses a file tab over the session currently visible in its workspace.
     * An absent chat is the empty-workspace form of the same destination.
     */
    onFileSelect(
        kissopenAgentId: string,
        groupId: string,
        chatId: string | undefined,
        path: string,
        kind: KissopenAgentFileTabKind,
        replace?: boolean,
    ): void;
    /** Opens the local settings destination from the pinned sidebar footer. */
    onSettingsOpen(): void;
    /**
     * Opens one settings category by id, as the palette's settings rows name
     * them. Absent in a host whose settings surface has no sections of its own.
     */
    onSettingsSectionOpen?(section: string): void;
    /** Whether the URL addresses the addressed Kissopen Agent's Create surface. */
    createOpen?: boolean;
    /** Addresses that surface. Absent in a host with nowhere to put it. */
    onCreateOpen?(): void;
    /** Whether the URL addresses the addressed KISSOPEN Agent's inbox of agent questions. */
    inboxOpen?: boolean;
    /** Addresses that inbox. */
    onInboxOpen?(): void;
    /** Whether the URL addresses the enrolled account's friends surface. */
    /** Addresses that friends surface. */
    /** Whether the URL addresses the component workbench, in a development build. */
    blueprintOpen?: boolean;
    /** Addresses the workbench. */
    onBlueprintOpen?(): void;
}

/**
 * What the tab strip needs about the addressed group, flattened so a project and
 * a worktree open the same way. `create` is what a new session in it takes: the
 * project's root, or the worktree's checkout and its id.
 */
interface OpenGroup {
    readonly id: KissopenAgentGroupId;
    readonly name: string;
    /**
     * The catch-all project for sessions started outside any repository. It is
     * addressed as a place rather than as a path, so the surface names it by its
     * house glyph and never spells its `~` out.
     */
    readonly home: boolean;
    readonly conversations: KissopenAgentProjectGroup["conversations"];
    readonly changes: NonNullable<KissopenAgentProjectGroup["changes"]>;
    readonly changesStatus?: KissopenAgentProjectGroup["changesStatus"];
    readonly create?: KissopenAgentSessionCreateInput;
    /**
     * Where the open group's checkout is in its own life, for a worktree. A
     * project has none: it is a directory Kissopen Agent adopted rather than one it made,
     * so there is no moment at which it is being prepared.
     */
    readonly lifecycle?: KissopenAgentGroupLifecycle;
    /** The checkout's path, so a notice about it can name the directory. */
    readonly path: string;
}

const PANEL_TOGGLE_HINT = {
    aria: `${APP_SHORTCUTS.panelToggle.aria} ${APP_SHORTCUTS.panelToggleAlternate.aria}`,
    caps: APP_SHORTCUTS.panelToggle.caps,
} as const;
const HISTORY_SESSION_PREFIX = "session:";
/** The project's board, pinned first in its strip; no session has this id. */
const BOARD_TAB_ID = "board";
/** A board build is still coming while its run is in one of these. */
const BOARD_RUN_ACTIVE = new Set(["queued", "waiting_device", "accepted", "running", "needs_user"]);
const BOARD_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** When a project's board builds on its own, in words. */
function boardScheduleLabel(schedule: Schedule): string {
    const at = `${String(Math.floor(schedule.at_minute / 60)).padStart(2, "0")}:${String(schedule.at_minute % 60).padStart(2, "0")}`;
    const when =
        schedule.recurrence === "weekdays"
            ? t("工作日")
            : schedule.recurrence === "weekly"
              ? t(BOARD_WEEKDAYS[schedule.weekday] ?? "每周")
              : t("每天");
    return t("{when} {at} 自动更新", { when, at });
}

/**
 * The rows one project contributes: the project itself, then a nested row per
 * worktree that has work in it. A row is the project's name and its picture,
 * both the daemon's — derived from the git remote — so a reader recognizes a
 * repository at a glance. Its path is deliberately not here: it is long enough
 * to crowd out the name it is supposed to disambiguate, and the heading over the
 * open project states it in full. The home project is the exception both ways:
 * it has no remote to derive a picture from, and an "H" plaque would read as one
 * more repository, so it wears a house instead.
 */
/**
 * One bot's row.
 *
 * It is deliberately barer than a project's. A project row carries a `+`
 * because a project is a place work is started in, and a settings control
 * because a project has a name and a path someone chose. A bot has neither: the
 * daemon made its one conversation with it and no second one can ever be added,
 * so the row is the bot's face, its name, and whatever that one conversation is
 * doing — and nothing else to press.
 *
 * The row is top level like a project and nests nothing, because there is
 * nothing under a bot to nest.
 *
 * It is a `project` row in the sidebar's own vocabulary, and that is not a
 * hedge: that kind is how the sidebar draws a place work runs inside — an
 * avatar in the leading lane, the name shimmering while something is running,
 * a spinner in the trailing cell, and the unread dot on the face rather than at
 * the far edge. A bot is exactly that place. The `agent` kind is for a row that
 * *is* a correspondent rather than a place holding one, and it reports itself
 * in words instead, which left a bot saying "working" beside a column of
 * projects that spin.
 */
function botSidebarItem(bot: KissopenAgentBot, titleShimmerEnabled: boolean): SidebarItem {
    return {
        id: bot.workspaceId,
        kind: "project",
        label: bot.name,
        labelShimmer: titleShimmerEnabled,
        // A bot without a picture wears the same generated mark a session tab
        // does — a circle, hashed from the bot's own id — rather than the first
        // letter of its name. A column of bots is picked out by shape and color
        // long before it is read, an initials plaque gives every one of them the
        // same grey square, and hashing the id rather than the name keeps the
        // face the reader learned through every rename. A picture the bot
        // actually has still outranks it.
        avatarId: bot.id,
        ...(bot.avatar ? { imageUrl: bot.avatar.url } : {}),
        ...(bot.conversation.activity === "running"
            ? { status: "working" as const }
            : bot.conversation.activity === "waiting"
              ? { status: "waiting" as const }
              : {}),
        ...(bot.conversation.unread ? { unread: true } : {}),
    };
}

function sidebarItems(
    project: KissopenAgentProjectGroup,
    titleShimmerEnabled: boolean,
    newWorkspaceShortcut: boolean,
): SidebarItem[] {
    const projectHasLineChanges = (project.addedLines ?? 0) > 0 || (project.deletedLines ?? 0) > 0;
    return [
        {
            id: project.id,
            kind: "project",
            label: project.name,
            labelShimmer: titleShimmerEnabled,
            initials: project.name.slice(0, 1).toUpperCase(),
            ...(project.kind === "home" ? { icon: "home" as const } : {}),
            ...(project.avatar ? { imageUrl: project.avatar.url } : {}),
            // The + always waits for hover, so a project at rest ends with its
            // delta on the same column as every other row and nothing is
            // holding a place open for a control the reader is not reaching for.
            action: {
                disabled: project.lifecycle.phase !== "ready",
                icon: "plus" as const,
                label: t("New workspace in {name}", { name: project.name }),
                ...(newWorkspaceShortcut ? { shortcut: APP_SHORTCUTS.workspaceCreate } : {}),
                reveal: "hover" as const,
            },
            ...sidebarLifecycle(project.lifecycle),
            // Settings waits for hover beside the +, both laid over the lane
            // rather than placed in it. The home project is left out — its name
            // and its path are the machine's, so there is nothing there for the
            // reader to set.
            ...(project.kind === "home"
                ? {}
                : {
                      secondaryAction: {
                          icon: "settings" as const,
                          label: t("Settings for {name}", { name: project.name }),
                          reveal: "hover" as const,
                      },
                  }),
            // A row only carries a status while one of its sessions is live.
            // Waiting is the low-priority modifier: any session doing real work
            // makes the row spin, and only an all-waiting row wears the clock.
            ...(project.activity === "running"
                ? { status: "working" as const }
                : project.activity === "waiting"
                  ? { status: "waiting" as const }
                  : {}),
            ...(project.conversations.some((conversation) => conversation.unread)
                ? { unread: true }
                : {}),
            ...(projectHasLineChanges
                ? {
                      changeStats: {
                          added: project.addedLines ?? 0,
                          deleted: project.deletedLines ?? 0,
                      },
                  }
                : {}),
        },
        ...project.worktrees.map((worktree) => ({
            id: worktree.id,
            kind: "workspace" as const,
            depth: 1,
            label: worktree.name,
            labelShimmer: titleShimmerEnabled,
            // Archiving throws away a checkout, so it stays out of sight until
            // the reader is actually on the row.
            action: {
                icon: "archive" as const,
                label: `Archive ${worktree.name}`,
                reveal: "hover" as const,
            },
            // A worktree whose checkout is still being made, could not be made,
            // or is no longer there says so on the row: the reader is looking at
            // a place they may be about to send work into.
            ...sidebarLifecycle(worktree.lifecycle),
            ...(worktree.activity === "running"
                ? { status: "working" as const }
                : worktree.activity === "waiting"
                  ? { status: "waiting" as const }
                  : {}),
            ...(worktree.conversations.some((conversation) => conversation.unread)
                ? { unread: true }
                : {}),
            ...((worktree.addedLines ?? 0) > 0 || (worktree.deletedLines ?? 0) > 0
                ? {
                      changeStats: {
                          added: worktree.addedLines ?? 0,
                          deleted: worktree.deletedLines ?? 0,
                      },
                  }
                : {}),
        })),
    ];
}

/**
 * The row treatment one worktree phase asks for, as `SidebarItem` names them.
 *
 * A ready worktree contributes nothing: it is an ordinary row, and the row is
 * then free to report the work happening inside it. The other three replace that
 * report, because a place that does not exist yet has nothing running in it and
 * a place that has gone is not somewhere to send work.
 */
function sidebarLifecycle(
    lifecycle: KissopenAgentGroupLifecycle,
): Pick<SidebarItem, "lifecycle" | "lifecycleLabel"> {
    if (lifecycle.phase === "creating")
        return { lifecycle: "creating", lifecycleLabel: "creating" };
    if (lifecycle.phase === "failed") return { lifecycle: "failed", lifecycleLabel: "failed" };
    if (lifecycle.phase === "missing")
        return { lifecycle: "unavailable", lifecycleLabel: "missing" };
    return {};
}

/**
 * The phase a screen showing this worktree has to interrupt the reader with.
 *
 * A ready worktree and a project both answer `undefined`: the place is simply
 * there, and a notice saying so would sit permanently over every screen in the
 * application. The notice's own type leaves `ready` out for the same reason.
 */
function workspaceLifecyclePhase(
    lifecycle: KissopenAgentGroupLifecycle | undefined,
): WorkspaceLifecyclePhase | undefined {
    if (lifecycle === undefined || lifecycle.phase === "ready") return undefined;
    return lifecycle.phase;
}

/** The row action ids the sidebar's context menu dispatches back to this surface. */
const ROW_MENU_ARCHIVE = "archive";
/** Opens an assistant's settings: identity, what it knows about you, and its core files. */
const ROW_MENU_SETTINGS = "settings";
/**
 * Opens the row's naming surface: the settings dialog for a project, which is
 * where its name is set, and the rename field for a worktree, whose name is the
 * only thing there is to say about it.
 */
const ROW_MENU_RENAME = "rename";
/** Clears an assistant's one conversation; the assistant stays. */
const ROW_MENU_CLEAR = "clear";

/**
 * The context menu one sidebar row offers. Archiving is a menu action rather
 * than a visible control because it takes the row and its running work out of
 * the window. A bot keeps its dedicated folder for a later restore; archiving a
 * project closes its conversations and removes every one of its worktree
 * checkouts. The home project is left out — it is the machine's default place
 * rather than a repository the reader adopted, so hiding it would only bring it
 * straight back the next time a session starts there.
 */
function rowMenuItems(
    projects: readonly KissopenAgentProjectGroup[],
    bots: readonly KissopenAgentBot[],
    item: SidebarItem,
): MenuItem[] {
    if (bots.some((bot) => bot.workspaceId === item.id))
        return [
            {
                kind: "item",
                id: ROW_MENU_SETTINGS,
                label: t("Assistant settings"),
                icon: "settings",
            },
            { kind: "item", id: ROW_MENU_RENAME, label: t("Rename assistant"), icon: "edit" },
            { kind: "separator" },
            {
                kind: "item",
                id: ROW_MENU_CLEAR,
                label: t("Clear conversation"),
                icon: "trash",
                danger: true,
            },
            {
                kind: "item",
                id: ROW_MENU_ARCHIVE,
                label: t("Archive assistant"),
                icon: "archive",
                danger: true,
            },
        ];
    const owner = rowOwnerFind(projects, item.id);
    if (!owner) return [];
    if (owner.worktreeId)
        return [
            { kind: "item", id: ROW_MENU_RENAME, label: t("Rename workspace"), icon: "edit" },
            { kind: "separator" },
            {
                kind: "item",
                id: ROW_MENU_ARCHIVE,
                label: t("Archive workspace"),
                icon: "archive",
                danger: true,
            },
        ];
    // The home project's name is the machine's, not the reader's to set, so it
    // offers neither renaming nor archiving.
    if (owner.project.kind === "home") return [];
    return [
        { kind: "item", id: ROW_MENU_RENAME, label: t("Project settings…"), icon: "settings" },
        { kind: "separator" },
        {
            kind: "item",
            id: ROW_MENU_ARCHIVE,
            label: t("Archive project"),
            icon: "archive",
            danger: true,
        },
    ];
}

/**
 * The two regions a tab can be moved between, named once so the strip that
 * offers the move and the region that accepts it cannot drift apart.
 */
const TRANSFER_ZONE_MAIN = "kissopen-agent-main";
const TRANSFER_ZONE_PANEL = "kissopen-agent-panel";

/** Where a tab in the panel's strip can go: the main content, to its leading side. */
const PANEL_TRANSFER_TARGETS: readonly TabTransferTarget[] = [
    { zone: TRANSFER_ZONE_MAIN, label: t("the main content"), side: "leading" },
];

/** Where a tab in the main strip can go: the panel, to its trailing side. */
const MAIN_TRANSFER_TARGETS: readonly TabTransferTarget[] = [
    { zone: TRANSFER_ZONE_PANEL, label: t("the side panel"), side: "trailing" },
];

/** The live tool tabs currently drawn on one side of the workspace. */
function toolTabsPlaced(
    panel: KissopenAgentPanelSnapshot,
    placement: "panel" | "main",
): readonly KissopenAgentPanelTabSnapshot[] {
    return panel.tabs.filter((tab) => tab.placement === placement);
}

function panelCloseTargetFind(panel: KissopenAgentPanelSnapshot): string | undefined {
    if (!panel.open || panel.activeViewId === "files") return undefined;
    if (panel.activeViewId === "activity") return "activity";
    if (panel.activeViewId === "usage") return "usage";
    if (panel.activeViewId === "preview") return panel.previewEntryId ? "preview" : undefined;
    if (panel.activeViewId === "file") return panel.fileViewOpen ? "file" : undefined;
    const tab = panel.tabs.find(
        (entry) => entry.id === panel.activeViewId && entry.placement === "panel",
    );
    return tab?.id;
}

/** One tab per tool, iconed by what it holds. */
function toolTabItems(tabs: readonly KissopenAgentPanelTabSnapshot[]): TabItem[] {
    return tabs.map((tab) => ({
        closable: true,
        id: tab.id,
        label: tab.label,
        icon: tab.kind === "terminal" ? ("terminal" as const) : ("globe" as const),
    }));
}

/** The project a sidebar row belongs to, and whether the row is one of its worktrees. */
function rowOwnerFind(
    projects: readonly KissopenAgentProjectGroup[],
    id: string,
):
    | { readonly project: KissopenAgentProjectGroup; readonly worktreeId?: KissopenAgentWorktreeId }
    | undefined {
    for (const project of projects) {
        if (project.id === id) return { project };
        for (const worktree of project.worktrees)
            if (worktree.id === id) return { project, worktreeId: worktree.id };
    }
    return undefined;
}

/** A group with no conversation has no transcript; the constant keeps the prop stable. */
const NO_ENTRIES: readonly ConversationEntry[] = [];

/** A window with no machine yet holds no projects; the constant keeps the prop stable. */
const NO_PROJECTS: readonly KissopenAgentProjectGroup[] = [];

/** Resolves the selected preview against the current immutable conversation snapshot. */
function previewToolFind(
    conversation: KissopenAgentWorkspaceSnapshot["conversation"],
    entryId: string | undefined,
): ConversationToolCall | undefined {
    if (entryId === undefined || conversation.type !== "ready") return undefined;
    const entry = conversation.value.entries.find(
        (candidate) => candidate.kind === "agentActivity" && candidate.id === entryId,
    );
    return entry?.kind === "agentActivity" && entry.activity.kind === "tool"
        ? entry.activity.tool
        : undefined;
}

/** One tab per session in the open group, marked while the agent is working. */
function sessionTabs(group: OpenGroup, titleShimmerEnabled: boolean): TabItem[] {
    return group.conversations.map((summary) => ({
        id: summary.id,
        label: summary.title,
        labelShimmer: titleShimmerEnabled,
        // The session's own id, so the mark survives every rename of the title.
        avatarId: summary.id,
        // Both are stated even when false: a session tab holds its leading lane
        // open, so work starting or finishing makes the mark appear and go
        // without sliding the title sideways under the reader.
        busy: summary.activity === "running",
        waiting: summary.activity === "waiting",
        unread: summary.unread === true,
    }));
}

/**
 * Keeps a bot's one conversation first in the strip and refuses to close it.
 *
 * A bot *is* that conversation: it was created with the bot, it is the only one
 * there will ever be, and there is no control anywhere that could bring it back.
 * So it does not take its chances in the reader's tab order the way an ordinary
 * session does — it holds the leading position whatever else is opened beside
 * it, and the files and tools a reader opens from it arrange themselves after.
 *
 * Every other group passes through untouched: `sessionId` is absent unless the
 * open group is a bot's.
 */
function botTabPin(items: readonly TabItem[], sessionId: string | undefined): TabItem[] {
    if (sessionId === undefined) return items as TabItem[];
    const pinned = items.find((item) => item.id === sessionId);
    if (pinned === undefined) return items as TabItem[];
    return [{ ...pinned, closable: false }, ...items.filter((item) => item.id !== sessionId)];
}

/**
 * The group's tabs in the order the workspace records. Tabs it has no position
 * for follow in the order they arrived, so one opened this instant lands at the
 * end of the strip instead of appearing somewhere in the middle of it.
 */
function tabsOrdered<Item extends { readonly id: string }>(
    items: readonly Item[],
    order: readonly string[],
): Item[] {
    const remaining = new Map(items.map((item) => [item.id, item]));
    const placed = order.flatMap((id) => {
        const item = remaining.get(id);
        if (!item) return [];
        remaining.delete(id);
        return [item];
    });
    return [...placed, ...remaining.values()];
}

/** The tab action ids the strip's context menu dispatches back to this surface. */
const TAB_MENU_CLOSE = "close";
const TAB_MENU_CLOSE_OTHERS = "close-others";
const TAB_MENU_CLOSE_LEFT = "close-left";
const TAB_MENU_CLOSE_RIGHT = "close-right";
const TAB_MENU_CLOSE_ALL = "close-all";
const fileDocumentIdentities = new WeakMap<object, number>();
let fileDocumentIdentityNext = 0;

/**
 * The context menu one tab offers: the usual sweeps — this tab, the others,
 * everything to one side, the whole strip. Closing a session tab archives the
 * session, so a session tab's menu says "archive", while a file tab, whose
 * closing throws nothing away, says "close". A sweep still applies each tab's
 * own close semantics whatever the word on the item that started it. A sweep
 * with nothing to act on stays visible but disabled, so the menu keeps one
 * shape wherever it opens.
 */
function tabStripMenu(verb: "Archive" | "Close", left: number, right: number): MenuItem[] {
    const archive = verb === "Archive";
    return [
        { kind: "item", id: TAB_MENU_CLOSE, label: archive ? t("Archive tab") : t("Close tab") },
        { kind: "separator" },
        {
            kind: "item",
            id: TAB_MENU_CLOSE_OTHERS,
            label: archive ? t("Archive other tabs") : t("Close other tabs"),
            disabled: left + right === 0,
        },
        {
            kind: "item",
            id: TAB_MENU_CLOSE_LEFT,
            label: archive ? t("Archive tabs to the left") : t("Close tabs to the left"),
            disabled: left === 0,
        },
        {
            kind: "item",
            id: TAB_MENU_CLOSE_RIGHT,
            label: archive ? t("Archive tabs to the right") : t("Close tabs to the right"),
            disabled: right === 0,
        },
        { kind: "separator" },
        {
            kind: "item",
            id: TAB_MENU_CLOSE_ALL,
            label: archive ? t("Archive all tabs") : t("Close all tabs"),
        },
    ];
}

function fileTabDirty(tab: KissopenAgentFileTabSnapshot): boolean {
    if (tab.draft === undefined || tab.document.type !== "ready") return false;
    const document = tab.document.value;
    const saved =
        "newContent" in document
            ? document.newContent
            : "content" in document
              ? document.content
              : undefined;
    return saved !== undefined && tab.draft !== saved;
}

/** The same familiar file-type glyph whether a file is open or in tab history. */
function fileTabIcon(
    path: string,
    kind: KissopenAgentFileTabKind,
): "doc" | "globe" | "image" | "play" {
    const preview = kind === "media" ? filePreviewKind(path) : undefined;
    return kind === "document"
        ? "globe"
        : preview === "image"
          ? "image"
          : preview === "video" || preview === "audio"
            ? "play"
            : "doc";
}

/**
 * Exact identity of the ready document a file tab is currently drawing.
 *
 * A Git revision can advance before its replacement read settles while the old
 * ready document deliberately stays visible. Keying the editor from the loaded
 * object keeps that old parsed state attached to the old content until the new
 * document actually arrives. Weak keys add no lifetime beyond the tab/cache.
 */
function fileDocumentKey(tabId: string, document: object): string {
    let identity = fileDocumentIdentities.get(document);
    if (identity === undefined) {
        fileDocumentIdentityNext += 1;
        identity = fileDocumentIdentityNext;
        fileDocumentIdentities.set(document, identity);
    }
    return `${tabId}\u0000${String(identity)}`;
}

function fileTabItem(tab: KissopenAgentFileTabSnapshot): TabItem {
    // A tab of a picture says picture. Wearing the document glyph over every
    // open file made the strip a row of identical marks with only the name to
    // tell them apart.
    return {
        id: tab.id,
        label: tab.path.split("/").at(-1) ?? tab.path,
        dirty: fileTabDirty(tab),
        icon: fileTabIcon(tab.path, tab.kind),
        preview: tab.preview,
    };
}

/**
 * How opening one file should show it.
 *
 * A picture, a video, or an archive has no text view worth offering, and asking
 * for one only produced "Binary files cannot be opened in the editor." over the
 * thing the reader just clicked. Ordinary source asks for a file; the workspace
 * state upgrades that intent to a diff only when its live Git snapshot says the
 * path is changed.
 */
function fileTabKind(path: string): KissopenAgentFileTabKind {
    const kind = filePreviewKind(path);
    if (kind === "image" || kind === "video" || kind === "audio" || kind === "pdf") return "media";
    // Office documents are bytes drawn by their own viewers, never text to edit.
    if (
        kind === "document" ||
        kind === "spreadsheet" ||
        kind === "presentation" ||
        kind === "converted"
    )
        return "media";
    if (kind === "binary") return "media";
    // An HTML file is text that is also a page. It opens as the page, with its
    // source a toggle away, even out of the changed list: someone opening a
    // document wants to see the document.
    if (kind === "html") return "document";
    return "file";
}

function fileHighlightLanguageKey(path: string): string {
    const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
    // Pierre resolves language from the complete basename. Keeping the
    // complete name avoids treating `component.d.ts` and `component.ts` as
    // interchangeable cache entries just because their final extension agrees.
    return name;
}

/** Compact identity shared by saved source previews with the same bytes/language. */
function fileHighlightCacheKey(path: string, hash: string): string {
    return `h:${hash}:${fileHighlightLanguageKey(path)}`;
}

function markdownHighlightCacheKey(path: string, hash: string): string {
    return `m:${hash}:${fileHighlightLanguageKey(path)}`;
}

/**
 * One path as the checkout addresses it. A transcript names files the way the
 * agent saw them, which is usually an absolute path on the machine running the
 * session; the host reads paths inside the checkout, so its root is stripped
 * when the path is under it and the path is otherwise passed through unchanged.
 * A leading `./` is the same file written the way a shell prompt writes it, and
 * the host addresses that file without it.
 */
function workspacePathRelative(path: string, root: string | undefined): string {
    const normalized = path.replaceAll("\\", "/").replace(/^(?:\.\/)+/u, "");
    if (root === undefined) return normalized;
    const base = root.replaceAll("\\", "/").replace(/\/+$/u, "");
    const contained = /^[a-z]:\//iu.test(base)
        ? normalized.toLowerCase().startsWith(`${base.toLowerCase()}/`)
        : normalized.startsWith(`${base}/`);
    return base.length > 0 && contained ? normalized.slice(base.length + 1) : normalized;
}

/**
 * A link inside a rendered document, resolved against the document holding it.
 * `../DESIGN.md` in `docs/guide.md` is `DESIGN.md`, which is the file the reader
 * asked for; an absolute path names itself.
 */
function documentLinkResolve(from: string, href: string): string {
    if (href.startsWith("/") || /^[a-z]:\//iu.test(href)) return href;
    const segments = from.split("/").slice(0, -1);
    for (const segment of href.split("/")) {
        if (segment === "" || segment === ".") continue;
        if (segment === "..") segments.pop();
        else segments.push(segment);
    }
    return segments.join("/");
}

/**
 * Resolves an addressed group id against the list, matching projects, worktrees
 * and bots alike.
 *
 * A bot resolves to its own dedicated workspace holding its one conversation.
 * It is a group in every way this surface cares about — it is addressed, it has
 * a directory, it renders a chat — and it is only the sidebar that keeps bots
 * apart from projects, so the whole screen below reads one shape rather than
 * asking at every turn which kind of thing is open.
 */
function openGroupFind(
    projects: readonly KissopenAgentProjectGroup[],
    bots: readonly KissopenAgentBot[],
    groupId: string | undefined,
): OpenGroup | undefined {
    if (groupId === undefined) return undefined;
    const bot = bots.find((candidate) => candidate.workspaceId === groupId);
    if (bot)
        return {
            id: bot.workspaceId,
            name: bot.name,
            home: false,
            conversations: [bot.conversation],
            changes: [],
            // The bot's folder, so files and attachments land in it. Starting a
            // second conversation here is refused separately: a bot has exactly
            // one, and `sessionCreateAvailable` is what withholds that control.
            create: { cwd: bot.path, worktreeId: bot.workspaceId },
            path: bot.displayPath,
        };
    for (const project of projects) {
        if (project.id === groupId)
            return {
                id: project.id,
                name: project.name,
                home: project.kind === "home",
                conversations: project.conversations,
                changes: project.changes ?? [],
                ...(project.changesStatus === undefined
                    ? {}
                    : { changesStatus: project.changesStatus }),
                create: { cwd: project.path },
                lifecycle: project.lifecycle,
                path: project.displayPath,
            };
        for (const worktree of project.worktrees)
            if (worktree.id === groupId)
                return {
                    id: worktree.id,
                    name: worktree.name,
                    home: false,
                    conversations: worktree.conversations,
                    changes: worktree.changes ?? [],
                    ...(worktree.changesStatus === undefined
                        ? {}
                        : { changesStatus: worktree.changesStatus }),
                    create: { cwd: worktree.path, worktreeId: worktree.id },
                    lifecycle: worktree.lifecycle,
                    path: worktree.displayPath,
                };
    }
    return undefined;
}

/**
 * The composer prompt names where the message lands. A window holds several
 * projects and worktrees at once, and their names read as anything from `kissopen`
 * to `Fix login redirect`, so the group is quoted rather than glued into a
 * sentence that only reads well for one kind of title.
 */
function composerPlaceholder(groupName: string | undefined, assistantName?: string): string {
    // An assistant is the one being asked, so it is asked by its own name.
    if (assistantName !== undefined) return t("Ask {name}…", { name: assistantName });
    return groupName === undefined
        ? t("Ask KissOpen…")
        : t("Ask KissOpen in “{groupName}”…", { groupName });
}

/**
 * The composer prompt for a chat the reader may only read. It names the agent
 * holding the conversation, because that is the fact the reader needs: this work
 * belongs to something already running and is not waiting on a message. A chat
 * whose title has not been written yet says the same thing without a name rather
 * than falling back to jargon about what kind of chat it is.
 */
function conversationLockedPlaceholder(title: string | undefined): string {
    return title === undefined || title === ""
        ? "Running…"
        : t("{title} is running this chat…", { title });
}

/** A sidebar row's id: which KISSOPEN Agent it belongs to, then the group inside it. */
function kissopenAgentItemId(kissopenAgentId: string, id: string): string {
    return `${kissopenAgentId}/${id}`;
}

/**
 * One KISSOPEN Agent contributes two headed lists, and a section id says which of
 * them a heading control or a drag came from.
 *
 * They are separate sections rather than one list with the bots at the top,
 * because a section is exactly what the sidebar arranges rows within: rows in
 * one section are peers a drag rearranges among each other, and a bot and a
 * project are not peers — a bot dropped past the last one has no meaning
 * against a project, and the drop had to be bent into "first among the bots" to
 * mean anything at all. Given a section of their own, bots are dragged among
 * bots and projects among projects, and neither list has to know about the
 * other.
 */
const KISSOPEN_AGENT_SECTION_PREFIX = "kissopen-agent:";
const KISSOPEN_AGENT_BOTS_SECTION_PREFIX = "kissopen-agent-bots:";

function kissopenAgentSectionId(kissopenAgentId: string): string {
    return `${KISSOPEN_AGENT_SECTION_PREFIX}${kissopenAgentId}`;
}

function kissopenAgentBotsSectionId(kissopenAgentId: string): string {
    return `${KISSOPEN_AGENT_BOTS_SECTION_PREFIX}${kissopenAgentId}`;
}

/** Which of a KISSOPEN Agent's two lists a section id names, and whose it is. */
function kissopenAgentSectionParse(
    sectionId: string,
): { readonly kissopenAgentId: string; readonly kind: "bots" | "projects" } | undefined {
    if (sectionId.startsWith(KISSOPEN_AGENT_BOTS_SECTION_PREFIX))
        return {
            kissopenAgentId: sectionId.slice(KISSOPEN_AGENT_BOTS_SECTION_PREFIX.length),
            kind: "bots",
        };
    if (sectionId.startsWith(KISSOPEN_AGENT_SECTION_PREFIX))
        return {
            kissopenAgentId: sectionId.slice(KISSOPEN_AGENT_SECTION_PREFIX.length),
            kind: "projects",
        };
    return undefined;
}

function kissopenAgentItemParse(value: string): {
    readonly kissopenAgentId: string;
    readonly id: string;
} {
    const boundary = value.indexOf("/");
    return boundary < 0
        ? { id: "", kissopenAgentId: value }
        : { id: value.slice(boundary + 1), kissopenAgentId: value.slice(0, boundary) };
}

/**
 * The window's KISSOPEN Agents, each with its own projects, as one sidebar. Every row is
 * addressed by its KISSOPEN Agent and then by the group inside it, so a project on another
 * machine is selected, renamed, archived, and reordered through exactly the same
 * controls as one on this machine — against that machine's own workspace store.
 *
 * A machine that is not connected keeps the projects and work last confirmed
 * from it. Those rows remain navigation targets while their Kissopen Agent-backed actions
 * are disabled; reachability changes the section's state, not its membership.
 */
/**
 * The pinned rows in the order this window keeps them. A row the reader has
 * never moved — a newly reachable machine, for example — stays where the window
 * offered it, so an arrangement is a decision about the rows it was made about
 * and nothing else.
 */
function pinnedArrange(rows: readonly SidebarItem[], order: readonly string[]): SidebarItem[] {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return kissopenAgentNavigationOrderApply(
        rows.map((row) => row.id),
        order,
    ).flatMap((id) => {
        const row = byId.get(id);
        return row ? [row] : [];
    });
}

function kissopenAgentSidebarItemAvailability(
    item: SidebarItem,
    kissopenAgent: AppKissopenAgentEntry,
): Pick<SidebarItem, "action" | "secondaryAction"> {
    const disconnected = kissopenAgent.status !== "connected";
    return {
        ...(item.action && disconnected
            ? { action: { ...item.action, disabled: true } }
            : item.action
              ? { action: item.action }
              : {}),
        ...(item.secondaryAction && disconnected
            ? { secondaryAction: { ...item.secondaryAction, disabled: true } }
            : item.secondaryAction
              ? { secondaryAction: item.secondaryAction }
              : {}),
    };
}

/**
 * The sections with the reader's folding applied, marked on the rows that carry
 * something nested under them.
 *
 * Said once over the finished sections rather than inside each builder above:
 * every one of them states rows with a depth, the row ids are only their final
 * ones by the time they reach here, and folding is one fact about the sidebar
 * rather than something a project, a folder and a contact list should each have
 * to remember. A row nothing is nested under is left alone, so it never claims a
 * fold that would do nothing.
 */
function sectionsCollapsed(
    sections: readonly SidebarSection[],
    collapsed: ReadonlySet<string>,
): SidebarSection[] {
    if (collapsed.size === 0) return sections as SidebarSection[];
    return sections.map((section) => ({
        ...section,
        items: section.items.map((item, index) =>
            collapsed.has(item.id) && (section.items[index + 1]?.depth ?? 0) > (item.depth ?? 0)
                ? { ...item, collapsed: true }
                : item,
        ),
    }));
}

function kissopenAgentSections(
    directory: AppKissopenAgentDirectorySnapshot,
    titleShimmerEnabled: boolean,
    shortcutProject?: {
        readonly projectId: KissopenAgentProjectId;
        readonly kissopenAgentId: string;
    },
): SidebarSection[] {
    return directory.kissopenAgents.flatMap((kissopenAgent) => [
        // Creation lives on the Create page; the heading only groups existing bots.
        ...(kissopenAgent.bots.length === 0
            ? []
            : [
                  {
                      id: kissopenAgentBotsSectionId(kissopenAgent.id),
                      label: t("Assistants"),
                      items: kissopenAgent.bots.map((bot) => {
                          const item = botSidebarItem(bot, titleShimmerEnabled);
                          return { ...item, id: kissopenAgentItemId(kissopenAgent.id, item.id) };
                      }),
                  },
              ]),
        kissopenAgentProjectsSection(kissopenAgent, titleShimmerEnabled, shortcutProject),
    ]);
}

function kissopenAgentProjectsSection(
    kissopenAgent: AppKissopenAgentEntry,
    titleShimmerEnabled: boolean,
    shortcutProject?: {
        readonly projectId: KissopenAgentProjectId;
        readonly kissopenAgentId: string;
    },
): SidebarSection {
    return {
        id: kissopenAgentSectionId(kissopenAgent.id),
        // Which machine this is belongs to the connection rail and the window,
        // not to a heading over the list: the heading names the kind of thing
        // beneath it, the way "Assistants" does above.
        label: t("Projects"),
        items: kissopenAgent.projects
            .flatMap((project) =>
                sidebarItems(
                    project,
                    titleShimmerEnabled,
                    shortcutProject?.kissopenAgentId === kissopenAgent.id &&
                        shortcutProject.projectId === project.id,
                ),
            )
            .map((item) => ({
                ...item,
                id: kissopenAgentItemId(kissopenAgent.id, item.id),
                ...kissopenAgentSidebarItemAvailability(item, kissopenAgent),
            })),
        // Project creation belongs to the Kissopen Agent named by this section.
        ...(kissopenAgent.status === "connected" && kissopenAgent.session
            ? {
                  action: {
                      busy: kissopenAgent.projectAdd?.pending === true,
                      icon: "plus" as const,
                      label: t("Add project"),
                      reveal: "always" as const,
                  },
                  ...(kissopenAgent.projectAdd?.error !== undefined
                      ? { error: kissopenAgent.projectAdd.error }
                      : {}),
              }
            : {}),
        // What a Kissopen Agent said when it failed belongs under its own heading.
        ...(kissopenAgent.status === "error" && kissopenAgent.message !== undefined
            ? { error: kissopenAgent.message }
            : {}),
        ...(kissopenAgent.projects.length === 0
            ? {
                  empty:
                      kissopenAgent.status === "connected"
                          ? {
                                description: t("Choose a repository folder on this Mac."),
                                icon: "plus" as const,
                                title: t("No projects yet"),
                            }
                          : {
                                description: kissopenAgentEmptyDescription(kissopenAgent),
                                icon: "link" as const,
                                title: kissopenAgentStatusLabel(kissopenAgent),
                                actionLabel: t("Open settings"),
                            },
              }
            : {}),
    };
}

/**
 * Command-number destinations prioritize the project somebody is working in:
 * its main checkout is always first, followed by its visible workspaces. Any
 * remaining digits focus other projects in the sidebar's ordinary top-to-bottom
 * KISSOPEN Agent/project order. Sidebar intersects this order with the rows it actually
 * draws, so a folded workspace consumes no number.
 */
function projectShortcutTargets(
    directory: AppKissopenAgentDirectorySnapshot,
    activeKissopenAgentId: string | undefined,
    activeProjectId: KissopenAgentProjectId | undefined,
): readonly SidebarNumberShortcutTarget[] {
    const activeKissopenAgent = directory.kissopenAgents.find(
        (kissopenAgent) => kissopenAgent.id === activeKissopenAgentId,
    );
    const activeProject = activeKissopenAgent?.projects.find(
        (project) => project.id === activeProjectId,
    );
    const target = (
        kissopenAgent: AppKissopenAgentEntry,
        id: KissopenAgentProjectId | KissopenAgentWorktreeId,
    ): SidebarNumberShortcutTarget => ({
        itemId: kissopenAgentItemId(kissopenAgent.id, id),
        sectionId: kissopenAgentSectionId(kissopenAgent.id),
    });
    return [
        ...(activeKissopenAgent && activeProject
            ? [
                  target(activeKissopenAgent, activeProject.id),
                  ...activeProject.worktrees.map((worktree) =>
                      target(activeKissopenAgent, worktree.id),
                  ),
              ]
            : []),
        ...directory.kissopenAgents.flatMap((kissopenAgent) =>
            kissopenAgent.projects.flatMap((project) =>
                kissopenAgent.id === activeKissopenAgent?.id && project.id === activeProject?.id
                    ? []
                    : [target(kissopenAgent, project.id)],
            ),
        ),
    ];
}

/** One directory entry's unified inner-health and outer-route availability. */
function kissopenAgentEntryAvailability(
    kissopenAgent: AppKissopenAgentEntry,
): KissopenAgentAvailabilitySnapshot | undefined {
    if (!kissopenAgent.session) return undefined;
    return kissopenAgentAvailabilityProject(kissopenAgent.session.connection.get(), true, {
        status: kissopenAgent.status,
        ...(kissopenAgent.message === undefined ? {} : { message: kissopenAgent.message }),
    });
}

/** The primary Kissopen Agent backing window-wide settings and chrome. */
export function hostKissopenAgent(
    directory: AppKissopenAgentDirectorySnapshot,
): AppKissopenAgentEntry | undefined {
    return directory.kissopenAgents[0];
}

/**
 * What a section says when it is standing empty because its machine has not
 * answered.
 *
 * It does not say there is nothing there. Whatever that machine holds is
 * unknown while the connection is down, and telling the reader their work is
 * gone would be a worse mistake than telling them nothing. So this says only
 * where the connection stands; the failure itself is already stated under the
 * heading, and is not repeated here.
 */
function kissopenAgentEmptyDescription(kissopenAgent: AppKissopenAgentEntry): string {
    if (kissopenAgent.status === "connecting") return "Connecting to this machine…";
    if (kissopenAgent.status === "error") return "Its projects will appear once it answers again.";
    return "Connect this machine to see its projects.";
}

function kissopenAgentStatusLabel(kissopenAgent: AppKissopenAgentEntry): string {
    if (kissopenAgent.status === "connected") return "Connected";
    if (kissopenAgent.status === "connecting") return "Connecting…";
    return kissopenAgent.status === "error" ? "Not reachable" : "Disconnected";
}

/**
 * The pinned row that opens the addressed Kissopen Agent's inbox. It belongs with the
 * pinned rows rather than under a project because the questions it collects come
 * from every session on that machine at once, and the person answering them is
 * working through a queue rather than visiting a repository.
 */
const INBOX_ITEM = "inbox";

/**
 * The workspace window. It owns no product state: it subscribes to the directory
 * of KISSOPEN Agents, renders their projects as one sidebar, and hands the addressed KISSOPEN Agent's
 * own stores to the surface below. A Kissopen Agent that is still connecting, or one the
 * reader has disconnected from, keeps the sidebar and states itself in the
 * content area instead of taking the window away.
 */
/** The rows the sidebar's identity menu offers, in the order they are read. */
/** The footer's identity menu for the signed-in KISSOPEN account, wherever the footer is drawn. */
export function accountMenuItems(account: NonNullable<CloudDestinations["account"]>): MenuItem[] {
    return [
        {
            kind: "label",
            label: account.name,
        },
        { kind: "item", id: "profile", label: t("个人资料"), icon: "users" },
        { kind: "separator" },
        { kind: "item", id: "settings", label: t("设置"), icon: "settings" },
        { kind: "item", id: "logout", label: t("退出登录"), icon: "arrow-right", danger: true },
    ];
}

export function AppKissopenAgentView(props: AppKissopenAgentViewProps) {
    const directory = useSyncExternalStore(
        props.kissopenAgents.subscribe,
        props.kissopenAgents.get,
        props.kissopenAgents.get,
    );
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const titleShimmerStore = props.titleShimmer ?? titleShimmerStoreNoop;
    const titleShimmerEnabled = useSyncExternalStore(
        titleShimmerStore.subscribe,
        titleShimmerStore.get,
        titleShimmerStore.get,
    ).titleShimmerEnabled;
    // The order the reader arranged the pinned rows in belongs to the window
    // rather than to any one Kissopen Agent, so a machine going away rearranges nothing.
    const experimentsStore = props.experiments ?? experimentsStoreNoop;
    // The inbox and folders are still being built, so they are offered only to
    // a reader who has asked for unfinished work in settings. The switch is
    // read here so their routes, sidebar rows, and dialogs cannot disagree
    // about whether the surfaces exist.
    const experimental = useSyncExternalStore(
        experimentsStore.subscribe,
        experimentsStore.get,
        experimentsStore.get,
    ).experimentalFeaturesEnabled;
    const navigationOrderStore = props.navigationOrder ?? kissopenAgentNavigationOrderStoreNoop;
    const navigationOrder = useSyncExternalStore(
        navigationOrderStore.subscribe,
        navigationOrderStore.get,
        navigationOrderStore.get,
    );
    // Which projects and folders the reader folded shut. Like the order above it
    // this belongs to the window: a machine going away must not unfold the tree
    // somebody arranged, and coming back must not fold it again.
    const sidebarCollapseStore = props.sidebarCollapse ?? kissopenAgentSidebarCollapseStoreNoop;
    const sidebarCollapse = useSyncExternalStore(
        sidebarCollapseStore.subscribe,
        sidebarCollapseStore.get,
        sidebarCollapseStore.get,
    );
    const sidebarVisibilityStore =
        props.sidebarVisibility ?? kissopenAgentSidebarVisibilityStoreNoop;
    const sidebarVisibility = useSyncExternalStore(
        sidebarVisibilityStore.subscribe,
        sidebarVisibilityStore.get,
        sidebarVisibilityStore.get,
    );
    // The palette is opened from anywhere in the window, so the key that opens
    // it is bound here rather than inside a workspace. Only whether it is open
    // is read here: what it holds is the palette's own business, and reading
    // the query at this level would re-render the whole window per keystroke.
    const commandPaletteStore = props.commandPalette ?? commandPaletteStoreNoop;
    const commandPaletteOpen = useSyncExternalStore(
        commandPaletteStore.subscribe,
        () => commandPaletteStore.get().open,
        () => commandPaletteStore.get().open,
    );
    const windowStateStore = props.windowState ?? kissopenAgentWindowStoreNoop;
    const windowState = useSyncExternalStore(
        windowStateStore.subscribe,
        windowStateStore.get,
        windowStateStore.get,
    );
    const active =
        directory.kissopenAgents.find(
            (kissopenAgent) => kissopenAgent.id === props.kissopenAgentId,
        ) ??
        directory.kissopenAgents[0] ??
        undefined;
    const viewerId = kissopenAgentOwnerAuthor.id;
    const activeAvailability = active ? kissopenAgentEntryAvailability(active) : undefined;
    const addressedProject =
        active && props.groupId ? rowOwnerFind(active.projects, props.groupId)?.project : undefined;
    const shortcutProject = activeAvailability?.online ? addressedProject : undefined;
    const workspaceCreateTarget =
        active && shortcutProject?.lifecycle.phase === "ready"
            ? { projectId: shortcutProject.id, kissopenAgentId: active.id }
            : undefined;
    const activeKissopenAgentOnline = (): boolean => {
        const current = props.kissopenAgents.get();
        const kissopenAgent =
            current.kissopenAgents.find((entry) => entry.id === props.kissopenAgentId) ??
            current.kissopenAgents[0] ??
            undefined;
        return kissopenAgent
            ? (kissopenAgentEntryAvailability(kissopenAgent)?.online ?? false)
            : false;
    };
    const kissopenAgentOf = (kissopenAgentId: string) =>
        directory.kissopenAgents.find((kissopenAgent) => kissopenAgent.id === kissopenAgentId);
    // The pinned row carries a live count, so the window subscribes to the
    // addressed KISSOPEN Agent's inbox whether or not the inbox itself is open: the point of
    // the count is to be seen while the reader is doing something else.
    const inboxStore = active?.session?.inbox ?? kissopenAgentInboxStoreNoop;
    const inbox = useSyncExternalStore(inboxStore.subscribe, inboxStore.get, inboxStore.get);
    const daemonStore = props.daemon ?? sidebarDaemonStoreNoop;
    const daemon = useSyncExternalStore(daemonStore.subscribe, daemonStore.get, daemonStore.get);
    const inboxPending = inbox.pending.length;
    const desktop = props.platform === "desktop";
    // Windows draws its caption buttons at the trailing edge, leaving the
    // leading corner free for the product lockup. The operating system is not
    // ours to model, so the renderer's own user agent is the boundary read.
    const controlsAtEnd = desktop && /Windows/u.test(globalThis.navigator?.userAgent ?? "");
    // Kissopen's own update wins the row. Restarting the app is the larger event of
    // the two, and it carries the agent with it, so the agent states its case
    // once there is nothing bigger waiting.
    const agentUpdate = props.update ? undefined : agentUpdateOffer(daemon);
    const sidebarUpdate = props.update ? (
        <SidebarUpdateAction
            action={props.update.action}
            detail={props.update.detail}
            onAction={props.update.status === "downloaded" ? props.onUpdateApply : undefined}
            status={props.update.status}
            subject="application"
            version={props.update.version}
        />
    ) : agentUpdate ? (
        <SidebarUpdateAction
            action="install"
            detail={agentUpdate.detail}
            onAction={agentUpdate.status === "downloaded" ? daemonStore.daemonInstall : undefined}
            status={agentUpdate.status}
            subject="kissopenAgent"
            version={agentUpdate.version}
        />
    ) : undefined;
    // The pinned rows as the window offers them. What the reader has made of
    // that order is applied below, so this list only ever states which rows this
    // window has and what each one is.
    // The inbox belongs to the addressed machine, so it appears only while that
    // machine is reachable: a queue of questions is meaningless from a KISSOPEN Agent that
    // cannot say what it is waiting on.
    const cloudDestinations = useCloudDestinations();
    /** Whether a row came from the host's history sections rather than this workspace. */
    const inCloudSections = (id: string) =>
        cloudDestinations.sections?.some((section) =>
            section.items.some((item) => item.id === id),
        ) === true;
    const pinnedOffered: SidebarItem[] =
        experimental && active?.session?.inbox
            ? [
                  {
                      badge: inboxPending,
                      icon: "bell",
                      id: INBOX_ITEM,
                      kind: "action",
                      label: t("Inbox"),
                  },
              ]
            : [];
    const pinned = [
        ...cloudDestinations.items,
        ...pinnedArrange(pinnedOffered, navigationOrder.order),
    ];
    const sidebar = (
        <Sidebar
            actions={pinned}
            roomy
            numberShortcuts="navigate"
            numberShortcutTargets={projectShortcutTargets(
                directory,
                active?.id,
                addressedProject?.id,
            )}
            activeItemId={
                // On a consumer destination the open conversation wins, and the
                // destination row itself stands in until one is opened. `||`
                // rather than `??`: "no conversation open" arrives as an empty
                // string, which `??` would keep and leave nothing marked.
                cloudDestinations.activeId && cloudDestinations.activeId !== "workspace"
                    ? cloudDestinations.sectionActiveId || cloudDestinations.activeId
                    : experimental && props.inboxOpen
                      ? INBOX_ITEM
                      : props.groupId
                        ? kissopenAgentItemId(props.kissopenAgentId, props.groupId)
                        : cloudDestinations.activeId || ""
            }
            // AppShell places the brand below native window controls.
            // Beside a connection rail, its tiles identify the window instead.
            brand={!desktop || !windowState.connectionRail}
            footer={
                <SidebarFooter
                    avatarSize="md"
                    {...(cloudDestinations.account
                        ? {
                              name: cloudDestinations.account.name,
                              initials: cloudDestinations.account.initials,
                              ...(cloudDestinations.account.imageUrl
                                  ? { imageUrl: cloudDestinations.account.imageUrl }
                                  : {}),
                              identityMenu: accountMenuItems(cloudDestinations.account),
                              onIdentitySelect: (action: string) => {
                                  cloudDestinations.onAccountAction?.(action);
                                  if (action === "profile") {
                                      if (props.onSettingsSectionOpen)
                                          props.onSettingsSectionOpen(action);
                                      else props.onSettingsOpen();
                                  } else if (action === "settings") props.onSettingsOpen();
                              },
                          }
                        : {})}
                    actions={sidebarUpdate}
                    appearance={appearance.appearance}
                    devMenu={
                        props.buildIdentity ? (
                            <DevBuildMenu
                                branch={props.buildIdentity.branch}
                                label={props.buildIdentity.label}
                                onBlueprintOpen={props.onBlueprintOpen}
                                onCopyPath={() =>
                                    void navigator.clipboard
                                        .writeText(props.buildIdentity!.path)
                                        .catch(() => undefined)
                                }
                                performance={props.performance}
                                path={props.buildIdentity.path}
                            />
                        ) : undefined
                    }
                    onAppearanceToggle={() => props.appearance.appearanceToggle()}
                    {...(cloudDestinations.account ? {} : { onSettingsOpen: props.onSettingsOpen })}
                />
            }
            headerAccessory={
                // Reachability is the window's line, not the sidebar's — see the
                // band at the top. What stays here is what only this list can
                // say: that the Kissopen Agent is up and still did not hand over its
                // sessions.
                active?.status === "connected" && active.projectsStatus === "error" ? (
                    <Banner
                        action={{
                            label: t("Retry"),
                            onClick: () => active.session?.workspace.conversationListRetry(),
                        }}
                        tone="danger"
                        title={t("Sessions unavailable")}
                    >
                        {t("{label} did not return its projects.", { label: active.label })}
                    </Banner>
                ) : active?.status === "connected" && active.projectsStatus === "loading" ? (
                    // Also only while the Kissopen Agent is up. Losing it resets the list to
                    // loading, and "Loading sessions…" under a band saying the
                    // machine is unreachable is a promise nothing is keeping.
                    <Banner tone="neutral">{t("Loading sessions…")}</Banner>
                ) : undefined
            }
            itemMenuItems={(item) => {
                if (inCloudSections(item.id))
                    return cloudDestinations.sectionItemMenuItems?.(item.id) ?? [];
                const row = kissopenAgentItemParse(item.id);
                const kissopenAgent = kissopenAgentOf(row.kissopenAgentId);
                if (kissopenAgent?.status !== "connected") return [];
                return rowMenuItems(kissopenAgent.projects, kissopenAgent.bots, {
                    ...item,
                    id: row.id,
                });
            }}
            // Only project headings offer an inline creation action.
            onSectionAction={(sectionId) => {
                const section = kissopenAgentSectionParse(sectionId);
                if (section?.kind !== "projects") return;
                const kissopenAgent = kissopenAgentOf(section.kissopenAgentId);
                if (kissopenAgent?.status !== "connected") {
                    props.onSettingsOpen();
                    return;
                }
                const workspace = kissopenAgent.session?.workspace;
                if (!workspace) return;
                workspace.projectAdd();
            }}
            onItemMenuSelect={(item, actionId) => {
                if (inCloudSections(item.id)) {
                    cloudDestinations.onSectionItemMenuSelect?.(item.id, actionId);
                    return;
                }
                const row = kissopenAgentItemParse(item.id);
                const kissopenAgent = kissopenAgentOf(row.kissopenAgentId);
                if (!kissopenAgent) return;
                if (kissopenAgent.status !== "connected") return;
                const workspace = kissopenAgent.session?.workspace;
                if (!workspace) return;
                const bot = kissopenAgent.bots.find(
                    (candidate) => candidate.workspaceId === row.id,
                );
                if (bot) {
                    if (actionId === ROW_MENU_SETTINGS)
                        kissopenAgent.session?.botSettings?.().dialogOpen(bot.id);
                    if (actionId === ROW_MENU_RENAME) workspace.botRenameOpen(bot.id);
                    if (
                        actionId === ROW_MENU_CLEAR &&
                        window.confirm(
                            t(
                                "Clear everything in {name}'s conversation? The assistant stays, but what was said is permanently deleted.",
                                { name: bot.name },
                            ),
                        )
                    )
                        void workspace.botConversationClear(bot.id).catch(() => undefined);
                    if (actionId === ROW_MENU_ARCHIVE)
                        void workspace.botArchive(bot.id).catch(() => undefined);
                    return;
                }
                const owner = rowOwnerFind(kissopenAgent.projects, row.id);
                if (!owner) return;
                if (actionId === ROW_MENU_RENAME) {
                    workspace.renameOpen(owner.project.id, owner.worktreeId);
                    return;
                }
                if (actionId !== ROW_MENU_ARCHIVE) return;
                // Deliberately no navigation here. An archive that the host
                // refuses would have ejected the reader from a project that is
                // still there, and an archive performed from another window or
                // another machine would not have moved them at all. Leaving the
                // addressed group is one thing, driven by the host's own catalog
                // no longer holding it, and the workspace reports that.
                void (
                    owner.worktreeId
                        ? workspace.worktreeArchive(owner.project.id, owner.worktreeId)
                        : workspace.projectArchive(owner.project.id)
                ).catch(() => undefined);
            }}
            // Addressing a group opens the tab it was left on, so a list row
            // lands back where the reader was rather than on an empty screen.
            // Once every remembered tab is gone, its first session is what the
            // group still has to show.
            onItemSelect={(id) => {
                if (id === INBOX_ITEM) {
                    props.onInboxOpen?.();
                    return;
                }
                // A consumer destination is not a workspace row, so it never
                // reaches the agent parsing below.
                if (cloudDestinations.items.some((destination) => destination.id === id)) {
                    cloudDestinations.onSelect(id);
                    return;
                }
                // History rows sit in the same column as the projects, so they
                // are told apart by the list they came from.
                if (
                    cloudDestinations.sections?.some((section) =>
                        section.items.some((item) => item.id === id),
                    )
                ) {
                    cloudDestinations.onSectionItemSelect?.(id);
                    return;
                }
                const row = kissopenAgentItemParse(id);
                const kissopenAgent = kissopenAgentOf(row.kissopenAgentId);
                if (!kissopenAgent) return;
                const groupId = row.id as KissopenAgentGroupId;
                // An assistant or a project is this machine's own work. While a
                // cloud conversation, remote control, schedules or plugins holds
                // the content region, picking one only moved the selection
                // behind it and the window looked dead; the reader is leaving
                // for 工作, so the window goes there too.
                if (cloudDestinations.activeId && cloudDestinations.activeId !== "workspace")
                    cloudDestinations.onSelect("workspace");
                // Both projects and assistants resume their latest conversation.
                props.onChatSelect(
                    kissopenAgent.id,
                    row.id,
                    kissopenAgent.session?.workspace.get().groupResume?.get(groupId) ??
                        openGroupFind(kissopenAgent.projects, kissopenAgent.bots, row.id)
                            ?.conversations[0]?.id,
                );
            }}
            onItemAction={(id) => {
                const row = kissopenAgentItemParse(id);
                const kissopenAgent = kissopenAgentOf(row.kissopenAgentId);
                if (!kissopenAgent) return;
                if (kissopenAgent.status !== "connected") return;
                const workspace = kissopenAgent.session?.workspace;
                const owner = rowOwnerFind(kissopenAgent.projects, row.id);
                if (!owner || !workspace) return;
                // The plus on a project adds a worktree; the control on a
                // worktree archives it.
                void (
                    owner.worktreeId
                        ? workspace.worktreeArchive(owner.project.id, owner.worktreeId)
                        : workspace.worktreeCreate(owner.project.id)
                ).catch(() => undefined);
            }}
            // The cog on a project row. Only project rows carry one, and the
            // settings surface is the same one the row's menu opens.
            onItemSecondaryAction={(id) => {
                const row = kissopenAgentItemParse(id);
                const kissopenAgent = kissopenAgentOf(row.kissopenAgentId);
                if (!kissopenAgent) return;
                if (kissopenAgent.status !== "connected") return;
                const workspace = kissopenAgent.session?.workspace;
                const owner = rowOwnerFind(kissopenAgent.projects, row.id);
                if (!owner || owner.worktreeId || !workspace) return;
                workspace.renameOpen(owner.project.id, undefined);
            }}
            {...(props.navigationOrder
                ? {
                      onActionReorder: (move: SidebarReorder) => {
                          props.navigationOrder?.itemReorder(
                              move.id,
                              move.afterId,
                              pinned.map((row) => row.id),
                          );
                      },
                  }
                : {})}
            onItemReorder={(sectionId, move) => {
                const section = kissopenAgentSectionParse(sectionId);
                if (!section) return;
                const kissopenAgent = kissopenAgentOf(section.kissopenAgentId);
                if (kissopenAgent?.status !== "connected") return;
                const workspace = kissopenAgent.session?.workspace;
                if (!workspace) return;
                const moved = kissopenAgentItemParse(move.id).id;
                const after =
                    move.afterId === null ? null : kissopenAgentItemParse(move.afterId).id;
                // A bot's row is addressed by its workspace, so the move the
                // sidebar reports names workspaces and the bots behind them are
                // what is actually arranged.
                if (section.kind === "bots") {
                    const botOf = (workspaceId: string | null) =>
                        workspaceId === null
                            ? undefined
                            : kissopenAgent.bots.find((bot) => bot.workspaceId === workspaceId);
                    const movedBot = botOf(moved);
                    if (!movedBot) return;
                    void workspace
                        .botReorder(movedBot.id, botOf(after)?.id ?? null)
                        .catch(() => undefined);
                    return;
                }
                // A drag inside a project rearranges its worktrees; a drag
                // at the top level rearranges the projects themselves.
                void (
                    move.parentId
                        ? workspace.worktreeReorder(
                              kissopenAgentItemParse(move.parentId).id as KissopenAgentProjectId,
                              moved as KissopenAgentWorktreeId,
                              after as KissopenAgentWorktreeId | null,
                          )
                        : workspace.projectReorder(
                              moved as KissopenAgentProjectId,
                              after as KissopenAgentProjectId | null,
                          )
                ).catch(() => undefined);
            }}
            // A row is folded shut by this window's own record, so a project
            // whose checkouts are hidden stays hidden as its Kissopen Agent comes and goes.
            {...(props.sidebarCollapse
                ? {
                      onItemCollapseToggle: (id: string) => {
                          sidebarCollapseStore.rowCollapseToggle(id);
                      },
                  }
                : {})}
            sections={[
                ...sectionsCollapsed(
                    kissopenAgentSections(directory, titleShimmerEnabled, workspaceCreateTarget),
                    sidebarCollapse.collapsed,
                ),
                // The consumer history reads under the machine's own projects,
                // so one column shows both what this machine holds and what the
                // account has been talking about, without the reader switching
                // lists to find either.
                ...(cloudDestinations.sections ?? []),
            ]}
        />
    );

    // What the palette and the held-Command card are both about. The update is
    // offered only once it is downloaded and there is something to apply it
    // with, which is the same test the sidebar's own update control makes.
    const paletteSubject: KissopenAgentPaletteSubject = {
        bots: active?.bots ?? [],
        chatId: props.chatId,
        groupId: props.groupId,
        kissopenAgentId: active?.id ?? props.kissopenAgentId,
        online: activeAvailability?.online === true,
        projects: active?.projects ?? NO_PROJECTS,
        updateReady:
            props.update?.status === "downloaded" && props.onUpdateApply
                ? { action: props.update.action, version: props.update.version }
                : undefined,
        workspace: active?.session?.workspace,
        workspaceCreateProjectId: workspaceCreateTarget?.projectId,
    };
    // The same suggestions the empty palette offers, on the gesture the reader
    // already has for discovering chords. The shell mounts it only while
    // Command is held, so this card's own reading of the workspace lasts
    // exactly as long as the hold. A window with no palette shows no card: its
    // footer promises ⌘K, and a promise nothing answers is worse than silence.
    const paletteHints = !props.commandPalette ? undefined : active?.session?.workspace ? (
        <KissopenAgentQuickActionsSurface
            {...paletteSubject}
            workspace={active.session.workspace}
        />
    ) : (
        <KissopenAgentQuickActions {...paletteSubject} facts={PALETTE_WORKSPACE_ABSENT} />
    );
    const paletteActions: KissopenAgentPaletteActions = {
        appearance: props.appearance,
        experiments: experimentsStore,
        kissopenAgentOnline: activeKissopenAgentOnline,
        onChatSelect: props.onChatSelect,
        onFileSelect: props.onFileSelect,
        onSettingsOpen: props.onSettingsOpen,
        onSettingsSectionOpen: props.onSettingsSectionOpen,
        onUpdateApply: props.onUpdateApply,
        store: commandPaletteStore,
        titleShimmer: titleShimmerStore,
    };

    // Which screen the window is showing. It is a value rather than a set of
    // early returns because the window's own dialogs are mounted beside it: a
    // surface that answers on one route and not another is not a window-level
    // surface at all.
    const routeContent = (): ReactNode => {
        // The workbench belongs to no machine and needs no connection: it renders the
        // component pages themselves, so it is independent of every KISSOPEN Agent.
        if (props.blueprintOpen)
            return (
                <>
                    {desktop ? <WindowDragRegion /> : null}
                    <BlueprintView />
                </>
            );

        // Create belongs to the addressed machine — the projects a session can be
        // started in are that machine's — so it is shown only while that machine
        // has a workspace to answer through. There is deliberately nothing else
        // on the surface: the task is the only thing being decided here.
        if (props.createOpen && active?.session?.workspace)
            return (
                <>
                    {desktop ? <WindowDragRegion /> : null}
                    <KissopenAgentCreateSurface
                        kissopenAgentOnline={activeKissopenAgentOnline}
                        workspace={active.session.workspace}
                        {...(activeAvailability?.refusal === undefined
                            ? {}
                            : { unavailable: activeAvailability.refusal })}
                    />
                </>
            );

        // The inbox belongs to the addressed machine, so it is shown only while that
        // machine has stores to answer through.
        if (experimental && props.inboxOpen && active?.session?.inbox)
            return (
                <>
                    {desktop ? <WindowDragRegion /> : null}
                    <KissopenAgentInboxSurface
                        onOpenSession={(kissopenAgentId, groupId, chatId) =>
                            props.onChatSelect(kissopenAgentId, groupId, chatId)
                        }
                        projects={active.projects}
                        kissopenAgentId={active.id}
                        kissopenAgentOnline={activeKissopenAgentOnline}
                        snapshot={inbox}
                        store={active.session.inbox}
                        {...(activeAvailability?.refusal === undefined
                            ? {}
                            : { unavailable: activeAvailability.refusal })}
                    />
                </>
            );

        if (active?.session)
            return (
                <KissopenAgentWorkspaceSurface
                    kissopenAgentId={active.id}
                    {...(cloudDestinations.boards ? { boards: cloudDestinations.boards } : {})}
                    {...(cloudDestinations.workExamples
                        ? { workExamples: cloudDestinations.workExamples }
                        : {})}
                    {...(cloudDestinations.workProjects
                        ? { workProjects: cloudDestinations.workProjects }
                        : {})}
                    dictation={props.dictation}
                    {...(props.onScheduleProposalOpen
                        ? { onScheduleProposalOpen: props.onScheduleProposalOpen }
                        : {})}
                    {...(props.onScheduledTaskOpen
                        ? { onScheduledTaskOpen: props.onScheduledTaskOpen }
                        : {})}
                    availability={
                        activeAvailability ??
                        kissopenAgentAvailabilityProject(active.session.connection.get(), true, {
                            status: active.status,
                            ...(active.message === undefined ? {} : { message: active.message }),
                        })
                    }
                    appearance={props.appearance}
                    browserContent={props.browserContent}
                    browserAutomation={props.browserAutomation}
                    browserConnectionId={active.remoteId ?? null}
                    htmlPreview={props.htmlPreview}
                    mediaWindow={props.mediaWindow}
                    documentConversion={props.documentConversion}
                    chatId={props.chatId}
                    clock={active.session.clock}
                    groupId={props.groupId}
                    key={active.id}
                    onChatSelect={(groupId, chatId, replace) =>
                        props.onChatSelect(active.id, groupId, chatId, replace)
                    }
                    onChatClose={(groupId, chatId, fallbackChatId) =>
                        props.onChatClose?.(active.id, groupId, chatId, fallbackChatId) ?? false
                    }
                    onFileClose={(groupId, path) => props.onFileClose(active.id, groupId, path)}
                    onFileSelect={(groupId, chatId, path, kind, replace) =>
                        props.onFileSelect(active.id, groupId, chatId, path, kind, replace)
                    }
                    platform={props.platform}
                    projects={active.projects}
                    kissopenAgentOnline={activeKissopenAgentOnline}
                    titleShimmerEnabled={titleShimmerEnabled}
                    viewerId={viewerId}
                    workspace={active.session.workspace}
                    {...(workspaceCreateTarget
                        ? { workspaceCreateProjectId: workspaceCreateTarget.projectId }
                        : {})}
                />
            );
        // The host Kissopen Agent has no live stores yet — it is still connecting, or it could
        // not be reached. The sidebar stays so the window keeps its shape while
        // that resolves; anything the reader can do about it is a settings act,
        // which is where the control points.
        return (
            <>
                {desktop ? <WindowDragRegion /> : null}
                <EmptyState
                    action={{
                        label: t("Open settings"),
                        icon: "settings",
                        onClick: props.onSettingsOpen,
                    }}
                    description={
                        active
                            ? (active.message ??
                              (active.status === "connecting"
                                  ? t("Connecting to {label}…", { label: active.label })
                                  : `${active.label} is disconnected.`))
                            : "Waiting for this machine's KissOpen Agent."
                    }
                    icon={active?.status === "error" ? "shield" : "link"}
                    size="panel"
                    title={active ? active.label : t("No machine")}
                />
            </>
        );
    };

    return (
        <KissopenAgentVersionProvider lastKnownVersion={active?.version}>
            {/* Window chrome has one lifetime. Kissopen Agent workspaces keep their own
                keyed lifetimes inside its content region, so changing machines
                resets machine-owned UI without rebuilding this sidebar's DOM,
                focus, width, collapsed state, or scroll position. */}
            <AppShell
                sidebarCollapsible
                {...(props.sidebarVisibility
                    ? {
                          sidebarCollapsed: sidebarVisibility.hidden,
                          onSidebarCollapsedChange: sidebarVisibilityStore.sidebarHiddenUpdate,
                      }
                    : {})}
                shortcutHints="interactive"
                shortcutHintsSurface={paletteHints}
                windowControls={desktop}
                windowControlsAtEnd={controlsAtEnd}
                windowFullScreen={windowState.fullScreen}
                connectionRail={windowState.connectionRail}
                sidebar={sidebar}
                /* Only a host destination puts a panel here. The workspace
                   has its own shell with its own panel, and two of them in
                   one window would be two dividers to drag. */
                {...(cloudDestinations.panel
                    ? {
                          panel: cloudDestinations.panel,
                          panelResizable: true,
                          panelWidth: cloudDestinations.panelWidth ?? APP_SHELL_PANEL_DEFAULT_WIDTH,
                          ...(cloudDestinations.onPanelWidthChange
                              ? { onPanelWidthChange: cloudDestinations.onPanelWidthChange }
                              : {}),
                      }
                    : {})}
            >
                {cloudDestinations.content ?? routeContent()}
            </AppShell>
            {/* Command-K belongs to the window rather than to a workspace: it is
                offered on every route, including the ones no machine is behind.
                It only opens. The dispatcher stands down while any dialog is
                showing, so the palette's own key closes it from inside the card
                and the two never fight over one chord.

                A host that keeps no palette binds nothing: swallowing the chord
                to do nothing with it is worse than leaving it to whatever else
                the reader has bound Command-K to. */}
            {props.commandPalette ? (
                <WindowShortcuts
                    actions={[
                        {
                            run: () => commandPaletteStore.paletteOpen(),
                            shortcut: APP_SHORTCUTS.paletteOpen,
                        },
                    ]}
                />
            ) : null}
            {/* The window's own dialogs, mounted once beside whatever screen is
                showing rather than inside one of them. Naming a row belongs to
                the sidebar, and Create belongs to the window: both are reached
                from chrome that is on every route, so a cog or a Create that
                answered on the workspace and did nothing on the inbox would not
                be a control. Being outside the screen is also what lets a task
                being written survive the route notifications underneath it. */}
            {active?.session?.botSettings ? (
                <KissopenAgentBotSettingsHost
                    bots={active.bots}
                    store={active.session.botSettings()}
                />
            ) : null}
            {active?.session?.workspace ? (
                <KissopenAgentWindowDialogs
                    projects={active.projects}
                    kissopenAgentOnline={activeKissopenAgentOnline}
                    workspace={active.session.workspace}
                    {...(activeAvailability?.refusal === undefined
                        ? {}
                        : { unavailable: activeAvailability.refusal })}
                />
            ) : null}
            {/* The palette is mounted only while it is open, so nothing in the
                window pays for a surface nobody has asked for, and its own
                subscriptions — the workspace above all — start with it. */}
            {commandPaletteOpen ? (
                active?.session?.workspace ? (
                    <KissopenAgentCommandPaletteSurface
                        {...paletteSubject}
                        workspace={active.session.workspace}
                        {...paletteActions}
                    />
                ) : (
                    <KissopenAgentCommandPalette
                        {...paletteSubject}
                        {...paletteActions}
                        facts={PALETTE_WORKSPACE_ABSENT}
                    />
                )
            ) : null}
        </KissopenAgentVersionProvider>
    );
}

/**
 * What the palette and its held-Command preview are both about: the machine on
 * screen, where in it the reader is standing, and what this window could do
 * from there. Both surfaces answer the same question, so neither is given its
 * own idea of the subject.
 */
interface KissopenAgentPaletteSubject {
    kissopenAgentId: string;
    projects: readonly KissopenAgentProjectGroup[];
    bots: readonly KissopenAgentBot[];
    groupId?: string;
    chatId?: string;
    /** Whether the machine can be asked to do anything at this moment. */
    online: boolean;
    /** The project a new workspace would be made in, when there is one. */
    workspaceCreateProjectId?: KissopenAgentProjectId;
    updateReady?: { readonly action: "refresh" | "restart"; readonly version?: string };
    workspace?: KissopenAgentWorkspaceStore;
}

/** The window acts the palette can commit to. */
interface KissopenAgentPaletteActions {
    appearance: AppearanceStore;
    experiments: ExperimentsStore;
    titleShimmer: TitleShimmerStore;
    store: CommandPaletteStore;
    kissopenAgentOnline: () => boolean;
    onChatSelect(kissopenAgentId: string, groupId: string | undefined, chatId?: string): void;
    onFileSelect(
        kissopenAgentId: string,
        groupId: string,
        chatId: string | undefined,
        path: string,
        kind: KissopenAgentFileTabKind,
    ): void;
    onSettingsOpen(): void;
    onSettingsSectionOpen?(section: string): void;
    onUpdateApply?(): void;
}

/**
 * The part of the offer only the open workspace can answer: which sessions it
 * has closed, what its strip currently holds, whether it can take another chat,
 * and which session each of its groups would resume.
 */
interface KissopenAgentPaletteFacts {
    readonly archivedSessions: readonly KissopenAgentSessionSummary[];
    readonly tabs: readonly CommandPaletteTab[];
    readonly sessionCreateAvailable: boolean;
    readonly groupResume?: ReadonlyMap<KissopenAgentGroupId, KissopenAgentSessionId>;
}

/**
 * What a window with no workspace behind it can say. It offers no chats it
 * would not be able to open and no creation it could not perform, which leaves
 * the palette its workspaces, its settings, and the way into them.
 */
const PALETTE_WORKSPACE_ABSENT: KissopenAgentPaletteFacts = {
    archivedSessions: [],
    sessionCreateAvailable: false,
    tabs: [],
};

/** The open workspace's strip, sessions and files together in the reader's order. */
function paletteTabs(
    workspace: KissopenAgentWorkspaceSnapshot,
    openGroup: OpenGroup | undefined,
): CommandPaletteTab[] {
    if (!openGroup) return [];
    return tabsOrdered<CommandPaletteTab>(
        [
            ...openGroup.conversations.map((summary) => ({
                kind: "session" as const,
                id: summary.id,
                title: summary.title,
            })),
            ...workspace.fileTabs
                .filter((tab) => tab.groupId === openGroup.id && tab.placement === "main")
                .map((tab) => ({
                    kind: "file" as const,
                    id: tab.id,
                    path: tab.path,
                    fileKind: tab.kind,
                    icon: fileTabIcon(tab.path, tab.kind),
                })),
        ],
        workspace.tabOrder,
    );
}

/**
 * The workspace's answer, read once for whichever palette surface is showing.
 *
 * Whether another chat may be started here is the workspace's own rule, taken
 * from the same three facts the workspace surface's own control reads, so the
 * palette never offers a New chat that screen would have greyed out.
 */
function paletteFacts(
    workspace: KissopenAgentWorkspaceSnapshot,
    groupId: string | undefined,
    online: boolean,
): KissopenAgentPaletteFacts {
    const rows = workspace.list.projects.type === "ready" ? workspace.list.projects.value : [];
    const openGroup = openGroupFind(rows, workspace.list.bots, groupId);
    return {
        archivedSessions: workspace.list.archivedSessions,
        groupResume: workspace.groupResume,
        sessionCreateAvailable:
            online &&
            openGroup?.create !== undefined &&
            workspace.groupAccess.conversationRefusal === undefined &&
            workspaceLifecyclePhase(openGroup.lifecycle) !== "creating",
        tabs: paletteTabs(workspace, openGroup),
    };
}

/**
 * The palette over an open workspace. It exists to hold that one subscription:
 * the workspace repaints as fast as a transcript does, and reading it here
 * keeps those frames inside the palette instead of re-rendering the window
 * around it. Frame-coalesced for the same reason the window's dialogs are.
 */
function KissopenAgentCommandPaletteSurface(
    props: KissopenAgentPaletteSubject &
        KissopenAgentPaletteActions & { workspace: KissopenAgentWorkspaceStore },
) {
    const workspace = useSyncExternalStore(
        reactFrameSubscribe(props.workspace),
        props.workspace.get,
        props.workspace.get,
    );
    return (
        <KissopenAgentCommandPalette
            {...props}
            facts={paletteFacts(workspace, props.groupId, props.online)}
        />
    );
}

/** The same reading, for the held-Command card. */
function KissopenAgentQuickActionsSurface(
    props: KissopenAgentPaletteSubject & { workspace: KissopenAgentWorkspaceStore },
) {
    const workspace = useSyncExternalStore(
        reactFrameSubscribe(props.workspace),
        props.workspace.get,
        props.workspace.get,
    );
    return (
        <KissopenAgentQuickActions
            {...props}
            facts={paletteFacts(workspace, props.groupId, props.online)}
        />
    );
}

/** Everything the results are computed from, assembled once for either surface. */
function paletteContext(
    subject: KissopenAgentPaletteSubject,
    facts: KissopenAgentPaletteFacts,
): CommandPaletteContext {
    return {
        archivedSessions: facts.archivedSessions,
        groupId: subject.groupId,
        kissopenAgentId: subject.kissopenAgentId,
        projects: subject.projects,
        sessionCreateAvailable: facts.sessionCreateAvailable,
        tabs: facts.tabs,
        updateReady: subject.updateReady,
        workspaceCreateAvailable:
            subject.online &&
            subject.workspace !== undefined &&
            subject.workspaceCreateProjectId !== undefined,
    };
}

/**
 * What holding Command puts in the middle of the window: the rows the empty
 * palette would offer, each wearing the chord that runs it.
 *
 * It is the same list, from the same transform, so the card is a preview of the
 * palette rather than a second opinion about what matters. Rows the card cannot
 * draw — a workspace's picture, a live settings control — are left out rather
 * than approximated; suggestions produce none today.
 */
function KissopenAgentQuickActions(
    props: KissopenAgentPaletteSubject & { facts: KissopenAgentPaletteFacts },
) {
    const items = commandPaletteSuggestionRows(paletteContext(props, props.facts))
        .slice(0, COMMAND_PALETTE_PREVIEW_LIMIT)
        .flatMap((row): QuickActionsCardItem[] =>
            row.kind !== "command" || row.glyph.kind === "avatar"
                ? []
                : [
                      {
                          id: row.id,
                          title: row.title,
                          ...(row.glyph.kind === "emphasis"
                              ? { emphasis: row.glyph.emphasis }
                              : { icon: row.glyph.name }),
                          ...(row.shortcut ? { shortcut: row.shortcut } : {}),
                      },
                  ],
        );
    return <QuickActionsCard items={items} />;
}

/**
 * The window's command palette: one query over everything this machine holds,
 * and the settings it can change without going anywhere.
 *
 * The card owns its own focus, its Escape, and its ⌘K; the list owns nothing
 * but drawing. What is left here is the middle: which rows are offered, which
 * one Enter would run, and what running it does. The highlight is an index in
 * the state store rather than local state, and the rows are recomputed from
 * live snapshots on every render, so a session that finishes or a setting
 * changed from its own row moves under the reader without being asked to.
 */
function KissopenAgentCommandPalette(
    props: KissopenAgentPaletteSubject &
        KissopenAgentPaletteActions & { facts: KissopenAgentPaletteFacts },
) {
    const palette = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const experiments = useSyncExternalStore(
        props.experiments.subscribe,
        props.experiments.get,
        props.experiments.get,
    );
    const titleShimmer = useSyncExternalStore(
        props.titleShimmer.subscribe,
        props.titleShimmer.get,
        props.titleShimmer.get,
    );
    const results = commandPaletteResults({
        ...paletteContext(props, props.facts),
        query: palette.query,
        scrollbarVisibility: appearance.scrollbarVisibility,
        themeMode: appearance.mode,
        titleShimmerEnabled: titleShimmer.titleShimmerEnabled,
    });
    const sections = results.sections.map(
        (section): CommandPaletteResultsSection => ({
            caption: section.label,
            id: section.id,
            rows: section.rows.map((row) => paletteResultsRow(row, props)),
        }),
    );
    // The list's own flat order, so the index the reader arrows through and the
    // order they are looking at cannot come apart.
    const length = commandPaletteResultsRows(sections).length;

    /** Runs one row. A settings row answers in place; anything else is a departure. */
    const rowCommit = (index: number) => {
        const row = commandPaletteRowAt(results, index);
        if (!row) return;
        if (row.kind === "setting") {
            paletteSettingCommit(row, props);
            return;
        }
        // The palette closes before the act rather than after it: navigation
        // moves the window under it, and a surface that goes away as a result
        // of what it did looks like it failed to.
        props.store.paletteClose();
        paletteCommandRun(row.command, props);
    };

    return (
        <ModalOverlay onDismiss={() => props.store.paletteClose()} placement="top">
            <CommandPalette
                onClose={() => props.store.paletteClose()}
                onQueryChange={(value) => props.store.queryUpdate(value)}
                onSelectionCommit={() => rowCommit(palette.activeIndex)}
                onSelectionMove={(direction) =>
                    props.store.activeIndexUpdate(
                        commandPaletteIndexMove(palette.activeIndex, direction, length),
                    )
                }
                placeholder={t("Search chats, workspaces, and settings…")}
                query={palette.query}
            >
                <CommandPaletteResults
                    activeIndex={palette.activeIndex}
                    emptyDescription={t("Try a different search.")}
                    emptyLabel={t("No results")}
                    label={t("Command palette results")}
                    onActiveIndexChange={(index) => props.store.activeIndexUpdate(index)}
                    onSelect={(_id, index) => rowCommit(index)}
                    sections={sections}
                />
            </CommandPalette>
        </ModalOverlay>
    );
}

/** One computed row as the list draws it: a command, or a settings row itself. */
function paletteResultsRow(
    row: CommandPaletteRow,
    actions: KissopenAgentPaletteActions,
): CommandPaletteResultsRow {
    if (row.kind === "setting")
        return {
            control: paletteSettingControl(row, actions),
            description: row.description,
            id: row.id,
            kind: "control",
            // The control is opaque to the list, so what it is called has to be
            // given: the same words the hosted FormRow shows.
            label: row.label,
        };
    return {
        id: row.id,
        kind: "command",
        title: row.title,
        ...(row.meta === undefined ? {} : { meta: row.meta }),
        // The lane the computed row already decided: a glyph, the thing's own
        // picture, or the product's mark for what kind of news this row is.
        ...(row.glyph.kind === "icon"
            ? { icon: row.glyph.name }
            : row.glyph.kind === "emphasis"
              ? { emphasis: row.glyph.emphasis }
              : {
                    avatar: {
                        initials: row.glyph.initials,
                        ...(row.glyph.imageUrl === undefined
                            ? {}
                            : { imageUrl: row.glyph.imageUrl }),
                    },
                }),
        ...(row.shortcut ? { shortcut: row.shortcut } : {}),
    };
}

/**
 * A settings row, as the settings page itself renders it — the same `FormRow`,
 * the same control, the same words, wired to the same store action. The row in
 * the palette is that row, so changing it here is changing it there.
 */
function paletteSettingControl(
    row: CommandPaletteSettingRow,
    actions: KissopenAgentPaletteActions,
): ReactNode {
    switch (row.setting) {
        case "themeMode":
            return (
                <FormRow
                    control={
                        <SegmentedControl
                            aria-label={row.label}
                            onChange={(value) =>
                                actions.appearance.appearanceSelect(value as ThemeMode)
                            }
                            segments={[...row.control.segments]}
                            size="small"
                            value={row.control.value}
                        />
                    }
                    description={row.description}
                    label={row.label}
                />
            );
        case "scrollbarVisibility":
            return (
                <FormRow
                    control={
                        <SegmentedControl
                            aria-label={row.label}
                            onChange={(value) =>
                                actions.appearance.scrollbarVisibilitySelect(
                                    value as ScrollbarVisibility,
                                )
                            }
                            segments={[...row.control.segments]}
                            size="small"
                            value={row.control.value}
                        />
                    }
                    description={row.description}
                    label={row.label}
                />
            );
        case "titleShimmer":
            return (
                <FormRow
                    control={
                        <Switch
                            aria-label={row.label}
                            checked={row.control.checked}
                            id={row.controlId}
                            onChange={(checked) => actions.titleShimmer.titleShimmerUpdate(checked)}
                            size="small"
                        />
                    }
                    description={row.description}
                    htmlFor={row.controlId}
                    label={row.label}
                />
            );
    }
}

/**
 * Enter on a settings row. It moves the setting to the value the row already
 * carries and leaves the palette exactly where it was: the reader is looking at
 * the thing they changed, and taking the window away would be the one answer
 * they did not ask for.
 */
function paletteSettingCommit(row: CommandPaletteSettingRow, actions: KissopenAgentPaletteActions) {
    switch (row.setting) {
        case "themeMode":
            actions.appearance.appearanceSelect(row.control.next);
            return;
        case "scrollbarVisibility":
            actions.appearance.scrollbarVisibilitySelect(row.control.next);
            return;
        case "titleShimmer":
            actions.titleShimmer.titleShimmerUpdate(row.control.next);
            return;
    }
}

/** What committing a row does, once the palette has stood down. */
function paletteCommandRun(
    command: CommandPaletteCommand,
    props: KissopenAgentPaletteSubject &
        KissopenAgentPaletteActions & { facts: KissopenAgentPaletteFacts },
) {
    switch (command.kind) {
        case "chatOpen": {
            if (!command.archived) {
                props.onChatSelect(command.kissopenAgentId, command.groupId, command.chatId);
                return;
            }
            // A closed session is asked of the host by id: it stopped listing
            // the agent when it was archived, so it is restored before it is
            // addressed — the same order the workspace's recents menu uses.
            const workspace = props.workspace;
            if (!workspace || !props.kissopenAgentOnline()) return;
            void workspace
                .conversationRestore(command.chatId as KissopenAgentSessionId)
                .then(() =>
                    props.onChatSelect(command.kissopenAgentId, command.groupId, command.chatId),
                )
                .catch(() => undefined);
            return;
        }
        case "workspaceOpen": {
            // A workspace opens where the reader left it, exactly as its
            // sidebar row does; one never visited falls back to its first chat.
            const resume =
                props.facts.groupResume?.get(command.groupId as KissopenAgentGroupId) ??
                openGroupFind(props.projects, props.bots, command.groupId)?.conversations[0]?.id;
            props.onChatSelect(command.kissopenAgentId, command.groupId, resume);
            return;
        }
        case "fileOpen":
            props.onFileSelect(
                command.kissopenAgentId,
                command.groupId,
                props.chatId,
                command.path,
                command.fileKind,
            );
            return;
        case "sessionCreate": {
            const workspace = props.workspace;
            const group = openGroupFind(props.projects, props.bots, props.groupId);
            if (!workspace || !group?.create || !props.kissopenAgentOnline()) return;
            void workspace.conversationCreate(group.id, group.create).catch(() => undefined);
            return;
        }
        case "workspaceCreate": {
            const workspace = props.workspace;
            const projectId = props.workspaceCreateProjectId;
            if (!workspace || projectId === undefined || !props.kissopenAgentOnline()) return;
            void workspace.worktreeCreate(projectId).catch(() => undefined);
            return;
        }
        case "settingsOpen":
            props.onSettingsOpen();
            return;
        case "settingsSectionOpen":
            if (props.onSettingsSectionOpen) props.onSettingsSectionOpen(command.section);
            else props.onSettingsOpen();
            return;
        case "updateApply":
            props.onUpdateApply?.();
            return;
    }
}

/**
 * One KISSOPEN Agent's inbox inside the window's shell. It subscribes to nothing: the
 * window already reads this store for the sidebar count, so the queue and the
 * badge are one subscription and can never disagree about how many questions
 * are waiting.
 *
 * Naming an item's location and opening the session that asked are addressing
 * acts, which is why they live here rather than in the page: the page renders
 * questions, the window decides where they came from and where they lead.
 */
function KissopenAgentInboxSurface(props: {
    onOpenSession(kissopenAgentId: string, groupId: string, chatId: string): void;
    projects: readonly KissopenAgentProjectGroup[];
    kissopenAgentId: string;
    kissopenAgentOnline: () => boolean;
    snapshot: KissopenAgentInboxSnapshot;
    store: KissopenAgentInboxStore;
    unavailable?: string;
}) {
    const locate = (item: KissopenAgentInboxItem) => {
        const scope = item.scope;
        if (!scope) return undefined;
        const project = props.projects.find((candidate) => candidate.id === scope.projectId);
        if (!project) return undefined;
        if (scope.kind === "project") return project.name;
        const worktree = project.worktrees.find((candidate) => candidate.id === scope.worktreeId);
        return worktree ? `${project.name} · ${worktree.name}` : project.name;
    };
    return (
        <KissopenAgentInboxPage
            answered={props.snapshot.answered}
            {...(props.snapshot.error ? { error: props.snapshot.error } : {})}
            itemLocation={locate}
            itemTime={(item) =>
                inboxItemTime(item.status === "answered" ? item.resolvedAt : item.createdAt)
            }
            loading={props.snapshot.loading}
            messages={props.snapshot.messages}
            onAnswer={(itemId, answers) => {
                if (props.kissopenAgentOnline()) props.store.itemAnswer(itemId, answers);
            }}
            onMessageChange={(itemId, text) => props.store.itemMessageUpdate(itemId, text)}
            onMessageSubmit={(itemId) => {
                if (props.kissopenAgentOnline()) props.store.itemMessageSubmit(itemId);
            }}
            onSelectionChange={(itemId, answers) =>
                props.store.itemSelectionUpdate(itemId, answers)
            }
            selections={props.snapshot.selections}
            onOpenSession={(item) => {
                if (!item.scope) return;
                props.onOpenSession(
                    props.kissopenAgentId,
                    kissopenAgentSessionGroupIdOf(item.scope),
                    item.sessionId,
                );
            }}
            pending={props.snapshot.pending}
            submissions={props.snapshot.submissions}
            {...(props.unavailable === undefined ? {} : { unavailable: props.unavailable })}
        />
    );
}

/** When a question was asked or settled, as an absolute local time. */
function inboxItemTime(value: number | undefined): string | undefined {
    if (value === undefined) return undefined;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
    );
}

interface KissopenAgentWorkspaceSurfaceProps {
    browserAutomation?: import("kissopen-desktop-ui").BrowserAutomationRenderer;
    /** Offered on the page shown while no project is open. */
    workExamples?: readonly WorkStartExample[];
    /** Listed on that page, so every project can be opened from 工作. */
    workProjects?: CloudDestinations["workProjects"];
    /** The machine this workspace belongs to; boards are kept per machine and project. */
    kissopenAgentId: string;
    /** Projects' board schedules and how to build; absent where there is no account. */
    boards?: CloudDestinations["boards"];
    /** Speaking into a composer; see `AppKissopenAgentViewProps.dictation`. */
    readonly dictation?: DictationStore;
    browserConnectionId: string | null;
    /** Opens Scheduled tasks with a task the assistant proposed; see `AppKissopenAgentViewProps`. */
    onScheduleProposalOpen?: (request: string) => void;
    /** Opens Scheduled tasks at a task the agent created, by its ID. */
    onScheduledTaskOpen?: (scheduleId: string) => void;
    /** Unified outer route and daemon health for this already materialized Kissopen Agent. */
    availability: KissopenAgentAvailabilitySnapshot;
    /** Re-reads unified availability when a retained network handler fires. */
    kissopenAgentOnline: () => boolean;
    /** Joined conversation-list + active-conversation product store. */
    workspace: KissopenAgentWorkspaceStore;
    /**
     * The Kissopen Agent's projects, for the surfaces that address a project the window is
     * not currently open on — the settings dialog reached from any row.
     */
    projects: readonly KissopenAgentProjectGroup[];
    /** Ticking clock feeding relative timestamps in the conversation list. */
    clock: KissopenAgentClockStore;
    appearance: AppearanceStore;
    platform?: "desktop" | "web";
    browserContent?: BrowserContentRenderer;
    htmlPreview?: HtmlPreviewRenderer;
    mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    documentConversion?: KissopenAgentDocumentConversionOpener;
    /** Whether active session titles shimmer in the tab strip. */
    titleShimmerEnabled: boolean;
    /** Identity of the human reading and writing this KISSOPEN Agent. */
    viewerId: string;
    groupId?: string;
    chatId?: string;
    /** Ready online project that Cmd-N and its sidebar cap both address. */
    workspaceCreateProjectId?: KissopenAgentProjectId;
    onChatSelect(groupId: string | undefined, chatId?: string, replace?: boolean): void;
    onChatClose(groupId: string, chatId: string, fallbackChatId?: string): boolean;
    onFileClose(groupId: string, path: string): void;
    onFileSelect(
        groupId: string,
        chatId: string | undefined,
        path: string,
        kind: KissopenAgentFileTabKind,
        replace?: boolean,
    ): void;
}

/**
 * One KISSOPEN Agent's workspace. It subscribes once each to that Kissopen Agent's connection,
 * workspace, panel, clock, and appearance stores (no local React state) and
 * composes the shared `kissopen-desktop-ui` components, including `ConversationView`
 * for the selected conversation and the desktop affordances (the model and
 * effort pickers beneath the composer, the settings
 * dialog holding the view toggles and access pickers, and the usage and activity
 * panels) passed into that surface.
 *
 * The right panel is the workspace's tool column: terminals now, other kinds of
 * tab later. It is a second subscription rather than part of the workspace
 * snapshot because a live terminal repaints far faster than the conversation does
 * and must not drag this whole surface through a render to do it.
 *
 * Until this Kissopen Agent's daemon connection is live it shows the connection status with
 * a retry. Which conversation is shown comes from the route through `chatId`, and
 * choosing another one is a navigation request; materialization and every draft
 * keystroke live in the workspace store outside React, so this component stays a
 * pure projection.
 */
function KissopenAgentWorkspaceSurface(props: KissopenAgentWorkspaceSurfaceProps) {
    const workspaceFocusedPane = useRef<AppShellFocusedPane>("workspace");
    // AppShell's panel callback ref treats this callback's identity as the
    // panel lifetime, so ordinary store renders must keep it stable.
    const workspaceFocusedPaneChange = useCallback((pane: AppShellFocusedPane): void => {
        workspaceFocusedPane.current = pane;
    }, []);
    const workspace = useSyncExternalStore(
        reactFrameSubscribe(props.workspace),
        props.workspace.get,
        props.workspace.get,
    );
    const panel = useSyncExternalStore(
        props.workspace.panel.subscribe,
        props.workspace.panel.get,
        props.workspace.panel.get,
    );
    const now = useSyncExternalStore(props.clock.subscribe, props.clock.get, props.clock.get);
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    // A materialized workspace is a KISSOPEN Agent lifetime, not a connection lifetime.
    // Health only changes what this mounted surface may do and what it says
    // about the state already on screen.
    const availability = props.availability;
    const connectionRefusal = availability.refusal;
    const kissopenAgentOnline = props.kissopenAgentOnline;
    const terminalKissopenAgentAvailability = availability.online
        ? undefined
        : availability.state === "reconnecting"
          ? ("reconnecting" as const)
          : ("unavailable" as const);

    // Inside an open project the directory is already decided, so every "new
    // session" affordance here starts one in it rather than asking again.
    const groupConversationCreate = (group: OpenGroup) => {
        if (!kissopenAgentOnline() || !group.create) return;
        void props.workspace.conversationCreate(group.id, group.create).catch(() => undefined);
    };

    const projects = workspace.list.projects;
    const rows = projects.type === "ready" ? projects.value : [];
    // What may be done in the addressed checkout, as the state decided it.
    // Connection health stays separate: each control combines the relevant
    // durable refusal with connection state at the boundary where it acts.
    const access = workspace.groupAccess;
    // Why a chat cannot be started here or sent to. A workspace whose checkout
    // KISSOPEN Agent is still preparing refuses the second and not the first, so the two
    // reasons are kept apart all the way down to the controls: a composer reads
    // this one, while file and terminal actions read the write refusal above it.
    const openGroupChatRefusal = access.conversationRefusal;
    const openGroup = openGroupFind(rows, workspace.list.bots, props.groupId);
    // A bot is opened as its own dedicated workspace, so the open group is a bot
    // exactly when one of them owns this workspace.
    const openBot = workspace.list.bots.find((bot) => bot.workspaceId === props.groupId);
    // Whether another session may be added here. A workspace whose checkout is
    // still being prepared already has the one it was made with and can take no
    // second: KISSOPEN Agent does not queue an agent against a checkout that is not there,
    // so the control is disabled until it arrives rather than offering a tab
    // that could not open.
    const sessionCreateAvailable =
        openGroup?.create !== undefined &&
        // A bot has exactly one conversation and can never have a second, so
        // the control that would start one is not offered here at all.
        openBot === undefined &&
        connectionRefusal === undefined &&
        openGroupChatRefusal === undefined &&
        workspaceLifecyclePhase(openGroup.lifecycle) !== "creating";
    const workspaceCreateProjectId = props.workspaceCreateProjectId;
    // The worktree phase this screen has to say something about. `ready` and a
    // project both leave it absent: there is nothing to interrupt the reader
    // with when the place they are looking at is simply there.
    const openGroupPhase = workspaceLifecyclePhase(openGroup?.lifecycle);
    // Whether that phase is the whole screen rather than a lane over it. It is,
    // and only is, when nothing has ever run here and nothing ever can: an empty
    // workspace that failed, was refused, or has lost its folder has no composer
    // worth drawing. One that is merely being prepared does — it takes chats
    // already — so the phase goes in the lane above it instead.
    const openGroupNotice =
        openGroup !== undefined &&
        openGroup.conversations.length === 0 &&
        openGroupPhase !== undefined &&
        !access.canConverse;
    // The one phase that takes the body of the first chat rather than a strip
    // above it. A workspace is addressed the instant it is asked for, so this is
    // the screen the reader lands on straight after clicking: the checkout being
    // prepared is the only thing happening here, so it is the only thing shown,
    // with the composer still live underneath it. Every control that would act
    // on a directory that is not there yet is withheld for the same reason —
    // there is nothing behind them to act on until the checkout arrives.
    const openGroupPreparing = openGroupPhase === "creating";
    const panelCloseTarget = openGroupPreparing ? undefined : panelCloseTargetFind(panel);
    // The address the reader was sent to when a creation was accepted locally
    // and then refused. There is no row at it any more — kissopen-agent-connect withdrew
    // the one it had predicted — so the address answers for itself here rather
    // than falling through to "no project open".
    const refusedCreate =
        openGroup === undefined && props.groupId !== undefined
            ? workspace.list.worktreeCreateFailures.get(props.groupId as KissopenAgentWorktreeId)
            : undefined;
    const groupFileTabs = openGroup
        ? workspace.fileTabs.filter(
              (tab) => tab.groupId === openGroup.id && tab.placement === "main",
          )
        : [];
    const activeFile = groupFileTabs.find((tab) => tab.id === workspace.activeMainViewId);
    const displayedFileTab = groupFileTabs.find((tab) => tab.id === workspace.displayedMainViewId);
    const displayedFile =
        displayedFileTab?.displayedDocument === undefined
            ? displayedFileTab
            : {
                  ...displayedFileTab,
                  kind: displayedFileTab.displayedKind ?? displayedFileTab.kind,
                  path: displayedFileTab.displayedPath ?? displayedFileTab.path,
                  document: {
                      type: "ready" as const,
                      value: displayedFileTab.displayedDocument,
                  },
              };
    const pendingFile =
        activeFile &&
        (workspace.displayedMainViewId !== activeFile.id ||
            (activeFile.displayedPresentationId !== activeFile.presentationId &&
                (activeFile.document.type !== "ready" ||
                    activeFile.document.value !== activeFile.displayedDocument)))
            ? activeFile
            : undefined;
    // Terminals and pages the reader moved out of the panel. They belong to the
    // addressed group the way the panel does, so they are listed and drawn here
    // only while that group is the one open.
    const mainTools = openGroup ? toolTabsPlaced(panel, "main") : [];
    const activeMainTool = mainTools.find((tab) => tab.id === workspace.activeMainViewId);
    const displayedMainTool = mainTools.find((tab) => tab.id === workspace.displayedMainViewId);
    const openInRecent = workspace.openInRecent;
    const conversation = workspace.conversation;
    // A chat that belongs to another session rather than to this group's strip.
    // The state says so outright — the host gives such a session no place in an
    // order — because the alternatives all lie at the moment it matters: a
    // session is addressed the instant it is named, so it is legitimately
    // missing from the rows for a moment after the reader creates it, and
    // reading that absence as delegation locked them out of their own new chat
    // and put someone else's name on it.
    const detachedConversationId =
        workspace.conversationDelegated && props.chatId ? props.chatId : undefined;
    const detachedConversation =
        detachedConversationId && conversation.type === "ready" ? conversation.value : undefined;
    const detachedConversationTab: TabItem | undefined = detachedConversationId
        ? {
              id: detachedConversationId,
              // The chat's own mark and the chat's own name, exactly as every
              // other session tab wears them. A shared glyph and the word
              // "Subagent" told the reader which category of thing they had
              // opened, which they already knew, while taking away the one thing
              // that tells this chat apart from the next one.
              avatarId: detachedConversationId,
              label: detachedConversation?.title ?? "Untitled",
              labelShimmer: props.titleShimmerEnabled,
              ...(detachedConversation !== undefined &&
              kissopenAgentConversationWorking(detachedConversation)
                  ? { busy: true }
                  : {}),
          }
        : undefined;
    // Sessions without a list position are delegated children. They remain
    // readable by id, but their runner owns their input and configuration.
    // A workspace that cannot take a chat cannot take a message into an old
    // conversation either: the session is pointed at a checkout that will never
    // be usable, so what it read before stays readable and its input closes with
    // the reason it closed for. A checkout merely still being prepared is not
    // that: KISSOPEN Agent holds the message until the directory arrives, so the input
    // stays open and the reader can keep writing.
    const conversationReadOnly =
        detachedConversationId !== undefined || openGroupChatRefusal !== undefined;
    const conversationReadOnlyReason =
        detachedConversationId !== undefined
            ? conversationLockedPlaceholder(detachedConversation?.title)
            : openGroupChatRefusal;
    // Stopping is not writing. An unusable checkout still has whatever was
    // already running in it, and leaving the reader unable to end that would be
    // work they can see, cannot write to, and cannot stop either.
    const conversationCanAbort =
        availability.online && detachedConversationId === undefined && access.canAbort;
    // One strip, holding the group's sessions and its open files together in
    // the single order the reader arranged. A detached subagent is addressed by
    // id rather than listed, so it is not part of that order and follows it.
    const groupTabs: TabItem[] = [
        ...botTabPin(
            tabsOrdered(
                openGroup
                    ? [
                          ...sessionTabs(openGroup, props.titleShimmerEnabled).map((tab) =>
                              availability.online ? tab : { ...tab, closable: false },
                          ),
                          ...groupFileTabs.map(fileTabItem),
                          ...toolTabItems(mainTools),
                      ]
                    : [],
                workspace.tabOrder,
            ),
            openBot?.conversation.id,
        ),
        ...(detachedConversationTab ? [detachedConversationTab] : []),
    ];
    const historyMenuItems = (): readonly MenuItem[] => {
        if (!openGroup) return [];
        // One list in one order: every session this workspace has, open or
        // closed, most recently active first. It is the session list as the
        // host keeps it — the open rows are the strip's sessions, the closed
        // ones are the archived rows the list still remembers — so the menu
        // answers "what was I just working on here" by time, the way Xcode's
        // recents do, rather than replaying local clicks.
        const openSessionIds = new Set(openGroup.conversations.map((summary) => summary.id));
        const rows = [
            ...openGroup.conversations.map((summary) => ({
                sessionId: summary.id as KissopenAgentSessionId,
                title: summary.title,
                updatedAt: summary.updatedAt,
                open: true,
            })),
            ...workspace.list.archivedSessions
                .filter(
                    (session) =>
                        session.parentSessionId === undefined &&
                        kissopenAgentSessionGroupIdOf(session) === openGroup.id &&
                        !openSessionIds.has(session.id),
                )
                .map((session) => ({
                    sessionId: session.id,
                    title: session.title?.trim() || `Session ${session.id.slice(0, 8)}`,
                    updatedAt: session.lastMessageAt ?? session.updatedAt,
                    open: false,
                })),
        ].sort((left, right) => right.updatedAt - left.updatedAt);
        if (rows.length === 0)
            return [
                {
                    disabled: true,
                    icon: "history",
                    id: "empty",
                    kind: "item",
                    label: t("No sessions yet"),
                },
            ];
        return rows.map(
            (row): MenuItem => ({
                // Selecting an open session is local navigation and works
                // offline; reopening a closed one asks the host.
                disabled: !row.open && !availability.online,
                icon: row.open ? "chat" : "history",
                id: `${HISTORY_SESSION_PREFIX}${row.sessionId}`,
                kind: "item",
                label: row.title,
            }),
        );
    };
    // Closing a tab archives the session behind it, while a file tab simply
    // closes. The close control and every context-menu sweep funnel through
    // this one routine, so a sweep behaves exactly like closing each tab by
    // hand. History is repaired before the session leaves the list. It chooses
    // the most recently visited survivor in this workspace; a requested keeper
    // or the nearest surviving session to the left is its fallback.
    const groupTabsClose = (tabIds: readonly string[], keepId?: string) => {
        const current = props.workspace.get();
        const currentRows =
            current.list.projects.type === "ready" ? current.list.projects.value : [];
        const currentGroup = openGroupFind(currentRows, current.list.bots, current.address.groupId);
        if (!currentGroup) return;
        const panelNow = props.workspace.panel.get();
        const online = kissopenAgentOnline();
        const sessionIds = new Set(currentGroup.conversations.map((summary) => summary.id));
        const fileIds = new Set(
            current.fileTabs
                .filter((tab) => tab.groupId === currentGroup.id && tab.placement === "main")
                .map((tab) => tab.id),
        );
        const toolIds = new Set<string>(
            panelNow.tabs.filter((tab) => tab.placement === "main").map((tab) => tab.id),
        );
        const closeableIds = tabIds.filter(
            (tabId) =>
                fileIds.has(tabId) ||
                toolIds.has(tabId) ||
                (online && sessionIds.has(tabId as KissopenAgentSessionId)),
        );
        const targets = new Set(closeableIds);
        const rest = currentGroup.conversations.filter((summary) => !targets.has(summary.id));
        const selectedSessionIndex = current.address.conversationId
            ? currentGroup.conversations.findIndex(
                  (summary) => summary.id === current.address.conversationId,
              )
            : -1;
        const leftFallbackSessionId =
            selectedSessionIndex < 1
                ? undefined
                : currentGroup.conversations
                      .slice(0, selectedSessionIndex)
                      .reverse()
                      .find((summary) => !targets.has(summary.id))?.id;
        const fallbackSessionId =
            keepId !== undefined && rest.some((summary) => summary.id === keepId)
                ? keepId
                : (leftFallbackSessionId ?? rest[0]?.id);
        let selectedHistoryRepaired = false;
        for (const tabId of closeableIds) {
            if (fileIds.has(tabId)) {
                const file = current.fileTabs.find((tab) => tab.id === tabId);
                if (file) props.onFileClose(file.groupId, file.path);
                props.workspace.fileClose(tabId);
                continue;
            }
            // A terminal or a page closes where it is drawn: it was moved here,
            // not copied, so this is the only tab it has and closing it ends
            // the shell or the page rather than sending it back.
            if (toolIds.has(tabId)) {
                props.workspace.panel.tabClose(tabId as KissopenAgentPanelTabId);
                continue;
            }
            const repaired = props.onChatClose(currentGroup.id, tabId, fallbackSessionId);
            if (tabId === current.address.conversationId) selectedHistoryRepaired = repaired;
            void props.workspace
                .conversationArchive(tabId as KissopenAgentSessionId)
                .catch(() => undefined);
        }
        // A router-backed window repairs and lands through its navigation stack,
        // which preserves the most recently visited survivor. Standalone
        // Blueprint composition has no history owner, so it receives the same
        // left-tab/workspace fallback directly.
        if (
            current.address.conversationId &&
            targets.has(current.address.conversationId) &&
            !selectedHistoryRepaired
        )
            props.onChatSelect(currentGroup.id, fallbackSessionId, true);
    };
    const groupTabClose = (tabId: string) => {
        // A detached subagent's tab is an address, not a member of the list:
        // closing it only steps back to the sessions that are listed.
        if (tabId === detachedConversationId) {
            props.onChatSelect(openGroup?.id, openGroup?.conversations[0]?.id, true);
            return;
        }
        groupTabsClose([tabId]);
    };
    const panelViewClose = (viewId: string) => {
        if (viewId === "activity") props.workspace.activityPanelClose();
        else if (viewId === "usage") props.workspace.usagePanelClose();
        else if (viewId === "preview") props.workspace.panel.previewClose();
        else if (viewId === "file") props.workspace.filePanelClose();
        else props.workspace.panel.tabClose(viewId as KissopenAgentPanelTabId);
    };
    const activeTabClose = () => {
        const panelNow = props.workspace.panel.get();
        const panelTarget = openGroupPreparing ? undefined : panelCloseTargetFind(panelNow);
        if (workspaceFocusedPane.current === "panel" && panelNow.open && !openGroupPreparing) {
            if (panelTarget) panelViewClose(panelTarget);
            else {
                // Files is permanent. Closing from that focused tab dismisses
                // its pane and returns the keyboard to the selected main tab.
                const shell = [
                    ...document.querySelectorAll<HTMLElement>(
                        '[data-kissopen-desktop-ui="app-shell"][data-embedded]',
                    ),
                ].find((element) => element.getClientRects().length > 0);
                const mainTab = shell?.querySelector<HTMLElement>(
                    '[data-kissopen-desktop-ui="app-shell-workspace"] [data-kissopen-desktop-ui="tab"][aria-selected="true"]',
                );
                mainTab?.focus();
                workspaceFocusedPane.current = "workspace";
                props.workspace.panel.panelToggle();
            }
            return;
        }
        const current = props.workspace.get();
        const tabId = current.activeMainViewId ?? current.address.conversationId;
        if (tabId) groupTabClose(tabId);
        else if (openGroup) props.workspace.groupArchiveOpen(openGroup.id);
    };
    // The strip in the order it is drawn, without the detached subagent: it is
    // addressed rather than listed, so a sweep over "the tabs beside this one"
    // never reaches it.
    const sweepableTabs = groupTabs.filter((entry) => entry.id !== detachedConversationId);
    const previewTool = previewToolFind(conversation, panel.previewEntryId);
    const desktop = props.platform === "desktop";

    // Whether the chat this workspace was made with is what is on screen. That
    // chat carries the checkout's phase itself, so the lane above the tab strip
    // does not: a file or a terminal open here is not that chat, and those keep
    // the lane. It is suppressed even when the chat says nothing at all — a new
    // workspace is an ordinary empty chat, and the sidebar row is already
    // showing that its checkout is being prepared.
    const preparingChatOnScreen =
        openGroupPreparing &&
        openGroup !== undefined &&
        activeMainTool === undefined &&
        activeFile === undefined;
    const mainFileBody = (file: KissopenAgentFileTabSnapshot): ReactNode => (
        <KissopenAgentFileBody
            appearance={appearance.appearance}
            file={file}
            {...(props.htmlPreview ? { htmlPreview: props.htmlPreview } : {})}
            key={`${file.id}:${file.kind}`}
            {...(props.mediaWindow ? { mediaWindow: props.mediaWindow } : {})}
            {...(props.documentConversion ? { documentConversion: props.documentConversion } : {})}
            mode={workspace.fileViewMode}
            kissopenAgentOnline={kissopenAgentOnline}
            onMainFileOpen={(path, kind) =>
                props.onFileSelect(file.groupId, props.chatId, path, kind)
            }
            wrap={workspace.fileViewWrap}
            {...(access.writeRefusal === undefined ? {} : { writeRefusal: access.writeRefusal })}
            {...(connectionRefusal === undefined ? {} : { saveRefusal: connectionRefusal })}
            workspace={props.workspace}
        />
    );
    const mainConversationBody =
        openGroup === undefined ? undefined : openGroup.conversations.length === 0 &&
          workspace.groupComposer ? (
            // Files or tools are open here, but no session exists yet. The body
            // under the strip is the same composer that starts the first one.
            <KissopenAgentGroupComposer
                composer={workspace.groupComposer}
                dictation={props.dictation}
                {...(workspace.groupSessionDraft
                    ? { draftMenus: workspace.groupSessionDraft.menus }
                    : {})}
                focusOnType
                groupId={openGroup.id}
                groupName={openGroup.name}
                {...(openBot === undefined ? {} : { assistantName: openBot.name })}
                kissopenAgentOnline={kissopenAgentOnline}
                {...(connectionRefusal === undefined ? {} : { unavailable: connectionRefusal })}
                workspace={props.workspace}
            />
        ) : (
            <KissopenAgentConversationBody
                dictation={props.dictation}
                activitySelected={panel.open && panel.activeViewId === "activity"}
                conversation={conversation}
                emptyContent={
                    openBot?.systemKey === "chief_of_staff" &&
                    conversation.type === "ready" &&
                    openBot.conversation.id === conversation.value.conversationId ? (
                        <EmptyState
                            animation="chief-of-staff"
                            description={t(
                                "This assistant has elevated permissions to configure KissOpen around your needs. Tell it how you want KissOpen to work for you.",
                            )}
                            emphasis="prominent"
                            icon="shield"
                            size="panel"
                            title={t("Your secretary")}
                        />
                    ) : undefined
                }
                focusOnType
                groupId={openGroup.id}
                groupName={openGroup.name}
                {...(openBot === undefined ? {} : { assistantName: openBot.name })}
                now={now}
                {...(connectionRefusal === undefined &&
                openGroupChatRefusal === undefined &&
                openGroup.create !== undefined
                    ? { onCreate: () => groupConversationCreate(openGroup) }
                    : {})}
                onChatSelect={props.onChatSelect}
                {...(props.onScheduleProposalOpen
                    ? { onScheduleProposalOpen: props.onScheduleProposalOpen }
                    : {})}
                {...(props.onScheduledTaskOpen
                    ? { onScheduledTaskOpen: props.onScheduledTaskOpen }
                    : {})}
                onFileOpen={(path) => {
                    if (!kissopenAgentOnline() || !openGroup.create) return;
                    const target = workspacePathRelative(path, openGroup.create.cwd);
                    // Office documents, PDFs and sheets open on the right like any
                    // file, and so does doc, ppt or WPS where the server converts
                    // them. Without that, such a file goes to the application made
                    // for it, and the panel only when that fails, where it says so
                    // and offers the same button.
                    if (!props.documentConversion && filePreviewKind(target) === "converted") {
                        void props.workspace.fileOpenDefault(openGroup.id, target).catch(() => {
                            props.workspace.filePanelOpen(
                                openGroup.id,
                                target,
                                fileTabKind(target),
                            );
                        });
                        return;
                    }
                    props.workspace.filePanelOpen(openGroup.id, target, fileTabKind(target));
                }}
                canAbort={conversationCanAbort}
                readOnly={conversationReadOnly}
                kissopenAgentOnline={kissopenAgentOnline}
                {...(connectionRefusal === undefined ? {} : { unavailable: connectionRefusal })}
                {...(conversationReadOnlyReason === undefined
                    ? {}
                    : { readOnlyReason: conversationReadOnlyReason })}
                {...(connectionRefusal === undefined && openGroupChatRefusal === undefined
                    ? {}
                    : { writeRefusal: connectionRefusal ?? openGroupChatRefusal })}
                viewerId={props.viewerId}
                workspace={props.workspace}
            />
        );

    return (
        <AppShell
            embedded
            panelResizable
            // The width this checkout was last left at, or the shell's own
            // default where nobody has sized it. Passed on every render rather
            // than seeded once, so moving to another project shows that
            // project's width instead of carrying this one's across.
            panelWidth={workspace.panelWidth ?? APP_SHELL_PANEL_DEFAULT_WIDTH}
            onFocusedPaneChange={workspaceFocusedPaneChange}
            onPanelWidthChange={(width) => {
                if (openGroup) props.workspace.panelWidthUpdate(openGroup.id, width);
            }}
            panel={
                // The panel reads and writes the checkout: a file tree, a diff,
                // a terminal. None of them has anything to open until the
                // checkout is there, so while it is being prepared the panel is
                // not drawn at all rather than drawn empty. It comes back on its
                // own — the reader's choice to have it open is untouched here.
                panel.open && !openGroupPreparing ? (
                    <KissopenAgentPanelBody
                        {...(panelCloseTarget ? { closeShortcut: APP_SHORTCUTS.tabClose } : {})}
                        activity={conversation.type === "ready" ? conversation.value : undefined}
                        canStartBrowser={availability.online && openGroup !== undefined}
                        canStartTerminal={availability.online && props.chatId !== undefined}
                        browserContent={props.browserContent}
                        browserConnectionId={props.browserConnectionId}
                        htmlPreview={props.htmlPreview}
                        mediaWindow={props.mediaWindow}
                        documentConversion={props.documentConversion}
                        changes={openGroup?.changes ?? []}
                        {...(openGroup?.changesStatus === undefined
                            ? {}
                            : { changesStatus: openGroup.changesStatus })}
                        expanded={workspace.fileTreeExpanded}
                        collapsed={workspace.fileTreeCollapsed}
                        layout={workspace.fileLayout}
                        onFileSelect={(path) => {
                            if (openGroup && kissopenAgentOnline())
                                props.onFileSelect(
                                    openGroup.id,
                                    props.chatId,
                                    path,
                                    fileTabKind(path),
                                );
                        }}
                        onFileOpen={(path) => {
                            if (openGroup && kissopenAgentOnline()) {
                                const kind = fileTabKind(path);
                                // A double click pins the preview; the address
                                // is unchanged when the first click already
                                // selected this file.
                                props.workspace.fileOpen(openGroup.id, path, kind);
                                props.onFileSelect(openGroup.id, props.chatId, path, kind);
                            }
                        }}
                        onFilePreprocess={(path) => {
                            if (openGroup && kissopenAgentOnline())
                                props.workspace.filePreprocess(
                                    openGroup.id,
                                    path,
                                    fileTabKind(path),
                                );
                        }}
                        onLayoutChange={(layout) => {
                            if (openGroup) props.workspace.fileLayoutUpdate(openGroup.id, layout);
                        }}
                        now={now}
                        {...(availability.online
                            ? {
                                  onActivityProcessStop: (processId: number) => {
                                      void props.workspace
                                          .backgroundProcessStop(processId)
                                          .catch(() => undefined);
                                  },
                              }
                            : {})}
                        onActivityOpen={() => props.workspace.activityPanelOpen()}
                        onUsageOpen={() => props.workspace.usagePanelOpen()}
                        {...(openGroup
                            ? {
                                  onSubagentSelect: (sessionId: string) => {
                                      props.workspace.activityPanelClose();
                                      props.onChatSelect(
                                          openGroup.id,
                                          sessionId as KissopenAgentSessionId,
                                      );
                                  },
                              }
                            : {})}
                        onPanelClose={() => props.workspace.panel.panelToggle()}
                        {...(workspace.panelFile ? { panelFile: workspace.panelFile } : {})}
                        fileBody={mainFileBody}
                        onPanelFileClose={() => props.workspace.filePanelClose()}
                        onViewClose={panelViewClose}
                        onScopeChange={(scope) => {
                            if (
                                openGroup &&
                                (scope === "changed" ||
                                    workspace.workspaceFiles !== undefined ||
                                    kissopenAgentOnline())
                            )
                                props.workspace.fileScopeUpdate(openGroup.id, scope);
                        }}
                        onToggle={(path, expanded) =>
                            props.workspace.fileTreeExpandedUpdate(path, expanded)
                        }
                        onDirectoryPrefetch={(path) =>
                            props.workspace.fileTreeDirectoryPrefetch(path)
                        }
                        onLoadMore={(path) => props.workspace.fileTreeLoadMore(path)}
                        onViewTransfer={(viewId) => {
                            const file =
                                viewId === KISSOPEN_AGENT_PANEL_FILE_VIEW_ID
                                    ? workspace.panelFile
                                    : workspace.fileTabs.find((tab) => tab.id === viewId);
                            props.workspace.viewPlacementUpdate(viewId, "main");
                            if (file)
                                props.onFileSelect(
                                    file.groupId,
                                    props.chatId,
                                    file.path,
                                    file.kind,
                                );
                        }}
                        panel={panel}
                        previewTool={previewTool}
                        {...(terminalKissopenAgentAvailability === undefined
                            ? {}
                            : {
                                  kissopenAgentAvailability: terminalKissopenAgentAvailability,
                                  kissopenAgentAvailabilityReason: availability.message,
                              })}
                        scope={workspace.fileScope}
                        selectedPath={activeFile?.path}
                        store={props.workspace.panel}
                        workspaceFiles={workspace.workspaceFiles}
                        workspaceFilesLoading={workspace.workspaceFilesLoading}
                        {...(openGroup && kissopenAgentOnline()
                            ? {
                                  upload: props.workspace.fileUpload(openGroup.id),
                                  onUploaded: () => {
                                      // Show the files where they landed.
                                      props.workspace.fileScopeUpdate(openGroup.id, "all");
                                      props.workspace.fileTreeExpandedUpdate("uploads", true);
                                  },
                              }
                            : {})}
                    />
                ) : undefined
            }
        >
            {props.chatId && props.groupId && availability.online
                ? props.browserAutomation?.({
                      scope: {
                          kind: "local",
                          agentId: props.chatId,
                          workspaceId: props.groupId,
                          connectionId: props.browserConnectionId,
                      },
                      onOpen: (url, tabId) => {
                          props.workspace.panel.browserAdd(url, tabId);
                      },
                  })
                : null}
            {openGroup ? (
                <>
                    {/* The heading names the project, not the session: every tab
                        beneath it is another session in this one project, so it
                        stays put as they are switched. */}
                    <ChannelHeader
                        // The panel toggle is the mirror of the sidebar's: the same
                        // act at the other edge of the window, so it wears the same
                        // glyph flipped and sits in the header rather than down in
                        // the tab strip. It only appears once the project has a
                        // session, because a panel with no conversation behind it has
                        // nowhere to run a terminal and the control would do nothing.
                        //
                        // Both of them address the checkout, so a workspace
                        // still being prepared carries neither: handing a folder
                        // that does not exist to an editor, or opening a panel
                        // onto it, are the two things this header could offer
                        // that would fail on arrival.
                        actions={
                            openGroupPreparing ? undefined : (
                                <>
                                    {/* Hands this project's directory to another
                                    application, or puts its path on the
                                    clipboard. The path is no longer spelled out
                                    in the header — it said nothing the project's
                                    name did not — so copying it is how it is
                                    still reachable when it is genuinely needed. */}
                                    <KissopenAgentControlMenu
                                        items={[
                                            ...workspace.openInTargets.map((target) => ({
                                                id: target.id,
                                                kind: "item" as const,
                                                label: target.label,
                                                disabled: !availability.online,
                                                ...(target.iconUrl
                                                    ? { iconUrl: target.iconUrl }
                                                    : {}),
                                            })),
                                            ...(workspace.openInTargets.length > 0
                                                ? [{ kind: "separator" as const }]
                                                : []),
                                            {
                                                id: "copy-path",
                                                kind: "item" as const,
                                                label: t("Copy path"),
                                                icon: "doc" as const,
                                            },
                                        ]}
                                        label={t("Open in")}
                                        // The control wears whatever was opened last,
                                        // so the answer to "again, please" is already
                                        // on screen instead of one menu away — and
                                        // once it is worn, the label side hands the
                                        // project straight back to that application
                                        // while only the chevron opens the list.
                                        leadingIconUrl={openInRecent?.iconUrl}
                                        menuAlign="end"
                                        {...(openInRecent && availability.online && openGroup.create
                                            ? {
                                                  onPrimary: () => {
                                                      if (kissopenAgentOnline())
                                                          void props.workspace.openIn(
                                                              openGroup.id,
                                                              openInRecent,
                                                          );
                                                  },
                                                  primaryLabel: t("Open in {label}", {
                                                      label: openInRecent.label,
                                                  }),
                                              }
                                            : {})}
                                        onSelect={(id: string) => {
                                            if (id === "copy-path") {
                                                if (openGroup.create)
                                                    void navigator.clipboard?.writeText(
                                                        openGroup.create.cwd,
                                                    );
                                                return;
                                            }
                                            const target = workspace.openInTargets.find(
                                                (candidate) => candidate.id === id,
                                            );
                                            if (target && kissopenAgentOnline() && openGroup.create)
                                                void props.workspace.openIn(openGroup.id, target);
                                        }}
                                    />
                                    {!panel.open ? (
                                        <Button
                                            aria-label={t("Show panel")}
                                            aria-pressed={false}
                                            icon="panel-expand"
                                            iconOnly
                                            onClick={() => props.workspace.panel.panelToggle()}
                                            shortcut={PANEL_TOGGLE_HINT}
                                            size="small"
                                            variant="ghost"
                                        />
                                    ) : null}
                                </>
                            )
                        }
                        icon={openGroup.home ? "home" : "inbox"}
                        title={openGroup.name}
                    />
                    {/* No banner for an unreachable KISSOPEN Agent. The window says that
                        once, in the band across its top, and repeating it here
                        pushed the transcript down for something the reader was
                        already told — in the one surface where the shift is
                        most expensive. What this conversation still owes is the
                        local part: its composer and actions go read-only, which
                        they do on `availability` without any chrome of their
                        own. */}
                    <WindowShortcuts
                        actions={[
                            // Cmd-W is consistently the workspace's close
                            // command. The live handler simply has nothing to
                            // do when Files or an offline session is the only
                            // current target.
                            { run: activeTabClose, shortcut: APP_SHORTCUTS.tabClose },
                            ...(openGroupPreparing
                                ? []
                                : [
                                      {
                                          run: () => props.workspace.panel.panelToggle(),
                                          shortcut: APP_SHORTCUTS.panelToggle,
                                      },
                                      {
                                          run: () => props.workspace.panel.panelToggle(),
                                          shortcut: APP_SHORTCUTS.panelToggleAlternate,
                                      },
                                  ]),
                            ...(sessionCreateAvailable
                                ? [
                                      {
                                          run: () => groupConversationCreate(openGroup),
                                          shortcut: APP_SHORTCUTS.sessionCreate,
                                      },
                                  ]
                                : []),
                            ...(workspaceCreateProjectId
                                ? [
                                      {
                                          run: () => {
                                              if (kissopenAgentOnline())
                                                  void props.workspace
                                                      .worktreeCreate(workspaceCreateProjectId)
                                                      .catch(() => undefined);
                                          },
                                          shortcut: APP_SHORTCUTS.workspaceCreate,
                                      },
                                  ]
                                : []),
                        ]}
                    />
                    {/* A worktree with work already in it keeps its tab strip and
                        its transcripts, so its phase is stated in the lane above
                        them rather than in place of them: the reader can still
                        read what ran there before the checkout went away. The
                        lane is mounted in every phase, including the ready one,
                        so arriving at or leaving a phase never rebuilds the
                        strip and transcripts underneath it.

                        A checkout being prepared is the exception, whenever its
                        own chat is the thing on screen: that phase is stated
                        inside the chat instead, above its messages and where the
                        reader is already looking, so the lane stays empty rather
                        than saying the same thing twice. */}
                    <WorkspaceLifecycleLane
                        {...(openGroup.lifecycle?.phase === "failed" &&
                        openGroup.lifecycle.reason !== undefined
                            ? { detail: openGroup.lifecycle.reason }
                            : {})}
                        name={openGroup.name}
                        {...(openGroup.path ? { path: openGroup.path } : {})}
                        {...(openGroupPhase !== undefined &&
                        !openGroupNotice &&
                        !preparingChatOnScreen
                            ? { phase: openGroupPhase }
                            : {})}
                    />
                    {openGroupNotice ? (
                        // Nothing has run here and the place itself will never
                        // take one: a composer would collect a message for a
                        // checkout that is not coming. What happened to the
                        // workspace is the whole screen instead.
                        //
                        // A checkout Kissopen Agent is still preparing is deliberately not
                        // this case. Kissopen Agent has already said where it will be and
                        // holds a session's work until it is there, so an empty
                        // new workspace shows its composer immediately with the
                        // lane above saying what is happening to it.
                        <WorkspaceLifecycleNotice
                            {...(openGroup.lifecycle?.phase === "failed" &&
                            openGroup.lifecycle.reason !== undefined
                                ? { detail: openGroup.lifecycle.reason }
                                : {})}
                            name={openGroup.name}
                            {...(openGroup.path ? { path: openGroup.path } : {})}
                            phase={openGroupPhase}
                        />
                    ) : (
                        <TabbedPane
                            actions={
                                /* A tab is a session, so adding one creates it
                                   directly in the addressed project or worktree
                                   instead of opening the task form. It follows
                                   the last tab, the way an editor's "new tab"
                                   does. A workspace that cannot host one keeps
                                   the control and disables it: the strip is the
                                   same strip throughout a checkout being
                                   prepared, so the button goes grey for a moment
                                   rather than appearing out of nowhere when it
                                   arrives.

                                   A bot is the exception, and it is not left
                                   grey: a checkout is only briefly unable to
                                   take a session, while a bot can never take a
                                   second one at all, and a control that will
                                   never come back is a control to leave out. */
                                openBot ? null : (
                                    <Button
                                        aria-label={t("Create a session in this project")}
                                        disabled={!sessionCreateAvailable}
                                        icon="plus"
                                        iconOnly
                                        onClick={() => groupConversationCreate(openGroup)}
                                        shortcut={APP_SHORTCUTS.sessionCreate}
                                        size="small"
                                        variant="ghost"
                                    />
                                )
                            }
                            trailing={
                                /* The strip's own control, not the next thing
                                   after the last tab: it offers everything this
                                   workspace has closed, however many tabs are
                                   open. So it holds the bar's far edge, in the
                                   same column as the header control above it,
                                   instead of sliding along with the tabs. */
                                <MenuButton
                                    align="end"
                                    icon="history"
                                    iconSize={12}
                                    items={historyMenuItems}
                                    label={t("Show recent sessions")}
                                    menuMaxHeight={420}
                                    menuLabel="Recent sessions"
                                    menuPageSize={100}
                                    menuWidth={300}
                                    onSelect={(id) => {
                                        if (!id.startsWith(HISTORY_SESSION_PREFIX)) return;
                                        const sessionId = id.slice(
                                            HISTORY_SESSION_PREFIX.length,
                                        ) as KissopenAgentSessionId;
                                        // A session still in the strip is a
                                        // plain selection. A closed one is asked
                                        // of the host by id: it stopped listing
                                        // the agent when it was archived, so
                                        // there is no catalog entry left to
                                        // check the request against first.
                                        if (
                                            openGroup.conversations.some(
                                                (summary) => summary.id === sessionId,
                                            )
                                        ) {
                                            props.onChatSelect(openGroup.id, sessionId);
                                            return;
                                        }
                                        void props.workspace
                                            .conversationRestore(sessionId)
                                            .then(() => props.onChatSelect(openGroup.id, sessionId))
                                            .catch(() => undefined);
                                    }}
                                />
                            }
                            activeId={workspace.activeMainViewId ?? props.chatId ?? ""}
                            closeLabel={t("Close tab")}
                            closeShortcut={APP_SHORTCUTS.tabClose}
                            onClose={groupTabClose}
                            onDoubleClick={(tabId) => {
                                const file = groupFileTabs.find((tab) => tab.id === tabId);
                                if (file)
                                    props.workspace.fileOpen(file.groupId, file.path, file.kind);
                            }}
                            onReorder={(tabIds: readonly string[]) => {
                                // A detached subagent has no place in the
                                // order, so it is taken out of both sides of
                                // the comparison rather than dragged into one.
                                const orderable = (ids: readonly string[]) =>
                                    ids.filter(
                                        (id) =>
                                            id !== detachedConversationId && id !== BOARD_TAB_ID,
                                    );
                                const move = sidebarReorderMove(
                                    orderable(groupTabs.map((tab) => tab.id)),
                                    orderable(tabIds),
                                );
                                if (!move) return;
                                props.workspace.tabReorder(move.id, move.afterId);
                            }}
                            onSelect={(tabId) => {
                                const file = groupFileTabs.find((tab) => tab.id === tabId);
                                if (file) {
                                    props.onFileSelect(
                                        file.groupId,
                                        props.chatId,
                                        file.path,
                                        file.kind,
                                    );
                                    return;
                                }
                                if (mainTools.some((tab) => tab.id === tabId)) {
                                    props.workspace.mainViewSelect(tabId);
                                    return;
                                }
                                // The board is the project with no conversation addressed.
                                props.onChatSelect(
                                    openGroup.id,
                                    tabId === BOARD_TAB_ID ? undefined : tabId,
                                );
                            }}
                            onTransfer={(tabId) => {
                                const file = groupFileTabs.find((tab) => tab.id === tabId);
                                const selected = workspace.activeMainViewId === tabId;
                                props.workspace.viewPlacementUpdate(tabId, "panel");
                                // Moving the addressed file beside the session
                                // uncovers that session in the main region, so
                                // its address must stop claiming the file is
                                // still selected there.
                                if (file && selected)
                                    props.onChatSelect(openGroup.id, props.chatId, true);
                            }}
                            // A session is what the address names, so it stays
                            // where the address points; a diff is two revisions
                            // read together and the panel's viewer reads one
                            // file, so it has nowhere over there to land; and a
                            // file with text that has not been written back
                            // keeps its edit rather than its place.
                            transferable={(tab) =>
                                mainTools.some((entry) => entry.id === tab.id) ||
                                groupFileTabs.some(
                                    (entry) =>
                                        entry.id === tab.id &&
                                        entry.kind !== "diff" &&
                                        entry.draft === undefined &&
                                        !entry.saving,
                                )
                            }
                            transferTargets={MAIN_TRANSFER_TARGETS}
                            tabMenuItems={(tab) => {
                                const index = sweepableTabs.findIndex(
                                    (entry) => entry.id === tab.id,
                                );
                                // The detached subagent's tab is not in the sweepable
                                // order, so it offers no menu — its runner owns it.
                                if (index < 0) return [];
                                // A session is archived; a file, a terminal, a
                                // page is closed. The verb has to be the true
                                // one for the tab it is offered on.
                                const verb =
                                    groupFileTabs.some((entry) => entry.id === tab.id) ||
                                    mainTools.some((entry) => entry.id === tab.id)
                                        ? "Close"
                                        : "Archive";
                                return tabStripMenu(verb, index, sweepableTabs.length - index - 1);
                            }}
                            onTabMenuSelect={(tab, actionId) => {
                                const ids = sweepableTabs.map((entry) => entry.id);
                                const index = ids.indexOf(tab.id);
                                if (index < 0) return;
                                if (actionId === TAB_MENU_CLOSE) {
                                    groupTabsClose([tab.id]);
                                } else if (actionId === TAB_MENU_CLOSE_OTHERS) {
                                    groupTabsClose(
                                        ids.filter((id) => id !== tab.id),
                                        tab.id,
                                    );
                                } else if (actionId === TAB_MENU_CLOSE_LEFT) {
                                    groupTabsClose(ids.slice(0, index), tab.id);
                                } else if (actionId === TAB_MENU_CLOSE_RIGHT) {
                                    groupTabsClose(ids.slice(index + 1), tab.id);
                                } else if (actionId === TAB_MENU_CLOSE_ALL) {
                                    groupTabsClose(ids);
                                }
                            }}
                            tabs={groupTabs}
                        >
                            {/* The whole content area accepts a tab dragged out
                                of the panel, so the reader aims at where the
                                thing will be rather than at a stripe. */}
                            <TransferZone
                                icon="panel-collapse"
                                id={TRANSFER_ZONE_MAIN}
                                label={t("Open in the main content")}
                            >
                                <DeferredPane
                                    current={
                                        displayedMainTool
                                            ? undefined
                                            : displayedFile
                                              ? {
                                                    id:
                                                        displayedFile.displayedPresentationId ??
                                                        displayedFile.presentationId,
                                                    content: mainFileBody(displayedFile),
                                                }
                                              : {
                                                    id: `conversation:${openGroup.id}:${props.chatId ?? "empty"}`,
                                                    content: mainConversationBody,
                                                }
                                    }
                                    fallback={
                                        <EmptyState
                                            animation="brand-loading"
                                            description={t("The selected file is taking a moment.")}
                                            icon="doc"
                                            size="panel"
                                            title={t("Opening file…")}
                                        />
                                    }
                                    onReveal={props.workspace.mainViewDisplay}
                                    pending={
                                        pendingFile
                                            ? (() => {
                                                  const readyOnCommit =
                                                      connectionRefusal !== undefined ||
                                                      pendingFile.document.type !== "loading";
                                                  return {
                                                      id: pendingFile.presentationId,
                                                      ready: readyOnCommit,
                                                      render: () => mainFileBody(pendingFile),
                                                  };
                                              })()
                                            : undefined
                                    }
                                    // Every page moved to this side stays
                                    // mounted whichever tab is on screen.
                                    persistent={
                                        <KissopenAgentToolBodies
                                            activeId={workspace.displayedMainViewId}
                                            browserConnectionId={props.browserConnectionId}
                                            {...(props.browserContent
                                                ? { browserContent: props.browserContent }
                                                : {})}
                                            store={props.workspace.panel}
                                            tabs={mainTools}
                                            {...(terminalKissopenAgentAvailability === undefined
                                                ? {}
                                                : {
                                                      kissopenAgentAvailability:
                                                          terminalKissopenAgentAvailability,
                                                      kissopenAgentAvailabilityReason:
                                                          availability.message,
                                                  })}
                                        />
                                    }
                                />
                            </TransferZone>
                        </TabbedPane>
                    )}
                </>
            ) : (
                <>
                    {/* With no project open there is no tab strip, so this side of
                        the window would have no lane to drag it by. */}
                    {desktop ? <WindowDragRegion /> : null}
                    {/* No banner for an unreachable Kissopen Agent here either. The band
                        across the top of the window is the window's one account
                        of the machine being out of touch, and this screen has
                        nothing to add to it: what it offers already goes quiet
                        on `availability`, below. */}
                    {refusedCreate ? (
                        // This address was a workspace being made until KISSOPEN Agent
                        // refused it. Saying "no project open" here would leave
                        // the reader to work out for themselves that the row they
                        // just watched appear and vanish was never created.
                        <WorkspaceLifecycleNotice
                            detail={refusedCreate.message}
                            // The name every worktree KISSOPEN asks for is created
                            // under. KISSOPEN Agent never gave this one a record, so the
                            // name the request carried is the only one there is.
                            name="Workspace"
                            phase="refused"
                        />
                    ) : (
                        <EmptyState
                            icon="folder"
                            title={
                                workspace.projectAdd.pending ? t("正在添加项目…") : t("选择项目")
                            }
                            description={
                                workspace.projectAdd.error ??
                                t("从侧边栏选择项目，或添加一个本地文件夹。")
                            }
                            size="panel"
                            {...(availability.online && !workspace.projectAdd.pending
                                ? {
                                      action: {
                                          label: t("添加文件夹"),
                                          icon: "plus" as const,
                                          onClick: () => props.workspace.projectAdd(),
                                      },
                                  }
                                : {})}
                        />
                    )}
                </>
            )}
        </AppShell>
    );
}

function kissopenAgentFileRevalidationBanner(
    error: { readonly message: string } | undefined,
): ReactNode {
    return error ? (
        <Banner tone="warning" title={t("File may be out of date")}>
            {t("Showing the last loaded content.")} {error.message}
        </Banner>
    ) : null;
}

function KissopenAgentFileBody(props: {
    appearance: "dark" | "light";
    file: KissopenAgentFileTabSnapshot;
    htmlPreview?: HtmlPreviewRenderer;
    mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    documentConversion?: KissopenAgentDocumentConversionOpener;
    mode: KissopenAgentFileViewMode;
    /** Whether long diff lines wrap to the pane or scroll out of it. */
    wrap: boolean;
    /** Re-reads KISSOPEN Agent availability when a retained file handler fires. */
    kissopenAgentOnline: () => boolean;
    /** Addresses a linked file opened from a main-content file tab. */
    onMainFileOpen(path: string, kind: KissopenAgentFileTabKind): void;
    /** Why this file cannot be edited or saved, or absent when it can. */
    writeRefusal?: string;
    /** Why the current local draft cannot be persisted to the KISSOPEN Agent. */
    saveRefusal?: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const { file, workspace } = props;
    /**
     * Opens a file a document links to, on the side the document is being read
     * on. A file followed in the main content lands beside it in the tab strip;
     * one followed in the panel stays in the panel, because the reader is
     * reading the conversation and the panel is where they are reading.
     */
    const linkedFileOpen = (target: string): void => {
        if (!props.kissopenAgentOnline()) return;
        const kind = fileTabKind(target);
        if (file.placement === "panel") workspace.filePanelOpen(file.groupId, target, kind);
        else props.onMainFileOpen(target, kind);
    };
    // Typing into a document that could never be written back is worse than not
    // offering the editor at all: the reader loses what they typed and learns
    // why only when they try to save it.
    const writable = props.writeRefusal === undefined;
    const saveDisabled = !writable || props.saveRefusal !== undefined;
    if (file.kind === "media")
        return (
            <>
                {kissopenAgentFileRevalidationBanner(file.revalidationError)}
                <KissopenAgentFilePreview
                    document={file.document}
                    {...(props.mediaWindow ? { mediaWindow: props.mediaWindow } : {})}
                    {...(props.documentConversion
                        ? { documentConversion: props.documentConversion }
                        : {})}
                    {...(fileIsOfficeDocument(file.path)
                        ? {
                              onOpenDefault: () =>
                                  void workspace
                                      .fileOpenDefault(file.groupId, file.path)
                                      .catch((error: unknown) => {
                                          console.error("Could not open the document.", error);
                                      }),
                          }
                        : {})}
                    key={file.id}
                    path={file.path}
                    revalidating={file.revalidating}
                />
            </>
        );
    if (
        (file.kind === "file" || file.kind === "document") &&
        file.document.type === "ready" &&
        "content" in file.document.value
    ) {
        const content = file.document.value.content;
        const dirty = file.draft !== undefined && file.draft !== content;
        const text = file.draft ?? content;
        const status =
            props.writeRefusal ?? props.saveRefusal ?? (file.saving ? "Saving…" : undefined);
        const markdownCacheKey =
            file.draft === undefined
                ? markdownHighlightCacheKey(file.path, file.document.value.hash)
                : undefined;
        return (
            <FileEditor
                banner={kissopenAgentFileRevalidationBanner(file.revalidationError)}
                documentKey={fileDocumentKey(file.id, file.document.value)}
                dirty={dirty}
                {...(file.kind === "document" && props.htmlPreview
                    ? {
                          rendered: (
                              // The page is served from the file on disk, so the
                              // rendered face shows what was saved; the source
                              // face is where an unsaved edit lives until it is.
                              <HtmlPreviewFrame
                                  {...(file.previewError
                                      ? {
                                            failure: {
                                                kind: "address-unavailable" as const,
                                                path: file.path,
                                                detail: file.previewError,
                                            },
                                        }
                                      : {})}
                                  renderContent={props.htmlPreview}
                                  revision={file.revision}
                                  source={file.previewUrl}
                              />
                          ),
                      }
                    : {})}
                {...(filePreviewKind(file.path) === "markdown"
                    ? {
                          rendered: (
                              <MarkdownDocument
                                  /* Whatever the link names — another document,
                                     a picture — follows the same file-open path
                                     as the sidebar. */
                                  onFileOpen={(href) =>
                                      linkedFileOpen(documentLinkResolve(file.path, href))
                                  }
                                  {...(markdownCacheKey === undefined
                                      ? {}
                                      : { cacheKey: markdownCacheKey })}
                                  text={text}
                              />
                          ),
                      }
                    : {})}
                onRevert={() => workspace.fileDraftRevert(file.id)}
                onSave={() => {
                    if (!saveDisabled && props.kissopenAgentOnline())
                        void workspace.fileDraftSave(file.id).catch(() => undefined);
                }}
                onValueChange={(value) => workspace.fileDraftUpdate(file.id, value)}
                onWrapChange={(wrap) => workspace.fileViewWrapUpdate(wrap)}
                path={file.path}
                readOnly={file.saving || !writable}
                saveDisabled={saveDisabled}
                saving={file.saving}
                {...(status === undefined ? {} : { status })}
                value={text}
                wrap={props.wrap}
            />
        );
    }
    if (
        file.kind === "diff" &&
        file.document.type === "ready" &&
        "oldContent" in file.document.value
    ) {
        const change = file.document.value;
        // An untouched tab shows what was read; once edited it shows what was
        // typed, which is the only copy of it there is.
        const current = file.draft ?? change.newContent;
        const oldCacheKey =
            file.draft !== undefined || change.oldHash === undefined
                ? undefined
                : `d:old:${file.groupId}:${change.oldHash}:${fileHighlightLanguageKey(change.oldPath)}`;
        const newCacheKey =
            file.draft === undefined && change.hash !== undefined
                ? `d:new:${file.groupId}:${change.hash}:${fileHighlightLanguageKey(file.path)}`
                : undefined;
        return (
            <>
                {kissopenAgentFileRevalidationBanner(file.revalidationError)}
                <ChangedFileDiff
                    appearance={props.appearance}
                    documentKey={fileDocumentKey(file.id, file.document.value)}
                    key={`${file.id}:${file.kind}`}
                    loading={file.revalidating}
                    mode={props.mode}
                    {...(newCacheKey === undefined ? {} : { newCacheKey })}
                    newContent={current}
                    {...(oldCacheKey === undefined ? {} : { oldCacheKey })}
                    oldContent={change.oldContent}
                    oldPath={change.oldPath}
                    {...(writable
                        ? {
                              onContentChange: (content: string) =>
                                  workspace.fileDraftUpdate(file.id, content),
                              onSave: () => {
                                  if (!saveDisabled && props.kissopenAgentOnline())
                                      void workspace.fileDraftSave(file.id).catch(() => undefined);
                              },
                          }
                        : {})}
                    saveDisabled={saveDisabled}
                    onModeChange={(mode) => workspace.fileViewModeUpdate(mode)}
                    onWrapChange={(wrap) => workspace.fileViewWrapUpdate(wrap)}
                    wrap={props.wrap}
                    // A change that deleted the file left no copy to look at, which
                    // the read reports by having no working-tree identity for it.
                    // Preview is then not offered rather than offered over nothing.
                    {...(change.hash === undefined
                        ? {}
                        : {
                              preview: (
                                  <KissopenAgentChangedFilePreview
                                      file={file}
                                      onFileOpen={linkedFileOpen}
                                      openDisabled={props.saveRefusal !== undefined}
                                      text={current}
                                  />
                              ),
                          })}
                    path={file.path}
                    saving={file.saving}
                />
            </>
        );
    }
    if (file.document.type === "error")
        return (
            <EmptyState
                {...(props.saveRefusal === undefined
                    ? {
                          action: {
                              label: t("Retry"),
                              icon: "arrow-right" as const,
                              onClick: () => {
                                  if (props.kissopenAgentOnline()) workspace.fileRetry(file.id);
                              },
                          },
                      }
                    : {})}
                description={file.document.error.message}
                icon="doc"
                size="panel"
                title={t("File unavailable")}
            />
        );
    if (props.saveRefusal)
        return (
            <EmptyState
                description={props.saveRefusal}
                icon="link"
                size="panel"
                title={t("File unavailable while KissOpen Agent is offline")}
            />
        );
    return (
        <EmptyState
            animation="brand-loading"
            description={
                file.kind === "file"
                    ? "Reading the file from its workspace."
                    : "Reading the changed file from its workspace."
            }
            icon="doc"
            size="panel"
            title={t("Loading file…")}
        />
    );
}

/**
 * A changed file as it now stands, in the same preview the product opens any
 * file into.
 *
 * The text is the copy already in hand: the changed-file read takes its
 * working-tree side from the same file read that opening an ordinary file uses,
 * so Preview and Edit are looking at one file rather than at two reads of it —
 * including an edit that has been typed and not yet saved. Nothing is fetched
 * here, so switching to Preview cannot land another file's bytes.
 */
function KissopenAgentChangedFilePreview(props: {
    file: KissopenAgentFileTabSnapshot;
    openDisabled: boolean;
    /** Opens a linked file on the side this one is being read on. */
    onFileOpen: (path: string) => void;
    text: string;
}) {
    const { file } = props;
    // A picture, a recording, or an archive opens as itself rather than as a
    // diff, so a tab of one is not a diff tab and this is reached only by a tab
    // restored from a session that sorted the file differently. Saying the file
    // has no preview beats rendering its bytes as characters.
    const kind = filePreviewKind(file.path);
    const readable = kind === "markdown" || kind === "text";
    const cacheKey =
        file.draft === undefined &&
        file.document.type === "ready" &&
        "hash" in file.document.value &&
        file.document.value.hash !== undefined
            ? fileHighlightCacheKey(file.path, file.document.value.hash)
            : undefined;
    return (
        <FilePreview
            content={readable ? { type: "text", text: props.text } : { type: "unavailable" }}
            {...(cacheKey === undefined ? {} : { cacheKey })}
            // A document followed out of the changed list lands beside it as the
            // file itself, the same way one followed out of a file tab does.
            onFileOpen={(href) => {
                if (props.openDisabled) return;
                props.onFileOpen(documentLinkResolve(file.path, href));
            }}
            path={file.path}
        />
    );
}

/**
 * One workspace file shown rather than edited.
 *
 * The document says where the bytes are rather than carrying them, so the
 * picture element fetches its own source over an ordinary URL. Nothing here
 * holds a browser resource with a lifetime to revoke, and a video's seeks become
 * range requests against the proxy instead of a whole file already in the DOM.
 */
function KissopenAgentFilePreview(props: {
    document: KissopenAgentFileTabSnapshot["document"];
    mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    documentConversion?: KissopenAgentDocumentConversionOpener;
    /** Hands a document the preview cannot show to this machine's own application. */
    onOpenDefault?: () => void;
    path: string;
    revalidating: boolean;
}) {
    const document = props.document;
    if (document.type === "error")
        return (
            <FilePreview
                content={{ type: "error", message: document.error.message }}
                path={props.path}
            />
        );
    // A background revalidation must not replace usable media with a loading
    // face. The request may still fail into the warning banner owned by the
    // surrounding file surface; only a true first load has no content to show.
    if (document.type !== "ready")
        return <FilePreview content={{ type: "loading" }} path={props.path} />;
    const value = document.value;
    if (!("contentType" in value))
        return <FilePreview content={{ type: "unavailable" }} path={props.path} />;
    // A format with no viewer is stated as such rather than rendered as an
    // <img> that will only ever show a broken-image glyph. The document viewers
    // read the bytes themselves, so they do not need a content type the browser
    // knows; a format still waiting on conversion has none to read yet.
    const kind = filePreviewKind(props.path);
    const readsBytes =
        kind === "pdf" || kind === "document" || kind === "spreadsheet" || kind === "presentation";
    const showable =
        readsBytes ||
        (value.contentType !== "application/octet-stream" &&
            kind !== "binary" &&
            kind !== "converted");
    const mediaWindow = props.mediaWindow;
    const onOpenDefault = props.onOpenDefault;
    // A format nothing here reads is shown as the PDF the account's server
    // converts it to, and a deck the slide viewer cannot draw falls back to the
    // same. The file's own address names its content, so it keys the conversion.
    const conversion = props.documentConversion;
    if (conversion && (kind === "converted" || kind === "presentation"))
        return (
            <KissopenAgentConvertiblePreview
                path={props.path}
                size={fileSizeFormat(value.size)}
                store={conversion({
                    key: value.url,
                    name: props.path.slice(props.path.lastIndexOf("/") + 1),
                    url: value.url,
                    automatic: kind === "converted",
                })}
                updating={props.revalidating}
                url={value.url}
                {...(onOpenDefault ? { onOpenDefault } : {})}
            />
        );
    return (
        <FilePreview
            content={showable ? { type: "url", url: value.url } : { type: "unavailable" }}
            {...(onOpenDefault && showable
                ? {
                      actions: (
                          <Button onClick={onOpenDefault} size="small" variant="ghost">
                              {t("Open in default app")}
                          </Button>
                      ),
                  }
                : {})}
            {...(onOpenDefault ? { onOpenDefault } : {})}
            {...(mediaWindow && showable && mediaWindowShowable(kind)
                ? {
                      onMediaWindowOpen: () => mediaWindow({ path: props.path, url: value.url }),
                  }
                : {})}
            path={props.path}
            size={fileSizeFormat(value.size)}
            updating={props.revalidating}
        />
    );
}

/**
 * A document shown through its converted PDF: a deck first tries its own
 * viewer and converts only when that viewer cannot draw it; every other
 * convertible format converts as soon as it is shown.
 */
function KissopenAgentConvertiblePreview(props: {
    store: KissopenAgentDocumentConversionStore;
    path: string;
    size: string;
    updating: boolean;
    url: string;
    onOpenDefault?: () => void;
}) {
    const state = useSyncExternalStore(
        reactFrameSubscribe(props.store),
        props.store.get,
        props.store.get,
    );
    const onOpenDefault = props.onOpenDefault;
    const actions = onOpenDefault ? (
        <Button onClick={onOpenDefault} size="small" variant="ghost">
            {t("Open in default app")}
        </Button>
    ) : undefined;
    if (filePreviewKind(props.path) === "presentation" && state.pdf.type === "unloaded")
        return (
            <FilePreview
                content={{ type: "url", url: props.url }}
                onPresentationFailed={() => props.store.conversionRequest()}
                path={props.path}
                size={props.size}
                updating={props.updating}
                {...(actions ? { actions } : {})}
            />
        );
    return (
        <FilePreview
            content={
                state.pdf.type === "ready"
                    ? { type: "url", url: state.pdf.value }
                    : state.pdf.type === "error"
                      ? { type: "error", message: state.pdf.error.message }
                      : { type: "loading" }
            }
            kind="converted"
            path={props.path}
            size={props.size}
            updating={props.updating}
            {...(actions ? { actions } : {})}
            {...(onOpenDefault ? { onOpenDefault } : {})}
        />
    );
}

/** A byte count as a person reads it. */
function fileSizeFormat(size: number): string {
    if (size < 1024) return `${String(size)} B`;
    if (size < 1024 * 1024) return `${String(Math.round(size / 102.4) / 10)} KB`;
    return `${String(Math.round(size / (102.4 * 1024)) / 10)} MB`;
}

/**
 * The composer of a group that holds no conversation yet: a live input rather
 * than a button, so opening a project or worktree and typing is what starts its
 * first session. It is one surface wherever it stands — alone on a group with
 * nothing open in it at all, or as the body under the tab strip when the only
 * tabs are files and tools — because two of them on one screen would be two
 * places to type the same first message.
 */
/**
 * The mic for one composer: the dictation store's state, and the words it
 * returns appended to whatever the composer holds by then — the reader may
 * have kept typing while the recording was out.
 */
function useComposerDictation(
    dictation: DictationStore | undefined,
    workspace: KissopenAgentWorkspaceStore,
): ComposerDictation | undefined {
    const snapshot = useSyncExternalStore(
        dictation?.subscribe ?? dictationNone,
        dictation?.get ?? dictationIdle,
        dictation?.get ?? dictationIdle,
    );
    if (!dictation) return undefined;
    return {
        status: snapshot.status,
        elapsedMs: snapshot.elapsedMs,
        levels: snapshot.levels,
        ...(snapshot.error ? { error: snapshot.error } : {}),
        onToggle: () =>
            dictation.recordingToggle((text) => {
                // The draft as it is now — the reader may have typed on while the
                // recording was out — from whichever composer the workspace has.
                const current = workspace.get();
                const held =
                    current.groupComposer?.text ??
                    (current.conversation.type === "ready"
                        ? current.conversation.value.composer.text
                        : "");
                workspace.composerTextUpdate(dictationJoin(held, text));
            }),
    };
}
const DICTATION_IDLE: DictationSnapshot = { status: "idle", elapsedMs: 0, error: "", levels: [] };
const dictationIdle = () => DICTATION_IDLE;
const dictationNone = () => () => {};
/** Words after a draft: on the draft's own line, a space apart from its last word. */
function dictationJoin(held: string, text: string): string {
    if (!held) return text;
    return /\s$/u.test(held) ? held + text : `${held} ${text}`;
}

function KissopenAgentGroupComposer(props: {
    composer: ComposerSnapshot;
    dictation?: DictationStore;
    /**
     * How that first conversation will be configured, and the options behind
     * those choices. Absent until the model catalog has been read, which is
     * what keeps the composer from waiting on it.
     */
    draftMenus?: KissopenAgentMenusSnapshot;
    focusOnType: boolean;
    /** The group being written into. Arriving at another one takes the caret. */
    groupId: string;
    groupName: string;
    /** The assistant this group is, when it is one: the composer asks it by name. */
    assistantName?: string;
    /** Reads current transport health when a KISSOPEN Agent-backed action is invoked. */
    kissopenAgentOnline: () => boolean;
    /** Why this KISSOPEN Agent cannot accept network actions while the local draft remains editable. */
    unavailable?: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const workspace = props.workspace;
    const composerDictation = useComposerDictation(props.dictation, workspace);
    const draftMenus = props.draftMenus;
    const modelsNotConfigured = draftMenus?.modelOptions.length === 0;
    return (
        <ConversationView
            agentAuthor={agentAuthor}
            composer={props.composer}
            composerDisabled={modelsNotConfigured}
            composerFocusOnType={props.focusOnType && !modelsNotConfigured}
            // Only the composer that claims stray typing takes the caret, so the
            // dock over an expanded panel cannot pull it out from under the one
            // the reader can see.
            {...(props.focusOnType && !modelsNotConfigured
                ? { composerFocusKey: props.groupId }
                : {})}
            composerPlaceholder={
                modelsNotConfigured
                    ? "Configure models to start messaging…"
                    : composerPlaceholder(props.groupName, props.assistantName)
            }
            composerSubmitDisabled={props.unavailable !== undefined}
            entries={NO_ENTRIES}
            // The first message is what creates the session, so its model,
            // effort, and access mode have to be choosable before it is sent
            // rather than corrected afterwards. These are the same pickers an
            // open conversation carries, over the draft instead of a live
            // session.
            composerControls={
                draftMenus ? (
                    <ComposerModelControl
                        {...kissopenAgentComposerModelControlProps(draftMenus, {
                            onEffortChange: (effort?: KissopenAgentThinkingLevel) =>
                                workspace.sessionEffortUpdate(effort),
                            onModelChange: (selection: KissopenAgentModelSelection) =>
                                workspace.sessionModelUpdate(selection),
                        })}
                    />
                ) : undefined
            }
            composerFooterControl={
                draftMenus ? (
                    <ComposerFooterBar
                        leading={
                            <KissopenAgentSessionControls
                                disabled={modelsNotConfigured}
                                fields={["permission", "tier"]}
                                menuPlacement="above"
                                variant="ghost"
                                menus={draftMenus}
                                onEffortChange={(effort?: KissopenAgentThinkingLevel) =>
                                    workspace.sessionEffortUpdate(effort)
                                }
                                onModelChange={(selection: KissopenAgentModelSelection) =>
                                    workspace.sessionModelUpdate(selection)
                                }
                                onPermissionModeChange={(mode: KissopenAgentPermissionMode) =>
                                    workspace.sessionPermissionModeUpdate(mode)
                                }
                                onServiceTierChange={(tier?: KissopenAgentServiceTier) =>
                                    workspace.sessionServiceTierUpdate(tier)
                                }
                            />
                        }
                    />
                ) : undefined
            }
            onComposerAttachmentRemove={(attachmentId) =>
                workspace.composerAttachmentRemove(attachmentId)
            }
            onComposerAttachmentsSelect={(files) => workspace.composerAttachmentsAdd(files)}
            onComposerFocusChange={(focused) => workspace.composerFocusUpdate(focused)}
            onComposerSend={() => {
                if (!modelsNotConfigured && props.kissopenAgentOnline())
                    workspace.composerTextSubmit();
            }}
            composerDictation={composerDictation}
            onComposerValueChange={(value) =>
                reactFrameInputUpdate(workspace, () => workspace.composerTextUpdate(value))
            }
        />
    );
}

/** The open conversation's materialization states, inside the directory's tabs. */
function KissopenAgentConversationBody(props: {
    activitySelected: boolean;
    /** Speaking into the composer; see `AppKissopenAgentViewProps.dictation`. */
    dictation?: DictationStore;
    conversation: KissopenAgentWorkspaceSnapshot["conversation"];
    emptyContent?: ReactNode;
    focusOnType: boolean;
    groupId: string;
    groupName: string;
    /** The assistant this group is, when it is one: the composer asks it by name. */
    assistantName?: string;
    now: number;
    /**
     * Something to say about the place this conversation is happening in, held
     * above every message in it. A workspace's own first conversation exists
     * before its checkout does, so this is where the reader watches that
     * checkout being prepared — while the transcript, the empty state, and the
     * composer underneath all behave exactly as they otherwise would.
     */
    notice?: ReactNode;
    /** Starts a session here, when this workspace can host one. */
    onCreate?: () => void;
    onChatSelect: KissopenAgentWorkspaceSurfaceProps["onChatSelect"];
    onFileOpen: (path: string) => void;
    onScheduleProposalOpen?: (request: string) => void;
    /** Opens Scheduled tasks at a task the agent created, by its ID. */
    onScheduledTaskOpen?: (scheduleId: string) => void;
    readOnly: boolean;
    /** Reads current transport health when a Kissopen Agent-backed action is invoked. */
    kissopenAgentOnline: () => boolean;
    /** Why the input is closed, said in the words of whatever closed it. */
    readOnlyReason?: string;
    /** Why this Kissopen Agent cannot currently accept network actions. */
    unavailable?: string;
    /**
     * Whether a run already going here may be stopped. Separate from `readOnly`
     * on purpose: a checkout that has gone away closes the input, but the run
     * inside it is a process the host owns and the reader must still be able to
     * end it. Only a subagent's own runner takes Stop away, because that run
     * belongs to the parent that started it.
     */
    canAbort: boolean;
    /** Why this conversation may not be written into, or absent when it may. */
    writeRefusal?: string;
    viewerId: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const conversation = props.conversation;
    if (conversation.type === "ready")
        return (
            <KissopenAgentConversationSurface
                activitySelected={props.activitySelected}
                dictation={props.dictation}
                conversation={conversation.value}
                emptyContent={props.emptyContent}
                focusOnType={props.focusOnType}
                groupId={props.groupId}
                groupName={props.groupName}
                {...(props.assistantName === undefined
                    ? {}
                    : { assistantName: props.assistantName })}
                {...(props.notice === undefined ? {} : { notice: props.notice })}
                now={props.now}
                onChatSelect={props.onChatSelect}
                onFileOpen={props.onFileOpen}
                {...(props.onScheduleProposalOpen
                    ? { onScheduleProposalOpen: props.onScheduleProposalOpen }
                    : {})}
                {...(props.onScheduledTaskOpen
                    ? { onScheduledTaskOpen: props.onScheduledTaskOpen }
                    : {})}
                canAbort={props.canAbort}
                readOnly={props.readOnly}
                kissopenAgentOnline={props.kissopenAgentOnline}
                {...(props.unavailable === undefined ? {} : { unavailable: props.unavailable })}
                {...(props.readOnlyReason === undefined
                    ? {}
                    : { readOnlyReason: props.readOnlyReason })}
                {...(props.writeRefusal === undefined ? {} : { writeRefusal: props.writeRefusal })}
                viewerId={props.viewerId}
                workspace={props.workspace}
            />
        );
    if (conversation.type === "loading" && props.unavailable !== undefined)
        return (
            <EmptyState
                description={t(
                    "{unavailable} The session will finish loading automatically after reconnect.",
                    { unavailable: props.unavailable },
                )}
                icon="link"
                size="panel"
                title={t("Session waiting for the KissOpen Agent")}
            />
        );
    if (conversation.type === "loading")
        return (
            <EmptyState
                animation="brand-loading"
                description={t("Loading the selected local session.")}
                icon="chat"
                size="panel"
                title={t("Loading session…")}
            />
        );
    if (conversation.type === "error")
        return (
            <EmptyState
                {...(props.unavailable === undefined
                    ? {
                          action: {
                              label: t("Retry"),
                              icon: "arrow-right" as const,
                              onClick: () => {
                                  if (props.kissopenAgentOnline())
                                      props.workspace.conversationRetry();
                              },
                          },
                      }
                    : {})}
                description={conversation.error.message}
                icon="shield"
                size="panel"
                title={t("Session unavailable")}
            />
        );
    return (
        <EmptyState
            {...(props.onCreate === undefined
                ? {}
                : {
                      action: {
                          label: t("New session"),
                          icon: "plus" as const,
                          onClick: props.onCreate,
                      },
                  })}
            // The main screen of the whole application when no work is open: the
            // secretary standing by, waiting to be given something to do.
            animation="secretary-waving"
            description={t("Select a session tab or start a new one to begin.")}
            icon="chat"
            size="panel"
            title={t("No session selected")}
        />
    );
}

/** A delegated agent that is still working, or about to be. */
function kissopenAgentSubagentActive(subagent: SubagentSummary): boolean {
    return subagent.status === "queued" || subagent.status === "running";
}

/**
 * Whether this conversation is working at all: its own turn, or the agents it
 * delegated to and has not outlived. A turn can hand work to a child and end
 * before the child does, and the session is still working while that lasts.
 */
function kissopenAgentConversationWorking(
    conversation: Pick<KissopenAgentConversationSnapshot, "running" | "subagents">,
): boolean {
    return conversation.running || conversation.subagents.some(kissopenAgentSubagentActive);
}

/** Counts live agents and terminals for the compact transcript affordance. */
function kissopenAgentActiveActivityCounts(
    conversation: Pick<
        KissopenAgentConversationSnapshot,
        "subagents" | "backgroundProcesses" | "detachedBackgroundProcessIds"
    >,
): {
    readonly agents: number;
    readonly terminals: number;
} {
    const agents = conversation.subagents.filter(kissopenAgentSubagentActive);
    return {
        agents: agents.length,
        terminals: conversation.backgroundProcesses.filter((process) =>
            conversation.detachedBackgroundProcessIds.has(process.id),
        ).length,
    };
}

/**
 * How long this conversation's delegated agents have been working, counted from
 * the first one still going. It is the clock the status line shows once the
 * parent turn has ended and the children have not, so it measures the work that
 * is actually still running rather than the turn that started it.
 *
 * A child whose runner never told us when it started leaves the state without a
 * clock, and the status line then shows the state alone.
 */
function kissopenAgentDelegatedElapsedMs(
    conversation: Pick<KissopenAgentConversationSnapshot, "subagents">,
    now: number,
): number | undefined {
    let startedAt: number | undefined;
    for (const subagent of conversation.subagents) {
        if (!kissopenAgentSubagentActive(subagent)) continue;
        const since = subagent.activeSince ?? subagent.createdAt;
        if (startedAt === undefined || since < startedAt) startedAt = since;
    }
    return startedAt === undefined ? undefined : Math.max(0, now - startedAt);
}

function KissopenAgentConversationSurface(props: {
    activitySelected: boolean;
    dictation?: DictationStore;
    conversation: KissopenAgentConversationSnapshot;
    emptyContent?: ReactNode;
    focusOnType: boolean;
    groupId: string;
    groupName: string;
    /** The assistant this group is, when it is one: the composer asks it by name. */
    assistantName?: string;
    /** What to say above every message here; see `KissopenAgentConversationBody`. */
    notice?: ReactNode;
    now: number;
    onChatSelect: KissopenAgentWorkspaceSurfaceProps["onChatSelect"];
    /** Opens a file the transcript names, in the panel beside it. */
    onFileOpen: (path: string) => void;
    /** Opens Scheduled tasks with a task the assistant proposed. */
    onScheduleProposalOpen?: (request: string) => void;
    /** Opens Scheduled tasks at a task the agent created, by its ID. */
    onScheduledTaskOpen?: (scheduleId: string) => void;
    readOnly: boolean;
    /** Reads current transport health when a Kissopen Agent-backed action is invoked. */
    kissopenAgentOnline: () => boolean;
    /** Why the input is closed, said in the words of whatever closed it. */
    readOnlyReason?: string;
    /** Why this Kissopen Agent cannot currently accept network actions. */
    unavailable?: string;
    /**
     * Whether a run already going here may be stopped. Separate from `readOnly`
     * on purpose: a checkout that has gone away closes the input, but the run
     * inside it is a process the host owns and the reader must still be able to
     * end it. Only a subagent's own runner takes Stop away, because that run
     * belongs to the parent that started it.
     */
    canAbort: boolean;
    /** Why this conversation may not be written into, or absent when it may. */
    writeRefusal?: string;
    viewerId: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const { conversation, workspace } = props;
    const composerDictation = useComposerDictation(props.dictation, workspace);
    // A session that is still being read is not a reason to unmount this
    // surface: the composer is already live, the header already carries the
    // title the list knew, and the transcript fills in underneath. Only a
    // session that failed replaces it.
    if (conversation.session.type === "error")
        return (
            <EmptyState
                {...(props.unavailable === undefined
                    ? {
                          action: {
                              label: t("Retry"),
                              icon: "arrow-right" as const,
                              onClick: () => {
                                  if (props.kissopenAgentOnline()) workspace.conversationRetry();
                              },
                          },
                      }
                    : {})}
                description={conversation.session.error.message}
                icon="shield"
                size="panel"
                title={t("Session unavailable")}
            />
        );
    const swallow = (operation: Promise<unknown>) => void operation.catch(() => undefined);
    // Whether a chat this reader may not write into is closed rather than merely
    // held. A chat whose runner owns it is not somewhere to leave a draft: the
    // agent is having this conversation and the reader is reading it, so the
    // composer locks instead of collecting a message with nowhere to go.
    //
    // The KISSOPEN Agent being unreachable is deliberately not this: that is a wait, the
    // draft survives it, and the window-level band names it. Only an unusable
    // destination locks the box.
    const sendRefusal = props.unavailable;
    /*
     * Whether the reader may choose how this conversation runs. The model,
     * reasoning, access mode, and speed all describe the message about to be
     * sent, so a chat that takes no message offers no choice about one: a
     * subagent's settings belong to the runner that started it, and a checkout
     * that has gone away has nothing to apply them to. The controls stay
     * visible and keep showing what the session actually runs, which is what a
     * reader looking at someone else's chat came to find out.
     */
    const modelsNotConfigured = conversation.menus?.modelOptions.length === 0;
    const composerDisabled = props.readOnly || modelsNotConfigured;
    const configurable = !composerDisabled && sendRefusal === undefined;
    const activeActivity = kissopenAgentActiveActivityCounts(conversation);
    const activityTotal = activeActivity.agents + activeActivity.terminals;
    return (
        <ConversationView
            emptyContent={props.emptyContent}
            onUsageOpen={() => workspace.usagePanelOpen()}
            agentAuthor={conversation.agentAuthor}
            activityControl={
                activityTotal > 0 ? (
                    <KissopenAgentActivityControl
                        agents={activeActivity.agents}
                        backgroundTerminals={activeActivity.terminals}
                        onClick={() => workspace.activityPanelOpen()}
                    />
                ) : undefined
            }
            composer={conversation.composer}
            composerDisabled={composerDisabled}
            composerSubmitDisabled={sendRefusal !== undefined}
            composerFocusOnType={!composerDisabled && props.focusOnType}
            // The open conversation is what this composer writes into, so moving
            // to another one — or landing in the one a new workspace was made
            // with — puts the caret in the draft. A locked chat has no draft to
            // put it in, and only the composer claiming stray typing takes it,
            // so the dock over an expanded panel cannot steal it.
            {...(!composerDisabled && props.focusOnType
                ? { composerFocusKey: conversation.conversationId }
                : {})}
            // A locked chat says why in the words of whatever locked it: the
            // agent that owns it, named, or the checkout that will not take a
            // message. Both are more use than the category of chat this is.
            composerPlaceholder={
                props.readOnly
                    ? (props.readOnlyReason ??
                      composerPlaceholder(props.groupName, props.assistantName))
                    : modelsNotConfigured
                      ? "Configure models to start messaging…"
                      : composerPlaceholder(props.groupName, props.assistantName)
            }
            conversationId={conversation.conversationId}
            entries={conversation.entries}
            loading={!conversation.ready}
            {...(props.notice === undefined ? {} : { notice: props.notice })}
            scrollPosition={conversation.scrollPosition}
            onScrollPositionChange={(position) => {
                workspace.conversationScrollUpdate(
                    conversation.conversationId as KissopenAgentSessionId,
                    position,
                );
            }}
            // Reaching the oldest loaded entry is the whole request for the page
            // before it. The transcript reports it whether the reader scrolled
            // there or a short history put them there on arrival — a long run
            // fills a whole page on its own, and the transcript it opens with
            // can be shorter than the pane it sits in.
            onStartReached={() => {
                if (props.kissopenAgentOnline() && !conversation.transcriptComplete)
                    workspace.historyLoadMore();
            }}
            composerControls={
                <>
                    {conversation.menus ? (
                        <ComposerModelControl
                            {...kissopenAgentComposerModelControlProps(conversation.menus, {
                                // The daemon refuses a model change while a run
                                // is active or queued behind it, so the control
                                // says so rather than accepting a choice the
                                // next message could not apply.
                                disabled: !configurable || conversation.modelLocked,
                                onEffortChange: (effort?: KissopenAgentThinkingLevel) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionEffortUpdate(effort);
                                },
                                onModelChange: (selection: KissopenAgentModelSelection) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionModelUpdate(selection);
                                },
                            })}
                        />
                    ) : null}
                </>
            }
            composerFooterControl={
                <ComposerFooterBar
                    leading={
                        <>
                            <KissopenAgentSessionControls
                                disabled={!configurable}
                                fields={["permission", "tier"]}
                                menuPlacement="above"
                                variant="ghost"
                                menus={conversation.menus}
                                onEffortChange={(effort?: KissopenAgentThinkingLevel) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionEffortUpdate(effort);
                                }}
                                onModelChange={(selection: KissopenAgentModelSelection) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionModelUpdate(selection);
                                }}
                                onPermissionModeChange={(mode: KissopenAgentPermissionMode) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionPermissionModeUpdate(mode);
                                }}
                                onServiceTierChange={(tier?: KissopenAgentServiceTier) => {
                                    if (props.kissopenAgentOnline())
                                        workspace.sessionServiceTierUpdate(tier);
                                }}
                            />
                        </>
                    }
                    /* How much of the window this session has spent, at the far
                       end of the same row as the access mode and the speed: the
                       reader is about to type one more message, and this is
                       where they find out whether it still fits and when to
                       compact. Before the provider's first measurement, the
                       declared window still appears with an empty-state count
                       so the context surface is discoverable. */
                    trailing={
                        conversation.contextGauge ? (
                            <ContextMeter
                                approximate={conversation.contextGauge.approximate}
                                compactTokens={conversation.contextGauge.compactTokens}
                                measured={conversation.contextGauge.measured}
                                totalTokens={conversation.contextGauge.totalTokens}
                                usedTokens={conversation.contextGauge.usedTokens}
                            />
                        ) : undefined
                    }
                />
            }
            onAbort={
                props.canAbort
                    ? () => {
                          if (props.kissopenAgentOnline()) swallow(workspace.runAbort());
                      }
                    : undefined
            }
            onPendingWithdraw={
                props.unavailable === undefined
                    ? (messageId) => {
                          if (props.kissopenAgentOnline())
                              swallow(workspace.messageWithdraw(messageId));
                      }
                    : undefined
            }
            onCommandInvoke={
                !modelsNotConfigured && props.unavailable === undefined
                    ? (commandId) => {
                          if (props.kissopenAgentOnline())
                              workspace.composerCommandInvoke(commandId);
                      }
                    : undefined
            }
            onComposerAttachmentRemove={(attachmentId) =>
                workspace.composerAttachmentRemove(attachmentId)
            }
            onComposerAttachmentsSelect={(files) => workspace.composerAttachmentsAdd(files)}
            onComposerFocusChange={(focused) => workspace.composerFocusUpdate(focused)}
            onComposerSend={() => {
                if (!modelsNotConfigured && props.kissopenAgentOnline())
                    workspace.composerTextSubmit();
            }}
            composerDictation={composerDictation}
            onComposerValueChange={(value) =>
                reactFrameInputUpdate(workspace, () => workspace.composerTextUpdate(value))
            }
            onFileOpen={(path) => {
                if (props.kissopenAgentOnline()) props.onFileOpen(path);
            }}
            {...(props.onScheduleProposalOpen
                ? { onScheduleProposalOpen: props.onScheduleProposalOpen }
                : {})}
            {...(props.onScheduledTaskOpen
                ? { onScheduledTaskOpen: props.onScheduledTaskOpen }
                : {})}
            onPictureRead={(picture) =>
                props.kissopenAgentOnline()
                    ? workspace.pictureRead(
                          props.groupId as KissopenAgentGroupId,
                          picture.path,
                          picture.mediaType,
                      )
                    : Promise.resolve(undefined)
            }
            onImageOpen={(messageId, attachmentId) => {
                if (props.kissopenAgentOnline()) workspace.imageOpen(messageId, attachmentId);
            }}
            onAttachmentOpen={(attachment) => {
                // An attached document is a page, not a file to save. When it
                // lives in a checkout this workspace reads, it opens the way a
                // document in the file list does — rendered, served from its own
                // folder so its stylesheet and scripts resolve, with the source
                // a toggle away. Only a document the workspace cannot reach
                // falls back to the download the host offered.
                if (
                    attachment.attachmentKind === "file" &&
                    filePreviewKind(attachment.source) === "html" &&
                    props.kissopenAgentOnline() &&
                    workspace.attachmentFileOpen(attachment.source, "document")
                ) {
                    return;
                }
                if (attachment.openUrl) openExternalLink(attachment.openUrl);
            }}
            onToolSelect={(entryId) => workspace.panel.previewOpen(entryId)}
            onDelegationSelect={(sessionId) =>
                props.onChatSelect(props.groupId, sessionId as KissopenAgentSessionId)
            }
            {...(props.writeRefusal === undefined && props.unavailable === undefined
                ? {
                      onRequestAnswer: (
                          requestId: string,
                          answers: KissopenAgentUserInputAnswerMap,
                      ) =>
                          props.kissopenAgentOnline()
                              ? swallow(workspace.answerInput({ requestId, answers }))
                              : undefined,
                  }
                : {})}
            expandedTurnIds={conversation.expandedTurnIds}
            onTraceToggle={(turnId) => workspace.turnTraceToggle(turnId)}
            overlay={
                conversation.openImage ? (
                    <ModalOverlay onDismiss={() => workspace.imageClose()} placement="fill">
                        <Lightbox
                            alt={conversation.openImage.alt}
                            imageUrl={conversation.openImage.url}
                            onClose={() => workspace.imageClose()}
                            {...(conversation.openImage.total > 1
                                ? {
                                      position: {
                                          index: conversation.openImage.index,
                                          total: conversation.openImage.total,
                                      },
                                      onNext: () => workspace.imageNext(),
                                      onPrevious: () => workspace.imagePrevious(),
                                  }
                                : {})}
                        />
                    </ModalOverlay>
                ) : undefined
            }
            requestSubmissions={conversation.requestSubmissions}
            requestSelections={conversation.requestSelections}
            onRequestSelectionChange={(requestId, answers) =>
                workspace.requestSelectionUpdate(requestId, answers)
            }
            activityTreatment="focused"
            motion="calm-typed"
            running={conversation.running}
            delegatedAgents={activeActivity.agents}
            delegatedElapsedMs={kissopenAgentDelegatedElapsedMs(conversation, props.now)}
            elapsedMs={kissopenAgentTurnElapsedMs(conversation, props.now)}
            now={props.now}
            workingPhase={conversation.workingPhase}
            workingLabel={conversation.workingLabel}
            workingWait={kissopenAgentWaitStatus(conversation, props.now)}
            viewerId={props.viewerId}
        />
    );
}

/**
 * The scheduled wait the footer counts down, paired with the surface clock it
 * is measured against. The daemon's own label states an absolute deadline that
 * stops being useful the moment it is written; handing the status line both
 * ends and a ticking `now` is what turns it into something that keeps changing
 * while the reader watches it.
 */
function kissopenAgentWaitStatus(
    conversation: { readonly running: boolean; readonly workingWait?: KissopenAgentWorkingWait },
    now: number,
): AgentWaitStatus | undefined {
    if (!conversation.running || conversation.workingWait === undefined) return undefined;
    return { ...conversation.workingWait, now };
}

/**
 * Live elapsed for the open turn, counted from when the user sent the request
 * (before the first token). Prefers the store's request-send clock; falls back
 * to the last user message's createdAt when a reconnect leaves that unset.
 */
function kissopenAgentTurnElapsedMs(
    conversation: {
        readonly running: boolean;
        readonly runStartedAt?: number;
        readonly turnElapsedMs?: number;
        readonly entries: readonly ConversationEntry[];
    },
    now: number,
): number | undefined {
    if (!conversation.running) return conversation.turnElapsedMs;
    if (conversation.runStartedAt !== undefined)
        return Math.max(0, now - conversation.runStartedAt);
    let earliestSentAt: number | undefined;
    for (let index = conversation.entries.length - 1; index >= 0; index -= 1) {
        const entry = conversation.entries[index];
        if (entry?.kind === "turnStatus" && entry.status !== "steered") break;
        if (entry?.kind !== "message") continue;
        if (!kissopenAgentHumanMessageAuthor(entry.message.sender)) continue;
        const sentAt = Date.parse(entry.message.createdAt);
        if (Number.isFinite(sentAt)) earliestSentAt = sentAt;
    }
    return earliestSentAt === undefined ? undefined : Math.max(0, now - earliestSentAt);
}

/**
 * The right panel's header band and its two stacked regions. The upper one is
 * the addressed project/worktree's live changed-file list; the lower one is the
 * terminal section. The divider between them is the user's, so a shell can take
 * most of the column or none of it.
 *
 * Only the tab strip re-renders from this component's subscription; a terminal's
 * own output lands in `KissopenAgentTerminalTab`, which subscribes to that terminal alone,
 * so a busy shell never re-renders its neighbours or the tab bar above it.
 *
 * The band is empty and still earns its place: it puts this column's tabs on the
 * same line as the session tabs beside them instead of a header's height higher,
 * and in the desktop window it gives that edge a lane to drag the window by.
 */
/** The styles an assistant can answer in, in the order the dialog offers them. */
const BOT_TONES = [
    { id: "professional", label: "Professional" },
    { id: "friendly", label: "Friendly" },
    { id: "creative", label: "Creative" },
    { id: "concise", label: "Concise" },
    { id: "casual", label: "Casual" },
    { id: "expert", label: "Expert" },
] as const;

/**
 * An assistant's settings dialog, mounted once for the window. The store says
 * which assistant is open; the sidebar's bot list supplies its picture, which
 * follows the agent's own `bot.updated` events after an upload.
 */
function KissopenAgentBotSettingsHost(props: {
    store: KissopenAgentBotSettingsStore;
    bots: readonly KissopenAgentBot[];
}) {
    const state = useSyncExternalStore(
        reactFrameSubscribe(props.store),
        props.store.get,
        props.store.get,
    );
    if (state.botId === null) return null;
    const store = props.store;
    const bot = props.bots.find((candidate) => candidate.id === state.botId);
    const stored = state.stored.type === "ready" ? state.stored.value : undefined;
    const files = state.files.type === "ready" ? state.files.value : undefined;
    const file = files?.find((candidate) => candidate.name === state.fileSelected);
    const modelKey = (model: KissopenAgentBotSettingsSnapshot["draft"]["model"]) =>
        model === null ? null : `${model.providerId}/${model.modelId}`;
    const selectedModel = modelKey(state.draft.model);
    // Two providers can offer models with the same name; those say whose they are.
    const models = state.modelChoices.map((choice) => ({
        id: choice.key,
        label:
            state.modelChoices.filter((other) => other.name === choice.name).length > 1
                ? `${choice.name} · ${choice.providerId}`
                : choice.name,
    }));
    // A model the assistant was set to that no enabled provider offers any more is still its
    // setting, and is shown rather than silently dropped.
    if (selectedModel !== null && !models.some((choice) => choice.id === selectedModel))
        models.push({ id: selectedModel, label: state.draft.model?.modelId ?? selectedModel });
    const name = stored?.name ?? bot?.name ?? "";
    const history = state.history;
    return (
        <KissopenAgentBotSettingsDialog
            avatarUploading={state.avatarUploading}
            builtIn={(stored?.systemKey ?? bot?.systemKey ?? null) !== null}
            copying={state.copying}
            description={state.draft.description}
            dirty={state.dirty}
            fileDirty={file?.dirty ?? false}
            fileDraft={file?.draft ?? ""}
            fileLocked={file?.locked ?? false}
            fileSaving={file?.saving ?? false}
            fileSelected={state.fileSelected}
            model={selectedModel}
            models={models}
            name={name}
            nameDraft={state.draft.name}
            onAvatarPick={(picked) => {
                const contentType =
                    picked.type === "image/png" ||
                    picked.type === "image/jpeg" ||
                    picked.type === "image/webp"
                        ? picked.type
                        : undefined;
                if (contentType === undefined) return;
                void picked
                    .arrayBuffer()
                    .then((bytes) => store.avatarUpload(new Uint8Array(bytes), contentType));
            }}
            onClose={() => store.dialogClose()}
            onCopy={() => store.botCopy(t("Copy of {name}", { name }))}
            onDescriptionChange={(value) => store.descriptionUpdate(value)}
            onFileDraftChange={(value) => store.fileDraftUpdate(value)}
            onFileSave={() => store.fileSave()}
            onFileSelect={(value) => {
                const next = files?.find((candidate) => candidate.name === value);
                if (next !== undefined) store.fileSelect(next.name);
            }}
            onHistoryClose={() => store.fileHistoryClose()}
            onHistoryOpen={() => store.fileHistoryOpen()}
            onModelChange={(id) => {
                if (id === null) {
                    store.modelUpdate(null);
                    return;
                }
                const choice = state.modelChoices.find((candidate) => candidate.key === id);
                if (choice !== undefined)
                    store.modelUpdate({
                        providerId: choice.providerId,
                        modelId: choice.modelId,
                        effort: null,
                    });
            }}
            onNameChange={(value) => store.nameUpdate(value)}
            onPersonBackgroundChange={(value) => store.userBackgroundUpdate(value)}
            onPersonLanguageChange={(value) => store.userLanguageUpdate(value)}
            onPersonNameChange={(value) => store.userNameUpdate(value)}
            onPersonNoteChange={(value) => store.userNoteUpdate(value)}
            onRevisionRestore={(id) => store.fileRevisionRestore(id)}
            onSave={() => store.settingsSave()}
            onTabSelect={(tab) => store.tabSelect(tab)}
            onToneChange={(id) => store.styleUpdate(id)}
            person={state.draft.user}
            saving={state.saving}
            status={
                state.stored.type === "error"
                    ? "error"
                    : state.stored.type === "ready"
                      ? "ready"
                      : "loading"
            }
            tab={state.tab}
            tone={state.draft.style}
            tones={BOT_TONES.map((tone) => ({ id: tone.id, label: t(tone.label) }))}
            username={stored?.username ?? bot?.username ?? ""}
            avatarId={state.botId}
            {...(bot?.avatar === undefined ? {} : { imageUrl: bot.avatar.url })}
            {...(state.stored.type === "error" ? { error: state.stored.error.message } : {})}
            {...(state.saveError === undefined ? {} : { saveError: state.saveError.message })}
            {...(state.avatarError === undefined ? {} : { avatarError: state.avatarError.message })}
            {...(state.copyError === undefined ? {} : { copyError: state.copyError.message })}
            {...(state.copiedName === undefined ? {} : { copiedName: state.copiedName })}
            {...(files === undefined
                ? {}
                : {
                      files: files.map((entry) => ({
                          name: entry.name,
                          locked: entry.locked,
                          dirty: entry.dirty,
                      })),
                  })}
            {...(file?.saveError === undefined ? {} : { fileSaveError: file.saveError.message })}
            {...(file?.stored.updatedAt === null || file?.stored.updatedAt === undefined
                ? {}
                : {
                      fileUpdated: t("Changed {time}", {
                          time: new Date(file.stored.updatedAt).toLocaleString(),
                      }),
                  })}
            {...(history === null
                ? {}
                : {
                      history: {
                          status:
                              history.revisions.type === "ready"
                                  ? "ready"
                                  : history.revisions.type === "error"
                                    ? "error"
                                    : "loading",
                          revisions:
                              history.revisions.type === "ready"
                                  ? history.revisions.value.map((revision) => ({
                                        id: revision.id,
                                        label: new Date(revision.createdAt).toLocaleString(),
                                        detail:
                                            revision.source === "user"
                                                ? t("Saved by you · {size} bytes", {
                                                      size: revision.size,
                                                  })
                                                : t(
                                                      "Changed by the assistant or elsewhere · {size} bytes",
                                                      {
                                                          size: revision.size,
                                                      },
                                                  ),
                                    }))
                                  : [],
                          ...(history.revisions.type === "error"
                              ? { error: history.revisions.error.message }
                              : history.restoreError !== undefined
                                ? { error: history.restoreError.message }
                                : {}),
                          ...(history.restoring === undefined
                              ? {}
                              : { restoring: history.restoring }),
                      },
                  })}
        />
    );
}

/**
 * The dialogs that belong to the window rather than to a screen: naming a row,
 * and Create. Both are reached from chrome that is on every route — the cog on a
 * sidebar row, the Create row above it — so they are mounted once beside the
 * screen instead of inside one of them, and they answer the same way wherever
 * the reader happens to be. Being outside the screen is also what keeps a task
 * being written alive while the surface behind it changes.
 *
 * One subscription serves both: this is a single window-level adapter onto one
 * materialized store, so the routes that render no workspace surface still see
 * a draft change as it is typed.
 */
function KissopenAgentWindowDialogs(props: {
    projects: readonly KissopenAgentProjectGroup[];
    kissopenAgentOnline: () => boolean;
    unavailable?: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const workspace = useSyncExternalStore(
        reactFrameSubscribe(props.workspace),
        props.workspace.get,
        props.workspace.get,
    );
    const boards = useCloudDestinations().boards;
    return (
        <>
            {kissopenAgentNamingDialog(
                workspace.rename,
                workspace.projectArchive,
                workspace.projectCompute,
                props.projects,
                props.workspace,
                props.kissopenAgentOnline,
                props.unavailable,
                boards,
                workspace.machineId ?? boards?.machineId,
            )}
            {kissopenAgentGroupArchiveDialog(
                workspace.groupArchive,
                props.workspace,
                props.kissopenAgentOnline,
                props.unavailable,
            )}
            {workspace.projectClone ? (
                <KissopenAgentProjectCloneDialog
                    repository={workspace.projectClone.repository}
                    submitting={workspace.projectClone.submitting}
                    onClose={() => props.workspace.projectCloneCancel()}
                    onRepositoryChange={(value) => props.workspace.projectRepositoryUpdate(value)}
                    onSubmit={() => props.workspace.projectCloneSubmit()}
                    {...(workspace.projectClone.error === undefined
                        ? {}
                        : { error: workspace.projectClone.error })}
                    {...(props.unavailable === undefined
                        ? {}
                        : { submitDisabledReason: props.unavailable })}
                />
            ) : null}
        </>
    );
}

/**
 * Cmd-W over an empty main pane stops at a confirmation. The dialog names the
 * exact group the store resolved, and the keystroke itself never archives it.
 */
function kissopenAgentGroupArchiveDialog(
    archive: KissopenAgentWorkspaceSnapshot["groupArchive"],
    store: KissopenAgentWorkspaceStore,
    kissopenAgentOnline: () => boolean,
    unavailable?: string,
): ReactNode {
    if (!archive) return null;
    const subject = archive.kind === "worktree" ? t("workspace") : t("project");
    return (
        <ModalOverlay
            {...(archive.submitting ? {} : { onDismiss: () => store.groupArchiveCancel() })}
        >
            <Modal
                footer={
                    <>
                        <Button
                            disabled={archive.submitting}
                            onClick={() => store.groupArchiveCancel()}
                            variant="ghost"
                        >
                            {t("Cancel")}
                        </Button>
                        <Button
                            disabled={unavailable !== undefined}
                            loading={archive.submitting}
                            onClick={() => {
                                if (kissopenAgentOnline())
                                    void store.groupArchiveSubmit().catch(() => undefined);
                            }}
                            variant="danger"
                        >
                            {archive.kind === "worktree"
                                ? t("Archive workspace")
                                : t("Archive project")}
                        </Button>
                    </>
                }
                icon="archive"
                {...(archive.submitting ? {} : { onClose: () => store.groupArchiveCancel() })}
                size="small"
                title={t("Archive {name}?", { name: archive.name })}
                tone="danger"
            >
                {archive.error ? (
                    <Banner tone="danger" title={t("Could not archive {subject}", { subject })}>
                        {archive.error}
                    </Banner>
                ) : null}
                <p>
                    {archive.kind === "worktree"
                        ? t(
                              "This removes the workspace from the sidebar and removes its worktree folder.",
                          )
                        : t(
                              "This removes the project and its sessions from the sidebar, archives every workspace under it, and removes those worktree folders. The project's own checkout stays where it is.",
                          )}
                </p>
            </Modal>
        </ModalOverlay>
    );
}

/**
 * Where a row is named. A project opens its settings dialog rather than a bare
 * field: it has an identity and a checkout worth stating, and its name is the
 * one thing about it the daemon takes a new value for, so the name belongs
 * inside that surface. A worktree has nothing but its name, and gets the field.
 *
 * The project's settings are also where it ends: the archive lives in that same
 * dialog, so the confirmation, what it is waiting on, and why it failed are all
 * one projection of this store rather than a second surface over the first.
 */
function kissopenAgentNamingDialog(
    rename: KissopenAgentWorkspaceSnapshot["rename"],
    archive: KissopenAgentWorkspaceSnapshot["projectArchive"],
    compute: KissopenAgentWorkspaceSnapshot["projectCompute"],
    projects: readonly KissopenAgentProjectGroup[],
    store: KissopenAgentWorkspaceStore,
    kissopenAgentOnline: () => boolean,
    unavailable?: string,
    boards?: CloudDestinations["boards"],
    machineId?: string,
): ReactNode {
    if (!rename) return null;
    if (rename.kind !== "project")
        return (
            <ModalOverlay onDismiss={() => store.renameCancel()}>
                <Modal
                    footer={
                        <>
                            <Button onClick={() => store.renameCancel()} variant="ghost">
                                {t("Cancel")}
                            </Button>
                            <Button
                                disabled={rename.submitting || unavailable !== undefined}
                                onClick={() => {
                                    if (kissopenAgentOnline())
                                        void store.renameSubmit().catch(() => undefined);
                                }}
                                variant="primary"
                            >
                                {t("Rename")}
                            </Button>
                        </>
                    }
                    onClose={() => store.renameCancel()}
                    size="small"
                    title={t("Rename {name}", { name: rename.currentName })}
                >
                    <TextField
                        disabled={rename.submitting}
                        fullWidth
                        label={t("Name")}
                        onSubmit={() => {
                            if (kissopenAgentOnline())
                                void store.renameSubmit().catch(() => undefined);
                        }}
                        onValueChange={(value) => store.renameDraftUpdate(value)}
                        value={rename.draft}
                    />
                </Modal>
            </ModalOverlay>
        );
    // The project may have been archived from another window while this was
    // open. The dialog stays up on what the rename itself carries — the reader
    // still has an edit in front of them, and dismissing it is what clears the
    // draft — and simply drops the section it can no longer state.
    const project = projects.find((candidate) => candidate.id === rename.projectId);
    // Only what this dialog's own project is doing: an archive confirmed on
    // another project — or one this dialog was opened over afterwards — is not
    // this reader's question.
    const archiving = archive?.projectId === rename.projectId ? archive : undefined;
    // The archive is shown whenever an intent for it exists, whether or not the
    // row is in the list this render happens to hold: an operation the reader
    // started is not a fact about the catalog, and dropping the block the moment
    // the row went would take the pending state, the button, and the reason a
    // failure gave with it. Only a project with nothing pending has to be listed
    // to be offered one.
    const archiveBlock =
        archiving || project
            ? {
                  archive: {
                      confirming: archiving !== undefined,
                      submitting: archiving?.submitting === true,
                      ...(archiving?.error !== undefined ? { error: archiving.error } : {}),
                  },
              }
            : {};
    // Only this dialog's own project again. The compute block is materialized
    // with the dialog and released with it, so a snapshot naming another project
    // can only be one this render has raced; dropping it is what stops one
    // project's setting — and the handler that would save it — from being shown
    // over another.
    const computeBlock =
        compute?.projectId === rename.projectId
            ? {
                  compute: {
                      status: compute.status,
                      mode: compute.mode,
                      image: compute.image,
                      ...(compute.current === undefined ? {} : { current: compute.current }),
                      submitting: compute.submitting,
                      ...(compute.error === undefined ? {} : { error: compute.error }),
                      ...(compute.readError === undefined ? {} : { readError: compute.readError }),
                  },
              }
            : {};
    return (
        <KissopenAgentProjectSettingsDialog
            draft={rename.draft}
            {...(project?.avatar ? { imageUrl: project.avatar.url } : {})}
            {...archiveBlock}
            {...computeBlock}
            {...(project
                ? {
                      contents: {
                          sessions:
                              project.conversations.length +
                              project.worktrees.reduce(
                                  (total, worktree) => total + worktree.conversations.length,
                                  0,
                              ),
                          worktrees: project.worktrees.length,
                      },
                      location: { displayPath: project.displayPath, path: project.path },
                  }
                : {})}
            // While an archive is pending, the name is the one the intent
            // captured and the store keeps current against the host: what the
            // reader is being asked to destroy has to be the entity that is
            // about to be destroyed, not whatever this dialog was opened on.
            name={archiving?.name ?? rename.currentName}
            onArchiveCancel={() => store.projectArchiveCancel()}
            onArchiveConfirm={() => {
                if (kissopenAgentOnline()) void store.projectArchiveSubmit().catch(() => undefined);
            }}
            onArchiveRequest={() => store.projectArchiveOpen(rename.projectId)}
            onClose={() => store.renameCancel()}
            onComputeImageChange={(value) => store.projectComputeImageUpdate(value)}
            onComputeModeChange={(mode) => store.projectComputeModeUpdate(mode)}
            onComputeSubmit={() => {
                if (kissopenAgentOnline()) void store.projectComputeSubmit().catch(() => undefined);
            }}
            onDraftChange={(value) => store.renameDraftUpdate(value)}
            onSubmit={() => {
                if (kissopenAgentOnline()) void store.renameSubmit().catch(() => undefined);
            }}
            submitting={rename.submitting}
            {...(unavailable === undefined ? {} : { submitDisabledReason: unavailable })}
        />
    );
}

/**
 * Create, as the whole content region. The store owns what is being written, so
 * this is only a projection of `workspace.create` into the shared surface and
 * its callbacks back into the same store — including the task, which lives there
 * so that going elsewhere in the window puts the draft down rather than
 * destroying it.
 *
 * The route addressing this surface is what materialized the draft, so a render
 * without one is the frame after a session started and before the window has
 * followed it into the new conversation.
 */
function KissopenAgentCreateSurface(props: {
    kissopenAgentOnline: () => boolean;
    unavailable?: string;
    workspace: KissopenAgentWorkspaceStore;
}) {
    const create = useSyncExternalStore(
        reactFrameSubscribe(props.workspace),
        props.workspace.get,
        props.workspace.get,
    ).create;
    if (!create) return null;
    const store = props.workspace;
    return (
        <KissopenAgentCreateSessionPage
            botName={create.botName}
            destinations={create.groups.map((group) => ({
                displayPath: group.displayPath,
                id: group.id,
                label: group.label,
                ...(group.parentLabel === undefined ? {} : { parentLabel: group.parentLabel }),
            }))}
            destinationsLoading={create.groupsLoading}
            {...(create.groupId === undefined ? {} : { destinationId: create.groupId })}
            {...(create.draft ? { menus: create.draft.menus } : {})}
            {...(create.error === undefined ? {} : { error: create.error })}
            kind={create.kind}
            onBotNameChange={(name) =>
                reactFrameInputUpdate(store, () => store.createBotNameUpdate(name))
            }
            onKindSelect={(kind) => store.createKindUpdate(kind)}
            onDestinationSelect={(id) => store.createGroupUpdate(id as KissopenAgentGroupId)}
            onEffortChange={(effort) => store.createEffortUpdate(effort)}
            onModelChange={(selection) => store.createModelUpdate(selection)}
            onPermissionModeChange={(mode) => store.createPermissionModeUpdate(mode)}
            onServiceTierChange={(tier) => store.createServiceTierUpdate(tier)}
            onSubmit={() => {
                if (props.kissopenAgentOnline()) void store.createSubmit().catch(() => undefined);
            }}
            // The task is a controlled field, so its new value has to reach React
            // inside the event that produced it; left in the frame queue, React
            // restores the old value and takes the caret to the end of it.
            onTextChange={(text) =>
                reactFrameInputUpdate(store, () => store.createTextUpdate(text))
            }
            submitting={create.submitting}
            {...(props.unavailable === undefined
                ? {}
                : { submitDisabledReason: props.unavailable })}
            text={create.text}
        />
    );
}

/**
 * One changed file as a listing entry. Under "All files" the changed ones keep
 * their status marks, so the work in progress stays findable inside the whole
 * tree rather than becoming indistinguishable from everything around it.
 */
function changeEntry(change: OpenGroup["changes"][number]): FileTreeBuildEntry {
    return {
        path: change.path,
        gitStatus: change.status,
        ...(change.addedLines === undefined ? {} : { addedLines: change.addedLines }),
        ...(change.deletedLines === undefined ? {} : { deletedLines: change.deletedLines }),
    };
}

/** Projects only the directory pages the workspace store has materialized. */
function workspaceFileTreeNodes(
    files: KissopenAgentWorkspaceFiles | undefined,
    directoryPath: string,
    expansion: FileTreeExpansion,
    changesByPath: ReadonlyMap<string, OpenGroup["changes"][number]>,
    depth = 0,
): FileTreeNode[] {
    const directory = files?.directories.get(directoryPath);
    if (directory === undefined) return [];
    const entries = [...directory.entries].sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
        return fileNameCompare(left.name, right.name);
    });
    return entries.map((entry) => {
        const change = changesByPath.get(entry.path);
        const facts = {
            ...(change?.status === undefined ? {} : { gitStatus: change.status }),
            ...(change?.addedLines === undefined ? {} : { addedLines: change.addedLines }),
            ...(change?.deletedLines === undefined ? {} : { deletedLines: change.deletedLines }),
        };
        if (entry.kind === "file")
            return {
                id: entry.path,
                kind: "file" as const,
                name: entry.name,
                ...facts,
            };
        const expanded = fileTreeExpanded(expansion, entry.path, depth);
        const child = files?.directories.get(entry.path);
        return {
            id: entry.path,
            kind: "directory" as const,
            name: entry.name,
            expanded,
            ...(expanded
                ? {
                      children: workspaceFileTreeNodes(
                          files,
                          entry.path,
                          expansion,
                          changesByPath,
                          depth + 1,
                      ),
                      hasMore: child?.loading !== true && child?.nextCursor !== undefined,
                      loading: child === undefined || (child.loading && child.entries.length === 0),
                  }
                : {}),
        };
    });
}

/*
The panel beside a conversation: its files, its changes, and the tools a
reader opened there.

Exported because it is the window's one panel. A project on another machine
needs the same column — the same tabs, the same tree, the same chrome — and
the alternative was a second panel that would drift from this one the first
time either was touched. Everything it knows arrives as props, so what differs
between a checkout on this machine and one on a Mac across the room is who
supplies them.
*/
const uploadNone = () => () => undefined;
const UPLOAD_IDLE: KissopenAgentFileUploadSnapshot = {
    phase: "idle",
    total: 0,
    done: 0,
    paths: [],
};
const uploadIdle = () => UPLOAD_IDLE;

/** What the listing says about the last batch of files handed to the project. */
function uploadNoticeOf(
    state: KissopenAgentFileUploadSnapshot,
    store: KissopenAgentFileUploadStore | undefined,
): FileBrowserUploadNotice | undefined {
    if (!store) return undefined;
    switch (state.phase) {
        case "idle":
            return undefined;
        case "uploading":
            return {
                tone: "progress",
                text: t("Uploading {done} of {total}…", {
                    done: state.done + 1,
                    total: state.total,
                }),
            };
        case "uploaded":
            return {
                tone: "done",
                text:
                    state.done === 1
                        ? t("1 file uploaded to uploads/.")
                        : t("{count} files uploaded to uploads/.", { count: state.done }),
                onDismiss: () => store.noticeDismiss(),
            };
        case "failed":
            return {
                tone: "error",
                text:
                    state.done > 0
                        ? t("{done} of {total} uploaded; stopped: {reason}", {
                              done: state.done,
                              total: state.total,
                              reason: state.error ?? "",
                          })
                        : (state.error ?? t("The upload did not go through.")),
                onDismiss: () => store.noticeDismiss(),
            };
    }
}

export function KissopenAgentPanelBody(props: {
    activity?: KissopenAgentConversationSnapshot;
    browserContent?: BrowserContentRenderer;
    browserConnectionId: string | null;
    htmlPreview?: HtmlPreviewRenderer;
    mediaWindow?: MediaWindowOpener;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    documentConversion?: KissopenAgentDocumentConversionOpener;
    canStartBrowser: boolean;
    canStartTerminal: boolean;
    changes: OpenGroup["changes"];
    changesStatus?: OpenGroup["changesStatus"];
    closeShortcut?: KeyboardShortcut;
    expanded: ReadonlySet<string>;
    collapsed: ReadonlySet<string>;
    layout: KissopenAgentFileLayout;
    /** Reference clock for elapsed subagent activity. */
    now: number;
    /** Selects Activity through the owning workspace. */
    onActivityOpen: () => void;
    /** Selects the session Usage tab through the owning workspace. */
    onUsageOpen: () => void;
    /** Stops one background process from the Activity tab. */
    onActivityProcessStop?: (processId: number) => void;
    /** Opens one delegated child session from the Activity tab. */
    onSubagentSelect?: (sessionId: string) => void;
    onFileOpen: (path: string) => void;
    onFilePreprocess: (path: string) => void;
    onFileSelect: (path: string) => void;
    onLayoutChange: (layout: KissopenAgentFileLayout) => void;
    onPanelClose: () => void;
    /** The file the viewer tab is on, read out of the transcript beside it. */
    panelFile?: KissopenAgentFileTabSnapshot;
    /**
     * Draws one open file. It is the workspace's own file body, so the file
     * beside a conversation is the identical surface to the file in a
     * main-content tab — same header, same Rendered / Source, same editor,
     * same Command-S.
     */
    fileBody: (file: KissopenAgentFileTabSnapshot) => ReactNode;
    onPanelFileClose: () => void;
    onScopeChange: (scope: KissopenAgentFileScope) => void;
    onToggle: (path: string, expanded: boolean) => void;
    onDirectoryPrefetch: (path: string) => void;
    onLoadMore: (path: string) => void;
    /** Moves one view out of this panel and into the main content. */
    onViewTransfer: (viewId: string) => void;
    /** Closes one panel view through the same route used by Cmd-W. */
    onViewClose: (viewId: string) => void;
    panel: KissopenAgentPanelSnapshot;
    previewTool?: ConversationToolCall;
    /** Owning Kissopen Agent availability applied to every retained terminal tab. */
    kissopenAgentAvailability?: "reconnecting" | "unavailable";
    kissopenAgentAvailabilityReason?: string;
    scope: KissopenAgentFileScope;
    selectedPath?: string;
    store: KissopenAgentPanelStore;
    workspaceFiles?: KissopenAgentWorkspaceFiles;
    workspaceFilesLoading: boolean;
    /**
     * Where files the reader drops on the listing, or picks, are uploaded to
     * the project's `uploads/`. Absent, the listing takes none.
     */
    upload?: KissopenAgentFileUploadStore;
    /** A batch has landed; where each file is, relative to the project. */
    onUploaded?: (paths: readonly string[]) => void;
}) {
    const uploadState = useSyncExternalStore(
        props.upload?.subscribe ?? uploadNone,
        props.upload?.get ?? uploadIdle,
        props.upload?.get ?? uploadIdle,
    );
    const uploadStore = props.upload;
    const onUploaded = props.onUploaded;
    const uploadNotice = uploadNoticeOf(uploadState, uploadStore);
    const all = props.scope === "all";
    const entries: FileTreeBuildEntry[] = useMemo(
        () => props.changes.map(changeEntry),
        [props.changes],
    );
    const expansion: FileTreeExpansion = useMemo(
        () => ({
            opened: props.expanded,
            closed: props.collapsed,
            // All Files starts closed because every disclosure is a real daemon
            // read. Changes is already complete in memory and can open one level.
            defaultDepth: all ? 0 : 1,
        }),
        [all, props.expanded, props.collapsed],
    );
    const changesByPath = useMemo(
        () => new Map(props.changes.map((change) => [change.path, change])),
        [props.changes],
    );
    const nodes: FileTreeNode[] = useMemo(
        () =>
            all
                ? workspaceFileTreeNodes(props.workspaceFiles, "", expansion, changesByPath)
                : props.layout === "tree"
                  ? fileTreeBuild(entries, expansion)
                  : fileTreeFlatten(entries),
        [all, changesByPath, entries, expansion, props.layout, props.workspaceFiles],
    );
    const loading = all ? props.workspaceFilesLoading : props.changesStatus === "loading";
    const changesUnavailable = props.changesStatus === "unavailable";
    const changesStale = !all && props.changesStatus === "stale";
    const addedLines = props.changes.reduce((sum, change) => sum + (change.addedLines ?? 0), 0);
    const deletedLines = props.changes.reduce((sum, change) => sum + (change.deletedLines ?? 0), 0);
    const count = !all && (changesUnavailable || loading) ? undefined : entries.length;
    // Only the tabs this side is holding: one the reader moved into the main
    // content is drawn there, and the panel neither lists it nor renders it.
    const panelTools = toolTabsPlaced(props.panel, "panel");
    const activeToolTab = panelTools.find((tab) => tab.id === props.panel.activeViewId);
    const panelFile = props.panelFile;
    const activityTabShown =
        props.panel.activityViewOpen ||
        (props.activity?.activityAvailable === true && !props.panel.activityViewDismissed);
    const activityBackgroundProcesses = props.activity
        ? props.activity.backgroundProcesses.filter((process) =>
              props.activity?.detachedBackgroundProcessIds.has(process.id),
          )
        : [];
    const allFilesUnavailable =
        props.kissopenAgentAvailability !== undefined && props.workspaceFiles === undefined
            ? (props.kissopenAgentAvailabilityReason ??
              t("KissOpen Agent must reconnect before loading all files."))
            : undefined;
    const baseTabs: TabItem[] = [
        { closable: false, icon: "files", id: "files", label: t("Files") },
        ...(activityTabShown
            ? [{ closable: true, icon: "agents" as const, id: "activity", label: t("Activity") }]
            : []),
        ...(props.panel.usageViewOpen
            ? [{ closable: true, icon: "clock" as const, id: "usage", label: t("Usage") }]
            : []),
        ...(props.panel.fileViewOpen && panelFile
            ? [
                  {
                      ...fileTabItem(panelFile),
                      closable: true,
                      id: KISSOPEN_AGENT_PANEL_FILE_VIEW_ID,
                      // The viewer holds whatever the transcript last pointed
                      // at, so it is marked as the replaceable tab it is.
                      preview: true,
                  } satisfies TabItem,
              ]
            : []),
        ...(props.panel.previewEntryId
            ? [
                  {
                      closable: true,
                      icon:
                          props.previewTool?.presentation?.type === "fileDiff"
                              ? ("doc" as const)
                              : props.previewTool?.presentation?.type === "execCommand" ||
                                  props.previewTool?.presentation?.type ===
                                      "backgroundTerminalInteraction"
                                ? ("terminal" as const)
                                : ("zap" as const),
                      id: "preview",
                      label: t("Preview"),
                      preview: true,
                  },
              ]
            : []),
        ...toolTabItems(panelTools),
    ];
    const tabs = baseTabs;
    return (
        <>
            {/* The panel's own chrome control, at its leading edge. */}
            <PanelHeader edgeControl>
                <Button
                    aria-label={t("Hide panel")}
                    aria-pressed
                    icon="panel-collapse"
                    iconOnly
                    onClick={props.onPanelClose}
                    shortcut={PANEL_TOGGLE_HINT}
                    size="small"
                    variant="ghost"
                />
            </PanelHeader>
            {/* The whole panel accepts a tab dragged out of the main strip,
                rather than a target inside it: the reader is aiming at this
                side of the window, not at a stripe within it. */}
            <TransferZone
                icon="panel-expand"
                id={TRANSFER_ZONE_PANEL}
                label={t("Open in the side panel")}
            >
                <TabbedPane
                    actions={
                        props.canStartTerminal ||
                        (props.browserContent && props.canStartBrowser) ? (
                            <>
                                {props.browserContent && props.canStartBrowser ? (
                                    <Button
                                        aria-label={t("New browser")}
                                        icon="globe"
                                        iconOnly
                                        onClick={() => props.store.browserAdd()}
                                        size="small"
                                        variant="ghost"
                                    />
                                ) : null}
                                {/* A shell runs in the checkout, so a checkout
                                that cannot take work cannot host one. The
                                panel carries the reason with its scope. */}
                                {props.canStartTerminal ? (
                                    <Button
                                        aria-label={t("New terminal")}
                                        disabled={props.panel.terminalRefusal !== undefined}
                                        icon="terminal"
                                        iconOnly
                                        onClick={() => props.store.terminalAdd()}
                                        size="small"
                                        title={props.panel.terminalRefusal ?? t("New terminal")}
                                        variant="ghost"
                                    />
                                ) : null}
                            </>
                        ) : undefined
                    }
                    activeId={props.panel.activeViewId}
                    closeLabel={t("Close tab")}
                    {...(props.closeShortcut ? { closeShortcut: props.closeShortcut } : {})}
                    onClose={props.onViewClose}
                    onSelect={(tabId) => {
                        if (tabId === "files") props.store.filesSelect();
                        else if (tabId === "activity") props.onActivityOpen();
                        else if (tabId === "usage") props.onUsageOpen();
                        else if (tabId === "preview" && props.panel.previewEntryId)
                            props.store.previewOpen(props.panel.previewEntryId);
                        else if (tabId === KISSOPEN_AGENT_PANEL_FILE_VIEW_ID)
                            props.store.fileViewOpen();
                        else props.store.tabSelect(tabId as KissopenAgentPanelTabId);
                    }}
                    onTransfer={(tabId) => props.onViewTransfer(tabId)}
                    tabs={tabs}
                    // The listing opens content rather than being content, and a
                    // tool-call preview is bound to an entry of the conversation
                    // the main content is showing; neither has a form over there.
                    transferable={(tab) =>
                        tab.id !== "files" &&
                        tab.id !== "activity" &&
                        tab.id !== "usage" &&
                        tab.id !== "preview"
                    }
                    transferTargets={PANEL_TRANSFER_TARGETS}
                >
                    <KissopenAgentToolBodies
                        activeId={props.panel.activeViewId}
                        browserConnectionId={props.browserConnectionId}
                        {...(props.browserContent ? { browserContent: props.browserContent } : {})}
                        store={props.store}
                        tabs={panelTools}
                        {...(props.kissopenAgentAvailability === undefined
                            ? {}
                            : {
                                  kissopenAgentAvailability: props.kissopenAgentAvailability,
                                  ...(props.kissopenAgentAvailabilityReason === undefined
                                      ? {}
                                      : {
                                            kissopenAgentAvailabilityReason:
                                                props.kissopenAgentAvailabilityReason,
                                        }),
                              })}
                    />
                    {props.panel.activeViewId === "files" ? (
                        <FileBrowser
                            hideChanges
                            // Only Changes has a complete total and line delta;
                            // All Files stays visually focused on its lazy tree.
                            {...(all || changesUnavailable || loading
                                ? {}
                                : { addedLines, deletedLines })}
                            count={count}
                            emptyLabel={
                                all
                                    ? "No files."
                                    : changesUnavailable
                                      ? "Git changes are temporarily unavailable."
                                      : "No changed files."
                            }
                            layout={props.layout}
                            loading={loading}
                            nodes={nodes}
                            {...(changesStale
                                ? {
                                      note: "Showing the last successful Git scan. Retrying automatically…",
                                  }
                                : {})}
                            {...(props.kissopenAgentAvailability !== undefined && all
                                ? {
                                      fileActionsUnavailable:
                                          props.kissopenAgentAvailabilityReason ??
                                          t("KissOpen Agent must reconnect before opening files."),
                                  }
                                : {})}
                            onLayoutChange={(layout: KissopenAgentFileLayout) =>
                                props.onLayoutChange(layout)
                            }
                            onDirectoryPrefetch={props.onDirectoryPrefetch}
                            onFilePrefetch={props.onFilePreprocess}
                            onLoadMore={props.onLoadMore}
                            {...(props.kissopenAgentAvailability === undefined
                                ? { onOpen: props.onFileOpen }
                                : {})}
                            onScopeChange={(scope: KissopenAgentFileScope) =>
                                props.onScopeChange(scope)
                            }
                            {...(allFilesUnavailable === undefined
                                ? {}
                                : {
                                      scopeUnavailable: {
                                          all: allFilesUnavailable,
                                      },
                                  })}
                            onSelect={(path: string) => props.onFileSelect(path)}
                            onToggle={props.onToggle}
                            scope={props.scope}
                            selectedId={props.selectedPath}
                            {...(uploadStore
                                ? {
                                      onUpload: (files: File[]) => {
                                          void uploadStore.filesUpload(files).then((paths) => {
                                              if (paths.length > 0) onUploaded?.(paths);
                                          });
                                      },
                                  }
                                : {})}
                            {...(uploadNotice ? { uploadNotice } : {})}
                        />
                    ) : props.panel.activeViewId === "activity" ? (
                        props.activity ? (
                            <KissopenAgentActivityPanel
                                backgroundProcesses={activityBackgroundProcesses}
                                goal={props.activity.goal}
                                now={props.now}
                                onBackgroundProcessStop={props.onActivityProcessStop}
                                onSubagentSelect={props.onSubagentSelect}
                                placement="panel"
                                subagents={props.activity.subagents}
                                tasks={props.activity.tasks}
                            />
                        ) : (
                            <EmptyState
                                description={t(
                                    "Open a session to see its goal, tasks, subagents, and background terminals.",
                                )}
                                icon="agents"
                                size="panel"
                                title={t("No session activity")}
                            />
                        )
                    ) : props.panel.activeViewId === "usage" ? (
                        props.activity ? (
                            <KissopenAgentUsagePanel
                                error={props.activity.usageError}
                                loading={props.activity.usageLoading}
                                placement="panel"
                                usage={props.activity.usage}
                            />
                        ) : (
                            <EmptyState
                                description={t(
                                    "Open a session to see its token, cost, context, and quota usage.",
                                )}
                                icon="clock"
                                size="panel"
                                title={t("No session usage")}
                            />
                        )
                    ) : props.panel.activeViewId === "preview" ? (
                        props.previewTool ? (
                            <ToolCallPreview tool={props.previewTool} />
                        ) : (
                            <EmptyState
                                description={t(
                                    "The selected call is no longer in this conversation view.",
                                )}
                                icon="zap"
                                size="panel"
                                title={t("Preview unavailable")}
                            />
                        )
                    ) : props.panel.activeViewId === KISSOPEN_AGENT_PANEL_FILE_VIEW_ID ? (
                        panelFile ? (
                            props.fileBody(panelFile)
                        ) : (
                            <EmptyState
                                description={t(
                                    "The file this conversation pointed at is no longer open.",
                                )}
                                icon="doc"
                                size="panel"
                                title={t("No file open")}
                            />
                        )
                    ) : activeToolTab ? null : ( // Already drawn above, for every kind of tool.
                        <EmptyState
                            description={t(
                                "Select Files, Activity, Usage, a preview, or a live tool tab.",
                            )}
                            icon="files"
                            size="panel"
                            title={t("Nothing selected")}
                        />
                    )}
                </TabbedPane>
            </TransferZone>
        </>
    );
}

/**
 * Whether a file is one the shell's separate window has a viewer for. Pictures
 * and recordings are; a document, a listing, or an archive is not, and offering
 * to open one in a window that could only say so again would be a control that
 * does nothing.
 */
function mediaWindowShowable(kind: FilePreviewKind): boolean {
    return kind === "image" || kind === "video";
}

/**
 * One terminal tab. It reads the terminal's own store, which is the only thing in
 * this surface that changes on every frame of output, and hands it to the shared
 * `TerminalPanel` with no height of its own so it fills the panel column. The tab
 * names it and closes it, so the panel draws no chrome of its own above the grid.
 */
/**
 * The bodies of the live tool tabs on one side of the workspace, written once
 * and rendered by whichever side is currently holding them: moving a tab across
 * the window changes which strip draws it and nothing about what it is.
 *
 * Browser pages are all mounted together and only one is shown, because a page that
 * stopped being looked at is still loaded and unmounting it would throw the
 * session away; a terminal is drawn only while it is on screen, and its process
 * outlives its view because the store, not this component, is what holds it.
 *
 * Moving a terminal across the window therefore costs it nothing: the view is
 * rebuilt on the other side and attaches to the same running shell. A page
 * cannot be given that promise. An iframe reloads whenever it is moved to a
 * different parent — that is the browser's rule, not this component's, and no
 * arrangement of React can move a node without moving it. So a page that
 * changes sides loads again, from the address the store kept for it, which is
 * why the address lives in the store and not in the frame.
 */
function KissopenAgentToolBodies(props: {
    tabs: readonly KissopenAgentPanelTabSnapshot[];
    activeId: string | undefined;
    store: KissopenAgentPanelStore;
    browserContent?: BrowserContentRenderer;
    browserConnectionId: string | null;
    /** Owning Kissopen Agent availability applied to retained terminal tabs. */
    kissopenAgentAvailability?: "reconnecting" | "unavailable";
    kissopenAgentAvailabilityReason?: string;
}) {
    const active = props.tabs.find((tab) => tab.id === props.activeId);
    return (
        <>
            {props.tabs
                .filter((tab) => tab.kind === "browser")
                .map((tab) => (
                    <BrowserPanel
                        active={props.activeId === tab.id}
                        initialUrl={tab.url}
                        key={tab.id}
                        onLocationChange={(url) => props.store.browserUpdate(tab.id, { url })}
                        onTitleChange={(title) => props.store.browserUpdate(tab.id, { title })}
                        {...(props.kissopenAgentAvailability === undefined
                            ? {}
                            : {
                                  unavailable:
                                      props.kissopenAgentAvailabilityReason ??
                                      t(
                                          "This KissOpen Agent is reconnecting. Browser navigation is paused.",
                                      ),
                              })}
                        renderContent={
                            props.browserContent
                                ? (browserProps) =>
                                      props.browserContent!({
                                          ...browserProps,
                                          ...(tab.automationId
                                              ? { automationId: tab.automationId }
                                              : {}),
                                          target: {
                                              connectionId: props.browserConnectionId,
                                              workspaceId: tab.workspaceId,
                                          },
                                      })
                                : undefined
                        }
                    />
                ))}
            {active?.kind === "terminal" ? (
                <KissopenAgentTerminalTab
                    key={active.id}
                    store={props.store}
                    tabId={active.id}
                    {...(props.kissopenAgentAvailability === undefined
                        ? {}
                        : {
                              kissopenAgentAvailability: props.kissopenAgentAvailability,
                              ...(props.kissopenAgentAvailabilityReason === undefined
                                  ? {}
                                  : {
                                        kissopenAgentAvailabilityReason:
                                            props.kissopenAgentAvailabilityReason,
                                    }),
                          })}
                />
            ) : null}
        </>
    );
}

function KissopenAgentTerminalTab(props: {
    store: KissopenAgentPanelStore;
    tabId: KissopenAgentPanelTabId;
    kissopenAgentAvailability?: "reconnecting" | "unavailable";
    kissopenAgentAvailabilityReason?: string;
}) {
    const terminal: KissopenAgentTerminalStore | undefined = props.store.terminal(props.tabId);
    if (!terminal)
        return (
            <EmptyState
                description={t("This terminal is no longer available.")}
                icon="terminal"
                size="panel"
                title={t("Terminal closed")}
            />
        );
    return (
        <KissopenAgentTerminalScreen
            terminal={terminal}
            {...(props.kissopenAgentAvailability === undefined
                ? {}
                : {
                      kissopenAgentAvailability: props.kissopenAgentAvailability,
                      ...(props.kissopenAgentAvailabilityReason === undefined
                          ? {}
                          : {
                                kissopenAgentAvailabilityReason:
                                    props.kissopenAgentAvailabilityReason,
                            }),
                  })}
        />
    );
}

/** The subscribed half of a terminal tab, split out so the store is non-optional. */
function KissopenAgentTerminalScreen(props: {
    terminal: KissopenAgentTerminalStore;
    kissopenAgentAvailability?: "reconnecting" | "unavailable";
    kissopenAgentAvailabilityReason?: string;
}) {
    const { terminal } = props;
    const snapshot = useSyncExternalStore(terminal.subscribe, terminal.get, terminal.get);
    return (
        <TerminalPanel
            colorScheme={snapshot.colorScheme}
            exitCode={snapshot.exitCode}
            {...(snapshot.grid ? { grid: snapshot.grid } : {})}
            {...(snapshot.error ? { error: snapshot.error.message } : {})}
            onInput={(data) => terminal.terminalWrite(data)}
            onOpenLink={openExternalLink}
            onReconnect={() => terminal.terminalReconnect()}
            onResize={(cols, rows) => terminal.terminalResize(cols, rows)}
            {...(props.kissopenAgentAvailability === undefined
                ? {}
                : {
                      kissopenAgentAvailability: props.kissopenAgentAvailability,
                      ...(props.kissopenAgentAvailabilityReason === undefined
                          ? {}
                          : {
                                kissopenAgentAvailabilityReason:
                                    props.kissopenAgentAvailabilityReason,
                            }),
                  })}
            status={snapshot.status}
        />
    );
}
