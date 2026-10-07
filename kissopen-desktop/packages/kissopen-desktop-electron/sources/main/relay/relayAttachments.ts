/*
Putting a file into a conversation that runs somewhere else.

Three steps, and the middle one never touches this account's key material on
the server: ask the relay where to put a blob, PUT the blob there already
encrypted under the session's own blob key, then append a record naming the
ref. The agent on the other end fetches and decrypts it with the same key.

The file is encrypted before it leaves this process. What the relay stores is
bytes it cannot read, which is the same promise every message in the
conversation already makes — an attachment that travelled in the clear would
quietly be the one thing in the account that did not.
*/
import { t } from "kissopen-desktop-state/i18n";
import { encryptBlob } from "@kissopen/kissopen-sync/blob";
import type { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import type { RelayTransport } from "./relayTransport";

/** What the relay answers when asked where to put a blob. */
interface UploadTicket {
    ref: string;
    uploadUrl: string;
    method: "PUT" | "POST";
    /** Required form fields when the store issued a presigned POST policy. */
    formFields?: Record<string, string>;
}

/** One file, as the window hands it over. */
export interface RelayFile {
    readonly name: string;
    readonly mediaType: string;
    readonly bytes: Uint8Array;
    /** Present for an image, so the transcript can size it before it loads. */
    readonly width?: number;
    readonly height?: number;
}

/** What the relay stored, named so a record can point at it. */
export interface RelayStoredFile {
    readonly ref: string;
    readonly name: string;
    readonly size: number;
    readonly width?: number;
    readonly height?: number;
}

/**
 * Encrypts one file and puts it where the relay says.
 *
 * Throws rather than returning a failure: a picture that silently did not
 * arrive is indistinguishable from one the agent chose not to mention, and the
 * reader would have no way to tell those apart.
 */
export async function relayAttachmentUpload(
    transport: RelayTransport,
    credentials: { serverUrl: string; token: string },
    encryption: Encryption,
    sessionId: string,
    file: RelayFile,
): Promise<RelayStoredFile> {
    const blobKey = encryption.getSessionBlobKey(sessionId);
    // Uploading unencrypted would be the one readable thing in an otherwise
    // end-to-end encrypted account, so there is no fallback here.
    if (!blobKey) throw new Error(t("这段对话没有可用的附件密钥"));
    const encrypted = encryptBlob(file.bytes, blobKey);

    const ticket = await requestUpload(
        transport,
        credentials,
        sessionId,
        file.name,
        encrypted.length,
    );
    await putBlob(ticket, encrypted, credentials);
    return {
        ref: ticket.ref,
        name: file.name,
        size: file.bytes.length,
        ...(file.width && file.height ? { width: file.width, height: file.height } : {}),
    };
}

async function requestUpload(
    transport: RelayTransport,
    credentials: { serverUrl: string; token: string },
    sessionId: string,
    filename: string,
    size: number,
): Promise<UploadTicket> {
    const response = await transport.post({
        ...credentials,
        path: `/v1/sessions/${encodeURIComponent(sessionId)}/attachments/request-upload`,
        body: JSON.stringify({ filename, size }),
    });
    // Named separately because they are the two a person can act on: one means
    // pick a smaller file, the other means this conversation is gone.
    if (response.status === 413) throw new Error(t("文件太大"));
    if (response.status === 404) throw new Error(t("找不到这段对话"));
    if (response.status !== 200) throw new Error(t("附件上传准备失败（{status}）", { status: response.status }));
    const ticket = JSON.parse(response.text) as UploadTicket;
    if (!ticket?.ref || !ticket?.uploadUrl) throw new Error(t("附件上传准备的应答不完整"));
    return ticket;
}

/*
The blob itself, to wherever the ticket points.

Two stores answer this, and they want opposite things. Our own server takes a
PUT with the bearer, because it checks that this account is in the session
before it writes. An object store issues a presigned POST whose policy already
carries the authorisation, and sending a bearer there would hand this
account's credential to a third party.
*/
async function putBlob(
    ticket: UploadTicket,
    encrypted: Uint8Array,
    credentials: { serverUrl: string; token: string },
): Promise<void> {
    if (ticket.method === "POST") {
        const form = new FormData();
        for (const [key, value] of Object.entries(ticket.formFields ?? {})) form.append(key, value);
        form.append(
            "file",
            new Blob([encrypted as unknown as BlobPart], { type: "application/octet-stream" }),
            "blob",
        );
        const response = await fetch(ticket.uploadUrl, { method: "POST", body: form });
        if (!response.ok) throw new Error(t("附件上传失败（{status}）", { status: response.status }));
        return;
    }

    const ours = ticket.uploadUrl.startsWith(credentials.serverUrl);
    const response = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream",
            ...(ours ? { Authorization: `Bearer ${credentials.token}` } : {}),
        },
        // A copy of exactly these bytes: a Uint8Array that is a window onto a
        // larger buffer would otherwise send the buffer's trailing bytes too,
        // padding the ciphertext into something that will not open.
        body: new Uint8Array(encrypted),
    });
    if (!response.ok) throw new Error(t("附件上传失败（{status}）", { status: response.status }));
}

/*
The record that puts a stored file into the conversation.

A session event rather than a message: it is a file handed to the agent, and
the agent reads it out of the session stream the same way it reads one a phone
put there.
*/
export function relayFileRecord(file: RelayStoredFile, id: string, now: number) {
    return {
        role: "session" as const,
        content: {
            type: "session" as const,
            data: {
                id,
                time: now,
                role: "user" as const,
                ev: {
                    t: "file" as const,
                    ref: file.ref,
                    name: file.name,
                    size: file.size,
                    // Dimensions only when they are real: the transcript uses
                    // them to size the inline picture before its bytes arrive,
                    // and a zero would collapse it to a filename row.
                    ...(file.width && file.height
                        ? { image: { width: file.width, height: file.height } }
                        : {}),
                },
            },
        },
    };
}
