import * as React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { FileIcon } from '@/components/FileIcon';
import { Typography } from '@/constants/Typography';
import { useProjectLibraryFiles } from '@/hooks/useProjectLibraryFiles';
import { t } from '@/text';
import { sinceOf } from './projectTime';
import type { WorkProject } from './ProjectPage';
import type { FileItem } from './api/types';
import {
    libraryKindOf,
    libraryMatches,
    librarySections,
    librarySizeText,
    type LibraryEntry,
    type LibraryFilter,
    type LibraryGrouping,
    type LibraryKind,
    type LibrarySection,
} from './libraryFiles';

/** Rows a section shows before it is opened out. */
const ROWS_SHOWN = 20;

/*
 * 资料库: every file the person uploaded or had made, the way the desktop's
 * library shows them.
 *
 * A project's files are read from its `uploads/` and `outputs/` wherever the
 * project lives; the files kept with the cloud chat come from the account.
 * Both sit in one list, grouped by project (those kept with the chat last,
 * under 未关联项目) or by day, narrowed by type and by a search over names and
 * projects. Tapping a file opens it. Mounted only while the library is on
 * screen, so nothing is read otherwise.
 */
export const LibraryPage = React.memo(function LibraryPage(props: {
    projects: readonly WorkProject[];
    /** The files kept with the cloud chat. */
    chatFiles: readonly FileItem[];
    /** Whether the account has answered yet; until then the list says it is loading. */
    ready: boolean;
    /** Opens one of a project's files, by its path within the project's folder. */
    onProjectFile: (sessionId: string, path: string) => void;
    onChatFile: (file: FileItem) => void;
    onUpload: () => void;
    searching: boolean;
    query: string;
    onQuery: (query: string) => void;
}) {
    const { theme } = useUnistyles();
    const listed = useProjectLibraryFiles(props.projects, true);
    const { query, onQuery } = props;
    const [grouping, setGrouping] = React.useState<LibraryGrouping>('project');
    const [filter, setFilter] = React.useState<LibraryFilter>('all');
    const [opened, setOpened] = React.useState<ReadonlySet<string>>(new Set());
    const { onProjectFile, onChatFile } = props;

    const { entries, opens } = React.useMemo(() => {
        const entries: LibraryEntry[] = [];
        const opens = new Map<string, () => void>();
        for (const project of props.projects) {
            for (const file of listed.get(project.id) ?? []) {
                const id = `${project.id}\u0000${file.path}`;
                entries.push({
                    id,
                    name: file.name,
                    kind: libraryKindOf(file.name),
                    source: file.kind,
                    ...(file.size === undefined ? {} : { size: file.size }),
                    ...(file.modified === undefined ? {} : { at: file.modified }),
                    project: { id: project.id, name: project.name, place: project.place },
                });
                const sessionId = project.rootSessionId;
                if (sessionId) opens.set(id, () => onProjectFile(sessionId, file.path));
            }
        }
        for (const file of props.chatFiles) {
            const id = `chat\u0000${file.id}`;
            entries.push({ id, name: file.name, kind: file.kind, size: file.size, at: file.created });
            if (file.url) opens.set(id, () => onChatFile(file));
        }
        return { entries, opens };
    }, [props.projects, props.chatFiles, listed, onProjectFile, onChatFile]);

    const now = Date.now();
    const sections = librarySections(entries.filter(entry => libraryMatches(entry, filter, query)), grouping, now);
    const groupings: { value: LibraryGrouping; label: string }[] = [
        { value: 'project', label: t('kissopen.libraryFiles.byProject') },
        { value: 'time', label: t('kissopen.libraryFiles.byTime') },
    ];
    const filters: { value: LibraryFilter; label: string }[] = [
        { value: 'all', label: t('kissopen.libraryFiles.all') },
        { value: 'document', label: t('kissopen.libraryFiles.documents') },
        { value: 'data', label: t('kissopen.libraryFiles.data') },
        { value: 'image', label: t('kissopen.libraryFiles.images') },
    ];

    return <>
        <View style={styles.toolbar}>
            {props.searching && <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
                <TextInput
                    autoFocus
                    accessibilityLabel={t('kissopen.libraryFiles.search')}
                    style={styles.searchField}
                    placeholder={t('kissopen.libraryFiles.search')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={query}
                    onChangeText={onQuery}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {!!query && <Pressable accessibilityRole="button" accessibilityLabel={t('kissopen.libraryFiles.clearSearch')} hitSlop={8} onPress={() => onQuery('')}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </Pressable>}
            </View>}
            <View style={styles.row}>
                <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={t('kissopen.libraryFiles.grouping')}>
                    {groupings.map(option => <Segment key={option.value} label={option.label} chosen={grouping === option.value} onPress={() => setGrouping(option.value)} />)}
                </View>
                <Pressable
                    accessibilityRole="button"
                    onPress={props.onUpload}
                    style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
                >
                    <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.uploadText}>{t('kissopen.libraryFiles.upload')}</Text>
                </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('kissopen.libraryFiles.fileType')}>
                {filters.map(option => <Chip key={option.value} label={option.label} chosen={filter === option.value} onPress={() => setFilter(option.value)} />)}
            </ScrollView>
        </View>
        {entries.length === 0 ? (
            <ItemGroup>
                {props.ready
                    ? <Item title={t('kissopen.libraryFiles.emptyTitle')} subtitle={t('kissopen.libraryFiles.emptyBody')} subtitleLines={0} icon={<Ionicons name="folder-open-outline" size={28} color={theme.colors.textSecondary} />} showChevron={false} />
                    : <Item title={t('common.loading')} loading />}
            </ItemGroup>
        ) : sections.length === 0 ? (
            <ItemGroup>
                <Item title={t('kissopen.libraryFiles.noMatch')} icon={<Ionicons name="search-outline" size={24} color={theme.colors.textSecondary} />} showChevron={false} />
            </ItemGroup>
        ) : sections.map(section => {
            const open = opened.has(section.id);
            const rows = open ? section.entries : section.entries.slice(0, ROWS_SHOWN);
            return <ItemGroup key={section.id} title={<SectionTitle section={section} />}>
                {rows.map(entry => <EntryRow key={entry.id} entry={entry} showProject={grouping === 'time'} now={now} onPress={opens.get(entry.id)} />)}
                {!open && section.entries.length > ROWS_SHOWN && (
                    <Item
                        title={t('kissopen.libraryFiles.showAll', { count: section.entries.length })}
                        onPress={() => setOpened(current => new Set(current).add(section.id))}
                    />
                )}
            </ItemGroup>;
        })}
    </>;
});

function sectionLabel(section: LibrarySection): string {
    if (section.by === 'project') return section.project.place ? `${section.project.name} · ${section.project.place}` : section.project.name;
    if (section.by === 'unassigned') return t('kissopen.libraryFiles.noProject');
    return {
        today: t('kissopen.libraryFiles.today'),
        yesterday: t('kissopen.libraryFiles.yesterday'),
        week: t('kissopen.libraryFiles.last7Days'),
        month: t('kissopen.libraryFiles.last30Days'),
        earlier: t('kissopen.libraryFiles.earlier'),
    }[section.day];
}

const SectionTitle = React.memo(function SectionTitle(props: { section: LibrarySection }) {
    const { theme } = useUnistyles();
    const icon = props.section.by === 'project' ? 'folder-outline' : props.section.by === 'unassigned' ? 'chatbubble-outline' : 'time-outline';
    return <View style={styles.sectionTitle}>
        <Ionicons name={icon} size={13} color={theme.colors.textSecondary} />
        <Text style={styles.sectionLabel} numberOfLines={1}>{sectionLabel(props.section)}</Text>
        <Text style={styles.sectionCount}>{props.section.entries.length}</Text>
    </View>;
});

function kindLabel(kind: LibraryKind): string {
    return kind === 'image' ? t('kissopen.libraryFiles.kindImage') : kind === 'data' ? t('kissopen.libraryFiles.kindData') : t('kissopen.libraryFiles.kindDocument');
}

const EntryRow = React.memo(function EntryRow(props: {
    entry: LibraryEntry;
    /** Names the project, when the sections do not already. */
    showProject: boolean;
    now: number;
    onPress: (() => void) | undefined;
}) {
    const { entry } = props;
    const subtitle = [
        props.showProject ? entry.project?.name ?? t('kissopen.libraryFiles.noProject') : undefined,
        entry.source === 'output' ? t('kissopen.libraryFiles.generated') : entry.source === 'upload' ? t('kissopen.libraryFiles.uploaded') : kindLabel(entry.kind),
        entry.size !== undefined ? librarySizeText(entry.size) : undefined,
    ].filter(Boolean).join(' · ');
    return <Item
        title={entry.name}
        subtitle={subtitle}
        subtitleLines={1}
        detail={entry.at ? sinceOf(entry.at, props.now) : undefined}
        icon={<FileIcon fileName={entry.name} size={28} />}
        showChevron={false}
        onPress={props.onPress}
    />;
});

const Segment = React.memo(function Segment(props: { label: string; chosen: boolean; onPress: () => void }) {
    return <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: props.chosen }}
        onPress={props.onPress}
        style={({ pressed }) => [styles.segment, props.chosen && styles.segmentChosen, pressed && styles.pressed]}
    >
        <Text style={[styles.segmentText, props.chosen && styles.segmentChosenText]}>{props.label}</Text>
    </Pressable>;
});

const Chip = React.memo(function Chip(props: { label: string; chosen: boolean; onPress: () => void }) {
    return <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: props.chosen }}
        onPress={props.onPress}
        style={({ pressed }) => [styles.chip, props.chosen && styles.chipChosen, pressed && styles.pressed]}
    >
        <Text style={[styles.chipText, props.chosen && styles.chipChosenText]}>{props.label}</Text>
    </Pressable>;
});

const styles = StyleSheet.create(theme => ({
    toolbar: { gap: 12, paddingTop: 12, paddingBottom: 4 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: theme.colors.input.background },
    searchField: { flex: 1, height: 44, color: theme.colors.text, fontSize: 16, ...Typography.default() },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
    segments: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: theme.colors.surface },
    segment: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
    segmentChosen: { backgroundColor: theme.colors.text },
    segmentText: { color: theme.colors.textSecondary, fontSize: 13, ...Typography.default('semiBold') },
    segmentChosenText: { color: theme.colors.surface },
    upload: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.surface },
    uploadText: { color: theme.colors.text, fontSize: 13, ...Typography.default('semiBold') },
    chips: { gap: 8, paddingHorizontal: 16 },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.divider },
    chipChosen: { borderColor: theme.colors.text, backgroundColor: theme.colors.text },
    chipText: { color: theme.colors.textSecondary, fontSize: 13, ...Typography.default() },
    chipChosenText: { color: theme.colors.surface },
    sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionLabel: { flexShrink: 1, color: theme.colors.groupped.sectionTitle, fontSize: 13, ...Typography.default('semiBold') },
    sectionCount: { color: theme.colors.textSecondary, fontSize: 12, ...Typography.default() },
    pressed: { opacity: 0.7 },
}));
