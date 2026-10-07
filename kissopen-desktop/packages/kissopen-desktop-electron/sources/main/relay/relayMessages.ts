/*
Reads one conversation from the relay and turns it into something to draw.

Three steps, all of them the shared core's: decrypt with the session's own key,
normalise each record, and reduce the stream into a conversation. Doing any of
them differently here is how two of a person's devices end up showing the same
conversation differently, so none of them is done here.

The work itself stays where it is. What comes back is what the machine on the
other end has already done, read with that machine's own rules.
*/
import { t } from "kissopen-desktop-state/i18n";
import { createReducer, reducer } from "@kissopen/kissopen-sync/reducer/reducer";
import { normalizeRawMessage, RawRecordSchema } from "@kissopen/kissopen-sync/typesRaw";
import type { Message } from "@kissopen/kissopen-sync/typesMessage";
import type { AgentState } from "@kissopen/kissopen-sync/storageTypes";
import type { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import type { RelayTurn, RelayUsage } from "../../shared/relayContract";

/*
One message as the relay stores it.

`content` is an envelope, not a string: `{t: 'encrypted', c: <base64>}`, which
is what the shared decryptor reads. Taking it for a string produced messages
whose content decrypted to null — every row empty, no error anywhere.
*/
interface RawMessage {
    id: string;
    seq: number;
    localId: string | null;
    content: { t: string; c: string };
    createdAt: number;
    updatedAt: number;
}

/**
 * Turns the relay's answer into the conversation the window shows.
 *
 * The relay returns newest first, because that is the cheap end of its index.
 * A conversation reads the other way, and the reducer wants them in the order
 * they happened, so they are turned around here rather than in three places
 * further on.
 */
export async function relayMessagesRead(
    encryption: Encryption,
    sessionId: string,
    body: unknown,
    agentState?: AgentState | null,
): Promise<{ messages: Message[]; usage: RelayUsage | undefined; turns: RelayTurn[] }> {
    const raw = messagesOf(body);
    const decryptor = encryption.getSessionEncryption(sessionId);
    // A conversation this account cannot open is not an empty conversation.
    if (!decryptor) throw new Error(t("这段对话无法用当前账号的密钥打开"));

    const ordered = [...raw].sort((a, b) => a.createdAt - b.createdAt);
    // Passed through as they arrive: the envelope is already what the shared
    // decryptor reads, and rebuilding it here would be one more chance to get
    // a field name wrong.
    const decrypted = await decryptor.decryptMessages(ordered as never);

    const normalized = [];
    const turns: RelayTurn[] = [];
    for (const message of decrypted) {
        if (!message) continue;
        /*
         * Read before the schema strips it: the shared parser keeps only what
         * the shared reducer uses, and the reducer turns a turn-end into an
         * invisible lifecycle marker. The duration the agent measured is on
         * the raw event and nowhere after it.
         */
        const turn = turnEndOf(message.content);
        if (turn) turns.push(turn);
        const parsed = RawRecordSchema.safeParse(message.content);
        if (!parsed.success) continue;
        const one = normalizeRawMessage(
            message.id,
            message.localId,
            message.createdAt,
            parsed.data,
        );
        if (one) normalized.push(one);
    }

    /*
     * Reduced and handed on whole. Flattening each row to a line of text
     * here is what made a tool call read as prose and left the window unable
     * to draw the row it draws for local work.
     *
     * The usage comes out of the same pass. It is the reducer that decides
     * what counts as the context this conversation has spent — compaction
     * resets it, a context reset zeroes it — and a window that added up
     * tokens on its own would show a different number from the phone.
     */
    const reduced = reducer(createReducer(), normalized, agentState);
    return { messages: reduced.messages, usage: reduced.usage, turns };
}

/**
 * The agent's own account of a turn ending, when this record is one.
 *
 * As the agent stores it, a record is `{role: "session", content: envelope,
 * localId, meta}`: the envelope — id, time, role, turn, ev — is the record's
 * `content`, and the event is its `ev`. Read as it is stored rather than as
 * the shared parser reshapes it, because the parser is what drops the timing.
 */
function turnEndOf(content: unknown): RelayTurn | undefined {
    if (typeof content !== "object" || content === null) return undefined;
    const record = content as { content?: unknown };
    if (typeof record.content !== "object" || record.content === null) return undefined;
    const envelope = record.content as {
        role?: unknown;
        turn?: unknown;
        ev?: {
            t?: unknown;
            status?: unknown;
            reason?: unknown;
            elapsedMs?: unknown;
            turnElapsedMs?: unknown;
        };
    };
    if (
        envelope.role !== "agent" ||
        typeof envelope.turn !== "string" ||
        envelope.ev?.t !== "turn-end"
    )
        return undefined;
    const status = envelope.ev.status;
    if (status !== "completed" && status !== "failed" && status !== "cancelled") return undefined;
    // From the run starting, which is what the reader waited through; the
    // turn's own clock when an older agent reports only that.
    const elapsed =
        typeof envelope.ev.turnElapsedMs === "number"
            ? envelope.ev.turnElapsedMs
            : typeof envelope.ev.elapsedMs === "number"
              ? envelope.ev.elapsedMs
              : undefined;
    if (elapsed === undefined) return undefined;
    const reason = envelope.ev.reason;
    return {
        turn: envelope.turn,
        elapsedMs: Math.max(0, elapsed),
        status,
        reason:
            reason === "abort" ||
            reason === "completed" ||
            reason === "error" ||
            reason === "steering"
                ? reason
                : status === "failed"
                  ? "error"
                  : status === "cancelled"
                    ? "abort"
                    : "completed",
    };
}

/**
 * The messages inside the answer.
 *
 * Both shapes accepted, and neither guessed at: the relay's two list endpoints
 * already disagree with each other, and reading one the wrong way produced an
 * empty list rather than a failure.
 */
function messagesOf(body: unknown): RawMessage[] {
    if (Array.isArray(body)) return body as RawMessage[];
    const named = (body as Record<string, unknown> | null)?.messages;
    if (Array.isArray(named)) return named as RawMessage[];
    throw new Error(t("消息响应不是列表"));
}
