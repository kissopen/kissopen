import * as React from 'react';
import { Animated, LayoutChangeEvent, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BubblePressable } from '@/components/BubblePressable';
import { MobileHeaderScrim } from '@/components/navigation/MobileHeaderScrim';
import { KissopenLockup } from './KissopenLockup';
import { GlassControl, GlassPill } from './GlassControl';
import { Typography } from '@/constants/Typography';
import type { Conversation } from './api/types';
import { t } from '@/text';

export type DrawerDestination = 'home' | 'files' | 'projects' | 'work' | 'schedules' | 'plugins';
const destinations: { key: DrawerDestination; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    // Chat runs without the tab bar, so the drawer is its way back home.
    { key: 'files', title: t('kissopen.nav.library'), icon: 'library-outline' },
    { key: 'projects', title: t('kissopen.nav.projects'), icon: 'folder-outline' },
    // Named for what it is rather than for one thing it can do. It was the
    // switcher's other half, and the switcher is gone, so this row is now the
    // only way in and carries that half's name.
    { key: 'work', title: t('kissopen.home.tabWork'), icon: 'checkbox-outline' },
    { key: 'schedules', title: t('kissopen.nav.schedules'), icon: 'time-outline' },
    { key: 'plugins', title: t('kissopen.nav.plugins'), icon: 'extension-puzzle-outline' },
];

// The primary action carries the brand accent rather than the iOS system
// blue it used to borrow, applied as a glass tint rather than a solid fill.
// Read from the theme at render so it tracks the VI palette in one place.

export function HomeDrawer(props: {
    open: boolean; conversations: readonly { readonly id: string; readonly title: string }[]; selectedId?: string; destination: string;
    onClose: () => void; onNavigate: (destination: DrawerDestination) => void;
    onConversation: (id: string) => void; onNew: () => void; onMine: () => void;
}) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const drawerWidth = Math.min(380, width * 0.84);
    const progress = React.useRef(new Animated.Value(0)).current;
    const [visible, setVisible] = React.useState(props.open);
    const [searching, setSearching] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const search = React.useRef<TextInput>(null);
    // The two bands float over the list, so the list has to reserve their height
    // itself. They are measured rather than fixed because the top one grows when
    // the search field opens — but seeded with their resting height, because the
    // drawer unmounts when closed and a 0 seed would make the list jump on every
    // open.
    const [topBandHeight, setTopBandHeight] = React.useState(() => insets.top + 68);
    const [bottomBandHeight, setBottomBandHeight] = React.useState(() => Math.max(insets.bottom, 12) + 64);
    const measureBand = React.useCallback((set: React.Dispatch<React.SetStateAction<number>>) => (event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        set(current => (Math.abs(current - next) < 1 ? current : next));
    }, []);
    React.useEffect(() => {
        if (props.open) setVisible(true);
        Animated.timing(progress, { toValue: props.open ? 1 : 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
            if (finished && !props.open) { setVisible(false); setSearching(false); setQuery(''); }
        });
        return () => progress.stopAnimation();
    }, [props.open, progress]);
    const history = props.conversations.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    if (!visible) return null;
    return <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={props.onClose}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}><Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel={t('kissopen.nav.closeMenu')} onPress={props.onClose} /></Animated.View>
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }] }]}>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { paddingTop: topBandHeight + 8, paddingBottom: bottomBandHeight + 8 }]}
            >
                {!searching && <View style={styles.destinations}>{destinations.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ selected: props.destination === item.key }} style={[styles.destination, props.destination === item.key && styles.selected]} onPress={() => props.onNavigate(item.key)}><Ionicons name={item.icon} size={24} color={theme.colors.text} /><Text style={styles.destinationText}>{item.title}</Text></Pressable>)}</View>}
                <Text style={styles.sectionLabel}>{searching ? t('kissopen.drawer.searchResults') : t('kissopen.drawer.recentChats')}</Text>
                {history.map(item => <Pressable accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ selected: props.selectedId === item.id }} style={[styles.historyRow, props.selectedId === item.id && styles.selected]} key={item.id} onPress={() => props.onConversation(item.id)}><Text numberOfLines={1} style={styles.historyText}>{item.title}</Text></Pressable>)}
                {!history.length && <Text style={styles.empty}>{query ? t('kissopen.drawer.noChatsFound') : t('kissopen.drawer.emptyHint')}</Text>}
            </ScrollView>

            {/* Both bands are rendered after the list so the native blur samples it. */}
            <View style={styles.topBand} onLayout={measureBand(setTopBandHeight)}>
                <View pointerEvents="none" style={styles.bandScrim}><MobileHeaderScrim variant="strong" edge="top" /></View>
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    {/*
                      Home is the empty chat: tab switcher up top, wordmark and
                      prompts in the middle. That is what opening a conversation
                      with no id lands on, so the logo shares onNew with the
                      footer button rather than having a near-duplicate action.
                    */}
                    <BubblePressable
                        accessibilityRole="button"
                        accessibilityLabel={t('kissopen.drawer.backHome')}
                        // The lockup is only ~22pt tall, so the tap target has
                        // to come from hitSlop rather than from its own box.
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 16 }}
                        onPress={props.onNew}
                    >
                        <KissopenLockup height={22} />
                    </BubblePressable>
                    <GlassControl
                        label={searching ? t('kissopen.drawer.closeSearch') : t('kissopen.drawer.searchChats')}
                        onPress={() => { setSearching(!searching); setQuery(''); }}
                    >
                        <Ionicons name={searching ? 'close' : 'search-outline'} size={24} color={theme.colors.text} />
                    </GlassControl>
                </View>
                {searching && <TextInput ref={search} autoFocus value={query} onChangeText={setQuery} placeholder={t('kissopen.drawer.searchChats')} accessibilityLabel={t('kissopen.drawer.searchChats')} placeholderTextColor={theme.colors.textSecondary} style={styles.search} returnKeyType="search" />}
            </View>

            <View style={styles.bottomBand} onLayout={measureBand(setBottomBandHeight)}>
                <View pointerEvents="none" style={styles.bandScrim}><MobileHeaderScrim variant="strong" edge="bottom" /></View>
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <GlassPill
                        label={t('kissopen.drawer.newChat')}
                        tintColor={theme.colors.brand.accent}
                        fallbackColor={theme.colors.brand.accent}
                        onPress={props.onNew}
                        style={styles.newChat}
                    >
                        <Ionicons name="create-outline" size={24} color="#fff" />
                        <Text style={styles.newText}>{t('kissopen.drawer.newChatShort')}</Text>
                    </GlassPill>
                    <GlassControl label={t('kissopen.tabs.mine')} size={52} onPress={props.onMine}>
                        <Ionicons name="person-circle-outline" size={25} color={theme.colors.text} />
                    </GlassControl>
                </View>
            </View>
        </Animated.View>
    </View>;
}
const styles = StyleSheet.create(theme => ({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 20 },
    fill: { flex: 1 },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    drawer: { height: '100%', backgroundColor: theme.colors.surface, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.divider },
    // Pinned rather than stacked, so the list runs underneath and the scrim has
    // live content to feather over — the same scroll-edge treatment the home
    // chrome uses. MobileHeaderScrim only renders on iOS (Material 3 uses tonal
    // bars, not backdrop blur), so elsewhere the bands need to be opaque or the
    // list would read straight through the wordmark and the buttons.
    topBand: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        backgroundColor: Platform.select({ ios: 'transparent', default: theme.colors.surface }),
    },
    bottomBand: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        backgroundColor: Platform.select({ ios: 'transparent', default: theme.colors.surface }),
    },
    // Overhangs its band so the wash finishes in the content, not on the edge.
    bandScrim: { position: 'absolute', top: -8, right: 0, bottom: -8, left: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 12 },
    search: { marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: theme.colors.input.background, color: theme.colors.text, fontSize: 16 },
    content: { paddingHorizontal: 16 },
    destinations: { paddingBottom: 18, marginBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
    destination: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 12, borderRadius: 14, gap: 16 },
    destinationText: { fontSize: 17, color: theme.colors.text, ...Typography.default('semiBold') },
    sectionLabel: { color: theme.colors.textSecondary, fontSize: 12, marginHorizontal: 12, marginBottom: 6 },
    historyRow: { minHeight: 50, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12 },
    historyText: { fontSize: 16, color: theme.colors.text },
    selected: { backgroundColor: theme.colors.surfaceHigh },
    empty: { margin: 12, fontSize: 14, lineHeight: 22, color: theme.colors.textSecondary },
    footer: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    newChat: { flexShrink: 1 },
    newText: { color: '#fff', fontSize: 17, ...Typography.default('semiBold') },
}));
