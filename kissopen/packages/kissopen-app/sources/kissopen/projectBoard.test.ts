import { describe, expect, it, vi } from 'vitest';
import { boardCardId, boardCards, boardOverlay, boardParse, boardStateOf, fnv1a32hex, type BoardDocument } from './projectBoard';
import { projectStateParse } from './projectState';

// The board's messages go through t(), whose real module pulls in react-native.
vi.mock('@/text', () => ({ t: (key: string) => key }));

const board = (blocks: unknown[]) => JSON.stringify({ version: 1, title: 'Board', blocks });
const documentOf = (blocks: unknown[]): BoardDocument => {
    const parsed = boardParse(board(blocks));
    if (!('document' in parsed)) throw new Error(parsed.reason);
    return parsed.document;
};

describe('card ids', () => {
    it('keeps a well-formed id', () => {
        expect(boardCardId('weekly-report', 'Anything')).toBe('weekly-report');
        expect(boardCardId('a1', 'Anything')).toBe('a1');
    });

    it('refuses a badly formed id and derives one from the title', () => {
        for (const bad of ['A1', '-a1', 'a', 'a_b', 'x'.repeat(33), 42, undefined]) {
            expect(boardCardId(bad, 'Weekly report')).toBe(`t${fnv1a32hex('Weekly report')}`);
        }
    });

    it('derives the same id every time, from the trimmed title', () => {
        expect(fnv1a32hex('')).toBe('811c9dc5');
        expect(fnv1a32hex('a')).toBe('e40c292c');
        expect(boardCardId(undefined, '生成周报')).toBe(`t${fnv1a32hex('生成周报')}`);
        expect(boardCardId(undefined, '  生成周报 ')).toBe(boardCardId(undefined, '生成周报'));
        expect(boardCardId(undefined, '生成周报')).toMatch(/^t[0-9a-f]{8}$/);
        // Golden, shared with the desktop's kissopenAgentBoardCardId.
        expect(fnv1a32hex('生成周报')).toBe('d5ed981a');
        expect(boardCardId('', '生成周报')).toBe('td5ed981a');
    });
});

describe('card states on the board', () => {
    it('reads id and state on focus and list items, todo by default', () => {
        const document = documentOf([
            { type: 'focus', id: 'ship-plan', state: 'in_progress', title: 'Ship the plan' },
            { type: 'list', title: 'Next', items: [
                { title: 'Write report', state: 'bogus' },
                { id: 'call-client', title: 'Call client', state: 'done', action: { label: 'Call', prompt: 'Call the client' } },
            ] },
        ]);
        expect(boardCards(document)).toEqual([
            { id: 'ship-plan', title: 'Ship the plan', detail: '', state: 'in_progress' },
            { id: boardCardId(undefined, 'Write report'), title: 'Write report', detail: '', state: 'todo' },
            { id: 'call-client', title: 'Call client', detail: '', state: 'done', action: { label: 'Call', prompt: 'Call the client' } },
        ]);
    });
});

describe('boardOverlay', () => {
    const blocks = [
        { type: 'focus', id: 'ship-plan', state: 'in_progress', title: 'Ship the plan' },
        { type: 'list', title: 'Next', items: [{ id: 'write-report', title: 'Write report' }] },
        { type: 'note', body: 'A note' },
    ];

    it('lets project.json have the last word on a card state', () => {
        const project = projectStateParse(JSON.stringify({ cards: {
            'ship-plan': { state: 'done' },
            'write-report': { title: 'x' },
        } }));
        const cards = boardCards(boardOverlay(documentOf(blocks), project));
        expect(cards.find(card => card.id === 'ship-plan')?.state).toBe('done');
        // A card project.json names without a state keeps the board's.
        expect(cards.find(card => card.id === 'write-report')?.state).toBe('todo');
    });

    it('is the board itself without project.json', () => {
        const document = documentOf(blocks);
        expect(boardOverlay(document, undefined)).toBe(document);
    });

    it('shows project.json-only cards that wait on the person, decisions first, after the focus', () => {
        const project = projectStateParse(JSON.stringify({ cards: {
            'w-material': { title: 'Send the logo', state: 'waiting_material', note: 'Need the SVG' },
            'w-decide': { title: 'Pick a date', state: 'needs_decision', note: 'n', question: { text: 'Which date?', options: ['1', '2'] } },
            'w-busy': { title: 'Busy', state: 'in_progress' },
            'w-untitled': { state: 'needs_decision' },
        } }));
        const overlaid = boardOverlay(documentOf(blocks), project);
        expect(overlaid.blocks.map(block => block.type)).toEqual(['focus', 'list', 'list', 'note']);
        const waiting = overlaid.blocks[1];
        if (waiting?.type !== 'list') throw new Error('no waiting list');
        expect(waiting.title).toBe('kissopen.homePage.decideTitle');
        expect(waiting.badge).toBe('3');
        expect(waiting.items.map(item => [item.id, item.state, item.title, item.detail, item.tone])).toEqual([
            ['w-decide', 'needs_decision', 'Pick a date', 'Which date?', 'warn'],
            ['w-untitled', 'needs_decision', 'w-untitled', '', 'warn'],
            ['w-material', 'waiting_material', 'Send the logo', 'Need the SVG', 'accent'],
        ]);
    });

    it('does not repeat a card the board already shows', () => {
        const project = projectStateParse(JSON.stringify({ cards: { 'write-report': { state: 'needs_decision' } } }));
        const overlaid = boardOverlay(documentOf(blocks), project);
        expect(overlaid.blocks).toHaveLength(3);
        expect(boardCards(overlaid).find(card => card.id === 'write-report')?.state).toBe('needs_decision');
    });
});

describe('boardStateOf', () => {
    it('is missing without a board, keeping project.json', () => {
        const project = projectStateParse('{"cards":{}}');
        expect(boardStateOf(undefined, project)).toEqual({ status: 'missing', project });
        expect(boardStateOf(undefined, undefined)).toEqual({ status: 'missing' });
    });

    it('is invalid for a board that cannot be drawn', () => {
        expect(boardStateOf('{', undefined)).toEqual({ status: 'invalid', reason: 'kissopen.board.invalidJson' });
    });

    it('is the overlaid board when both are there', () => {
        const project = projectStateParse(JSON.stringify({ cards: { 'ship-plan': { state: 'needs_decision' } } }));
        const state = boardStateOf(board([{ type: 'focus', id: 'ship-plan', title: 'Ship' }]), project);
        if (state.status !== 'ready') throw new Error(state.status);
        expect(state.project).toBe(project);
        expect(boardCards(state.document)[0]?.state).toBe('needs_decision');
    });
});
