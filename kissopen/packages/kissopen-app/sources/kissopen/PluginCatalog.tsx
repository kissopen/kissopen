import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';
import { PluginIcon } from './PluginIcon';
import type { CatalogPlugin, CloudCatalogState } from './useCloudCatalog';

/**
 * What can be added to this workspace, a row each.
 *
 * Rendered inside the plugins page rather than on one of its own: what is
 * installed and what is available are two halves of the same question, and a
 * reader with nothing installed needs the second half most.
 *
 * A row installs; it does not enable. Installing is reversible and costs
 * nothing that is running, while enabling restarts the assistant — so that
 * switch stays on the plugin's own page, where the consequence is stated.
 */
export function PluginCatalogRows({ state, installed, query, onInstalled, onOpen }: {
    state: CloudCatalogState;
    /** Ids already in the workspace, so a row says so instead of offering. */
    installed: ReadonlySet<string>;
    query: string;
    onInstalled: () => void;
    /** Opens the package's own page, where the reasons to install are. */
    onOpen: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const needle = query.trim().toLocaleLowerCase();
    const matches = React.useMemo(() => (
        needle.length === 0
            ? state.plugins
            : state.plugins.filter(plugin => (
                plugin.id.toLocaleLowerCase().includes(needle)
                || plugin.description.toLocaleLowerCase().includes(needle)
            ))
    ), [needle, state.plugins]);
    const [failed, setFailed] = React.useState('');

    const add = React.useCallback(async (plugin: CatalogPlugin) => {
        setFailed('');
        try {
            await state.install(plugin.id);
            onInstalled();
        } catch (e) {
            setFailed(e instanceof Error ? e.message : String(e));
        }
    }, [onInstalled, state]);

    if (state.loading) {
        return <View style={styles.center}><KissopenLoader size={28} /></View>;
    }
    if (state.error) {
        return <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={36} color={theme.colors.textSecondary} />
            <Text accessibilityRole="alert" style={styles.description}>{state.error}</Text>
        </View>;
    }
    if (state.plugins.length === 0) {
        return <View style={styles.center}>
            <Ionicons name="cube-outline" size={36} color={theme.colors.textSecondary} />
            <Text style={styles.description}>{t('kissopen.plugins.catalogEmptyDescription')}</Text>
        </View>;
    }
    return <View>
        {!!failed && <Text accessibilityRole="alert" style={styles.failed}>{failed}</Text>}
        {matches.map(plugin => <Row
            key={plugin.id}
            plugin={plugin}
            installed={installed.has(plugin.id)}
            busy={state.installing === plugin.id}
            disabled={!!state.installing}
            onAdd={() => void add(plugin)}
            onOpen={() => onOpen(plugin.id)}
        />)}
        {matches.length === 0 && <Text style={styles.caption}>{t('kissopen.plugins.noMatches')}</Text>}
    </View>;
}

function Row({ plugin, installed, busy, disabled, onAdd, onOpen }: {
    plugin: CatalogPlugin;
    installed: boolean;
    busy: boolean;
    disabled: boolean;
    onAdd: () => void;
    onOpen: () => void;
}) {
    const { theme } = useUnistyles();
    // What it brings, in the two numbers the reader decides on.
    const brings = [
        plugin.skills > 0 ? `${t('kissopen.plugins.skills')} ${plugin.skills}` : undefined,
        plugin.servers > 0 ? `${t('kissopen.plugins.servers')} ${plugin.servers}` : undefined,
    ].filter(Boolean).join(' · ');
    // The row opens the page; only the plus installs without reading it.
    return <Pressable
        accessibilityRole="button"
        accessibilityLabel={plugin.title || plugin.id}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={onOpen}
    >
        <PluginIcon uri={plugin.icon} size={44} />
        <View style={styles.rowText}>
            <Text numberOfLines={1} style={styles.rowTitle}>{plugin.title || plugin.id}</Text>
            <Text numberOfLines={2} style={styles.rowSubtitle}>{plugin.description}</Text>
            {!!brings && <Text style={styles.rowMeta}>{brings}</Text>}
            {!!plugin.needs_connection && !plugin.connection_only
                && <Text style={styles.rowMeta}>{t('kissopen.plugins.toolsNeedConnection')}</Text>}
        </View>
        {installed
            ? <Text style={styles.installed}>{t('kissopen.plugins.installed')}</Text>
            : plugin.connection_only
            /* Nothing in it works without a connection, and connecting is not
               built yet. The row says so instead of offering a plus that
               would install a package incapable of doing anything. */
            ? <Text style={styles.installed}>{t('kissopen.plugins.needsConnection')}</Text>
            : <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('kissopen.plugins.install')}
                accessibilityState={{ disabled, busy }}
                disabled={disabled}
                onPress={onAdd}
                style={({ pressed }) => [styles.add, (pressed || disabled) && { opacity: 0.6 }]}
            >
                {busy
                    ? <KissopenLoader size={16} />
                    : <Ionicons name="add" size={22} color={theme.colors.text} />}
            </Pressable>}
    </Pressable>;
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20 },
    rowText: { flexGrow: 1, flexShrink: 1, gap: 3 },
    rowTitle: { color: theme.colors.text, fontSize: 16, ...Typography.default('semiBold') },
    rowSubtitle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
    rowMeta: { color: theme.colors.textSecondary, fontSize: 12 },
    add: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
    installed: { color: theme.colors.textSecondary, fontSize: 13 },
    failed: { color: theme.colors.text, fontSize: 13, lineHeight: 20, paddingHorizontal: 20, paddingBottom: 8 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
    description: { fontSize: 14, lineHeight: 22, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 420 },
    caption: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
}));
