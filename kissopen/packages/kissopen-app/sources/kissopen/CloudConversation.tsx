import { TemporaryChatIcon } from './TemporaryChatIcon';
import { sinceOf } from './projectTime';
import * as React from 'react';
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AgentContentView } from '@/components/AgentContentView';
import { AnimatedFade } from '@/components/AnimatedOverlay';
import { MessageView } from '@/components/MessageView';
import { MobileGlassBackdrop } from '@/components/MobileGlass';
import { Typography } from '@/constants/Typography';
import { isRunningOnMac } from '@/utils/platform';
import { useIsLandscape } from '@/utils/responsive';
import type { ConversationDetail, FileItem, Job } from './api/types';
import { cloudMessages } from './cloudMessages';
import { CloudDrawing, CloudMessageImages } from './CloudMessageImages';
import { t } from '@/text';
import { SessionComposer, type SessionComposerHandle } from '@/-session/SessionComposer';
import { JuanThinking } from './JuanThinking';

export function CloudConversation(props: {
    /**
     * The bot session the composer reads its models, permissions and
     * completions from. Absent until the account's workspace has started:
     * the composer is the same one either way, with less to offer.
     */
    composerSessionId?: string;
    /** Starts the message as a new session instead of joining this one. */
    onSubmit?: (text: string) => Promise<boolean>;
    temporary?: boolean; conversation?: ConversationDetail; job?: Job; liveText: string; drawing?: boolean;
    attachments: string[]; files: FileItem[];
    /** Space the floating home chrome occupies above the transcript. */
    topInset: number;
    onHeaderBackdropVisibilityChange?: (visible: boolean) => void;
    reasoningEffort: 'auto' | 'low' | 'medium' | 'high';
    onReasoningEffort: (effort: 'auto' | 'low' | 'medium' | 'high') => void;
    onCamera: () => void; onPhotos: () => void; onAttach: () => void; onPlugins: () => void;
    onRemove: (id: string) => void;
    onHistory: () => void; onNew: () => void;
    /** Earlier conversations, newest first, shown while this one is still empty. */
    recent?: readonly { id: string; title: string; at?: number }[];
    onOpenRecent?: (id: string) => void;
    /**
     * Words another page handed over to be asked here — a card tapped on the
     * home page. Put into the composer rather than sent, so they can be read
     * and changed first; a new object puts them in again.
     */
    prefill?: { readonly text: string };
}) {
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const isLandscape = useIsLandscape();
    const list = React.useRef<FlatList>(null);
    const atBottom = React.useRef(true);
    const [showLatest, setShowLatest] = React.useState(false);
    const [atBottomVisible, setAtBottomVisible] = React.useState(true);
    const [dockInset, setDockInset] = React.useState(0);
    const [actionMenu, setActionMenu] = React.useState<'closed' | 'actions' | 'reasoning'>('closed');
    const messages = React.useMemo(() => cloudMessages(props.conversation, props.liveText), [props.conversation, props.liveText]);
    // The pictures each message carries, by message id; the text renderer
    // knows nothing of them, so they are drawn under it.
    const images = React.useMemo(() => new Map((props.conversation?.messages ?? []).map(message => [message.id, message.images])), [props.conversation]);
    // Portrait phones get the bot session's floating dock; landscape, web, and
    // Mac keep the plain stacked layout the same way SessionView does.
    const floatingDock = Platform.OS !== 'web' && !isRunningOnMac() && !isLandscape;
    React.useEffect(() => {
        atBottom.current = true; setShowLatest(false); setAtBottomVisible(true);
        props.onHeaderBackdropVisibilityChange?.(false);
    }, [props.conversation?.id]);
    const scrollToLatest = () => { atBottom.current = true; setShowLatest(false); setAtBottomVisible(true); list.current?.scrollToEnd({ animated: true }); };
    // Follow the tail only when the transcript itself grew. The content height
    // also moves whenever the dock resizes or the keyboard opens/closes, and
    // chasing those is what yanked the list back the moment a drag started.
    const contentHeight = React.useRef(0);
    const handleContentSizeChange = (_width: number, height: number) => {
        const grew = height > contentHeight.current;
        contentHeight.current = height;
        if (grew && atBottom.current) list.current?.scrollToEnd({ animated: false });
    };
    React.useEffect(() => { contentHeight.current = 0; }, [props.conversation?.id]);
    // Straight into the composer that is actually on screen. This used to go
    // through a ref the home held for an input of its own, which stopped being
    // attached to anything the moment the bot composer took over — so every
    // suggestion pressed on an account with a workspace went nowhere.
    const composerRef = React.useRef<SessionComposerHandle | null>(null);
    const chooseSuggestion = (text: string) => composerRef.current?.setMessage(text);
    React.useEffect(() => {
        if (props.prefill) composerRef.current?.setMessage(props.prefill.text);
    }, [props.prefill]);
    const runAction = (action: () => void) => {
        setActionMenu('closed');
        action();
    };
    const actions: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; action: () => void }[] = [
        { label: t('kissopen.conversation.camera'), icon: 'camera-outline', action: props.onCamera },
        { label: t('kissopen.conversation.photos'), icon: 'images-outline', action: props.onPhotos },
        { label: t('common.files'), icon: 'attach-outline', action: props.onAttach },
        { label: t('kissopen.nav.plugins'), icon: 'extension-puzzle-outline', action: props.onPlugins },
        { label: t('kissopen.conversation.reasoningEffort'), icon: 'speedometer-outline', action: () => setActionMenu('reasoning') },
    ];
    const efforts = [
        ['auto', t('kissopen.conversation.effortAuto'), t('kissopen.conversation.effortAutoDescription')],
        ['low', t('kissopen.conversation.effortFast'), t('kissopen.conversation.effortFastDescription')],
        ['medium', t('kissopen.conversation.effortStandard'), t('kissopen.conversation.effortStandardDescription')],
        ['high', t('kissopen.conversation.effortDeep'), t('kissopen.conversation.effortDeepDescription')],
    ] as const;

    const transcript = messages.length ? (
        <FlatList ref={list} data={messages} keyExtractor={item => item.id} style={styles.root}
            // flex-end is what puts the resting bottom of the transcript just
            // above the composer: the list now spans the whole screen, so a
            // short conversation would otherwise hang from the top with a gap
            // over the dock and nothing to scroll.
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: props.topInset + 12, paddingBottom: floatingDock ? dockInset + 16 : 16 }}
            keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            // No rubber-band when the whole conversation already fits, so a
            // short transcript reads as "nothing to scroll" rather than as a
            // scroll that snapped back.
            alwaysBounceVertical={false}
            onScroll={event => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 90;
                setShowLatest(!atBottom.current);
                setAtBottomVisible(atBottom.current);
                props.onHeaderBackdropVisibilityChange?.(contentOffset.y > 4);
            }} scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
            renderItem={({ item }) => <View><MessageView message={item} metadata={null} sessionId={`KISSOPEN-cloud:${props.conversation?.id || 'new'}`} copyText={item.kind === 'agent-text' ? item.text : undefined} onOptionPress={option => chooseSuggestion(option.title)} />{!!images.get(item.id)?.length && <CloudMessageImages images={images.get(item.id) ?? []} own={item.kind === 'user-text'} />}</View>}
            ListFooterComponent={props.job && props.drawing ? <CloudDrawing /> : props.job && !props.liveText ? <View style={styles.thinking}><JuanThinking label={t('kissopen.conversation.thinking')} /></View> : null}
        />
    ) : null;

    /*
     * With nothing said yet the chat tab is where a person finds their earlier
     * conversations: the recent ones, newest first, with the input below for a
     * new one. A temporary chat keeps its own note, which says what it is.
     */
    const now = Date.now();
    const placeholder = messages.length ? null : props.temporary ? (
        <View style={styles.empty}>
            <TemporaryChatIcon size={48} color={theme.colors.textSecondary} />
            <Text style={styles.tagline}>{t('kissopen.conversation.temporaryTitle')}</Text>
            <Text style={styles.caption}>{t('kissopen.conversation.temporarySubtitle')}</Text>
            <Text style={styles.caption}>{t('kissopen.conversation.temporaryUsageNote')}</Text>
        </View>
    ) : null;

    /*
     * The recent conversations are this screen's own content while nothing has
     * been said: a list the size of the screen, scrolled like the transcript
     * that replaces it, under the header and above the composer. As the
     * placeholder it sat in a scroll view that would not scroll.
     */
    const recentList = messages.length || props.temporary ? null : (
        <FlatList
            data={props.recent ?? []}
            keyExtractor={item => item.id}
            style={styles.root}
            contentContainerStyle={[styles.recent, { paddingTop: props.topInset + 8, paddingBottom: floatingDock ? dockInset + 16 : 16 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
            ListHeaderComponent={<Text style={styles.recentLabel} accessibilityRole="header">{t('kissopen.drawer.recentChats')}</Text>}
            ListEmptyComponent={<Text style={styles.recentEmpty}>{t('kissopen.conversation.recentEmpty')}</Text>}
            onScroll={event => props.onHeaderBackdropVisibilityChange?.(event.nativeEvent.contentOffset.y > 4)}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => props.onOpenRecent?.(item.id)}
                    style={({ pressed }) => [styles.recentRow, pressed && styles.recentPressed]}
                >
                    <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textSecondary} />
                    <Text numberOfLines={1} style={styles.recentTitle}>{item.title}</Text>
                    {item.at ? <Text style={styles.recentTime}>{sinceOf(item.at, now)}</Text> : null}
                </Pressable>
            )}
        />
    );

    const dock = <>
        {showLatest && <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.conversation.scrollToLatest')} style={styles.latest} onPress={scrollToLatest}><Ionicons name="arrow-down" size={18} color={theme.colors.text} /><Text style={styles.caption}>{t('kissopen.conversation.latestMessage')}</Text></Pressable>}
        {!!props.attachments.length && <AnimatedFade visible={atBottomVisible}>
            <View style={styles.attachments}>{props.attachments.map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={t('kissopen.conversation.removeAttachment', { name: props.files.find(file => file.id === id)?.name || t('kissopen.conversation.attachmentFallbackName') })} onPress={() => props.onRemove(id)} style={styles.attachment}><Ionicons name="document-text-outline" size={16} color={theme.colors.textSecondary} /><Text numberOfLines={1} style={styles.attachmentText}>{props.files.find(file => file.id === id)?.name || t('kissopen.conversation.attachmentFallbackName')}</Text><Ionicons name="close" size={16} color={theme.colors.textSecondary} /></Pressable>)}</View>
        </AnimatedFade>}
        {/* The bot's own composer, not a copy of it: same controls, same
            microphone, same completions, because it is the same component the
            session view carries — and, deliberately, with nothing wrapped
            around it. The session view hands its composer to the dock at full
            width and lets it set its own inset; the extra centred, padded box
            below is what made the home's input narrower than the one it hands
            you over to, so the bottom of the screen moved as you crossed. */}
        {/* Unconditional, and that is the point. This used to fall back to an
            AgentInput of its own whenever the account had no cloud workspace
            session to read from, which meant the same build showed two
            different composers depending on whose account was signed in. The
            composer is now the same control before the workspace exists as
            after; what changes is only what it has to offer, which it reads
            from the session it is or is not given. */}
        <SessionComposer handleRef={composerRef} sessionId={props.composerSessionId} onSubmit={props.onSubmit} />
    </>;

    return <View style={styles.root}>
        <MobileGlassBackdrop />
        {/* The same bottom the session view leaves, including the eight pixels
            it adds on web and Mac. A composer that sits lower here than in the
            session it hands you over to moves the moment you cross. */}
        <View style={[styles.root, { paddingBottom: floatingDock ? 0 : safeArea.bottom + ((isRunningOnMac() || Platform.OS === 'web') ? 8 : 0) }]}>
            <AgentContentView
                content={transcript ?? recentList}
                placeholder={placeholder}
                input={dock}
                floatingDock={floatingDock}
                onDockInsetChange={setDockInset}
            />
        </View>
        <Modal transparent visible={actionMenu !== 'closed'} animationType="fade" onRequestClose={() => setActionMenu('closed')}>
            <View style={styles.menuRoot}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.conversation.closeAddMenu')} style={styles.menuBackdrop} onPress={() => setActionMenu('closed')} />
                <View style={styles.menuPanel}>
                    {actionMenu === 'reasoning' ? <>
                        <View style={styles.menuHeader}><Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.menuBack} onPress={() => setActionMenu('actions')}><Ionicons name="chevron-back" size={22} color={theme.colors.text} /></Pressable><Text style={styles.menuTitle}>{t('kissopen.conversation.reasoningEffort')}</Text><View style={styles.menuBack} /></View>
                        {efforts.map(([value, label, detail]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: props.reasoningEffort === value }} style={styles.menuRow} onPress={() => { props.onReasoningEffort(value); setActionMenu('closed'); }}>
                            <View style={styles.menuIcon}><Ionicons name={value === 'high' ? 'sparkles-outline' : 'speedometer-outline'} size={24} color={theme.colors.text} /></View>
                            <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuDetail}>{detail}</Text></View>
                            {props.reasoningEffort === value && <Ionicons name="checkmark" size={22} color={theme.colors.text} />}
                        </Pressable>)}
                    </> : actions.map(item => <Pressable key={item.label} accessibilityRole="button" style={styles.menuRow} onPress={() => runAction(item.action)}>
                        <View style={styles.menuIcon}><Ionicons name={item.icon} size={25} color={theme.colors.text} /></View><Text style={styles.menuLabel}>{item.label}</Text>
                        {item.label === t('kissopen.conversation.reasoningEffort') && <Text style={styles.menuValue}>{efforts.find(([value]) => value === props.reasoningEffort)?.[1]}</Text>}
                    </Pressable>)}
                </View>
            </View>
        </Modal>
    </View>;
}
const styles = StyleSheet.create(theme => ({
    root: { flex: 1, minHeight: 0 },
    // Stretch, because AgentContentView centres the placeholder on the cross
    // axis. Without this the card is content-width and the percentage widths
    // below have no base to resolve against.
    empty: { alignSelf: 'stretch', alignItems: 'center', padding: 24 },
    recent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, gap: 2 },
    recentEmpty: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
    recentLabel: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4, marginBottom: 6 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 14 },
    recentPressed: { backgroundColor: theme.colors.surfacePressed },
    recentTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', color: theme.colors.text, fontSize: 16 },
    recentTime: { color: theme.colors.textSecondary, fontSize: 12 },
    tagline: { color: theme.colors.text, fontSize: 18, marginTop: 12, marginBottom: 8 },
    caption: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    suggestions: { marginTop: 30, width: '100%', maxWidth: 360, gap: 10 },
    suggestion: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider, padding: 15, flexDirection: 'row', alignItems: 'center' },
    // `flex: 1` would set flexBasis to 0 and leave the label invisible in any
    // row that ends up content-width, since there is then no free space to grow
    // into. An `auto` basis measures the text first and only then grows, which
    // still pushes the arrow to the right edge when there is room.
    suggestionText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', color: theme.colors.text, fontSize: 14 },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20 },
    latest: { alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderRadius: 20, backgroundColor: theme.colors.surface },
    attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 8, paddingHorizontal: 20 },
    attachment: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, padding: 8, maxWidth: 230, backgroundColor: theme.colors.surface },
    attachmentText: { flexShrink: 1, color: theme.colors.text, fontSize: 12 },
    menuRoot: { flex: 1, justifyContent: 'flex-end' },
    menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
    menuPanel: { width: '100%', maxWidth: 430, alignSelf: 'center', marginBottom: 12, padding: 12, borderRadius: 28, backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
    menuHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    menuBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    menuTitle: { color: theme.colors.text, fontSize: 17, ...Typography.default('semiBold') },
    menuRow: { minHeight: 68, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
    menuIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
    menuCopy: { flex: 1 },
    menuLabel: { color: theme.colors.text, fontSize: 17, ...Typography.default() },
    menuDetail: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
    menuValue: { marginLeft: 'auto', color: theme.colors.textSecondary, fontSize: 14 },
}));
