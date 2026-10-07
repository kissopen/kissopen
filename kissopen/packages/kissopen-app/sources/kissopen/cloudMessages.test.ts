import { describe, expect, it, vi } from 'vitest';
import { cloudMessages } from './cloudMessages';
import type { ConversationDetail, Message } from './api/types';

// cloudMessages resolves its fallback copy through t(), and the real module
// pulls in expo-localization -> react-native, whose Flow syntax Vitest cannot
// parse. Echoing the key back keeps this a pure transform test.
vi.mock('@/text', () => ({ t: (key: string) => key }));

const message = (id: string, role: Message['role'], content: string, status: Message['status']): Message =>
    ({ id, conversation_id: 'cloud-1', role, content, status, created: 1, images: [] });
const snapshot: ConversationDetail = {
    id: 'cloud-1', user_id: 'u', title: 'Plan', created: 1, updated: 1, pinned: 0, archived: 0,
    job: { id: 'job-1', target: 'cloud-1', kind: 'chat', status: 'running', seq: 8 },
    messages: [
        message('u1', 'user', 'First question', 'completed'),
        message('a1', 'assistant', 'Earlier answer', 'completed'),
        message('u2', 'user', 'Follow-up', 'completed'),
        message('a2', 'assistant', 'Saved partial', 'running'),
    ],
};

describe('cloud transcript at the KISSOPEN rendering boundary', () => {
    it('resumes one assistant row from a snapshot and subsequent deltas without duplicating persisted text', () => {
        const rows = cloudMessages(snapshot, 'Saved partial plus new delta');
        expect(rows.map(row => [row.id, row.kind, 'text' in row ? row.text : ''])).toEqual([
            ['u1', 'user-text', 'First question'], ['a1', 'agent-text', 'Earlier answer'],
            ['u2', 'user-text', 'Follow-up'], ['a2', 'agent-text', 'Saved partial plus new delta'],
        ]);
        expect(snapshot.messages[3].content).toBe('Saved partial');
    });
    it('keeps the streamed row identity when the completed snapshot replaces it', () => {
        const final: ConversationDetail = { ...snapshot, job: null, messages: snapshot.messages.map(m => m.id === 'a2' ? { ...m, content: 'Final answer', status: 'completed' as const } : m) };
        expect(cloudMessages(final, '').map(m => m.id)).toEqual(cloudMessages(snapshot, 'Final answer').map(m => m.id));
        expect(cloudMessages(final, '').at(-1)).toMatchObject({ text: 'Final answer' });
    });
    it('does not project an old stream into a new conversation or overwrite a user message', () => {
        expect(cloudMessages(undefined, 'Old stream')).toEqual([]);
        expect(cloudMessages({ ...snapshot, messages: snapshot.messages.slice(0, 3) }, 'Old stream').at(-1)).toMatchObject({ text: 'Follow-up', kind: 'user-text' });
    });
    it('preserves partial answers after a failure and explains an empty failed reply', () => {
        const failed: ConversationDetail = { ...snapshot, messages: [{ ...snapshot.messages[3], status: 'failed' as const }] };
        expect(cloudMessages(failed, '')[0]).toMatchObject({ text: 'Saved partial' });
        expect(cloudMessages({ ...failed, messages: [{ ...failed.messages[0], content: '' }] }, '')[0]).toMatchObject({ text: 'kissopen.conversation.replyIncomplete' });
    });
});
