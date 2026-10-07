import { t } from '@/text';
import type { Schedule, ScheduleRun } from './useSchedules';

/**
 * How a schedule reads to a person.
 *
 * Kept away from the components because the same sentence appears in the row,
 * the detail and the run history, and three copies of "every weekday at 09:00"
 * become three different sentences the first time one is touched.
 */

function clock(atMinute: number): string {
    const hour = Math.floor(atMinute / 60);
    const minute = atMinute % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * The rule in words, in the schedule's own timezone.
 *
 * Takes only the four fields that decide it, because a draft has them and is
 * not a schedule: it has no id, no status and no version, and demanding one
 * would mean either a cast or a second copy of this sentence.
 */
export function describeRecurrence(schedule: {
    readonly recurrence: string;
    readonly weekday: number;
    readonly at_minute: number;
    readonly once_at: number;
}): string {
    switch (schedule.recurrence) {
        case 'once':
            return t('kissopen.schedules.ruleOnce', { time: absolute(schedule.once_at) });
        case 'daily':
            return t('kissopen.schedules.ruleDaily', { time: clock(schedule.at_minute) });
        case 'weekdays':
            return t('kissopen.schedules.ruleWeekdays', { time: clock(schedule.at_minute) });
        case 'weekly':
            return t('kissopen.schedules.ruleWeekly', {
                day: t(weekdayKey(schedule.weekday)),
                time: clock(schedule.at_minute),
            });
    }
    return schedule.recurrence;
}

const WEEKDAYS = [
    'kissopen.schedules.sunday', 'kissopen.schedules.monday', 'kissopen.schedules.tuesday',
    'kissopen.schedules.wednesday', 'kissopen.schedules.thursday', 'kissopen.schedules.friday',
    'kissopen.schedules.saturday',
] as const;

function weekdayKey(weekday: number): (typeof WEEKDAYS)[number] {
    return WEEKDAYS[Math.max(0, Math.min(6, weekday))];
}

export function absolute(at: number): string {
    if (!at) return '—';
    return new Date(at).toLocaleString();
}

/**
 * How long until the next run, in words.
 *
 * Absent for a schedule that is not going to fire: a paused or finished plan
 * showing a countdown is the misleading thing the requirement names.
 */
export function describeNextRun(schedule: Schedule): string | undefined {
    if (schedule.status !== 'active' || !schedule.next_run_at) return undefined;
    const remaining = schedule.next_run_at - Date.now();
    if (remaining <= 0) return t('kissopen.schedules.dueNow');
    const minutes = Math.round(remaining / 60000);
    if (minutes < 60) return t('kissopen.schedules.inMinutes', { count: Math.max(1, minutes) });
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t('kissopen.schedules.inHours', { count: hours });
    return t('kissopen.schedules.inDays', { count: Math.round(hours / 24) });
}

/** What the plan itself is doing, which is not what its last run did. */
export function describeStatus(schedule: Schedule): string {
    switch (schedule.status) {
        case 'active': return t('kissopen.schedules.statusActive');
        case 'paused': return t('kissopen.schedules.statusPaused');
        case 'ended': return t('kissopen.schedules.statusEnded');
        case 'completed': return t('kissopen.schedules.statusCompleted');
    }
    return schedule.status;
}

/** What became of one run. Deliberately never says "delivered". */
export function describeRun(run: ScheduleRun | undefined): string {
    if (!run) return t('kissopen.schedules.noRunsYet');
    if (run.cancel_requested_at > 0 && !isFinished(run)) return t('kissopen.schedules.runCancelPending');
    if (run.reconciliation === 'pending' && !isFinished(run)) return t('kissopen.schedules.runUnconfirmed');
    switch (run.status) {
        case 'queued': return t('kissopen.schedules.runQueued');
        case 'waiting_device': return t('kissopen.schedules.runWaitingDevice');
        case 'accepted': return t('kissopen.schedules.runAccepted');
        case 'running': return t('kissopen.schedules.runRunning');
        case 'needs_user': return t('kissopen.schedules.runNeedsUser');
        case 'succeeded': return t('kissopen.schedules.runSucceeded');
        case 'failed': return t('kissopen.schedules.runFailed');
        case 'cancelled': return t('kissopen.schedules.runCancelled');
        case 'missed': return t('kissopen.schedules.runMissed');
        case 'skipped': return t('kissopen.schedules.runSkipped');
    }
    return run.status;
}

export function isFinished(run: ScheduleRun): boolean {
    return ['succeeded', 'failed', 'cancelled', 'missed', 'skipped'].includes(run.status);
}

/**
 * Where it runs. A computer is named by what the caller knows it as, when it
 * knows, and by its id otherwise.
 */
export function describeTarget(schedule: { readonly target: string }, machineName?: string): string {
    if (schedule.target === 'cloud') return t('kissopen.schedules.targetCloud');
    return t('kissopen.schedules.targetMachine', { name: machineName || schedule.target.replace(/^machine:/, '') });
}
