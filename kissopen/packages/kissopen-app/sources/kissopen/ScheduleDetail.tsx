import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { useAllSessions } from '@/sync/storage';
import { KissopenLoader } from './KissopenLoader';
import {
    absolute, describeNextRun, describeRecurrence, describeRun, describeStatus, describeTarget, isFinished,
} from './scheduleText';
import { useScheduleRuns, type Schedule, type ScheduleRun, type SchedulesState } from './useSchedules';

/**
 * One schedule, and every time it has run.
 *
 * The history is the part a list cannot carry: each entry keeps the instant it
 * was meant to run, what actually happened, and the conversation it happened
 * in. A run recorded against a version of the plan that has since been edited
 * still reads as it did then, because the plan was snapshotted when it fired.
 *
 * A run opens its conversation only when this phone actually has it. The
 * executors record the session by the id their own daemon knows it by, which
 * is not the id the account's sessions are listed under, and tapping such a
 * row used to land on "this session has been deleted" — a conversation that
 * exists, reported missing. Where it cannot be opened the row says what the
 * run said instead of pretending there is somewhere to go.
 */
export function ScheduleDetail({ schedule, state, onBack, onOpenRun }: {
    schedule: Schedule;
    state: SchedulesState;
    onBack: () => void;
    /** Opens the conversation a run happened in. */
    onOpenRun: (run: ScheduleRun) => void;
}) {
    const { theme } = useUnistyles();
    const history = useScheduleRuns(schedule.id);
    const [busy, setBusy] = React.useState(false);
    const [failed, setFailed] = React.useState('');
    /** Runs whose whole summary is showing, by run id. */
    const [opened, setOpened] = React.useState<ReadonlySet<string>>(new Set());
    const sessions = useAllSessions();
    const known = React.useMemo(() => new Set(sessions.map(session => session.id)), [sessions]);

    const run = React.useCallback(async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setFailed('');
        try { await action(); } catch (e) {
            setFailed(e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
    }, [busy]);

    const next = describeNextRun(schedule);
    return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
            <Text style={styles.name}>{schedule.name}</Text>
            <Text style={styles.summary}>{describeRecurrence(schedule)}</Text>
        </View>

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.schedules.instruction')}</Text>
            <Text style={styles.instruction}>{schedule.instruction}</Text>
        </View>

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.schedules.info')}</Text>
            <Row label={t('kissopen.schedules.target')} value={describeTarget(schedule)} />
            <Row label={t('kissopen.schedules.status')} value={describeStatus(schedule)} />
            <Row label={t('kissopen.schedules.timezone')} value={schedule.timezone} />
            {/* A paused or finished plan gets no countdown: a time that is not
                going to arrive is worse than no time at all. */}
            <Row
                label={t('kissopen.schedules.nextRun')}
                value={next ? `${absolute(schedule.next_run_at)} · ${next}` : t('kissopen.schedules.noNextRun')}
            />
            <Row
                label={t('kissopen.schedules.catchUp')}
                value={schedule.catch_up_window > 0
                    ? t('kissopen.schedules.catchUpMinutes', { count: Math.round(schedule.catch_up_window / 60000) })
                    : t('kissopen.schedules.catchUpNone')}
            />
        </View>

        {!!failed && <Text accessibilityRole="alert" style={styles.caption}>{failed}</Text>}

        <View style={styles.actions}>
            {schedule.status === 'active'
                ? <RoundButton
                    title={t('kissopen.schedules.pause')}
                    loading={busy}
                    onPress={() => void run(() => state.setStatus(schedule.id, 'paused'))}
                />
                : schedule.status === 'paused'
                ? <RoundButton
                    title={t('kissopen.schedules.resume')}
                    loading={busy}
                    onPress={() => void run(() => state.setStatus(schedule.id, 'active'))}
                />
                : null}
            <RoundButton
                title={t('kissopen.schedules.delete')}
                display="inverted"
                size="normal"
                loading={busy}
                onPress={() => void run(async () => { await state.remove(schedule.id); onBack(); })}
            />
            {/* Pausing stops the next trigger. It does not reach into a run that
                has already started, which is a separate thing to ask for. */}
            <Text style={styles.caption}>{t('kissopen.schedules.pauseNote')}</Text>
        </View>

        <View style={styles.group}>
            <Text style={styles.groupLabel}>{t('kissopen.schedules.history')}</Text>
            {history.loading && <View style={styles.center}><KissopenLoader size={24} /></View>}
            {!history.loading && history.runs.length === 0
                && <Text style={styles.caption}>{t('kissopen.schedules.noRunsYet')}</Text>}
            {history.runs.map(entry => {
                const openable = !!entry.session_id && known.has(entry.session_id);
                const said = !!(entry.summary || entry.error);
                const whole = opened.has(entry.id);
                return <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    accessibilityLabel={absolute(entry.scheduled_for)}
                    disabled={!openable && !said}
                    style={({ pressed }) => [styles.run, pressed && (openable || said) ? { opacity: 0.7 } : null]}
                    onPress={() => {
                        if (openable) { onOpenRun(entry); return; }
                        setOpened(current => {
                            const next = new Set(current);
                            if (!next.delete(entry.id)) next.add(entry.id);
                            return next;
                        });
                    }}
                >
                    <View style={styles.runIcon}>
                        <Ionicons name={runIcon(entry)} size={18} color={theme.colors.textSecondary} />
                    </View>
                    <View style={styles.text}>
                        <Text numberOfLines={1} style={styles.runTitle}>{absolute(entry.scheduled_for)}</Text>
                        <Text numberOfLines={1} style={styles.meta}>{describeRun(entry)}</Text>
                        {!!entry.summary && <Text numberOfLines={whole ? undefined : 2} style={styles.meta}>{entry.summary}</Text>}
                        {!!entry.error && <Text numberOfLines={whole ? undefined : 2} style={styles.meta}>{entry.error}</Text>}
                    </View>
                    {openable && <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />}
                </Pressable>;
            })}
        </View>
    </ScrollView>;
}

function runIcon(run: ScheduleRun): React.ComponentProps<typeof Ionicons>['name'] {
    if (!isFinished(run)) return 'ellipsis-horizontal';
    switch (run.status) {
        case 'succeeded': return 'checkmark-circle';
        case 'failed': return 'alert-circle';
        case 'missed': return 'time-outline';
        case 'skipped': return 'play-skip-forward-outline';
    }
    return 'close-circle';
}

function Row({ label, value }: { label: string; value: string }) {
    return <View style={styles.infoRow}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.rowValue}>{value}</Text>
    </View>;
}

const styles = StyleSheet.create(theme => ({
    body: { padding: 20, gap: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
    head: { gap: 6 },
    name: { color: theme.colors.text, fontSize: 24, ...Typography.default('semiBold') },
    summary: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 23 },
    group: { gap: 4 },
    groupLabel: {
        color: theme.colors.textSecondary, fontSize: 12, letterSpacing: 0.6,
        textTransform: 'uppercase', marginBottom: 4,
    },
    instruction: { color: theme.colors.text, fontSize: 15, lineHeight: 24 },
    infoRow: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider,
    },
    rowLabel: { color: theme.colors.textSecondary, fontSize: 15, flexGrow: 1, flexShrink: 0 },
    rowValue: { color: theme.colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right' },
    run: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.text, alignSelf: 'center' },
    runIcon: {
        width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.surface,
    },
    text: { flexGrow: 1, flexShrink: 1, gap: 2 },
    runTitle: { color: theme.colors.text, fontSize: 15 },
    meta: { color: theme.colors.textSecondary, fontSize: 13 },
    actions: { gap: 12 },
    caption: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
}));
