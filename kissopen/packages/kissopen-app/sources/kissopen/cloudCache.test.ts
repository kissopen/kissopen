import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationDetail, User } from './api/types';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('react-native-mmkv', () => ({
    MMKV: class {
        getString(key: string) { return store.get(key); }
        set(key: string, value: string) { store.set(key, value); }
        delete(key: string) { store.delete(key); }
        clearAll() { store.clear(); }
    },
}));

const { cloudCache, cloudCacheClear } = await import('./cloudCache');

const SERVER = 'https://api.example.test';
function user(id: string): User {
    return { id, phone: '+86138****0000', phone_number: '+8613800000000', display_name: id, avatar_url: '', persona: null, theme: null };
}
function detail(id: string, extra: Partial<ConversationDetail> = {}): ConversationDetail {
    return { id, user_id: 'u1', title: id, created: 1, updated: 1, pinned: 0, archived: 0, messages: [], job: null, ...extra };
}

beforeEach(() => store.clear());

describe('cloudCache', () => {
    it('keeps nothing until an account is confirmed', () => {
        cloudCache.conversationsWrite([detail('c1')]);
        expect(cloudCache.conversations()).toBeUndefined();
        expect(cloudCache.hasAccount()).toBe(false);
    });

    it('keeps the account without its whole phone number', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        expect(cloudCache.hasAccount()).toBe(true);
        expect(cloudCache.user()?.phone_number).toBe('+86138****0000');
        expect([...store.values()].join()).not.toContain('+8613800000000');
    });

    it('clears one account\'s answers when another is confirmed', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        cloudCache.conversationsWrite([detail('c1')]);
        cloudCache.accountConfirmed(SERVER, user('u1'));
        expect(cloudCache.conversations()).toHaveLength(1);
        cloudCache.accountConfirmed(SERVER, user('u2'));
        expect(cloudCache.conversations()).toBeUndefined();
        expect(cloudCache.user()?.id).toBe('u2');
    });

    it('keeps opened conversations without a running job, and never a temporary one', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        cloudCache.conversationWrite(detail('c1', { job: { id: 'j', status: 'running' } as ConversationDetail['job'] }));
        expect(cloudCache.conversation('c1')?.job).toBeNull();
        cloudCache.conversationWrite(detail('t1', { temporary: true }));
        expect(cloudCache.conversation('t1')).toBeUndefined();
    });

    it('keeps only the most recently opened conversations', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        for (let index = 0; index < 35; index++) cloudCache.conversationWrite(detail(`c${index}`));
        cloudCache.conversationWrite(detail('c0'));
        expect(cloudCache.conversation('c0')).toBeDefined();
        expect(cloudCache.conversation('c1')).toBeUndefined();
        expect(cloudCache.conversation('c34')).toBeDefined();
    });

    it('forgets a deleted conversation from the list too', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        cloudCache.conversationsWrite([detail('c1'), detail('c2')]);
        cloudCache.conversationWrite(detail('c1'));
        cloudCache.conversationForget('c1');
        expect(cloudCache.conversation('c1')).toBeUndefined();
        expect(cloudCache.conversations()?.map((one) => one.id)).toEqual(['c2']);
    });

    it('forgets everything on sign-out', () => {
        cloudCache.accountConfirmed(SERVER, user('u1'));
        cloudCache.schedulesWrite({ schedules: [] });
        cloudCacheClear();
        expect(store.size).toBe(0);
        expect(cloudCache.schedules()).toBeUndefined();
    });
});
