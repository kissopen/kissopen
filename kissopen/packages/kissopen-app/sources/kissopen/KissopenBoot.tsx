import * as React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { BrandLockup, brand, brandStyles } from '@/components/onboarding/BrandScreen';

/** VI's mobile cover: deep indigo to Ground, fixed geometry, no glow. */
export const KissopenBoot = React.memo(function KissopenBoot({ onLayout }: { onLayout?: () => void }) {
    const reduced = useReducedMotion();
    const opacity = useSharedValue(reduced ? 1 : .65);
    React.useEffect(() => {
        opacity.value = withTiming(1, { duration: reduced ? 0 : 650 });
        return () => cancelAnimation(opacity);
    }, [opacity, reduced]);
    const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return <LinearGradient colors={[brand.indigo, brand.ground]} locations={[0, .75]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={onLayout}>
        <StatusBar style="light" />
        <Animated.View style={fade}><BrandLockup width={168} /></Animated.View>
        <View style={{ position: 'absolute', bottom: 80, left: 28, right: 28 }}>
            <Text style={brandStyles.caption}>KEEP IT SIMPLE &amp; STUPID</Text>
        </View>
    </LinearGradient>;
});
