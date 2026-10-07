import * as React from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { MobileGlassSurface } from '@/components/MobileGlass';
import { MOBILE_GLASS_CONTROL_SIZE } from '@/components/navigation/headerMetrics';
import { isRunningOnMac } from '@/utils/platform';

/**
 * Whether glass controls hand their touch interaction to UIKit, which is what
 * makes the material swell under a finger and deform as it drags.
 *
 * This deliberately bypasses getNativeGlassInteractivity, which pins native
 * glass interactivity off app-wide because a UIVisualEffectView can take
 * responder ownership away from the RN Pressable above it. It is scoped to the
 * Kissopen home chrome, so flipping this to false falls straight back to the JS
 * press swell without touching the rest of the app.
 */
const NATIVE_CONTROL_INTERACTION = true;

/**
 * Android samples its backdrop for real rather than compositing a cheap
 * overlay, so the material stays lighter than the iOS one to keep the header
 * cheap to scroll behind.
 */
const ANDROID_GLASS_INTENSITY = 48;

/**
 * Real Liquid Glass needs UIGlassEffect, which only some iOS 26 builds expose.
 * Other iOS builds fall back to material blur, and Android to a hand-built
 * imitation of the same material.
 *
 * `glassEnabled` therefore means "this platform draws chrome as glass" and
 * gates layout (transparent bar, scrim, taller header); `liquidGlass` means
 * "UIKit owns the material" and gates the native-only behaviour.
 */
export function getGlassCapability() {
    const nativeGlass = Platform.OS === 'ios' && !isRunningOnMac();
    return {
        glassEnabled: nativeGlass || Platform.OS === 'android',
        liquidGlass: nativeGlass && isGlassEffectAPIAvailable(),
    };
}

/**
 * The material itself, without any shape or press handling.
 *
 * Going straight to GlassView rather than through MobileGlassSurface matters
 * even when the glass is inert: MobileGlassSurface paints a highlight gradient
 * inside the effect, which would make these surfaces read flatter than the ones
 * that bypass it.
 *
 * The native path draws no rim and does not clip — interactive glass deforms
 * past its own bounds, so clipping would shear the bulge off, and the material
 * already draws its own specular edge. The blur fallback needs both.
 */
function GlassSkin(props: {
    /** Hand the press interaction to UIKit. Containers and indicators opt out. */
    interactive?: boolean;
    tintColor?: string;
    fallbackColor?: string;
    style: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}) {
    const { theme } = useUnistyles();
    const { glassEnabled, liquidGlass } = getGlassCapability();
    const interactive = props.interactive ?? true;
    const nativeInteractive = interactive && NATIVE_CONTROL_INTERACTION;
    // Inert glass has no responder to lose, so it always takes the native path
    // when the material exists. Interactive glass only does so while the native
    // interaction is on; otherwise it falls back, where the JS press swell is.
    const useNative = liquidGlass && (!interactive || nativeInteractive);

    if (useNative) {
        return (
            <GlassView
                isInteractive={nativeInteractive}
                glassEffectStyle="regular"
                colorScheme={theme.dark ? 'dark' : 'light'}
                tintColor={props.tintColor ?? theme.colors.glass.tint}
                style={[styles.skin, props.style]}
            >
                {props.children}
            </GlassView>
        );
    }

    // Android has no UIGlassEffect, so the material is assembled by hand: a
    // backdrop blur under a translucent tint. It deliberately mirrors the iOS
    // blur fallback rather than the native path, because neither draws a
    // specular edge of its own and both need the rim to read as a surface.
    if (Platform.OS === 'android') {
        return (
            <View style={[styles.skin, styles.androidGlass, props.style]}>
                <BlurView
                    pointerEvents="none"
                    blurMethod="dimezisBlurViewSdk31Plus"
                    blurReductionFactor={2}
                    intensity={ANDROID_GLASS_INTENSITY}
                    tint={theme.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                    style={StyleSheet.absoluteFillObject}
                />
                <View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFillObject,
                        {
                            backgroundColor: props.tintColor
                                ?? props.fallbackColor
                                ?? theme.colors.glass.backgroundSubtle,
                        },
                    ]}
                />
                {props.children}
            </View>
        );
    }

    return (
        <MobileGlassSurface
            enabled={glassEnabled}
            nativeEffect
            interactive={interactive && liquidGlass}
            material={liquidGlass ? undefined : 'static'}
            glassEffectStyle="regular"
            intensity={liquidGlass ? 80 : 76}
            tintColor={props.tintColor}
            style={[
                styles.skin,
                styles.fallbackRim,
                props.fallbackColor ? { backgroundColor: props.fallbackColor } : null,
                props.style,
            ]}
        >
            {props.children}
        </MobileGlassSurface>
    );
}

/**
 * Native glass for containers and indicators.
 *
 * Sizing comes entirely from `style` so the surface can either fill a fixed
 * parent or hug its own content.
 *
 * `interactive` hands the swell and drag deformation to UIKit. For that to fire
 * at all, the touch has to land on the effect view — so whatever the user
 * presses must be a *child* of this panel, not a sibling stacked over it.
 */
export const GlassPanel = React.memo(function GlassPanel(props: {
    interactive?: boolean;
    tintColor?: string;
    fallbackColor?: string;
    style: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}) {
    return (
        <GlassSkin
            interactive={props.interactive ?? false}
            tintColor={props.tintColor}
            fallbackColor={props.fallbackColor}
            style={props.style}
        >
            {props.children}
        </GlassSkin>
    );
});

/** A round glass control, sized square. Defaults to the 44pt header size. */
export const GlassControl = React.memo(function GlassControl(props: {
    label: string;
    size?: number;
    selected?: boolean;
    disabled?: boolean;
    tintColor?: string;
    onPress: () => void;
    children: React.ReactNode;
}) {
    const { theme } = useUnistyles();
    const { liquidGlass } = getGlassCapability();
    const nativeInteraction = liquidGlass && NATIVE_CONTROL_INTERACTION;
    const size = props.size ?? MOBILE_GLASS_CONTROL_SIZE;
    const radius = size / 2;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={{ selected: props.selected, disabled: props.disabled }}
            disabled={props.disabled}
            onPress={props.onPress}
            hitSlop={10}
            style={({ pressed }) => [
                styles.lift,
                { width: size, height: size, borderRadius: radius, shadowColor: theme.colors.glass.shadow },
                // UIKit owns the press feedback when it owns the interaction.
                !nativeInteraction && pressed && styles.pressed,
                props.disabled && styles.disabled,
            ]}
        >
            <GlassSkin
                tintColor={props.tintColor ?? (props.selected ? theme.colors.glass.overlayTint : undefined)}
                style={[styles.fill, { borderRadius: radius }]}
            >
                {props.children}
            </GlassSkin>
        </Pressable>
    );
});

/**
 * A labelled glass pill, for prominent actions.
 *
 * Prominence comes from a tint rather than a solid fill — the HIG's guidance for
 * glass — so `fallbackColor` carries the old opaque colour for the blur path,
 * where a tint alone would not read as primary.
 */
export const GlassPill = React.memo(function GlassPill(props: {
    label: string;
    height?: number;
    tintColor?: string;
    fallbackColor?: string;
    disabled?: boolean;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}) {
    const { theme } = useUnistyles();
    const { liquidGlass } = getGlassCapability();
    const nativeInteraction = liquidGlass && NATIVE_CONTROL_INTERACTION;
    const height = props.height ?? 52;
    const radius = height / 2;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={{ disabled: props.disabled }}
            disabled={props.disabled}
            onPress={props.onPress}
            style={({ pressed }) => [
                styles.lift,
                { height, borderRadius: radius, shadowColor: theme.colors.glass.shadow },
                !nativeInteraction && pressed && styles.pressed,
                props.disabled && styles.disabled,
                props.style,
            ]}
        >
            <GlassSkin
                tintColor={props.tintColor}
                fallbackColor={props.fallbackColor}
                style={[styles.fill, styles.pillSkin, { borderRadius: radius }]}
            >
                {props.children}
            </GlassSkin>
        </Pressable>
    );
});

const styles = StyleSheet.create(theme => ({
    // Lift lives on an unclipped wrapper, because a view cannot both clip its
    // contents to a capsule and cast a shadow.
    lift: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: Platform.select({ ios: 1, default: 0 }),
        shadowRadius: 14,
        elevation: 0,
    },
    // Deliberately carries no size: callers either fill a fixed parent or let
    // the surface hug its content.
    skin: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    fill: { width: '100%', height: '100%' },
    fallbackRim: {
        overflow: 'hidden',
        borderWidth: Platform.select({ ios: StyleSheet.hairlineWidth, default: 0 }),
        borderColor: theme.colors.glass.border,
    },
    // Clips the blur and tint to whatever radius the caller supplied, which is
    // safe here because the lift always lives on an unclipped wrapper above —
    // a view cannot both clip to a capsule and cast a shadow.
    androidGlass: {
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.glass.border,
    },
    pillSkin: { flexDirection: 'row', gap: 10, paddingHorizontal: 24 },
    // Takes the edge off rather than dimming, since the swell is the main cue.
    pressed: { opacity: 0.9 },
    disabled: { opacity: 0.4 },
}));

export { NATIVE_CONTROL_INTERACTION };
