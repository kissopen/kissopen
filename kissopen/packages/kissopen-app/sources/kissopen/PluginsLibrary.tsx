import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { KissopenLoader } from './KissopenLoader';
import { PluginIcon } from './PluginIcon';
import { PluginCatalogRows } from './PluginCatalog';
import type { CloudCatalogState } from './useCloudCatalog';
import type { CloudPlugin, CloudPluginsState } from './useCloudPlugins';

/**
 * The plugins page: what this workspace has, then what it could have.
 *
 * One page rather than two. Installed and available are different answers, but
 * they are answers to the same visit — a reader who opens this is deciding what
 * the assistant can do, and putting the second half behind a button left the
 * first visit looking like an empty room with no door.
 *
 * What is installed is a strip of marks rather than rows. It is usually short,
 * it is the part a reader recognises at a glance, and rows would push what they
 * came to browse off the screen.
 */
export function PluginsLibrary({ state, catalog, query, onOpen, onOpenCatalog }: {
    state: CloudPluginsState;
    catalog: CloudCatalogState;
    /** Filters both halves by name and description; empty shows everything. */
    query: string;
    /** Opens an installed plugin, where its switches are. */
    onOpen: (id: string) => void;
    /** Opens a package that is not installed, where the reasons are. */
    onOpenCatalog: (id: string) => void;
}) {
    const { theme } = useUnistyles();
    const needle = query.trim().toLocaleLowerCase();
    const icons = React.useMemo(
        () => new Map(catalog.plugins.map(one => [one.id, one.icon])),
        [catalog.plugins],
    );
    const installed = React.useMemo(() => (
        needle.length === 0
            ? state.plugins
            : state.plugins.filter(plugin => (
                plugin.name.toLocaleLowerCase().includes(needle)
                || plugin.description.toLocaleLowerCase().includes(needle)
            ))
    ), [needle, state.plugins]);
    const installedIds = React.useMemo(
        () => new Set(state.plugins.map(one => one.id)),
        [state.plugins],
    );

    if (state.loading) {
        return <View style={styles.center}><KissopenLoader size={32} /></View>;
    }
    if (state.error) {
        return <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={44} color={theme.colors.textSecondary} />
            <Text accessibilityRole="alert" style={styles.description}>{state.error}</Text>
        </View>;
    }
    return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {state.applying && <View style={styles.applying}>
            <KissopenLoader size={18} />
            <Text style={styles.caption}>{t('kissopen.plugins.applying')}</Text>
        </View>}
        {/* The selection was saved and the Agent is not running it. Said here,
            above everything, because the fix is one of the marks below: whichever
            plugin was just turned on is the one to turn back off. */}
        {!state.applying && !!state.applyError && <View style={styles.problem}>
            <Text accessibilityRole="alert" style={styles.problemTitle}>{t('kissopen.plugins.applyFailed')}</Text>
            <Text style={styles.problemBody}>{state.applyError}</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('kissopen.plugins.applyRetry')}
                style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}
                onPress={() => void state.retryApply()}
            >
                <Ionicons name="refresh" size={16} color={theme.colors.text} />
                <Text style={styles.retryText}>{t('kissopen.plugins.applyRetry')}</Text>
            </Pressable>
        </View>}

        {installed.length > 0 && <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('kissopen.plugins.installedSection')}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
                keyboardShouldPersistTaps="handled"
            >
                {installed.map(plugin => <InstalledMark
                    key={plugin.id}
                    plugin={plugin}
                    icon={icons.get(plugin.id)}
                    onPress={() => onOpen(plugin.id)}
                />)}
            </ScrollView>
        </View>}

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('kissopen.plugins.availableSection')}</Text>
            <PluginCatalogRows
                state={catalog}
                installed={installedIds}
                query={query}
                onInstalled={() => void state.reload()}
                onOpen={onOpenCatalog}
            />
        </View>
    </ScrollView>;
}

/**
 * One installed plugin in the strip.
 *
 * Dimmed when it is installed but not running, which is the state a reader most
 * needs to be able to spot without opening anything.
 */
function InstalledMark({ plugin, icon, onPress }: {
    plugin: CloudPlugin;
    icon?: string;
    onPress: () => void;
}) {
    const off = !plugin.enabled || !plugin.active;
    return <Pressable
        accessibilityRole="button"
        accessibilityLabel={plugin.name}
        accessibilityState={{ disabled: !plugin.enabled }}
        style={({ pressed }) => [styles.mark, pressed && { opacity: 0.7 }]}
        onPress={onPress}
    >
        <View style={off && styles.markOff}>
            <PluginIcon uri={icon} size={52} />
        </View>
        <Text numberOfLines={1} style={styles.markLabel}>{plugin.name}</Text>
    </Pressable>;
}

const styles = StyleSheet.create(theme => ({
    page: { paddingVertical: 8, paddingBottom: 24 },
    applying: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 10 },
    section: { gap: 6, paddingTop: 10 },
    sectionTitle: {
        color: theme.colors.text, fontSize: 15, paddingHorizontal: 20, paddingBottom: 2,
        ...Typography.default('semiBold'),
    },
    strip: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingVertical: 6 },
    mark: { width: 64, alignItems: 'center', gap: 6 },
    markOff: { opacity: 0.4 },
    markLabel: { color: theme.colors.textSecondary, fontSize: 11, textAlign: 'center' },
    state: { color: theme.colors.textSecondary, fontSize: 13 },
    problem: { gap: 6, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: 12, backgroundColor: theme.colors.surface },
    problemTitle: { color: theme.colors.text, fontSize: 15, ...Typography.default('semiBold') },
    problemBody: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
    retryText: { color: theme.colors.text, fontSize: 14, ...Typography.default('semiBold') },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
    description: { fontSize: 15, lineHeight: 25, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 420 },
    caption: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, textAlign: 'center' },
}));
