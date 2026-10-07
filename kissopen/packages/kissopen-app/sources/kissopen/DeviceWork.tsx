import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAllMachines, useIsDataReady } from '@/sync/storage';
import { SessionsListWrapper } from '@/components/SessionsListWrapper';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';

// Reuse the original live session list and work actions under the Kissopen account.
export function DeviceWork({ accountReady, connectionError }: { accountReady: boolean; connectionError: string }) {
    const router = useRouter();
    const { theme } = useUnistyles();
    const ready = useIsDataReady();
    const machines = useAllMachines({ includeOffline: true });
    return <View style={styles.root}>
        <ItemGroup><Item title={t('kissopen.work.desktopWorkspace')} subtitle={t('kissopen.work.connectedDevices', { count: machines.length })} icon={<Ionicons name="desktop-outline" size={22} color={theme.colors.textSecondary} />} onPress={() => router.push('/devices/connect')} />
        </ItemGroup>
        {/* Device settings stay reachable even before sync finishes or a computer connects. */}
        {!accountReady ? <View style={styles.center}><KissopenLoader size={32} /><Text style={styles.description}>{connectionError || t('kissopen.work.syncingWorkspace')}</Text></View>
            : !ready ? <View style={styles.center}><KissopenLoader size={32} /><Text style={styles.description}>{t('kissopen.work.loadingSessions')}</Text></View>
            : machines.length === 0 ? <ScrollView contentContainerStyle={styles.center}>
            <Ionicons name="desktop-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.title}>{t('kissopen.work.emptyTitle')}</Text>
            <Text style={styles.description}>{t('kissopen.work.emptyDescription')}</Text>
            {!!connectionError && <Text accessibilityRole="alert" style={styles.description}>{connectionError}</Text>}
            <Text style={styles.caption}>{t('kissopen.work.emptyHint')}</Text>
        </ScrollView> : <SessionsListWrapper bottomContentInset={24} />}
    </View>;
}
const styles = StyleSheet.create(theme => ({
    root: { flex: 1 },
    center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 18 },
    title: { color: theme.colors.text, fontSize: 24, textAlign: 'center', ...Typography.default('semiBold') },
    description: { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 420 },
    caption: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center' },
}));
