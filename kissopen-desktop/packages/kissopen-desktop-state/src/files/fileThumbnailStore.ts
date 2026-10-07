/** Account-scoped, bounded cache for visible library thumbnails. The host owns image decoding. */
export function fileThumbnailStoreCreate() {
    const ready = new Map<string, string>();
    const pending = new Set<string>();
    const failed = new Map<string, number>();
    const queue: { key: string; load: () => Promise<string | undefined> }[] = [];
    const listeners = new Set<() => void>();
    let running = 0;
    let generation = 0;
    const pump = (): void => {
        while (running < 2 && queue.length) {
            const job = queue.shift()!;
            const turn = generation;
            running += 1;
            void Promise.resolve()
                .then(() => (turn === generation ? job.load() : undefined))
                .catch(() => undefined)
                .then((url) => {
                    if (turn !== generation) return;
                    if (url) {
                        ready.set(job.key, url);
                        while (ready.size > 128) ready.delete(ready.keys().next().value!);
                        for (const listener of listeners) listener();
                    } else {
                        failed.set(job.key, Date.now());
                        while (failed.size > 128) failed.delete(failed.keys().next().value!);
                    }
                })
                .finally(() => {
                    if (turn === generation) pending.delete(job.key);
                    running -= 1;
                    pump();
                });
        }
    };
    return {
        get(key: string): string | undefined {
            return ready.get(key);
        },
        request(key: string, load: () => Promise<string | undefined>): void {
            if (ready.has(key) || pending.has(key) || Date.now() - (failed.get(key) ?? 0) < 30_000)
                return;
            pending.add(key);
            queue.push({ key, load });
            pump();
        },
        cancelPending(): void {
            generation += 1;
            queue.length = 0;
            pending.clear();
        },
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
