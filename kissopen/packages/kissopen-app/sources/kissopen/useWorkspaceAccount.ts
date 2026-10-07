import { consumerSessionVersion } from './sessionEvents';
import * as React from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { getServerUrl, setServerUrl } from '@/sync/serverConfig';
import { api } from './api/client';
import { t } from '@/text';
import { communityAccountOrigin } from '@/communityServer';
import { readSession } from './platform/transport';
import { CommunityAuthClient } from '@kissopen/kissopen-sync/communityAuth';

// Login restores the same account identity on every phone. All session data and
// actions still use the original Kissopen sync engine and encrypted transport.
export function useWorkspaceAccount(userId: string | undefined) {
    const auth = useAuth();
    const authRef = React.useRef(auth); authRef.current = auth;
    const [error, setError] = React.useState('');
    const [linkedUser, setLinkedUser] = React.useState<string>();
    React.useEffect(() => {
        if (!userId) { setLinkedUser(undefined); setError(''); return; }
        let alive = true;
        let running = false;
        const connect = async () => {
            if (!alive || running || AppState.currentState === 'background') return;
            running = true;
            const version = consumerSessionVersion();
            try {
                if (communityAccountOrigin) {
                    // Community keys are device-owned. Never invoke the old
                    // server-managed-secret bootstrap or replace encrypted history.
                    const token = await readSession();
                    if (!token) throw new Error(t('kissopen.errors.workspaceReconnecting'));
                    const identity = await new CommunityAuthClient(getServerUrl()).account(token);
                    if (!alive || version !== consumerSessionVersion()) return;
                    if (authRef.current.credentials?.kissopenUserId !== identity.id)
                        throw new Error(t('kissopen.errors.accountChanged'));
                    setLinkedUser(userId); setError('');
                    return;
                }
                const session = await api<{ user_id: string; secret: string; token: string; server_url: string }>('/workspace/session', 'POST', {});
                if (!alive || version !== consumerSessionVersion()) return;
                if (session.user_id !== userId) throw new Error(t('kissopen.errors.accountChanged'));
                const current = authRef.current;
                if (current.credentials?.kissopenUserId !== userId || current.credentials.secret !== session.secret || getServerUrl() !== session.server_url) {
                    setServerUrl(session.server_url);
                    await current.login(session.token, session.secret, userId);
                }
                if (alive) { setLinkedUser(userId); setError(''); }
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : t('kissopen.errors.workspaceReconnecting'));
            } finally { running = false; }
        };
        void connect();
        const timer = setInterval(() => void connect(), 30000);
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') void connect(); });
        return () => { alive = false; clearInterval(timer); subscription.remove(); };
    }, [userId]);
    return { ready: !!userId && linkedUser === userId && auth.credentials?.kissopenUserId === userId, error };
}
