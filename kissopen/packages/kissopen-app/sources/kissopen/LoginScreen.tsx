import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { KissopenLockup } from './KissopenLockup';
import { PhoneLogin } from './PhoneLogin';
import { client } from './api/client';
import { t } from '@/text';

/** The whole screen while nobody is signed in: the wordmark and phone login, nothing else. */
export function LoginScreen(props: { smsReady: boolean; banner?: React.ReactNode; onLoggedIn?: () => Promise<void> | void }) {
    const insets = useSafeAreaInsets();
    return (
        <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
                <View style={styles.card}>
                    <View style={styles.wordmark}><KissopenLockup height={36} /></View>
                    {props.banner}
                    <PhoneLogin available={props.smsReady} onCodeRequest={client.code}
                        onLogin={async (phone, code) => { await client.login(phone, code); await props.onLoggedIn?.(); }} />
                    <Text style={styles.footer}>{t('kissopen.login.tagline')}</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.groupped.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },
    card: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 14 },
    wordmark: { marginBottom: 16 },
    footer: { color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 28 },
}));
