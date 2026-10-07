import { describe, expect, it } from 'vitest';
import { isCreatedSchedule, parseScheduleCreation } from './scheduleCreation';

const created = {
    status: 'created',
    schedule: {
        id: 'sch_1',
        name: 'Morning digest',
        instruction: 'Summarise the news',
        target: 'machine:m1',
        recurrence: 'weekly',
        weekday: 1,
        at_minute: 540,
        once_at: 0,
        timezone: 'Asia/Shanghai',
        next_run_at: 1760000000000,
        project_name: 'News',
    },
};

describe('parseScheduleCreation', () => {
    it('reads a created task from the object, its JSON, or text blocks', () => {
        for (const result of [created, JSON.stringify(created), [{ type: 'text', text: JSON.stringify(created) }], { content: [{ type: 'text', text: JSON.stringify(created) }] }]) {
            const parsed = parseScheduleCreation(result);
            expect(parsed?.status).toBe('created');
            if (parsed?.status !== 'created') continue;
            expect(parsed.schedule).toMatchObject({ id: 'sch_1', name: 'Morning digest', target: 'machine:m1', weekday: 1, at_minute: 540 });
        }
    });

    it('fills what a created task left out instead of failing', () => {
        const parsed = parseScheduleCreation({ status: 'created', schedule: { id: 'x', instruction: 'Check mail', recurrence: 'daily' } });
        expect(parsed).toEqual({
            status: 'created',
            schedule: {
                id: 'x', name: 'Check mail', instruction: 'Check mail', target: 'cloud', recurrence: 'daily',
                weekday: 0, at_minute: 0, once_at: 0, timezone: '', next_run_at: 0, project_name: '',
            },
        });
    });

    it('reads a timing question and a failure', () => {
        expect(parseScheduleCreation({ status: 'needs', question: 'When?', choices: ['9:00', '', 3] }))
            .toEqual({ status: 'needs', question: 'When?', choices: ['9:00'] });
        expect(parseScheduleCreation('{"status":"failed","error":"no machine"}'))
            .toEqual({ status: 'failed', error: 'no machine' });
    });

    it('reads the outcome the agent stored as its reply to the model', () => {
        const stored = { output: JSON.stringify({ ...created, note: 'Tell the person briefly.' }) };
        expect(parseScheduleCreation(stored)?.status).toBe('created');
        expect(isCreatedSchedule({ name: 'create_scheduled_task', result: stored })).toBe(true);
    });

    it('answers nothing for no result or something else', () => {
        expect(parseScheduleCreation(undefined)).toBeUndefined();
        expect(parseScheduleCreation('Task created')).toBeUndefined();
        expect(parseScheduleCreation({ status: 'other' })).toBeUndefined();
        expect(parseScheduleCreation({ status: 'created' })).toBeUndefined();
    });

    it('keeps only a created task in view', () => {
        expect(isCreatedSchedule({ name: 'create_scheduled_task', result: created })).toBe(true);
        expect(isCreatedSchedule({ name: 'create_scheduled_task', result: { status: 'failed', error: 'x' } })).toBe(false);
        expect(isCreatedSchedule({ name: 'propose_scheduled_task', result: created })).toBe(false);
    });
});
