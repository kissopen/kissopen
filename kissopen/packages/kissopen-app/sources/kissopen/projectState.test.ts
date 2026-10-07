import { describe, expect, it, vi } from 'vitest';
import { projectStateParse } from './projectState';

vi.mock('@/text', () => ({ t: (key: string) => key }));

describe('projectStateParse', () => {
    it('refuses what is not a JSON object', () => {
        expect(projectStateParse('not json')).toBeUndefined();
        expect(projectStateParse('[]')).toBeUndefined();
        expect(projectStateParse('null')).toBeUndefined();
    });

    it('reads goal, direction, decisions and cards', () => {
        const project = projectStateParse(JSON.stringify({
            version: 1,
            goal: ' Ship in October ',
            direction: 'Small steps',
            decisions: [{ at: '2026-09-01T00:00:00Z', card: 'weekly-report', question: 'Which day?', choice: 'Friday' }],
            cards: {
                'weekly-report': {
                    title: 'Weekly report', agent: 'kabc123', state: 'needs_decision', note: 'Needs a day',
                    question: { text: 'Which day?', options: ['Mon', 'Fri', '', 'Sat', 'Sun', 'Extra'] },
                    files: ['outputs/report.md'], verified: true, updated: '2026-09-01T00:00:00Z',
                },
            },
        }));
        expect(project?.goal).toBe('Ship in October');
        expect(project?.direction).toBe('Small steps');
        expect(project?.decisions).toEqual([{ at: '2026-09-01T00:00:00Z', card: 'weekly-report', question: 'Which day?', choice: 'Friday' }]);
        const card = project?.cards['weekly-report'];
        expect(card?.agent).toBe('kabc123');
        expect(card?.state).toBe('needs_decision');
        expect(card?.question).toEqual({ text: 'Which day?', options: ['Mon', 'Fri', 'Sat', 'Sun'] });
        expect(card?.files).toEqual(['outputs/report.md']);
        expect(card?.verified).toBe(true);
    });

    it('keeps the last 50 decisions and drops empty ones', () => {
        const decisions = Array.from({ length: 60 }, (_, index) => ({ at: '', card: 'a1', question: `q${index}`, choice: 'c' }));
        const project = projectStateParse(JSON.stringify({ decisions: [...decisions, { at: 'x' }, 'junk'] }));
        expect(project?.decisions).toHaveLength(50);
        expect(project?.decisions[0]?.question).toBe('q10');
        expect(project?.decisions.at(-1)?.question).toBe('q59');
    });

    it('keeps at most six relative files and refuses absolute paths and ..', () => {
        const project = projectStateParse(JSON.stringify({
            cards: { c1: { files: ['/etc/passwd', '../up.txt', 'a/../b', 'C:\\\\win.txt', 'one.md', 'two.md', 'three.md', 'four.md', 'five.md', 'six.md', 'seven.md', 42] } },
        }));
        expect(project?.cards.c1?.files).toEqual(['one.md', 'two.md', 'three.md', 'four.md', 'five.md', 'six.md']);
    });

    it('refuses badly formed card ids, agents and states', () => {
        const project = projectStateParse(JSON.stringify({
            cards: {
                'Bad Id': { state: 'done' },
                x: { state: 'done' },
                ok1: { agent: 'Not An Agent!', state: 'finished' },
                'not-an-object': 'string',
            },
        }));
        expect(Object.keys(project?.cards ?? {})).toEqual(['ok1']);
        expect(project?.cards.ok1?.agent).toBeUndefined();
        expect(project?.cards.ok1?.state).toBeUndefined();
        expect(project?.cards.ok1?.verified).toBe(false);
    });
});
