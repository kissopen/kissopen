/*
Remote control: the account's machines, and the work on them.

One destination beside the window's own. It opens onto every machine the
account has, this computer included, and picking one leads to that machine's
work. Nothing is pinned to the bottom of the sidebar any more — a list of other
computers under the list of this one's projects asked the reader to hold two
meanings of "a row here" at once.

A component because the relay moves while the window is open: a machine wakes,
a conversation starts on a phone.
*/
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { KissopenView, terminalDriverCreate } from "kissopen-desktop-app";
import {
    AssistantPanel,
    Button,
    Composer,
    EmptyState,
    MenuButton,
    ChannelHeader,
    TabbedPane,
    type AssistantPanelItem,
    type MenuItem,
    type TabItem,
} from "kissopen-desktop-ui";
import {
    conversationTabsStoreCreate,
    conversationStartStoreCreate,
    kissopenAgentPanelStoreCreate,
    kissopenCardAgentResolve,
    kissopenCardPrompt,
    kissopenProjectSetupCard,
    t,
    type AppearanceStore,
    type KissopenAgentBoardCard,
    type KissopenAgentBoardState,
    type KissopenAgentProjectDocument,
    type KissopenAgentWorkspaceStore,
    type KissopenAgentGroupId,
    type KissopenAgentSessionId,
    type KissopenAgentWindowStore,
    type Schedule,
    type TerminalColorScheme,
    type WelcomeStore,
} from "kissopen-desktop-state";
import { browserOpenClaim } from "./browserOpenRoute";
import { DesktopBrowserSession } from "./desktopBrowserSession";
import { relayTerminalOpen } from "./relayTerminalHost";

/*
Why a shell is refused when it is.

The panel takes a reason rather than a flag, so it can say which of the two
this is — nothing to run in, or nothing to run with. A shell now runs on a
machine across the room, so only the first is left: a project the reader is
looking at with no conversation open has no session for the shell to stand
in, and the machine resolves the folder from the session.
*/
const RELAY_TERMINAL_HOMELESS = t("先打开一个对话，终端要站在它的目录里。");
import type { KissopenAgentDocumentConversionOpener, KissopenStore } from "kissopen-desktop-state";
import type { BrowserContentRenderer } from "kissopen-desktop-ui";
import type { KissopenDesktopBridge } from "../shared/desktopContract";
import type { RelaySessionView, RelayState } from "../shared/relayContract";
import {
    LOCAL_KISSOPEN_AGENT_ID,
    type KissopenAgentDirectoryStore,
} from "./kissopenAgentDirectoryStore";
import type { LocalOnboardingStore } from "./localOnboardingStore";
import { relayMachineName, relaySessionName, relayStoreCreate } from "./relayStore";
import { RelayConversationView } from "./relayConversationView";
import { relayChoices, relayMessageMode } from "./relayChoices";
import { RELAY_LOOSE_PROJECT, RelayMachinesView } from "./relayMachinesView";
import { RelaySchedulesView } from "./relaySchedulesView";
import { relayLibraryStoreCreate, type RelayLibraryProject } from "./relayLibrary";
import { libraryImageType } from "./libraryThumbnail";
import {
    scheduleDraftSubscribe,
    scheduleDraftTake,
    scheduleFocusRequest,
    scheduleFocusSubscribe,
    scheduleFocusTake,
} from "./relayScheduleDraft";
import { RelayProjectPanel, type RelayPanelFileRequest } from "./relayProjectPanel";
import { RelayPluginsView } from "./relayPluginsView";
import {
    projectAnalysisRead,
    projectCardStart,
    projectChatStart,
    projectChatPrepare,
    CloudCallError,
    scheduleRunNow,
    schedulesRead,
    type CloudRequest,
    type ProjectAnalysis,
    type ProjectAnalysisPlace,
} from "./relayCloudApi";

/*
The destinations this view supplies, distinct from any tab the window owns.

Three, because they answer three different questions: where else can I work,
what is arranged to happen without me, and what can my assistant do. Folding
any two into one page would make the reader guess which they were looking at.
*/
const DESTINATION = "relay:machines";
const SCHEDULES = "relay:schedules";
const PLUGINS = "relay:plugins";

/*
Where the reader is inside remote control.

Two places, not three. A machine on its own was a list of that machine's
conversations, which is what the card already shows the shape of; what a reader
picks is a project, and what opens is that project's work.
*/
type Place =
    | { readonly at: "machines" }
    | { readonly at: "project"; readonly machineId: string; readonly projectId: string };

/*
Rows in 聊天 carry their session id, so a click can be routed back to the
conversation it stands for. Prefixed because the sidebar column is shared with
whatever else a tab puts there.
*/
/*
 * Whether this window has already chosen where to open.
 *
 * Module scope for the same reason the boot cover's latch is: an agent restart
 * discards the whole tree and builds it again, and a latch inside a component
 * would be reset by that, sending a reader who had since gone to 工作 back to
 * 聊天 in the middle of what they were doing.
 */
let landed = false;

const CHAT_ROW = "relay:chat:";
/** Where this computer remembers which cloud conversations are pinned. */
const PINNED_CHATS_KEY = "kissopen.relay.chat.pinned";
const CHAT_MENU_PIN = "pin";
const CHAT_MENU_COPY = "copy";
const CHAT_MENU_ARCHIVE = "archive";
const CHAT_MENU_DELETE = "delete";
const CHAT_MENU_CLEAR = "clear";

/*
 * Pinned cloud conversations, kept on this computer.
 *
 * The relay has no pin of its own, so this is the desktop's arrangement and
 * nobody else's: another computer or the phone lists them as it always did.
 * Storage that is unavailable or holds something unreadable pins nothing.
 */
function pinnedChatsRead(): ReadonlySet<string> {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(PINNED_CHATS_KEY) ?? "[]");
        return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
    } catch {
        return new Set();
    }
}

function pinnedChatsWrite(pinned: ReadonlySet<string>): void {
    try {
        localStorage.setItem(PINNED_CHATS_KEY, JSON.stringify([...pinned]));
    } catch {
        // Pinning is a convenience; a computer that cannot remember it keeps the order it had.
    }
}

/**
 * A conversation as plain text, for pasting elsewhere: what the reader said
 * and what the assistant answered, in order. Thinking, tools and events are
 * the assistant's working, not the conversation, and are left out.
 */
function conversationText(title: string, messages: readonly unknown[]): string {
    const lines = [`# ${title}`];
    for (const message of messages) {
        const typed = message as {
            readonly kind?: string;
            readonly text?: string;
            readonly displayText?: string;
            readonly isThinking?: boolean;
        };
        if (typed.kind === "user-text") {
            lines.push(t("**我**：{text}", { text: typed.displayText ?? typed.text ?? "" }));
        } else if (typed.kind === "agent-text" && !typed.isThinking && typed.text) {
            lines.push(t("**助手**：{text}", { text: typed.text }));
        }
    }
    return lines.join("\n\n") + "\n";
}
const chatRowId = (sessionId: string) => CHAT_ROW + sessionId;
const chatSessionOf = (id: string) => (id.startsWith(CHAT_ROW) ? id.slice(CHAT_ROW.length) : null);

export function RelayWorkspace(props: {
    readonly store: KissopenStore;
    readonly bridge: KissopenDesktopBridge;
    /*
     * Draws a browser tab inside the remote project's panel. The same
     * renderer the local workspace is given: Chromium is on this desk either
     * way, and a page opened beside a Mac project is no more that Mac's than
     * one opened beside a local one.
     */
    readonly browserContent?: BrowserContentRenderer;
    /** Shows a document no viewer here reads as the PDF the server converts it to. */
    readonly documentConversion?: KissopenAgentDocumentConversionOpener;
    /*
     * How the scheduled tasks and the workspace's plugins are reached: the
     * business API, through the same guarded transport the rest of this window
     * uses. They are not on the relay — the relay carries conversations — so
     * they do not travel with it.
     */
    readonly request: CloudRequest;
    /*
     * The appearance a shell started now should be seeded in. Read at the
     * moment one starts rather than held: the daemon settles the scheme when
     * it makes the PTY, and the theme the window drifts into afterwards is
     * none of that terminal's business.
     */
    readonly terminalColorScheme: () => TerminalColorScheme;
    /*
     * What decides whether the workspace below is a workspace yet.
     *
     * This computer's agent is optional: an account works from its cloud
     * workspace with nothing installed here. While there is no agent and
     * nobody has asked for one, the children are not a workspace but the
     * offer to set one up, and the window needs a shell of its own around
     * them — the sidebar that reaches 聊天 and the rest of the account is
     * otherwise drawn by the workspace, which is exactly what is missing.
     */
    readonly agents: KissopenAgentDirectoryStore;
    readonly onboarding: LocalOnboardingStore;
    readonly welcome: WelcomeStore;
    /* For that shell: the footer's appearance toggle and the window's chrome. */
    readonly appearance: AppearanceStore;
    readonly windowState: KissopenAgentWindowStore;
    readonly platform: "desktop" | "web";
    /** Shows one of this computer's projects in the workspace, on its board. */
    readonly onLocalProjectOpen?: (groupId: KissopenAgentGroupId) => void;
    /** Shows this computer's work home, with no project open. */
    readonly onWorkHomeOpen?: () => void;
    /**
     * The PC web client: this window is a browser page with no workspace of
     * its own. It lands on 首页, makes projects in the cloud workspace, and is
     * drawn in the web client's shell, with the assistant's column beside it.
     */
    readonly webClient?: {
        /** The account's scheduled tasks, kept current by the page, for the assistant's column. */
        readonly schedules: RelayScheduleFeed;
        /** Browser notifications, which the assistant's column offers to turn on. */
        readonly notifications?: RelayWebNotifications;
    };
    readonly children: ReactNode;
}) {
    const relay = useMemo(() => relayStoreCreate(props.bridge), [props.bridge]);
    /** The instant pages are drawn for, as the account store keeps it. */
    const now = useSyncExternalStore(
        props.store.subscribe,
        () => props.store.get().refreshedAt,
        () => 0,
    );
    const state = useSyncExternalStore(relay.subscribe, relay.getSnapshot, relay.getSnapshot);
    const agents = useSyncExternalStore(props.agents.subscribe, props.agents.get, props.agents.get);
    const setup = useSyncExternalStore(
        props.onboarding.subscribe,
        props.onboarding.get,
        props.onboarding.get,
    );
    const welcome = useSyncExternalStore(
        props.welcome.subscribe,
        props.welcome.get,
        props.welcome.get,
    );
    /*
     * The children stand for themselves in three cases: this computer's agent
     * is connected; setting it up has been chosen, so the children are setup's
     * own full-window screens; or the welcome has not been read, which is a
     * full-window deck too. Only the fourth — welcomed, nothing here, nothing
     * asked for — is the window working from the cloud alone.
     */
    const workspaceMounted =
        agents.kissopenAgents.some(
            (entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID && entry.status === "connected",
        ) ||
        setup.agentSetupActive ||
        !welcome.welcomeAcknowledged;
    /*
     * A window with no workspace opens on 聊天, once, when it can. The store
     * starts every window on 工作, which is right for a machine with an agent
     * and an offer to install one for a machine without — but the person who
     * has declined that offer came for their assistant. Once only: leaving 聊天
     * for the offer afterwards is a choice, and choices are not undone.
     */
    const cloud = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const newChat = useMemo(() => {
        const accountId = cloud.user?.id;
        const accountCheck = (): void => {
            if (!accountId || props.store.get().user?.id !== accountId)
                throw new Error(t("账号已切换，请重新打开聊天。"));
        };
        return conversationStartStoreCreate({
            invalidationSubscribe(listener) {
                return props.store.subscribe(() => {
                    if (props.store.get().user?.id !== accountId) listener();
                });
            },
            async prepare(name, startId, text) {
                accountCheck();
                const place = { target: "cloud" as const, path: CLOUD_HOME, name: t("聊天") };
                try {
                    const agentId = await projectChatPrepare(props.request, place, name, startId);
                    accountCheck();
                    return { agentId, messageSent: false };
                } catch (error) {
                    // Servers from before empty-conversation preparation still
                    // accept the original chat start. They send the first text
                    // themselves, so the relay must not send it a second time.
                    if (!(error instanceof CloudCallError) || error.status !== 400 || !text)
                        throw error;
                    const started = await projectChatStart(props.request, place, text);
                    accountCheck();
                    if (!started.agentId) throw error;
                    return { agentId: started.agentId, messageSent: true };
                }
            },
            async sessionWait(agentId, signal) {
                const session = await relaySessionWait(relay, agentId, 60_000, signal);
                accountCheck();
                if (!session)
                    throw new Error(t("会话仍在准备中，请稍后再发送；不会重复创建对话。"));
                return session.id;
            },
            async messageSend(sessionId, text, attachments) {
                accountCheck();
                const carried = await Promise.all(
                    attachments.map(async (attachment) => {
                        if (attachment.kind !== "workspaceFile")
                            throw new Error(t("无法发送这个附件。"));
                        return {
                            name: attachment.name,
                            mediaType: attachment.mediaType,
                            bytes: new Uint8Array(await attachment.file.arrayBuffer()),
                        };
                    }),
                );
                accountCheck();
                const session = relay
                    .getSnapshot()
                    ?.sessions.find((candidate) => candidate.id === sessionId);
                const choices = relayChoices(session?.metadata ?? null);
                const answer = await props.bridge.relaySay(
                    sessionId,
                    text,
                    relayMessageMode(choices, choices.model, choices.effort),
                    carried,
                );
                if (!answer.ok) throw new Error(answer.error);
            },
        });
    }, [cloud.user?.id, props.store, props.request, props.bridge, relay]);
    const newChatSnapshot = useSyncExternalStore(newChat.subscribe, newChat.get, newChat.get);
    const conversationTabs = useMemo(() => {
        const key = `kissopen.relay.closed-tabs:${cloud.user?.id ?? "signed-out"}`;
        return conversationTabsStoreCreate({
            read: () => JSON.parse(localStorage.getItem(key) ?? "[]"),
            write: (closed) => localStorage.setItem(key, JSON.stringify(closed)),
        });
    }, [cloud.user?.id]);
    const closedSessions = useSyncExternalStore(
        conversationTabs.subscribe,
        conversationTabs.get,
        conversationTabs.get,
    );
    useEffect(() => {
        if (landed || !cloud.ready || !cloud.user) return;
        // The web client decides once, when the account first loads: it opens on
        // 首页 unless the person is already somewhere else.
        if (props.webClient) {
            landed = true;
            if (cloud.tab === "workspace") props.store.tabSelect("home");
            return;
        }
        if (cloud.tab !== "workspace") return;
        landed = true;
        if (!workspaceMounted && cloud.config?.cloud_agent) props.store.tabSelect("chat");
    }, [cloud, workspaceMounted, props.store, props.webClient]);

    /** Null while the window is on one of its own destinations. */
    const [place, setPlace] = useState<Place | null>(null);
    const [openSession, setOpenSession] = useState<string | null>(null);
    const remoteSessionOpen = (sessionId: string | null): void => {
        if (sessionId !== null) conversationTabs.open(sessionId);
        setOpenSession(sessionId);
    };

    /** Which of this view's own destinations is open, if any. */
    const [surface, setSurface] = useState<"machines" | "schedules" | "plugins" | null>(null);

    /*
     * A task an assistant proposed in some conversation, to be set up in
     * 计划任务. Taken as it arrives, from either kind of conversation in this
     * window, and handed to 计划任务 as the first line of a new task; cleared
     * once that task is created or dropped, so returning to 计划任务 later
     * opens the list rather than the same draft again.
     */
    const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
    /*
     * A task the agent created in some conversation, to be shown in 计划任务.
     * Numbered, so choosing the same card again points at the task again
     * rather than finding it already pointed at. Dropped with the draft
     * whenever the reader moves on, so a later visit to 计划任务 opens on the
     * list as it is.
     */
    const [scheduleFocus, setScheduleFocus] = useState<{
        readonly id: string;
        readonly seq: number;
    } | null>(null);
    const scheduleFocusSeq = useRef(0);
    useEffect(() => {
        const draftTake = () => {
            const request = scheduleDraftTake();
            if (request === null) return;
            setScheduleDraft(request);
            setScheduleFocus(null);
            setSurface("schedules");
        };
        const focusTake = () => {
            const id = scheduleFocusTake();
            if (id === null) return;
            scheduleFocusSeq.current += 1;
            setScheduleDraft(null);
            setScheduleFocus({ id, seq: scheduleFocusSeq.current });
            setSurface("schedules");
        };
        draftTake();
        focusTake();
        const draftUnsubscribe = scheduleDraftSubscribe(draftTake);
        const focusUnsubscribe = scheduleFocusSubscribe(focusTake);
        return () => {
            draftUnsubscribe();
            focusUnsubscribe();
        };
    }, []);

    /*
     * Whether the panel is showing, and how wide it was left.
     *
     * Kept here rather than per conversation: a reader who opened it to watch
     * a diff wants it still open in the next conversation of the same
     * project. The width is remembered for the same reason the workspace
     * remembers its own — having dragged it once is having said something.
     */
    const [panelOpen, setPanelOpen] = useState(false);
    /*
     * A file a conversation linked, to show in the panel. Numbered, so the
     * same link clicked twice opens it again after the reader moved on.
     */
    const [panelFileRequest, setPanelFileRequest] = useState<
        (RelayPanelFileRequest & { readonly sessionId: string }) | undefined
    >(undefined);
    /** Asks the panel for All Files, from the board's 项目文件; each ask a new number. */
    const [panelFilesRequest, setPanelFilesRequest] = useState<number | undefined>(undefined);
    const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);

    const onWorkHomeOpen = props.onWorkHomeOpen;
    const claim = useCallback(
        (id: string) => {
            // Any choice in the sidebar is the reader moving on; a proposal they
            // walked away from is not reopened the next time they visit 计划任务,
            // and a task they were pointed at is not pointed at again.
            setScheduleDraft(null);
            setScheduleFocus(null);
            if (id === SCHEDULES || id === PLUGINS) {
                setSurface(id === SCHEDULES ? "schedules" : "plugins");
                // Remote control keeps its place: a reader who looks at what is
                // scheduled and comes back should find the machine they were on.
                return true;
            }
            if (id !== DESTINATION) {
                // Leaving for one of the window's own destinations.
                setSurface(null);
                setPlace(null);
                setOpenSession(null);
                // 工作 is its home, the page that starts or opens a project — not
                // whichever project happened to be open last — and 聊天 a new chat.
                if (id === "workspace") onWorkHomeOpen?.();
                if (id === "chat") {
                    newChat.conversationReset();
                    setOpenChat(null);
                }
                return false;
            }
            setSurface("machines");
            setPlace({ at: "machines" });
            setOpenSession(null);
            return true;
        },
        [onWorkHomeOpen, newChat],
    );

    // A conversation whose row has gone — its machine dropped off, or somebody
    // archived it elsewhere — is closed rather than left showing a transcript
    // of something the account no longer lists.
    useEffect(() => {
        if (openSession && state && !state.sessions.some((session) => session.id === openSession))
            setOpenSession(null);
    }, [state, openSession]);

    const counts = useMemo(() => {
        const byMachine = new Map<string, number>();
        for (const session of state?.sessions ?? []) {
            if (!session.machineId) continue;
            byMachine.set(session.machineId, (byMachine.get(session.machineId) ?? 0) + 1);
        }
        return byMachine;
    }, [state]);

    /*
     * Conversations on a machine that belong to no project.
     *
     * Counted separately so a card can offer them without pretending they are
     * a project. Older sessions, and anything started outside a directory, have
     * always been in this state.
     */
    const loose = useMemo(() => {
        const byMachine = new Map<string, number>();
        for (const session of state?.sessions ?? []) {
            if (!session.machineId || session.projectId) continue;
            byMachine.set(session.machineId, (byMachine.get(session.machineId) ?? 0) + 1);
        }
        return byMachine;
    }, [state]);

    /*
     * 聊天: the account's cloud assistant.
     *
     * The same thing the phone means by chat — the conversations that live on
     * the cloud workspace — reached the same way everything else here is. It is
     * kept apart from remote control's own place, because a reader switching to
     * 聊天 and back should find remote control where they left it.
     */
    const [selectedChat, setOpenChat] = useState<string | null>(null);
    const openChat = selectedChat ?? newChatSnapshot.sessionId ?? null;

    /*
     * Which conversations the relay says are working.
     *
     * Ephemeral by nature — true only while it is being said — so it is
     * followed rather than fetched, and lives beside the snapshot instead of
     * inside it.
     */
    const [running, setRunning] = useState<ReadonlySet<string>>(new Set());
    useEffect(
        () =>
            props.bridge.relayActivitySubscribe((sessionId, working) => {
                setRunning((current) => {
                    if (current.has(sessionId) === working) return current;
                    const next = new Set(current);
                    if (working) next.add(sessionId);
                    else next.delete(sessionId);
                    return next;
                });
            }),
        [props.bridge],
    );
    /*
     * What the main process knows is working, whenever it publishes: a window
     * opened or reloaded mid-run heard no change and showed the run as over.
     * An older main process does not say, and the events alone stand.
     */
    const thinking = state?.thinking;
    useEffect(() => {
        if (thinking !== undefined) setRunning(new Set(thinking));
    }, [thinking]);
    const offline = state?.connected === false;
    const cloudMachine = state?.machines.find((machine) => machine.kind === "cloud");
    // This computer as the relay knows it: of its registrations, the live or
    // most recently live one, as the run executor chooses.
    const localMachineId = (state?.machines ?? [])
        .filter((machine) => machine.kind === "this")
        .sort(
            (left, right) =>
                Number(right.active) - Number(left.active) || right.activeAt - left.activeAt,
        )[0]?.id;
    const [pinnedChats, setPinnedChats] = useState<ReadonlySet<string>>(pinnedChatsRead);
    /** An assistant whose cleared conversation is open, until its fresh one appears. */
    const [reopenBot, setReopenBot] = useState<string | null>(null);
    /*
     * The cloud assistant's conversations, pinned first and otherwise as the
     * relay orders them. An archived one has left the list: its agent marked
     * it so when it was archived here or on the phone.
     */
    const chatSessions = useMemo(() => {
        if (!cloudMachine) return [];
        const listed = (state?.sessions ?? []).filter(
            (session) =>
                session.machineId === cloudMachine.id &&
                session.metadata?.lifecycleState !== "archived",
        );
        return [
            ...listed.filter((session) => pinnedChats.has(session.id)),
            ...listed.filter((session) => !pinnedChats.has(session.id)),
        ];
    }, [state, cloudMachine, pinnedChats]);

    /*
     * The person's real projects, for the home page: every project on any of
     * their own machines that has a conversation, newest first. The cloud
     * assistant's workspace is not one of them — its conversations are the
     * chats listed under 聊天.
     */
    const remoteProjects = useMemo(
        () =>
            (state?.projects ?? [])
                .filter(
                    (project) =>
                        project.name !== null &&
                        project.machineId !== undefined &&
                        project.machineId !== localMachineId,
                )
                .map((project) => {
                    const machine = state?.machines.find((entry) => entry.id === project.machineId);
                    const root = (state?.sessions ?? [])
                        .filter(
                            (session) =>
                                session.projectId === project.id &&
                                session.machineId === project.machineId &&
                                session.metadata?.lifecycleState !== "archived" &&
                                typeof session.metadata?.path === "string",
                        )
                        .sort(
                            (left, right) =>
                                (left.metadata?.path?.length ?? 0) -
                                (right.metadata?.path?.length ?? 0),
                        )[0];
                    const cloud = project.machineId === cloudMachine?.id;
                    return {
                        id: `${project.machineId}:${project.id}`,
                        machineId: project.machineId!,
                        projectId: project.id,
                        name: project.name ?? "",
                        place: cloud ? t("云端") : machine ? relayMachineName(machine) : "",
                        updatedAt: project.updatedAt,
                        cloud,
                        path: root?.metadata?.path ?? "",
                        ...(root ? { sessionId: root.id } : {}),
                    };
                })
                // In the cloud workspace only its managed projects folder holds projects:
                // its home folder is where chats run, and bots keep folders of their own.
                .filter(
                    (project) =>
                        !project.cloud || project.path.startsWith(`${CLOUD_PROJECTS_ROOT}/`),
                ),
        [state, cloudMachine, localMachineId],
    );
    const remoteProjectsNow = useRef(remoteProjects);
    useEffect(() => {
        remoteProjectsNow.current = remoteProjects;
    }, [remoteProjects]);
    /*
     * The files in every project, for 资料库: this computer's through its
     * agent, the cloud's and other computers' through the conversation their
     * board is read through. Remembered per account, so a machine that is
     * asleep still shows what it had.
     */
    const library = useMemo(() => {
        const key = `kissopen.library:${cloud.user?.id ?? "signed-out"}`;
        return relayLibraryStoreCreate({
            read: () => JSON.parse(localStorage.getItem(key) ?? "{}"),
            write: (files) => localStorage.setItem(key, JSON.stringify(files)),
        });
    }, [cloud.user?.id]);
    const libraryFiles = useSyncExternalStore(library.subscribe, library.get, library.get);
    const libraryWatch = useCallback(
        (): (() => void) =>
            library.watch(() => {
                const agent = props.agents
                    .get()
                    .kissopenAgents.find((entry) => entry.id === LOCAL_KISSOPEN_AGENT_ID);
                const workspace = agent?.session?.workspace;
                const local: RelayLibraryProject[] = workspace
                    ? (agent?.projects ?? [])
                          .filter((project) => project.kind === "regular")
                          .map((project) => ({
                              key: `local:${project.id}`,
                              name: project.name,
                              picture: async (path) => {
                                  const type = libraryImageType(path);
                                  return type
                                      ? workspace.pictureRead(project.id, path, type)
                                      : undefined;
                              },
                              list: async (path) =>
                                  (await workspace.projectFolderRead(project.id, path)).map(
                                      (entry) => ({
                                          name: entry.name,
                                          kind: entry.kind,
                                          ...(entry.size === undefined ? {} : { size: entry.size }),
                                          ...(entry.modified === undefined
                                              ? {}
                                              : { modified: entry.modified }),
                                      }),
                                  ),
                              open: (path) =>
                                  void workspace
                                      .fileOpenDefault(project.id, path)
                                      .catch(() => undefined),
                          }))
                    : [];
                const remote = remoteProjectsNow.current.flatMap(
                    (project): RelayLibraryProject[] => {
                        const sessionId = project.sessionId;
                        if (sessionId === undefined || project.path === "") return [];
                        return [
                            {
                                key: project.id,
                                name: t("{place} - {project}", {
                                    place: project.place,
                                    project: project.name,
                                }),
                                list: async (path) => {
                                    const answer = await props.bridge
                                        .relayDirectoryList(sessionId, `${project.path}/${path}`)
                                        .catch(() => undefined);
                                    return answer?.ok ? answer.entries : undefined;
                                },
                                picture: async (path) => {
                                    const type = libraryImageType(path);
                                    if (!type) return undefined;
                                    const answer = await props.bridge.relayFileRead(
                                        sessionId,
                                        `${project.path}/${path}`,
                                    );
                                    return answer.ok
                                        ? `data:${type};base64,${answer.base64}`
                                        : undefined;
                                },
                                open: (path) =>
                                    void props.bridge
                                        .relayFileOpen(sessionId, `${project.path}/${path}`)
                                        .catch(() => undefined),
                            },
                        ];
                    },
                );
                return [...local, ...remote];
            }),
        [library, props.agents, props.bridge],
    );
    // Read project files only while the library is visible.
    const shownTab = useSyncExternalStore(
        props.store.subscribe,
        () => props.store.get().tab,
        () => undefined,
    );
    useEffect(
        () => (shownTab === "files" ? libraryWatch() : undefined),
        [shownTab, libraryWatch],
    );
    const remotePlaceOpen = (machineId: string, projectId: string): void => {
        setScheduleDraft(null);
        setScheduleFocus(null);
        setSurface("machines");
        setPlace({ at: "project", machineId, projectId });
        setOpenSession(null);
    };
    const remoteProjectOpen = (id: string): void => {
        const project = state?.projects.find((candidate) => candidate.id === id);
        if (project?.machineId) remotePlaceOpen(project.machineId, project.id);
    };

    /*
     * A board card of a project on another computer or in the cloud opens its
     * own conversation there. One that is already listed is opened; otherwise
     * the server is asked to start it where the project is, and the window
     * follows it there once the relay lists it.
     */
    const [cardNotice, setCardNotice] = useState<string | null>(null);
    const cardNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const cardNoticeShow = (text: string | null, forMs?: number): void => {
        if (cardNoticeTimer.current !== undefined) clearTimeout(cardNoticeTimer.current);
        cardNoticeTimer.current = undefined;
        setCardNotice(text);
        if (text !== null && forMs !== undefined)
            cardNoticeTimer.current = setTimeout(() => setCardNotice(null), forMs);
    };
    /*
     * A new conversation in the open project on another computer or in the
     * cloud. The window cannot make one there itself, so the server starts it
     * on that machine with the first message, and the window opens it the
     * moment it shows up in the relay.
     */
    const remoteChatStart = async (text: string): Promise<boolean> => {
        const where = placeAnalysis;
        if (!where) {
            window.alert(t("这个项目里还没有对话，没法在这里开始新对话。"));
            return false;
        }
        cardNoticeShow(t("正在开始…"));
        try {
            const started = await projectChatStart(props.request, where, text);
            if (started.runStatus === "waiting_device") {
                cardNoticeShow(t("那台电脑不在线，开机后会开始"), 6000);
                return true;
            }
            const session = await relaySessionWait(relay, started.agentId, 60_000);
            if (session) {
                cardNoticeShow(null);
                remoteSessionOpen(session.id);
            } else cardNoticeShow(t("新对话还没出现，稍后会出现在这里。"), 6000);
            return true;
        } catch (error) {
            cardNoticeShow(null);
            window.alert(error instanceof Error ? error.message : t("没能开始新对话。"));
            return false;
        }
    };

    /* Closing a page is local; archiving remains an explicit chat-menu action. */
    const remoteSessionClose = (sessionId: string): void => {
        conversationTabs.close(sessionId);
        if (openSession === sessionId) setOpenSession(null);
    };

    /*
     * The home page's question goes to the cloud assistant, in its own
     * conversation, and the window follows it there: asking is starting a
     * conversation, and the answer is read where conversations are.
     */
    const homeAsk = (text: string): void => {
        const assistant =
            chatSessions.find((session) => session.metadata?.bot?.id === "bcloud01") ??
            chatSessions[0];
        if (!assistant) {
            window.alert(t("云端助手还没准备好，稍后再试。"));
            return;
        }
        void props.bridge.relaySay(assistant.id, text).then((result) => {
            if (!result.ok) {
                window.alert(result.error ?? t("没能发出这个问题。"));
                return;
            }
            setSurface(null);
            setScheduleDraft(null);
            setScheduleFocus(null);
            setPlace(null);
            setOpenSession(null);
            setOpenChat(assistant.id);
            props.store.tabSelect("chat");
        });
    };

    const chatSections = useMemo(
        () => [
            /*
             * The account's projects that are not on this computer — in the
             * cloud, or on its other computers — beside this computer's own
             * 项目 above. A project made on the phone lives in the cloud and is
             * opened from here on its board, the same as one made here.
             */
            {
                id: "relay:projects",
                label: t("云端与其他电脑的项目"),
                items: remoteProjects.map((project) => ({
                    id: RELAY_PROJECT_ROW + project.id,
                    label: project.name,
                    kind: "project" as const,
                    avatarId: project.projectId,
                    meta: project.place,
                })),
                empty: {
                    icon: "agents" as const,
                    description: t("在手机上创建的项目，和其他电脑上的项目，会出现在这里。"),
                },
            },
            {
                id: "relay:chat",
                label: t("最近的对话"),
                items: chatSessions.map((session) => ({
                    id: chatRowId(session.id),
                    label: relaySessionName(session) ?? t("未命名对话"),
                    kind: "channel" as const,
                    icon: pinnedChats.has(session.id) ? ("star" as const) : ("chat" as const),
                    action: {
                        icon: "more" as const,
                        label: t("更多操作"),
                        reveal: "hover" as const,
                        opensMenu: true,
                    },
                })),
                empty: {
                    icon: "chat" as const,
                    description: cloudMachine
                        ? t("你和云端助手的对话会保存在这里。")
                        : t("正在为这个账号准备云端助手，稍等片刻就会出现在这里。"),
                },
            },
        ],
        [chatSessions, cloudMachine, pinnedChats, remoteProjects],
    );

    /*
     * A conversation's menu: what the relay and this computer can actually do
     * with it. Pinning is this computer's own; copying reads the transcript;
     * archiving and deleting go through the conversation's agent, the same way
     * the phone does it. Sharing a link, moving to a project and renaming are
     * not offered: the relay has nothing that would make them stick.
     */
    const chatMenuItems = (id: string): MenuItem[] => {
        const sessionId = chatSessionOf(id);
        const session = chatSessions.find((candidate) => candidate.id === sessionId);
        if (!session) return [];
        const bot = session.metadata?.bot !== undefined && session.metadata?.bot !== null;
        // An agent says which requests it understands; one too old to clear is
        // shown the entry, disabled, so the reader knows why it is missing.
        const clearable = (
            (session.metadata as { capabilities?: { rpcMethods?: unknown } } | null)?.capabilities
                ?.rpcMethods as readonly string[] | undefined
        )?.includes("clearConversation");
        return [
            {
                kind: "item",
                id: CHAT_MENU_PIN,
                label: pinnedChats.has(session.id) ? t("取消置顶") : t("置顶"),
                icon: "star",
            },
            { kind: "item", id: CHAT_MENU_COPY, label: t("复制对话内容"), icon: "copy" },
            ...(bot
                ? ([
                      { kind: "separator" },
                      {
                          kind: "item",
                          id: CHAT_MENU_CLEAR,
                          label: clearable ? t("清空对话") : t("清空对话（云端助手更新后可用）"),
                          icon: "trash",
                          danger: true,
                          ...(clearable ? {} : { disabled: true }),
                      },
                  ] satisfies MenuItem[])
                : ([
                      { kind: "separator" },
                      { kind: "item", id: CHAT_MENU_ARCHIVE, label: t("归档"), icon: "archive" },
                      {
                          kind: "item",
                          id: CHAT_MENU_DELETE,
                          label: t("删除"),
                          icon: "trash",
                          danger: true,
                      },
                  ] satisfies MenuItem[])),
        ];
    };

    const chatMenuSelect = (id: string, actionId: string): void => {
        const sessionId = chatSessionOf(id);
        const session = chatSessions.find((candidate) => candidate.id === sessionId);
        if (!sessionId || !session) return;
        const name = relaySessionName(session) ?? t("未命名对话");
        // Leaving an open conversation that is going away, for the next one down.
        const leave = () => {
            if (openChat === sessionId) {
                if (newChat.get().sessionId === sessionId) newChat.conversationReset();
                setOpenChat(null);
            }
        };
        if (actionId === CHAT_MENU_PIN) {
            setPinnedChats((current) => {
                const next = new Set(current);
                if (next.has(sessionId)) next.delete(sessionId);
                else next.add(sessionId);
                pinnedChatsWrite(next);
                return next;
            });
            return;
        }
        if (actionId === CHAT_MENU_COPY) {
            void props.bridge
                .relayConversation(sessionId)
                .then(async (conversation) => {
                    if (!conversation.ok) throw new Error(conversation.error);
                    await navigator.clipboard.writeText(
                        conversationText(name, conversation.messages),
                    );
                })
                .catch(() => window.alert(t("没能复制这段对话，稍后再试。")));
            return;
        }
        if (actionId === CHAT_MENU_ARCHIVE) {
            void props.bridge
                .relayArchive(sessionId)
                .then((result) => {
                    if (!result.ok) throw new Error(result.error ?? t("没能归档这段对话。"));
                    leave();
                })
                .catch((error: unknown) => {
                    window.alert(error instanceof Error ? error.message : t("没能归档这段对话。"));
                });
            return;
        }
        if (actionId === CHAT_MENU_CLEAR) {
            if (
                !window.confirm(
                    t(
                        "清空「{name}」的全部对话？助手会保留，但聊过的内容会被永久删除，不能恢复。",
                        { name },
                    ),
                )
            )
                return;
            const botId = session.metadata?.bot?.id;
            void props.bridge.relayClear(sessionId).then((result) => {
                if (!result.ok) {
                    window.alert(result.error ?? t("没能清空这段对话。"));
                    return;
                }
                // The assistant comes back as a new, empty conversation; open that one.
                if (openChat === sessionId && botId !== undefined) setReopenBot(botId);
            });
            return;
        }
        if (actionId === CHAT_MENU_DELETE) {
            if (
                !window.confirm(
                    t("删除「{name}」？对话内容和其中的文件会被永久删除，不能恢复。", { name }),
                )
            )
                return;
            void props.bridge.relayDelete(sessionId).then((result) => {
                if (result.ok) leave();
                else window.alert(result.error ?? t("没能删除这段对话。"));
            });
        }
    };

    // An archived assistant comes back as a new, empty conversation; that one is opened.
    useEffect(() => {
        if (reopenBot === null) return;
        const fresh = chatSessions.find(
            (session) => session.metadata?.bot?.id === reopenBot && session.id !== openChat,
        );
        if (!fresh) return;
        setReopenBot(null);
        setOpenChat(fresh.id);
    }, [reopenBot, chatSessions, openChat]);

    /*
     * 聊天 opens on a new conversation.
     *
     * Choosing 聊天 is starting to say something, so the page is a new chat
     * drawn by the ordinary conversation surface, including its draft and
     * attachments. Preparing a remote identity must not replace the surface.
     * The first send prepares that identity, then uses the normal relay send.
     */
    /*
     * The open chat can be missing from the list: just created and not yet
     * listed, or gone — deleted, or the account signed out — while it was
     * still the one open.
     */
    const openChatSession = chatSessions.find((session) => session.id === openChat);
    const chatContent =
        openChat || cloudMachine ? (
            <RelayConversationView
                bridge={props.bridge}
                sessionId={openChat ?? undefined}
                start={selectedChat === null ? newChat : undefined}
                title={(openChatSession && relaySessionName(openChatSession)) ?? t("新对话")}
                machineName={t("云端")}
                cloud
                running={openChat !== null && running.has(openChat)}
                offline={offline}
                metadata={openChatSession?.metadata ?? null}
                onFileOpen={(path) => {
                    if (!openChat) return;
                    setPanelOpen(true);
                    setPanelFileRequest((current) => ({
                        path,
                        sessionId: openChat,
                        seq: (current?.seq ?? 0) + 1,
                    }));
                }}
            />
        ) : (
            // No cloud workspace yet: it is being made, and nothing needs doing here.
            <EmptyState
                icon="chat"
                title={t("正在准备你的云端助手")}
                description={t(
                    "登录时已开始开通，容器起来后它会自己出现在这里，不需要去别处操作。",
                )}
            />
        );

    /*
    The conversations of the place the reader is in, and the one on screen.

    Worked out here rather than inside the surface, because the panel beside
    that surface has to be about the same conversation. Two places deciding
    "which one is open" would eventually disagree, and the disagreement would
    read as a panel showing another conversation's files.
    */
    /*
     * An archived conversation has left the project, as it has left the chats:
     * among them the cloud's board builds, archived once the board is written.
     * Its agent no longer answers for it, so it cannot be read through either.
     */
    const placeSessions = useMemo(() => {
        if (place?.at !== "project") return [];
        return (state?.sessions ?? []).filter(
            (session) =>
                session.metadata?.lifecycleState !== "archived" &&
                session.machineId === place.machineId &&
                (place.projectId === RELAY_LOOSE_PROJECT
                    ? session.projectId === undefined
                    : session.projectId === place.projectId),
        );
    }, [state, place]);
    // The project's archived conversations, for its history: read, not continued.
    const placeArchived = useMemo(() => {
        if (place?.at !== "project") return [];
        return (state?.sessions ?? [])
            .filter(
                (session) =>
                    session.metadata?.lifecycleState === "archived" &&
                    session.machineId === place.machineId &&
                    (place.projectId === RELAY_LOOSE_PROJECT
                        ? session.projectId === undefined
                        : session.projectId === place.projectId),
            )
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [state, place]);

    // Open the latest visible conversation for both projects and loose chats.
    const activeSession =
        openSession &&
        !closedSessions.has(openSession) &&
        [...placeSessions, ...placeArchived].some((session) => session.id === openSession)
            ? openSession
            : (placeSessions.find((session) => !closedSessions.has(session.id))?.id ?? null);
    // A project's root conversation supplies its file browser when no chat is open.
    const placeRoot = place?.at === "project" ? projectRootSession(placeSessions) : undefined;
    const projectPanelSession = placeSessions.some((session) => session.id === activeSession)
        ? activeSession
        : (placeRoot?.id ?? null);
    const panelSession = place?.at === "project" ? projectPanelSession : openChat;
    const panelGroup =
        place?.at === "project" ? place.projectId : openChat ? `relay-chat:${openChat}` : undefined;
    const panelTerminalSession = place?.at === "project" ? activeSession : openChat;
    const browserConversationVisible =
        place?.at === "project"
            ? surface !== "schedules" && surface !== "plugins"
            : !surface && shownTab === "chat";
    const panelSessionView = (state?.sessions ?? []).find((session) => session.id === panelSession);
    const placeAnalysis = analysisPlaceOf(place ?? undefined, placeRoot, cloudMachine?.id, state);
    /*
    What the remote project's panel is holding.

    Lives here rather than inside the panel, because it outlives the panel
    being hidden: shutting the column must not close the pages in it, and a
    link followed while it is shut still has to land somewhere.

    It is the local panel's own store. Nothing in it is daemon-shaped — the
    one thing it asks a host for is how to start a terminal, and that is
    answerable about another machine: the shell runs there, the screen is
    here, and the bytes between them ride the relay.
    */
    /*
     * Held rather than depended on: the owner passes a fresh closure every
     * render, and a store rebuilt on a render is every open tab thrown away.
     * What the scheme is worth reading at is the moment a shell starts.
     */
    const colorScheme = useRef(props.terminalColorScheme);
    colorScheme.current = props.terminalColorScheme;
    const panelStore = useMemo(
        () =>
            kissopenAgentPanelStoreCreate({
                terminalOpen: (sessionId) =>
                    relayTerminalOpen({
                        bridge: props.bridge,
                        sessionId,
                        colorScheme: colorScheme.current(),
                        driverCreate: terminalDriverCreate,
                    }),
            }),
        // The bridge is the window's, fixed for its lifetime.
        [props.bridge],
    );
    useEffect(() => () => panelStore[Symbol.dispose](), [panelStore]);

    /*
     * The panel's tabs belong to a project and its terminals to a session, so
     * it is told which: a page opened in one project stays that project's as
     * the reader moves between its conversations.
     */
    useEffect(() => {
        if (!panelGroup) return;
        /*
         * A project with nothing open in it has no session, and a shell with
         * no session has no folder to stand in — the machine resolves the
         * folder from the session. The panel says so rather than offering a
         * button that cannot work.
         */
        panelStore.scopeApply(
            panelGroup as KissopenAgentGroupId,
            (panelTerminalSession ?? undefined) as KissopenAgentSessionId | undefined,
            panelTerminalSession ? undefined : RELAY_TERMINAL_HOMELESS,
        );
    }, [panelStore, panelGroup, panelTerminalSession]);

    /*
     * Links followed out of a remote conversation land in that project's
     * panel, not in the local workspace's.
     *
     * Claimed while the reader is in a remote project — whether or not the
     * column is showing, because taking a page opens it, the same as the
     * local panel does. Without this the window's one route always chose the
     * workspace's panel, and a page opened from a Mac project appeared behind
     * 工作: a column the reader was not looking at, about another project.
     */
    useEffect(() => {
        if (!browserConversationVisible || !panelTerminalSession) return undefined;
        return browserOpenClaim((url) => {
            const placed = panelStore.browserAdd(url);
            // Taking a page is showing it. A tab in a shut column is a tab
            // nobody can see, which is the same as no tab.
            if (placed) setPanelOpen(true);
            return placed;
        });
    }, [panelStore, browserConversationVisible, panelTerminalSession]);

    const content =
        surface === "schedules" ? (
            <RelaySchedulesView
                // A proposal starts its own conversation, not the last one
                // continued; a task pointed at is found afresh each time.
                key={
                    scheduleDraft ??
                    (scheduleFocus === null ? "schedules" : `focus:${scheduleFocus.seq}`)
                }
                request={props.request}
                machines={state?.machines ?? []}
                projects={state?.projects ?? []}
                sessions={state?.sessions ?? []}
                {...(scheduleDraft === null
                    ? {}
                    : { draft: scheduleDraft, onDraftSettled: () => setScheduleDraft(null) })}
                {...(scheduleFocus === null ? {} : { focus: scheduleFocus.id })}
            />
        ) : surface === "plugins" ? (
            <RelayPluginsView
                request={props.request}
                openLink={(url) => props.bridge.linkOpen(url)}
            />
        ) : place ? (
            <RemoteControl
                state={state}
                counts={counts}
                loose={loose}
                place={place}
                sessions={placeSessions}
                closedSessions={closedSessions}
                archived={placeArchived}
                activeSession={activeSession}
                running={running}
                offline={offline}
                panelOpen={panelOpen}
                bridge={props.bridge}
                request={props.request}
                now={now}
                cloudMachineId={cloudMachine?.id}
                onPlace={setPlace}
                onOpenSession={remoteSessionOpen}
                onPanelOpen={() => setPanelOpen(true)}
                onFileOpen={(path) => {
                    if (!panelSession) return;
                    setPanelOpen(true);
                    setPanelFileRequest((current) => ({
                        path,
                        sessionId: panelSession,
                        seq: (current?.seq ?? 0) + 1,
                    }));
                }}
                onFilesOpen={() => {
                    setPanelOpen(true);
                    setPanelFilesRequest((current) => (current ?? 0) + 1);
                }}
                {...(placeAnalysis ? { analysisPlace: placeAnalysis } : {})}
                onChatStart={remoteChatStart}
                onSessionClose={remoteSessionClose}
            />
        ) : undefined;

    /*
     * The panel, in the window's own column.
     *
     * Only beside a conversation: it is that conversation's machine whose
     * files it reads, and a column left standing over the list of machines
     * would be about nothing.
     */
    const panel =
        panelOpen && panelGroup && panelSession ? (
            <RelayProjectPanel
                bridge={props.bridge}
                sessionId={panelSession}
                projectId={panelGroup}
                store={panelStore}
                {...(props.browserContent ? { browserContent: props.browserContent } : {})}
                {...(props.documentConversion
                    ? { documentConversion: props.documentConversion }
                    : {})}
                {...(panelFileRequest?.sessionId === panelSession
                    ? { fileRequest: panelFileRequest }
                    : {})}
                {...(panelFilesRequest === undefined ? {} : { filesRequest: panelFilesRequest })}
                canUpload={sessionTakesUploads(panelSessionView)}
                onClose={() => setPanelOpen(false)}
            />
        ) : undefined;

    /*
     * A project made in the cloud workspace — the web client's only kind, since
     * a browser has no folders of its own. The cloud makes the folder and starts
     * its first conversation with what the person wants done; the window opens
     * the project the moment the relay lists that conversation.
     */
    const cloudProjectCreate = async (name: string, goal: string): Promise<void> => {
        const response = await props.request("/cloud/projects", "POST", { name, goal });
        let body: { agent_id?: string; error?: string } = {};
        try {
            body = JSON.parse(response.text) as typeof body;
        } catch {
            // Said below in plain words.
        }
        if (response.status !== 201) throw new Error(body.error || t("项目没有创建成功"));
        cardNoticeShow(t("正在打开新项目…"));
        const session = body.agent_id
            ? await relaySessionWait(relay, body.agent_id, 60_000)
            : undefined;
        if (session?.machineId && session.projectId) {
            cardNoticeShow(null);
            remotePlaceOpen(session.machineId, session.projectId);
        } else cardNoticeShow(t("新项目还没出现，稍后会出现在项目列表里。"), 6000);
    };
    const cloudProjectStart = async (goal: string): Promise<void> => {
        const text = goal.trim();
        if (!text) return;
        const name = [...text.replace(/\s+/gu, " ")].slice(0, 24).join("");
        cardNoticeShow(t("正在创建项目…"));
        try {
            await cloudProjectCreate(
                name,
                t("我想开始一个项目：{goal}。请帮我理清目标、需要的资料和下一步。", { goal: text }),
            );
        } catch (error) {
            cardNoticeShow(null);
            window.alert(error instanceof Error ? error.message : t("项目没有创建成功"));
        }
    };

    /*
     * The assistant's column in the web client: today's conversations and
     * finished tasks, what waits on the person, what runs now, and the files
     * lately made or handed over. Every row opens what it is about.
     */
    const schedules = useSyncExternalStore(
        props.webClient?.schedules.subscribe ?? noSubscription,
        props.webClient?.schedules.get ?? noSchedules,
        props.webClient?.schedules.get ?? noSchedules,
    );
    const notifications = props.webClient?.notifications;
    const notificationState = useSyncExternalStore(
        notifications?.subscribe ?? noSubscription,
        notifications?.get ?? notificationsUnavailable,
        notifications?.get ?? notificationsUnavailable,
    );
    const panelSessionOpen = (session: RelaySessionView): void => {
        if (session.machineId && session.projectId && session.machineId !== cloudMachine?.id) {
            remotePlaceOpen(session.machineId, session.projectId);
            remoteSessionOpen(session.id);
            return;
        }
        setSurface(null);
        setScheduleDraft(null);
        setScheduleFocus(null);
        setPlace(null);
        setOpenSession(null);
        setOpenChat(session.id);
        props.store.tabSelect("chat");
    };
    const projectNameOf = (session: RelaySessionView): string | undefined =>
        state?.projects.find((project) => project.id === session.projectId)?.name ?? undefined;
    const assistant = props.webClient ? (
        <AssistantPanel
            name={t("小秘书")}
            {...(notifications
                ? { notifications: { state: notificationState, onEnable: notifications.enable } }
                : {})}
            connected={!offline && state !== null}
            activity={[
                ...(state?.sessions ?? [])
                    .filter(
                        (session) =>
                            session.updatedAt >= dayStart(now) &&
                            session.metadata?.lifecycleState !== "archived",
                    )
                    .map((session): AssistantPanelItem & { at: number } => ({
                        id: `session:${session.id}`,
                        at: session.updatedAt,
                        icon: "chat",
                        title: relaySessionName(session) ?? t("未命名对话"),
                        ...(projectNameOf(session) ? { detail: projectNameOf(session)! } : {}),
                        when: whenOf(session.updatedAt, now),
                        onOpen: () => panelSessionOpen(session),
                    })),
                ...schedules
                    .filter((schedule) => (schedule.last_run?.ended_at ?? 0) >= dayStart(now))
                    .map((schedule): AssistantPanelItem & { at: number } => ({
                        id: `schedule:${schedule.id}`,
                        at: schedule.last_run!.ended_at,
                        icon: "clock",
                        title: schedule.name,
                        detail:
                            schedule.last_run!.status === "succeeded"
                                ? t("计划任务已完成")
                                : t("计划任务没有完成"),
                        when: whenOf(schedule.last_run!.ended_at, now),
                        onOpen: () => scheduleFocusRequest(schedule.id),
                    })),
            ]
                .sort((a, b) => b.at - a.at)
                .slice(0, 40)}
            todo={[]}
            running={(state?.sessions ?? [])
                .filter((session) => running.has(session.id))
                .map(
                    (session): AssistantPanelItem => ({
                        id: `running:${session.id}`,
                        icon: "chat",
                        tone: "working",
                        title: relaySessionName(session) ?? t("未命名对话"),
                        detail: projectNameOf(session) ?? t("正在工作"),
                        onOpen: () => panelSessionOpen(session),
                    }),
                )}
            files={[...libraryFiles]
                .sort((a, b) => b.created - a.created)
                .slice(0, 30)
                .map(
                    (file): AssistantPanelItem => ({
                        id: `file:${file.id}`,
                        icon: file.kind === "image" ? "image" : "doc",
                        title: file.name,
                        ...(file.project ? { detail: file.project.name } : {}),
                        ...(file.created ? { when: whenOf(file.created, now) } : {}),
                        onOpen: () => library.open(file.id),
                    }),
                )}
        />
    ) : undefined;

    /** Which row the sidebar marks, which is whichever of these is open. */
    const activeId =
        surface === "schedules" ? SCHEDULES : surface === "plugins" ? PLUGINS : DESTINATION;

    return (
        <>
            {cardNotice !== null && (
                <div className="kissopen-card-notice" role="status">
                    {cardNotice}
                </div>
            )}
            {panelTerminalSession && panelGroup && browserConversationVisible ? (
                <DesktopBrowserSession
                    scope={{
                        kind: "relay",
                        sessionId: panelTerminalSession,
                        workspaceId: panelGroup,
                    }}
                    onOpen={(url, tabId) => {
                        if (panelStore.browserAdd(url, tabId)) setPanelOpen(true);
                    }}
                />
            ) : null}
            <KissopenView
                store={props.store}
                workspaceMounted={workspaceMounted}
                {...(props.webClient
                    ? { webClient: { onProjectStart: cloudProjectStart, assistant } }
                    : {})}
                projectFiles={{
                    items: libraryFiles,
                    open: library.open,
                    previewRequest: library.previewRequest,
                }}
                appearance={props.appearance}
                windowState={props.windowState}
                platform={props.platform}
                onFileOpen={(file) => props.bridge.kissopenFileOpen(file.url, file.name)}
                relayDestinations={[
                    { id: DESTINATION, label: t("远程控制"), icon: "agents" },
                    { id: SCHEDULES, label: t("计划任务"), icon: "clock" },
                    { id: PLUGINS, label: t("插件"), icon: "plugin" },
                ]}
                onRelayDestinationSelect={claim}
                {...(localMachineId ? { localMachineId } : {})}
                chat={{
                    sections: chatSections,
                    ...(openChat
                        ? { activeId: chatRowId(openChat) }
                        : place?.at === "project"
                          ? {
                                activeId: `${RELAY_PROJECT_ROW}${place.machineId}:${place.projectId}`,
                            }
                          : {}),
                    onSelect: (id) => {
                        if (id.startsWith(RELAY_PROJECT_ROW)) {
                            // A project row opens the project, not a chat: the tab stays.
                            const project = remoteProjects.find(
                                (candidate) => RELAY_PROJECT_ROW + candidate.id === id,
                            );
                            if (project)
                                remotePlaceOpen(project.id.split(":")[0]!, project.projectId);
                            return false;
                        }
                        const sessionId = chatSessionOf(id);
                        if (sessionId === null) return false;
                        /*
                         * Leaving remote control, the same as choosing one of the
                         * window's own destinations. Without this the machines,
                         * the schedules or the plugins would still be the thing
                         * the host is offering, and the window would be showing a
                         * conversation while the sidebar marked 远程控制.
                         */
                        setSurface(null);
                        setScheduleDraft(null);
                        setScheduleFocus(null);
                        setPlace(null);
                        setOpenSession(null);
                        setOpenChat(sessionId);
                        return true;
                    },
                    ...(chatContent ? { content: chatContent } : {}),
                    ...(!place && panel
                        ? {
                              panel,
                              ...(panelWidth === undefined ? {} : { panelWidth }),
                              onPanelWidthChange: setPanelWidth,
                          }
                        : {}),
                    menuItems: chatMenuItems,
                    onMenuSelect: chatMenuSelect,
                }}
                {...(content ? { relayContent: content, relayActiveId: activeId } : {})}
                {...(content && panel
                    ? {
                          relayPanel: panel,
                          ...(panelWidth === undefined ? {} : { relayPanelWidth: panelWidth }),
                          onRelayPanelWidthChange: setPanelWidth,
                      }
                    : {})}
            >
                {props.children}
            </KissopenView>
        </>
    );
}

/** The two places remote control can be, in the content region. */
function RemoteControl(props: {
    readonly bridge: KissopenDesktopBridge;
    readonly state: RelayState;
    readonly counts: ReadonlyMap<string, number>;
    readonly loose: ReadonlyMap<string, number>;
    readonly place: Place;
    /** The conversations of this place, and the one on screen. */
    readonly sessions: readonly RelaySessionView[];
    /** Pages closed on this desktop; the conversations remain in history. */
    readonly closedSessions: ReadonlySet<string>;
    /** The place's archived conversations, newest first, for its history. */
    readonly archived: readonly RelaySessionView[];
    readonly activeSession: string | null;
    readonly running: ReadonlySet<string>;
    /** The socket to the relay is down; what is shown may be out of date. */
    readonly offline: boolean;
    /** Whether the panel beside this is already showing. */
    readonly panelOpen: boolean;
    readonly request: CloudRequest;
    readonly now: number;
    readonly cloudMachineId: string | undefined;
    readonly onPlace: (place: Place) => void;
    readonly onOpenSession: (sessionId: string | null) => void;
    readonly onPanelOpen: () => void;
    /** Shows a file a conversation here linked, in the panel beside it. */
    readonly onFileOpen: (path: string) => void;
    /** Shows the project's files in the panel, from the board. */
    readonly onFilesOpen: () => void;
    /** Where the open project is, for its analysis of new material. */
    readonly analysisPlace?: ProjectAnalysisPlace;
    /** Starts a new conversation in the open project; true once it is under way. */
    readonly onChatStart?: (text: string) => Promise<boolean>;
    /** Closes a page without archiving or stopping its conversation. */
    readonly onSessionClose?: (sessionId: string) => void;
}) {
    // Whether a new conversation is being written, and what it says so far.
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState("");
    const [starting, setStarting] = useState(false);
    if (props.place.at === "machines") {
        return (
            <RelayMachinesView
                state={props.state}
                counts={props.counts}
                loose={props.loose}
                onPick={(machineId, projectId) => {
                    props.onPlace({ at: "project", machineId, projectId });
                    props.onOpenSession(null);
                }}
            />
        );
    }

    const { machineId, projectId } = props.place;
    const machine = props.state?.machines.find((candidate) => candidate.id === machineId);
    const machineName = machine ? relayMachineName(machine) : t("这台机器");
    const project = props.state?.projects.find(
        (candidate) => candidate.machineId === machineId && candidate.id === projectId,
    );
    const projectName =
        projectId === RELAY_LOOSE_PROJECT ? "其它对话" : (project?.name ?? "读不到名字的项目");
    // The same name as the reader sees it. `projectName` stays as it was
    // because a new board schedule is named after it on the server.
    const projectLabel =
        projectId === RELAY_LOOSE_PROJECT
            ? t("其它对话")
            : (project?.name ?? t("读不到名字的项目"));
    const sessions = props.sessions;
    const archivedSession = props.archived.find((session) => session.id === props.activeSession);
    const historyMenuItems = (): readonly MenuItem[] => {
        const rows = [...sessions, ...props.archived].sort((a, b) => b.updatedAt - a.updatedAt);
        return rows.length === 0
            ? [
                  {
                      kind: "item",
                      id: "empty",
                      label: t("No sessions yet"),
                      icon: "history",
                      disabled: true,
                  },
              ]
            : rows.map((session) => ({
                  kind: "item",
                  id: session.id,
                  label: relaySessionName(session) ?? t("未命名对话"),
                  icon:
                      session.metadata?.lifecycleState === "archived" ||
                      props.closedSessions.has(session.id)
                          ? "history"
                          : "chat",
              }));
    };

    /*
     * The project's conversations, as the pages of one surface.
     *
     * The same component the local window gives a project: a strip of tabs over
     * one body. A project on another computer is the same kind of thing as a
     * project on this one, and reading it should not mean learning a second
     * arrangement of the same work.
     */
    // The board first, as the local window puts it: the project with no
    // conversation addressed. Then its conversations.
    const tabs: TabItem[] = [
        ...sessions
            .filter((session) => !props.closedSessions.has(session.id))
            .map((session) => ({
                id: session.id,
                label: relaySessionName(session) ?? t("未命名对话"),
                // The session's own id, so the mark survives every rename of the title.
                avatarId: session.id,
                busy: props.running.has(session.id),
            })),
        ...(composing ? [{ id: REMOTE_NEW_TAB, label: t("新对话") }] : []),
        ...(archivedSession
            ? [
                  {
                      id: archivedSession.id,
                      label: relaySessionName(archivedSession) ?? t("未命名对话"),
                      icon: "history" as const,
                  },
              ]
            : []),
    ];
    const active = composing ? REMOTE_NEW_TAB : (props.activeSession ?? sessions[0]?.id ?? REMOTE_NEW_TAB);
    const newStart = (): void => {
        const text = draft.trim();
        if (!text || starting || !props.onChatStart) return;
        setStarting(true);
        void props.onChatStart(text).then((ok) => {
            setStarting(false);
            if (ok) {
                setDraft("");
                setComposing(false);
            }
        });
    };
    const open = sessions.find((session) => session.id === active) ?? archivedSession;

    return (
        <div className="kissopen-relay-place">
            {/* Named like a project on this computer, with where it is in front:
                the sidebar's 远程控制 is the way back to every machine. */}
            <ChannelHeader
                icon="inbox"
                title={t("{place} - {project}", {
                    place: machine?.kind === "cloud" ? t("云端项目") : machineName,
                    project: projectLabel,
                })}
            />
            {
                <TabbedPane
                    activeId={active}
                    tabs={tabs}
                    onSelect={(id) => {
                        if (id === REMOTE_NEW_TAB) return;
                        setComposing(false);
                        props.onOpenSession(id === REMOTE_BOARD_TAB ? null : id);
                    }}
                    {...(props.onSessionClose
                        ? {
                              onClose: (id: string) => {
                                  if (id === REMOTE_NEW_TAB) setComposing(false);
                                  else if (id !== REMOTE_BOARD_TAB) props.onSessionClose!(id);
                              },
                              closeLabel: t("关闭对话"),
                          }
                        : {})}
                    {...(props.onChatStart && projectId !== RELAY_LOOSE_PROJECT
                        ? {
                              actions: (
                                  <Button
                                      aria-label={t("新对话")}
                                      icon="plus"
                                      iconOnly
                                      onClick={() => {
                                          setComposing(true);
                                      }}
                                      size="small"
                                      variant="ghost"
                                  />
                              ),
                          }
                        : {})}
                    className="kissopen-relay-pages"
                    /*
                     * The way into the panel, in the place the local window
                     * puts it and with the same shortcut: the control is
                     * offered only while the panel is shut, because the way
                     * out of it is the matching control at the panel's own
                     * leading edge.
                     */
                    trailing={
                        <>
                            {!props.panelOpen && active !== REMOTE_BOARD_TAB && (
                                <Button
                                    aria-label={t("Show panel")}
                                    aria-pressed={false}
                                    icon="panel-expand"
                                    iconOnly
                                    onClick={props.onPanelOpen}
                                    size="small"
                                    variant="ghost"
                                />
                            )}
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
                                    if (
                                        ![...sessions, ...props.archived].some(
                                            (session) => session.id === id,
                                        )
                                    )
                                        return;
                                    setComposing(false);
                                    props.onOpenSession(id);
                                }}
                            />
                        </>
                    }
                >
                    {active === REMOTE_NEW_TAB ? (
                        <div className="kissopen-relay-new">
                            <EmptyState
                                icon="chat"
                                title={t("新对话")}
                                description={t(
                                    "写下要做的事，会在「{project}」里开始一段新对话。",
                                    {
                                        project: projectLabel,
                                    },
                                )}
                            />
                            <Composer
                                disabled={starting}
                                focusOnType
                                onValueChange={setDraft}
                                onSend={newStart}
                                placeholder={t("在「{project}」里开始新对话…", {
                                    project: projectLabel,
                                })}
                                value={draft}
                            />
                        </div>
                    ) : open ? (
                        <RelayConversationView
                            archived={open.metadata?.lifecycleState === "archived"}
                            bridge={props.bridge}
                            sessionId={open.id}
                            title={relaySessionName(open) ?? t("未命名对话")}
                            machineName={machineName}
                            cloud={machineId === props.cloudMachineId}
                            running={
                                open.metadata?.lifecycleState !== "archived" &&
                                props.running.has(open.id)
                            }
                            offline={props.offline}
                            metadata={open.metadata ?? null}
                            onFileOpen={props.onFileOpen}
                        />
                    ) : null}
                </TabbedPane>
            }
        </div>
    );
}

/*
 * A project's board on another computer or in the cloud: the same page the
 * local window gives a project, read through a conversation that runs in the
 * project's folder — the one in its outermost folder — and read again every
 * little while, since nothing tells this window when a board there changes.
 */
/**
 * A project's own conversation: the one working in its outermost folder. Its
 * folder is the project's, and it is what the project's files and board are
 * read through while no other conversation is open.
 */
function projectRootSession(sessions: readonly RelaySessionView[]): RelaySessionView | undefined {
    return sessions.reduce<RelaySessionView | undefined>((best, session) => {
        const path = session.metadata?.path;
        if (typeof path !== "string") return best;
        const bestPath = best?.metadata?.path;
        return typeof bestPath === "string" && bestPath.length <= path.length ? best : session;
    }, undefined);
}

/**
 * Where the open project is, as its analysis of new material names it: the
 * cloud, or another computer by its id, and the project's folder there.
 */
function analysisPlaceOf(
    place: Place | undefined,
    root: RelaySessionView | undefined,
    cloudMachineId: string | undefined,
    state: RelayState | undefined,
): ProjectAnalysisPlace | undefined {
    if (place?.at !== "project" || place.projectId === RELAY_LOOSE_PROJECT) return undefined;
    const path = root?.metadata?.path;
    if (typeof path !== "string" || path === "") return undefined;
    const project = state?.projects.find(
        (candidate) => candidate.machineId === place.machineId && candidate.id === place.projectId,
    );
    return {
        target: place.machineId === cloudMachineId ? "cloud" : `machine:${place.machineId}`,
        path,
        name: project?.name ?? path.slice(path.lastIndexOf("/") + 1),
    };
}

/** Whether the agent a conversation runs on takes files sent to it. */
function sessionTakesUploads(session: RelaySessionView | undefined): boolean {
    const methods = (
        session?.metadata as { capabilities?: { rpcMethods?: unknown } } | null | undefined
    )?.capabilities?.rpcMethods;
    return Array.isArray(methods) && methods.includes("uploadFile");
}

const NO_PROJECTS: readonly never[] = [];
const NO_BOARDS: ReadonlyMap<KissopenAgentGroupId, KissopenAgentBoardState> = new Map();
const noSubscription = (): (() => void) => () => undefined;

/** The boards a workspace has read, or none before this computer's agent is connected. */
function boardsOf(
    workspace: KissopenAgentWorkspaceStore | undefined,
): ReadonlyMap<KissopenAgentGroupId, KissopenAgentBoardState> {
    return workspace?.get().boards ?? NO_BOARDS;
}

/** How often another computer's boards are read again while the home is on screen. */
const REMOTE_BOARD_POLL_MS = 60_000;

/** The listed conversation that is the given agent, as its relay metadata names it. */
function relaySessionOfAgent(
    state: RelayState | undefined,
    agentId: string,
): RelaySessionView | undefined {
    return state?.sessions.find(
        (session) =>
            (session.metadata as { agentId?: unknown } | null | undefined)?.agentId === agentId &&
            session.metadata?.lifecycleState !== "archived",
    );
}

/** Waits for the relay to list the given agent's conversation; undefined when it does not in time. */
function relaySessionWait(
    relay: { subscribe(listener: () => void): () => void; getSnapshot(): RelayState },
    agentId: string,
    timeoutMs: number,
    signal?: AbortSignal,
): Promise<RelaySessionView | undefined> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (session: RelaySessionView | undefined): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            unsubscribe();
            signal?.removeEventListener("abort", aborted);
            resolve(session);
        };
        const check = (): void => {
            const session = relaySessionOfAgent(relay.getSnapshot(), agentId);
            if (session) finish(session);
        };
        const timer = setTimeout(() => finish(undefined), timeoutMs);
        const unsubscribe = relay.subscribe(check);
        const aborted = (): void => finish(undefined);
        signal?.addEventListener("abort", aborted, { once: true });
        if (signal?.aborted) aborted();
        check();
    });
}

/** Where the cloud workspace's agent keeps the projects it manages. */
const CLOUD_PROJECTS_ROOT = "/home/agent/KISSOPEN/Projects";
/** The cloud workspace's home folder, where its plain chats run. */
const CLOUD_HOME = "/home/agent";

/** Sidebar rows of the projects that are not on this computer, by machine and project. */
const RELAY_PROJECT_ROW = "relay-project:";
/** The board tab of a project on another computer or in the cloud. */
const REMOTE_BOARD_TAB = "relay-board";
/** The page a new conversation is written on before it exists. */
const REMOTE_NEW_TAB = "relay-new";
/** How often such a board is read again while it is on screen. */
const REMOTE_BOARD_REFRESH_MS = 20_000;
/** A board run in one of these has not finished; its board is still coming. */
const REMOTE_BOARD_RUN_ACTIVE = new Set([
    "queued",
    "waiting_device",
    "accepted",
    "running",
    "needs_user",
]);
const REMOTE_BOARD_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** When a board builds on its own, in the words the local board uses. */
function remoteBoardScheduleLabel(schedule: Schedule): string {
    const at = `${String(Math.floor(schedule.at_minute / 60)).padStart(2, "0")}:${String(schedule.at_minute % 60).padStart(2, "0")}`;
    const when =
        schedule.recurrence === "weekdays"
            ? t("工作日")
            : schedule.recurrence === "weekly"
              ? t(REMOTE_BOARD_WEEKDAYS[schedule.weekday] ?? "每周")
              : t("每天");
    return t("{when} {at} 自动更新", { when, at });
}

/** The account's scheduled tasks as the web page keeps them current. */
export interface RelayScheduleFeed {
    subscribe(listener: () => void): () => void;
    get(): readonly Schedule[];
}

/** The page's browser notifications: whether they are on, and the way to turn them on. */
export interface RelayWebNotifications {
    get(): "on" | "off" | "blocked" | "unavailable";
    subscribe(listener: () => void): () => void;
    enable(): void;
}

const notificationsUnavailable = (): "unavailable" => "unavailable";
const NO_SCHEDULES: readonly Schedule[] = [];
const noSchedules = (): readonly Schedule[] => NO_SCHEDULES;

/** Midnight of the day `at` falls in, local time. */
function dayStart(at: number): number {
    const date = new Date(at || Date.now());
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/** A time the way a list says it: the hour today, the date before. */
function whenOf(at: number, now: number): string {
    const date = new Date(at);
    const two = (value: number) => String(value).padStart(2, "0");
    if (at >= dayStart(now)) return `${two(date.getHours())}:${two(date.getMinutes())}`;
    return t("{month}月{day}日", { month: date.getMonth() + 1, day: date.getDate() });
}
