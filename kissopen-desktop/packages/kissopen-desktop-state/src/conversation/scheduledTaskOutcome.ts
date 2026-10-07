/**
 * What the agent's `create_scheduled_task` tool did, read from its result.
 *
 * The tool reports in JSON: the task it created on the server, the question it
 * still has about the time, or why it could not. That result is the tool's
 * contract with this desktop, so it is checked field by field here, once, and
 * carried on as a typed presentation; every surface draws the same value.
 */

/** The agent tool that creates a scheduled task directly on the server. */
export const SCHEDULED_TASK_CREATE_TOOL = "create_scheduled_task";

export type ConversationScheduledTaskRecurrence =
    | "once"
    | "daily"
    | "weekdays"
    | "weekly"
    | "interval";

/** A scheduled task as the tool reported it, the moment it was created. */
export interface ConversationScheduledTask {
    readonly id: string;
    readonly name: string;
    readonly instruction: string;
    /** "cloud", or "machine:<id>". */
    readonly target: string;
    readonly recurrence: ConversationScheduledTaskRecurrence;
    /** 0–6, Sunday first. Meaningful only for a weekly task. */
    readonly weekday: number;
    /** Minutes after local midnight, in `timezone`. */
    readonly atMinute: number;
    readonly intervalMinutes?: number;
    /** Epoch millis of a one-off. Meaningful only for "once". */
    readonly onceAt: number;
    readonly timezone: string;
    /** Epoch millis of the next run, 0 when there is none. */
    readonly nextRunAt: number;
    /** The project it is listed with; empty for none. */
    readonly projectName: string;
}

export type ConversationScheduledTaskOutcome =
    | { readonly status: "created"; readonly schedule: ConversationScheduledTask }
    /** The time was unclear; the agent asks the person itself. */
    | {
          readonly status: "needs";
          readonly question: string;
          readonly choices: readonly string[];
      }
    | { readonly status: "failed"; readonly error: string };

type Record_ = { readonly [key: string]: unknown };

function recordOf(value: unknown): Record_ | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record_)
        : undefined;
}

function text(record: Record_, key: string): string | undefined {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
}

function count(record: Record_, key: string): number | undefined {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recurrenceOf(value: unknown): ConversationScheduledTaskRecurrence | undefined {
    return value === "once" ||
        value === "daily" ||
        value === "weekdays" ||
        value === "weekly" ||
        value === "interval"
        ? value
        : undefined;
}

function scheduleOf(value: unknown): ConversationScheduledTask | undefined {
    const record = recordOf(value);
    if (!record) return undefined;
    const id = text(record, "id");
    const name = text(record, "name");
    const target = text(record, "target");
    const recurrence = recurrenceOf(record.recurrence);
    if (!id || name === undefined || !target || !recurrence) return undefined;
    return {
        id,
        name,
        instruction: text(record, "instruction") ?? "",
        target,
        recurrence,
        weekday: count(record, "weekday") ?? 0,
        atMinute: count(record, "at_minute") ?? 0,
        intervalMinutes: count(record, "interval_minutes") ?? 0,
        onceAt: count(record, "once_at") ?? 0,
        timezone: text(record, "timezone") ?? "",
        nextRunAt: count(record, "next_run_at") ?? 0,
        projectName: text(record, "project_name") ?? "",
    };
}

/**
 * The outcome a `create_scheduled_task` result reports, or nothing when the
 * result is not one: still running, or text the tool did not write as its
 * report (a transport error, say), which the row then shows as it is.
 *
 * Takes the result as it arrives — JSON text from this computer's agent, and
 * either text or the decoded value from the relay.
 */
export function scheduledTaskOutcomeParse(
    result: unknown,
): ConversationScheduledTaskOutcome | undefined {
    let value = result;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value) as unknown;
        } catch {
            return undefined;
        }
    }
    const record = recordOf(value);
    if (!record) return undefined;
    // The agent stores what the tool said to the model as `{output: "<json>"}`.
    if (record.status === undefined && typeof record.output === "string")
        return scheduledTaskOutcomeParse(record.output);
    switch (record.status) {
        case "created": {
            const schedule = scheduleOf(record.schedule);
            return schedule ? { status: "created", schedule } : undefined;
        }
        case "needs": {
            const choices = Array.isArray(record.choices)
                ? record.choices.filter((choice): choice is string => typeof choice === "string")
                : [];
            return { status: "needs", question: text(record, "question") ?? "", choices };
        }
        case "failed":
            return { status: "failed", error: text(record, "error") ?? "" };
    }
    return undefined;
}

/** The retired tool that only proposed a task for the reader to create again. */
export const SCHEDULE_PROPOSAL_TOOL = "propose_scheduled_task";

/**
 * A proposal call that failed, which shows nothing at all.
 *
 * The proposal tool is gone, but a conversation that used it still has those
 * calls in its history, and its model sometimes reaches for it again: the call
 * fails, the agent then makes the task with `create_scheduled_task`, and a
 * proposal card drawn from the failed call's arguments would ask the reader to
 * create, a second time, a task that already exists.
 */
export function scheduleProposalFailed(toolName: string, failed: boolean): boolean {
    return failed && toolName === SCHEDULE_PROPOSAL_TOOL;
}
