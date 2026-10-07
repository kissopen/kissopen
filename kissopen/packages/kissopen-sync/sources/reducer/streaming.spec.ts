import { describe, expect, it } from 'vitest';
import { normalizeRawMessage, RawRecordSchema } from '../typesRaw';
import { createReducer, reducer } from './reducer';

function message(id: string, ev: unknown, time = 1000, turn = 'turn-1') {
    const raw = RawRecordSchema.parse({ role: 'session', content: {
        id, role: 'agent', turn, time, ev,
    }});
    return normalizeRawMessage(id, null, time, raw)!;
}
const delta = (id: string, text: string, offset: number) => message(id, {
    t: 'text-delta', streamId: 'block-1', text, offset,
});
const final = () => message('final', { t: 'text', streamId: 'block-1', text: '你好世界🌍' });

describe('encrypted relay streaming', () => {
    it('preserves terminal usage-limit metadata through normalization, reduction and replay', () => {
        const usageLimit = { code: 'usage_limit', resetAt: 1791028800000 };
        const service = message('quota', { t: 'service', text: 'Open Usage', usageLimit });
        for (const state of [createReducer(), createReducer()]) {
            const rows = reducer(state, [service]).messages;
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ kind: 'agent-text', text: 'Open Usage', meta: { usageLimit } });
        }
        const oldService = message('old-service', { t: 'service', text: 'Old notice' });
        expect(reducer(createReducer(), [oldService]).messages[0].meta?.usageLimit).toBeUndefined();
    });
    it('shows partial text immediately, appends in place, and replaces with authoritative final text', () => {
        const state = createReducer();
        const first = reducer(state, [delta('a', '你好', 0)]).messages[0];
        expect(first).toMatchObject({ kind: 'agent-text', text: '你好', streaming: true });
        expect(reducer(state, [delta('b', '世界', 2)]).messages[0]).toMatchObject({ id: first.id, text: '你好世界' });
        expect(reducer(state, [final()]).messages[0]).toMatchObject({ id: first.id, text: '你好世界🌍', streaming: false });
        expect(state.messages.size).toBe(1);
    });
    it('reconciles duplicates, reordered chunks, missing chunks and late chunks after completion', () => {
        const state = createReducer();
        reducer(state, [delta('b', '世界', 2)]);
        expect(reducer(state, [delta('a', '你好', 0)]).messages[0]).toMatchObject({ text: '你好世界' });
        expect(reducer(state, [delta('a', '你好', 0)]).messages).toEqual([]);
        reducer(state, [final()]);
        expect(reducer(state, [delta('late', '错误', 0)]).messages).toEqual([]);
        const replay = reducer(createReducer(), [final(), delta('late', '错误', 0)]).messages;
        expect(replay).toHaveLength(1);
        expect(replay[0]).toMatchObject({ text: '你好世界🌍', streaming: false });
    });
    it('uses the same row identity on reconnect and stops streaming on cancellation', () => {
        const state = createReducer();
        const first = reducer(state, [delta('a', '你好', 0)]).messages[0];
        expect(reducer(createReducer(), [delta('a', '你好', 0)]).messages[0].id).toBe(first.id);
        const end = message('end', { t: 'turn-end', status: 'cancelled' });
        expect(reducer(state, [end]).messages[0]).toMatchObject({ id: first.id, text: '你好', streaming: false });
        const recovered = message('recovered-final', { t: 'text', streamId: 'block-1', text: '你好世界🌍' }, 2000, 'new-relay-turn');
        expect(reducer(state, [recovered]).messages[0]).toMatchObject({ id: first.id, text: '你好世界🌍', streaming: false });
        expect(state.messages.size).toBe(1);
    });
    it('keeps thinking and multiple response blocks separate and still reads old final-only messages', () => {
        const rows = reducer(createReducer(), [
            message('think', { t: 'text-delta', streamId: 'thinking', text: '思考', offset: 0, thinking: true }),
            delta('a', '你好', 0),
            message('old', { t: 'text', text: '旧回复' }),
        ]).messages;
        expect(rows).toHaveLength(3);
        expect(rows[0]).toMatchObject({ text: '*思考*', isThinking: true });
        expect(rows[1]).toMatchObject({ text: '你好' });
        expect(rows[2]).toMatchObject({ text: '旧回复' });
    });
});
