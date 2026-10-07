import { createStore } from "zustand/vanilla";
import type { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";
import type {
    KissopenAgentInboxItem,
    KissopenAgentInboxItemId,
    KissopenAgentSessionId,
    KissopenAgentSessionScope,
    KissopenAgentUserInputQuestion,
} from "./kissopenAgentTypes.js";

/**
 * One agent question as the Kissopen Agent reports it, before this store decides how the
 * queue reads. The source owns aggregation across every session on the machine;
 * this package only projects and orders what it is told.
 */
export interface KissopenAgentInboxSourceItem {
    readonly id: string;
    readonly sessionId: string;
    readonly requestId: string;
    readonly scope?: KissopenAgentSessionScope;
    readonly sessionTitle?: string;
    readonly questions: readonly KissopenAgentUserInputQuestion[];
    readonly status: "pending" | "answered";
    readonly answers?: Readonly<Record<string, readonly string[]>>;
    readonly createdAt: number;
    readonly resolvedAt?: number;
}

/**
 * The live question feed for one Kissopen Agent. It is a stream, not a reader: the daemon
 * pushes the complete set whenever it changes, so nothing here polls and no
 * surface needs a refresh control. Opening it is the subscriber's decision, not
 * the store constructor's.
 */
export interface KissopenAgentInboxSource {
    subscribe(
        listener: (items: readonly KissopenAgentInboxSourceItem[]) => void,
        onError: (error: unknown) => void,
    ): () => void;
}

/** How one question's answer submission is going, for the row that shows it. */
export type KissopenAgentInboxSubmission =
    | { readonly type: "pending" }
    | { readonly type: "failed"; readonly error: UserError };

export interface KissopenAgentInboxSnapshot {
    /** Questions still waiting on the person, oldest first — the queue to work through. */
    readonly pending: readonly KissopenAgentInboxItem[];
    /** Questions already answered, most recently resolved first. */
    readonly answered: readonly KissopenAgentInboxItem[];
    /** True until the first feed arrives, so an empty inbox is not claimed too early. */
    readonly loading: boolean;
    /** Set when the feed itself failed; the retained items stay visible beneath it. */
    readonly error?: UserError;
    /** In-flight and failed answer submissions, by item. */
    readonly submissions: ReadonlyMap<KissopenAgentInboxItemId, KissopenAgentInboxSubmission>;
    /** What is being written as a reply in a question's own words, by item. */
    readonly messages: ReadonlyMap<KissopenAgentInboxItemId, string>;
    /**
     * Options ticked into a question but not yet submitted, by item. They are
     * kept here because sending the written reply answers the question, and that
     * answer must carry a choice the reader has already made.
     */
    readonly selections: ReadonlyMap<
        KissopenAgentInboxItemId,
        Readonly<Record<string, readonly string[]>>
    >;
}

/** What the store asks its owner to do; answering is the owner's transport work. */
export type KissopenAgentInboxOutput = {
    readonly type: "itemAnswerSubmitted";
    readonly itemId: KissopenAgentInboxItemId;
    readonly sessionId: KissopenAgentSessionId;
    readonly requestId: string;
    readonly answers: Readonly<Record<string, readonly string[]>>;
};

/** Authoritative results of an answer the owner carried out. */
export type KissopenAgentInboxInput =
    | { readonly type: "itemAnswerSucceeded"; readonly itemId: KissopenAgentInboxItemId }
    | {
          readonly type: "itemAnswerFailed";
          readonly itemId: KissopenAgentInboxItemId;
          readonly error: unknown;
      };

export interface KissopenAgentInboxStore {
    get(): KissopenAgentInboxSnapshot;
    subscribe(listener: () => void): () => void;
    /**
     * Answers one question with the chosen option labels per question id. The row
     * shows the submission immediately, but the item stays pending until the KISSOPEN Agent
     * reports it resolved: an answer is the daemon's to confirm, not this store's
     * to assume.
     */
    itemAnswer(
        itemId: KissopenAgentInboxItemId,
        answers: Readonly<Record<string, readonly string[]>>,
    ): void;
    /** Records what is being written as this question's reply, keystroke by keystroke. */
    itemMessageUpdate(itemId: KissopenAgentInboxItemId, text: string): void;
    /** Records the options ticked into a question before it is submitted. */
    itemSelectionUpdate(
        itemId: KissopenAgentInboxItemId,
        answers: Readonly<Record<string, readonly string[]>>,
    ): void;
    /**
     * Answers the question with what was written rather than with one of its
     * options — the reply for when none of them is what should happen. The text
     * goes back as the answer to every question the item asked, which is what
     * both frees the waiting agent and takes the question out of the queue; a
     * message sent beside the question would do neither, since the agent is
     * inside the call that asked and reads nothing until it returns.
     *
     * Blank text sends nothing. As with a chosen option, the item leaves
     * `pending` only when the Kissopen Agent reports it resolved.
     */
    itemMessageSubmit(itemId: KissopenAgentInboxItemId): void;
    /** Private authoritative input: how the owner's answer attempt actually ended. */
    inboxInput(event: KissopenAgentInboxInput): void;
    [Symbol.dispose](): void;
}

export interface KissopenAgentInboxStoreDeps {
    readonly source: KissopenAgentInboxSource;
    readonly output?: (event: KissopenAgentInboxOutput) => void;
}

const EMPTY_SUBMISSIONS: ReadonlyMap<KissopenAgentInboxItemId, KissopenAgentInboxSubmission> =
    new Map();
const EMPTY_MESSAGES: ReadonlyMap<KissopenAgentInboxItemId, string> = new Map();
const EMPTY_SELECTIONS: ReadonlyMap<
    KissopenAgentInboxItemId,
    Readonly<Record<string, readonly string[]>>
> = new Map();

/**
 * The KISSOPEN Agent's question queue as one surface: everything its agents asked, across
 * every session, in the order a person would work through it. The constructor
 * opens nothing; the first subscriber starts the feed and the last unsubscribe
 * stops it, so a closed inbox costs a disconnected app nothing.
 *
 * Feed items are authoritative and replace the list wholesale. An answer is
 * local intent only — it records a submission and asks the owner to send it,
 * and the item leaves `pending` when the daemon says it resolved.
 */
export function kissopenAgentInboxStoreCreate(
    deps: KissopenAgentInboxStoreDeps,
): KissopenAgentInboxStore {
    const output = deps.output ?? (() => undefined);
    const store = createStore<KissopenAgentInboxSnapshot>()(() => ({
        pending: [],
        answered: [],
        loading: true,
        submissions: EMPTY_SUBMISSIONS,
        messages: EMPTY_MESSAGES,
        selections: EMPTY_SELECTIONS,
    }));

    const listeners = new Set<() => void>();
    let unsubscribeSource: (() => void) | undefined;
    let items: readonly KissopenAgentInboxItem[] = [];
    let disposed = false;

    const commit = (): void => {
        const current = store.getState();
        store.setState(
            {
                pending: items.filter((item) => item.status === "pending"),
                answered: items.filter((item) => item.status === "answered"),
                loading: false,
                submissions: current.submissions,
                messages: current.messages,
                selections: current.selections,
            },
            true,
        );
    };

    /**
     * Shows one answer going out and asks the owner to send it. Choosing an
     * option and replying in one's own words are the same act to the Kissopen Agent — a
     * question with an answer — so they leave through the same door.
     */
    const answerSubmit = (
        item: KissopenAgentInboxItem,
        answers: Readonly<Record<string, readonly string[]>>,
    ): void => {
        const submissions = new Map(store.getState().submissions);
        submissions.set(item.id, { type: "pending" });
        store.setState({ submissions }, false);
        output({
            type: "itemAnswerSubmitted",
            itemId: item.id,
            sessionId: item.sessionId,
            requestId: item.requestId,
            answers,
        });
    };

    const start = (): void => {
        if (disposed || unsubscribeSource) return;
        unsubscribeSource = deps.source.subscribe(
            (next) => {
                if (disposed) return;
                items = inboxItemsProject(next);
                // A resolved question carries its own outcome now, so the
                // submission we were showing for it — and any reply still being
                // written into it — have served their purpose.
                const submissions = new Map(store.getState().submissions);
                const messages = new Map(store.getState().messages);
                const selections = new Map(store.getState().selections);
                for (const item of items) {
                    if (item.status !== "answered") continue;
                    submissions.delete(item.id);
                    messages.delete(item.id);
                    selections.delete(item.id);
                }
                store.setState({ submissions, messages, selections }, false);
                commit();
            },
            (error) => {
                if (disposed) return;
                store.setState({ error: kissopenAgentUserError(error), loading: false }, false);
            },
        );
    };

    const stop = (): void => {
        unsubscribeSource?.();
        unsubscribeSource = undefined;
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            listeners.add(listener);
            const unsubscribe = store.subscribe(listener);
            start();
            let released = false;
            return () => {
                if (released) return;
                released = true;
                unsubscribe();
                listeners.delete(listener);
                if (listeners.size === 0) stop();
            };
        },
        itemAnswer(itemId, answers) {
            const item = items.find((candidate) => candidate.id === itemId);
            if (!item || item.status !== "pending") return;
            answerSubmit(item, answers);
        },
        itemMessageUpdate(itemId, text) {
            const current = store.getState();
            if (current.messages.get(itemId) === text) return;
            const messages = new Map(current.messages);
            messages.set(itemId, text);
            store.setState({ messages }, false);
        },
        itemSelectionUpdate(itemId, answers) {
            const current = store.getState();
            if (current.selections.get(itemId) === answers) return;
            const selections = new Map(current.selections);
            selections.set(itemId, answers);
            store.setState({ selections }, false);
        },
        itemMessageSubmit(itemId) {
            const item = items.find((candidate) => candidate.id === itemId);
            if (!item || item.status !== "pending") return;
            const text = (store.getState().messages.get(itemId) ?? "").trim();
            if (text.length === 0) return;
            // A ticked question is answered by its ticks: they are a deliberate
            // choice, and a single-select question could not carry the words
            // beside one anyway. The words answer whatever was left blank, so
            // no required question is left unanswered and neither the choice
            // nor the reply is dropped.
            const ticked = store.getState().selections.get(itemId) ?? {};
            const answers: Record<string, readonly string[]> = {};
            for (const question of item.questions) {
                const chosen = ticked[question.id] ?? [];
                answers[question.id] = chosen.length > 0 ? [...chosen] : [text];
            }
            answerSubmit(item, answers);
        },
        inboxInput(event) {
            const submissions = new Map(store.getState().submissions);
            if (event.type === "itemAnswerSucceeded") {
                // The daemon still owes us the resolution that moves the item
                // into history; until then the row simply stops showing a
                // submission of its own.
                submissions.delete(event.itemId);
            } else {
                submissions.set(event.itemId, {
                    type: "failed",
                    error: kissopenAgentUserError(event.error),
                });
            }
            store.setState({ submissions }, false);
        },
        [Symbol.dispose]() {
            if (disposed) return;
            disposed = true;
            stop();
            listeners.clear();
        },
    };
}

const INERT_SNAPSHOT: KissopenAgentInboxSnapshot = {
    pending: [],
    answered: [],
    loading: false,
    submissions: EMPTY_SUBMISSIONS,
    messages: EMPTY_MESSAGES,
    selections: EMPTY_SELECTIONS,
};

/**
 * An inbox for a Kissopen Agent that has none. It is permanently empty and settled rather
 * than loading, so a surface that must subscribe unconditionally — a sidebar
 * count beside a machine that offers no question feed — reads "nothing waiting"
 * instead of "still loading" forever.
 */
export const kissopenAgentInboxStoreNoop: KissopenAgentInboxStore = {
    get: () => INERT_SNAPSHOT,
    subscribe: () => () => undefined,
    itemAnswer: () => undefined,
    itemMessageUpdate: () => undefined,
    itemSelectionUpdate: () => undefined,
    itemMessageSubmit: () => undefined,
    inboxInput: () => undefined,
    [Symbol.dispose]: () => undefined,
};

/**
 * Orders the queue the way it is worked through: unanswered questions oldest
 * first, because the one that has waited longest is the one holding an agent up,
 * and answered questions newest first, because history is read backwards.
 */
function inboxItemsProject(
    source: readonly KissopenAgentInboxSourceItem[],
): readonly KissopenAgentInboxItem[] {
    const items = source.map(
        (item): KissopenAgentInboxItem => ({
            id: item.id as KissopenAgentInboxItemId,
            sessionId: item.sessionId as KissopenAgentSessionId,
            requestId: item.requestId,
            ...(item.scope === undefined ? {} : { scope: item.scope }),
            ...(item.sessionTitle === undefined ? {} : { sessionTitle: item.sessionTitle }),
            questions: item.questions,
            status: item.status,
            ...(item.answers === undefined ? {} : { answers: item.answers }),
            createdAt: item.createdAt,
            ...(item.resolvedAt === undefined ? {} : { resolvedAt: item.resolvedAt }),
        }),
    );
    return [...items].sort((left, right) => {
        if (left.status !== right.status) return left.status === "pending" ? -1 : 1;
        if (left.status === "answered") return (right.resolvedAt ?? 0) - (left.resolvedAt ?? 0);
        return left.createdAt - right.createdAt;
    });
}
