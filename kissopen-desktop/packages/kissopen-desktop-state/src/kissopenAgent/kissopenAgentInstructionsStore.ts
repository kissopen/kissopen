import { createStore } from "zustand/vanilla";
import type { Loadable } from "../conversation/loadable.js";
import type { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import type { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";

/**
 * How much text one Kissopen Agent will keep as its global instructions. The daemon is the
 * authority and refuses anything larger in its own words; knowing the same
 * number here is only so an editor can say how much room is left before
 * someone runs out of it.
 */
export const KISSOPEN_AGENT_INSTRUCTIONS_MAX_BYTES = 256 * 1024;

export interface KissopenAgentGlobalDocumentSnapshot {
    /** The document as this Kissopen Agent last confirmed it. */
    readonly stored: Loadable<string>;
    /** What the editor holds. It follows `stored` until someone types. */
    readonly draft: string;
    /** The draft says something the Kissopen Agent has not been told yet. */
    readonly dirty: boolean;
    /** How many UTF-8 bytes the draft would occupy. */
    readonly bytes: number;
    /** A write is in flight. */
    readonly saving: boolean;
    /** Why the last write was refused. Cleared by the next edit or attempt. */
    readonly saveError?: UserError;
}

/**
 * One Kissopen Agent-wide Markdown configuration document, as an editor reads and writes it.
 *
 * Loading is a consequence of being watched rather than something a surface
 * asks for: the first subscriber starts the read, so a settings window that is
 * never opened never touches the daemon and one that is opened twice reads once.
 */
export interface KissopenAgentGlobalDocumentStore {
    get(): KissopenAgentGlobalDocumentSnapshot;
    subscribe(listener: () => void): () => void;
    /** Types into the draft without telling the Kissopen Agent anything yet. */
    draftUpdate(text: string): void;
    /** Sends the draft; the Kissopen Agent's own answer becomes what is stored. */
    save(): void;
    /** Throws the draft away and returns to what the Kissopen Agent holds. */
    revert(): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentInstructionsStoreDeps {
    readonly client: Pick<KissopenAgentClient, "getInstructions" | "putInstructions">;
}

export type KissopenAgentInstructionsSnapshot = KissopenAgentGlobalDocumentSnapshot;
export type KissopenAgentInstructionsStore = KissopenAgentGlobalDocumentStore;

interface KissopenAgentGlobalDocumentStoreDeps {
    readonly read: (signal?: AbortSignal) => Promise<string>;
    readonly write: (value: string) => Promise<string>;
}

const EMPTY: KissopenAgentGlobalDocumentSnapshot = {
    stored: { type: "unloaded" },
    draft: "",
    dirty: false,
    bytes: 0,
    saving: false,
};
const DOCUMENT_POLL_INTERVAL_MS = 4_000;

function byteLength(text: string): number {
    return new TextEncoder().encode(text).length;
}

export function kissopenAgentInstructionsStoreCreate(
    deps: KissopenAgentInstructionsStoreDeps,
): KissopenAgentInstructionsStore {
    return kissopenAgentGlobalDocumentStoreCreate({
        read: async (signal) => (await deps.client.getInstructions({ signal })).instructions,
        write: async (value) => (await deps.client.putInstructions(value)).instructions,
    });
}

export function kissopenAgentGlobalDocumentStoreCreate(
    deps: KissopenAgentGlobalDocumentStoreDeps,
): KissopenAgentGlobalDocumentStore {
    const store = createStore<KissopenAgentGlobalDocumentSnapshot>()(() => EMPTY);
    const listeners = new Set<() => void>();
    let disposed = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timerCancel = (): void => {
        if (timer === undefined) return;
        clearTimeout(timer);
        timer = undefined;
    };

    const schedule = (): void => {
        if (disposed || listeners.size === 0 || timer !== undefined) return;
        timer = setTimeout(() => {
            timer = undefined;
            load();
        }, DOCUMENT_POLL_INTERVAL_MS);
    };

    /**
     * Reconciles the draft against text the Kissopen Agent has just confirmed. Someone who
     * typed while the read or the write was in flight keeps what they typed —
     * losing it would be the one unrecoverable thing this surface could do — so
     * the confirmed text only takes the draft over when there is nothing to lose.
     */
    const settle = (confirmed: string): void => {
        const state = store.getState();
        const draft = state.dirty ? state.draft : confirmed;
        store.setState(
            {
                stored: { type: "ready", value: confirmed },
                draft,
                dirty: draft !== confirmed,
                bytes: byteLength(draft),
                saving: false,
            },
            true,
        );
    };

    const load = (): void => {
        if (disposed || listeners.size === 0 || controller !== undefined) return;
        timerCancel();
        const current = store.getState();
        if (current.saving) {
            schedule();
            return;
        }
        const before = current.stored;
        if (before.type === "unloaded") store.setState({ stored: { type: "loading" } }, false);
        const currentController = new AbortController();
        controller = currentController;
        void deps.read(currentController.signal).then(
            (confirmed) => {
                if (disposed || controller !== currentController) return;
                controller = undefined;
                settle(confirmed);
                schedule();
            },
            (error: unknown) => {
                if (
                    disposed ||
                    controller !== currentController ||
                    currentController.signal.aborted
                )
                    return;
                controller = undefined;
                // A refresh failure never erases the last confirmed document or
                // the draft being edited. Only an initial read has no retained
                // value to keep and therefore owns the load error surface.
                if (before.type !== "ready")
                    store.setState(
                        { stored: { type: "error", error: kissopenAgentUserError(error) } },
                        false,
                    );
                schedule();
            },
        );
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            if (listeners.size === 1) load();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size !== 0) return;
                timerCancel();
                controller?.abort();
                controller = undefined;
            };
        },
        draftUpdate(text) {
            const state = store.getState();
            if (state.draft === text) return;
            const stored = state.stored.type === "ready" ? state.stored.value : undefined;
            const { saveError: _cleared, ...rest } = state;
            store.setState(
                {
                    ...rest,
                    draft: text,
                    dirty: stored === undefined || text !== stored,
                    bytes: byteLength(text),
                },
                true,
            );
        },
        save() {
            const state = store.getState();
            // Text past the limit is still sent: the Kissopen Agent is the authority on
            // what it will keep, and its refusal says so in words the editor can
            // show. Refusing here instead would be a Save button that has
            // silently stopped working.
            if (disposed || state.saving || !state.dirty) return;
            timerCancel();
            controller?.abort();
            controller = undefined;
            const { saveError: _cleared, ...rest } = state;
            store.setState({ ...rest, saving: true }, true);
            const sent = state.draft;
            void deps.write(sent).then(
                (confirmed) => {
                    if (disposed) return;
                    // What comes back is what the Kissopen Agent kept, and the draft that
                    // produced it is no longer unsaved even if someone has typed
                    // past it since.
                    const current = store.getState();
                    const draft = current.draft === sent ? confirmed : current.draft;
                    store.setState(
                        {
                            stored: { type: "ready", value: confirmed },
                            draft,
                            dirty: draft !== confirmed,
                            bytes: byteLength(draft),
                            saving: false,
                        },
                        true,
                    );
                    schedule();
                },
                (error: unknown) => {
                    if (disposed) return;
                    store.setState(
                        { saving: false, saveError: kissopenAgentUserError(error) },
                        false,
                    );
                    schedule();
                },
            );
        },
        revert() {
            const state = store.getState();
            if (state.stored.type !== "ready") return;
            const { saveError: _cleared, ...rest } = state;
            store.setState(
                {
                    ...rest,
                    draft: state.stored.value,
                    dirty: false,
                    bytes: byteLength(state.stored.value),
                },
                true,
            );
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            timerCancel();
            controller?.abort();
            controller = undefined;
            listeners.clear();
        },
    };
}
