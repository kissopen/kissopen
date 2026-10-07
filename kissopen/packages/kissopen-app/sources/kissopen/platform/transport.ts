import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { t } from '@/text';
import { communityAccountOrigin } from '@/communityServer';
import { CommunityAuthClient } from '@kissopen/kissopen-sync/communityAuth';
import { getServerUrl } from '@/sync/serverConfig';

export const nativeSession = Platform.OS !== 'web';
const sessionKey = 'kissopen.oss.account.session.v1';
const origin = communityAccountOrigin;
const scopedSessionKey = sessionKey + '.' + Array.from(origin ?? '').map(c => c.charCodeAt(0).toString(16)).join('');
/** The account server itself, for pages it serves rather than its API, such as the document viewer. */
export const serverOrigin = origin ?? '';

export async function saveSession(token: string) {
    if (nativeSession) await SecureStore.setItemAsync(scopedSessionKey, token);
    else globalThis.sessionStorage.setItem(scopedSessionKey, token);
}
export async function clearSession() {
    if (nativeSession) await SecureStore.deleteItemAsync(scopedSessionKey);
    else globalThis.sessionStorage.removeItem(scopedSessionKey);
}
export async function endSession() {
    const token = await readSession();
    await clearSession();
    // End the independent OAuth session too; offline sign-out still clears this device.
    if (token) await new CommunityAuthClient(getServerUrl()).signOut(token).catch(() => undefined);
}
export async function readSession() {
    return nativeSession ? SecureStore.getItemAsync(scopedSessionKey) : globalThis.sessionStorage.getItem(scopedSessionKey);
}
/**
 * The request never got an answer: it ran out of time, or there was no network.
 * Its message is written for people ("Aborted" is what React Native says), and
 * a read the screen makes on its own can tell it apart and simply try again.
 */
export class TransportError extends Error {}

/*
Reads still waiting when the app leaves the screen.

iOS freezes a backgrounded app and drops its connections, so a read that was
under way just then never answers: on return it sat out its whole 30 seconds
and ended as "Aborted" — the server never saw it — while the screen could not
read again until it had. A read is only ever a read, so it is let go the moment
the app is put away, and the screens read afresh as they come back. Writes are
left to finish: a message being sent is not taken back for switching apps.
*/
const pendingReads = new Set<AbortController>();
AppState.addEventListener('change', state => {
    if (state !== 'background') return;
    for (const controller of pendingReads) controller.abort();
    pendingReads.clear();
});

export async function request(path: string, method = 'GET', body?: unknown) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error(t('kissopen.errors.invalidPath'));
    if (!origin) throw new TransportError('社区账号服务尚未配置。请先配置独立的社区服务，不要使用商业版手机号登录。');
    const token = await readSession();
    const controller = new AbortController();
    // A document is converted while the request waits, which a large deck takes a while to do.
    const timeout = setTimeout(() => controller.abort(), path === '/documents/pdf' ? 120000 : 30000);
    if (method === 'GET') pendingReads.add(controller);
    try {
        const response = await fetch(`${origin}/api${path}`, {
            method,
            credentials: 'omit',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'X-KISSOPEN-Request': '1',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, text: await response.text() };
    } catch (e) {
        throw new TransportError(controller.signal.aborted ? t('kissopen.errors.timedOut') : t('kissopen.errors.cannotConnect'), { cause: e });
    } finally {
        clearTimeout(timeout);
        pendingReads.delete(controller);
    }
}
