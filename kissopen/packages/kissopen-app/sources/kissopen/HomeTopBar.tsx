import * as React from 'react';
import { Animated, Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BubblePressable } from '@/components/BubblePressable';
import { layout } from '@/components/layout';
import {
    MOBILE_GLASS_CONTROL_RADIUS,
    MOBILE_GLASS_CONTROL_SIZE,
    MOBILE_GLASS_HEADER_HEIGHT,
    resolveTitlePillInset,
} from '@/components/navigation/headerMetrics';
import {
    MobileHeaderScrim,
    MOBILE_STRONG_HEADER_SCRIM_RESTING_OPACITY,
    MOBILE_STRONG_HEADER_SCRIM_UNDERLAP_OPACITY,
} from '@/components/navigation/MobileHeaderScrim';
import { Typography } from '@/constants/Typography';
import { useHeaderHeight } from '@/utils/responsive';
import { GlassControl, GlassPanel, getGlassCapability, NATIVE_CONTROL_INTERACTION } from './GlassControl';
import { TemporaryChatIcon } from './TemporaryChatIcon';
import { t } from '@/text';

/**
 * How close two capsules get before the container starts merging them.
 *
 * Smaller than MOBILE_TITLE_PILL_GAP so the three controls stay visually
 * separate at rest, and only flow together once a long title grows the centre
 * capsule into its neighbours.
 */
const GLASS_MERGE_SPACING = 10;

/** Breathing room between the sliding indicator and its slot edges. */
const INDICATOR_INSET = 3;

/**
 * Inset of the track inside the capsule. Doubles as the indicator's inset on
 * every side, so a 44pt capsule leaves the 36pt slot height the labels use.
 */
const SWITCH_INSET = 4;


/**
 * Travel time scaled by distance, so a one-slot hop stays snappy and a longer
 * one does not feel like it teleported. Mirrors TabBar's tab transition.
 */
function slideTransition(from: number, to: number) {
    'worklet';
    const distance = Math.abs(to - from);
    return {
        duration: Math.max(90, Math.round(130 * distance)),
        easing: Easing.out(Easing.cubic),
    };
}

/** Height the content below has to reserve, matching the bot session header. */
export function useHomeTopBarHeight() {
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();
    return insets.top + Math.max(headerHeight, MOBILE_GLASS_HEADER_HEIGHT);
}

export type HomeTopBarTab = readonly [string, string];

/**
 * The home chrome: a transparent bar floating over the content with a strong
 * scrim underneath it, carrying three Liquid Glass capsules.
 *
 * On iOS 26 the capsules are real UIGlassEffect views grouped in a
 * UIGlassContainerEffect, which is what lets neighbouring glass influence and
 * merge into one another instead of stacking two separate materials. Older iOS
 * falls back to material blur, and Android to an opaque tonal bar.
 *
 * The centre capsule carries either the conversation title or the chat/work tab
 * switcher — they share the slot, so a titled conversation hides the switcher
 * and the work tab is reached from the drawer instead.
 */
export function HomeTopBar(props: {
    title?: string;
    onTitlePress?: () => void;
    tabs?: readonly HomeTopBarTab[];
    activeTab?: string;
    onTab?: (key: string) => void;
    /** Absent: no control on the left, as on the chat list, which is reached from the tab bar. */
    leftIcon?: 'menu' | 'back';
    leftLabel?: string;
    onLeftPress?: () => void;
    temporary?: boolean;
    temporaryDisabled?: boolean;
    onTemporaryPress?: () => void;
    /**
     * Inside a conversation the right side is a capsule of two: start a new
     * conversation, and everything else about this one. It replaces the
     * temporary-chat control, which only means something before a conversation
     * has begun.
     */
    conversationActions?: { onCompose: () => void; onMore: () => void; disabled?: boolean };
    /**
     * The one thing this section is for, in the corner every section keeps its
     * action in. Work uses it to start a session; chat has its own controls and
     * passes nothing.
     */
    primaryAction?: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
    /**
     * Two actions in one capsule, for a section whose corner carries a pair.
     * The same shape a conversation's corner uses, so the corner keeps one
     * silhouette however many things are in it.
     */
    actionPair?: {
        left: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; selected?: boolean };
        right: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
        disabled?: boolean;
    };
    backdropVisible?: boolean;
}) {
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();
    const { glassEnabled, liquidGlass } = getGlassCapability();
    const contentHeight = glassEnabled ? Math.max(headerHeight, MOBILE_GLASS_HEADER_HEIGHT) : headerHeight;
    const actions = props.conversationActions;
    // UIKit swells the whole capsule when it owns the press, so the slots must
    // not also dim themselves — that reads as two competing responses. Android
    // and the blur fallback keep the opacity, being all the feedback there is.
    const nativeActionInteraction = liquidGlass && NATIVE_CONTROL_INTERACTION;
    const showTemporary = !actions && !!props.onTemporaryPress;
    const showTabs = !props.title && !!props.tabs && !!props.onTab;
    const centreInset = resolveTitlePillInset({
        leftControlWidth: MOBILE_GLASS_CONTROL_SIZE,
        rightControlWidth: actions ? MOBILE_GLASS_CONTROL_SIZE * 2 : showTemporary ? MOBILE_GLASS_CONTROL_SIZE : 0,
    });
    // Liquid Glass draws its own specular edge, so the hand-drawn rim is only
    // for the blur fallback.
    // Drives the scrim's dim layer only; the bar itself stays transparent so the
    // native glass keeps sampling live content underneath it.
    const backdropStrength = React.useRef(new Animated.Value(
        props.backdropVisible ? MOBILE_STRONG_HEADER_SCRIM_UNDERLAP_OPACITY : MOBILE_STRONG_HEADER_SCRIM_RESTING_OPACITY,
    )).current;
    React.useEffect(() => {
        if (!glassEnabled) return;
        Animated.timing(backdropStrength, {
            toValue: props.backdropVisible ? MOBILE_STRONG_HEADER_SCRIM_UNDERLAP_OPACITY : MOBILE_STRONG_HEADER_SCRIM_RESTING_OPACITY,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [backdropStrength, props.backdropVisible, glassEnabled]);

    // Both centre variants are inert glass: the capsule is a container whose
    // slots own their presses, so swelling the whole thing would drag the labels
    // and the sliding indicator with it.
    const centre = showTabs ? (
        // HomeTabSwitch supplies its own glass, because the slots have to be its
        // children for UIKit's interaction to see the touch.
        <View style={styles.centreShadow}>
            <HomeTabSwitch tabs={props.tabs!} activeTab={props.activeTab} onTab={props.onTab!} />
        </View>
    ) : props.title ? (
        <BubblePressable
            style={[styles.centrePill, styles.centreShadow]}
            onPress={props.onTitlePress}
            disabled={!props.onTitlePress}
            scaleFeedback={false}
        >
            <GlassPanel style={[styles.capsule, styles.titleCapsule]}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.centreTitle}>{props.title}</Text>
            </GlassPanel>
        </BubblePressable>
    ) : null;

    const row = (
        <View style={[styles.content, { height: contentHeight }]}>
            {props.leftIcon && props.onLeftPress ? (
                <GlassControl label={props.leftLabel ?? ''} onPress={props.onLeftPress}>
                    <Ionicons
                        name={props.leftIcon === 'back' ? (Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back') : 'menu-outline'}
                        size={props.leftIcon === 'back' ? 24 : 25}
                        color={theme.colors.header.tint}
                    />
                </GlassControl>
            ) : null}
            <View pointerEvents="none" style={styles.centreSpacer} />
            {centre && (
                <View pointerEvents="box-none" style={[styles.centreOverlay, { left: centreInset, right: centreInset }]}>
                    {centre}
                </View>
            )}
            {showTemporary && (
                // Selected state comes through as a tint, which is how Liquid
                // Glass shows prominence, rather than a thicker border that
                // would fight the material's own edge.
                <GlassControl
                    label={props.temporary ? t('kissopen.topBar.exitTemporaryChat') : t('kissopen.home.temporaryChat')}
                    selected={props.temporary}
                    disabled={props.temporaryDisabled}
                    onPress={props.onTemporaryPress!}
                >
                    <TemporaryChatIcon color={theme.colors.header.tint} active={props.temporary} />
                </GlassControl>
            )}
            {props.primaryAction && (
                <GlassControl label={props.primaryAction.label} onPress={props.primaryAction.onPress}>
                    <Ionicons name={props.primaryAction.icon} size={23} color={theme.colors.header.tint} />
                </GlassControl>
            )}
            {actions && (
                <View style={styles.centreShadow}>
                    <GlassPanel interactive style={[styles.capsule, styles.actionCapsule]}>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.topBar.newConversation')} disabled={actions.disabled} hitSlop={6}
                            onPress={actions.onCompose} style={({ pressed }) => [styles.actionSlot, !nativeActionInteraction && pressed && styles.actionPressed, actions.disabled && styles.actionDisabled]}>
                            <Ionicons name="create-outline" size={22} color={theme.colors.header.tint} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.topBar.more')} disabled={actions.disabled} hitSlop={6}
                            onPress={actions.onMore} style={({ pressed }) => [styles.actionSlot, !nativeActionInteraction && pressed && styles.actionPressed, actions.disabled && styles.actionDisabled]}>
                            {/* Each platform's own "more": vertical on Android, horizontal on iOS. */}
                            <Ionicons name={Platform.OS === 'android' ? 'ellipsis-vertical' : 'ellipsis-horizontal'} size={22} color={theme.colors.header.tint} />
                        </Pressable>
                    </GlassPanel>
                </View>
            )}
            {props.actionPair && (
                <View style={styles.centreShadow}>
                    <GlassPanel interactive style={[styles.capsule, styles.actionCapsule]}>
                        {([props.actionPair.left, props.actionPair.right] as const).map((action, index) => (
                            <Pressable
                                key={index}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                                accessibilityState={{ selected: 'selected' in action ? action.selected : undefined }}
                                disabled={props.actionPair!.disabled}
                                hitSlop={6}
                                onPress={action.onPress}
                                style={({ pressed }) => [
                                    styles.actionSlot,
                                    !nativeActionInteraction && pressed && styles.actionPressed,
                                    props.actionPair!.disabled && styles.actionDisabled,
                                ]}
                            >
                                <Ionicons name={action.icon} size={22} color={theme.colors.header.tint} />
                            </Pressable>
                        ))}
                    </GlassPanel>
                </View>
            )}
        </View>
    );

    return (
        <View
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    // Android now draws glass too, so the opaque tonal bar it
                    // used to fall back to is unreachable; only web and Mac
                    // still want a solid header.
                    backgroundColor: glassEnabled ? 'transparent' : theme.colors.header.background,
                },
            ]}
        >
            {glassEnabled && (
                <View pointerEvents="none" style={styles.backdrop}>
                    {Platform.OS === 'android'
                        ? <AndroidHeaderScrim strength={backdropStrength} />
                        : <MobileHeaderScrim variant="strong" overlayOpacity={backdropStrength} />}
                </View>
            )}
            <View style={styles.contentWrapper}>
                {liquidGlass ? (
                    <GlassContainer spacing={GLASS_MERGE_SPACING} style={styles.glassContainer}>
                        {row}
                    </GlassContainer>
                ) : row}
            </View>
        </View>
    );
}

/**
 * The home bar's legibility wash on Android.
 *
 * MobileHeaderScrim is iOS-only on purpose — every other Android header in the
 * app draws an opaque tonal surface instead, so making it render here would
 * double up behind those. The glass home bar has no such surface, so it needs
 * its own: the same fade to nothing at the content edge, minus the masked blur
 * pass, which is the expensive half and the least visible.
 */
const AndroidHeaderScrim = React.memo(function AndroidHeaderScrim(props: { strength: Animated.Value }) {
    const { theme } = useUnistyles();
    const rgb = theme.dark ? '0, 0, 0' : '255, 255, 255';
    const peak = theme.dark ? 0.62 : 0.82;

    return (
        <Animated.View pointerEvents="none" style={[styles.scrimFill, { opacity: props.strength }]}>
            <LinearGradient
                colors={[`rgba(${rgb}, ${peak})`, `rgba(${rgb}, ${peak})`, `rgba(${rgb}, 0)`]}
                locations={[0, 0.62, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.scrimFill}
            />
        </Animated.View>
    );
});

/**
 * Segmented chat/work switch with an indicator that slides between the slots.
 *
 * Built as three siblings — base glass, indicator, labels — rather than nesting
 * them. Two reasons, both fatal to the nested version:
 *
 *  - GlassView mounts children into its effect view's contentView, and glass
 *    inside another glass's contentView is not a supported composition. UIKit
 *    only endorses that nesting inside a UIGlassContainerEffect.
 *  - The header wraps everything in a GlassContainer, which merges glass
 *    elements within GLASS_MERGE_SPACING of each other. An indicator sitting a
 *    few points inside the base would be absorbed into it and vanish.
 *
 * So the indicator stays a flat tinted fill: it is the one part that has to read
 * as distinct from the capsule behind it.
 *
 * `visualPosition` is a fractional slot index driven on the UI thread, so the
 * labels can cross-fade in step with the indicator instead of snapping when the
 * tab prop lands. It also re-syncs from the prop, because the work tab can be
 * selected from the drawer without ever touching this control.
 */
const HomeTabSwitch = React.memo(function HomeTabSwitch(props: {
    tabs: readonly HomeTopBarTab[];
    activeTab?: string;
    onTab: (key: string) => void;
}) {
    const activeIndex = Math.max(0, props.tabs.findIndex(([key]) => key === props.activeTab));
    const slotCount = props.tabs.length;
    const visualPosition = useSharedValue(activeIndex);
    const trackWidth = useSharedValue(0);

    React.useEffect(() => {
        visualPosition.value = withTiming(activeIndex, slideTransition(visualPosition.value, activeIndex));
    }, [activeIndex, visualPosition]);

    const handleTrackLayout = React.useCallback((event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        if (width <= 0 || Math.abs(trackWidth.value - width) < 0.5) return;
        trackWidth.value = width;
    }, [trackWidth]);

    const indicatorStyle = useAnimatedStyle(() => {
        const slot = trackWidth.value / slotCount;
        return {
            width: Math.max(0, slot - (INDICATOR_INSET * 2)),
            opacity: trackWidth.value > 0 ? 1 : 0,
            transform: [{ translateX: (visualPosition.value * slot) + INDICATOR_INSET }],
        };
    }, [slotCount]);

    return (
        <GlassPanel interactive style={styles.switchCapsule}>
            <Reanimated.View pointerEvents="none" style={[styles.tabIndicator, indicatorStyle]} />
            <View style={styles.tabTrack} accessibilityRole="tablist" onLayout={handleTrackLayout}>
                {props.tabs.map(([key, title], index) => (
                    <HomeTabItem
                        key={key}
                        index={index}
                        title={title}
                        selected={props.activeTab === key}
                        visualPosition={visualPosition}
                        onPress={() => props.onTab(key)}
                    />
                ))}
            </View>
        </GlassPanel>
    );
});

/**
 * One slot. The label is drawn twice and cross-faded because the active state
 * changes font weight as well as colour, and weight cannot be interpolated.
 * The inactive copy defines the slot's layout; the active one floats over it.
 */
const HomeTabItem = React.memo(function HomeTabItem(props: {
    index: number;
    title: string;
    selected: boolean;
    visualPosition: SharedValue<number>;
    onPress: () => void;
}) {
    const { index, visualPosition } = props;
    const activation = useAnimatedStyle(() => ({
        opacity: Math.max(0, 1 - Math.abs(visualPosition.value - index)),
    }), [index]);
    const fadeOut = useAnimatedStyle(() => ({
        opacity: 1 - Math.max(0, 1 - Math.abs(visualPosition.value - index)),
    }), [index]);

    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: props.selected }}
            accessibilityLabel={props.title}
            style={styles.tab}
            onPress={props.onPress}
        >
            <Reanimated.Text style={[styles.tabText, fadeOut]}>{props.title}</Reanimated.Text>
            <View pointerEvents="none" style={styles.tabLabelOverlay}>
                <Reanimated.Text style={[styles.tabText, styles.activeTabText, activation]}>{props.title}</Reanimated.Text>
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create(theme => ({
    container: { position: 'relative', zIndex: 100 },
    backdrop: { position: 'absolute', top: 0, right: 0, bottom: -8, left: 0 },
    scrimFill: { ...StyleSheet.absoluteFillObject },
    contentWrapper: { width: '100%', alignItems: 'center' },
    glassContainer: { width: '100%', alignItems: 'center' },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        width: '100%',
        maxWidth: layout.headerMaxWidth,
    },
    centreSpacer: { flex: 1, minWidth: 0 },
    // Left and right come from the measured controls so the capsule stays
    // centred on the bar rather than on the space the controls leave over.
    centreOverlay: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    centrePill: { maxWidth: '100%', height: MOBILE_GLASS_CONTROL_SIZE, borderRadius: MOBILE_GLASS_CONTROL_RADIUS },
    // Lift lives on its own wrapper, so the shadow survives the blur fallback
    // clipping itself to the capsule.
    centreShadow: {
        maxWidth: '100%',
        borderRadius: MOBILE_GLASS_CONTROL_RADIUS,
        shadowColor: theme.colors.glass.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: Platform.select({ ios: 1, default: 0 }),
        shadowRadius: 14,
        elevation: 0,
    },
    // Same material and height as the controls beside it; the capsule is only
    // ever wider because its content is. The rim and the clip come from
    // GlassSkin's fallback path, so they are absent on real Liquid Glass.
    capsule: { borderRadius: MOBILE_GLASS_CONTROL_RADIUS },
    titleCapsule: { width: '100%', height: '100%', paddingHorizontal: 14 },
    // Two slots in one pill, each the size of a lone control, so the capsule
    // reads as the controls beside it joined rather than as a new shape.
    actionCapsule: { flexDirection: 'row', height: MOBILE_GLASS_CONTROL_SIZE, alignItems: 'center' },
    actionSlot: { width: MOBILE_GLASS_CONTROL_SIZE, height: MOBILE_GLASS_CONTROL_SIZE, alignItems: 'center', justifyContent: 'center' },
    actionPressed: { opacity: 0.55 },
    actionDisabled: { opacity: 0.35 },
    // The glass itself owns the switch's size and holds the slots as children,
    // which is the only arrangement where a touch reaches the effect view and
    // UIKit can swell it. Sizes to the track, so the capsule hugs its labels.
    switchCapsule: {
        height: MOBILE_GLASS_CONTROL_SIZE,
        maxWidth: '100%',
        borderRadius: MOBILE_GLASS_CONTROL_RADIUS,
        paddingHorizontal: SWITCH_INSET,
    },
    centreTitle: { width: 'auto', maxWidth: '100%', textAlign: 'center', color: theme.colors.header.tint, fontSize: 16, lineHeight: 20, ...Typography.default('semiBold') },
    // No gap: the indicator's travel is trackWidth / slotCount, so the slots
    // have to tile the track exactly.
    tabTrack: { flexDirection: 'row', alignItems: 'center' },
    tab: { width: 82, alignItems: 'center', justifyContent: 'center', height: 36, paddingHorizontal: 12 },
    tabLabelOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
    // Inset by SWITCH_INSET on every side so it sits inside the capsule rather
    // than on its rim. Positioned against the shell, so its animated translateX
    // starts from the track's left edge.
    tabIndicator: {
        position: 'absolute',
        top: SWITCH_INSET,
        bottom: SWITCH_INSET,
        left: SWITCH_INSET,
        borderRadius: 18,
        // A flat fill, so it has to brighten in both themes to read as raised.
        // overlayTint — TabBar's glass lens tint — darkens on dark and would
        // look recessed as a background rather than as a glass tint.
        backgroundColor: theme.colors.glass.highlight,
    },
    tabText: { fontSize: 15, color: theme.colors.textSecondary },
    activeTabText: { color: theme.colors.text, ...Typography.default('semiBold') },
}));
