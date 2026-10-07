/*
Sending to a session that lives on another machine.

The relay does not treat this desktop differently from the phone: the send
route authorises on the account alone, so a machine of this person's can be
talked to from any of their clients. Nothing new was needed on the server for
this — only a client that asks.

The record built here is the same one the phone builds, encrypted with the
session's own key. An agent reading it has no way to tell which of the
account's clients typed it, and should not: it is the same person.
*/
import { t } from "kissopen-desktop-state/i18n";
import { syncPlatform } from "@kissopen/kissopen-sync/platform";
import type { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import { relayFileRecord, type RelayStoredFile } from "./relayAttachments";

/**
 * Identifies this send to the session, so the machine can join the message it
 * stores to the one the sender is already showing. The phone uses a uuid here
 * and the server only requires it to be non-empty and stable per message.
 */
export function relaySendLocalId(): string {
    return syncPlatform().random.randomUUID();
}

/**
 * The body for `POST /v3/sessions/:id/messages`.
 *
 * Separated from the request so the record and its encryption can be tested
 * without a relay — this is the part where being wrong means the receiving
 * machine either cannot read the message or reads a different one.
 */
export async function relaySendBody(
    encryption: Encryption,
    sessionId: string,
    text: string,
    localId: string,
    mode?: { model?: string; modelProviderId?: string; effort?: string },
    files: readonly RelayStoredFile[] = [],
    /** The short label a person sees in place of `text`, for a message the product composed. */
    displayText?: string,
): Promise<string> {
    const session = encryption.getSessionEncryption(sessionId);
    if (!session) throw new Error(t("这段对话无法用当前账号的密钥打开"));

    /*
    The same record the phone writes.

    The model, provider and effort travel with the message rather than being
    written into the session: that is how the phone does it, and it means a
    reader who opens a picker and changes their mind has changed nothing. An
    earlier version left them out on the grounds that they belonged to the
    machine — which was wrong, and left the picker unable to do anything.

     says which client typed it, because the receiving side shows it.
    */
    const record = {
        role: "user" as const,
        content: { type: "text" as const, text },
        meta: {
            sentFrom: "desktop",
            ...(mode ?? {}),
            ...(displayText === undefined ? {} : { displayText }),
        },
    };
    const content = await session.encryptRawRecord(record as never);

    /*
    Files first, then what was said about them.

    Order is the whole of it: the agent reads the stream in sequence, and a
    message asking about a picture that has not arrived yet is a message about
    nothing. They go in one request so the relay keeps them adjacent.
    */
    const random = syncPlatform().random;
    const now = Date.now();
    const staged = [];
    for (const file of files) {
        const fileLocalId = random.randomUUID();
        staged.push({
            localId: fileLocalId,
            content: await session.encryptRawRecord(
                relayFileRecord(file, random.randomUUID(), now) as never,
            ),
        });
    }

    return JSON.stringify({ messages: [...staged, { localId, content }] });
}
