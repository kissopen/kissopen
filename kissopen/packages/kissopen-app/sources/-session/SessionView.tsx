import { AgentContentView } from '@/components/AgentContentView';
import { MobileGlassBackdrop } from '@/components/MobileGlass';
import { AgentGoalBar, type AgentGoalAction } from '@/components/AgentGoalBar';
import { AgentQuestionBanner } from '@/components/AgentQuestionBanner';
import { AgentInput } from '@/components/AgentInput';
import { resolveVisibleAgentGoalStatus } from '@/components/agentGoalStatus';
import { layout } from '@/components/layout';
import { ChatHeaderView } from '@/components/ChatHeaderView';
import { ChatList } from '@/components/ChatList';
import { Deferred } from '@/components/Deferred';
import { EmptyMessages } from '@/components/EmptyMessages';
import { Avatar } from '@/components/Avatar';
import { VoiceAssistantStatusBar, VOICE_PILL_TOTAL_HEIGHT } from '@/components/VoiceAssistantStatusBar';
import { useSessionVisibility } from '@/hooks/useSessionVisibility';
import { Modal } from '@/modal';
import { sessionGoalAction, spawnSideChat, sessionKill, sessionArchive } from '@/sync/ops';
import { storage, useIsDataReady, useLocalSetting, useRealtimeStatus, useSessionGitStatus, useSessionMessages, useSessionAvatar, useSetting, useSideChatSessions } from '@/sync/storage';
import { useSession } from '@/sync/storage';
import { getSessionForkSource } from '@/utils/sessionFork';
import { useKissopenAction } from '@/hooks/useKissopenAction';
import { KissopenError } from '@/utils/errors';
import { Session } from '@/sync/storageTypes';
import { sync } from '@/sync/sync';
import { t } from '@/text';
import { isRunningOnMac } from '@/utils/platform';
import { useDeviceType, useHeaderHeight, useIsLandscape, useIsTablet } from '@/utils/responsive';
import { resolveSessionGitPresentation } from '@/utils/sessionGitPresentation';
import { FilesSidebar, SidebarMode } from '@/components/FilesSidebar';
import { AllFilesDiffView } from '@/components/AllFilesDiffView';
import { FileViewPanel } from '@/components/FileViewPanel';
import { GitFileStatus } from '@/sync/gitStatusFiles';
import { useOverlayNav } from '@/-session/sessionOverlayNav';
import { formatPathRelativeToHome, getResumeCommandBlock, getSessionAvatarId, getSessionName, useSessionStatus } from '@/utils/sessionUtils';
import { useSessionQuickActions } from '@/hooks/useSessionQuickActions';
import { isVersionSupported, MINIMUM_CLI_VERSION } from '@/utils/versionUtils';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as React from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { performAgentGoalAction } from './agentGoalActionHandler';
import { SessionComposer } from './SessionComposer';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import {
    isRigMetadata,
    rigCanAbort,
    rigCanBrowseFiles,
    rigCanReadFiles,
    rigCanUseShell,
} from '@/sync/rig';
import { RigActivityBar } from '@/components/RigActivityBar';
import { AnimatedFade } from '@/components/AnimatedOverlay';

export const SessionView = React.memo((props: { id: string }) => {
    const sessionId = props.id;
    const router = useRouter();
    const isFocused = useIsFocused();
    const session = useSession(sessionId);
    const avatar = useSessionAvatar(sessionId);
    const gitStatus = useSessionGitStatus(sessionId);
    const headerGit = React.useMemo(
        () => resolveSessionGitPresentation(session?.metadata, gitStatus),
        [session?.metadata, gitStatus],
    );
    const isDataReady = useIsDataReady();
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const isLandscape = useIsLandscape();
    const deviceType = useDeviceType();
    const headerHeight = useHeaderHeight();
    const mobileHeaderHeight = deviceType === 'phone' && Platform.OS !== 'web'
        ? Math.max(headerHeight, MOBILE_GLASS_HEADER_HEIGHT)
        : headerHeight;
    const contentRunsUnderHeader = deviceType === 'phone'
        && Platform.OS !== 'web'
        && !isLandscape;
    const realtimeStatus = useRealtimeStatus();
    const isTablet = useIsTablet();
    const { width: windowWidth } = useWindowDimensions();
    const fileDiffsSidebarEnabled = useSetting('fileDiffsSidebar');
    const zenMode = useLocalSetting('zenMode');
    const [headerBackdropVisible, setHeaderBackdropVisible] = React.useState(false);

    React.useEffect(() => {
        setHeaderBackdropVisible(false);
    }, [sessionId]);

    // Base condition: can we show the diff sidebar at all?
    const canShowSidebar = fileDiffsSidebarEnabled
        && (isRunningOnMac() || Platform.OS === 'web')
        && windowWidth >= SIDEBAR_MIN_WINDOW_WIDTH
        && (!session || (rigCanBrowseFiles(session.metadata) && rigCanUseShell(session.metadata)))
        && isDataReady && !!session;

    const showSidebar = canShowSidebar && !zenMode;

    // Match left sidebar width: 30% of window, clamped to 250–360px
    const sidebarWidth = Math.min(Math.max(Math.floor(windowWidth * 0.3), 250), 360);

    // Animate diff sidebar width.
    //
    // On web we snap the value (duration: 0). The animated `width` change
    // triggers a flex-row reflow on every frame, which in turn re-measures
    // the entire chat tree (FlatList rows, message blocks). At ~60fps that
    // grinds to ~15fps on dev builds. Snapping skips the layout thrash —
    // the chat reflows once instead of 60 times. Native keeps the smooth
    // animation because it runs on Reanimated's UI thread.
    const sidebarAnim = useSharedValue(showSidebar ? 1 : 0);
    React.useEffect(() => {
        sidebarAnim.value = withTiming(showSidebar ? 1 : 0, {
            duration: Platform.OS === 'web' ? 0 : 250,
            easing: Easing.out(Easing.cubic),
        });
    }, [showSidebar]);
    const animatedSidebarStyle = useAnimatedStyle(() => ({
        width: sidebarAnim.value * sidebarWidth,
        opacity: sidebarAnim.value,
        overflow: 'hidden' as const,
    }));

    // Sidebar panels are user-managed and persisted in local settings so the
    // layout (which panels are open + which is active) survives reloads and
    // long absences. State is device-local, shared across sessions.
    const sidebarPanelsOpen = useLocalSetting('sidebarPanelsOpen') as SidebarMode[];
    const sidebarPanelActiveRaw = useLocalSetting('sidebarPanelActive') as SidebarMode | null;
    // Guard against an inconsistent persisted value: the active panel must be
    // one of the open panels, otherwise fall back to the last opened (or none).
    const sidebarPanelActive = React.useMemo<SidebarMode | null>(() => {
        if (sidebarPanelActiveRaw && sidebarPanelsOpen.includes(sidebarPanelActiveRaw)) {
            return sidebarPanelActiveRaw;
        }
        return sidebarPanelsOpen[sidebarPanelsOpen.length - 1] ?? null;
    }, [sidebarPanelActiveRaw, sidebarPanelsOpen]);

    const openSidebarPanel = React.useCallback((panel: SidebarMode) => {
        const cur = storage.getState().localSettings.sidebarPanelsOpen as SidebarMode[];
        const open = cur.includes(panel) ? cur : [...cur, panel];
        storage.getState().applyLocalSettings({ sidebarPanelsOpen: open, sidebarPanelActive: panel });
    }, []);
    const selectSidebarPanel = React.useCallback((panel: SidebarMode) => {
        const cur = storage.getState().localSettings.sidebarPanelsOpen as SidebarMode[];
        if (cur.includes(panel)) {
            storage.getState().applyLocalSettings({ sidebarPanelActive: panel });
        }
    }, []);
    // Raw panel removal (no side-chat teardown). Public closeSidebarPanel below
    // wraps this so closing the "Side chat" chip also tears down its children.
    const removeSidebarPanel = React.useCallback((panel: SidebarMode) => {
        const state = storage.getState().localSettings;
        const open = (state.sidebarPanelsOpen as SidebarMode[]).filter((p) => p !== panel);
        const active = state.sidebarPanelActive === panel
            ? (open[open.length - 1] ?? null)
            : (state.sidebarPanelActive as SidebarMode | null);
        storage.getState().applyLocalSettings({ sidebarPanelsOpen: open, sidebarPanelActive: active });
    }, []);

    // Side chats live inside the single "sideChat" panel as switchable tabs.
    // Creation is unified into the sidebar panel picker (the top "+") so there
    // is no separate per-tab add button. Which side chat is focused lives here
    // (not in the panel) so the picker can create-and-focus a new one in one go.
    const rawSideChats = useSideChatSessions(sessionId);
    const sideChatForkSource = session ? getSessionForkSource(session) : null;
    const [activeSideChatId, setActiveSideChatId] = React.useState<string | null>(null);
    // Optimistically hide a side chat the instant it's closed. The server's
    // /archive only flips active=false (not lifecycleState), so if the CLI is
    // already dead the fallback archive wouldn't drop the tab via
    // useSideChatSessions — this makes the tab disappear immediately regardless.
    const [closedSideChatIds, setClosedSideChatIds] = React.useState<Set<string>>(() => new Set());
    const sideChats = React.useMemo(
        () => rawSideChats.filter((s) => !closedSideChatIds.has(s.id)),
        [rawSideChats, closedSideChatIds],
    );
    // Prune closed ids once the underlying sessions actually leave the store, so
    // the set can't grow without bound.
    React.useEffect(() => {
        setClosedSideChatIds((prev) => {
            if (prev.size === 0) return prev;
            const live = new Set(rawSideChats.map((s) => s.id));
            const next = new Set<string>();
            let changed = false;
            prev.forEach((id) => { if (live.has(id)) next.add(id); else changed = true; });
            return changed ? next : prev;
        });
    }, [rawSideChats]);

    // Best-effort close: kill the agent, fall back to server-side archive.
    const archiveSideChatSession = React.useCallback((id: string) => {
        (async () => {
            const killed = await sessionKill(id);
            if (!killed.success) {
                await sessionArchive(id);
            }
            try {
                await sync.refreshSessions();
            } catch {
                // Broadcast sync reconciles shortly even if this flaked.
            }
        })();
    }, []);

    const [creatingSideChat, createSideChat] = useKissopenAction(async () => {
        if (!sideChatForkSource) {
            throw new KissopenError(t('sideChat.unavailable'), false);
        }
        const result = await spawnSideChat(sideChatForkSource);
        if (result.type === 'error') {
            throw new KissopenError(result.errorMessage, true);
        }
        if (result.type === 'success') {
            setActiveSideChatId(result.sessionId);
            openSidebarPanel('sideChat');
        }
    });

    const closeSideChat = React.useCallback((id: string) => {
        const idx = sideChats.findIndex((s) => s.id === id);
        const neighbour = idx !== -1 ? (sideChats[idx - 1] ?? sideChats[idx + 1] ?? null) : null;
        setActiveSideChatId(neighbour?.id ?? null);
        setClosedSideChatIds((prev) => new Set(prev).add(id));
        if (!neighbour) {
            removeSidebarPanel('sideChat');
        }
        archiveSideChatSession(id);
    }, [sideChats, removeSidebarPanel, archiveSideChatSession]);

    // Closing the "Side chat" panel chip tears down every side chat at once.
    const closeAllSideChats = React.useCallback(() => {
        const ids = sideChats.map((s) => s.id);
        setActiveSideChatId(null);
        setClosedSideChatIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });
        removeSidebarPanel('sideChat');
        ids.forEach(archiveSideChatSession);
    }, [sideChats, removeSidebarPanel, archiveSideChatSession]);

    const closeSidebarPanel = React.useCallback((panel: SidebarMode) => {
        if (panel === 'sideChat') {
            closeAllSideChats();
            return;
        }
        removeSidebarPanel(panel);
    }, [closeAllSideChats, removeSidebarPanel]);

    // Overlay state is managed as a browser-style history stack so the
    // sidebar's back / forward arrows can navigate between chat ↔ diff ↔ file
    // without a per-overlay close button. Stack + cursor live in one piece
    // of state so functional updates stay coordinated.
    type OverlayEntry =
        | { kind: 'none' }
        | { kind: 'diff'; file: string }
        | { kind: 'file'; path: string };
    const [overlayHistory, setOverlayHistory] = React.useState<{ stack: OverlayEntry[]; cursor: number }>(
        { stack: [{ kind: 'none' }], cursor: 0 }
    );
    const overlayCurrent = overlayHistory.stack[overlayHistory.cursor] ?? { kind: 'none' };
    const diffViewOpen = overlayCurrent.kind === 'diff';
    const fileViewPath = overlayCurrent.kind === 'file' ? overlayCurrent.path : null;
    const scrollToFile = overlayCurrent.kind === 'diff' ? overlayCurrent.file : null;

    const pushOverlay = React.useCallback((entry: OverlayEntry) => {
        setOverlayHistory((prev) => {
            const truncated = prev.stack.slice(0, prev.cursor + 1);
            truncated.push(entry);
            return { stack: truncated, cursor: truncated.length - 1 };
        });
    }, []);

    const handleSidebarFilePress = React.useCallback((file: GitFileStatus) => {
        if (file.status === 'deleted') return;
        pushOverlay({ kind: 'diff', file: file.fullPath });
    }, [pushOverlay]);
    const handleAllFilesFilePress = React.useCallback((filePath: string) => {
        pushOverlay({ kind: 'file', path: filePath });
    }, [pushOverlay]);

    // When sidebar capability is lost (screen too narrow, disabled), close views.
    // Don't close on zen mode toggle — keep the view visible.
    React.useEffect(() => {
        if (!canShowSidebar) {
            setOverlayHistory({ stack: [{ kind: 'none' }], cursor: 0 });
        }
    }, [canShowSidebar]);

    // Right-side header content published by the active overlay (diff toggle / save button).
    const [headerRightSlot, setHeaderRightSlot] = React.useState<React.ReactNode>(null);

    // Wire intra-session back / forward into the global SidebarNavigator arrows.
    const canOverlayBack = overlayHistory.cursor > 0;
    const canOverlayForward = overlayHistory.cursor < overlayHistory.stack.length - 1;
    useFocusEffect(React.useCallback(() => {
        const controls = {
            canBack: canOverlayBack,
            canForward: canOverlayForward,
            back: () => {
                if (!canOverlayBack) return false;
                setOverlayHistory((prev) => (
                    prev.cursor <= 0 ? prev : { ...prev, cursor: prev.cursor - 1 }
                ));
                return true;
            },
            forward: () => {
                if (!canOverlayForward) return false;
                setOverlayHistory((prev) => (
                    prev.cursor >= prev.stack.length - 1 ? prev : { ...prev, cursor: prev.cursor + 1 }
                ));
                return true;
            },
        };
        useOverlayNav.getState().publish(controls);
        return () => {
            if (useOverlayNav.getState().back === controls.back) {
                useOverlayNav.getState().reset();
            }
        };
    }, [canOverlayBack, canOverlayForward]));

    // Compute header props based on session state
    const headerProps = useMemo(() => {
        if (!isDataReady) {
            return { title: '', isConnected: false };
        }
        if (!session) {
            return { title: t('errors.sessionDeleted'), isConnected: false };
        }
        const isConnected = session.presence === 'online';
        const sessionName = getSessionName(session);
        return {
            title: sessionName,
            isConnected,
        };
    }, [session, isDataReady]);
    const headerRight = session && deviceType === 'phone' && Platform.OS !== 'web'
        ? (
            <Pressable
                onPress={() => router.push(`/session/${sessionId}/info`)}
                hitSlop={10}
            >
                <Avatar
                    bot={!!session.metadata?.bot}
                    id={getSessionAvatarId(session)}
                    size={28}
                    monochrome={!headerProps.isConnected}
                    flavor={session.metadata?.flavor}
                    clientId={session.metadata?.client?.id}
                    badgeLocation="sessionHeader"
                    imageUrl={avatar?.uri}
                    thumbhash={avatar?.thumbhash}
                />
            </Pressable>
        )
        : null;

    const mainContent = (
        <>
            <MobileGlassBackdrop enabled={deviceType === 'phone' && Platform.OS !== 'web'} />
            {/* Status bar shadow for landscape mode */}
            {isLandscape && deviceType === 'phone' && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: safeArea.top,
                    backgroundColor: theme.colors.surface,
                    zIndex: 1000,
                    shadowColor: theme.colors.shadow.color,
                    shadowOffset: {
                        width: 0,
                        height: 2,
                    },
                    shadowOpacity: theme.colors.shadow.opacity,
                    shadowRadius: 3,
                    elevation: 5,
                }} />
            )}

            {/* Content based on state */}
            <View
                style={{
                    flex: 1,
                    paddingTop: !(isLandscape && deviceType === 'phone' && Platform.OS !== 'web')
                        ? contentRunsUnderHeader
                            ? 0
                            : safeArea.top + mobileHeaderHeight + (!isTablet && realtimeStatus !== 'disconnected' ? VOICE_PILL_TOTAL_HEIGHT : 0)
                        : 0,
                }}
            >
                {!isDataReady ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                ) : !session ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="trash-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.text, fontSize: 20, marginTop: 16, fontWeight: '600' }}>{t('errors.sessionDeleted')}</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>{t('errors.sessionDeletedDescription')}</Text>
                    </View>
                ) : (
                    <SessionViewLoaded
                        key={sessionId}
                        sessionId={sessionId}
                        session={session}
                        active={isFocused}
                        onHeaderBackdropVisibilityChange={contentRunsUnderHeader
                            ? setHeaderBackdropVisible
                            : undefined}
                    />
                )}
            </View>

            {/* Render the overlay header after the dynamic list so native blur samples its content. */}
            {!(isLandscape && deviceType === 'phone' && Platform.OS !== 'web') && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000
                }}>
                    <ChatHeaderView
                        title={headerProps.title}
                        subtitle={session && isDataReady ? headerGit.subtitle : undefined}
                        gitChanges={session && isDataReady ? headerGit.changes : null}
                        backdropVisible={headerBackdropVisible}
                        extraPathSegment={fileViewPath ?? undefined}
                        rightSlot={(diffViewOpen || !!fileViewPath) ? headerRightSlot : headerRight}
                        onTitlePress={session ? () => router.push(`/session/${sessionId}/info`) : undefined}
                        onBackPress={() => router.back()}
                    />
                    {/* Voice status bar below header - not on tablet (shown in sidebar) */}
                    {!isTablet && realtimeStatus !== 'disconnected' && (
                        <VoiceAssistantStatusBar variant="full" />
                    )}
                </View>
            )}
        </>
    );

    if (!canShowSidebar) {
        return mainContent;
    }

    // Desktop layout: chat + animated sidebar at the same level (full height).
    // When a sidebar file is selected, InlineFileDiff overlays the main content
    // (chat stays mounted underneath so state is preserved).
    return (
        <View style={{ flex: 1, flexDirection: 'row' }}>
            <View
                style={{
                    flex: 1,
                    // Web-only: isolate the chat subtree's layout from the
                    // parent flex-row. If we ever bring back a width
                    // animation on the right sidebar, `contain` prevents
                    // layout work from leaking up to the chat tree on
                    // every frame.
                    ...(Platform.OS === 'web' ? { contain: 'layout style paint' as any } : {}),
                }}
            >
                {mainContent}
                {diffViewOpen && canShowSidebar && (
                    <View
                        pointerEvents="box-none"
                        style={{
                            position: 'absolute',
                            top: safeArea.top + mobileHeaderHeight,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: theme.colors.surface,
                        }}
                    >
                        <AllFilesDiffView
                            sessionId={sessionId}
                            scrollToFile={scrollToFile}
                            onHeaderRightSlotChange={setHeaderRightSlot}
                        />
                    </View>
                )}
                {fileViewPath && canShowSidebar && (
                    <View
                        pointerEvents="box-none"
                        style={{
                            position: 'absolute',
                            top: safeArea.top + mobileHeaderHeight,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: theme.colors.surface,
                        }}
                    >
                        <FileViewPanel
                            sessionId={sessionId}
                            filePath={fileViewPath}
                            onHeaderRightSlotChange={setHeaderRightSlot}
                        />
                    </View>
                )}
            </View>
            <Animated.View style={[{ minWidth: 0, alignSelf: 'stretch' }, animatedSidebarStyle]}>
                <View style={{ width: sidebarWidth, flex: 1 }}>
                    <FilesSidebar
                        sessionId={sessionId}
                        selectedPath={sidebarPanelActive === 'changes' ? scrollToFile : sidebarPanelActive === 'allFiles' ? fileViewPath : null}
                        onFilePress={handleSidebarFilePress}
                        openPanels={sidebarPanelsOpen}
                        activePanel={sidebarPanelActive}
                        onOpenPanel={openSidebarPanel}
                        onSelectPanel={selectSidebarPanel}
                        onClosePanel={closeSidebarPanel}
                        onAllFilesFilePress={handleAllFilesFilePress}
                        sideChats={sideChats}
                        activeSideChatId={activeSideChatId}
                        onSelectSideChat={setActiveSideChatId}
                        onCloseSideChat={closeSideChat}
                        onCreateSideChat={createSideChat}
                        canCreateSideChat={!!sideChatForkSource}
                        creatingSideChat={creatingSideChat}
                    />
                </View>
            </Animated.View>
        </View>
    );
});

const SIDEBAR_MIN_WINDOW_WIDTH = 1100;

export function SessionViewLoaded({
    sessionId,
    session,
    active = true,
    embedded = false,
    onHeaderBackdropVisibilityChange,
}: {
    sessionId: string;
    session: Session;
    active?: boolean;
    embedded?: boolean;
    onHeaderBackdropVisibilityChange?: (visible: boolean) => void;
}) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const safeArea = useSafeAreaInsets();
    const isLandscape = useIsLandscape();
    const deviceType = useDeviceType();
    const isTablet = useIsTablet();
    // Only the portrait phone chat uses an overlay dock. Tablet, desktop,
    // landscape, and embedded views retain their existing split layout.
    const usesFloatingMobileDock = !embedded
        && deviceType === 'phone'
        && Platform.OS !== 'web'
        && !isRunningOnMac()
        && !isLandscape;
    const [bottomDockInset, setBottomDockInset] = React.useState(0);
    const [composerY, setComposerY] = React.useState(0);
    // Offset of the composer card inside AgentInput — the faded status rows
    // above it keep their space, so anchoring to the dock top floats the
    // scroll button over a visually empty band.
    const [composerCardOffset, setComposerCardOffset] = React.useState(0);
    const [isChatAtBottom, setIsChatAtBottom] = React.useState(true);
    const showBottomDockDetails = !usesFloatingMobileDock || isChatAtBottom;
    const scrollButtonInset = Math.max(0, bottomDockInset - composerY - composerCardOffset);

    const handleBottomDockInsetChange = React.useCallback((nextInset: number) => {
        setBottomDockInset((currentInset) => (
            Math.abs(currentInset - nextInset) < 1 ? currentInset : nextInset
        ));
    }, []);
    const handleComposerLayout = React.useCallback((event: LayoutChangeEvent) => {
        const nextY = Math.ceil(event.nativeEvent.layout.y);
        setComposerY((currentY) => (
            Math.abs(currentY - nextY) < 1 ? currentY : nextY
        ));
    }, []);
    const handleComposerCardOffsetChange = React.useCallback((offset: number) => {
        const nextOffset = Math.ceil(offset);
        setComposerCardOffset((currentOffset) => (
            Math.abs(currentOffset - nextOffset) < 1 ? currentOffset : nextOffset
        ));
    }, []);
    const handleChatBottomVisibilityChange = React.useCallback((visible: boolean) => {
        setIsChatAtBottom(visible);
    }, []);

    React.useEffect(() => {
        if (!usesFloatingMobileDock) {
            setBottomDockInset(0);
            setComposerY(0);
        }
    }, [usesFloatingMobileDock]);

    React.useEffect(() => {
        setIsChatAtBottom(true);
    }, [sessionId, usesFloatingMobileDock]);

    const realtimeStatus = useRealtimeStatus();
    const { messages, isLoaded } = useSessionMessages(sessionId);
    const acknowledgedCliVersions = useLocalSetting('acknowledgedCliVersions');
    const zenMode = useLocalSetting('zenMode');
    const sessionInputHorizontalPadding = Platform.OS === 'web' || isRunningOnMac() || isTablet ? 12 : 8;
    const chatListTopContentInset = embedded || (isLandscape && deviceType === 'phone')
        ? 12
        : deviceType === 'phone' && Platform.OS !== 'web'
            ? safeArea.top
                + MOBILE_GLASS_HEADER_HEIGHT
                + (realtimeStatus !== 'disconnected' ? VOICE_PILL_TOTAL_HEIGHT : 0)
                + 12
            : undefined;

    // Check if CLI version is outdated and not already acknowledged
    const cliVersion = session.metadata?.version;
    const machineId = session.metadata?.machineId;
    const isCliOutdated = cliVersion && !isVersionSupported(cliVersion, MINIMUM_CLI_VERSION);
    const isAcknowledged = machineId && acknowledgedCliVersions[machineId] === cliVersion;
    const shouldShowCliWarning = isCliOutdated && !isAcknowledged;
    const flavor = session.metadata?.flavor;
    const isRig = isRigMetadata(session.metadata);
    // What the composer may offer is the session's own answer, derived once and
    // shared: the home's welcome page writes to a bot's session through the
    // same controls, and two copies of this would drift apart.
    const sessionStatus = useSessionStatus(session);
    const experiments = useSetting('experiments');
    const { canResume, resumeSession, resumingSession } = useSessionQuickActions(session);
    const isDisconnected = !sessionStatus.isConnected;
    const resumeCommandBlock = getResumeCommandBlock(session);

    // Handle dismissing CLI version warning
    const handleDismissCliWarning = React.useCallback(() => {
        if (machineId && cliVersion) {
            storage.getState().applyLocalSettings({
                acknowledgedCliVersions: {
                    ...acknowledgedCliVersions,
                    [machineId]: cliVersion
                }
            });
        }
    }, [machineId, cliVersion, acknowledgedCliVersions]);

    // Function to update permission mode
    // Memoize header-dependent styles to prevent re-renders
    const headerDependentStyles = React.useMemo(() => ({
        contentContainer: {
            flex: 1
        },
        flatListStyle: {
            marginTop: 0 // No marginTop needed since header is handled by parent
        },
    }), []);

    const handleFileViewerPress = React.useCallback(() => {
        router.push(`/session/${sessionId}/files`);
    }, [router, sessionId]);

    const visibleAgentGoal = React.useMemo(() => (
        resolveVisibleAgentGoalStatus(session)
    ), [
        session.agentState?.agentGoalStatus,
        session.presence,
        session.metadata?.claudeSessionId,
        session.metadata?.codexThreadId,
    ]);
    const [goalActionInFlight, setGoalActionInFlight] = React.useState<AgentGoalAction | null>(null);
    const handleGoalAction = React.useCallback(async (action: AgentGoalAction) => {
        await performAgentGoalAction({
            action,
            currentGoalText: visibleAgentGoal?.text ?? '',
            promptEditGoal: (currentGoalText) => Modal.prompt(t('components.agentGoalBar.editGoal'), undefined, {
                placeholder: t('components.agentGoalBar.currentGoal'),
                defaultValue: currentGoalText,
                cancelText: t('common.cancel'),
                confirmText: t('common.save'),
            }),
            dispatchGoalAction: (nextAction, objective) => sessionGoalAction(sessionId, nextAction, objective),
            setInFlight: setGoalActionInFlight,
            onError: (error) => console.error('Failed to perform goal action', error),
        });
    }, [sessionId, visibleAgentGoal?.text]);

    useSessionVisibility(sessionId, active, embedded, realtimeStatus);

    let content = (
        <>
            <Deferred>
                {messages.length > 0 && (
                    <ChatList
                        session={session}
                        active={active}
                        topContentInset={chatListTopContentInset}
                        bottomContentInset={usesFloatingMobileDock ? bottomDockInset : undefined}
                        scrollButtonInset={usesFloatingMobileDock ? scrollButtonInset : undefined}
                        headerOverlayHeight={safeArea.top + MOBILE_GLASS_HEADER_HEIGHT}
                        onHeaderBackdropVisibilityChange={onHeaderBackdropVisibilityChange}
                        onBottomDockVisibilityChange={usesFloatingMobileDock
                            ? handleChatBottomVisibilityChange
                            : undefined}
                    />
                )}
            </Deferred>
        </>
    );
    const placeholder = messages.length === 0 ? (
        <>
            {isLoaded ? (
                <EmptyMessages session={session} />
            ) : (
                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            )}
        </>
    ) : null;

    // The composer is one component shared with the home's welcome page, which
    // writes into a bot's session through it. Everything it offers it reads
    // from the session itself; what is left here is what belongs to this
    // screen — its dock measurement, its file panel, and whether it owns the
    // window at all.
    const composer = (
        <View onLayout={usesFloatingMobileDock ? handleComposerLayout : undefined}>
            <SessionComposer
                sessionId={sessionId}
                embedded={embedded}
                showStatusDetails={showBottomDockDetails}
                onFileViewerPress={experiments && !isTablet && rigCanBrowseFiles(session.metadata) && rigCanReadFiles(session.metadata) ? handleFileViewerPress : undefined}
                onActionAreaOffsetChange={usesFloatingMobileDock ? handleComposerCardOffsetChange : undefined}
            />
        </View>
    );

    // Disconnected sessions get the full Resume affordance regardless of
    // whether they were explicitly archived or just lost their CLI (e.g.
    // Ctrl-C in terminal — lifecycleState stays 'running', server flips
    // active=false). InactiveArchivedHint handles both cases: shows the
    // Resume button when canResume is true, falls back to the
    // copy-this-command hint when the daemon is incompatible or the machine
    // isn't reachable.
    const inactiveHint = isDisconnected && !isRig ? (
        <AnimatedFade visible={showBottomDockDetails}>
            <CenteredInputWidth horizontalPadding={sessionInputHorizontalPadding}>
                <InactiveArchivedHint
                    resumeCommandBlock={resumeCommandBlock}
                    canResume={canResume}
                    resuming={resumingSession}
                    onResume={resumeSession}
                />
            </CenteredInputWidth>
        </AnimatedFade>
    ) : null;

    const input = (
        <>
            {inactiveHint}
            {visibleAgentGoal && (
                <AnimatedFade visible={showBottomDockDetails}>
                    <CenteredInputWidth horizontalPadding={sessionInputHorizontalPadding}>
                        <AgentGoalBar
                            goal={visibleAgentGoal}
                            onAction={handleGoalAction}
                            inFlightAction={goalActionInFlight}
                        />
                    </CenteredInputWidth>
                </AnimatedFade>
            )}
            <AnimatedFade visible={showBottomDockDetails}>
                <CenteredInputWidth horizontalPadding={sessionInputHorizontalPadding}>
                    <AgentQuestionBanner sessionId={sessionId} />
                </CenteredInputWidth>
            </AnimatedFade>
            <AnimatedFade visible={showBottomDockDetails}>
                <RigActivityBar metadata={session.metadata} />
            </AnimatedFade>
            {composer}
        </>
    );


    return (
        <>
            {/* CLI Version Warning Overlay - Subtle centered pill */}
            {shouldShowCliWarning && !(isLandscape && deviceType === 'phone') && (
                <Pressable
                    onPress={handleDismissCliWarning}
                    style={{
                        position: 'absolute',
                        top: 8, // Position at top of content area (padding handled by parent)
                        alignSelf: 'center',
                        backgroundColor: '#FFF3CD',
                        borderRadius: 100, // Fully rounded pill
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                        zIndex: 998, // Below voice bar but above content
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 4,
                    }}
                >
                    <Ionicons name="warning-outline" size={14} color="#FF9500" style={{ marginRight: 6 }} />
                    <Text style={{
                        fontSize: 12,
                        color: '#856404',
                        fontWeight: '600'
                    }}>
                        {t('sessionInfo.cliVersionOutdated')}
                    </Text>
                    <Ionicons name="close" size={14} color="#856404" style={{ marginLeft: 8 }} />
                </Pressable>
            )}

            {/* Main content area - no padding since header is overlay */}
            <View style={{
                flexBasis: 0,
                flexGrow: 1,
                // The floating chat content reaches the physical bottom of
                // the screen. AgentContentView keeps the dock itself above
                // the home indicator / navigation area.
                paddingBottom: usesFloatingMobileDock
                    ? 0
                    : safeArea.bottom + ((isRunningOnMac() || Platform.OS === 'web') ? 8 : 0),
            }}>
                <AgentContentView
                    content={content}
                    input={input}
                    placeholder={placeholder}
                    floatingDock={usesFloatingMobileDock}
                    onDockInsetChange={handleBottomDockInsetChange}
                />
            </View >

            {/* Back button for landscape phone mode when header is hidden */}
            {
                isLandscape && deviceType === 'phone' && (
                    <Pressable
                        onPress={() => router.back()}
                        style={{
                            position: 'absolute',
                            top: safeArea.top + 8,
                            left: 16,
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: `rgba(${theme.dark ? '28, 23, 28' : '255, 255, 255'}, 0.9)`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...Platform.select({
                                ios: {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                },
                                android: {
                                    elevation: 2,
                                }
                            }),
                        }}
                        hitSlop={15}
                    >
                        <Ionicons
                            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                            size={Platform.select({ ios: 28, default: 24 })}
                            color="#000"
                        />
                    </Pressable>
                )
            }
        </>
    )
}

function InactiveArchivedHint(props: {
    resumeCommandBlock: NonNullable<ReturnType<typeof getResumeCommandBlock>> | null;
    canResume: boolean;
    resuming: boolean;
    onResume: () => void;
}) {
    const { theme } = useUnistyles();
    const hintTextStyle = {
        color: theme.colors.agentEventText,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'left' as const,
    };

    return (
        <View style={{
            paddingTop: 12,
            paddingBottom: 10,
            gap: 10,
            alignItems: 'stretch',
        }}>
            <View style={{ paddingHorizontal: 8, gap: 4 }}>
                <Text style={hintTextStyle}>
                    {t('session.inactiveArchived')}
                </Text>
                {props.canResume ? null : props.resumeCommandBlock && (
                    <Text style={hintTextStyle}>
                        {t('session.resumeFromTerminal')}
                    </Text>
                )}
            </View>
            {props.canResume ? (
                <Pressable
                    onPress={props.onResume}
                    disabled={props.resuming}
                    style={({ pressed }) => ({
                        height: Platform.select({ web: 40, default: 44 }),
                        borderRadius: Platform.select({ web: 10, default: 18 }),
                        backgroundColor: Platform.select({
                            web: theme.colors.button.primary.background,
                            default: pressed ? theme.colors.surfacePressed : theme.colors.surfaceHigh,
                        }),
                        borderWidth: Platform.select({ web: 0, default: StyleSheet.hairlineWidth }),
                        borderColor: theme.colors.divider,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: props.resuming ? 0.6 : Platform.OS === 'web' && pressed ? 0.8 : 1,
                        marginHorizontal: 8,
                    })}
                >
                    {props.resuming ? (
                        <ActivityIndicator size="small" color={Platform.select({ web: theme.colors.button.primary.tint, default: theme.colors.text })} />
                    ) : (
                        <Text style={{ color: Platform.select({ web: theme.colors.button.primary.tint, default: theme.colors.text }), fontSize: 15, fontWeight: '600' }}>
                            {t('sessionInfo.resumeSession')}
                        </Text>
                    )}
                </Pressable>
            ) : props.resumeCommandBlock && (
                <ResumeCommandCopyBlock resumeCommandBlock={props.resumeCommandBlock} />
            )}
        </View>
    );
}

function ResumeCommandCopyBlock({ resumeCommandBlock }: {
    resumeCommandBlock: NonNullable<ReturnType<typeof getResumeCommandBlock>>;
}) {
    const { theme } = useUnistyles();
    const [copied, setCopied] = React.useState(false);

    return (
        <Pressable
            onPress={async () => {
                await Clipboard.setStringAsync(resumeCommandBlock.copyText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: Platform.select({ web: 14, default: 18 }),
                backgroundColor: Platform.select({
                    web: theme.colors.surfaceHigh,
                    default: pressed ? theme.colors.surfacePressed : theme.colors.surface,
                }),
                borderWidth: Platform.select({ web: 0, default: StyleSheet.hairlineWidth }),
                borderColor: theme.colors.divider,
                flexDirection: 'row',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                alignItems: 'flex-start',
            })}
        >
            <View style={{ flex: 1 }}>
                {resumeCommandBlock.lines.map((line, index) => (
                    <Text
                        key={`${line}-${index}`}
                        style={{
                            color: theme.colors.text,
                            fontSize: 13,
                            lineHeight: 18,
                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        }}
                    >
                        {line}
                    </Text>
                ))}
            </View>
            <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copied ? '#30D158' : theme.colors.textSecondary}
                style={{ marginTop: 1 }}
            />
        </Pressable>
    );
}

function CenteredInputWidth(props: {
    children: React.ReactNode;
    horizontalPadding: number;
}) {
    return (
        <View style={{
            width: '100%',
            paddingHorizontal: props.horizontalPadding,
            alignItems: 'center',
        }}>
            <View style={{
                width: '100%',
                maxWidth: layout.maxWidth,
            }}>
                {props.children}
            </View>
        </View>
    );
}
