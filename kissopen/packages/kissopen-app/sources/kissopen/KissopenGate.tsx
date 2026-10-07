import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { KissopenBoot } from './KissopenBoot';
import { client } from './api/client';
import { APIError } from './api/protocol';
import { LoginScreen } from './LoginScreen';
import { onConsumerSessionEnded, onConsumerSessionStarted, onPersonaSaved } from './sessionEvents';
import { cloudCache, cloudCacheClear } from './cloudCache';
import { PersonaSetup } from './PersonaSetup';
import { personaNeeded } from './personaAnswers';
import type { User } from './api/types';
import { t } from '@/text';

type GateState = { phase: 'checking' } | { phase: 'in' } | { phase: 'persona' } | { phase: 'out'; smsReady: boolean } | { phase: 'offline'; message: string };

/**
 * Nothing in the app is usable until someone has signed in. Every route sits
 * behind this gate, so a deep link or a settings screen cannot be reached
 * around it; signing out closes it again at once.
 *
 * A server that cannot be reached is not the same as being signed out: the
 * gate says so and offers to try again, rather than asking for a login that
 * could not be checked either.
 *
 * An account this phone already signed in to (its answers are in the
 * cloudCache) opens at once and stays open without a connection, showing
 * what was last seen; the check still runs, and a server that refuses the
 * session closes the gate and forgets the cache.
 *
 * An account that has not yet said what its work is (nor skipped saying) is
 * asked first, as on the desktop: the home page is written from the answer.
 */
export function KissopenGate(props: { children: React.ReactNode }) {
    const [state, setState] = React.useState<GateState>(() => cloudCache.hasAccount() ? signedIn(cloudCache.user()) : { phase: 'checking' });
    const check = React.useCallback(async () => {
        const known = cloudCache.hasAccount();
        if (!known) setState({ phase: 'checking' });
        try {
            setState(signedIn(await client.me()));
        } catch (e) {
            if (e instanceof APIError && e.status === 401) {
                cloudCacheClear();
                const config = await client.config().catch(() => undefined);
                setState({ phase: 'out', smsReady: !!config?.sms_ready });
            } else if (known) {
                setState(signedIn(cloudCache.user()));
            } else {
                setState({ phase: 'offline', message: e instanceof Error ? e.message : t('kissopen.errors.cannotConnect') });
            }
        }
    }, []);
    React.useEffect(() => { void check(); }, [check]);
    // A sign-in is followed by `/me`: whether to ask about the person's work
    // is on the account.
    React.useEffect(() => onConsumerSessionStarted(() => { void check(); }), [check]);
    React.useEffect(() => onPersonaSaved(() => setState(current => current.phase === 'persona' ? { phase: 'in' } : current)), []);
    React.useEffect(() => onConsumerSessionEnded(() => { void check(); }), [check]);

    if (state.phase === 'in') return <>{props.children}</>;
    if (state.phase === 'persona') return <PersonaSetup />;
    if (state.phase === 'out') return <LoginScreen smsReady={state.smsReady} />;
    // Still deciding: keep showing the boot screen, which is pixel-identical to
    // the native splash, so the gate's network check is not a second page.
    if (state.phase === 'checking') return <KissopenBoot />;
    return (
        <View style={styles.center}>
            <Text style={styles.text}>{state.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => void check()} style={styles.retry}><Text style={styles.link}>{t('common.retry')}</Text></Pressable>
        </View>
    );
}

function signedIn(user: User | undefined): GateState {
    return personaNeeded(user) ? { phase: 'persona' } : { phase: 'in' };
}

const styles = StyleSheet.create(theme => ({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, backgroundColor: theme.colors.groupped.background },
    text: { color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center' },
    retry: { paddingVertical: 8, paddingHorizontal: 16 },
    link: { color: theme.colors.text, fontSize: 15, textDecorationLine: 'underline' },
}));
