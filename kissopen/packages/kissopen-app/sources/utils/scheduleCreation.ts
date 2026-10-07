/**
 * What the assistant's `create_scheduled_task` tool answered.
 *
 * The server creates the task itself, so the result is either the task as it
 * now exists, a question about the timing the assistant goes on to ask in its
 * own words, or the reason it could not be made. The result travels as the
 * tool's value, which a provider may hand over as the object, as its JSON, or
 * wrapped in text content blocks; all of those are read the same way.
 */

export const SCHEDULE_CREATE_TOOL_NAME = 'create_scheduled_task';

export interface CreatedSchedule {
    readonly id: string;
    readonly name: string;
    readonly instruction: string;
    /** `cloud` or `machine:<id>`. */
    readonly target: string;
    readonly recurrence: string;
    readonly weekday: number;
    readonly at_minute: number;
    readonly once_at: number;
    readonly timezone: string;
    readonly next_run_at: number;
    readonly project_name: string;
}

export type ScheduleCreation =
    | { readonly status: 'created'; readonly schedule: CreatedSchedule }
    | { readonly status: 'needs'; readonly question: string; readonly choices: readonly string[] }
    | { readonly status: 'failed'; readonly error: string };

export function isScheduleCreateToolName(name: string): boolean {
    return name === SCHEDULE_CREATE_TOOL_NAME;
}

/** The answer, or undefined while there is none or it is not one of the three. */
export function parseScheduleCreation(result: unknown): ScheduleCreation | undefined {
    const record = unwrap(result, 0);
    if (!record) return undefined;
    switch (record.status) {
        case 'created': {
            const schedule = asRecord(record.schedule);
            if (!schedule) return undefined;
            const id = text(schedule.id);
            const instruction = text(schedule.instruction);
            const name = text(schedule.name) || instruction;
            if (!id && !name) return undefined;
            return {
                status: 'created',
                schedule: {
                    id,
                    name,
                    instruction,
                    target: text(schedule.target) || 'cloud',
                    recurrence: text(schedule.recurrence),
                    weekday: count(schedule.weekday),
                    at_minute: count(schedule.at_minute),
                    once_at: count(schedule.once_at),
                    timezone: text(schedule.timezone),
                    next_run_at: count(schedule.next_run_at),
                    project_name: text(schedule.project_name),
                },
            };
        }
        case 'needs':
            return {
                status: 'needs',
                question: text(record.question),
                choices: Array.isArray(record.choices)
                    ? record.choices.filter((choice): choice is string => typeof choice === 'string' && choice.trim() !== '')
                    : [],
            };
        case 'failed':
            return { status: 'failed', error: text(record.error) };
    }
    return undefined;
}

/** A created task is the one answer worth keeping in view; the others are the assistant's to explain. */
export function isCreatedSchedule(tool: { readonly name: string; readonly result?: unknown }): boolean {
    return isScheduleCreateToolName(tool.name) && parseScheduleCreation(tool.result)?.status === 'created';
}

function unwrap(value: unknown, depth: number): Record<string, unknown> | undefined {
    if (depth > 3 || value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
        try {
            return unwrap(JSON.parse(trimmed), depth + 1);
        } catch {
            return undefined;
        }
    }
    if (Array.isArray(value)) {
        for (const block of value) {
            const record = asRecord(block);
            const found = record && typeof record.text === 'string' ? unwrap(record.text, depth + 1) : unwrap(block, depth + 1);
            if (found) return found;
        }
        return undefined;
    }
    const record = asRecord(value);
    if (!record) return undefined;
    if (typeof record.status === 'string') return record;
    // The agent stores what the tool said to the model as `{output: "<json>"}`.
    if (typeof record.output === 'string') return unwrap(record.output, depth + 1);
    if (record.content !== undefined) return unwrap(record.content, depth + 1);
    return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function count(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
