import * as React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useReducedMotion,
    useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { JUAN, MARK_ASPECT, MARK_VIEWBOX, MARK_LEFT, MARK_RIGHT } from './juanMark';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const curve = Easing.bezier(.4, 0, .2, 1).factory();
export const KissopenLoader = React.memo(function KissopenLoader(props: {
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    label?: string;
    variant?: 'breathe' | 'relay';
}) {
    const reduced = useReducedMotion();
    const size = props.size ?? 32;
    const width = size * MARK_ASPECT;
    const compact = width <= 24;
    const relay = props.variant === 'relay';
    const clock = useSharedValue(0);
    React.useEffect(() => {
        cancelAnimation(clock);
        clock.value = 0;
        if (!reduced) clock.value = withRepeat(withTiming(1, {
            duration: relay ? 1800 : compact ? 1200 : 1600,
            easing: Easing.linear, reduceMotion: ReduceMotion.Never,
        }), -1, false);
        return () => cancelAnimation(clock);
    }, [clock, compact, reduced, relay]);
    return (
        <View accessibilityRole="progressbar" accessibilityLabel={props.label} style={[{ width, height: size }, props.style]}>
            <Svg width={width} height={size} viewBox={MARK_VIEWBOX}>
                <Wedge clock={clock} right={false} opacityOnly={compact || relay} floor={relay ? .22 : .28}
                    reduced={reduced} color={props.color ?? JUAN.accent} />
                <Wedge clock={clock} right opacityOnly={compact || relay} floor={relay ? .22 : .28}
                    reduced={reduced} color={props.color ?? JUAN.accent} />
            </Svg>
        </View>
    );
});
function Wedge(props: { clock: SharedValue<number>; right: boolean; opacityOnly: boolean;
    floor: number; reduced: boolean; color: string }) {
    const { clock, right, opacityOnly, floor, reduced } = props;
    const animatedProps = useAnimatedProps(() => {
        if (reduced) return { opacity: 1, transform: 'translate(0 0)' };
        const t = clock.value;
        if (opacityOnly) {
            const wave = (1 - Math.cos(2 * Math.PI * t)) / 2;
            return { opacity: right ? floor + (1 - floor) * wave : 1 - (1 - floor) * wave, transform: 'translate(0 0)' };
        }
        const amount = t < .46 ? curve(t / .46) : t <= .58 ? 1 : 1 - curve((t - .58) / .42);
        return { opacity: 1, transform: `translate(${(right ? -2 : 2) * amount} 0)` };
    });
    return <AnimatedPath d={right ? MARK_RIGHT : MARK_LEFT} fill={props.color} stroke={props.color}
        strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" animatedProps={animatedProps} />;
}
