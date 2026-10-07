import { describe, expect, it, vi } from 'vitest';
import { SessionMessagePreloader } from './sessionMessagePreloader';

function deferred() {
    let resolve!: (value: boolean) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<boolean>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('SessionMessagePreloader', () => {
    it('coalesces repeated touches on the same chat', async () => {
        const page = deferred();
        const load = vi.fn(() => page.promise);
        const preloader = new SessionMessagePreloader(load);
        preloader.preload('a');
        preloader.preload('a');
        const owned = preloader.take('a');
        page.resolve(true);
        await expect(owned).resolves.toBe(true);
        expect(load).toHaveBeenCalledOnce();
        expect(preloader.take('a')).toBeUndefined();
    });

    it('replaces speculative work without an old completion clearing the new request', async () => {
        const first = deferred();
        const second = deferred();
        const load = vi.fn((id: string, _signal: AbortSignal) => id === 'a' ? first.promise : second.promise);
        const preloader = new SessionMessagePreloader(load);
        preloader.preload('a');
        preloader.preload('b');
        expect(load.mock.calls[0][1].aborted).toBe(true);
        expect(load.mock.calls[1][1].aborted).toBe(false);
        first.resolve(false);
        await first.promise;
        await Promise.resolve();
        const owned = preloader.take('b');
        second.resolve(true);
        await expect(owned).resolves.toBe(true);
    });

    it('does not cancel a request after real navigation takes ownership', async () => {
        const first = deferred();
        const second = deferred();
        const load = vi.fn((id: string, _signal: AbortSignal) => id === 'a' ? first.promise : second.promise);
        const preloader = new SessionMessagePreloader(load);
        preloader.preload('a');
        const owned = preloader.take('a');
        preloader.preload('b');
        preloader.cancel('a');
        expect(load.mock.calls[0][1].aborted).toBe(false);
        first.resolve(true);
        await expect(owned).resolves.toBe(true);
        preloader.cancel('b');
        expect(load.mock.calls[1][1].aborted).toBe(true);
        second.resolve(false);
    });

    it('falls back to normal sync after failure, without speculative retries', async () => {
        const page = deferred();
        const load = vi.fn(() => page.promise);
        const preloader = new SessionMessagePreloader(load);
        preloader.preload('a');
        const owned = preloader.take('a');
        page.reject(new Error('offline'));
        await expect(owned).resolves.toBe(false);
        expect(load).toHaveBeenCalledOnce();
        expect(preloader.take('a')).toBeUndefined();
    });

    it('does not treat an old completed preload as a fresh response', async () => {
        const page = deferred();
        const preloader = new SessionMessagePreloader(() => page.promise);
        preloader.preload('a');
        page.resolve(true);
        await page.promise;
        await Promise.resolve();
        expect(preloader.take('a')).toBeUndefined();
    });
});