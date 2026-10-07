import { MMKV } from 'react-native-mmkv';
import { cacheAccountKey } from '@/sync/offlineCache/cacheKeys';
import type { Conversation, ConversationDetail, Model, User } from './api/types';

/*
 * The consumer account's on-device cache: what the Kissopen server last said
 * about the account, its conversations and its schedules, so the home can
 * open on them at once and still show them without a connection. Every
 * answer is replaced by the next one that arrives.
 *
 * One account at a time. The account is the one `/me` last confirmed; a
 * different one clears everything before its own answers are kept, and
 * signing out (or the server refusing the session) clears it all. Keys are
 * `<account>:<name>`, where the account key is a digest of the server and
 * the user id — no token is ever stored here.
 */

const kv = new MMKV({ id: 'kissopen-oss-cloud-cache' });
const ACCOUNT = 'account';
/** Opened conversations kept, the most recently opened last. */
const DETAILS_KEPT = 30;

function account(): string | undefined {
    return kv.getString(ACCOUNT);
}

function read<T>(name: string): T | undefined {
    const key = account();
    if (!key) return undefined;
    try {
        const raw = kv.getString(`${key}:${name}`);
        return raw === undefined ? undefined : JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function write(name: string, value: unknown) {
    const key = account();
    if (!key) return;
    try {
        if (value === undefined) kv.delete(`${key}:${name}`);
        else kv.set(`${key}:${name}`, JSON.stringify(value));
    } catch (error) {
        // Web's storage can be full; the cache is only ever a head start.
        console.warn(`cloudCache: cannot store ${name}`, error);
    }
}

/**
 * The account as kept: the whole phone number stays on the server — the
 * masked one stands in for it until the next `/me` answers.
 */
function userKept(user: User): User {
    return { ...user, phone_number: user.phone };
}

/**
 * A conversation as kept. A job that was running is not: whether it still is
 * only the server can say, and a stale one would start polling for nothing.
 */
function detailKept(detail: ConversationDetail): ConversationDetail {
    return { ...detail, job: null };
}

export const cloudCache = {
    /**
     * The account `/me` just confirmed. A different account than the one
     * kept clears the cache first, so no answer of one account is ever shown
     * to another.
     */
    accountConfirmed(serverOrigin: string, user: User) {
        const key = cacheAccountKey(serverOrigin, user.id);
        if (account() !== key) {
            kv.clearAll();
            kv.set(ACCOUNT, key);
        }
        write('user', userKept(user));
    },

    /** Whether an account has been confirmed on this phone and not signed out. */
    hasAccount(): boolean {
        return account() !== undefined && read<User>('user') !== undefined;
    },

    user(): User | undefined {
        return read<User>('user');
    },

    models(): Model[] | undefined {
        return read<Model[]>('models');
    },

    modelsWrite(models: readonly Model[]) {
        write('models', models);
    },

    conversations(): Conversation[] | undefined {
        return read<Conversation[]>('conversations');
    },

    conversationsWrite(conversations: readonly Conversation[]) {
        write('conversations', conversations);
    },

    conversation(id: string): ConversationDetail | undefined {
        return read<ConversationDetail>(`conversation:${id}`);
    },

    /** Keeps an opened conversation, dropping the least recently opened past the limit. Temporary chats are never kept. */
    conversationWrite(detail: ConversationDetail) {
        if (detail.temporary) return;
        const kept = (read<string[]>('conversation-index') ?? []).filter((id) => id !== detail.id);
        kept.push(detail.id);
        for (const dropped of kept.splice(0, Math.max(0, kept.length - DETAILS_KEPT))) {
            write(`conversation:${dropped}`, undefined);
        }
        write(`conversation:${detail.id}`, detailKept(detail));
        write('conversation-index', kept);
    },

    conversationForget(id: string) {
        write(`conversation:${id}`, undefined);
        write('conversation-index', (read<string[]>('conversation-index') ?? []).filter((one) => one !== id));
        const list = read<Conversation[]>('conversations');
        if (list) write('conversations', list.filter((one) => one.id !== id));
    },

    /** GET /schedules as last answered; each reader types the part it reads. */
    schedules<T>(): T | undefined {
        return read<T>('schedules');
    },

    schedulesWrite(value: unknown) {
        write('schedules', value);
    },
};

/** Forgets the consumer account's cache: signing out, or a session the server refused. */
export function cloudCacheClear() {
    try {
        kv.clearAll();
    } catch (error) {
        console.warn('cloudCache: cannot clear', error);
    }
}
