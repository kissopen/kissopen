import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import type { KissopenAgentUserInputRequest, UserError } from "kissopen-desktop-state";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { TextField } from "./TextField";

export type KissopenAgentUserInputAnswerMap = Record<string, string[]>;

/**
 * Whether the prompt follows transcript or inbox spacing. `card` uses the
 * conversation's full composer measure; `flat` inherits the inbox row around it.
 */
export type KissopenAgentUserInputPromptVariant = "card" | "flat";

export type KissopenAgentUserInputPromptProps = {
    request: KissopenAgentUserInputRequest;
    /** Authoritative settled answers turn the prompt into compact transcript history. */
    resolvedAnswers?: Readonly<Record<string, readonly string[]>>;
    /** Absent when this surface can display choices but cannot submit them. */
    onAnswer?: (requestId: string, answers: KissopenAgentUserInputAnswerMap) => void;
    /**
     * What is ticked right now, for an owner that keeps the selection. Supplying
     * it with `onSelectionChange` is what lets something outside this card act on
     * a half-made choice — sending a message that answers the question has to
     * carry the options already ticked into it. Left out, the card keeps its own
     * selection and stays a self-contained prompt.
     */
    selection?: Readonly<Record<string, readonly string[]>>;
    /** Reports the whole selection after each tick, for an owner that keeps it. */
    onSelectionChange?: (requestId: string, answers: KissopenAgentUserInputAnswerMap) => void;
    /** Disables the controls while a prior submission is in flight. */
    pending?: boolean;
    /** Disables only submission while keeping local option selection editable. */
    submitDisabled?: boolean;
    submitDisabledReason?: string;
    /** Last failed answer submission; retry resubmits the retained selections. */
    error?: UserError;
    /** Defaults to `card`; see `KissopenAgentUserInputPromptVariant`. */
    variant?: KissopenAgentUserInputPromptVariant;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/**
 * How a question is answered, said beside its name so the rule is read before
 * the answer rather than discovered by trying one: pick one option, pick any,
 * or — when the agent offered no options at all — write the answer. An
 * optional question says so too: nothing under it is holding the submit back.
 */
function selectionRule(question: {
    multiSelect: boolean;
    required: boolean;
    options: readonly unknown[];
}): string {
    const rule = isWritten(question)
        ? t("Type an answer")
        : question.multiSelect
          ? t("Choose any")
          : t("Choose one");
    return question.required ? rule : t("{rule} · optional", { rule });
}

/**
 * A question the agent asked without options is answered in the person's own
 * words. It is not a choice with nothing to choose from: the agent protocol
 * takes a written answer for it, and a card that showed only its (empty)
 * options could never be submitted.
 */
function isWritten(question: { options: readonly unknown[] }): boolean {
    return question.options.length === 0;
}

/** What is actually said: written answers without the spaces around them, and no blank ones. */
function answersToSend(answers: KissopenAgentUserInputAnswerMap): KissopenAgentUserInputAnswerMap {
    return Object.fromEntries(
        Object.entries(answers).map(([id, values]) => [
            id,
            values.map((value) => value.trim()).filter((value) => value.length > 0),
        ]),
    );
}

function toggleValue(current: readonly string[], value: string, multiSelect: boolean): string[] {
    if (multiSelect)
        return current.includes(value)
            ? current.filter((entry) => entry !== value)
            : [...current, value];
    return current.includes(value) ? [] : [value];
}

/**
 * KissopenAgentUserInputPrompt — renders a `KissopenAgentUserInputRequest` as one or more option
 * pickers, or as compact read-only history when `resolvedAnswers` is present.
 * Every question with options also takes the person's own words in an "other"
 * field under them, and a question asked without options is written only.
 * Single-select questions clear other options; multi-select questions
 * accumulate. Submit calls `onAnswer(requestId, { [questionId]: string[] })`
 * with the chosen option labels, and is blocked until every `required` question
 * has at least one selection.
 *
 * Each question states its own selection rule beside its name, so a person can
 * tell a single choice from an accumulating one, and an optional question from
 * the one actually holding the submit, without trying an option to find out.
 *
 * The selection is the card's own state unless the owner keeps it through
 * `selection`/`onSelectionChange`, which an owner does when something outside the
 * card — a composer whose message answers this question — must be able to read a
 * choice that has been made but not yet submitted.
 */
export function KissopenAgentUserInputPrompt(props: KissopenAgentUserInputPromptProps) {
    const { request } = props;
    const [ownAnswers, setOwnAnswers] = useState<KissopenAgentUserInputAnswerMap>({});
    const resolved = props.resolvedAnswers !== undefined;
    const controlled = props.selection !== undefined || resolved;
    const answers: KissopenAgentUserInputAnswerMap = controlled
        ? Object.fromEntries(
              Object.entries(props.resolvedAnswers ?? props.selection ?? {}).map(([id, values]) => [
                  id,
                  [...values],
              ]),
          )
        : ownAnswers;

    // A question's answer holds the labels picked from its options and, after them, whatever
    // the person wrote themselves; picking an option keeps what was written, and writing keeps
    // what was picked. The agent tells the two apart by whether a value is one of its labels.
    const labelsOf = (questionId: string) =>
        new Set(
            request.questions
                .find((question) => question.id === questionId)
                ?.options.map((option) => option.label) ?? [],
        );
    const select = (questionId: string, value: string, multiSelect: boolean) => {
        const labels = labelsOf(questionId);
        const current = answers[questionId] ?? [];
        const next: KissopenAgentUserInputAnswerMap = {
            ...answers,
            [questionId]: [
                ...toggleValue(
                    current.filter((entry) => labels.has(entry)),
                    value,
                    multiSelect,
                ),
                ...current.filter((entry) => !labels.has(entry)),
            ],
        };
        if (!controlled) setOwnAnswers(next);
        props.onSelectionChange?.(request.requestId, next);
    };

    const write = (questionId: string, text: string) => {
        const labels = labelsOf(questionId);
        const picked = (answers[questionId] ?? []).filter((entry) => labels.has(entry));
        const next: KissopenAgentUserInputAnswerMap = { ...answers, [questionId]: [...picked, text] };
        if (!controlled) setOwnAnswers(next);
        props.onSelectionChange?.(request.requestId, next);
    };

    const complete = request.questions.every(
        (question) =>
            !question.required ||
            (answers[question.id] ?? []).some((value) => value.trim().length > 0),
    );
    const submit = () => props.onAnswer?.(request.requestId, answersToSend(answers));

    return (
        <section
            className={["kissopen-agent-input", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-user-input"
            data-state={resolved ? "answered" : "pending"}
            data-testid={props["data-testid"]}
            data-variant={props.variant ?? "card"}
            style={props.style}
        >
            <div className="kissopen-agent-input__questions">
                {request.questions.map((question) => {
                    const selected = answers[question.id] ?? [];
                    return (
                        <fieldset
                            className="kissopen-agent-input__question"
                            data-kissopen-desktop-ui="kissopen-agent-user-input-question"
                            data-question-id={question.id}
                            key={question.id}
                        >
                            <legend className="kissopen-agent-input__legend">
                                <span className="kissopen-agent-input__eyebrow">
                                    <span
                                        className="kissopen-agent-input__header"
                                        data-kissopen-desktop-ui="kissopen-agent-user-input-header"
                                    >
                                        {question.header}
                                    </span>
                                    <span
                                        className="kissopen-agent-input__rule"
                                        data-kissopen-desktop-ui="kissopen-agent-user-input-rule"
                                    >
                                        {resolved
                                            ? selected.length > 0
                                                ? t("Answered")
                                                : question.required
                                                  ? t("No answer")
                                                  : t("Skipped")
                                            : selectionRule(question)}
                                    </span>
                                </span>
                                <span className="kissopen-agent-input__prompt">
                                    {question.question}
                                </span>
                            </legend>
                            {resolved ? (
                                <div
                                    className="kissopen-agent-input__answers"
                                    data-kissopen-desktop-ui="kissopen-agent-user-input-answers"
                                >
                                    {(answers[question.id] ?? []).length > 0 ? (
                                        (answers[question.id] ?? []).map((answer) => {
                                            const option = question.options.find(
                                                (candidate) => candidate.label === answer,
                                            );
                                            return (
                                                <div
                                                    className="kissopen-agent-input__answer"
                                                    key={answer}
                                                >
                                                    <span className="kissopen-agent-input__answer-label">
                                                        {answer}
                                                    </span>
                                                    {option?.description ? (
                                                        <span className="kissopen-agent-input__answer-description">
                                                            {option.description}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="kissopen-agent-input__answer">
                                            <span className="kissopen-agent-input__answer-label">
                                                {question.required ? t("No answer") : t("Skipped")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : isWritten(question) ? (
                                <TextField
                                    aria-label={question.header}
                                    data-testid="kissopen-agent-user-input-text"
                                    disabled={props.pending}
                                    fullWidth
                                    multiline
                                    onValueChange={(value) => write(question.id, value)}
                                    placeholder={t("Type your answer here")}
                                    rows={2}
                                    value={selected[0] ?? ""}
                                />
                            ) : (
                                <div className="kissopen-agent-input__options">
                                    {question.options.map((option, optionIndex) => {
                                        const descriptionId = `${request.requestId}-${question.id}-${optionIndex}-description`;
                                        return (
                                            <label
                                                className="kissopen-agent-input__option"
                                                data-disabled={props.pending ? "" : undefined}
                                                data-kissopen-desktop-ui="kissopen-agent-user-input-option"
                                                data-selected={
                                                    selected.includes(option.label) ? "" : undefined
                                                }
                                                key={option.label}
                                                title={option.description || undefined}
                                            >
                                                <Checkbox
                                                    aria-describedby={
                                                        option.description
                                                            ? descriptionId
                                                            : undefined
                                                    }
                                                    aria-label={option.label}
                                                    checked={selected.includes(option.label)}
                                                    disabled={props.pending}
                                                    onChange={() =>
                                                        select(
                                                            question.id,
                                                            option.label,
                                                            question.multiSelect,
                                                        )
                                                    }
                                                />
                                                <span className="kissopen-agent-input__option-body">
                                                    <span className="kissopen-agent-input__option-label">
                                                        {option.label}
                                                    </span>
                                                    {option.description ? (
                                                        <span
                                                            className="kissopen-agent-input__option-description"
                                                            id={descriptionId}
                                                        >
                                                            {option.description}
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </label>
                                        );
                                    })}
                                    <TextField
                                        aria-label={t("Other answer for {question}", {
                                            question: question.header,
                                        })}
                                        data-testid="kissopen-agent-user-input-other"
                                        disabled={props.pending}
                                        fullWidth
                                        onValueChange={(value) => write(question.id, value)}
                                        placeholder={t("Other: write your own answer")}
                                        size="small"
                                        value={
                                            selected.find(
                                                (entry) =>
                                                    !question.options.some(
                                                        (option) => option.label === entry,
                                                    ),
                                            ) ?? ""
                                        }
                                    />
                                </div>
                            )}
                        </fieldset>
                    );
                })}
            </div>
            {!resolved && props.error ? (
                <Banner
                    {...(props.submitDisabled || props.onAnswer === undefined
                        ? {}
                        : {
                              action: {
                                  label: t("Retry"),
                                  onClick: submit,
                              },
                          })}
                    data-testid="kissopen-agent-user-input-error"
                    tone="danger"
                    title={t("Answer not sent")}
                >
                    {props.error.message}
                </Banner>
            ) : null}
            {resolved ? null : (
                <div className="kissopen-agent-input__footer">
                    <Button
                        data-action="submit"
                        disabled={
                            !complete ||
                            props.pending ||
                            props.submitDisabled ||
                            props.onAnswer === undefined
                        }
                        loading={props.pending}
                        onClick={submit}
                        size="small"
                        title={
                            props.submitDisabledReason ??
                            (props.onAnswer === undefined ? t("Answers are unavailable") : undefined)
                        }
                        variant="secondary"
                    >
                        {t("Submit")}
                    </Button>
                </div>
            )}
        </section>
    );
}
