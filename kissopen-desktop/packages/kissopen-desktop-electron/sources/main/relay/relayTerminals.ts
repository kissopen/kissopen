/*
The terminals of a session on another machine, from the main process.

Two halves that look alike but are not. The lifecycle — create, list, resize,
stop — is four ordinary encrypted calls to that session, answered once each.
Attaching is a stream that stays open and carries the daemon's own attach
protocol, which this does not read: ordering, resize barriers, replay and
backpressure are already settled on those bytes, and a second opinion here
would be a second thing to keep true.

The window cannot hold a stream itself — the relay credential and the account
keys live here — so it holds a number, and this holds the stream.

What rides the stream is sealed. The relay carries the session's calls as
bundles it cannot read, and a terminal is the one place a person's secrets
show up in plain text on a screen, so its bytes travel the same way: each
chunk a bundle under the session's own key, carrying the bytes as a base64
field because the payload format is JSON. The machine is asked for this on
open, and one that does not speak it refuses; one that agreed and then sends
a chunk this end cannot open has broken the agreement, and the stream ends
rather than pass bytes of unknown provenance to a terminal.
*/
import { t } from "kissopen-desktop-state/i18n";
import { decodeBase64, encodeBase64 } from "@kissopen/kissopen-sync/crypto/base64";
import type { SessionEncryption } from "@kissopen/kissopen-sync/encryption/sessionEncryption";
import { relayStreamOpen, type RelayStream } from "./relayStream";
import type { RelaySocket } from "./relayTransport";

/** The cipher asked of the machine on open. The one this end speaks. */
const STREAM_CIPHER = "session";

/** One attachment, and how its bytes are sealed and opened. */
interface Attachment {
    readonly stream: RelayStream;
    readonly cipher: SessionEncryption | undefined;
    /** Writes go out in the order they were made, sealing included. */
    writes: Promise<void>;
}

/**
 * What a caller does with the bytes and the endings of attachments.
 *
 * One sink for all of them, so every call says which attachment it is about.
 * The window is on the other side of an IPC boundary, where there is one
 * channel rather than one per terminal.
 */
export interface RelayTerminalListener {
    data(handle: number, chunk: Uint8Array): void;
    closed(handle: number, error?: string): void;
}

/**
 * Every attachment this process is holding, by the number the window knows
 * it as.
 *
 * Numbers rather than the relay's own ids: what crosses to the window is a
 * handle it was given, and a window that could name a stream it was never
 * given one of is a window that can read another surface's terminal.
 */
export class RelayTerminals {
    readonly #streams = new Map<number, Attachment>();
    #next = 1;

    /**
     * Attaches to one terminal on the machine a session runs on.
     *
     * The stream is opened against the session's own method, so the relay
     * routes it to that machine the same way it routes a call, and the
     * machine answers as itself.
     */
    async attach(
        socket: RelaySocket,
        sessionId: string,
        terminalId: string,
        listener: RelayTerminalListener,
        /**
         * The session's own key, under which the stream is sealed. Without
         * it the stream is plain — for a test standing in for the machine;
         * the reader always passes one.
         */
        cipher?: SessionEncryption,
    ): Promise<number> {
        const handle = this.#next++;
        /*
         * Opened in the order they arrive. Opening a chunk may be
         * asynchronous, and two chunks opened side by side could land the
         * wrong way round — which for a terminal is a corrupted screen, not
         * a late one.
         */
        let reads: Promise<void> = Promise.resolve();
        let opened: RelayStream | undefined;
        const stream = await relayStreamOpen(
            socket,
            `${sessionId}:terminalAttach`,
            { terminalId, ...(cipher ? { cipher: STREAM_CIPHER } : {}) },
            {
                data: (chunk) => {
                    if (!cipher) {
                        listener.data(handle, chunk);
                        return;
                    }
                    reads = reads.then(async () => {
                        const plain = await open(cipher, chunk);
                        if (plain) listener.data(handle, plain);
                        else
                            opened?.close(
                                t("这台机器的智能体版本太旧，还不会加密终端；更新它以后再打开"),
                            );
                    });
                },
                closed: (error) => {
                    this.#streams.delete(handle);
                    listener.closed(handle, error);
                },
            },
        );
        opened = stream;
        this.#streams.set(handle, { stream, cipher, writes: Promise.resolve() });
        return handle;
    }

    /**
     * Sends what the reader typed.
     *
     * Resolves once the machine has taken it, which is what makes a reader
     * who is typing faster than the link can carry wait for the link rather
     * than filling this process with keystrokes.
     */
    async write(handle: number, chunk: Uint8Array): Promise<void> {
        const attachment = this.#streams.get(handle);
        if (!attachment) throw new Error(t("这个终端连接已经不在了"));
        const write = attachment.writes.then(async () => {
            const sealed = attachment.cipher ? await seal(attachment.cipher, chunk) : chunk;
            await attachment.stream.write(sealed);
        });
        attachment.writes = write.catch(() => undefined);
        await write;
    }

    /** Lets go of one attachment. The terminal itself lives on without it. */
    close(handle: number): void {
        const attachment = this.#streams.get(handle);
        this.#streams.delete(handle);
        attachment?.stream.close();
    }

    /**
     * Lets go of every attachment.
     *
     * For a window that closed or reloaded: its handles are gone with it, and
     * an attachment nobody can address is a replica nobody is watching.
     */
    closeAll(): void {
        for (const handle of [...this.#streams.keys()]) this.close(handle);
    }
}

/** One chunk as a bundle under the session's key. */
async function seal(cipher: SessionEncryption, chunk: Uint8Array): Promise<Uint8Array> {
    return decodeBase64(await cipher.encryptRaw({ b: encodeBase64(chunk) }));
}

/** The bytes inside one bundle, or nothing when it will not open under this key. */
async function open(
    cipher: SessionEncryption,
    bundle: Uint8Array,
): Promise<Uint8Array | undefined> {
    const value = (await cipher.decryptRaw(encodeBase64(bundle))) as { b?: unknown } | null;
    return typeof value?.b === "string" ? decodeBase64(value.b) : undefined;
}
