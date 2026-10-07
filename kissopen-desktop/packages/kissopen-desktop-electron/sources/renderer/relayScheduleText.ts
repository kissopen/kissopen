/*
How a schedule reads to a person.

Kept away from the components because the same sentence appears in the row, in
the detail and in the run history, and three copies of "every weekday at 09:00"
become three different sentences the first time one is touched.

The shapes are the server's own, generated from `internal/api`. The wording is
this window's, because this window has its own catalog — but what each field
means is decided in one place, so a status the server adds shows up here as
itself rather than as a blank.
*/
import { t } from "kissopen-desktop-state";
import type { Schedule, ScheduleRun } from "kissopen-desktop-state";

function clock(atMinute: number): string {
    const hour = Math.floor(atMinute / 60);
    const minute = atMinute % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

/*
The rule in words, in the schedule's own timezone.

Takes only the four fields that decide it, because a draft has them and is not
a schedule: it has no id, no status and no version, and demanding one would
mean either a cast or a second copy of this sentence.
*/
export function describeRecurrence(
    schedule: Pick<
        Schedule,
        "recurrence" | "once_at" | "at_minute" | "weekday" | "interval_minutes"
    >,
): string {
    switch (schedule.recurrence) {
        case "interval":
            return t("每隔 {count} 分钟", { count: schedule.interval_minutes ?? 0 });
        case "once":
            return t("Once, at {time}", { time: absolute(schedule.once_at) });
        case "daily":
            return t("Every day at {time}", { time: clock(schedule.at_minute) });
        case "weekdays":
            return t("Every weekday at {time}", { time: clock(schedule.at_minute) });
        case "weekly":
            return t("Every {day} at {time}", {
                day: t(WEEKDAYS[Math.max(0, Math.min(6, schedule.weekday))]),
                time: clock(schedule.at_minute),
            });
    }
    // A recurrence a newer server knows and this build does not. Its own name
    // is a worse sentence than the four above and a better one than nothing.
    return schedule.recurrence;
}

export function absolute(at: number): string {
    if (!at) return "—";
    return new Date(at).toLocaleString();
}

/**
 * How long until the next run, in words.
 *
 * Absent for a schedule that is not going to fire. A paused or finished plan
 * showing a countdown says something that is not true, and the reader has no
 * way to tell it from one that is.
 */
export function describeNextRun(schedule: Schedule): string | undefined {
    if (schedule.status !== "active" || !schedule.next_run_at) return undefined;
    const remaining = schedule.next_run_at - Date.now();
    if (remaining <= 0) return t("Due now");
    const minutes = Math.round(remaining / 60000);
    if (minutes < 60) return t("in {count} min", { count: Math.max(1, minutes) });
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t("in {count} h", { count: hours });
    return t("in {count} d", { count: Math.round(hours / 24) });
}

/** What the plan itself is doing, which is not what its last run did. */
export function describeStatus(schedule: Schedule): string {
    switch (schedule.status) {
        case "active":
            return t("Active");
        case "paused":
            return t("Paused");
        case "ended":
            return t("Ended");
        case "completed":
            return t("Completed");
    }
    return schedule.status;
}

/**
 * What became of one run.
 *
 * Deliberately never says "delivered". Handing the work to a machine and the
 * work happening are different facts, and only the second is a result.
 */
export function describeRun(run: ScheduleRun | null | undefined): string {
    if (!run) return t("Has not run yet");
    if (run.cancel_requested_at > 0 && !runFinished(run)) return t("Stopping…");
    if (run.reconciliation === "pending" && !runFinished(run)) return t("Unconfirmed");
    switch (run.status) {
        case "queued":
            return t("Queued");
        case "waiting_device":
            return t("Waiting for the machine");
        case "accepted":
            return t("Accepted");
        case "running":
            return t("Running");
        case "needs_user":
            return t("Waiting for you");
        case "succeeded":
            return t("Succeeded");
        case "failed":
            return t("Failed");
        case "cancelled":
            return t("Cancelled");
        case "missed":
            return t("Missed");
        case "skipped":
            return t("Skipped");
    }
    return run.status;
}

export function runFinished(run: ScheduleRun): boolean {
    return ["succeeded", "failed", "cancelled", "missed", "skipped"].includes(run.status);
}

/** Where it runs. Only the cloud can run one yet, but the field is not. */
/**
 * Where a schedule runs, by the name the account gives that machine.
 *
 * The id is what the target carries; the name is what a person recognises.
 * A machine the roster does not list any more is named by its id, so a plan
 * bound to a computer that left the account still says where it was going.
 */
export function describeTarget(schedule: Schedule, names?: ReadonlyMap<string, string>): string {
    if (schedule.target === "cloud") return t("Cloud workspace");
    const id = schedule.target.replace(/^machine:/u, "");
    const machine = t("Machine {name}", { name: names?.get(id) ?? id });
    return schedule.project_name ? `${machine} · ${schedule.project_name}` : machine;
}
