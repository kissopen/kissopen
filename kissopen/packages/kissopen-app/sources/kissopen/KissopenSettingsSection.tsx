import * as React from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { client } from './api/client';
import { APIError } from './api/protocol';
import type { User } from './api/types';
import { t } from '@/text';

/** Account and service details shared by the Me page and legacy settings route. */
export function KissopenSettingsSection() {
    return <ItemGroup title={t('kissopen.settings.accountAndServices')}>
        <KissopenAccountRows />
    </ItemGroup>;
}

/** Account rows can join an existing group without adding a nested card. */
export function KissopenAccountRows({ showDivider }: { showDivider?: boolean }) {
    const router = useRouter();
    const { theme } = useUnistyles();
    const [user, setUser] = React.useState<User>();
    const [ready, setReady] = React.useState(false);
    const [error, setError] = React.useState('');
    const [revision, retry] = React.useReducer(value => value + 1, 0);
    useFocusEffect(React.useCallback(() => {
        let alive = true;
        setError('');
        void (async () => {
            try {
                const me = await client.me();
                if (!alive) return;
                setUser(me);
            } catch (e) {
                if (!alive) return;
                if (e instanceof APIError && e.status === 401) setUser(undefined);
                else setError(e instanceof Error ? e.message : t('kissopen.settings.accountReadFailed'));
            } finally { if (alive) setReady(true); }
        })();
        return () => { alive = false; };
    }, [revision]));
    const icon = (name: React.ComponentProps<typeof Ionicons>['name']) => <Ionicons name={name} size={26} color={theme.colors.home.accent} />;
    return <>
        {!ready ? <Item title={t('kissopen.settings.loadingAccount')} loading showDivider={showDivider} /> : user ? <>
            {/* Provider accounts have a display name, not a fabricated phone number. */}
            <Item title={t('kissopen.settings.account')} subtitle={user.display_name || user.phone || 'KissOpen'} icon={icon('person-circle-outline')} showChevron={false} showDivider={showDivider} />
        </> : !error && <Item title={t('kissopen.settings.signIn')} subtitle={t('kissopen.settings.signInSubtitle')} icon={icon('person-circle-outline')} onPress={() => router.push('/chat')} showDivider={showDivider} />}
        {!!error && <Item title={t('kissopen.settings.reloadAccount')} subtitle={error} onPress={retry} showDivider={showDivider} />}
    </>;
}

/**
 * Signing out, at the very bottom of the account page. It reads the account itself so
 * it appears only while one is signed in; the session-ended event then resets
 * every mounted account view before the app returns to its start.
 */
export function KissopenSignOut() {
    const router = useRouter();
    const { theme } = useUnistyles();
    const [signedIn, setSignedIn] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    useFocusEffect(React.useCallback(() => {
        let alive = true;
        void client.me()
            .then(() => { if (alive) setSignedIn(true); })
            .catch(e => { if (alive && e instanceof APIError && e.status === 401) setSignedIn(false); });
        return () => { alive = false; };
    }, []));
    if (!signedIn) return null;
    const signOut = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await client.logout();
        } catch {
            // The server may already have ended it; forget it here regardless.
            await client.forgetSession();
        } finally {
            setBusy(false);
        }
        setSignedIn(false);
        router.dismissTo(Platform.OS === 'web' ? '/chat' : '/');
    };
    // Room below, so the last row does not sit on the screen's bottom edge.
    return <ItemGroup style={{ marginBottom: 48 }}>
        <Item title={t('common.logout')} icon={<Ionicons name="log-out-outline" size={29} color={theme.colors.textDestructive} />} destructive loading={busy} disabled={busy} onPress={() => void signOut()} showChevron={false} />
    </ItemGroup>;
}
