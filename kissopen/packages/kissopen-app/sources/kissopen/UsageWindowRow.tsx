import * as React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { UsageWindow } from './api/types';
import { t } from '@/text';

const LABELS: Record<UsageWindow['kind'], string> = {
    '5h': t('kissopen.usage.window5h'),
    week: t('kissopen.usage.windowWeek'),
    month: t('kissopen.usage.windowMonth'),
    grant: t('kissopen.usage.windowFree'),
};

/** How long until `at`, the way the reset line says it: 3 h, 25 min, 2 d. */
function until(at: number): string {
    const minutes = Math.max(1, Math.round((at - Date.now()) / 60000));
    if (minutes < 60) return t('kissopen.usage.minutes', { minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('kissopen.usage.hours', { hours });
    return t('kissopen.usage.days', { days: Math.round(hours / 24) });
}

/**
 * One usage limit: its name and how much is left, a bar of what is left, and
 * when it frees up again. A proportion, never an amount — the plan says what
 * may be spent, not a balance to watch drain. The one-time free allowance has
 * no reset line, because it never resets; a window with nothing spent yet has
 * none either, because its clock has not started.
 */
export function UsageWindowRow(props: { window: UsageWindow; showDivider?: boolean }) {
    const w = props.window;
    const left = w.limit > 0 ? Math.max(0, Math.min(100, Math.round((1 - w.used / w.limit) * 100))) : 100;
    const resets = w.kind !== 'grant' && w.resets_at > 0 ? t('kissopen.usage.resetsIn', { duration: until(w.resets_at) }) : undefined;
    return (
        <View style={[styles.row, props.showDivider && styles.divider]}>
            <View style={styles.top}>
                <Text style={styles.title}>{LABELS[w.kind]}</Text>
                <Text style={styles.left}>{t('kissopen.usage.remaining', { percent: left })}</Text>
            </View>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: left }}>
                <View style={[styles.fill, { width: `${left}%` }]} />
            </View>
            {resets && <Text style={styles.resets}>{resets}</Text>}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
    top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    title: { fontSize: 17, color: theme.colors.text },
    left: { fontSize: 16, color: theme.colors.textSecondary },
    track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.divider },
    fill: { height: '100%', borderRadius: 3, backgroundColor: '#4C8DF6' },
    resets: { fontSize: 14, color: theme.colors.textSecondary },
}));
