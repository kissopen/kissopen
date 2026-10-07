/*
The shared core resolves here and agrees with the phone.

A small test on purpose. What it is guarding is not a behaviour but a wiring:
that this workspace can reach @kissopen/kissopen-sync at all, and that the
platform it installs produces bytes the other clients accept. Everything the
relay client is about to be built on sits behind that.
*/
import { describe, it, expect, beforeAll } from "vitest";
import { syncPlatformInstall } from "@kissopen/kissopen-sync/platform";
import { nodePlatform } from "@kissopen/kissopen-sync/node";
import { encryptAESGCMString, decryptAESGCMString } from "@kissopen/kissopen-sync/crypto/aes";
import { encodeBase64, decodeBase64 } from "@kissopen/kissopen-sync/crypto/base64";
import { createReducer } from "@kissopen/kissopen-sync/reducer/reducer";

beforeAll(async () => {
    syncPlatformInstall(await nodePlatform());
});

describe("the shared relay core, from the desktop workspace", () => {
    it("round-trips through AES in the format every client uses", async () => {
        const key = encodeBase64(new Uint8Array(32).fill(7));
        const sealed = await encryptAESGCMString("在电脑上接着干", key);
        expect(await decryptAESGCMString(sealed, key)).toBe("在电脑上接着干");
        // 12-byte nonce + ciphertext + 16-byte tag, the layout the phone's
        // native module emits.
        expect(decodeBase64(sealed).length).toBe(12 + new TextEncoder().encode("在电脑上接着干").length + 16);
    });

    it("refuses base64 that is not base64, as the other clients do", () => {
        expect(() => decodeBase64("invalid base64!")).toThrow();
    });

    it("exposes the reducer the conversation is built with", () => {
        expect(typeof createReducer).toBe("function");
    });
});
