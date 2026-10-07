import * as React from 'react';
import { Platform, RefreshControl, Share, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { client, type InviteInfo, type InviteeStatus } from './api/client';
import { inviteShareContent } from './inviteSharing';

const INVITE_LOGO = require('@/assets/images/kissopen-icon.png');

const statusLabels: Record<InviteeStatus, () => string> = {
    bound: () => t('kissopen.invite.statusBound'),
    review: () => t('kissopen.invite.statusReview'),
    rewarded: () => t('kissopen.invite.statusRewarded'),
    capped: () => t('kissopen.invite.statusCapped'),
    rejected: () => t('kissopen.invite.statusRejected'),
    revoked: () => t('kissopen.invite.statusRevoked'),
};

/** Native invitation hub. Rewards and links always come from the signed-in account. */
export const InviteScreen = React.memo(function InviteScreen() {
    const { theme } = useUnistyles();
    const [info, setInfo] = React.useState<InviteInfo>();
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [sharing, setSharing] = React.useState(false);
    const active = React.useRef(false);
    const revision = React.useRef(0);
    const sharingLock = React.useRef(false);
    const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const refresh = React.useCallback(async () => {
        const request = ++revision.current;
        setRefreshing(true);
        setError('');
        try {
            const latest = await client.invite();
            if (active.current && request === revision.current) setInfo(latest);
        } catch {
            if (active.current && request === revision.current) setError(t('kissopen.invite.loadFailed'));
        } finally {
            if (active.current && request === revision.current) setRefreshing(false);
        }
    }, []);
    useFocusEffect(React.useCallback(() => {
        active.current = true;
        setSharing(sharingLock.current);
        setNotice('');
        void refresh();
        return () => {
            active.current = false;
            revision.current++;
            if (noticeTimer.current) clearTimeout(noticeTimer.current);
        };
    }, [refresh]));

    const say = (message: string) => {
        if (!active.current) return;
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        setNotice(message);
        noticeTimer.current = setTimeout(() => { if (active.current) setNotice(''); }, 4000);
    };
    const copy = async (kind: 'link' | 'code') => {
        const value = kind === 'link' ? info?.link : info?.code;
        if (!value) return;
        try {
            await Clipboard.setStringAsync(value);
            say(t(kind === 'link' ? 'kissopen.invite.copiedLink' : 'kissopen.invite.copiedCode'));
        } catch {
            say(t('kissopen.invite.actionFailed'));
        }
    };
    const share = async () => {
        if (!info?.link || sharingLock.current) return;
        sharingLock.current = true;
        setSharing(true);
        try {
            const message = info.enabled && info.invitee_points > 0
                ? t('kissopen.invite.shareMessage', { name: t('common.appName'), points: info.invitee_points })
                : t('kissopen.invite.shareMessagePlain', { name: t('common.appName') });
            let logoUri: string | undefined;
            if (Platform.OS === 'ios') {
                try {
                    const logo = await Asset.fromModule(INVITE_LOGO).downloadAsync();
                    if (!logo.localUri) throw new Error('Logo file is unavailable');
                    logoUri = logo.localUri;
                } catch {
                    say(t('kissopen.invite.logoFailed'));
                    return;
                }
            }
            if (!active.current) return;
            await Share.share(inviteShareContent(Platform.OS, message, info.link, logoUri), { subject: t('common.appName') });
            // A dismissed sheet is not a completed invitation; only the server records rewards.
        } catch {
            say(t('kissopen.invite.actionFailed'));
        } finally {
            sharingLock.current = false;
            if (active.current) setSharing(false);
        }
    };
    const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={26} color={theme.colors.home.accent} />;

    return <ItemList
        containerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={!!info && refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.home.accent} />}
    >
        <ItemGroup>
            <View style={styles.hero}>
                <View style={styles.gift}>{icon('gift-outline')}</View>
                <Text accessibilityRole="header" style={styles.headline}>{t('kissopen.invite.headline')}</Text>
                <Text style={styles.body}>{t('kissopen.invite.lead')}</Text>
                {!!info?.enabled && <View style={styles.rewards}>
                    <View style={styles.reward}>
                        <Text style={styles.label}>{t('kissopen.invite.youGet')}</Text>
                        <Text style={styles.points}>+{t('kissopen.invite.points', { points: info.inviter_points })}</Text>
                        <Text style={styles.caption}>{t('kissopen.invite.afterFirstUse')}</Text>
                    </View>
                    <View style={[styles.reward, styles.friendReward]}>
                        <Text style={styles.label}>{t('kissopen.invite.friendGets')}</Text>
                        <Text style={styles.points}>+{t('kissopen.invite.points', { points: info.invitee_points })}</Text>
                        <Text style={styles.caption}>{t('kissopen.invite.afterSignup')}</Text>
                    </View>
                </View>}
                {!!info && <Text style={styles.body}>
                    {!info.enabled ? t('kissopen.invite.paused') : info.remaining_points === 0 && info.max_rewarded > 0
                        ? t('kissopen.invite.capped') : info.max_rewarded > 0
                            ? t('kissopen.invite.mineMax', { points: info.max_rewarded * info.inviter_points }) : t('kissopen.invite.noLimit')}
                </Text>}
            </View>
        </ItemGroup>
        {!!error && <ItemGroup><Item title={t('common.retry')} subtitle={error} icon={icon('refresh-outline')} onPress={() => void refresh()} disabled={refreshing} /></ItemGroup>}
        {!info && !error && <ItemGroup><Item title={t('common.loading')} loading /></ItemGroup>}
        {!!info && <>
            <ItemGroup title={t('kissopen.invite.shareTitle')}>
                <View style={styles.linkCard}>
                    <View style={styles.shareBrand}>
                        <Image source={INVITE_LOGO} style={styles.shareLogo} accessibilityLabel={t('common.appName')} />
                        <Text style={styles.label}>{t('common.appName')}</Text>
                    </View>
                    <Text style={styles.label}>{t('kissopen.invite.linkLabel')}</Text>
                    <Text selectable style={styles.link}>{info.link || t('kissopen.invite.missingLink')}</Text>
                    <RoundButton title={t('kissopen.invite.shareAction')} onPress={() => void share()} disabled={!info.link} loading={sharing} />
                    <RoundButton title={t('kissopen.invite.copyLink')} display="inverted" size="normal" action={() => copy('link')} disabled={!info.link} />
                    {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
                </View>
                <Item title={t('kissopen.invite.codeLabel')} detail={info.code} icon={icon('copy-outline')} onPress={() => void copy('code')} disabled={!info.code} showChevron={false} />
            </ItemGroup>
            <ItemGroup title={t('kissopen.invite.statsTitle')}>
                <View style={styles.stats}>
                    {[
                        { label: t('kissopen.invite.invited'), value: info.invited },
                        { label: t('kissopen.invite.rewarded'), value: info.rewarded },
                        { label: t('kissopen.invite.earned'), value: info.earned_points },
                    ].map(stat => <View key={stat.label} style={styles.stat}>
                        <Text style={styles.statValue}>{stat.value.toLocaleString()}</Text>
                        <Text style={styles.caption}>{stat.label}</Text>
                    </View>)}
                </View>
            </ItemGroup>
            <ItemGroup title={t('kissopen.invite.records')} footer={info.invitees.length >= 100 ? t('kissopen.invite.recordsLimit') : undefined}>
                {info.invitees.length ? info.invitees.map((friend, index) => <Item
                    key={`${friend.at}-${index}`}
                    title={friend.name}
                    subtitle={statusLabels[friend.status]?.() || t('kissopen.invite.statusReview')}
                    detail={new Date(friend.at).toLocaleDateString()}
                    icon={icon(friend.status === 'rewarded' ? 'checkmark-circle-outline' : 'person-outline')}
                    showChevron={false}
                />) : <View style={styles.empty}><Text style={styles.body}>{t('kissopen.invite.empty')}</Text></View>}
            </ItemGroup>
            <ItemGroup title={t('kissopen.invite.rules')}>
                <View style={styles.ruleCard}>
                    <Text style={styles.body}>{info.enabled ? t('kissopen.invite.rulesLead') : t('kissopen.invite.paused')}</Text>
                    <Text style={styles.body}>{info.max_rewarded > 0 ? t('kissopen.invite.totalLimit', { count: info.max_rewarded }) : t('kissopen.invite.noLimit')}</Text>
                    {info.daily_max > 0 && <Text style={styles.body}>{t('kissopen.invite.dailyLimit', { count: info.daily_max })}</Text>}
                    {info.enabled && info.bind_days > 0 && <Text style={styles.body}>{t('kissopen.invite.codeHelp', { days: info.bind_days })}</Text>}
                </View>
            </ItemGroup>
        </>}
    </ItemList>;
});

const styles = StyleSheet.create(theme => ({
    hero: { padding: 20, gap: 14 },
    gift: { width: 52, height: 52, borderRadius: 16, backgroundColor: theme.colors.home.accentSoft, alignItems: 'center', justifyContent: 'center' },
    headline: { fontSize: 24, lineHeight: 32, color: theme.colors.text, ...Typography.default('semiBold') },
    body: { fontSize: 15, lineHeight: 23, color: theme.colors.textSecondary, ...Typography.default() },
    rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    reward: { flex: 1, minWidth: 120, padding: 14, borderRadius: 16, gap: 8, backgroundColor: theme.colors.home.accentSoft },
    friendReward: { backgroundColor: theme.colors.home.greenSoft },
    label: { fontSize: 15, color: theme.colors.text, ...Typography.default('semiBold') },
    points: { fontSize: 24, lineHeight: 32, color: theme.colors.home.accent, ...Typography.default('semiBold') },
    caption: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, ...Typography.default() },
    linkCard: { padding: 20, gap: 12 },
    shareBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    shareLogo: { width: 56, height: 56, borderRadius: 14 },
    link: { fontSize: 14, lineHeight: 21, color: theme.colors.home.accent, ...Typography.default() },
    notice: { fontSize: 14, lineHeight: 20, color: theme.colors.home.accent, textAlign: 'center', ...Typography.default() },
    stats: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, gap: 12 },
    stat: { flex: 1, minWidth: 72, gap: 6 },
    statValue: { fontSize: 24, lineHeight: 32, color: theme.colors.text, ...Typography.default('semiBold') },
    empty: { padding: 20 },
    ruleCard: { padding: 20, gap: 12 },
}));
