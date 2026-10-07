import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { FileIcon } from '@/components/FileIcon';
import { useSessionFolder } from '@/hooks/useSessionFolder';
import { useSession } from '@/sync/storage';
import { rigHasRpcMethod } from '@/sync/rig';
import { librarySizeText } from './libraryFiles';

export type WorkProject = {
    id: string;
    name: string;
    place: string;
    machineId: string;
    path: string;
    updatedAt: number;
    conversations: readonly { id: string; title: string; updatedAt: number }[];
    rootSessionId?: string;
    cloud: boolean;
};

type ProjectPageProps = {
    project: WorkProject;
    topInset: number;
    bottomInset: number;
    onBack: () => void;
    onAsk: (text: string) => void;
    onConversation: (id: string) => void;
    onFile?: (sessionId: string, path: string) => void;
};

/** Community projects own conversations and files, never generated dashboards. */
export const ProjectScreen = React.memo(function ProjectScreen(props: ProjectPageProps) {
    return <ProjectPage {...props} />;
});

export const ProjectPage = React.memo(function ProjectPage(props: ProjectPageProps) {
    const { theme } = useUnistyles();
    const [tab, setTab] = React.useState<'chats' | 'files'>('chats');
    const rootSession = useSession(props.project.rootSessionId);
    const filesSessionId = props.onFile && rootSession && rigHasRpcMethod(rootSession.metadata, 'listDirectory')
        ? rootSession.id : undefined;
    const tabs = filesSessionId ? (['chats', 'files'] as const) : (['chats'] as const);
    return <View style={styles.root}>
        <ScrollView contentContainerStyle={{ paddingTop: props.topInset, paddingBottom: props.bottomInset + 88 }}>
            <View style={styles.page}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={props.onBack} style={styles.row}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.home.muted} />
                    <Text style={styles.body}>{t('kissopen.tabs.work')}</Text>
                </Pressable>
                <View style={styles.heading}>
                    <Text accessibilityRole="header" style={styles.title}>{props.project.name}</Text>
                    <Text style={styles.quiet}>{props.project.place}</Text>
                </View>
                <View style={styles.row} accessibilityRole="tablist">
                    {tabs.map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.selected]}>
                        <Text style={styles.body}>{t(key === 'chats' ? 'kissopen.board.tabChats' : 'kissopen.board.tabFiles')}</Text>
                    </Pressable>)}
                </View>
                {tab === 'chats' || !filesSessionId ? <View style={styles.card}>
                    {props.project.conversations.length === 0 && <Text style={styles.quiet}>{t('kissopen.home.noChatsTitle')}</Text>}
                    {props.project.conversations.map(chat => <Pressable key={chat.id} accessibilityRole="button" onPress={() => props.onConversation(chat.id)} style={styles.row}>
                        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.home.accent} />
                        <View style={styles.copy}>
                            <Text style={styles.body} numberOfLines={2}>{chat.title}</Text>
                            <Text style={styles.quiet}>{new Date(chat.updatedAt).toLocaleString()}</Text>
                        </View>
                    </Pressable>)}
                </View> : <ProjectFiles sessionId={filesSessionId} onFile={path => props.onFile?.(filesSessionId, path)} />}
            </View>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => props.onAsk('')} style={[styles.ask, { bottom: props.bottomInset + 16 }]}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.colors.home.accent} />
            <Text style={styles.body}>{t('kissopen.home.startNewChat')}</Text>
        </Pressable>
    </View>;
});

const ProjectFiles = React.memo(function ProjectFiles(props: { sessionId: string; onFile: (path: string) => void }) {
    const { theme } = useUnistyles();
    const [path, setPath] = React.useState('');
    const folder = useSessionFolder(props.sessionId, path);
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    return <View style={styles.card}>
        {!!path && <Pressable accessibilityRole="button" onPress={() => setPath(parent)} style={styles.row}>
            <Ionicons name="arrow-up" size={20} color={theme.colors.home.accent} />
            <Text style={styles.body}>{t('kissopen.board.filesUp')}</Text>
        </Pressable>}
        {folder.status === 'loading' && <Text style={styles.quiet}>{t('common.loading')}</Text>}
        {folder.status === 'unavailable' && <Text style={styles.quiet}>{t('kissopen.board.filesUnavailable')}</Text>}
        {folder.status === 'ready' && folder.entries.length === 0 && <Text style={styles.quiet}>{t('kissopen.board.filesEmpty')}</Text>}
        {folder.status === 'ready' && folder.entries.map(entry => <Pressable key={entry.path} accessibilityRole="button" onPress={() => entry.directory ? setPath(entry.path) : props.onFile(entry.path)} style={styles.row}>
            {entry.directory ? <Ionicons name="folder-outline" size={20} color={theme.colors.home.accent} /> : <FileIcon fileName={entry.name} size={20} />}
            <View style={styles.copy}>
                <Text style={styles.body} numberOfLines={1}>{entry.name}</Text>
                {!entry.directory && entry.size !== undefined && <Text style={styles.quiet}>{librarySizeText(entry.size)}</Text>}
            </View>
        </Pressable>)}
    </View>;
});

const styles = StyleSheet.create(theme => ({
    root: { flex: 1 },
    page: { padding: 20, gap: 20 },
    heading: { gap: 8 },
    title: { fontSize: 28, color: theme.colors.text, ...Typography.default('semiBold') },
    body: { fontSize: 16, color: theme.colors.text },
    quiet: { fontSize: 13, color: theme.colors.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    copy: { flex: 1, minWidth: 0, gap: 4 },
    card: { backgroundColor: theme.colors.home.card, borderRadius: 16, padding: 16, gap: 8 },
    tab: { padding: 12, borderRadius: 12 },
    selected: { backgroundColor: theme.colors.home.accentSoft },
    ask: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 24, backgroundColor: theme.colors.home.card },
}));
