import { t, type ConversationScheduledTask } from "kissopen-desktop-state";

/*
How a scheduled task the agent created reads in a conversation: when it runs
and where. The times are the task's own, in its own timezone, because that is
the clock the server fires it on.
*/

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function clock(atMinute: number): string {
    const minutes = Math.max(0, Math.min(24 * 60 - 1, Math.round(atMinute)));
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Month, day and minute of the day of an instant, on the given timezone's clock. */
function zoned(
    at: number,
    timezone: string,
): { month: number; day: number; minute: number } | undefined {
    const options: Intl.DateTimeFormatOptions = {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
    };
    let format: Intl.DateTimeFormat;
    try {
        format = new Intl.DateTimeFormat(
            "en-US",
            timezone ? { ...options, timeZone: timezone } : options,
        );
    } catch {
        // A zone this runtime does not know: the reader's own clock is the
        // nearest honest answer.
        format = new Intl.DateTimeFormat("en-US", options);
    }
    const parts = format.formatToParts(new Date(at));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((candidate) => candidate.type === type)?.value);
    const month = part("month");
    const day = part("day");
    const hour = part("hour") % 24;
    const minute = part("minute");
    if (![month, day, hour, minute].every(Number.isFinite)) return undefined;
    return { month, day, minute: hour * 60 + minute };
}

/** When the task runs, in words: "每个工作日 09:00", "9月30日 14:00 一次". */
export function scheduledTaskTiming(
    schedule: Pick<
        ConversationScheduledTask,
        "recurrence" | "weekday" | "atMinute" | "onceAt" | "timezone" | "intervalMinutes"
    >,
): string {
    switch (schedule.recurrence) {
        case "interval":
            return t("每隔 {count} 分钟", { count: schedule.intervalMinutes ?? 0 });
        case "daily":
            return t("每天 {time}", { time: clock(schedule.atMinute) });
        case "weekdays":
            return t("每个工作日 {time}", { time: clock(schedule.atMinute) });
        case "weekly":
            return t("每{day} {time}", {
                day: t(WEEKDAYS[Math.max(0, Math.min(6, Math.round(schedule.weekday)))]!),
                time: clock(schedule.atMinute),
            });
        case "once": {
            const at = schedule.onceAt > 0 ? zoned(schedule.onceAt, schedule.timezone) : undefined;
            return at
                ? t("{month}月{day}日 {time} 一次", {
                      month: at.month,
                      day: at.day,
                      time: clock(at.minute),
                  })
                : t("仅一次");
        }
    }
}

/**
 * Where the task runs. A machine target is the computer the conversation runs
 * on — `machineName` when the surface shows another machine's conversation,
 * this computer otherwise.
 */
export function scheduledTaskPlace(
    schedule: Pick<ConversationScheduledTask, "target" | "projectName">,
    machineName?: string,
): string {
    const place =
        schedule.target === "cloud" ? t("云端") : machineName ? machineName : t("这台电脑");
    return schedule.projectName ? `${place} · ${schedule.projectName}` : place;
}
