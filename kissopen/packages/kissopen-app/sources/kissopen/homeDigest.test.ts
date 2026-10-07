import { describe, expect, it, vi } from 'vitest';
import { homeDigest } from './homeDigest';
import { boardStateOf } from './projectBoard';
import { projectStateParse } from './projectState';
import type { WorkProject } from './ProjectPage';
import type { ProjectBoardState } from './useProjectBoard';

vi.mock('@/text', () => ({ t: (key: string) => key }));

const project = (id: string, updatedAt: number): WorkProject =>
    ({ id, name: id, place: '', machineId: 'm1', path: `/p/${id}`, updatedAt, conversations: [], cloud: false });

describe('homeDigest', () => {
    it('lists what waits on the person, decisions first, and leaves it and finished cards out of the focus', () => {
        const boards = new Map<string, ProjectBoardState>([
            ['a', boardStateOf(JSON.stringify({ version: 1, blocks: [
                { type: 'focus', id: 'plan', title: 'Plan' },
                { type: 'list', title: 'Next', items: [
                    { id: 'report', title: 'Report', tone: 'warn' },
                    { id: 'finished', title: 'Finished', tone: 'warn', state: 'done' },
                ] },
            ] }), projectStateParse(JSON.stringify({ cards: {
                report: { state: 'waiting_material', note: 'Need the numbers' },
                'w-date': { title: 'Date', state: 'needs_decision', question: { text: 'Which date?', options: [] } },
            } })))],
            ['b', boardStateOf(JSON.stringify({ version: 1, blocks: [
                { type: 'focus', id: 'launch', title: 'Launch', state: 'done' },
                { type: 'list', title: 'Next', items: [{ id: 'price', title: 'Price', tone: 'accent', state: 'needs_decision' }] },
            ] }), undefined)],
        ]);
        const digest = homeDigest([project('a', 2), project('b', 1)], boards);
        expect(digest.decisions.map(item => [item.projectId, item.card.id, item.text])).toEqual([
            ['a', 'w-date', 'Which date?'],
            ['b', 'price', 'Price'],
            ['a', 'report', 'Need the numbers'],
        ]);
        expect(digest.focus.map(item => item.card.id)).toEqual(['plan']);
    });
});
