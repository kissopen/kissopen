import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentLanguage } from '@/text';

/** VI ground, neutral layers and restrained Blurple. Never glow the mark. */
export const brand = {
    ground: '#161826', indigo: '#262A60', surface: '#232532', line: '#3F424D',
    ink: '#F3F5FE', secondary: '#B2B6CA', muted: '#9397AB', accent: '#9184D9',
    inkOnAccent: '#1B1D29', error: '#FFC9C9',
} as const;

export function onboardingText(en: string, zh: string) {
    return getCurrentLanguage().startsWith('zh') ? zh : en;
}

export function BrandScreen({ children, footer, onLayout }: {
    children: React.ReactNode; footer?: React.ReactNode; onLayout?: () => void;
}) {
    const insets = useSafeAreaInsets();
    return <LinearGradient colors={[brand.indigo, brand.ground, brand.ground]}
        locations={[0, .6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={brandStyles.root} onLayout={onLayout}>
        <StatusBar style="light" />
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
            contentContainerStyle={[brandStyles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={brandStyles.content}>{children}</View>
            {footer ? <View style={brandStyles.footer}>{footer}</View> : null}
        </ScrollView>
    </LinearGradient>;
}

export function BrandLockup({ width = 172 }: { width?: number }) {
    return <Image source={require('../../assets/images/kissopen-lockup-vertical-primary.png')}
        contentFit="contain" style={{ width, aspectRatio: 384 / 176 }} accessibilityLabel="KissOpen" />;
}

export function BrandButton({ title, onPress, disabled, busy, quiet = false }: {
    title: string; onPress(): void; disabled?: boolean; busy?: boolean; quiet?: boolean;
}) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!busy }}
        disabled={disabled || busy} onPress={onPress}
        style={({ pressed }) => [brandStyles.button, quiet ? brandStyles.quietButton : brandStyles.primaryButton,
            { opacity: disabled ? .4 : pressed ? .75 : 1 }]}>
        {busy ? <ActivityIndicator color={quiet ? brand.ink : brand.inkOnAccent} /> : null}
        <Text style={[brandStyles.buttonText, { color: quiet ? brand.ink : brand.inkOnAccent }]}>{title}</Text>
    </Pressable>;
}

export const brandStyles = StyleSheet.create({
    root: { flex: 1, backgroundColor: brand.ground },
    scroll: { flexGrow: 1, paddingHorizontal: 28, justifyContent: 'center' },
    content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 },
    footer: { alignSelf: 'center', width: '100%', maxWidth: 420, marginTop: 38, alignItems: 'center' },
    heading: { color: brand.ink, fontSize: 28, lineHeight: 36, fontWeight: '500', textAlign: 'center' },
    body: { color: brand.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
    caption: { color: brand.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', letterSpacing: 1.2 },
    label: { color: brand.secondary, fontSize: 12, marginBottom: 8 },
    input: { color: brand.ink, fontSize: 16, paddingHorizontal: 16, paddingVertical: 15,
        minHeight: 52, backgroundColor: brand.surface, borderColor: brand.line, borderWidth: 1, borderRadius: 8 },
    button: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    primaryButton: { backgroundColor: brand.accent },
    quietButton: { backgroundColor: brand.surface, borderWidth: 1, borderColor: brand.line },
    buttonText: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
    error: { color: brand.error, fontSize: 13, lineHeight: 21, textAlign: 'center' },
});
