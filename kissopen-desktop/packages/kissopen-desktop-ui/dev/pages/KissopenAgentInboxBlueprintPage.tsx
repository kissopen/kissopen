import type {
    KissopenAgentInboxItem,
    KissopenAgentInboxItemId,
    KissopenAgentInboxSubmission,
    KissopenAgentProjectId,
    KissopenAgentSessionId,
} from "kissopen-desktop-state";
import { KissopenAgentInboxPage } from "../../src/pages/inbox/KissopenAgentInboxPage";
import { ComponentPage, FullScreenSpecimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "P-013";

const item = (
    id: string,
    overrides: Partial<KissopenAgentInboxItem> &
        Pick<KissopenAgentInboxItem, "questions" | "status">,
): KissopenAgentInboxItem =>
    ({
        id: id as KissopenAgentInboxItemId,
        sessionId: `session-${id}` as KissopenAgentSessionId,
        requestId: `req-${id}`,
        scope: { kind: "project", projectId: "project-1" as KissopenAgentProjectId },
        createdAt: 1_700_000_000_000,
        ...overrides,
    }) as unknown as KissopenAgentInboxItem;

const pending: readonly KissopenAgentInboxItem[] = [
    item("one", {
        sessionTitle: "Migrate the plugin permission table",
        status: "pending",
        questions: [
            {
                id: "approach",
                header: "Approach",
                question: "How should the migration run?",
                multiSelect: false,
                required: true,
                options: [
                    {
                        label: "In one transaction",
                        description: "Atomic but locks the table longer.",
                    },
                    {
                        label: "In batches",
                        description: "Lower lock contention, slower overall.",
                    },
                ],
            },
            {
                id: "notify",
                header: "Notify",
                question: "Who should hear about it when it lands?",
                multiSelect: true,
                required: false,
                options: [
                    { label: "On-call", description: "Pages whoever is holding the rota." },
                    { label: "Release channel", description: "Posts once, after the migration." },
                ],
            },
        ],
    }),
    item("two", {
        sessionTitle: "Rewrite the changed-files header",
        status: "pending",
        questions: [
            {
                id: "scope",
                header: "Scope",
                question: "Which surfaces should adopt the new header?",
                multiSelect: true,
                required: true,
                options: [
                    { label: "Changed files", description: "The diff listing." },
                    { label: "All files", description: "The full tree." },
                    { label: "Search results", description: "Shares the row rhythm." },
                ],
            },
        ],
    }),
];

const answered: readonly KissopenAgentInboxItem[] = [
    item("three", {
        sessionTitle: "Add the node status block",
        status: "answered",
        resolvedAt: 1_700_000_500_000,
        answers: { placement: ["Sidebar"] },
        questions: [
            {
                id: "placement",
                header: "Placement",
                question: "Where should node status appear?",
                multiSelect: false,
                required: true,
                options: [
                    { label: "Sidebar", description: "Beside the rest of the work." },
                    { label: "Settings only", description: "One page, read on demand." },
                ],
            },
        ],
    }),
    item("four", {
        sessionTitle: "Vendor the Octicons glyphmap",
        status: "answered",
        resolvedAt: 1_700_000_200_000,
        answers: { source: ["Regenerate from upstream", "Check the map into the repo"] },
        questions: [
            {
                id: "source",
                header: "Source",
                question: "Where should the name map come from?",
                multiSelect: true,
                required: true,
                options: [
                    { label: "Regenerate from upstream", description: "Matches KISSOPEN exactly." },
                    { label: "Check the map into the repo", description: "No build-time step." },
                ],
            },
        ],
    }),
];

const submissions: ReadonlyMap<KissopenAgentInboxItemId, KissopenAgentInboxSubmission> = new Map([
    ["two" as KissopenAgentInboxItemId, { type: "pending" } as KissopenAgentInboxSubmission],
]);

const failed: ReadonlyMap<KissopenAgentInboxItemId, KissopenAgentInboxSubmission> = new Map([
    [
        "one" as KissopenAgentInboxItemId,
        {
            type: "failed",
            error: {
                name: "UserError",
                message: "The KISSOPEN Agent refused the answer: the session ended.",
            },
        } as KissopenAgentInboxSubmission,
    ],
]);

/** A reply part-written into the first question, so the input shows its filled state. */
const messages: ReadonlyMap<KissopenAgentInboxItemId, string> = new Map([
    ["one" as KissopenAgentInboxItemId, "Neither — split the table first and migrate each half."],
]);

const location = (candidate: KissopenAgentInboxItem): string =>
    candidate.scope?.kind === "workspace" ? "kissopen · feature worktree" : "kissopen";

const time = (candidate: KissopenAgentInboxItem): string =>
    candidate.status === "answered" ? "Answered 8m ago" : "Asked 3m ago";

export function KissopenAgentInboxBlueprintPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The queue of questions a KISSOPEN Agent's agents are waiting on: pending first in the order they were asked, answered below as a record. A waiting question is one outlined block headed by the session that asked; a settled one drops the outline and keeps only what was decided."
            title="KissopenAgentInboxPage"
        >
            <FullScreenSpecimen
                detail="Two waiting questions and two answered; the second answer is in flight, the first question carries a required and an optional part, and each waiting question also takes a written reply for when no option fits."
                label="Queue with history"
                number="01"
            >
                <KissopenAgentInboxPage
                    answered={answered}
                    itemLocation={location}
                    itemTime={time}
                    messages={messages}
                    onAnswer={() => undefined}
                    onMessageChange={() => undefined}
                    onMessageSubmit={() => undefined}
                    onOpenSession={() => undefined}
                    pending={pending}
                    submissions={submissions}
                />
            </FullScreenSpecimen>

            <FullScreenSpecimen
                detail="Everything asked has an answer, so the queue says so inline and leaves the record reachable."
                label="Caught up"
                number="02"
            >
                <KissopenAgentInboxPage
                    answered={answered}
                    itemLocation={location}
                    itemTime={time}
                    onAnswer={() => undefined}
                    onOpenSession={() => undefined}
                    pending={[]}
                />
            </FullScreenSpecimen>

            <FullScreenSpecimen detail="No agent has asked anything yet." label="Empty" number="03">
                <KissopenAgentInboxPage answered={[]} onAnswer={() => undefined} pending={[]} />
            </FullScreenSpecimen>

            <FullScreenSpecimen
                detail="The feed failed; retained questions stay readable beneath the banner."
                label="Feed error"
                number="04"
            >
                <KissopenAgentInboxPage
                    answered={[]}
                    error={{
                        name: "UserError",
                        message: "The KISSOPEN Agent stopped reporting questions.",
                    }}
                    itemLocation={location}
                    itemTime={time}
                    onAnswer={() => undefined}
                    pending={pending}
                />
            </FullScreenSpecimen>

            <FullScreenSpecimen
                detail="An answer the KISSOPEN Agent refused; the selections are retained inside the question so the retry sends the same thing."
                label="Answer not sent"
                number="05"
            >
                <KissopenAgentInboxPage
                    answered={[]}
                    itemLocation={location}
                    itemTime={time}
                    onAnswer={() => undefined}
                    onOpenSession={() => undefined}
                    pending={pending}
                    submissions={failed}
                />
            </FullScreenSpecimen>
        </ComponentPage>
    );
}
