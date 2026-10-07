import * as React from 'react';
import { api } from './api/client';
import { cloudCache } from './cloudCache';

/**
 * The account's schedules as the server lists them, kept on the phone as they
 * arrive so the next look (and one without a connection) starts from them.
 * Typed by the caller, like any `api` answer; see cloudCache.schedules.
 */
export async function schedulesFetch<T>(): Promise<T> {
    const data = await api<T>('/schedules');
    cloudCache.schedulesWrite(data);
    return data;
}

type SchedulesAnswer = { schedules?: Schedule[]; unread?: number; machines?: ScheduleMachine[] };

/** One run of a schedule: what happened the time it actually fired. */
export interface ScheduleRun {
    readonly id: string;
    readonly schedule_id: string;
    readonly scheduled_for: number;
    readonly start_before: number;
    readonly started_at: number;
    readonly ended_at: number;
    readonly status: string;
    /** `pending` when the executor could not be reached to confirm this. */
    readonly reconciliation: string;
    readonly cancel_requested_at: number;
    readonly session_id: string;
    readonly summary: string;
    readonly error: string;
    readonly retry_of_run_id: string;
    readonly delivery_attempts: number;
    /** When this result was looked at. Zero is unread. */
    readonly read_at: number;
}

/** A standing arrangement. Distinct from any one time it ran. */
export interface Schedule {
    readonly id: string;
    readonly name: string;
    readonly target: string;
    readonly instruction: string;
    readonly timezone: string;
    readonly recurrence: string;
    readonly weekday: number;
    readonly at_minute: number;
    readonly once_at: number;
    readonly next_run_at: number;
    readonly status: string;
    readonly catch_up_window: number;
    readonly pause_reason: string;
    readonly created_by: string;
    readonly version: number;
    readonly created: number;
    readonly updated: number;
    /** The most recent run, so a row can show both facts at once. */
    readonly last_run?: ScheduleRun;
}

/** A computer of this account's that a new task could be given to. */
export interface ScheduleMachine {
    readonly machine_id: string;
    readonly name: string;
    readonly last_seen: number;
}

export interface SchedulesState {
    readonly schedules: readonly Schedule[];
    /**
     * The computers the server will accept a task for.
     *
     * Readiness is the server's fact, not the relay's: a computer can be
     * online and still refuse a task, because nothing is delivered to it — its
     * desktop comes for the run, and one that has never come has nothing to
     * come with. Offering a machine that will be refused sends somebody to a
     * dead end they can only find by pressing Create.
     */
    readonly machines: readonly ScheduleMachine[];
    /** Finished results nobody has looked at, across every schedule. */
    readonly unread: number;
    readonly loading: boolean;
    readonly error: string;
    reload(): Promise<void>;
    setStatus(id: string, status: 'active' | 'paused' | 'ended'): Promise<void>;
    remove(id: string): Promise<void>;
    /** Marks one result as looked at. */
    read(scheduleId: string, runId: string): Promise<void>;
}

/**
 * This account's scheduled tasks.
 *
 * Every schedule the account has, wherever it runs — the list is not scoped to
 * the assistant that happened to create one, because a person who set something
 * up in one conversation should not have to find that conversation again to
 * turn it off.
 *
 * A schedule's own state and the result of its last run are separate fields and
 * stay separate here: a recurring task that succeeded this morning is still
 * enabled, and one that is enabled is not therefore running.
 *
 * The list opens on the one last fetched (cloudCache) and is replaced when the
 * server answers; a failed refresh keeps it and reports the error.
 */
export function useSchedules(enabled: boolean): SchedulesState {
    const [cached] = React.useState(() => cloudCache.schedules<SchedulesAnswer>());
    const [schedules, setSchedules] = React.useState<readonly Schedule[]>(cached?.schedules ?? []);
    const [machines, setMachines] = React.useState<readonly ScheduleMachine[]>(cached?.machines ?? []);
    /** Finished results nobody has looked at, across every schedule. */
    const [unread, setUnread] = React.useState(cached?.unread ?? 0);
    const [loading, setLoading] = React.useState(cached === undefined);
    const [error, setError] = React.useState('');
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const reload = React.useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        try {
            const data = await schedulesFetch<SchedulesAnswer>();
            if (!alive.current) return;
            setSchedules(data.schedules ?? []);
            setMachines(data.machines ?? []);
            setUnread(data.unread ?? 0);
            setError('');
        } catch (e) {
            if (alive.current) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [enabled]);

    React.useEffect(() => { void reload(); }, [reload]);

    // Something else moves this list: the server fires the triggers, so a run
    // can start and finish while the page is simply open.
    React.useEffect(() => {
        if (!enabled) return;
        const timer = setInterval(() => { void reload(); }, 20000);
        return () => clearInterval(timer);
    }, [enabled, reload]);

    const setStatus = React.useCallback(async (id: string, status: 'active' | 'paused' | 'ended') => {
        await api(`/schedules/${encodeURIComponent(id)}`, 'POST', { status });
        await reload();
    }, [reload]);

    const remove = React.useCallback(async (id: string) => {
        await api(`/schedules/${encodeURIComponent(id)}`, 'POST', { delete: true });
        await reload();
    }, [reload]);

    /*
     * Reading one result.
     *
     * The reader's own act, not something inferred from a list being fetched:
     * opening this page does not mean every result on it was looked at. The
     * count is corrected here rather than waiting for the next poll, because
     * the badge is next to the thing that was just read.
     */
    const read = React.useCallback(async (scheduleId: string, runId: string) => {
        await api(`/schedules/${encodeURIComponent(scheduleId)}/runs/${encodeURIComponent(runId)}/read`, 'POST', {});
        if (alive.current) setUnread(count => Math.max(0, count - 1));
    }, []);

    return { schedules, machines, unread, loading, error, reload, setStatus, remove, read };
}

/** The runs of one schedule, newest first. */
export function useScheduleRuns(scheduleId: string | undefined): {
    runs: readonly ScheduleRun[];
    loading: boolean;
    error: string;
    reload(): Promise<void>;
} {
    const [runs, setRuns] = React.useState<readonly ScheduleRun[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const reload = React.useCallback(async () => {
        if (scheduleId === undefined) { setLoading(false); return; }
        try {
            const data = await api<{ runs?: ScheduleRun[] }>(`/schedules/${encodeURIComponent(scheduleId)}/runs`);
            if (!alive.current) return;
            setRuns(data.runs ?? []);
            setError('');
        } catch (e) {
            if (alive.current) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [scheduleId]);

    React.useEffect(() => { void reload(); }, [reload]);
    React.useEffect(() => {
        if (scheduleId === undefined) return;
        const timer = setInterval(() => { void reload(); }, 15000);
        return () => clearInterval(timer);
    }, [scheduleId, reload]);

    return { runs, loading, error, reload };
}
