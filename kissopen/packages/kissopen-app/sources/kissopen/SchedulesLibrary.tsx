import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { useNotificationChoice, type NotificationChoice } from './useNotificationChoice';
import { KissopenLoader } from './KissopenLoader';
import { describeNextRun, describeRecurrence, describeRun, describeStatus, describeTarget } from './scheduleText';
import type { Schedule, SchedulesState } from './useSchedules';

/**
 * The account's scheduled tasks.
 *
 * Every row says three things that are easy to conflate and must not be: where
 * it runs, whether the plan is still going to fire, and what happened the last
 * time it did. A plan that succeeded this morning is still enabled; a plan that
 * is enabled is not therefore running.
 */
export function SchedulesLibrary({ state, query, onOpen, onCreate }: {
    state: SchedulesState;
    query: string;
    onOpen: (id: string) => void;
    onCreate: () => void;
}) {
    const { theme } = useUnistyles();
    const needle = query.trim().toLocaleLowerCase();
    const matches = React.useMemo(() => (
        needle.length === 0
            ? state.schedules
            : state.schedules.filter(one => (
                one.name.toLocaleLowerCase().includes(needle)
                || one.instruction.toLocaleLowerCase().includes(needle)
            ))
    ), [needle, state.schedules]);

    if (state.loading) {
        return <View style={styles.center}><KissopenLoader size={32} /></View>;
    }
    if (state.error) {
        return <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={44} color={theme.colors.textSecondary} />
            <Text accessibilityRole="alert" style={styles.description}>{state.error}</Text>
        </View>;
    }
    if (state.schedules.length === 0) {
        return <View style={styles.center}>
            <Ionicons name="time-outline" size={44} color={theme.colors.textSecondary} />
            <Text style={styles.title}>{t('kissopen.schedules.emptyTitle')}</Text>
            <Text style={styles.description}>{t('kissopen.schedules.emptyDescription')}</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('kissopen.schedules.create')}
                style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.7 }]}
                onPress={onCreate}
            >
                <Ionicons name="add" size={18} color={theme.colors.text} />
                <Text style={styles.createText}>{t('kissopen.schedules.create')}</Text>
            </Pressable>
        </View>;
    }
    return <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <NotificationChoiceRow />
        {matches.map(schedule => <Row key={schedule.id} schedule={schedule} onPress={() => onOpen(schedule.id)} />)}
        {matches.length === 0 && <Text style={styles.caption}>{t('kissopen.schedules.noMatches')}</Text>}
    </ScrollView>;
}

/*
What to be told when one of these finishes.

On this page rather than buried in settings, because this is where somebody
finds out that a task ran every hour all night. Turning it off never hides the
results: they stay unread here either way.
*/
function NotificationChoiceRow() {
    const notifications = useNotificationChoice(true);
    const options: { value: NotificationChoice; label: string }[] = [
        { value: 'all', label: t('kissopen.schedules.notifyAll') },
        { value: 'failures', label: t('kissopen.schedules.notifyFailures') },
        { value: 'off', label: t('kissopen.schedules.notifyOff') },
    ];
    return <View style={styles.notify}>
        <Text style={styles.notifyLabel}>{t('kissopen.schedules.notifyLabel')}</Text>
        <View style={styles.notifyChoices}>
            {options.map(option => {
                const chosen = notifications.choice === option.value;
                return <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    disabled={notifications.busy}
                    style={({ pressed }) => [styles.notifyChoice, chosen && styles.notifyChosen, pressed && { opacity: 0.7 }]}
                    onPress={() => { void notifications.set(option.value).catch(() => {}); }}
                >
                    <Text style={[styles.notifyChoiceText, chosen && styles.notifyChosenText]}>{option.label}</Text>
                </Pressable>;
            })}
        </View>
    </View>;
}

function Row({ schedule, onPress }: { schedule: Schedule; onPress: () => void }) {
    const { theme } = useUnistyles();
    const next = describeNextRun(schedule);
    const dimmed = schedule.status !== 'active';
    return <Pressable
        accessibilityRole="button"
        accessibilityLabel={schedule.name}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={onPress}
    >
        <View style={[styles.icon, dimmed && styles.dimmed]}>
            <Ionicons
                name={schedule.status === 'active' ? 'time' : 'pause'}
                size={20}
                color={theme.colors.textSecondary}
            />
        </View>
        <View style={styles.text}>
            <Text numberOfLines={1} style={styles.name}>{schedule.name}</Text>
            <Text numberOfLines={1} style={styles.meta}>
                {describeTarget(schedule)} · {describeRecurrence(schedule)}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
                {/* The plan's own state, then what the last run actually did.
                    Two facts, never merged into one word. */}
                {describeStatus(schedule)}
                {next ? ` · ${t('kissopen.schedules.nextIn', { when: next })}` : ''}
                {' · '}{describeRun(schedule.last_run)}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
    </Pressable>;
}

const styles = StyleSheet.create(theme => ({
    notify: { gap: 8, paddingHorizontal: 4, paddingBottom: 8 },
    notifyLabel: { color: theme.colors.textSecondary, fontSize: 13 },
    notifyChoices: { flexDirection: 'row', gap: 8 },
    notifyChoice: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: theme.colors.surface,
    },
    notifyChosen: { backgroundColor: theme.colors.text },
    notifyChoiceText: { color: theme.colors.textSecondary, fontSize: 13 },
    notifyChosenText: { color: theme.colors.surface },
    list: { paddingVertical: 8, gap: 2, paddingBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20 },
    icon: {
        width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.surface,
    },
    dimmed: { opacity: 0.5 },
    text: { flexGrow: 1, flexShrink: 1, gap: 3 },
    name: { color: theme.colors.text, fontSize: 16, ...Typography.default('semiBold') },
    meta: { color: theme.colors.textSecondary, fontSize: 13 },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
    title: { fontSize: 22, color: theme.colors.text, textAlign: 'center' },
    description: { fontSize: 15, lineHeight: 25, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 420 },
    caption: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
    createButton: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 10, paddingHorizontal: 18, borderRadius: 22, backgroundColor: theme.colors.surface,
    },
    createText: { color: theme.colors.text, fontSize: 15, ...Typography.default('semiBold') },
}));
