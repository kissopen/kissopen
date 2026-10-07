import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { PluginIcon } from './PluginIcon';
import type { CloudPlugin, CloudPluginsState } from './useCloudPlugins';

/**
 * One plugin, in full.
 *
 * The list says what a plugin is and whether it runs; this says everything a
 * decision needs — what it brings to the workspace, what this host will not run
 * of it, and the two actions that change anything.
 *
 * `unsupported` is given its own block rather than a footnote. A package can
 * carry parts this host has no way to run, and a reader who is not told will
 * read the missing behaviour as a broken plugin.
 */
export function PluginDetail({ plugin, state, icon, onBack }: {
    plugin: CloudPlugin;
    state: CloudPluginsState;
    /** The plugin's own mark, when the catalog published one for it. */
    icon?: string;
    onBack: () => void;
}) {
    const { theme } = useUnistyles();
    const [busy, setBusy] = React.useState(false);
    const run = React.useCallback(async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try { await action(); } finally { setBusy(false); }
    }, [busy]);

    return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
            <PluginIcon uri={icon} size={64} radius={16} />
            <Text style={styles.name}>{plugin.name}</Text>
            {!!plugin.description && <Text style={styles.description}>{plugin.description}</Text>}
        </View>

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.brings')}</Text>
            <Row label={t('kissopen.plugins.skills')} value={String(plugin.skills)} />
            <Row label={t('kissopen.plugins.servers')} value={String(plugin.servers)} />
        </View>

        {plugin.unsupported.length > 0 && <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.unsupported')}</Text>
            {plugin.unsupported.map(item => <Text key={item} style={styles.unsupported}>{item}</Text>)}
            <Text style={styles.caption}>{t('kissopen.plugins.unsupportedNote')}</Text>
        </View>}

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.plugins.info')}</Text>
            <Row label={t('kissopen.plugins.version')} value={plugin.version || '—'} />
            <Row label={t('kissopen.plugins.format')} value={plugin.format || '—'} />
            <Row label={t('kissopen.plugins.identifier')} value={plugin.id} />
            <Row
                label={t('kissopen.plugins.state')}
                value={!plugin.enabled
                    ? t('kissopen.plugins.stateOff')
                    : plugin.active ? t('kissopen.plugins.stateOn') : t('kissopen.plugins.statePending')}
            />
        </View>

        <View style={styles.actions}>
            <RoundButton
                title={plugin.enabled ? t('kissopen.plugins.disable') : t('kissopen.plugins.enable')}
                loading={busy || state.applying}
                onPress={() => void run(() => state.setEnabled(plugin.id, !plugin.enabled))}
            />
            <RoundButton
                title={t('kissopen.plugins.remove')}
                display="inverted"
                size="normal"
                loading={busy}
                onPress={() => void run(async () => { await state.remove(plugin.id); onBack(); })}
            />
            {/* Turning a plugin on or off restarts the workspace's Agent, so a
                reader who is mid-conversation should know before they press. */}
            <Text style={styles.caption}>{t('kissopen.plugins.applyNote')}</Text>
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
    icon: {
        width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.surface,
    },
    name: { color: theme.colors.text, fontSize: 26, textAlign: 'center', ...Typography.default('semiBold') },
    description: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 24, textAlign: 'center' },
    group: { gap: 4 },
    groupLabel: {
        color: theme.colors.textSecondary, fontSize: 12, letterSpacing: 0.6,
        textTransform: 'uppercase', marginBottom: 4,
    },
    connection: { gap: 8 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider,
    },
    rowLabel: { color: theme.colors.textSecondary, fontSize: 15, flexGrow: 1, flexShrink: 0 },
    rowValue: { color: theme.colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right' },
    unsupported: { color: theme.colors.text, fontSize: 15, paddingVertical: 4 },
    actions: { gap: 12, marginTop: 4 },
    caption: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
}));
