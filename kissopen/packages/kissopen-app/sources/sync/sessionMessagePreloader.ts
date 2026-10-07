/**
 * One speculative request, matching the native stack's one pending chat.
 * A real message sync can take ownership of the request, so another touch
 * cannot cancel work the now-visible chat is waiting for. Failed/cancelled
 * preparation falls back to normal sync, with no speculative retry loop.
 */
export class SessionMessagePreloader {
    private pending: {
        sessionId: string;
        controller: AbortController;
        promise: Promise<boolean>;
    } | null = null;

    constructor(private readonly load: (sessionId: string, signal: AbortSignal) => Promise<boolean>) {}

    preload(sessionId: string): void {
        if (this.pending?.sessionId === sessionId) return;
        this.pending?.controller.abort();

        const controller = new AbortController();
        const promise = this.load(sessionId, controller.signal).catch(() => false);
        const pending = { sessionId, controller, promise };
        this.pending = pending;
        void promise.finally(() => {
            if (this.pending === pending) this.pending = null;
        });
    }

    take(sessionId: string): Promise<boolean> | undefined {
        if (this.pending?.sessionId !== sessionId) return undefined;
        const { promise } = this.pending;
        this.pending = null;
        return promise;
    }

    cancel(sessionId: string): void {
        if (this.pending?.sessionId !== sessionId) return;
        this.pending.controller.abort();
        this.pending = null;
    }
}