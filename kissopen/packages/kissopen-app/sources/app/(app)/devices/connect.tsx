import * as React from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { useAllMachines, useIsDataReady, useSocketStatus } from '@/sync/storage';
import { CommunityAuthClient, communityAuthorizationWait } from '@kissopen/kissopen-sync/communityAuth';
import { communityWorkspaceConnect, CommunityWorkspaceUnavailableError } from '@kissopen/kissopen-sync/communityWorkspace';
import { getServerUrl } from '@/sync/serverConfig';
import { readSession } from '@/kissopen/platform/transport';
import { communityWorkspaceKeyRead, communityWorkspaceKeySave } from '@/auth/communityWorkspaceKeys';
import { BrandButton, BrandScreen, brand, brandStyles, onboardingText as copy } from '@/components/onboarding/BrandScreen';
import { KissopenGlyph } from '@/kissopen/KissopenGlyph';
import { Modal } from '@/modal';
import sodium from '@/encryption/libsodium.lib';
import { decodeBase64 } from '@/encryption/base64';
import { isMachineOnline } from '@/utils/machineUtils';

type ConnectionPhase = 'connecting' | 'restoring' | 'peer-required' | 'key-mismatch' | 'error';

/** Account access survives connection failures. Only this page owns bootstrap. */
export default function DeviceConnection() {
    const auth = useAuth();
    const currentAuth = React.useRef(auth); currentAuth.current = auth;
    const router = useRouter();
    const machines = useAllMachines({ includeOffline: true });
    const dataReady = useIsDataReady();
    // Device discovery follows the account sync socket, not a voice call.
    const { status: socketStatus } = useSocketStatus();
    const [phase, setPhase] = React.useState<ConnectionPhase>('connecting');
    const [error, setError] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);
    const recovery = React.useRef<string | null>(null);
    const [foreground, setForeground] = React.useState(AppState.currentState !== 'background');
    const accountId = auth.account?.id;
    React.useEffect(() => () => { recovery.current = null; }, [accountId]);

    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
        return () => subscription.remove();
    }, []);
    React.useEffect(() => {
        if (!accountId || auth.isAuthenticated || !foreground) return;
        const active = new AbortController();
        void (async () => {
            await sodium.ready;
            const token = await readSession();
            if (!token || active.signal.aborted) return;
            const origin = getServerUrl();
            const client = new CommunityAuthClient(origin);
            while (!active.signal.aborted) {
                setPhase('connecting'); setError('');
                try {
                    const workspace = await communityWorkspaceConnect({ client, token, identityId: accountId, signal: active.signal,
                        read: async () => recovery.current ?? await communityWorkspaceKeyRead(origin, accountId),
                        readLegacy: async () => currentAuth.current.credentials?.secret ?? null,
                        save: secret => communityWorkspaceKeySave(origin, accountId, secret),
                        waiting: () => { if (!active.signal.aborted) setPhase('restoring'); },
                    });
                    if (active.signal.aborted) return;
                    recovery.current = null;
                    await currentAuth.current.login(workspace.workspaceToken, workspace.secret, accountId);
                    return;
                } catch (failure) {
                    if (active.signal.aborted) return;
                    recovery.current = null;
                    if ((failure as { status?: number }).status === 401) { await currentAuth.current.logout(); return; }
                    if (failure instanceof CommunityWorkspaceUnavailableError) setPhase(failure.reason);
                    else { setPhase('error'); setError(failure instanceof Error ? failure.message : copy('Connection unavailable.', '暂时无法连接。')); }
                    // A slow/offline peer is not a sign-in failure. Remain signed
                    // in and start a new bounded request automatically in foreground.
                    await communityAuthorizationWait(15000, active.signal);
                }
            }
        })().catch(failure => { if (!active.signal.aborted) { setPhase('error'); setError(failure instanceof Error ? failure.message : 'Connection unavailable.'); } });
        return () => active.abort();
    }, [accountId, auth.isAuthenticated, foreground, attempt]);

    if (!auth.accountLoading && !auth.account) return <Redirect href="/" />;
    const workspaceReady = auth.isAuthenticated;
    const online = machines.some(isMachineOnline);
    const connected = workspaceReady && dataReady && socketStatus === 'connected' && online;
    const needsRecovery = !workspaceReady && (phase === 'restoring' || phase === 'peer-required' || phase === 'key-mismatch');
    const restore = async () => {
        const secret = await Modal.prompt(copy('Restore workspace', '恢复工作区'),
            copy('Enter the key from your original device. After verifying it matches this account, KissOpen will migrate it to encrypted server escrow for future sign-ins.', '输入原设备的密钥。验证与此账号匹配后，KissOpen 会将它迁入服务端加密托管，后续登录无需再次输入。'),
            { inputType: 'secure-text', confirmText: copy('Restore', '恢复'), cancelText: copy('Cancel', '取消') });
        if (!secret?.trim()) return;
        let decoded: Uint8Array | undefined;
        try {
            const value = secret.trim();
            if (!/^[A-Za-z0-9_-]{43}=?$/.test(value)) throw new Error('invalid');
            decoded = decodeBase64(value, 'base64url');
            if (decoded.length !== 32) throw new Error('invalid');
        } catch {
            Modal.alert(copy('Check your recovery key', '请检查恢复密钥'), copy('Enter the complete recovery key from your original device, not your password or a sign-in code.', '请输入原设备保存的完整恢复密钥，不是账号密码或登录验证码。'));
            return;
        } finally { decoded?.fill(0); }
        // Updating attempt cancels the prior ephemeral request; seed never goes
        // in route params, global state, logs or clipboard automatically.
        setAttempt(value => value + 1);
        // Effect cleanup must not erase the newly entered key. Its own lifetime
        // ends on successful bootstrap or the next failed attempt.
        recovery.current = secret.trim();
    };
    const step = (title: string, body: string, done: boolean, active: boolean) => <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            {done ? <Ionicons name="checkmark-circle" color={brand.accent} size={24} />
                : active ? <ActivityIndicator color={brand.accent} /> : <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: brand.line }} />}
        </View>
        <View style={{ flex: 1, gap: 5 }}><Text style={{ color: done || active ? brand.ink : brand.secondary, fontSize: 15 }}>{title}</Text>
            <Text style={{ color: brand.muted, fontSize: 13, lineHeight: 21 }}>{body}</Text></View>
    </View>;

    return <BrandScreen footer={<Text style={brandStyles.caption}>{copy('YOUR DEVICES. YOUR WORKSPACE.', '你的设备 · 你的工作区')}</Text>}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <KissopenGlyph size={24} />
            <Pressable accessibilityRole="button" onPress={() => void auth.logout()} style={{ paddingVertical: 10, paddingLeft: 16 }}>
                <Text style={{ color: brand.secondary, fontSize: 13 }}>{copy('Switch account', '切换账号')}</Text>
            </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 26, marginVertical: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <View style={{ padding: 20, backgroundColor: brand.surface, borderRadius: 14 }}><Ionicons name="phone-portrait-outline" color={brand.ink} size={32} /></View>
                <Ionicons name={connected ? 'checkmark' : 'swap-horizontal-outline'} color={brand.accent} size={24} />
                <View style={{ padding: 20, backgroundColor: brand.surface, borderRadius: 14 }}><Ionicons name="desktop-outline" color={brand.ink} size={32} /></View>
            </View>
            <View style={{ gap: 10 }}><Text style={brandStyles.heading}>{connected ? copy('Ready to pick up.', '已经连上，继续吧。') : copy('Connect your computer.', '连接你的电脑。')}</Text>
                <Text style={brandStyles.body}>{copy('Open KissOpen Desktop and sign in with the same account. No scanning needed.', '打开 KissOpen 桌面端，登录同一个账号，无需扫码。')}</Text>
            </View>
        </View>
        <View style={{ backgroundColor: brand.surface, borderRadius: 14, padding: 22, gap: 24 }}>
            {step(copy('Account signed in', '账号已登录'), auth.account?.name ?? '', !!accountId, !accountId)}
            {step(copy('Encrypted workspace', '加密工作区'), workspaceReady ? copy('Your workspace identity is verified.', '工作区身份已验证。')
                : needsRecovery ? copy('This older workspace needs a one-time key migration.', '旧工作区需要一次性迁移原密钥。')
                    : copy('Restoring your account workspace securely…', '正在安全恢复账号工作区…'), workspaceReady, !workspaceReady && phase !== 'error')}
            {step(copy('Computer connection', '桌面连接'), connected ? copy('Your computer is online.', '电脑已在线，可以继续工作。')
                : workspaceReady ? copy('Waiting for your computer and local Agent to come online.', '等待电脑和本地 Agent 上线。')
                    : copy('Discovery begins after workspace verification.', '工作区验证完成后自动发现设备。'), connected, workspaceReady && !connected)}
        </View>
        <Text style={brandStyles.body}>{copy('Your account server stores workspace keys encrypted and restores them after sign-in. Models and tools still run on your computer.', '账号服务加密托管工作区密钥，登录后自动恢复。模型与工具仍在你的电脑上运行。')}</Text>
        {needsRecovery ? <View style={{ gap: 10 }}><Text style={brandStyles.body}>{copy('Open the original device or enter its saved key once. Your history will not be replaced. Future sign-ins restore automatically.', '打开原设备，或输入它保存的密钥完成一次迁移。历史不会被覆盖，后续登录自动恢复。')}</Text>
            <BrandButton quiet title={copy('Use a recovery key', '使用恢复密钥')} onPress={() => void restore()} /></View> : null}
        {phase === 'key-mismatch' ? <Text style={brandStyles.error}>{copy('That key belongs to a different workspace. Your history is unchanged.', '密钥不属于当前账号的工作区。历史资料未被修改。')}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={brandStyles.error}>{error}</Text> : null}
        {!workspaceReady && (phase === 'error' || phase === 'peer-required' || phase === 'key-mismatch') ?
            <BrandButton quiet title={copy('Try connecting again', '重新连接')} onPress={() => setAttempt(value => value + 1)} /> : null}
        {workspaceReady ? machines.map(machine => <Pressable key={machine.id} accessibilityRole="button"
            onPress={() => router.push(`/machine/${machine.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: brand.surface, borderRadius: 8 }}>
            <Ionicons name="desktop-outline" color={brand.secondary} size={22} />
            <Text style={{ flex: 1, color: brand.ink, fontSize: 14 }} numberOfLines={1}>{machine.metadata?.displayName || machine.metadata?.host || copy('Computer', '电脑')}</Text>
            <Text style={{ color: isMachineOnline(machine) ? brand.accent : brand.muted, fontSize: 12 }}>{isMachineOnline(machine) ? copy('Online', '在线') : copy('Offline', '离线')}</Text>
        </Pressable>) : null}
        {connected ? <BrandButton title={copy('Continue to workspace', '进入工作区')} onPress={() => router.replace('/')} />
            : <BrandButton quiet title={copy('Get KissOpen Desktop', '下载桌面端')} onPress={() => void Linking.openURL('https://kissopen.com/#start')} />}
    </BrandScreen>;
}
