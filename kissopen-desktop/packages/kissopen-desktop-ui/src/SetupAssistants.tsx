import { AssistantMark, type AssistantMarkName } from "./AssistantMark";

/** What setup found out about one assistant on this machine. */
export interface SetupAssistantEntry {
    /** Stable row key, and the command the person would type. */
    readonly id: string;
    readonly name: string;
    /** Whose mark goes above the name. Codex is OpenAI's, so it is named that. */
    readonly mark: AssistantMarkName;
    /**
     * `checking` is still being verified, `found` is usable, `signed-out` is
     * installed but unusable, and `missing` is not here at all.
     *
     * The caller owns that product truth. This component uses it only to keep
     * the same three columns in place while their emphasis changes.
     */
    readonly status: "checking" | "found" | "signed-out" | "missing";
    /** Where it is, or what to do about it, in one line under the name. */
    readonly detail: string;
    /**
     * What that line is. A path is set in the monospace face and allowed to
     * break at its separators, because it is read as a location rather than as a
     * sentence and a column is narrower than most of them.
     */
    readonly detailKind?: "sentence" | "path";
}

export interface SetupAssistantsProps {
    readonly assistants: readonly SetupAssistantEntry[];
    readonly "data-testid"?: string;
}

/**
 * Lets a path wrap where a reader would break it: after a separator.
 *
 * A path is one long token with nowhere to break, so a column either overflows,
 * clips the part that identifies the binary, or splits a directory name down the
 * middle. A zero-width space after each separator offers the layout the breaks
 * the path already has, and adds nothing to what is copied out.
 */
function pathBreakable(path: string): string {
    return path.replaceAll("/", "/​");
}

/**
 * C-270 SetupAssistants — the coding assistants this machine has, side by side.
 *
 * Three columns holding the three things worth knowing: whose tool it is, what
 * it is called, and where it is — or, when it is not here, that it is not. No
 * cards, no icon tiles, no status pills. Each of those was chrome around a fact
 * short enough to read without help, and the row is read across rather than
 * down: same mark size, same baselines, so the column that differs is the one
 * that catches the eye.
 *
 * The marks are the products' own, because that is the one thing a house glyph
 * could not say. A terminal square on all three told the reader they are
 * command-line tools, which they already knew, and left the name doing every
 * bit of the identifying.
 *
 * Status is carried by emphasis rather than by a label. What is here is at full
 * ink with the path that proves it; what is not is dimmed, which is what it is
 * worth on a screen nobody reads for long. Only the case that asks for an action
 * says so in words, because it is the only one where words are the point.
 *
 * Nothing here is selectable. All three are set up outside Kissopen, in a terminal,
 * so this is a report on the machine rather than a set of choices.
 *
 * Props only: which assistants exist and what is true of them belongs to setup.
 */
export function SetupAssistants(props: SetupAssistantsProps) {
    return (
        <div
            className="kissopen-setup-assistants"
            data-kissopen-desktop-ui="setup-assistants"
            data-testid={props["data-testid"]}
        >
            {props.assistants.map((assistant) => (
                <article
                    className="kissopen-setup-assistants__item"
                    data-kissopen-desktop-ui="setup-assistants-item"
                    data-status={assistant.status}
                    key={assistant.id}
                >
                    <span
                        className="kissopen-setup-assistants__mark"
                        data-kissopen-desktop-ui="setup-assistants-mark"
                    >
                        <AssistantMark name={assistant.mark} size={22} />
                    </span>
                    <span
                        className="kissopen-setup-assistants__name"
                        data-kissopen-desktop-ui="setup-assistants-name"
                    >
                        {assistant.name}
                    </span>
                    <span
                        className="kissopen-setup-assistants__detail"
                        data-kissopen-desktop-ui="setup-assistants-detail"
                        data-kind={assistant.detailKind ?? "sentence"}
                    >
                        {assistant.detailKind === "path"
                            ? pathBreakable(assistant.detail)
                            : assistant.detail}
                    </span>
                </article>
            ))}
        </div>
    );
}
