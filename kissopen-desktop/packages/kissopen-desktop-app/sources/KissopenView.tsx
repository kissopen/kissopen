import {
    localePreference,
    localePreferenceChange,
    localePreferenceChangeable,
    t,
    themeEffective,
} from "kissopen-desktop-state";
import { openExternalLink } from "./externalLink";
import { AppAccountProfile } from "./components/AppAccountProfile";
import { useSyncExternalStore, type ReactNode } from "react";
import { CloudDestinationsProvider, type CloudDestinations } from "./cloudDestinations";
import { accountMenuItems } from "./AppKissopenAgentView";
import {
    KissopenStore,
    type AppearanceStore,
    type KissopenAgentWindowStore,
    type KissopenTab,
    type KissopenBoardPlace,
    type KissopenBoardTiming,
    type KissopenAgentBoardCard,
} from "kissopen-desktop-state";
import {
    AppShell,
    APP_SHELL_PANEL_DEFAULT_WIDTH,
    SidebarFooter,
    KissopenWordmark,
    ThemeScope,
    ScrollArea,
    KissopenShell,
    KissopenSplitPane,
    Sidebar,
    EmptyState,
    ContextChips,
    KissopenThemesPage,
    PhoneLogin,
    FileLibrary,
    PersonaSetup,
    Modal,
    type IconName,
    KissopenSection,
    KissopenActions,
    KissopenNotice,
    Button,
    TextField,
    type FileLibraryItem,
    type MenuItem,
    type SidebarItem,
    type SidebarSection,
    WebShell,
} from "kissopen-desktop-ui";
/** The product site, where a shared theme opens. */
const SHARE_ORIGIN = "https://kissopen.com";
const baseTabs: readonly { id: KissopenTab; title: string; icon: IconName }[] = [
    { id: "workspace", title: t("工作"), icon: "agents" },
    { id: "files", title: t("资料库"), icon: "files" },
    { id: "themes", title: t("主题"), icon: "shirt" },
    { id: "account", title: t("我的"), icon: "users" },
];
/**
 * What an avatar without a picture shows: the start of the chosen name, or the
 * last two digits of the number — a number has no name to take initials from,
 * and "+8" would name everyone.
 */
function initialsOf(displayName: string, phone: string): string {
    const name = displayName.trim();
    if (name) return [...name].slice(0, 2).join("").toLocaleUpperCase();
    return phone.slice(-2) || "K";
}

/*
Who fills the content region.

Three things can want it — a destination the host supplies, 聊天, and the
window's own tab — and for a while the answer was the order the spreads below
happened to be written in. 聊天 was written second and won, so a reader inside
a cloud conversation could press 远程控制, 计划任务 or 插件 and watch nothing
change: the row was taken, the state moved, and the transcript stayed put. A
control that looks dead is worse than one that is absent, because the reader
presses it again.

So it is a rule with a name and a test instead. The host wins while it has
something to show, because choosing one of its destinations is the most recent
thing the reader did; picking a row in 最近的对话 is how they leave it, and the
host clears itself when they do.
*/
export type KissopenContentOwner = "relay" | "chat" | "window";

export function kissopenContentOwner(state: {
    /** The host has a destination open with something to show. */
    readonly relay: boolean;
    /** A cloud conversation is open. */
    readonly chat: boolean;
    readonly tab: string;
}): KissopenContentOwner {
    if (state.relay) return "relay";
    // 聊天's transcript belongs to 聊天. The column it is picked from is on
    // every tab, but the conversation itself is not.
    if (state.tab === "chat" && state.chat) return "chat";
    return "window";
}

const TEXT_FILES = [".txt", ".md", ".csv", ".json"];
const DOCUMENT_FILES = [".pdf", ".docx", ".xlsx", ".pptx"];
const IMAGE_FILES = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export function KissopenView(props: {
    readonly communityAuthenticated?: boolean;
    readonly store: KissopenStore;
    /** Independent account tools; providing a surface also exposes its sidebar entry. */
    readonly plugins?: ReactNode;
    readonly scheduledTasks?: ReactNode;
    /**
     * Destinations this view does not own, shown beside its own.
     *
     * They reach the rest of the account — the other machines this person has,
     * the cloud workspace, what is scheduled on it and what it runs — which
     * needs a credential only the main process holds. This package draws the
     * rows and shows what it is handed; it does not know the relay exists.
     */
    readonly relayDestinations?: readonly {
        readonly id: string;
        readonly label: string;
        readonly icon: IconName;
    }[];
    /** Offers a destination to its supplier before this view acts. True means taken. */
    readonly onRelayDestinationSelect?: (id: string) => boolean;
    /**
     * The 聊天 tab, supplied whole.
     *
     * Chat here is the account's cloud assistant, which lives on the relay like
     * any other machine — so the conversations it lists and the transcript it
     * shows come from the host, for the same reason the machines do. This view
     * draws the tab and hands it the column and the content.
     */
    /**
     * What the home page needs from the host: the person's real projects,
     * which replace the demonstration's, and where its buttons lead.
     */
    /**
     * This computer as the relay knows it, for scheduling its projects' board
     * builds when its agent has not paired and so cannot say its own id. The
     * desktop's run executor falls back to the same one.
     */
    readonly localMachineId?: string;
    readonly chat?: {
        /** "最近的对话": the conversations this account has with its cloud bot. */
        readonly sections: readonly SidebarSection[];
        readonly activeId?: string;
        /** Takes a row. True means the host opened it. */
        readonly onSelect: (id: string) => boolean;
        readonly content?: ReactNode;
        /** File previews belong to this chat, not the local workspace. */
        readonly panel?: ReactNode;
        readonly panelWidth?: number;
        readonly onPanelWidthChange?: (width: number) => void;
        /** A row's menu: pin, copy, archive, delete — whatever the host can do. */
        readonly menuItems?: (id: string) => MenuItem[];
        readonly onMenuSelect?: (id: string, actionId: string) => void;
    };
    /** Shown in the content region while a relay row is open. */
    readonly relayContent?: ReactNode;
    /**
     * What stands beside it, in the window's own panel column.
     *
     * Offered only alongside `relayContent`, because it is that content's
     * panel: a column left standing over one of the window's own destinations
     * would belong to nothing on screen.
     */
    readonly relayPanel?: ReactNode;
    readonly relayPanelWidth?: number;
    readonly onRelayPanelWidthChange?: (width: number) => void;
    /** The relay row that is open, so the sidebar can mark it. */
    readonly relayActiveId?: string;
    /**
     * Whether the children are a workspace.
     *
     * The workspace draws the window's sidebar — the destinations above, the
     * account below — so while there is no workspace this view draws one of
     * its own around the same destinations, and the children take the 工作
     * region inside it. False only while this computer has no agent and
     * nobody has asked for one; absent means a workspace.
     */
    /**
     * Opens a library file — by the signed address the server gave it — with
     * whatever this machine opens such files with. Absent, a row does not open
     * on a double-click, as in a browser build with no file system to hand it to.
     */
    readonly onFileOpen?: (file: {
        readonly name: string;
        readonly url: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    /**
     * The files in the reader's projects — what was uploaded to each and what
     * its assistant made — listed beside the account's own in 资料库, each
     * with the project it is in. Opening one is the shell's to do: it knows
     * which machine holds it.
     */
    readonly projectFiles?: {
        readonly items: readonly FileLibraryItem[];
        readonly open: (id: string) => void;
        readonly previewRequest?: (id: string) => void;
    };
    /** Local Agent library; never uses the account service's retired file API. */
    readonly localLibrary?: ReactNode;
    readonly workspaceMounted?: boolean;
    /**
     * The PC web client: the account in a browser, with no workspace on this
     * computer. The window is the web client's four-column shell instead of
     * the desktop's sidebar, and 工作 is a page of the account's projects that
     * starts new ones in the cloud.
     */
    readonly webClient?: {
        /** Starts a project in the cloud workspace from what the person wants done. */
        readonly onProjectStart: (goal: string) => Promise<void>;
        /** The assistant's column: what happened, what waits, what runs. */
        readonly assistant?: ReactNode;
    };
    /* For that shell: the footer's appearance toggle and the window's chrome. */
    readonly appearance: AppearanceStore;
    readonly windowState: KissopenAgentWindowStore;
    readonly platform: "desktop" | "web";
    readonly children: ReactNode;
}) {
    const state = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const store = props.store;
    // What the library takes, each kind by its own road: text is sent as
    // text, a document as its bytes for the server to read, a picture as a
    // picture.
    const readFile = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = [...TEXT_FILES, ...DOCUMENT_FILES, ...IMAGE_FILES].join(",");
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
            if (IMAGE_FILES.includes(extension)) void store.imageRead(file);
            else if (DOCUMENT_FILES.includes(extension)) void store.documentRead(file);
            else void store.fileRead(file);
        };
        input.click();
    };
    // One description of the consumer surfaces, read twice: the tab surface shows
    // whichever the window is on, and settings shows the account pair regardless.
    const cloudRender = () => (
        <>
            <KissopenWordmark />
            {state.error && <KissopenNotice error>{state.error}</KissopenNotice>}
            {state.notice && <KissopenNotice>{state.notice}</KissopenNotice>}
        </>
    );
    /*
     * Every file the account has.
     *
     * Narrowing the library to one conversation went with the conversations:
     * those files were made by a chat that no longer has a surface here, and a
     * filter onto something unreachable is worse than no filter.
     */
    const libraryFiles = state.files;
    // Read with the rest of the account (see the store's refresh), so the page
    // has its figures however it is opened.
    const profile = state.profile;
    // 主题: the page is the store's; every change of look goes through it.
    const themesSurface = !state.user ? undefined : (
        <KissopenThemesPage
            busy={state.themeBusy}
            generationHint={state.themeGenerationHint}
            current={state.user.theme}
            draft={state.themeDraft}
            {...(state.themesError ? { error: state.themesError } : {})}
            gallery={state.themeGallery}
            onDelete={(id) => void store.themeDelete(id)}
            onDraftChange={store.themeDraftChange}
            onDraftClear={store.themeDraftClear}
            onDraftEdit={store.themeDraftEdit}
            onDraftSave={() => void store.themeDraftSave()}
            onExport={(theme) => void store.themeExport(theme)}
            onGalleryLoad={(q) => void store.themeGalleryLoad(q)}
            onGenerate={(prompt) => void store.themeGenerate(prompt)}
            onImageUpload={(file) => void store.themeImageUpload(file)}
            onImport={(text) => void store.themeImport(text)}
            onPublish={(id, published) => void store.themePublish(id, published)}
            onSelect={(id) => void store.themeSelect(id)}
            onShareDismiss={store.themeShareDismiss}
            shareLink={(id) => `${SHARE_ORIGIN}/app/?theme=${encodeURIComponent(id)}`}
            shared={state.themeShared}
            {...(state.themeError ? { themeError: state.themeError } : {})}
            themes={state.themes}
        />
    );
    const profileSurface =
        !state.user && !props.communityAuthenticated ? undefined : !profile ? (
            state.profileError ? (
                <EmptyState
                    description={state.profileError}
                    icon="users"
                    size="panel"
                    title={t("资料暂时读取不到")}
                />
            ) : (
                <EmptyState
                    description={state.error || t("正在读取你的资料与使用情况。")}
                    icon="users"
                    size="panel"
                    title={t("正在加载")}
                />
            )
        ) : (
            <AppAccountProfile
                activity={profile.activity ?? []}
                insights={[
                    { label: t("对话总数"), value: String(profile.chats) },
                    {
                        label: t("最长的一段对话"),
                        value: t("{count} 条消息", { count: profile.longest_chat }),
                    },
                    { label: t("资料库文件"), value: String(profile.files) },
                ]}
                name={profile.user.display_name || profile.user.phone || t("KissOpen")}
                initials={initialsOf(profile.user.display_name, profile.user.phone)}
                {...(profile.user.avatar_url ? { imageUrl: profile.user.avatar_url } : {})}
                displayName={profile.user.display_name}
                username={profile.user.username}
                onProfileSave={store.profileSave}
                onAvatarSave={store.avatarSave}
                stats={[
                    { label: t("对话"), value: String(profile.chats) },
                    {
                        label: t("当前连续"),
                        value: t("{count} 天", { count: profile.current_streak }),
                    },
                    {
                        label: t("最长连续"),
                        value: t("{count} 天", { count: profile.longest_streak }),
                    },
                ]}
                today={new Date().toISOString().slice(0, 10)}
                // The username when there is one; the masked number otherwise, which
                // is how the account is otherwise known.
                handle={profile.user.username ? `@${profile.user.username}` : profile.user.phone}
            />
        );
    // The library owns its scroll and measure, so it replaces the content
    // region outright instead of sitting inside the settings-style column.
    const library =
        state.tab === "files" && props.localLibrary ? (
            props.localLibrary
        ) : state.user && state.tab === "files" ? (
            <FileLibrary
                onItemPreviewRequest={props.projectFiles?.previewRequest}
                {...(state.error ? { error: state.error } : {})}
                filter={state.libraryFilter}
                now={state.filesLoaded}
                items={[
                    ...(props.projectFiles?.items ?? []),
                    ...libraryFiles.map((file) => ({
                        id: file.id,
                        name: file.name,
                        kind: file.kind,
                        size: file.size,
                        created: file.created,
                        selected: state.selectedFiles.includes(file.id),
                        // The desktop composer sends text files only; an image has
                        // no slot to land in yet.
                        attachable: file.kind !== "image",
                        // A picture's signed address is its own preview for a tile.
                        ...(file.kind === "image" && file.url ? { previewUrl: file.url } : {}),
                    })),
                ]}
                onFilterChange={store.libraryFilterSelect}
                view={state.libraryView}
                onViewChange={store.libraryViewSelect}
                {...(props.onFileOpen || props.projectFiles
                    ? {
                          onItemOpen: (id: string) => {
                              if (props.projectFiles?.items.some((item) => item.id === id)) {
                                  props.projectFiles.open(id);
                                  return;
                              }
                              if (!props.onFileOpen) return;
                              const file = libraryFiles.find((item) => item.id === id);
                              if (!file?.url) return;
                              const { name, url } = file;
                              void store.fileOpen(() => props.onFileOpen!({ name, url }));
                          },
                      }
                    : {})}
                onSearchChange={store.librarySearchUpdate}
                onUpload={readFile}
                search={state.librarySearch}
            />
        ) : undefined;

    // Nothing in the window is usable until someone has signed in — not the
    // workspace, not settings. Until the service has answered, whether anyone is
    // signed in is not known, so the page says it is connecting instead.
    if (!props.communityAuthenticated && (!state.ready || !state.user))
        return (
            <PhoneLogin
                available={!!state.config?.sms_ready}
                busy={state.busy}
                code={state.code}
                connecting={!state.ready}
                {...(state.developmentCode ? { developmentCode: state.developmentCode } : {})}
                {...(state.error ? { error: state.error } : {})}
                onCodeChange={store.codeUpdate}
                onCodeRequest={() => void store.codeSend()}
                onPhoneChange={store.phoneUpdate}
                onPhoneEdit={store.phoneEdit}
                onSubmit={() => void store.accountLogin()}
                {...(localePreferenceChangeable()
                    ? { language: { value: localePreference(), onChange: localePreferenceChange } }
                    : {})}
                phone={state.phone}
                resendIn={state.resendIn}
                standalone
                step={state.loginStep}
            />
        );
    // Asked once, right after signing in: what the person's work is. The
    // answer — or skipping it — is kept on the account, so a server too old to
    // keep one (no persona field at all) never asks.
    if (!props.communityAuthenticated && state.user?.persona === null)
        return (
            <PersonaSetup
                busy={state.busy}
                {...(state.error ? { error: state.error } : {})}
                onSubmit={(answer) => void store.personaSave(answer)}
            />
        );
    const tabs: readonly { id: KissopenTab; title: string; icon: IconName }[] = [
        ...baseTabs.filter((tab) => tab.id !== "themes" && tab.id !== "account"),
        ...(props.scheduledTasks !== undefined
            ? [{ id: "schedules" as const, title: t("计划任务"), icon: "clock" as const }]
            : []),
        ...(props.plugins !== undefined
            ? [{ id: "plugins" as const, title: t("插件"), icon: "plugin" as const }]
            : []),
        ...baseTabs.filter((tab) => tab.id === "themes" || tab.id === "account"),
    ];
    const owner = kissopenContentOwner({
        relay: props.relayContent !== undefined,
        chat: props.chat?.content !== undefined,
        tab: state.tab,
    });

    const destinations: CloudDestinations = {
        /*
         * Which destination is marked.
         *
         * A host-supplied destination does not move `state.tab` — this
         * view does not own it — so the tab alone would leave the
         * sidebar marking whatever the reader was on before, or
         * nothing at all.
         */
        activeId: props.relayActiveId ?? state.tab,
        // Account details live in settings, not a permanent sidebar row.
        items: [
            ...tabs
                .filter((tab) => tab.id !== "account" && tab.id !== "themes")
                .map((tab) => ({
                    icon: tab.icon,
                    id: tab.id,
                    kind: "view" as const,
                    label: tab.title,
                })),
            // Destinations this view does not own. They reach the rest
            // of the account, which needs a credential only the main
            // process holds, so the host supplies both the rows and
            // what they open onto.
            ...(props.relayDestinations ?? []).map((destination) => ({
                icon: destination.icon,
                id: destination.id,
                kind: "view" as const,
                label: destination.label,
            })),
            // 主题 comes last, below 插件: a place to browse now and then,
            // not part of the work.
            ...(state.user
                ? tabs
                      .filter((tab) => tab.id === "themes")
                      .map((tab) => ({
                          icon: tab.icon,
                          id: tab.id,
                          kind: "view" as const,
                          label: tab.title,
                      }))
                : []),
        ],
        onSelect: (id) => {
            if (props.onRelayDestinationSelect?.(id)) return;
            const tab = tabs.find((tab) => tab.id === id);
            if (tab) store.tabSelect(tab.id);
        },
        ...(profileSurface ? { profileSettings: profileSurface } : {}),
        ...(state.user
            ? {
                  account: {
                      name: state.user.display_name || state.user.phone || t("KissOpen"),
                      initials: initialsOf(state.user.display_name, state.user.phone),
                      ...(state.user.avatar_url ? { imageUrl: state.user.avatar_url } : {}),
                  },
                  // Only the store's own work happens here; where the
                  // window goes afterwards belongs to the surface that
                  // owns navigation, not to the cloud account.
                  onAccountAction: (action: string) => {
                      if (action === "logout") return void store.accountLogout();
                      if (action === "profile") void store.profileLoad();
                  },
              }
            : {}),
        // Whose it is, by the rule above.
        ...(owner === "relay" ? { content: props.relayContent } : {}),
        // The panel belongs to that content, so it stands or goes with it.
        ...(owner === "relay" && props.relayPanel
            ? {
                  panel: props.relayPanel,
                  ...(props.relayPanelWidth === undefined
                      ? {}
                      : { panelWidth: props.relayPanelWidth }),
                  ...(props.onRelayPanelWidthChange
                      ? { onPanelWidthChange: props.onRelayPanelWidthChange }
                      : {}),
              }
            : {}),
        /*
         * 聊天 is the account's cloud assistant, so its column and its
         * transcript both come from the host. They are offered on that
         * tab only: the workspace has a sidebar of its own, and two
         * lists of conversations in one column would mean two things.
         */
        /*
         * 最近的对话 sits under the column wherever the reader is, the
         * way it always has: it is how they get back to something they
         * were saying, and a list you must first navigate to is not
         * that. Only the transcript follows the tab.
         */
        ...(props.chat
            ? {
                  sections: props.chat.sections,
                  /*
                   * Only while the reader is in 聊天. The column stays
                   * put wherever they are, but a marked row inside it
                   * stands in for the destination — so leaving it
                   * marked on another tab would take that tab's
                   * highlight away.
                   */
                  ...(state.tab === "chat" && props.chat.activeId
                      ? { sectionActiveId: props.chat.activeId }
                      : {}),
                  ...(props.chat.menuItems ? { sectionItemMenuItems: props.chat.menuItems } : {}),
                  ...(props.chat.onMenuSelect
                      ? { onSectionItemMenuSelect: props.chat.onMenuSelect }
                      : {}),
                  onSectionItemSelect: (id: string) => {
                      // Opening one from elsewhere has to move the
                      // window to it as well: a row that selects
                      // something the reader cannot see has told them
                      // nothing.
                      if (props.chat?.onSelect(id)) store.tabSelect("chat");
                  },
                  ...(owner === "chat" ? { content: props.chat.content } : {}),
                  ...(owner === "chat" && props.chat.panel
                      ? {
                            panel: props.chat.panel,
                            ...(props.chat.panelWidth === undefined
                                ? {}
                                : { panelWidth: props.chat.panelWidth }),
                            ...(props.chat.onPanelWidthChange
                                ? { onPanelWidthChange: props.chat.onPanelWidthChange }
                                : {}),
                        }
                      : {}),
              }
            : {}),
        /*
         * The window's own tab, when neither of the other two holds
         * the region. 工作 is the exception: its content is the
         * workspace itself, which is already behind all of this.
         */
        ...(owner === "window" && state.tab !== "workspace"
            ? {
                  content: library ??
                      (state.tab === "plugins" ? props.plugins : undefined) ??
                      (state.tab === "schedules" ? props.scheduledTasks : undefined) ??
                      (state.tab === "themes" ? themesSurface : undefined) ??
                      (state.tab === "account" ? profileSurface : undefined) ?? (
                          <ScrollArea className="kissopen-scroll">
                              <div className="kissopen-content">{cloudRender()}</div>
                          </ScrollArea>
                      ),
              }
            : {}),
    };
    if (props.webClient) {
        /*
         * The web client's pages for what the desktop keeps in its agent's
         * settings: the profile is an ordinary destination here, since
         * a browser has no agent settings to hold them.
         */
        const webPage = (children: ReactNode) => (
            <ScrollArea className="kissopen-scroll">
                <div className="kissopen-web-page">{children}</div>
            </ScrollArea>
        );
        const webContent =
            owner !== "window" ? (
                destinations.content
            ) : state.tab === "workspace" ? (
                <EmptyState
                    icon="folder"
                    title={t("选择项目")}
                    description={t("从侧边栏选择项目，继续你的工作。")}
                    size="panel"
                />
            ) : state.tab === "themes" ? (
                themesSurface
            ) : state.tab === "account" ? (
                webPage(profileSurface)
            ) : (
                destinations.content
            );
        return (
            <CloudDestinationsProvider value={destinations}>
                <KissopenWebShell
                    destinations={destinations}
                    appearance={props.appearance}
                    {...(props.webClient.assistant ? { assistant: props.webClient.assistant } : {})}
                >
                    {webContent}
                </KissopenWebShell>
            </CloudDestinationsProvider>
        );
    }
    if (props.workspaceMounted === false)
        return (
            <KissopenStandaloneShell
                destinations={destinations}
                appearance={props.appearance}
                windowState={props.windowState}
                platform={props.platform}
            >
                {props.children}
            </KissopenStandaloneShell>
        );
    return (
        <ThemeScope
            mode={appearance.mode}
            scrollbarVisibility={appearance.scrollbarVisibility}
            theme={themeEffective(state)}
        >
            <CloudDestinationsProvider value={destinations}>
                <KissopenShell
                    selected="workspace"
                    tabs={tabs}
                    onSelect={(id) => {
                        const tab = tabs.find((tab) => tab.id === id);
                        if (tab) store.tabSelect(tab.id);
                    }}
                    workspace={props.children}
                    cloud={cloudRender()}
                />
            </CloudDestinationsProvider>
        </ThemeScope>
    );
}

/*
The window's shell while this computer has no workspace.

The same sidebar the workspace draws — destinations above, the account below —
composed here from the same destinations, so a window working from the cloud
alone looks like the window it will be once an agent is installed, and nothing
the reader learned about where things are has to be relearned. The content is
whatever destination is open, or the children for 工作: on a machine without an
agent that is the offer to set one up.

The footer's menu goes to this view's own pages, because there is no agent
settings surface to go to: profile is the 我的 tab.
*/
function KissopenStandaloneShell(props: {
    readonly destinations: CloudDestinations;
    readonly appearance: AppearanceStore;
    readonly windowState: KissopenAgentWindowStore;
    readonly platform: "desktop" | "web";
    readonly children: ReactNode;
}) {
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const windowState = useSyncExternalStore(
        props.windowState.subscribe,
        props.windowState.get,
        props.windowState.get,
    );
    const destinations = props.destinations;
    const desktop = props.platform === "desktop";
    const controlsAtEnd = desktop && /Windows/u.test(globalThis.navigator?.userAgent ?? "");
    const sidebar = (
        <Sidebar
            actions={[...destinations.items]}
            roomy
            // The open conversation wins over its destination's row; "none open"
            // arrives as an empty string, which `||` passes over.
            activeItemId={destinations.sectionActiveId || destinations.activeId}
            // AppShell reserves the native control band above the brand.
            // A connection rail already identifies the window.
            brand={!desktop || !windowState.connectionRail}
            footer={
                <SidebarFooter
                    avatarSize="md"
                    {...(destinations.account
                        ? {
                              name: destinations.account.name,
                              initials: destinations.account.initials,
                              ...(destinations.account.imageUrl
                                  ? { imageUrl: destinations.account.imageUrl }
                                  : {}),
                              identityMenu: accountMenuItems(destinations.account),
                              onIdentitySelect: (action: string) => {
                                  destinations.onAccountAction?.(action);
                                  if (action === "profile" || action === "settings")
                                      destinations.onSelect("account");
                              },
                          }
                        : {})}
                    appearance={appearance.appearance}
                    onAppearanceToggle={() => props.appearance.appearanceToggle()}
                />
            }
            itemMenuItems={(item) => destinations.sectionItemMenuItems?.(item.id) ?? []}
            onItemMenuSelect={(item, actionId) =>
                destinations.onSectionItemMenuSelect?.(item.id, actionId)
            }
            onItemSelect={(id) => {
                if (destinations.items.some((item) => item.id === id)) {
                    destinations.onSelect(id);
                    return;
                }
                if (
                    destinations.sections?.some((section) =>
                        section.items.some((item) => item.id === id),
                    )
                )
                    destinations.onSectionItemSelect?.(id);
            }}
            sections={[...(destinations.sections ?? [])]}
        />
    );
    return (
        <AppShell
            windowControls={desktop}
            windowControlsAtEnd={controlsAtEnd}
            windowFullScreen={windowState.fullScreen}
            connectionRail={windowState.connectionRail}
            sidebar={sidebar}
            {...(destinations.panel
                ? {
                      panel: destinations.panel,
                      panelResizable: true,
                      panelWidth: destinations.panelWidth ?? APP_SHELL_PANEL_DEFAULT_WIDTH,
                      ...(destinations.onPanelWidthChange
                          ? { onPanelWidthChange: destinations.onPanelWidthChange }
                          : {}),
                  }
                : {})}
        >
            {destinations.content ?? props.children}
        </AppShell>
    );
}

/*
The PC web client's window, composed from the same destinations the desktop's
sidebar is. The rail is the destinations; the list column is the section that
belongs to the open area — the conversations in 聊天, the projects in 工作 and
远程控制 — and nothing where an area has no list; the right column is the open
project's panel when there is one and the assistant's otherwise.
*/
const WEB_LIST_SECTIONS: Readonly<
    Record<string, { section: string; title: string; action: string; icon: "plus" }>
> = {
    chat: { section: "relay:chat", title: "聊天", action: "新对话", icon: "plus" },
    workspace: { section: "relay:projects", title: "项目", action: "新建项目", icon: "plus" },
    "relay:machines": {
        section: "relay:projects",
        title: "项目",
        action: "新建项目",
        icon: "plus",
    },
};

function KissopenWebShell(props: {
    readonly destinations: CloudDestinations;
    readonly appearance: AppearanceStore;
    readonly assistant?: ReactNode;
    readonly children: ReactNode;
}) {
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const destinations = props.destinations;
    // A project page is work, wherever the project is: 工作 is what it marks.
    const activeId =
        destinations.activeId === "relay:machines" &&
        destinations.sectionActiveId?.startsWith("relay-project:")
            ? "workspace"
            : destinations.activeId;
    const listed = WEB_LIST_SECTIONS[activeId];
    const sections = listed
        ? (destinations.sections ?? []).filter((section) => section.id === listed.section)
        : [];
    return (
        <WebShell
            rail={destinations.items.map((item) => ({
                id: item.id,
                // The machines themselves, since projects anywhere are under 工作.
                label: item.id === "relay:machines" ? t("设备") : item.label,
                icon: item.icon ?? "home",
            }))}
            activeId={activeId}
            onSelect={destinations.onSelect}
            {...(destinations.account
                ? {
                      account: {
                          name: destinations.account.name,
                          initials: destinations.account.initials,
                          ...(destinations.account.imageUrl
                              ? { imageUrl: destinations.account.imageUrl }
                              : {}),
                          menu: accountMenuItems(destinations.account),
                          onMenuSelect: (action: string) => {
                              // Settings here are the profile: there is nothing else to set.
                              destinations.onAccountAction?.(
                                  action === "settings" ? "profile" : action,
                              );
                              if (action === "profile" || action === "settings")
                                  destinations.onSelect("account");
                          },
                      },
                  }
                : {})}
            appearance={appearance.appearance === "dark" ? "dark" : "light"}
            onAppearanceToggle={() => props.appearance.appearanceToggle()}
            {...(localePreferenceChangeable()
                ? { language: { value: localePreference(), onChange: localePreferenceChange } }
                : {})}
            {...(listed && sections.length > 0
                ? {
                      list: {
                          title: t(listed.title),
                          action: {
                              label: t(listed.action),
                              icon: listed.icon,
                              // A new chat is 聊天 with nothing open; a new project starts on 工作.
                              onClick: () =>
                                  destinations.onSelect(
                                      listed.section === "relay:chat" ? "chat" : "workspace",
                                  ),
                          },
                          sections,
                          activeItemId: destinations.sectionActiveId ?? "",
                          onItemSelect: (id: string) => destinations.onSectionItemSelect?.(id),
                          itemMenuItems: (item: SidebarItem) =>
                              destinations.sectionItemMenuItems?.(item.id) ?? [],
                          onItemMenuSelect: (item: SidebarItem, actionId: string) =>
                              destinations.onSectionItemMenuSelect?.(item.id, actionId),
                      },
                  }
                : {})}
            {...(destinations.panel ? { panel: destinations.panel } : {})}
            {...(props.assistant ? { assistant: props.assistant } : {})}
        >
            {props.children}
        </WebShell>
    );
}
