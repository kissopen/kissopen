import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import type {
    KissopenAgentInboxItem,
    KissopenAgentInboxItemId,
    KissopenAgentInboxSubmission,
    UserError,
} from "kissopen-desktop-state";
import { AvatarBrutalist } from "../../AvatarBrutalist";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { Composer } from "../../Composer";
import { EmptyState } from "../../EmptyState";
import { Icon } from "../../Icon";
import { SURFACE_HEADER_HEIGHT } from "../../InfoPanel";
import {
    KissopenAgentUserInputPrompt,
    type KissopenAgentUserInputAnswerMap,
} from "../../KissopenAgentUserInputPrompt";
import { ScrollArea } from "../../Scrollbar";
import { Toolbar } from "../../Toolbar";

export interface KissopenAgentInboxPageProps {
    /** Questions still waiting on an answer, oldest first. */
    pending: readonly KissopenAgentInboxItem[];
    /** Questions already answered, most recently resolved first. */
    answered: readonly KissopenAgentInboxItem[];
    /** True before the first feed arrives, so an empty queue is not claimed early. */
    loading?: boolean;
    /** The question feed itself failed; retained items stay readable beneath it. */
    error?: UserError;
    /** Why answers cannot currently be submitted. Drafts and selections remain local. */
    unavailable?: string;
    /** In-flight and failed answer submissions, by item. */
    submissions?: ReadonlyMap<KissopenAgentInboxItemId, KissopenAgentInboxSubmission>;
    onAnswer: (itemId: KissopenAgentInboxItemId, answers: KissopenAgentInboxAnswerMap) => void;
    /** Replies being written in the reader's own words, by item. */
    messages?: ReadonlyMap<KissopenAgentInboxItemId, string>;
    /** Options ticked into a question but not yet submitted, by item. */
    selections?: ReadonlyMap<KissopenAgentInboxItemId, Readonly<Record<string, readonly string[]>>>;
    /** Reports each tick to the owner that keeps the selections. */
    onSelectionChange?: (
        itemId: KissopenAgentInboxItemId,
        answers: KissopenAgentInboxAnswerMap,
    ) => void;
    /**
     * Records typing in one question's reply box. Supplied with
     * `onMessageSubmit`, it is what gives a question a written answer beside its
     * options — the way out when none of them is what should happen.
     */
    onMessageChange?: (itemId: KissopenAgentInboxItemId, text: string) => void;
    /** Sends what was written as that question's answer. */
    onMessageSubmit?: (itemId: KissopenAgentInboxItemId) => void;
    /** Opens the session that asked, for the context a question does not carry. */
    onOpenSession?: (item: KissopenAgentInboxItem) => void;
    /** Names the project or worktree an item belongs to. */
    itemLocation?: (item: KissopenAgentInboxItem) => string | undefined;
    /** Renders an item's age the way the rest of the surface renders time. */
    itemTime?: (item: KissopenAgentInboxItem) => string | undefined;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
}

export type KissopenAgentInboxAnswerMap = KissopenAgentUserInputAnswerMap;

/**
 * KissopenAgentInboxPage — the queue of questions a Kissopen Agent's agents are waiting on, answered
 * in place. Pending questions come first in the order they were asked, so
 * working top to bottom unblocks the agent that has waited longest; answered
 * questions stay below as a record of what was decided.
 *
 * A waiting question is one block: the session that asked heads it and the
 * question it asked fills it, because the two are the same fact and reading
 * them as separate objects is what made this screen hard to scan. An answered
 * one keeps no container at all — it is a record, not work, so it is a line
 * with what was decided under it and a rule between it and the next.
 *
 * Colour is spent only where it distinguishes: green on a settled question,
 * and the ordinary danger tone when a send failed. Nothing else is coloured.
 *
 * It renders exactly what it is handed and reports each answer upward. It holds
 * no queue of its own, so an answered question leaves only when the owner says
 * the KISSOPEN Agent resolved it.
 */
export function KissopenAgentInboxPage(props: KissopenAgentInboxPageProps) {
    const submissions = props.submissions;
    const pendingCount = props.pending.length;
    const answeredCount = props.answered.length;

    return (
        <div
            className={["kissopen-agent-inbox", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-inbox"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <div
                className="kissopen-agent-inbox__header"
                data-kissopen-desktop-ui="kissopen-agent-inbox-header"
            >
                <Toolbar
                    height={SURFACE_HEADER_HEIGHT}
                    subtitle={inboxSubtitle(pendingCount, answeredCount, props.loading)}
                    title={t("Inbox")}
                />
            </div>
            <ScrollArea
                className="kissopen-agent-inbox__scroll"
                data-kissopen-desktop-ui="kissopen-agent-inbox-scroll"
                viewportClassName="kissopen-agent-inbox__scroll-viewport"
            >
                <div className="kissopen-agent-inbox__content">
                    {props.error ? (
                        <Banner tone="danger" title={t("Questions may be out of date")}>
                            {props.error.message}
                        </Banner>
                    ) : null}
                    {props.unavailable ? (
                        <Banner tone="neutral" title={t("KissOpen Agent reconnecting")}>
                            {props.unavailable}
                        </Banner>
                    ) : null}

                    {pendingCount === 0 && answeredCount === 0 ? (
                        <EmptyState
                            // The resting mark belongs to the settled reading
                            // only. While the inbox is still being read nothing
                            // is known yet, and a calm emptiness that may not be
                            // there would be a lie; the loading loop says the
                            // honest thing instead, which is "still reading".
                            animation={props.loading ? "brand-loading" : "brand-rest"}
                            description={
                                props.loading
                                    ? "Reading what this KissOpen Agent's agents are waiting on."
                                    : "When an agent needs a decision, it waits for you here."
                            }
                            icon={props.loading ? "clock" : "check-circle"}
                            title={props.loading ? "Loading inbox…" : "Nothing to decide"}
                        />
                    ) : null}

                    {pendingCount > 0 ? (
                        <SectionLabel
                            count={pendingCount}
                            label={t("Waiting")}
                            testid="kissopen-agent-inbox-section-waiting"
                        />
                    ) : null}

                    {props.pending.map((item) => (
                        <InboxPendingItem
                            item={item}
                            key={item.id}
                            location={props.itemLocation?.(item)}
                            message={props.messages?.get(item.id) ?? ""}
                            onAnswer={props.onAnswer}
                            {...(props.onSelectionChange
                                ? { onSelectionChange: props.onSelectionChange }
                                : {})}
                            {...(props.selections?.get(item.id)
                                ? { selection: props.selections.get(item.id)! }
                                : {})}
                            {...(props.onMessageChange
                                ? { onMessageChange: props.onMessageChange }
                                : {})}
                            {...(props.onMessageSubmit
                                ? { onMessageSubmit: props.onMessageSubmit }
                                : {})}
                            {...(props.onOpenSession ? { onOpenSession: props.onOpenSession } : {})}
                            submission={submissions?.get(item.id)}
                            time={props.itemTime?.(item)}
                            {...(props.unavailable === undefined
                                ? {}
                                : { unavailable: props.unavailable })}
                        />
                    ))}

                    {/* Caught up is a state of the queue, not of the screen: the
                        record below still has to be reachable and is read down
                        the same left edge, so this is one line in that column
                        rather than a centred medallion claiming the panel. */}
                    {pendingCount === 0 && answeredCount > 0 ? (
                        <p
                            className="kissopen-agent-inbox__caught-up"
                            data-kissopen-desktop-ui="kissopen-agent-inbox-caught-up"
                        >
                            <span
                                aria-hidden="true"
                                className="kissopen-agent-inbox__caught-up-mark"
                            >
                                <Icon name="check-circle" size={16} />
                            </span>
                            <strong className="kissopen-agent-inbox__caught-up-title">
                                {t("All caught up")}
                            </strong>
                            <span className="kissopen-agent-inbox__caught-up-detail">
                                {t("Everything this KissOpen Agent asked has an answer.")}
                            </span>
                        </p>
                    ) : null}

                    {answeredCount > 0 ? (
                        <SectionLabel
                            count={answeredCount}
                            label={t("Answered")}
                            testid="kissopen-agent-inbox-section"
                        />
                    ) : null}

                    {answeredCount > 0 ? (
                        <div
                            className="kissopen-agent-inbox__records"
                            data-kissopen-desktop-ui="kissopen-agent-inbox-records"
                        >
                            {props.answered.map((item) => (
                                <InboxAnsweredItem
                                    item={item}
                                    key={item.id}
                                    location={props.itemLocation?.(item)}
                                    {...(props.onOpenSession
                                        ? { onOpenSession: props.onOpenSession }
                                        : {})}
                                    time={props.itemTime?.(item)}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}

/**
 * The name of a run of items and how many are in it. The count belongs beside
 * the name rather than only in the header, because the two groups are read at
 * different points in a long queue.
 */
function SectionLabel(props: { count: number; label: string; testid: string }) {
    return (
        <h2 className="kissopen-agent-inbox__section" data-kissopen-desktop-ui={props.testid}>
            <span className="kissopen-agent-inbox__section-label">{props.label}</span>
            <span className="kissopen-agent-inbox__section-count">{props.count}</span>
        </h2>
    );
}

function inboxSubtitle(pending: number, answered: number, loading?: boolean): string {
    if (loading) return "Loading…";
    if (pending === 0) return answered === 0 ? "No questions" : `All ${answered} answered`;
    return `${pending} waiting${answered > 0 ? ` · ${answered} answered` : ""}`;
}

interface InboxItemHeaderProps {
    item: KissopenAgentInboxItem;
    location?: string;
    onOpenSession?: (item: KissopenAgentInboxItem) => void;
    time?: string;
}

/**
 * Who asked, where from, when, and the way back to the conversation. The mark
 * and the title lead because the session is what a question has to be matched
 * to; the time and the way out close the line.
 */
function InboxItemHeader(props: InboxItemHeaderProps & { status?: string }) {
    const title = props.item.sessionTitle ?? t("Untitled session");
    return (
        <div
            className="kissopen-agent-inbox__item-header"
            data-kissopen-desktop-ui="kissopen-agent-inbox-item-header"
        >
            <span className="kissopen-agent-inbox__item-identity">
                {/* The asking session's own mark, the same one its tab wears, so
                    a question read here and the session it came from are the
                    same thing at a glance rather than two titles to match up. */}
                <AvatarBrutalist
                    aria-label={title}
                    className="kissopen-agent-inbox__item-avatar"
                    id={props.item.sessionId}
                    size={20}
                />
                <span className="kissopen-agent-inbox__item-title">{title}</span>
                {props.location ? (
                    <span className="kissopen-agent-inbox__item-location">{props.location}</span>
                ) : null}
            </span>
            <span className="kissopen-agent-inbox__item-meta">
                {/* Spoken as well as shown: the answer leaves on its own after
                    the form is submitted, so someone who is not watching this
                    line still hears that the send is under way. */}
                {props.status ? (
                    <span
                        className="kissopen-agent-inbox__item-status"
                        data-kissopen-desktop-ui="kissopen-agent-inbox-item-status"
                        role="status"
                    >
                        {props.status}
                    </span>
                ) : null}
                {props.time ? (
                    <span className="kissopen-agent-inbox__item-time">{props.time}</span>
                ) : null}
                {props.onOpenSession ? (
                    <Button
                        data-action="open-session"
                        onClick={() => props.onOpenSession?.(props.item)}
                        size="small"
                        variant="ghost"
                    >
                        {t("Open session")}
                    </Button>
                ) : null}
            </span>
        </div>
    );
}

interface InboxPendingItemProps extends InboxItemHeaderProps {
    /** What has been written as this question's reply so far. */
    message: string;
    onAnswer: (itemId: KissopenAgentInboxItemId, answers: KissopenAgentInboxAnswerMap) => void;
    /** Options ticked into this question so far. */
    selection?: Readonly<Record<string, readonly string[]>>;
    onSelectionChange?: (
        itemId: KissopenAgentInboxItemId,
        answers: KissopenAgentInboxAnswerMap,
    ) => void;
    onMessageChange?: (itemId: KissopenAgentInboxItemId, text: string) => void;
    onMessageSubmit?: (itemId: KissopenAgentInboxItemId) => void;
    submission?: KissopenAgentInboxSubmission;
    unavailable?: string;
}

function InboxPendingItem(props: InboxPendingItemProps) {
    const submission = props.submission;
    const onMessageChange = props.onMessageChange;
    const onMessageSubmit = props.onMessageSubmit;
    return (
        <article
            className="kissopen-agent-inbox__item"
            data-kissopen-desktop-ui="kissopen-agent-inbox-item"
            data-item-id={props.item.id}
            data-status="pending"
        >
            <InboxItemHeader
                item={props.item}
                {...(props.location === undefined ? {} : { location: props.location })}
                {...(props.onOpenSession ? { onOpenSession: props.onOpenSession } : {})}
                {...(submission?.type === "pending" ? { status: t("Sending…") } : {})}
                {...(props.time === undefined ? {} : { time: props.time })}
            />
            <KissopenAgentUserInputPrompt
                {...(submission?.type === "failed" ? { error: submission.error } : {})}
                onAnswer={(_requestId, answers) => props.onAnswer(props.item.id, answers)}
                {...(props.onSelectionChange
                    ? {
                          onSelectionChange: (
                              _requestId: string,
                              answers: KissopenAgentInboxAnswerMap,
                          ) => props.onSelectionChange?.(props.item.id, answers),
                      }
                    : {})}
                pending={submission?.type === "pending"}
                submitDisabled={props.unavailable !== undefined}
                {...(props.unavailable === undefined
                    ? {}
                    : { submitDisabledReason: props.unavailable })}
                {...(props.selection ? { selection: props.selection } : {})}
                request={{
                    requestId: props.item.requestId,
                    questions: props.item.questions,
                }}
                variant="flat"
            />
            {/* The answer for when none of the options is the answer. It is the
                chat's own input, minus every knob that configures a session:
                there is no session being configured here, only something to
                say back. */}
            {onMessageChange && onMessageSubmit ? (
                <Composer
                    className="kissopen-agent-inbox__reply"
                    data-testid="kissopen-agent-inbox-reply"
                    onSend={() => onMessageSubmit(props.item.id)}
                    onValueChange={(value) => onMessageChange(props.item.id, value)}
                    pending={submission?.type === "pending"}
                    placeholder={t("Or say what to do instead…")}
                    submitDisabled={props.unavailable !== undefined}
                    value={props.message}
                />
            ) : null}
        </article>
    );
}

/**
 * A settled question. There is nothing to do with it, so it is drawn as a
 * record rather than as a form: the question in secondary type with what was
 * decided under it, and a check that says the decision was made without
 * repeating the word on every row.
 */
function InboxAnsweredItem(props: InboxItemHeaderProps) {
    return (
        <article
            className="kissopen-agent-inbox__item"
            data-kissopen-desktop-ui="kissopen-agent-inbox-item"
            data-item-id={props.item.id}
            data-status="answered"
        >
            <InboxItemHeader
                item={props.item}
                {...(props.location === undefined ? {} : { location: props.location })}
                {...(props.onOpenSession ? { onOpenSession: props.onOpenSession } : {})}
                {...(props.time === undefined ? {} : { time: props.time })}
            />
            <dl
                className="kissopen-agent-inbox__answers"
                data-kissopen-desktop-ui="kissopen-agent-inbox-answers"
            >
                {props.item.questions.map((question) => {
                    const chosen = props.item.answers?.[question.id] ?? [];
                    return (
                        <div className="kissopen-agent-inbox__answer" key={question.id}>
                            <dt className="kissopen-agent-inbox__answer-question">
                                {/* The mark hangs in the column the session's
                                    own avatar occupies, so the question and the
                                    decision under it keep the title's left edge
                                    whether or not anything was recorded. */}
                                <span
                                    aria-hidden="true"
                                    className="kissopen-agent-inbox__answer-mark"
                                >
                                    {chosen.length > 0 ? <Icon name="check" size={12} /> : null}
                                </span>
                                <span className="kissopen-agent-inbox__answer-text">
                                    {question.question}
                                </span>
                            </dt>
                            <dd className="kissopen-agent-inbox__answer-value">
                                {chosen.length > 0 ? (
                                    chosen.join(", ")
                                ) : (
                                    <span className="kissopen-agent-inbox__answer-empty">
                                        {t("No answer recorded")}
                                    </span>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </article>
    );
}
