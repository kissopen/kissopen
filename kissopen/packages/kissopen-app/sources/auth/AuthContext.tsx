import { onConsumerSessionEnded, consumerSessionVersion } from '@/kissopen/sessionEvents';
import { endSession } from '@/kissopen/platform/transport';
import { readSession } from '@/kissopen/platform/transport';
import { getServerUrl } from '@/sync/serverConfig';
import { CommunityAuthClient, communityAuthorizationWait, type CommunityProfile } from '@kissopen/kissopen-sync/communityAuth';
import { saveSession } from '@/kissopen/platform/transport';
import { communityAccountOrigin } from '@/communityServer';
import { communityWorkspaceConnect } from '@kissopen/kissopen-sync/communityWorkspace';
import sodium from '@/encryption/libsodium.lib';
import { communityWorkspaceKeySave } from '@/auth/communityWorkspaceKeys';
import { decodeBase64 } from '@/encryption/base64';
import { apiSocket } from '@/sync/apiSocket';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TokenStorage, AuthCredentials } from '@/auth/tokenStorage';
import { syncCreate, syncRestore } from '@/sync/sync';
import * as Updates from 'expo-updates';
import { reloadAppAsync } from 'expo';
import { clearPersistence, loadRegisteredPushToken } from '@/sync/persistence';
import { relayCacheClear } from '@/sync/offlineCache/relayCache';
import { cloudCacheClear } from '@/kissopen/cloudCache';
import { unregisterPushToken } from '@/sync/apiPush';
import { AppState, Platform } from 'react-native';
import { trackLogout } from '@/track';
import { getCurrentLanguage } from '@/text';

interface AuthContextType {
    isAuthenticated: boolean;
    credentials: AuthCredentials | null;
    login: (token: string, secret: string, kissopenUserId?: string) => Promise<void>;
    logout: () => Promise<void>;
    account: CommunityProfile | null;
    accountLoading: boolean;
    accountError: string | null;
    accountLogin: (token: string, profile: CommunityProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Everything this phone kept for the account: settings and drafts, and the
 * offline caches of its conversations, lists, boards and cloud answers.
 * Nothing of one account may be shown to the next.
 */
async function clearAccountData() {
    clearPersistence();
    cloudCacheClear();
    await relayCacheClear();
}

export function AuthProvider({ children, initialCredentials }: { children: ReactNode; initialCredentials: AuthCredentials | null }) {
    const [isAuthenticated, setIsAuthenticated] = useState(!communityAccountOrigin && !!initialCredentials);
    const [credentials, setCredentials] = useState<AuthCredentials | null>(initialCredentials);
    const [account, setAccount] = useState<CommunityProfile | null>(null);
    const [accountLoading, setAccountLoading] = useState(!!communityAccountOrigin);
    const [accountError, setAccountError] = useState<string | null>(null);
    const restoringAccount = React.useRef<AbortController | null>(null);
    const [foreground, setForeground] = useState(AppState.currentState !== 'background');
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
        return () => subscription.remove();
    }, []);

    // Account sign-in is independent of encrypted-workspace recovery. A failed
    // device connection must not revoke an otherwise valid account session.
    useEffect(() => {
        if (!communityAccountOrigin) return;
        const active = new AbortController();
        restoringAccount.current = active;
        void (async () => {
            const token = await readSession();
            if (!token) { if (!active.signal.aborted) setAccountLoading(false); return; }
            const client = new CommunityAuthClient(getServerUrl());
            while (!active.signal.aborted) {
                try {
                    const profile = await client.account(token, active.signal);
                    if (active.signal.aborted) return;
                    const matchingCredentials = initialCredentials?.kissopenUserId === profile.id;
                    let workspaceReady = matchingCredentials;
                    // Do not hydrate an old account's decrypted cache before
                    // verifying who owns the current account session.
                    if (matchingCredentials) {
                        try { await syncRestore(initialCredentials!); }
                        catch { workspaceReady = false; }
                    }
                    if (active.signal.aborted) return;
                    setAccount(profile);
                    setAccountError(null);
                    setAccountLoading(false);
                    setIsAuthenticated(workspaceReady);
                    return;
                } catch (error) {
                    if (active.signal.aborted) return;
                    if ((error as { status?: number }).status === 401) {
                        await endSession();
                        setAccountLoading(false);
                        return;
                    }
                    setAccountError(error instanceof Error ? error.message : 'Cannot reach the account service.');
                    await communityAuthorizationWait(5000, active.signal);
                }
            }
        })().catch(() => undefined);
        return () => { active.abort(); if (restoringAccount.current === active) restoringAccount.current = null; };
    }, []);

    const accountLogin = async (token: string, profile: CommunityProfile) => {
        restoringAccount.current?.abort();
        if (credentials && credentials.kissopenUserId !== profile.id) {
            apiSocket.disconnect();
            await clearAccountData();
        }
        await saveSession(token);
        setAccount(profile);
        setAccountError(null);
        setAccountLoading(false);
        // Even an existing local key must pass the account escrow boundary on
        // fresh sign-in; do not mark a failed/uninitialised sync engine ready.
        setIsAuthenticated(false);
    };

    // Update global auth state when local state changes
    useEffect(() => {
        setCurrentAuth(isAuthenticated && credentials ? { isAuthenticated, credentials, login, logout, account, accountLoading, accountError, accountLogin } : null);
    }, [isAuthenticated, credentials, account, accountLoading, accountError]);

    // Migrate an existing phone's matching device-held seed into escrow once.
    // Normal new-device login no longer depends on a peer being online.
    useEffect(() => {
        if (!foreground || !isAuthenticated || !credentials?.kissopenUserId) return;
        const active = new AbortController();
        void (async () => {
            await sodium.ready;
            const token = await readSession();
            if (!token || active.signal.aborted) return;
            const client = new CommunityAuthClient(getServerUrl());
            const profile = await client.account(token, active.signal);
            if (profile.id !== credentials.kissopenUserId) return;
            while (!active.signal.aborted) {
                try {
                    await communityWorkspaceConnect({ client, token, identityId: profile.id, signal: active.signal,
                        read: async () => credentials.secret,
                        save: secret => communityWorkspaceKeySave(client.origin, profile.id, secret),
                    });
                    return;
                } catch (error) {
                    if (active.signal.aborted || (error as { status?: number }).status === 401) return;
                    await communityAuthorizationWait(15000, active.signal).catch(() => undefined);
                }
            }
        })().catch(() => undefined);
        return () => active.abort();
    }, [credentials, isAuthenticated, foreground]);

    const login = async (token: string, secret: string, kissopenUserId?: string) => {
        const sessionVersion = consumerSessionVersion();
        // Retain recovery of a previous anonymous/key-based workspace before
        // adopting account login. Never publish its history under a new identity.
        if (credentials && !credentials.kissopenUserId && credentials.secret !== secret) {
            await sodium.ready;
            const legacyKey = sodium.crypto_sign_seed_keypair(decodeBase64(credentials.secret, 'base64url'));
            const legacyId = Array.from(legacyKey.publicKey, value => value.toString(16).padStart(2, '0')).join('');
            legacyKey.privateKey.fill(0);
            await communityWorkspaceKeySave(getServerUrl(), 'legacy-' + legacyId, credentials.secret);
        }
        const newCredentials: AuthCredentials = { token, secret, ...(kissopenUserId ? { kissopenUserId } : {}) };
        const success = await TokenStorage.setCredentials(newCredentials);
        if (success) {
            if (kissopenUserId && sessionVersion !== consumerSessionVersion()) {
                await TokenStorage.removeCredentials();
                return;
            }
            if (credentials && (credentials.secret !== secret || credentials.kissopenUserId !== kissopenUserId)) {
                apiSocket.disconnect();
                await clearAccountData();
                if (Platform.OS === 'web') window.location.reload();
                else await reloadAppAsync('KISSOPEN-workspace-account');
                return;
            }
            await syncCreate(newCredentials);
            if (kissopenUserId && sessionVersion !== consumerSessionVersion()) return;
            setCredentials(newCredentials);
            setIsAuthenticated(true);
        } else {
            throw new Error('Failed to save credentials');
        }
    };

    const logout = async () => {
        // Close protected routes and cancel bootstrap/delivery before waiting
        // for a potentially offline server to acknowledge sign-out.
        setIsAuthenticated(false);
        setAccount(null);
        restoringAccount.current?.abort();
        setAccountLoading(true);
        setAccountError(getCurrentLanguage().startsWith('zh') ? '正在退出登录…' : 'Signing out…');
        apiSocket.disconnect();
        await endSession();
        trackLogout();
        const registeredPushToken = credentials ? loadRegisteredPushToken() : null;
        if (credentials && registeredPushToken) {
            try {
                await unregisterPushToken(credentials, registeredPushToken);
            } catch (error) {
                console.log('Failed to unregister push token during logout:', error);
            }
        }
        await clearAccountData();
        await TokenStorage.removeCredentials();
        
        // Update React state to ensure UI consistency
        setCredentials(null);
        setIsAuthenticated(false);
        setAccount(null);
        setAccountError(null);
        setAccountLoading(false);
        
        if (Platform.OS === 'web') {
            window.location.reload();
        } else {
            try {
                await Updates.reloadAsync();
            } catch (error) {
                // Kissopen builds without an owned OTA project still need a
                // complete restart to discard the previous account's sync keys.
                await reloadAppAsync('kissopen-sign-out');
            }
        }
    };

    useEffect(() => onConsumerSessionEnded(async () => {
        // A consumer logout also ends its workspace access. Legacy identities are
        // never silently associated with a different consumer account.
        const active = await TokenStorage.getCredentials();
        if (active) await logout();
    }), [credentials]);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                credentials,
                login,
                logout,
                account, accountLoading, accountError, accountLogin,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper to get current auth state for non-React contexts
let currentAuthState: AuthContextType | null = null;

export function setCurrentAuth(auth: AuthContextType | null) {
    currentAuthState = auth;
}

export function getCurrentAuth(): AuthContextType | null {
    return currentAuthState;
}
