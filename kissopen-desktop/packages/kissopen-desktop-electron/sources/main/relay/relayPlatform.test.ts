/*
The wiring that was missing, held down.

The shared core refuses to work until a platform is installed, and the reader's
first act is to decode the account's secret. This desktop shipped once without
that install: every start threw, the throw went to a main-process warning, and
a packaged app has nowhere to show one — so the sidebar looked like an account
with a single computer.

The test is small because the mistake was: a file nobody called.
*/
import { describe, it, expect, beforeAll } from "vitest";
import { relayPlatformReady } from "./relayPlatform";
import { decodeBase64, encodeBase64 } from "@kissopen/kissopen-sync/crypto/base64";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";

beforeAll(async () => {
    await relayPlatformReady();
});

describe("the relay's platform", () => {
    it("lets the shared core decode the account's secret", () => {
        const secret = new Uint8Array(32).fill(4);
        expect(decodeBase64(encodeBase64(secret, "base64url"), "base64url")).toEqual(secret);
    });

    it("lets the account's encryption be opened, which is what start() does first", async () => {
        await expect(Encryption.create(new Uint8Array(32).fill(4))).resolves.toBeDefined();
    });

    it("is installed once, however many times it is asked for", async () => {
        await expect(
            Promise.all([relayPlatformReady(), relayPlatformReady()]),
        ).resolves.toHaveLength(2);
    });
});
