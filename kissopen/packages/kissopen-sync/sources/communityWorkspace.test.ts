import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityAuthClient } from "./communityAuth";
import { communityWorkspaceConnect, communityWorkspaceDeliver, CommunityWorkspaceUnavailableError } from "./communityWorkspace";
import { syncPlatformInstall } from "./platform";
import { nodePlatform } from "./platformNode";
import { encryptBox } from "./crypto/libsodium";

describe("encrypted cross-device account bootstrap", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("restores an escrowed seed without a peer and sends no plaintext key", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const seed = new Uint8Array(32).fill(42);
        const publicKey = Buffer.from(platform.sodium.crypto_sign_seed_keypair(seed).publicKey).toString("hex");
        const secret = platform.base64.encodeBase64(seed, "base64url");
        let saved = false;
        const requests: object[] = [];
        vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
            const body = init.body ? JSON.parse(init.body as string) : undefined;
            if (body) requests.push(body);
            const response = (value: object) => new Response(JSON.stringify(value));
            if (input.endsWith("/session")) return response({ status: "ready", identityId: "owner", publicKey,
                envelope: platform.base64.encodeBase64(encryptBox(seed, platform.base64.decodeBase64(body.recipientKey))), workspaceToken: "test-only-relay" });
            throw new Error("An escrowed login must not use peer transfer routes.");
        }));
        const result = await communityWorkspaceConnect({
            client: new CommunityAuthClient("https://example.com"), token: "phone", identityId: "owner", signal: new AbortController().signal,
            read: async () => null, save: async value => { expect(value).toBe(secret); saved = true; },
        });
        expect(result.secret).toBe(secret);
        expect(result.workspaceToken).toBe("test-only-relay");
        expect(saved).toBe(true);
        expect(JSON.stringify(requests)).not.toContain(secret);
        expect(JSON.stringify(requests)).not.toContain(Buffer.from(seed).toString("base64"));
    });
    it("refuses a saved key from a different workspace without replacing it", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const save = vi.fn();
        vi.stubGlobal("fetch", async (_input: string, init: RequestInit) => new Response(JSON.stringify({
            status: "restore_required", identityId: "owner", publicKey: "ff".repeat(32),
        })));
        await expect(communityWorkspaceConnect({
            client: new CommunityAuthClient("https://example.com"), token: "phone", identityId: "owner", signal: new AbortController().signal,
            read: async () => platform.base64.encodeBase64(new Uint8Array(32).fill(1), "base64url"), save,
        })).rejects.toThrow("does not belong");
        expect(save).not.toHaveBeenCalled();
    });
    it("reuses a previous QR key only when it matches the authenticated account", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const seed = new Uint8Array(32).fill(7);
        const secret = platform.base64.encodeBase64(seed, "base64url");
        const publicKey = Buffer.from(platform.sodium.crypto_sign_seed_keypair(seed).publicKey).toString("hex");
        const save = vi.fn();
        let imported = false;
        const fetch = vi.fn(async (input: string, init: RequestInit) => {
            const body = JSON.parse(init.body as string);
            if (input.endsWith('/escrow')) {
                expect(body.secret).toBe(secret); imported = true;
                return new Response(JSON.stringify({ identityId: 'owner', publicKey }));
            }
            return new Response(JSON.stringify(imported ? { status: 'ready', identityId: 'owner', publicKey,
                envelope: platform.base64.encodeBase64(encryptBox(seed, platform.base64.decodeBase64(body.recipientKey))), workspaceToken: 'test-only-relay' }
                : { status: 'restore_required', identityId: 'owner', publicKey }));
        });
        vi.stubGlobal("fetch", fetch);
        const result = await communityWorkspaceConnect({
            client: new CommunityAuthClient("https://example.com"), token: "phone", identityId: "owner", signal: new AbortController().signal,
            read: async () => null, readLegacy: async () => secret, save,
        });
        expect(result.secret).toBe(secret);
        expect(save).toHaveBeenCalledWith(secret);
        expect(fetch).toHaveBeenCalledTimes(3);
    });
    it("does not publish a previous QR key from a different account", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const save = vi.fn();
        vi.stubGlobal("fetch", async (input: string, init: RequestInit) => new Response(JSON.stringify(input.endsWith('/session') ?
            { status: 'restore_required', identityId: 'owner', publicKey: 'ff'.repeat(32) } : {
            id: "a".repeat(43), recipientKey: JSON.parse(init.body as string).recipientKey,
            publicKey: "ff".repeat(32), challenge: Buffer.alloc(32, 4).toString("base64url"), expiresAt: new Date(Date.now() - 1).toISOString(),
        })));
        await expect(communityWorkspaceConnect({
            client: new CommunityAuthClient("https://example.com"), token: "phone", identityId: "owner", signal: new AbortController().signal,
            read: async () => null, readLegacy: async () => platform.base64.encodeBase64(new Uint8Array(32).fill(7), "base64url"), save,
        })).rejects.toThrow("Existing history has been preserved");
        expect(save).not.toHaveBeenCalled();
    });
    it("treats an expired peer ticket as recoverable, without revoking the account or overwriting history", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const save = vi.fn();
        const paths: string[] = [];
        vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
            paths.push(input);
            if (input.endsWith('/session')) return new Response(JSON.stringify({ status: 'restore_required', identityId: 'owner', publicKey: 'ff'.repeat(32) }));
            if (input.endsWith('/open')) return new Response(JSON.stringify({
                id: 'a'.repeat(43), recipientKey: JSON.parse(init.body as string).recipientKey,
                publicKey: 'ff'.repeat(32), challenge: Buffer.alloc(32, 4).toString('base64url'),
                expiresAt: new Date(Date.now() + 10000).toISOString(),
            }));
            return new Response(JSON.stringify({ error: 'Connection request expired.' }), { status: 410 });
        });
        await expect(communityWorkspaceConnect({
            client: new CommunityAuthClient('https://example.com'), token: 'phone', identityId: 'owner', signal: new AbortController().signal,
            read: async () => null, save,
        })).rejects.toMatchObject({ reason: 'peer-required', constructor: CommunityWorkspaceUnavailableError });
        expect(save).not.toHaveBeenCalled();
        expect(paths).toHaveLength(4);
        expect(paths.some(path => path.includes('sign-out') || path.endsWith('/complete'))).toBe(false);
    });
    it("rejects an incomplete recovery key before saving or completing the workspace", async () => {
        const platform = await nodePlatform(); syncPlatformInstall(platform);
        const save = vi.fn();
        const fetch = vi.fn(async (_input: string, init: RequestInit) => new Response(JSON.stringify({
            status: 'restore_required', identityId: 'owner', publicKey: 'ff'.repeat(32),
        })));
        vi.stubGlobal('fetch', fetch);
        await expect(communityWorkspaceConnect({
            client: new CommunityAuthClient('https://example.com'), token: 'phone', identityId: 'owner', signal: new AbortController().signal,
            read: async () => platform.base64.encodeBase64(new Uint8Array(16), 'base64url'), save,
        })).rejects.toThrow('recovery key is incomplete');
        expect(save).not.toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
