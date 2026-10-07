import type { ConversationEntry } from "kissopen-desktop-state";

type MessageEntry = Extract<ConversationEntry, { kind: "message" }>;

/** Preceding message row, skipping inline tool activity and settled status rows. */
function previousMessage(
    entries: readonly ConversationEntry[],
    index: number,
): MessageEntry | undefined {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const entry = entries[cursor];
        if (entry?.kind === "message") return entry;
        if (entry?.kind === "agentActivity" || entry?.kind === "turnStatus") continue;
        break;
    }
    return undefined;
}

function sameSender(left: MessageEntry, right: MessageEntry): boolean {
    const sender = left.message.sender?.id;
    const other = right.message.sender?.id;
    return sender !== undefined && sender === other;
}

/**
 * Whether this entry resumes prose directly under a run of tool rows. Those rows
 * are deliberately tight, so such a message stays grouped — no repeated avatar or
 * author — but needs the clearance a fresh block has, or the run reads as
 * belonging to the text below it instead of the text above. Roomier activity
 * (reasoning, shell runs) already carries that clearance itself.
 */
export function conversationEntryResumesAfterActivity(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    const previous = entries[index - 1];
    return (
        entries[index]?.kind === "message" &&
        previous?.kind === "agentActivity" &&
        previous.activity.kind === "tool"
    );
}

/**
 * Whether this entry is prose the same turn's tool rows continue directly under.
 * It is the opening half of the boundary `conversationEntryResumesAfterActivity`
 * closes, and takes the same clearance: a fresh author's trailing padding here
 * would push the run further from the text that introduces it than the text
 * resuming below it sits from the run's last row.
 */
export function conversationEntryPrecedesActivity(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    const next = entries[index + 1];
    return (
        entries[index]?.kind === "message" &&
        next?.kind === "agentActivity" &&
        next.activity.kind === "tool"
    );
}

/** Whether this message continues the previous row's author group. */
export function conversationMessageGrouped(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    const entry = entries[index];
    if (entry?.kind !== "message") return false;
    if (entry.message.sender?.kind === "agent") {
        const preceding = entries[index - 1];
        if (preceding?.kind === "agentActivity" || preceding?.kind === "delegation") return true;
    }
    const previous = previousMessage(entries, index);
    return previous !== undefined && sameSender(entry, previous);
}

/** Rows the agent itself produces, and which can therefore open its turn. */
function agentOwnedRow(entry: ConversationEntry | undefined): boolean {
    return (
        entry?.kind === "agentActivity" ||
        entry?.kind === "delegation" ||
        (entry?.kind === "notice" && entry.variant === "notice")
    );
}

/**
 * Whether this row is the first agent-authored one after a user boundary. It
 * owns the identity header for a turn that opens with something other than
 * prose; later rows and the final answer continue that same visual group.
 *
 * A service notice counts, because a turn can fail before it does anything
 * else: two retries and an authentication failure are the whole turn, and
 * without this they would float in the transcript with nothing saying who
 * produced them.
 */
export function conversationAgentRowStartsGroup(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    if (!agentOwnedRow(entries[index])) return false;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const entry = entries[cursor];
        if (!entry) break;
        if (agentOwnedRow(entry)) return false;
        if (entry.kind === "message") return entry.message.sender?.kind !== "agent";
        break;
    }
    return true;
}

/** Whether the live footer is the first agent-owned thing after the user turn. */
export function conversationWorkingStatusStartsGroup(
    entries: readonly ConversationEntry[],
): boolean {
    for (let cursor = entries.length - 1; cursor >= 0; cursor -= 1) {
        const entry = entries[cursor];
        if (!entry) break;
        if (agentOwnedRow(entry) || entry.kind === "request") return false;
        if (entry.kind === "message") return entry.message.sender?.kind !== "agent";
        if (entry.kind === "turnStatus") return true;
    }
    return true;
}

/**
 * Whether this status is the only thing its turn has left to show for itself.
 *
 * A turn whose entire visible history is hidden reasoning ends as one bare
 * "Completed in 3s" under the reader's own message, owned by nobody. There is no
 * agent content to attribute — that is what hiding reasoning means — so the
 * status takes the identity header a tool-first or notice-first turn takes,
 * rather than inventing a row to carry it.
 *
 * It is deliberately not part of `agentOwnedRow`: a status closing a turn that
 * did real work must keep reading as the end of that turn, not as something a
 * later turn's first row has to scan past.
 */
export function conversationTurnStatusStartsGroup(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    if (entries[index]?.kind !== "turnStatus") return false;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const entry = entries[cursor];
        if (!entry) break;
        if (agentOwnedRow(entry)) return false;
        if (entry.kind === "message") return entry.message.sender?.kind !== "agent";
        // Another turn's status: this one opens everything after it.
        if (entry.kind === "turnStatus") return true;
    }
    return true;
}

/**
 * Whether this status closes a run of activity directly. Those rows are tight,
 * so the status opens its own clearance above them. Prose ending the turn is not
 * tight — it closes on the status like one paragraph on the next — so a status
 * under an answer takes no clearance of its own even when the turn ran tools
 * earlier.
 */
export function conversationTurnStatusAfterActivity(
    entries: readonly ConversationEntry[],
    index: number,
): boolean {
    if (entries[index]?.kind !== "turnStatus") return false;
    const previous = entries[index - 1];
    return previous?.kind === "agentActivity" || previous?.kind === "delegation";
}

/**
 * Whether this message is the answer the live or settled status closes. The two
 * are one block: the message gives up the trailing padding before completion so
 * replacing the live footer with the durable status cannot move the transcript.
 */
export function conversationMessageClosedByStatus(
    entries: readonly ConversationEntry[],
    index: number,
    liveStatus = false,
): boolean {
    const entry = entries[index];
    return (
        entry?.kind === "message" &&
        entry.message.sender?.kind === "agent" &&
        (entries[index + 1]?.kind === "turnStatus" || (liveStatus && index === entries.length - 1))
    );
}
