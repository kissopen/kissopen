/*
The lifetime rules, which are the part that can leak one account into another.

The reader itself is covered elsewhere against real bytes. What is held here
is narrower and harder to get right by inspection: what happens when someone
signs out while the relay is still answering.
*/
import { describe, it, expect, beforeAll } from "vitest";
import { syncPlatformInstall } from "@kissopen/kissopen-sync/platform";
import { nodePlatform } from "@kissopen/kissopen-sync/node";
import { RelayService } from "./relayService";
import type { RelaySnapshot } from "./relayReader";
import type { RelayTransport } from "./relayTransport";
import type { RelayCredentialsSource } from "./relayCredentials";

beforeAll(async () => {
    syncPlatformInstall(await nodePlatform());
});

const SECRET = Buffer.from(new Uint8Array(32).fill(5)).toString("base64url");

function identity(userId: string) {
    return JSON.stringify({
        user_id: userId,
        token: `token-for-${userId}`,
        secret: SECRET,
        server_url: "https://relay.example.com",
    });
}

/** A business server that can be made slow, so a sign-out can race it. */
class FakeAccount implements RelayCredentialsSource {
    userId = "u1";
    gate: Promise<void> = Promise.resolve();
    calls = 0;
    async post() {
        this.calls++;
        await this.gate;
        return { status: 200, text: identity(this.userId) };
    }
}

class FakeRelay implements RelayTransport {
    tokens: string[] = [];
    closed = 0;
    connect({ token }: { token: string }) {
        this.tokens.push(token);
        return { on: () => undefined, close: () => this.closed++ } as never;
    }
    async post() {
        return { status: 200, text: "{}" };
    }
    async get({ path }: { path: string }) {
        if (path === "/v1/machines") return { status: 200, text: JSON.stringify({ machines: [] }) };
        if (path === "/v1/projects") return { status: 200, text: JSON.stringify({ projects: [] }) };
        return { status: 200, text: JSON.stringify({ sessions: [] }) };
    }
}

function service(account = new FakeAccount(), relay = new FakeRelay()) {
    const published: (RelaySnapshot | null)[] = [];
    const reported: string[] = [];
    const subject = new RelayService({
        credentials: account,
        transport: relay,
        publish: (snapshot) => published.push(snapshot),
        arrived: () => undefined,
        active: () => undefined,
        local: { host: "the-test-box", homeDir: "/home/test" },
        cloudBotId: async () => undefined,
        report: (message) => reported.push(message),
    });
    return { subject, account, relay, published, reported };
}

describe("when the desktop reads the relay", () => {
    it("connects with the account's own token", async () => {
        const { subject, relay } = service();
        await subject.start("u1");
        expect(relay.tokens).toEqual(["token-for-u1"]);
        expect(subject.account).toBe("u1");
    });

    // Callers say this on every sign-in check; it must not churn the socket.
    it("does nothing when asked again for the same account", async () => {
        const { subject, account, relay } = service();
        await subject.start("u1");
        await subject.start("u1");
        expect(account.calls).toBe(1);
        expect(relay.tokens).toHaveLength(1);
    });

    it("closes the connection on sign-out and says nobody is reading", async () => {
        const { subject, relay, published } = service();
        await subject.start("u1");
        subject.stop();
        expect(relay.closed).toBe(1);
        expect(subject.account).toBeUndefined();
        // Null, not an empty list: somebody just signed out, which is not the
        // same as an account with nothing in it.
        expect(published.at(-1)).toBeNull();
    });

    /*
     * The one that matters. The relay can still be answering when the person
     * signs out, and publishing that answer would show the previous account's
     * machines to whoever is looking now.
     */
    it("throws away an answer that arrives after sign-out", async () => {
        const { subject, account, relay, published } = service();
        let release: () => void = () => undefined;
        account.gate = new Promise<void>((resolve) => (release = resolve));

        const starting = subject.start("u1");
        subject.stop();
        release();
        await starting;

        expect(subject.account).toBeUndefined();
        expect(relay.tokens).toHaveLength(0);
        expect(published.every((snapshot) => snapshot === null)).toBe(true);
    });

    it("throws away an answer for an account that is no longer signed in", async () => {
        const { subject, account, relay } = service();
        let release: () => void = () => undefined;
        account.gate = new Promise<void>((resolve) => (release = resolve));

        const starting = subject.start("u1");
        account.gate = Promise.resolve();
        account.userId = "u2";
        const second = subject.start("u2");
        release();
        await Promise.all([starting, second]);

        expect(subject.account).toBe("u2");
        expect(relay.tokens).toEqual(["token-for-u2"]);
    });

    it("reports a relay it cannot reach instead of pretending to be connected", async () => {
        const relay = new FakeRelay();
        relay.get = async () => ({ status: 503, text: "{}" });
        const { subject, reported } = service(new FakeAccount(), relay);
        await subject.start("u1");
        expect(subject.account).toBeUndefined();
        expect(reported.join(" ")).toContain("503");
    });
});
