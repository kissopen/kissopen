import { describe, expect, it } from 'vitest';
import { messagePlanMode } from './messagePlanMode';
import type { NormalizedMessage } from './typesRaw';

function tools(...names: string[]): NormalizedMessage[] {
    return [{
        role: 'agent',
        content: names.map((name) => ({ type: 'tool-call', name })),
    } as NormalizedMessage];
}

describe('messagePlanMode', () => {
    it('distinguishes an unrelated batch from an explicit exit', () => {
        expect(messagePlanMode([])).toBeNull();
        expect(messagePlanMode(tools('Read'))).toBeNull();
        expect(messagePlanMode(tools('ExitPlanMode'))).toBe(false);
    });

    it.each(['EnterPlanMode', 'enter_plan_mode'])('recognizes %s', (name) => {
        expect(messagePlanMode(tools(name))).toBe(true);
    });

    it('uses the final transition across the whole ordered batch', () => {
        expect(messagePlanMode(tools('EnterPlanMode', 'Read', 'ExitPlanMode'))).toBe(false);
        expect(messagePlanMode([...tools('exit_plan_mode'), ...tools('enter_plan_mode')])).toBe(true);
    });
});