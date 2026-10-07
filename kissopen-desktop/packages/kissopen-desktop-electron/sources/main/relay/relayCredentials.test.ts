import { describe, it, expect } from "vitest";
import { relayCredentialsFetch, type RelayCredentialsSource } from "./relayCredentials";
import { localeSet } from "kissopen-desktop-state/i18n";

// These messages are written in Chinese and asserted as written.
localeSet("zh");

const good = {
    user_id: "u1",
    token: "t1",
    secret: "c2VjcmV0",
    server_url: "https://relay.example.com/",
};

function source(status: number, body: unknown): RelayCredentialsSource {
    return {
        post: async () => ({
            status,
            text: typeof body === "string" ? body : JSON.stringify(body),
        }),
    };
}

describe("relay credentials", () => {
    it("reads the account's identity and normalises the address", async () => {
        const credentials = await relayCredentialsFetch(source(200, good), "u1");
        expect(credentials).toEqual({
            userId: "u1",
            token: "t1",
            secret: "c2VjcmV0",
            serverUrl: "https://relay.example.com",
        });
    });

    // Signing out and back in as somebody else while this is in flight would
    // otherwise connect under the previous account and show a stranger's
    // machines.
    it("refuses an identity for a different account", async () => {
        await expect(relayCredentialsFetch(source(200, good), "u2")).rejects.toThrow("账号已切换");
    });

    it("refuses an address that is not https", async () => {
        const insecure = { ...good, server_url: "http://relay.example.com" };
        await expect(relayCredentialsFetch(source(200, insecure), "u1")).rejects.toThrow("https");
    });

    // Development runs the relay locally, and that has to keep working.
    it("allows a local address", async () => {
        const local = { ...good, server_url: "http://localhost:3005" };
        const credentials = await relayCredentialsFetch(source(200, local), "u1");
        expect(credentials.serverUrl).toBe("http://localhost:3005");
    });

    it("refuses an incomplete answer rather than connecting half-configured", async () => {
        for (const missing of ["user_id", "token", "secret", "server_url"]) {
            const body: Record<string, unknown> = { ...good };
            delete body[missing];
            await expect(relayCredentialsFetch(source(200, body), "u1")).rejects.toThrow("不完整");
        }
    });

    it("reports the status when the server refuses", async () => {
        await expect(relayCredentialsFetch(source(401, {}), "u1")).rejects.toThrow("401");
    });

    it("refuses a body that is not JSON", async () => {
        await expect(relayCredentialsFetch(source(200, "<html>"), "u1")).rejects.toThrow(
            "无法解析",
        );
    });
});
