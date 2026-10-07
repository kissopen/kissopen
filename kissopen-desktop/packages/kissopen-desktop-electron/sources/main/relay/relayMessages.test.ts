/*
Reading one conversation, against real ciphertext.

The messages are encrypted with the same shared core the phone writes them
with, so what is held here is that this desktop can open what another machine
wrote — not that a mock returned the expected shape.
*/
import { describe, it, expect, beforeAll } from "vitest";
import { syncPlatformInstall } from "@kissopen/kissopen-sync/platform";
import { nodePlatform } from "@kissopen/kissopen-sync/node";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import { relayMessagesRead } from "./relayMessages";
import type { Message } from "@kissopen/kissopen-sync/typesMessage";
import { localeSet } from "kissopen-desktop-state/i18n";

// These messages are written in Chinese and asserted as written.
localeSet("zh");

/** The text of a row, for tests that are about what was said. */
const said = (messages: readonly Message[]) =>
    messages.flatMap((message) =>
        message.kind === "user-text" || message.kind === "agent-text" ? [message.text] : [],
    );

const SECRET = new Uint8Array(32).fill(8);
const SESSION = "s-remote";

/*
 * Ids are unique per case on purpose. The shared encryption keeps a cache by
 * message id, so reusing one across tests hands the second test the first
 * test's plaintext — which looked like a decoding bug and was not.
 */

let account: Encryption;

beforeAll(async () => {
    syncPlatformInstall(await nodePlatform());
    account = await Encryption.create(SECRET);
    await account.initializeSessions(new Map([[SESSION, null]]));
});

/*
One stored message, in the envelope the relay really holds.

`{t: 'encrypted', c: <base64>}` — not a bare string. Building it here rather
than taking a shortcut is the point: reading it as a string decrypted every
message to null, with no error anywhere to say so.
*/
async function stored(id: string, createdAt: number, record: Record<string, unknown>) {
    const encryption = account.getSessionEncryption(SESSION)!;
    return {
        id,
        seq: 1,
        localId: null,
        content: { t: "encrypted", c: await encryption.encryptRaw(record) },
        createdAt,
        updatedAt: createdAt,
    };
}

/** A user message, in the record shape the schema actually defines. */
const userSaid = (text: string) => ({ role: "user", content: { type: "text", text } });

describe("reading a conversation from the relay", () => {
    it("opens what another machine wrote", async () => {
        const body = { messages: [await stored("open-1", 100, userSaid("在 mac 上写的"))] };
        const { messages } = await relayMessagesRead(account, SESSION, body);
        expect(said(messages)).toContain("在 mac 上写的");
    });

    /*
     * The relay answers newest-first, because that is the cheap end of its
     * index. A conversation reads the other way, and the reducer wants them in
     * the order they happened.
     */
    it("puts the conversation back in the order it happened", async () => {
        const body = {
            messages: [
                await stored("order-2", 200, userSaid("第二句")),
                await stored("order-1", 100, userSaid("第一句")),
            ],
        };
        const { messages } = await relayMessagesRead(account, SESSION, body);
        const spoken = said(messages).filter(Boolean);
        expect(spoken.indexOf("第一句")).toBeLessThan(spoken.indexOf("第二句"));
    });

    // An empty conversation and one this account cannot open are different
    // things, and only one of them is worth showing as a transcript.
    it("refuses a session whose key this account does not hold", async () => {
        await expect(relayMessagesRead(account, "s-unknown", { messages: [] })).rejects.toThrow(
            "无法用当前账号的密钥打开",
        );
    });

    it("refuses an answer that is not a list", async () => {
        await expect(relayMessagesRead(account, SESSION, { nope: true })).rejects.toThrow(
            "不是列表",
        );
    });

    // Records this build has no opinion about are skipped, not fatal: a
    // conversation is worth reading even where one row is from a newer client.
    it("skips a record it cannot make sense of, and keeps the rest", async () => {
        const body = {
            messages: [
                await stored("skip-1", 100, userSaid("看得懂的")),
                // A user record whose content is a shape this build does not
                // know. The role is one it does, so this is the realistic
                // case: a newer client writing a richer body.
                await stored("skip-2", 200, {
                    role: "user",
                    content: { type: "future", payload: 1 },
                }),
            ],
        };
        const { messages } = await relayMessagesRead(account, SESSION, body);
        expect(said(messages)).toContain("看得懂的");
    });

    it("reads an empty conversation as empty rather than failing", async () => {
        const read = await relayMessagesRead(account, SESSION, { messages: [] });
        expect(read.messages).toEqual([]);
        // No provider has measured this conversation, which is not the same as
        // one that has spent nothing: the gauge shows the window instead of a
        // zero it would have made up.
        expect(read.usage).toBeUndefined();
    });
});
