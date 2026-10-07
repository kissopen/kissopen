import * as React from 'react';
import { Platform, StyleSheet as RNStyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useThemeBackground } from './useTheme';
import { alpha } from '@/themeDoc';

/**
 * A theme's background picture, under the home screen: the picture, blurred
 * as the theme says, with the canvas colour laid over it at 1 − opacity so
 * the text on top stays readable. Nothing is drawn when the theme has none.
 */
export const ThemeBackdrop = React.memo(function ThemeBackdrop() {
    const background = useThemeBackground();
    const { theme } = useUnistyles();
    if (!background) return null;
    const opacity = Math.min(1, Math.max(0.05, background.opacity || 0.3));
    const blur = Math.min(40, Math.max(0, background.blur || 0));
    return (
        <View style={styles.fill} pointerEvents="none">
            <Image
                source={{ uri: background.url }}
                style={RNStyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={blur}
                cachePolicy="disk"
                transition={Platform.OS === 'web' ? 0 : 200}
            />
            <View style={[styles.fill, { backgroundColor: alpha(theme.colors.groupped.background, 1 - opacity) }]} />
        </View>
    );
});

const styles = StyleSheet.create(() => ({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
}));
