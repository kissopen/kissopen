import type { ComposerAttachment } from "../modules/composer/composerState.js";

/** A new conversation stays on the same surface while its remote identity is prepared. */
export interface ConversationStartSnapshot {
    readonly phase: "idle" | "preparing" | "connecting" | "sending" | "sent" | "failed";
    readonly draft: string;
    readonly attachments: readonly ComposerAttachment[];
    readonly sessionId?: string;
    readonly submitted?: {
        readonly text: string;
        readonly attachments: readonly ComposerAttachment[];
        readonly at: number;
    };
    readonly error: string;
    readonly revision: number;
}

export const CONVERSATION_START_IDLE: ConversationStartSnapshot = {
    phase: "idle",
    draft: "",
    attachments: [],
    error: "",
    revision: 0,
};

export interface ConversationStartTransport {
    /** Invalidates pending work when its owning account changes. */
    invalidationSubscribe?(listener: () => void): () => void;
    prepare(
        name: string,
        startId: string,
        text: string,
        attachments: readonly ComposerAttachment[],
    ): Promise<{ readonly agentId: string; readonly messageSent: boolean }>;
    sessionWait(agentId: string, signal: AbortSignal): Promise<string>;
    messageSend(
        sessionId: string,
        text: string,
        attachments: readonly ComposerAttachment[],
    ): Promise<void>;
}

export interface ConversationStartStore {
    get(): ConversationStartSnapshot;
    subscribe(listener: () => void): () => void;
    textUpdate(text: string): void;
    attachmentAdd(attachment: ComposerAttachment): void;
    attachmentRemove(id: string): void;
    textSubmit(): void;
    conversationReset(): void;
}

export function conversationStartStoreCreate(
    transport: ConversationStartTransport,
): ConversationStartStore {
    let snapshot = CONVERSATION_START_IDLE;
    let controller: AbortController | undefined;
    let startId: string | undefined;
    let stopInvalidation: (() => void) | undefined;
    const listeners = new Set<() => void>();
    const set = (next: ConversationStartSnapshot): void => {
        snapshot = next;
        for (const listener of listeners) listener();
    };
    const busy = (): boolean => ["preparing", "connecting", "sending"].includes(snapshot.phase);
    const reset = (): void => {
        controller?.abort();
        controller = undefined;
        startId = undefined;
        set({ ...CONVERSATION_START_IDLE, revision: snapshot.revision + 1 });
    };
    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) stopInvalidation = transport.invalidationSubscribe?.(reset);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    stopInvalidation?.();
                    stopInvalidation = undefined;
                    reset();
                }
            };
        },
        textUpdate(draft) {
            if (!busy()) set({ ...snapshot, draft });
        },
        attachmentAdd(attachment) {
            if (!busy()) set({ ...snapshot, attachments: [...snapshot.attachments, attachment] });
        },
        attachmentRemove(id) {
            if (!busy())
                set({
                    ...snapshot,
                    attachments: snapshot.attachments.filter((item) => item.id !== id),
                });
        },
        conversationReset: reset,
        textSubmit() {
            if (busy() || snapshot.phase === "sent") return;
            const text = snapshot.draft.trim();
            const attachments = snapshot.attachments;
            if (!text && attachments.length === 0) return;
            const attempt = new AbortController();
            controller = attempt;
            startId ??= globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 24);
            const identity = startId;
            const submitted = { text, attachments, at: Date.now() };
            set({
                ...snapshot,
                phase: "preparing",
                draft: "",
                attachments: [],
                submitted,
                error: "",
            });
            void (async () => {
                try {
                    const prepared = await transport.prepare(
                        text || attachments[0]!.name,
                        identity,
                        text,
                        attachments,
                    );
                    if (attempt.signal.aborted) return;
                    set({ ...snapshot, phase: "connecting" });
                    const sessionId =
                        snapshot.sessionId ??
                        (await transport.sessionWait(prepared.agentId, attempt.signal));
                    if (attempt.signal.aborted) return;
                    if (!prepared.messageSent || attachments.length > 0) {
                        set({ ...snapshot, phase: "sending", sessionId });
                        await transport.messageSend(
                            sessionId,
                            prepared.messageSent ? "" : text,
                            attachments,
                        );
                    }
                    if (!attempt.signal.aborted) set({ ...snapshot, phase: "sent" });
                } catch (error) {
                    if (!attempt.signal.aborted)
                        set({
                            ...snapshot,
                            phase: "failed",
                            draft: text,
                            attachments,
                            submitted: undefined,
                            error: error instanceof Error ? error.message : String(error),
                        });
                }
            })();
        },
    };
}
