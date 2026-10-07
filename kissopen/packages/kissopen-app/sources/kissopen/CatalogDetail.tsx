import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';
import { PluginIcon } from './PluginIcon';
import { api } from './api/client';

interface CatalogSkill {
    readonly name: string;
    readonly description: string;
}

interface CatalogServer {
    readonly name: string;
    readonly type: string;
    /** It answers an authorization challenge; its tools wait on a connection. */
    readonly needsConnection?: boolean;
    readonly scopes?: readonly string[];
}

export interface CatalogDetailData {
    readonly id: string;
    readonly version: string;
    readonly title: string;
    readonly summary: string;
    readonly about: string;
    readonly developer: string;
    readonly category: string;
    readonly license: string;
    readonly website: string;
    readonly privacy: string;
    readonly terms: string;
    readonly support: string;
    readonly skills: readonly CatalogSkill[];
    readonly servers: readonly CatalogServer[];
    /** Parts of the original package this build left out, named. */
    readonly unsupported: readonly string[];
    readonly icon?: string;
}

/**
 * One package before it is installed.
 *
 * A row in a catalog can say what a plugin is; it cannot say what it will
 * actually do to the assistant. That is this page: the skills it adds, by the
 * names the Agent will load them under, and who wrote it. Installing from here
 * rather than from the row is the point — the button sits after the reasons.
 */
export function CatalogDetail({ id, installed, installing, onInstall, onBack }: {
    id: string;
    installed: boolean;
    installing: boolean;
    onInstall: () => Promise<void>;
    onBack: () => void;
}) {
    const { theme } = useUnistyles();
    const [detail, setDetail] = React.useState<CatalogDetailData>();
    const [error, setError] = React.useState('');
    const [failed, setFailed] = React.useState('');
    const [expanded, setExpanded] = React.useState(false);

    React.useEffect(() => {
        let alive = true;
        setDetail(undefined); setError('');
        void api<CatalogDetailData>(`/cloud/catalog/${encodeURIComponent(id)}`)
            .then(value => { if (alive) setDetail(value); })
            .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
        return () => { alive = false; };
    }, [id]);

    const add = React.useCallback(async () => {
        setFailed('');
        try {
            await onInstall();
        } catch (e) {
            setFailed(e instanceof Error ? e.message : String(e));
        }
    }, [onInstall]);

    if (error) {
        return <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={44} color={theme.colors.textSecondary} />
            <Text accessibilityRole="alert" style={styles.description}>{error}</Text>
        </View>;
    }
    if (!detail) {
        return <View style={styles.center}><KissopenLoader size={32} /></View>;
    }

    // Long catalogues of skills are common — Vercel ships fifty-four — so only
    // the first handful show until the reader asks for the rest.
    const visible = expanded ? detail.skills : detail.skills.slice(0, 8);
    const rest = detail.skills.length - visible.length;
    const needsConnection = detail.servers.some(server => server.needsConnection);
    // Nothing in it works without a connection, and connecting is not built
    // yet, so the button would install a package that cannot do anything.
    const connectionOnly = needsConnection && detail.skills.length === 0;

    return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
            <PluginIcon uri={detail.icon} size={64} radius={16} />
            <Text style={styles.name}>{detail.title}</Text>
            {!!detail.summary && <Text style={styles.summary}>{detail.summary}</Text>}
        </View>

        {!!detail.about && <Text style={styles.about}>{detail.about}</Text>}

        {detail.skills.length > 0 && <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.skills')}</Text>
            <View style={styles.chips}>
                {visible.map(skill => <View key={skill.name} style={styles.chip}>
                    <Ionicons name="sparkles-outline" size={13} color={theme.colors.textSecondary} />
                    <Text numberOfLines={1} style={styles.chipText}>{skill.name}</Text>
                </View>)}
                {rest > 0 && <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('kissopen.plugins.showAllSkills')}
                    style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                    onPress={() => setExpanded(true)}
                >
                    <Text style={styles.chipText}>{t('kissopen.plugins.moreSkills', { count: rest })}</Text>
                </Pressable>}
            </View>
        </View>}

        {detail.servers.length > 0 && <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.servers')}</Text>
            {detail.servers.map(server => <Row
                key={server.name}
                label={server.name}
                value={server.needsConnection ? t('kissopen.plugins.needsConnection') : server.type}
            />)}
            {needsConnection && <Text style={styles.caption}>
                {connectionOnly
                    ? t('kissopen.plugins.connectionOnlyNote')
                    : t('kissopen.plugins.connectionPartialNote')}
            </Text>}
        </View>}

        {detail.unsupported.length > 0 && <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.unsupported')}</Text>
            {detail.unsupported.map(item => <Text key={item} style={styles.unsupported}>{item}</Text>)}
            <Text style={styles.caption}>{t('kissopen.plugins.unsupportedNote')}</Text>
        </View>}

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.info')}</Text>
            {!!detail.developer && <Row label={t('kissopen.plugins.developer')} value={detail.developer} />}
            {!!detail.category && <Row label={t('kissopen.plugins.category')} value={detail.category} />}
            <Row label={t('kissopen.plugins.version')} value={detail.version || '—'} />
            {!!detail.license && <Row label={t('kissopen.plugins.license')} value={detail.license} />}
            <Row label={t('kissopen.plugins.identifier')} value={detail.id} />
        </View>

        {(!!detail.website || !!detail.privacy || !!detail.terms || !!detail.support) && <View style={styles.group}>
            {([
                [t('kissopen.plugins.website'), detail.website],
                [t('kissopen.plugins.support'), detail.support],
                [t('kissopen.plugins.privacy'), detail.privacy],
                [t('kissopen.plugins.terms'), detail.terms],
            ] as const).filter(([, url]) => !!url).map(([label, url]) => <Pressable
                key={label}
                accessibilityRole="link"
                accessibilityLabel={label}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
                onPress={() => void openExternalUrl(url)}
            >
                <Text style={styles.linkText}>{label}</Text>
                <Ionicons name="open-outline" size={16} color={theme.colors.textSecondary} />
            </Pressable>)}
        </View>}

        {!!failed && <Text accessibilityRole="alert" style={styles.caption}>{failed}</Text>}

        <View style={styles.actions}>
            {installed
                ? <Text style={styles.caption}>{t('kissopen.plugins.installedNote')}</Text>
                : connectionOnly
                ? <Text style={styles.caption}>{t('kissopen.plugins.connectionOnlyNote')}</Text>
                : <>
                    <RoundButton
                        title={t('kissopen.plugins.install')}
                        loading={installing}
                        onPress={() => void add()}
                    />
                    {/* Installing is not enabling, and the difference is the one
                        that costs a restart. */}
                    <Text style={styles.caption}>{t('kissopen.plugins.installNote')}</Text>
                </>}
        </View>
    </ScrollView>;
}

function Row({ label, value }: { label: string; value: string }) {
    return <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
    </View>;
}

const styles = StyleSheet.create(theme => ({
    body: { padding: 20, gap: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
    head: { alignItems: 'center', gap: 10 },
    name: { color: theme.colors.text, fontSize: 26, textAlign: 'center', ...Typography.default('semiBold') },
    summary: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 24, textAlign: 'center' },
    about: { color: theme.colors.text, fontSize: 15, lineHeight: 24 },
    group: { gap: 4 },
    groupLabel: {
        color: theme.colors.textSecondary, fontSize: 12, letterSpacing: 0.6,
        textTransform: 'uppercase', marginBottom: 4,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
        paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, backgroundColor: theme.colors.surface,
    },
    chipText: { color: theme.colors.text, fontSize: 13, flexShrink: 1 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider,
    },
    rowLabel: { color: theme.colors.textSecondary, fontSize: 15, flexGrow: 1, flexShrink: 0 },
    rowValue: { color: theme.colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right' },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
    linkText: { color: theme.colors.text, fontSize: 15, flexGrow: 1 },
    unsupported: { color: theme.colors.text, fontSize: 15, paddingVertical: 4 },
    actions: { gap: 12, marginTop: 4 },
    caption: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
    description: { fontSize: 15, lineHeight: 25, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 420 },
}));
