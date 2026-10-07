import { describe, expect, it } from "vitest";
import {
    kissopenAgentInboxStoreCreate,
    type KissopenAgentInboxOutput,
    type KissopenAgentInboxSourceItem,
} from "./kissopenAgentInboxStore.js";
import type {
    KissopenAgentInboxItemId,
    KissopenAgentProjectId,
    KissopenAgentUserInputQuestion,
} from "./kissopenAgentTypes.js";

const ITEM_ID = "one" as KissopenAgentInboxItemId;

function question(
    overrides: Partial<KissopenAgentUserInputQuestion> = {},
): KissopenAgentUserInputQuestion {
    return {
        header: "Migration",
        id: "q1",
        multiSelect: false,
        options: [
            { description: "Move every row at once.", label: "All at once" },
            { description: "Move a table at a time.", label: "Piecemeal" },
        ],
        question: "How should the table be migrated?",
        required: true,
        ...overrides,
    };
}

function sourceItem(
    questions: readonly KissopenAgentUserInputQuestion[],
): KissopenAgentInboxSourceItem {
    return {
        createdAt: 1,
        id: "one",
        scope: { kind: "project", projectId: "project" as KissopenAgentProjectId },
        questions,
        requestId: "request-1",
        sessionId: "session-1",
        status: "pending",
    };
}

/**
 * Opens the store on a feed the test drives, and keeps what it asked its owner to
 * send — which is the only place an answer becomes observable, since the store
 * records intent and never talks to a daemon itself.
 */
function fixtureCreate(questions: readonly KissopenAgentUserInputQuestion[] = [question()]) {
    const sent: KissopenAgentInboxOutput[] = [];
    let emit = (_items: readonly KissopenAgentInboxSourceItem[]): void => undefined;
    const store = kissopenAgentInboxStoreCreate({
        output: (event) => sent.push(event),
        source: {
            subscribe(listener) {
                emit = listener;
                return () => undefined;
            },
        },
    });
    store.subscribe(() => undefined);
    emit([sourceItem(questions)]);
    return { sent, store };
}

describe("kissopen agent inbox written replies", () => {
    it("answers every blank question with what was written", () => {
        const fixture = fixtureCreate([question(), question({ header: "Timing", id: "q2" })]);

        fixture.store.itemMessageUpdate(
            ITEM_ID,
            "  Split the table first, then migrate each half. ",
        );
        fixture.store.itemMessageSubmit(ITEM_ID);

        expect(fixture.sent).toHaveLength(1);
        const [submitted] = fixture.sent;
        expect(submitted?.type).toBe("itemAnswerSubmitted");
        if (submitted?.type !== "itemAnswerSubmitted") throw new Error("expected a submission");
        // Trimmed, because trailing whitespace is typing rather than an answer.
        expect(submitted.answers).toEqual({
            q1: ["Split the table first, then migrate each half."],
            q2: ["Split the table first, then migrate each half."],
        });
    });

    it("keeps a ticked choice and gives the words to the question left blank", () => {
        const fixture = fixtureCreate([question(), question({ header: "Timing", id: "q2" })]);

        fixture.store.itemSelectionUpdate(ITEM_ID, { q1: ["Piecemeal"] });
        fixture.store.itemMessageUpdate(ITEM_ID, "Whenever the nightly window is quiet.");
        fixture.store.itemMessageSubmit(ITEM_ID);

        const [submitted] = fixture.sent;
        if (submitted?.type !== "itemAnswerSubmitted") throw new Error("expected a submission");
        // The regression this guards: dropping either half of the answer, which
        // is what happens when the words overwrite the ticks or replace nothing.
        expect(submitted.answers).toEqual({
            q1: ["Piecemeal"],
            q2: ["Whenever the nightly window is quiet."],
        });
    });

    it("sends nothing when only whitespace was written", () => {
        const fixture = fixtureCreate();

        fixture.store.itemMessageUpdate(ITEM_ID, "   ");
        fixture.store.itemMessageSubmit(ITEM_ID);

        expect(fixture.sent).toEqual([]);
    });

    it("forgets a half-written reply once the question resolves", () => {
        const sent: KissopenAgentInboxOutput[] = [];
        let emit = (_items: readonly KissopenAgentInboxSourceItem[]): void => undefined;
        const store = kissopenAgentInboxStoreCreate({
            output: (event) => sent.push(event),
            source: {
                subscribe(listener) {
                    emit = listener;
                    return () => undefined;
                },
            },
        });
        store.subscribe(() => undefined);
        emit([sourceItem([question()])]);
        store.itemMessageUpdate(ITEM_ID, "Piecemeal, starting with the smallest table.");
        expect(store.get().messages.get(ITEM_ID)).toBeDefined();

        // Answered elsewhere — another window, or the session itself moving on.
        emit([{ ...sourceItem([question()]), resolvedAt: 2, status: "answered" }]);

        expect(store.get().messages.get(ITEM_ID)).toBeUndefined();
        expect(store.get().selections.get(ITEM_ID)).toBeUndefined();
    });
});
