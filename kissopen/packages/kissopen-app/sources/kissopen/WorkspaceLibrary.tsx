import * as React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ItemList } from '@/components/ItemList';
import { ItemGroup } from '@/components/ItemGroup';
import { Item } from '@/components/Item';
import { ProjectGroup } from '@/components/ProjectGroup';
import { useIsDataReady, useSessionListViewData } from '@/sync/storage';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';

export function WorkspaceLibrary({ section, ready, error, onWork }: {
    section: 'projects' | 'schedules' | 'plugins'; ready: boolean; error: string; onWork: () => void;
}) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const dataReady = useIsDataReady();
    const data = useSessionListViewData();
    if (!ready || !dataReady) return <View style={styles.center}><KissopenLoader size={32} /><Text style={styles.description}>{error || t('kissopen.work.syncingWorkspace')}</Text></View>;
    const projects = (data || []).filter(item => item.type === 'project');
    if (section === 'projects') return <ItemList>
        <ItemGroup footer={t('kissopen.library.projectsFooter')}><Item title={t('kissopen.work.newWorkSession')} icon={<Ionicons name="add-outline" size={24} color={theme.colors.text} />} onPress={() => router.push('/new')} /></ItemGroup>
        {projects.map(item => <ProjectGroup key={item.project.id} project={item.project} />)}
        {!projects.length && <View style={styles.center}><Ionicons name="folder-outline" size={44} color={theme.colors.textSecondary} /><Text style={styles.title}>{t('kissopen.library.noProjectsTitle')}</Text><Text style={styles.description}>{t('kissopen.library.noProjectsDescription')}</Text></View>}
    </ItemList>;
    const schedule = section === 'schedules';
    return <ItemList><View style={styles.center}>
        <Ionicons name={schedule ? 'time-outline' : 'extension-puzzle-outline'} size={44} color={theme.colors.textSecondary} />
        <Text style={styles.title}>{schedule ? t('kissopen.library.schedulesSubtitle') : t('kissopen.library.pluginsSubtitle')}</Text>
        <Text style={styles.description}>{schedule ? t('kissopen.library.schedulesFooter') : t('kissopen.library.pluginsFooter')}</Text>
        <Text style={styles.caption}>{schedule ? t('kissopen.library.schedulesUnavailable') : t('kissopen.library.pluginsUnavailable')}</Text>
    </View><ItemGroup><Item title={t('kissopen.library.chooseWorkSession')} subtitle={t('kissopen.library.chooseWorkSessionSubtitle')} onPress={onWork} /><Item title={t('kissopen.work.devices')} subtitle={t('kissopen.library.devicesSubtitle')} onPress={() => router.push('/settings/agents')} /></ItemGroup></ItemList>;
}
const styles = StyleSheet.create(theme => ({
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
    title: { fontSize: 22, color: theme.colors.text, textAlign: 'center' },
    description: { fontSize: 15, lineHeight: 25, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 420 },
    caption: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, textAlign: 'center' },
}));
