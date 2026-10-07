import type { ReactNode } from "react";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import PierreHighlightWorker from "@pierre/diffs/worker/worker.js?worker";

/**
 * Syntax highlighting off the main thread.
 *
 * Pierre Diffs tokenizes with Shiki, and a TextMate grammar over a large file
 * is real work: run on the main thread it stalls typing and scrolling for as
 * long as the file is long. Mounting this provider once near the top of a
 * surface moves that work into a small pool of Web Workers; every `CodeBlock`
 * and `ChangedFileDiff` beneath it picks the pool up from context and tokenizes
 * there instead. Nothing else changes — without the provider the same
 * components highlight on the main thread, which is what a test or a Blueprint
 * page wants.
 *
 * The pool is a process-wide singleton, so mounting the provider twice shares
 * one pool rather than starting a second. Two workers is deliberate: one file
 * and one diff highlighting concurrently is the realistic ceiling, and eight
 * idle workers (the library default) is a cost with no question behind it.
 */
export function CodeHighlightWorkers(props: { children: ReactNode }) {
    // jsdom has no Worker, so a test render takes the main-thread fallback
    // described above instead of constructing a pool that cannot start.
    if (typeof Worker === "undefined") return props.children;
    return (
        <WorkerPoolContextProvider
            // The pool tokenizes for whatever renders under it, so it is
            // initialized with the one palette every code surface here asks for.
            highlighterOptions={{ theme: { dark: "pierre-dark", light: "pierre-light" } }}
            poolOptions={{
                poolSize: 2,
                // Pierre keeps separate file and diff AST LRUs at this size;
                // cap each one explicitly so the worker pool cannot retain
                // its library default of 100 entries per cache.
                totalASTLRUCacheSize: 24,
                workerFactory: () => new PierreHighlightWorker(),
            }}
        >
            {props.children}
        </WorkerPoolContextProvider>
    );
}
