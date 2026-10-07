import { useWorkspaceAccount } from './useWorkspaceAccount';
import { CommunityLoginButtons } from '@/components/onboarding/CommunityLoginButtons';
import { ConversationMenu } from './ConversationMenu';
import { HomeDrawer } from './HomeDrawer';
import { HomeTopBar, useHomeTopBarHeight } from './HomeTopBar';
import { WorkspaceLibrary } from './WorkspaceLibrary';
import { getSelectedCloudFiles, onCloudFilesSelected, rememberSelectedCloudFiles, selectCloudFiles, onConsumerSessionEnded, onPersonaSaved } from './sessionEvents';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardShown } from '@/hooks/useKeyboardShown';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Typography } from '@/constants/Typography';
import type { MultiTextInputHandle } from '@/components/MultiTextInput';
import { CloudConversation } from './CloudConversation';
import { useCloudWorkspace, type CloudWorkspaceLocation } from './useCloudWorkspace';
import { useCloudPlugins } from './useCloudPlugins';
import { PluginsLibrary } from './PluginsLibrary';
import { CatalogDetail } from './CatalogDetail';
import { SchedulesLibrary } from './SchedulesLibrary';
import { ScheduleDetail } from './ScheduleDetail';
import { ScheduleCreate } from './ScheduleCreate';
import { scheduleIntentSubscribe, scheduleIntentTake } from './scheduleIntent';
import { useSchedules, type ScheduleRun } from './useSchedules';
import { PluginDetail } from './PluginDetail';
import { useCloudCatalog } from './useCloudCatalog';
import { useAllSessions } from '@/sync/storage';
import { getSessionActivityAt } from '@/utils/sessionActivity';
import { getSessionName } from '@/utils/sessionUtils';
import { useNewSessionDraft } from '@/hooks/useNewSessionDraft';
import { useStartSessionFromDraft } from '@/hooks/useStartSessionFromDraft';
import { base64FromUri, pickCloudImages } from './cloudImage';
import { DeviceWork } from './DeviceWork';
import { WorkPage, type WorkExample } from './WorkPage';
import { ProjectScreen } from './ProjectPage';
import { LibraryPage } from './LibraryPage';
import * as WebBrowser from 'expo-web-browser';
import { MinePage } from './MinePage';
import { HomeTabBar, type HomeTabKey } from './HomeTabBar';
import { cardOpenNotice, useCardOpen } from './useCardOpen';
import type { WorkProject } from './ProjectPage';
import { buildWorkProjects } from './workProjects';
import { useAllMachines, useProjects } from '@/sync/storage';
import * as React from 'react';
import { AppState, Platform, TextInput, View, Text, ScrollView, Pressable, BackHandler, Keyboard } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RoundButton } from '@/components/RoundButton';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import { Modal } from '@/modal';
import { client, requestID, type Announcement } from './api/client';
import { cloudCache } from './cloudCache';
import { APIError } from './api/protocol';
import { TransportError } from './platform/transport';
import { isActive, statusLabel } from './api/types';
import type { Config, User, Model, Conversation, ConversationDetail, FileItem, CloudImage, Job } from './api/types';
import { t } from '@/text';
import { KissopenBoot } from './KissopenBoot';
import { themeApply } from './useTheme';
import { ThemeBackdrop } from './ThemeBackdrop';
import { sessionFilePathEncode } from '@/utils/sessionFileLinks';

type Tab = HomeTabKey | 'history' | 'projects' | 'schedules' | 'plugins' | 'devices';
const PRIMARY_TABS: readonly Tab[] = ['work', 'chat', 'files', 'mine'];
const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.groupped.background },
    // The theme's background picture, when there is one, is drawn once under this.
    rootOverBackdrop: { flex: 1 },
    // The chrome floats over the content the way the bot session header does,
    // so it is rendered after it and pinned rather than taking layout space.
    headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
    bannerOverlay: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 999 },
    pane: { flex: 1 },
    hidden: { display: 'none' },
    link: { color: theme.colors.text, fontSize: 14, ...Typography.default('semiBold') },
    body: { padding: 16, gap: 12, width: '100%', maxWidth: 900, alignSelf: 'center' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    text: { color: theme.colors.text, fontSize: 16, lineHeight: 24 },
    subtle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    field: { color: theme.colors.text, backgroundColor: theme.colors.input.background, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 },
    message: { backgroundColor: theme.colors.surface, padding: 16, borderRadius: 12, gap: 6 },
    banner: { padding: 12, backgroundColor: theme.colors.surface, borderRadius: 10 },
    cardNotice: {
        position: 'absolute', left: 16, right: 16, zIndex: 998, alignSelf: 'center', maxWidth: 520,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.colors.surface,
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 4, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: theme.colors.input.background },
    searchField: { flexGrow: 1, flexShrink: 1, color: theme.colors.text, fontSize: 16 },
}));

/** How long a send waits for a workspace that is still starting. */
const CLOUD_WORKSPACE_WAIT_MS = 60000;

// Consumer cloud data is deliberately separate from Kissopen's encrypted device
// sessions. No KISSOPEN recovery secret or resource-pool credential enters this API.
const TEXT_TYPES = ['text/*', 'application/json'];
const DOCUMENT_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx'];
const DOCUMENT_MAX_BYTES = 16 * 1024 * 1024;

export function KissopenHome({ settingsSection }: { settingsSection?: 'files' | 'mine' } = {}) {
    const router = useRouter();
    // A cloud conversation is a session of its own: the welcome page starts a
    // new one for every message it is given, which earns its own name and sits
    // in the list beside the rest. The composer still reads its models and
    // permissions from a session on that machine — any of them will do, and the
    // newest is the one whose settings the reader last chose.
    const cloudWorkspace = useCloudWorkspace(!settingsSection);
    const cloud = cloudWorkspace.location;
    const allSessions = useAllSessions();
    const { startSession } = useStartSessionFromDraft();
    // Every conversation this account has had with its cloud workspace, newest
    // first. They are ordinary sessions, so the drawer's recent list is simply
    // this rather than the generation service's separate history — one list of
    // conversations, in the one place a reader looks for them.
    const cloudChats = React.useMemo(() => (
        cloud === undefined
            ? []
            : allSessions
                .filter(session => session.metadata?.machineId === cloud.machineId)
                .sort((a, b) => getSessionActivityAt(b) - getSessionActivityAt(a))
                .map(session => ({ id: session.id, title: getSessionName(session), at: getSessionActivityAt(session) }))
    ), [allSessions, cloud]);
    const cloudComposerSession = cloudChats[0]?.id;
    // Read through a ref so the wait below sees the workspace arrive rather
    // than the value this callback closed over.
    const cloudRef = React.useRef(cloud);
    React.useEffect(() => { cloudRef.current = cloud; }, [cloud]);
    const startCloudSession = React.useCallback(async (text: string) => {
        // The workspace is ensured when the home opens, but a first launch can
        // still be starting its container when someone finishes typing. Waiting
        // for it keeps the words; refusing them here would look like the send
        // button doing nothing at all.
        const cloudNow = cloudRef.current ?? await new Promise<CloudWorkspaceLocation | undefined>(resolve => {
            const deadline = Date.now() + CLOUD_WORKSPACE_WAIT_MS;
            const tick = setInterval(() => {
                if (cloudRef.current || Date.now() >= deadline) {
                    clearInterval(tick);
                    resolve(cloudRef.current);
                }
            }, 250);
        });
        if (!cloudNow) return false;
        // The shared new-session flow owns creation, delivery and navigation,
        // including everything it already knows about a spawn that fails or is
        // overtaken. This only says where the session goes.
        const draft = useNewSessionDraft.getState();
        draft.setMachineId(cloudNow.machineId);
        draft.setPath(cloudNow.directory);
        draft.setAgentType('rig');
        draft.setInput(text);
        return await startSession();
    }, [startSession]);
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const keyboardShown = useKeyboardShown();
    const topBarHeight = useHomeTopBarHeight();
    const [headerBackdropVisible, setHeaderBackdropVisible] = React.useState(false);
    const input = React.useRef<MultiTextInputHandle>(null);
    const drafts = React.useRef<Record<string, { text: string; files: string[]; images: CloudImage[] }>>({});
    const attachmentDestination = React.useRef('new');
    const [composerRevision, setComposerRevision] = React.useState(0);
    const [primaryTab, setPrimaryTab] = React.useState<HomeTabKey>('work');
    const [workVisited, setWorkVisited] = React.useState(false);
    // The project open inside the work tab, by WorkProject id.
    const [projectId, setProjectId] = React.useState<string>();
    const [chatPrefill, setChatPrefill] = React.useState<{ text: string }>();
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [temporary, setTemporary] = React.useState(false);
    const [tab, setTab] = React.useState<Tab>(settingsSection || 'work');
    const [librarySearching, setLibrarySearching] = React.useState(false);
    const [libraryQuery, setLibraryQuery] = React.useState('');
    // Plugins are a list and one plugin's page; which one is open is this
    // screen's state rather than a route, so the header stays put and going
    // back from a plugin lands on the list it was opened from.
    const [pluginId, setPluginId] = React.useState<string>();
    const [pluginQuery, setPluginQuery] = React.useState('');
    const [pluginSearching, setPluginSearching] = React.useState(false);
    // A package that is not installed has a page of its own: the skills it
    // would add and who wrote it, which a row has no room for.
    const [catalogId, setCatalogId] = React.useState<string>();
    // Scheduled tasks are this account's, wherever they run. The server holds
    // the timer, so this list moves on its own and the hook polls.
    const [scheduleId, setScheduleId] = React.useState<string>();
    const scheduleState = useSchedules(tab === 'schedules');
    const [scheduleCreating, setScheduleCreating] = React.useState(false);
    /** What an assistant proposed, said as the first line of the new task. */
    const [scheduleDraft, setScheduleDraft] = React.useState<string>();
    /*
     * A task somebody tapped a notification for, or one an assistant proposed
     * in a conversation. Taken on mount and whenever one arrives while the app
     * is already open, which is the case a person hits when the phone was in
     * their hand the whole time.
     */
    React.useEffect(() => {
        const take = () => {
            const intent = scheduleIntentTake();
            if (!intent) return;
            setTab('schedules');
            if (intent.kind === 'draft') {
                setScheduleId(undefined);
                setScheduleDraft(intent.request);
                setScheduleCreating(true);
                return;
            }
            setScheduleId(intent.scheduleId);
            setScheduleDraft(undefined);
            setScheduleCreating(false);
        };
        take();
        return scheduleIntentSubscribe(take);
    }, []);
    const startScheduleConversation = React.useCallback(() => { setScheduleDraft(undefined); setScheduleCreating(true); }, []);
    /*
     * Where a new task could run: the cloud, and every computer the server
     * says it will accept one for. A machine the server would refuse is not
     * offered — on a phone there is nothing to do about it anyway, since what
     * makes a computer ready is opening the desktop app on that computer.
     */
    const scheduleTargets = React.useMemo(() => [
        { value: 'cloud', label: t('kissopen.schedules.targetCloud') },
        ...scheduleState.machines.map(machine => ({
            value: `machine:${machine.machine_id}`,
            label: machine.name || machine.machine_id,
        })),
    ], [scheduleState.machines]);
    /*
     * The folders on one machine.
     *
     * A folder is somewhere a conversation on that machine has named: the
     * relay carries the path, and a project nobody has opened has none. The
     * server never checks it — the machine is not this server's to see — so
     * offering only paths the account has actually seen is what keeps a task
     * from naming a folder that was never there.
     */
    const scheduleFolders = React.useCallback((target: string) => {
        const machineId = target.startsWith('machine:') ? target.slice('machine:'.length) : '';
        if (!machineId) return [];
        const seen = new Map<string, string>();
        for (const session of allSessions) {
            if (session.metadata?.machineId !== machineId) continue;
            const path = session.metadata?.path;
            if (!path || seen.has(path)) continue;
            seen.set(path, path.split(/[/\\]/).filter(Boolean).at(-1) ?? path);
        }
        return [...seen.entries()].map(([path, name]) => ({ path, name }));
    }, [allSessions]);
    const openSchedule = React.useMemo(() => (
        scheduleId === undefined ? undefined : scheduleState.schedules.find(one => one.id === scheduleId)
    ), [scheduleId, scheduleState.schedules]);
    // Plugins belong to the workspace, not to any conversation with it, and
    // they are reached through this server rather than through the relay. So
    // the list asks as soon as the workspace exists. Waiting for a chat
    // session to sync first made a workspace full of plugins report that it
    // had none, without ever having asked.
    const pluginState = useCloudPlugins(tab === 'plugins' && cloudWorkspace.exists);
    const openPlugin = React.useMemo(() => (
        pluginId === undefined ? undefined : pluginState.plugins.find(one => one.id === pluginId)
    ), [pluginId, pluginState.plugins]);
    // Loaded with the page, not behind a button: the page shows both halves.
    const catalogState = useCloudCatalog(tab === 'plugins' && cloudWorkspace.exists);
    // Leaving the section puts it back to the list: coming back to a plugin's
    // page you have no memory of opening reads as the app losing its place.
    React.useEffect(() => {
        if (tab === 'plugins') return;
        setPluginId(undefined); setCatalogId(undefined); setPluginQuery(''); setPluginSearching(false);
        setScheduleId(undefined); setScheduleCreating(false);
    }, [tab]);
    /*
     * What the server last said about this account, read once from the phone:
     * the home opens on it at once — and without a connection — while the
     * first refresh below asks again. The settings sections still wait for
     * the server, since what they show (files, plan) is not kept.
     */
    const [cached] = React.useState(() => settingsSection ? undefined : {
        user: cloudCache.user(),
        models: cloudCache.models() ?? [],
        conversations: cloudCache.conversations() ?? [],
    });
    const [config, setConfig] = React.useState<Config>();
    const [user, setUser] = React.useState<User | undefined>(cached?.user);
    const workspace = useWorkspaceAccount(settingsSection ? undefined : user?.id);
    // The kept account's theme paints the first frame; `/me` below confirms or replaces it.
    React.useEffect(() => { if (!settingsSection) themeApply(cached?.user?.theme ?? null); }, []);
    const machines = useAllMachines({ includeOffline: true });
    const projectRecords = useProjects();
    const workProjects = React.useMemo(
        () => buildWorkProjects(allSessions, machines, projectRecords, cloud?.machineId, t('kissopen.workStart.cloudPlace')),
        [allSessions, machines, projectRecords, cloud?.machineId],
    );
    /*
     * A board card opens its own conversation, on the project's computer or in
     * the cloud: the one project.json names when the phone has it, else the
     * one the server starts for the card.
     */
    const cardOpen = useCardOpen();
    const cardNotice = cardOpenNotice(cardOpen.status);
    // A cloud project just made opens as soon as the relay brings it here.
    const [pendingProjectPath, setPendingProjectPath] = React.useState<string>();
    React.useEffect(() => {
        if (!pendingProjectPath) return;
        const made = workProjects.find(project => project.cloud && project.path === pendingProjectPath);
        if (!made) return;
        setPendingProjectPath(undefined);
        setProjectId(made.id);
    }, [pendingProjectPath, workProjects]);
    // Things a first project could be: the ones the home page imagined for
    // this person's work first, then everyday office work.
    const workExamples = React.useMemo<WorkExample[]>(() => [
        { title: t('kissopen.workStart.example1Title'), detail: t('kissopen.workStart.example1Detail'), picture: 'document' },
        { title: t('kissopen.workStart.example2Title'), detail: t('kissopen.workStart.example2Detail'), picture: 'calendar' },
        { title: t('kissopen.workStart.example3Title'), detail: t('kissopen.workStart.example3Detail'), picture: 'megaphone' },
    ], []);
    /** Chat, with these words waiting in the composer to be read and sent. */
    const askInChat = React.useCallback((text: string) => {
        setChatPrefill({ text });
        setTab('chat'); setPrimaryTab('chat');
    }, []);
    /**
     * A new conversation in a project's folder on its computer, with the words
     * the person typed waiting in the new-session composer. The new-session
     * page is where the computer and folder are confirmed, so nothing starts
     * without a look. A board card never comes this way: it opens its own
     * conversation (`openCard`).
     */
    const askInProject = React.useCallback((machineId: string, path: string, text: string) => {
        const draft = useNewSessionDraft.getState();
        draft.setMachineId(machineId);
        draft.setPath(path);
        draft.setInput(text);
        Keyboard.dismiss();
        router.push('/new');
    }, [router]);
    /*
     * A new project is made in the cloud workspace, where every device of the
     * account can open it and nothing has to be switched on: the cloud makes
     * its folder and starts its first conversation with the goal. The work
     * tab opens it as soon as the relay brings it here.
     */
    const startProject = (goal: string) => perform(async () => {
        Keyboard.dismiss();
        const created = await client.cloudProjectCreate(projectNameOf(goal), t('kissopen.workStart.startPrompt', { goal }));
        setPendingProjectPath(created.project.path);
        if (created.error) setNotice(t('kissopen.workStart.firstConversationFailed'));
    });
    const [models, setModels] = React.useState<Model[]>(() => cached?.user ? cached.models : []);
    const [model, setModel] = React.useState(() => cached?.user ? cached.models[0]?.id ?? '' : '');
    const [conversations, setConversations] = React.useState<Conversation[]>(() => cached?.user ? cached.conversations : []);
    // The account's chats as the chat tab lists them: newest first, archived ones left out.
    const recentChats = React.useMemo(() => conversations
        .filter(item => !item.archived)
        .sort((a, b) => b.updated - a.updated)
        .map(item => ({ id: item.id, title: item.title, at: item.updated })), [conversations]);
    const [conversation, setConversation] = React.useState<ConversationDetail>();
    const [files, setFiles] = React.useState<FileItem[]>([]);
    const [attachments, setAttachments] = React.useState<string[]>(() => settingsSection === 'files' ? getSelectedCloudFiles() : []);
    const [imageAttachments, setImageAttachments] = React.useState<CloudImage[]>([]);
    const [reasoningEffort, setReasoningEffort] = React.useState<'auto' | 'low' | 'medium' | 'high'>('auto');
    const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
    const [draft, setDraft] = React.useState('');
    const [error, setError] = React.useState('');
    /*
     * What the screen's own background reads last said went wrong, so the next
     * read that succeeds can take it back. A read that simply got no answer —
     * a timeout, no network, the app waking from the background — says
     * nothing at all: the next one is seconds away.
     */
    const backgroundError = React.useRef('');
    const backgroundFailed = (e: unknown) => {
        if (e instanceof TransportError) return;
        const message = e instanceof Error ? e.message : t('kissopen.errors.cannotConnect');
        backgroundError.current = message;
        setError(message);
    };
    const backgroundRecovered = () => {
        if (!backgroundError.current) return;
        const message = backgroundError.current;
        backgroundError.current = '';
        setError(current => current === message ? '' : current);
    };
    const [notice, setNotice] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [ready, setReady] = React.useState(!!cached?.user);
    const [job, setJob] = React.useState<Job>();
    const [liveText, setLiveText] = React.useState('');
    // The model is drawing: nothing streams for half a minute, and the reader
    // should see that a picture is coming rather than a stalled reply.
    const [drawing, setDrawing] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const userRef = React.useRef(user);
    userRef.current = user;
    const jobRef = React.useRef(job);
    jobRef.current = job;
    const lock = React.useRef(false);
    const request = React.useRef<{ key: string; id: string } | undefined>(undefined);
    const generation = React.useRef(0);
    const selected = React.useRef({ conversation: '' });
    selected.current = { conversation: conversation?.id || '' };

    const resetAccount = React.useCallback(() => {
        generation.current++; userRef.current = undefined;
        setUser(undefined); setConversation(undefined); setJob(undefined);
        setConversations([]); setFiles([]); setModels([]);
        setDraft(''); setAttachments([]); setImageAttachments([]); setLiveText('');
        request.current = undefined; drafts.current = {};
        setTab('work'); setPrimaryTab('work'); setWorkVisited(false); setProjectId(undefined); setNotice(''); setDrawerOpen(false); setTemporary(false);
    }, []);
    React.useEffect(() => onConsumerSessionEnded(resetAccount), [resetAccount]);
    // Changed answers about the person's work write a new home page.
    React.useEffect(() => onPersonaSaved(persona => {
        const current = userRef.current;
        if (!current) return;
        userRef.current = { ...current, persona };
        setUser(userRef.current);
    }), []);
    React.useEffect(() => {
        if (!settingsSection && tab === 'chat') rememberSelectedCloudFiles(attachments);
    }, [settingsSection, tab, attachments]);
    React.useEffect(() => {
        if (settingsSection) return;
        return onCloudFilesSelected(ids => {
            if (!userRef.current) return;
            setAttachments(ids);
            const key = conversation?.id || (temporary ? 'temporary' : 'new');
            drafts.current[key] = { text: input.current?.getText() ?? draft, files: ids, images: imageAttachments };
        });
    }, [settingsSection, conversation?.id, draft, temporary, imageAttachments]);
    const draftKey = () => conversation?.id || (temporary ? 'temporary' : 'new');
    const stashDraft = () => { attachmentDestination.current = draftKey(); drafts.current[draftKey()] = { text: input.current?.getText() ?? draft, files: attachments, images: imageAttachments }; };
    const navigate = (next: Tab) => {
        if (lock.current) return;
        Keyboard.dismiss();
        if (next !== 'files') { setLibrarySearching(false); setLibraryQuery(''); }
        if (tab === 'chat') stashDraft();
        if (next === 'chat') {
            const saved = drafts.current[conversation?.id || (temporary ? 'temporary' : 'new')];
            setDraft(saved?.text || ''); setAttachments(saved?.files || []); setImageAttachments(saved?.images || []);
        }
        if (PRIMARY_TABS.includes(next)) setPrimaryTab(next as HomeTabKey);
        if (next === 'devices') setWorkVisited(true);
        setTab(next);
    };
    /*
     * A conversation this phone has opened before shows at once from the
     * cache, then the server's copy replaces it (and brings back a reply still
     * being written). Without a connection the cached copy stays, with the
     * error banner saying why it may be behind.
     */
    const openConversation = async (id?: string, asTemporary = false) => {
        const version = generation.current;
        if (tab === 'chat') stashDraft();
        const present = (data: ConversationDetail | undefined) => {
            const active = data?.job && isActive(data.job.status) ? data.job : undefined;
            selected.current = { conversation: data?.id || '' };
            setTemporary(asTemporary); setDrawerOpen(false);
            setConversation(data); setJob(active);
            setLiveText(active ? data?.messages.at(-1)?.content || '' : '');
            const saved = asTemporary ? undefined : drafts.current[id || 'new'];
            setDraft(saved?.text || ''); setAttachments(saved?.files || []); setImageAttachments(saved?.images || []);
            setComposerRevision(value => value + 1); setTab('chat'); setPrimaryTab('chat');
        };
        const cachedDetail = id && !asTemporary ? cloudCache.conversation(id) : undefined;
        if (!id || !cachedDetail) {
            const data = id ? await client.conversation(id) : undefined;
            if (version === generation.current) present(data);
            return;
        }
        present(cachedDetail);
        // The refresh does not hold the screen: the reader can move on while
        // it is under way, and a copy for a conversation no longer open is dropped.
        void client.conversation(id).then(data => {
            if (version !== generation.current || selected.current.conversation !== data.id) return;
            const active = data.job && isActive(data.job.status) ? data.job : undefined;
            setConversation(data); setJob(active);
            setLiveText(active ? data.messages.at(-1)?.content || '' : '');
        }, e => {
            if (version !== generation.current) return;
            if (e instanceof APIError && e.status === 401) { if (userRef.current) resetAccount(); void client.forgetSession(); }
            else backgroundFailed(e);
        });
    };
    useFocusEffect(React.useCallback(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (drawerOpen) { setDrawerOpen(false); return true; }
            if (settingsSection) return false;
            if (tab === 'work' && projectId !== undefined) { setProjectId(undefined); return true; }
            if (tab === 'work') return false;
            if (PRIMARY_TABS.includes(tab)) { navigate('work'); return true; }
            // A plugin's page was opened from the list, so back belongs to the
            // list before it belongs to the section.
            if (tab === 'plugins' && pluginId !== undefined) { setPluginId(undefined); return true; }
            if (tab === 'plugins' && catalogId !== undefined) { setCatalogId(undefined); return true; }
            if (tab === 'schedules' && scheduleId !== undefined) { setScheduleId(undefined); return true; }
            if (tab === 'schedules' && scheduleCreating) { setScheduleCreating(false); return true; }
            navigate(primaryTab); return true;
        });
        return () => subscription.remove();
    }, [tab, primaryTab, draft, attachments, conversation?.id, settingsSection, drawerOpen, pluginId, catalogId, scheduleId, scheduleCreating, projectId]));

    const refresh = React.useCallback(async () => {
        const version = generation.current;
        const me = await client.me();
        if (version !== generation.current) return;
        userRef.current = me; setUser(me);
        // Account settings read identity and files only; no commercial cloud
        // model catalog, conversation history, billing or points requests.
        const [catalog, history, uploads] = await Promise.all([
            settingsSection ? Promise.resolve([] as Model[]) : client.models(),
            settingsSection ? Promise.resolve([] as Conversation[]) : client.conversations(),
            client.files(),
        ]);
        if (version !== generation.current) return;
        userRef.current = me; setUser(me); setModels(catalog); setConversations(history); setFiles(uploads);
        void client.announcements().then(list => { if (version === generation.current) setAnnouncements(list); }, () => undefined);
        setModel(current => catalog.some(item => item.id === current) ? current : catalog[0]?.id || '');
    }, [settingsSection]);
    const perform = React.useCallback(async (action: () => Promise<void>) => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setNotice('');
        try { await action(); }
        catch (e) {
            setError(e instanceof Error ? e.message : t('kissopen.errors.requestFailedRetry'));
            if (e instanceof APIError && e.status === 401) { if (userRef.current) resetAccount(); void client.forgetSession(); }
        } finally { lock.current = false; setBusy(false); }
    }, [resetAccount]);

    useFocusEffect(React.useCallback(() => {
        let alive = true;
        let polling = false;
        const update = async () => {
            if (!alive || polling || lock.current || AppState.currentState !== 'active' || (Platform.OS === 'web' && document.hidden)) return;
            polling = true;
            const version = generation.current;
            try {
                const settings = await client.config();
                if (!alive || version !== generation.current) return;
                setConfig(settings);
                await refresh();
                if (alive) { setReady(true); backgroundRecovered(); }
            } catch (e) {
                if (alive && version === generation.current && !lock.current) {
                    setReady(true);
                    if (e instanceof APIError && e.status === 401) { if (userRef.current) resetAccount(); void client.forgetSession(); }
                    else backgroundFailed(e);
                }
            } finally { polling = false; }
        };
        void update();
        const interval = setInterval(() => { if (userRef.current) void update(); }, 30000);
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') void update(); });
        return () => { alive = false; clearInterval(interval); subscription.remove(); generation.current++; };
    }, [refresh, resetAccount]));

    useFocusEffect(React.useCallback(() => {
        if (!job || !isActive(job.status)) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout>;
        let cursor = jobRef.current?.id === job.id ? jobRef.current.seq || 0 : job.seq || 0;
        let completed = false;
        const tick = async () => {
            if (!alive) return;
            try {
                if (AppState.currentState !== 'active' || (Platform.OS === 'web' && document.hidden)) return;
                const page = await client.events(job.id, cursor);
                if (!alive) return;
                for (const event of page.events) {
                    cursor = Math.max(cursor, event.seq);
                    if (event.kind === 'delta') {
                        const data = JSON.parse(event.data);
                        if (typeof data.text === 'string') setLiveText(value => value + data.text);
                    }
                    if (event.kind === 'drawing') setDrawing(true);
                    if (event.kind === 'image') {
                        // The picture is attached before the reply is finished;
                        // show it now instead of after the closing sentence.
                        setDrawing(false);
                        const result = await client.conversation(job.target);
                        if (alive && selected.current.conversation === job.target) setConversation(result);
                    }
                }
                // Persist cursor across backgrounding and route changes.
                setJob(value => value?.id === job.id ? { ...value, seq: cursor } : value);
                if (!isActive(page.status) && !page.more) {
                    const result = await client.conversation(job.target);
                    if (!alive) return;
                    if (selected.current.conversation === job.target) setConversation(result);
                    completed = true;
                    setLiveText(''); setJob(undefined); setDrawing(false);
                    await refresh();
                    return;
                }
            } catch (e) { if (alive) {
                backgroundFailed(e);
                if (e instanceof APIError && e.status === 401) { completed = true; resetAccount(); void client.forgetSession(); }
            } }
            finally { if (alive && !completed) timer = setTimeout(() => void tick(), 900); }
        };
        void tick();
        return () => { alive = false; clearTimeout(timer); };
    }, [job?.id, refresh, resetAccount]));

    const send = () => perform(async () => {
        const sourceDraft = input.current?.getText() ?? draft;
        const text = sourceDraft.trim() || (imageAttachments.length ? t('kissopen.home.analyzeImagePrompt') : '');
        const version = generation.current;
        const sourceKey = draftKey();
        if (!text || !model || job) return;
        const key = JSON.stringify([tab, text, model, attachments, imageAttachments.map(image => image.id), reasoningEffort, conversation?.id, temporary]);
        if (request.current?.key !== key) request.current = { key, id: requestID() };
        const next = await client.chat(request.current.id, text, model, attachments, conversation?.id, temporary, imageAttachments.map(image => image.id), reasoningEffort);
        const data = await client.conversation(next.target);
        if (version !== generation.current) return;
        setConversation(data);
        // The fetched snapshot already includes events up to its own cursor.
        const snapshotJob = data.job;
        setJob(snapshotJob && isActive(snapshotJob.status) ? snapshotJob : undefined);
        setLiveText(snapshotJob && isActive(snapshotJob.status) ? data.messages.at(-1)?.content || '' : '');
        const currentText = input.current?.getText() ?? draft;
        const remaining = currentText === sourceDraft ? '' : currentText;
        setDraft(remaining); setAttachments([]); setImageAttachments([]);
        drafts.current[sourceKey] = { text: '', files: [], images: [] };
        drafts.current[data?.id || sourceKey] = { text: remaining, files: [], images: [] };
        setComposerRevision(value => value + 1); request.current = undefined;
        await refresh();
    });
    const selectAttachments = (value: string[]) => {
        setAttachments(value);
        if (tab === 'files') {
            if (settingsSection === 'files') selectCloudFiles(value);
            const key = attachmentDestination.current;
            drafts.current[key] = { text: drafts.current[key]?.text || '', files: value, images: drafts.current[key]?.images || [] };
        }
    };
    // From the composer's picker the file is attached to the chat as well; from the library it is only kept.
    const uploadCloudFile = (select: boolean) => perform(async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: [...TEXT_TYPES, ...DOCUMENT_TYPES], copyToCacheDirectory: true });
        if (result.canceled) return;
        const asset = result.assets[0];
        // An office document goes as its bytes; the server keeps the file and
        // reads its text, and the chat is handed that text like a text file's.
        if (DOCUMENT_EXTENSIONS.includes(asset.name.slice(asset.name.lastIndexOf('.')).toLowerCase())) {
            if ((asset.size || 0) > DOCUMENT_MAX_BYTES) throw new Error(t('kissopen.home.documentTooLarge', { maxMb: 16 }));
            const file = await client.uploadDocument(asset.name, await base64FromUri(asset.uri));
            if (select) selectAttachments([...attachments, file.id]);
            await refresh();
            return;
        }
        if ((asset.size || 0) > 180000) throw new Error(t('kissopen.home.textFileTooLarge', { maxKb: 180 }));
        const content = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
        if (content.length > 180000) throw new Error(t('kissopen.home.fileContentTooLong'));
        const file = await client.upload(asset.name, content);
        if (select) selectAttachments([...attachments, file.id]);
        await refresh();
    });
    const attach = () => uploadCloudFile(true);
    const upload = () => uploadCloudFile(false);
    const attachImages = (source: 'camera' | 'library') => perform(async () => {
        const images = await pickCloudImages(source, 4 - imageAttachments.length);
        setImageAttachments(value => [...value, ...images]);
    });

    const banners = <>{!!error && <View style={styles.banner}><Text accessibilityRole="alert" style={styles.subtle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void perform(async () => { setConfig(await client.config()); await refresh(); })}><Text style={styles.link}>{t('common.retry')}</Text></Pressable></View>}{!!notice && <View style={styles.banner}><Text style={styles.subtle}>{notice}</Text></View>}</>;
    // The gate has already shown the boot screen while it checked the session;
    // this is the second wait in the same startup, so it shows the same screen
    // rather than a differently-styled one with a caption under it.
    if (!ready && !settingsSection) return <><Stack.Screen options={{ headerShown: false }} /><KissopenBoot /></>;
    if (ready && !user && settingsSection) return <ItemList><ItemGroup><Item title="Sign in to your KissOpen account" subtitle="Use Google, GitHub or NodeLoc to restore your profile and files. Your encrypted workspace is kept separately." showChevron={false} /></ItemGroup><CommunityLoginButtons /></ItemList>;
    if (!user && !settingsSection) return <><Stack.Screen options={{ headerShown: false }} />{banners}<CommunityLoginButtons /></>;
    const auxiliary = !PRIMARY_TABS.includes(tab);
    // Home, work and the account page draw their own top. The tab bar runs
    // along the bottom of all five places; in chat it steps aside while the
    // keyboard is up, so the composer rises with the keyboard as it always has.
    const ownTop = tab === 'work' || tab === 'mine';
    const tabBarVisible = !settingsSection && PRIMARY_TABS.includes(tab) && !(tab === 'chat' && keyboardShown);
    const titles: Partial<Record<Tab, string>> = { devices: t('kissopen.workStart.devices'), files: t('kissopen.nav.library'), history: t('kissopen.nav.chatHistory'), projects: t('kissopen.nav.projects'), schedules: t('kissopen.nav.schedules'), plugins: t('kissopen.nav.plugins') };
    // Every section names itself in the centre now that the switcher is gone.
    // Chat is the exception: its welcome page already carries the mark, and a
    // title over a transcript would only repeat the conversation you are in.
    // Temporary chat still says so, because nothing else on the page does.
    const headerTitle = tab === 'chat' ? (temporary ? t('kissopen.home.temporaryChat') : undefined) : titles[tab];
    const topInset = settingsSection ? 0 : topBarHeight;
    const paneInsets = { paddingTop: topInset, paddingBottom: tabBarVisible ? 0 : insets.bottom };
    const openProject = projectId === undefined ? undefined : workProjects.find(project => project.id === projectId);
    const openProjectFile = (sessionId: string, path: string) => router.push(`/session/${sessionId}/file?path=${encodeURIComponent(sessionFilePathEncode(path))}`);
    // Beside the projects' files in the library, the cloud chat's are one group of several.
    // A file kept with the cloud chat opens from its own signed address, in the in-app browser.
    const openChatFile = (file: FileItem) => { if (file.url) void WebBrowser.openBrowserAsync(file.url); };
    return <View style={styles.root}>{!settingsSection && <ThemeBackdrop />}<View style={styles.rootOverBackdrop} accessibilityElementsHidden={drawerOpen} importantForAccessibility={drawerOpen ? 'no-hide-descendants' : 'auto'}>
        <Stack.Screen options={settingsSection ? { headerShown: true, title: titles[settingsSection], headerTransparent: false } : { headerShown: false }} />
        {!!settingsSection && banners}
        {tab === 'work' && (openProject
            ? <ProjectScreen
                key={openProject.id}
                project={openProject}
                topInset={insets.top}
                bottomInset={0}
                onBack={() => setProjectId(undefined)}
                onAsk={text => askInProject(openProject.machineId, openProject.path, text)}
                onConversation={id => router.push(`/session/${id}`)}
                onFile={openProjectFile}
            />
            : <WorkPage
                projects={workProjects}
                examples={workExamples}
                topInset={insets.top}
                bottomInset={0}
                onStart={startProject}
                onProject={setProjectId}
                onDevices={() => navigate('devices')}
            />)}
        {tab === 'mine' && <MinePage
            topInset={settingsSection ? 0 : insets.top}
            bottomInset={0}
            onOpen={destination => {
                if (destination === 'security') { Keyboard.dismiss(); router.push('/settings/security'); return; }
                if (destination === 'workspaceAccount') { Keyboard.dismiss(); router.push('/settings/account'); return; }
                if (destination === 'appearance') { Keyboard.dismiss(); router.push('/settings/appearance'); return; }
                if (destination === 'persona') { Keyboard.dismiss(); router.push('/persona'); return; }
                navigate(destination);
            }}
        />}
        {/* The bar below already clears the home indicator, so the composer
            must not leave that space again above it. */}
        {tab === 'chat' && <SafeAreaInsetsContext.Provider value={tabBarVisible ? { ...insets, bottom: 0 } : insets}><CloudConversation prefill={chatPrefill} composerSessionId={cloudComposerSession} onSubmit={startCloudSession} topInset={topInset} onHeaderBackdropVisibilityChange={setHeaderBackdropVisible} temporary={temporary} conversation={conversation} job={job?.kind === 'chat' && job.target === conversation?.id ? job : undefined} drawing={drawing} liveText={job?.target === conversation?.id ? liveText : ''}
            attachments={attachments} files={files}
            reasoningEffort={reasoningEffort} onReasoningEffort={setReasoningEffort}
            onCamera={() => void attachImages('camera')} onPhotos={() => void attachImages('library')} onAttach={() => void attach()} onPlugins={() => navigate('plugins')}
            onRemove={(id: string) => setAttachments(value => value.filter(item => item !== id))}
            onHistory={() => { Keyboard.dismiss(); setDrawerOpen(true); }} onNew={() => void perform(() => openConversation())}
            recent={cloud ? cloudChats : recentChats}
            onOpenRecent={id => { if (cloud) { router.push(`/session/${id}`); return; } void perform(() => openConversation(id)); }} /></SafeAreaInsetsContext.Provider>}
        {workVisited && <View style={[styles.pane, paneInsets, tab !== 'devices' && styles.hidden]}><DeviceWork accountReady={workspace.ready} connectionError={workspace.error} /></View>}
        {tab === 'plugins' && <View style={[styles.pane, paneInsets]}>
            {openPlugin
                ? <PluginDetail
                    plugin={openPlugin}
                    state={pluginState}
                    icon={catalogState.plugins.find(one => one.id === openPlugin.id)?.icon}
                    onBack={() => setPluginId(undefined)}
                />
                : <>
                    {pluginSearching && <View style={styles.search}>
                        <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
                        <TextInput
                            autoFocus
                            style={styles.searchField}
                            placeholder={t('kissopen.plugins.search')}
                            placeholderTextColor={theme.colors.textSecondary}
                            value={pluginQuery}
                            onChangeText={setPluginQuery}
                            returnKeyType="search"
                        />
                    </View>}
                    {catalogId !== undefined
                        ? <CatalogDetail
                            id={catalogId}
                            installed={pluginState.plugins.some(one => one.id === catalogId)}
                            installing={catalogState.installing === catalogId}
                            onInstall={async () => {
                                await catalogState.install(catalogId);
                                await pluginState.reload();
                            }}
                            onBack={() => setCatalogId(undefined)}
                        />
                        : <PluginsLibrary
                            state={pluginState}
                            catalog={catalogState}
                            query={pluginQuery}
                            onOpen={setPluginId}
                            onOpenCatalog={setCatalogId}
                        />}
                </>}
        </View>}
        {tab === 'schedules' && <View style={[styles.pane, paneInsets]}>
            {scheduleCreating
                ? <ScheduleCreate
                    // A proposal is a new conversation, not the previous one continued.
                    key={scheduleDraft ?? 'new'}
                    targets={scheduleTargets}
                    folders={scheduleFolders}
                    {...(scheduleDraft ? { initialRequest: scheduleDraft } : {})}
                    onCreated={() => { setScheduleCreating(false); setScheduleDraft(undefined); void scheduleState.reload(); }}
                    onCancel={() => { setScheduleCreating(false); setScheduleDraft(undefined); }}
                />
                : openSchedule
                ? <ScheduleDetail
                    schedule={openSchedule}
                    state={scheduleState}
                    onBack={() => setScheduleId(undefined)}
                    // A run names its conversation, not a relay session: open the session that carries it.
                    onOpenRun={(run: ScheduleRun) => { if (run.session_id) void cardOpen.openAgent(run.session_id); }}
                />
                : <SchedulesLibrary
                    state={scheduleState}
                    query={pluginQuery}
                    onOpen={setScheduleId}
                    onCreate={startScheduleConversation}
                />}
        </View>}
        {tab === 'projects' && <View style={[styles.pane, paneInsets]}><WorkspaceLibrary section={tab} ready={workspace.ready} error={workspace.error} onWork={() => navigate('work')} /></View>}
        {(tab === 'history' || tab === 'files') && <ItemList keyboardShouldPersistTaps="handled" containerStyle={{ paddingTop: topInset }} contentInsetAdjustmentBehavior="never" style={{ marginBottom: tabBarVisible ? 0 : insets.bottom }}>
            {tab === 'history' && <ItemGroup><Item title={t('kissopen.home.startNewChat')} onPress={() => void perform(() => openConversation())} />{conversations.map(item => <Item key={item.id} title={item.title} subtitle={new Date(item.updated).toLocaleString()} selected={item.id === conversation?.id} onPress={() => void perform(() => openConversation(item.id))} />)}{!conversations.length && <Item title={t('kissopen.home.noChatsTitle')} subtitle={t('kissopen.home.noChatsDescription')} />}</ItemGroup>}
            {/* The library: every project's uploaded and generated files, then the cloud chat's own. */}
            {!settingsSection && tab === 'files' && <LibraryPage projects={workProjects} chatFiles={files} ready={ready && !!user} onProjectFile={openProjectFile} onChatFile={openChatFile} onUpload={upload} searching={librarySearching} query={libraryQuery} onQuery={setLibraryQuery} />}
            {settingsSection === 'files' && !ready && <ItemGroup title={t('kissopen.home.cloudFiles')}><Item title={t('common.loading')} loading /></ItemGroup>}
            {user && settingsSection === 'files' && <ItemGroup title={t('kissopen.home.cloudFiles')} footer={t('kissopen.home.cloudFilesFooter')}><Item title={t('kissopen.home.uploadTextFile')} onPress={attach} />{files.map(item => <Item key={item.id} title={item.name} selected={attachments.includes(item.id)} onPress={() => selectAttachments(attachments.includes(item.id) ? attachments.filter(id => id !== item.id) : [...attachments, item.id])} />)}</ItemGroup>}
        </ItemList>}
        {!!cardNotice && (
            <View style={[styles.cardNotice, { bottom: insets.bottom + (tabBarVisible ? 84 : 16) }]} pointerEvents="none" accessibilityLiveRegion="polite">
                <Text style={styles.subtle}>{cardNotice}</Text>
            </View>
        )}
        {/* Rendered after the content so the iOS blur samples what scrolls under it. */}
        {tabBarVisible && <HomeTabBar selected={tab as HomeTabKey} onSelect={key => { if (key === 'work' && tab === 'work') setProjectId(undefined); navigate(key); }} />}
        {!settingsSection && !ownTop && <>
            <View style={styles.headerOverlay}>
                <HomeTopBar
                    // The chat list has nothing on the left — it is reached from the
                    // tab bar — and a conversation opened from it goes back to it.
                    {...(tab === 'chat' && !conversation ? {} : {
                        leftIcon: auxiliary || tab === 'chat' ? 'back' as const : 'menu' as const,
                        leftLabel: auxiliary || tab === 'chat' ? t('common.back') : t('kissopen.nav.openMenu'),
                    })}
                    onLeftPress={() => {
                        Keyboard.dismiss();
                        if (tab === 'chat' && conversation) { void perform(() => openConversation()); return; }
                        if (openPlugin) setPluginId(undefined);
                        else if (catalogId !== undefined) setCatalogId(undefined);
                        else if (tab === 'schedules' && scheduleId !== undefined) setScheduleId(undefined);
                        else if (tab === 'schedules' && scheduleCreating) setScheduleCreating(false);
                        else if (auxiliary) navigate(primaryTab);
                        else setDrawerOpen(true);
                    }}
                    title={headerTitle}
                    temporary={temporary}
                    temporaryDisabled={busy || !!job}
                    // Temporary chat belongs to chat. Work's corner is its own
                    // one action, and the auxiliary sections have none.
                    onTemporaryPress={tab === 'chat' ? () => void perform(() => openConversation(undefined, !temporary)) : undefined}
                    primaryAction={tab === 'devices' ? {
                        label: t('kissopen.work.newWorkSession'),
                        icon: 'add',
                        onPress: () => { Keyboard.dismiss(); router.push('/new'); },
                    } : tab === 'files' ? {
                        label: librarySearching ? t('kissopen.drawer.closeSearch') : t('kissopen.libraryFiles.search'),
                        icon: librarySearching ? 'close' : 'search-outline',
                        onPress: () => {
                            if (librarySearching) Keyboard.dismiss();
                            setLibrarySearching(!librarySearching);
                            setLibraryQuery('');
                        },
                    } : undefined}
                    // The plugin list is searched and configured from the same
                    // corner. A plugin's own page carries neither: it is one
                    // plugin, and there is nothing there to search.
                    actionPair={tab === 'schedules' && !openSchedule && !scheduleCreating ? {
                        left: {
                            label: pluginSearching ? t('kissopen.drawer.closeSearch') : t('kissopen.schedules.search'),
                            icon: pluginSearching ? 'close' : 'search-outline',
                            selected: pluginSearching,
                            onPress: () => { setPluginSearching(!pluginSearching); setPluginQuery(''); },
                        },
                        right: {
                            label: t('kissopen.schedules.create'),
                            icon: 'add',
                            onPress: () => { Keyboard.dismiss(); startScheduleConversation(); },
                        },
                    } : tab === 'plugins' && !openPlugin && catalogId === undefined ? {
                        left: {
                            label: pluginSearching ? t('kissopen.drawer.closeSearch') : t('kissopen.plugins.search'),
                            icon: pluginSearching ? 'close' : 'search-outline',
                            selected: pluginSearching,
                            onPress: () => { setPluginSearching(!pluginSearching); setPluginQuery(''); },
                        },
                        right: {
                            label: t('kissopen.tabs.mine'),
                            icon: 'person-circle-outline',
                            onPress: () => navigate('mine'),
                        },
                    } : undefined}
                    conversationActions={tab === 'chat' && conversation && !temporary ? {
                        onCompose: () => void perform(() => openConversation()),
                        onMore: () => { Keyboard.dismiss(); setMenuOpen(true); },
                        disabled: busy,
                    } : undefined}
                    backdropVisible={tab === 'chat' && headerBackdropVisible}
                />
            </View>
            {(!!error || !!notice) && <View style={[styles.bannerOverlay, { top: topInset }]}>{banners}</View>}
        </>}
    </View>
    {!settingsSection && <ConversationMenu conversation={conversation} open={menuOpen} top={topBarHeight} onClose={() => setMenuOpen(false)}
        onRename={async title => { if (!conversation) return; const updated = await client.conversationUpdate(conversation.id, { title }); setConversation(value => value && value.id === updated.id ? { ...value, ...updated } : value); await refresh(); }}
        onPin={async pinned => { if (!conversation) return; const updated = await client.conversationUpdate(conversation.id, { pinned }); setConversation(value => value && value.id === updated.id ? { ...value, ...updated } : value); await refresh(); }}
        onArchive={async () => { if (!conversation) return; await client.conversationUpdate(conversation.id, { archived: true }); await openConversation(); await refresh(); }}
        onDelete={async () => { if (!conversation) return; await client.conversationDelete(conversation.id); await openConversation(); await refresh(); }} />}
    {!settingsSection && <HomeDrawer open={drawerOpen} conversations={cloud ? cloudChats : conversations} selectedId={conversation?.id} destination={tab} onClose={() => setDrawerOpen(false)}
        onNavigate={destination => { setDrawerOpen(false); navigate(destination); }}
        onConversation={id => { if (cloud) { setDrawerOpen(false); router.push(`/session/${id}`); return; } void perform(() => openConversation(id)); }} onNew={() => void perform(() => openConversation())}
        onMine={() => { setDrawerOpen(false); navigate('mine'); }} />}
    </View>;
}

/** A project's name from its goal: its first sentence, short enough to read as a name. */
function projectNameOf(goal: string): string {
    const first = goal.split(/[\n。！？!?]/)[0]?.trim() || goal.trim();
    return [...first].slice(0, 24).join('');
}
