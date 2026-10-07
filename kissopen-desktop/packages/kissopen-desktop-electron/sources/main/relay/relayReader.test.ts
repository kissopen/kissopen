/*
The reader, against a relay made of real bytes.

The fake answers with records encrypted under a real account key, using the
same shared core the phone uses, so what is being tested is that this desktop
can actually open what the account holds — not that a mock returned what the
test wanted.
*/
import { describe, it, expect, beforeAll } from "vitest";
import { syncPlatformInstall } from "@kissopen/kissopen-sync/platform";
import { nodePlatform } from "@kissopen/kissopen-sync/node";
import { Encryption } from "@kissopen/kissopen-sync/encryption/encryption";
import { RelayReader, type RelaySnapshot } from "./relayReader";
import { rigMetadataFixture } from "@kissopen/kissopen-sync/testing/rigMetadata";
import type { RelaySocket, RelayTransport } from "./relayTransport";
import type { RelayCredentials } from "./relayCredentials";
import { localeSet } from "kissopen-desktop-state/i18n";

// These messages are written in Chinese and asserted as written.
localeSet("zh");

const SECRET = new Uint8Array(32).fill(3);

let account: Encryption;

beforeAll(async () => {
    syncPlatformInstall(await nodePlatform());
    account = await Encryption.create(SECRET);
});

// Encoded with Buffer rather than the package's own base64, because this runs
// while the module is loading — before beforeAll has installed a platform.
// That the package refuses to work until then is the point of it.
/*
 * What this test pretends the computer is. Deliberately not the hostname any
 * fixture registers, so a machine is only badged as this one when a test says
 * so on purpose.
 */
const LOCAL = { host: "the-test-box", homeDir: "/home/test" };

const credentials: RelayCredentials = {
    userId: "u1",
    token: "t1",
    secret: Buffer.from(SECRET).toString("base64url"),
    serverUrl: "https://relay.example.com",
};

/** A relay the test drives: it answers REST, and it can push updates. */
class FakeRelay implements RelayTransport {
    machines: unknown[] = [];
    projects: unknown[] = [];
    sessions: unknown[] = [];
    paths: string[] = [];
    #handlers = new Map<string, ((payload: unknown) => void)[]>();

    /** Every call made over the socket, in order. */
    calls: { method: string; params: string }[] = [];
    /** What the next call answers with. Refusal is a real answer, so it is here. */
    answer: { ok: boolean; error?: string } = { ok: true };
    /** What a call's result decrypts to, by method name. */
    results = new Map<string, unknown>();

    connect(): RelaySocket {
        const on = (event: string, listener: (payload: never) => void) => {
            const list = this.#handlers.get(event) ?? [];
            list.push(listener as (payload: unknown) => void);
            this.#handlers.set(event, list);
        };
        const rpc = async (method: string, params: string) => {
            this.calls.push({ method, params });
            if (!this.answer.ok) return this.answer as never;
            const verb = method.slice(method.indexOf(":") + 1);
            const sessionId = method.slice(0, method.indexOf(":"));
            const encryption = account.getSessionEncryption(sessionId);
            const result = this.results.has(verb)
                ? await encryption!.encryptRaw(this.results.get(verb))
                : "";
            return { ok: true, result } as never;
        };
        return { on, rpc, close: () => undefined } as unknown as RelaySocket;
    }

    /*
     * Shaped the way the relay really answers, and the two do not agree:
     * /v1/machines returns a bare array, /v1/sessions returns {sessions}.
     * Reading either one the other way yields an empty list rather than an
     * error, which is how this shipped once looking like an account with no
     * machines at all.
     */
    async get({ path }: { path: string }) {
        this.paths.push(path);
        if (path === "/v1/machines") return { status: 200, text: JSON.stringify(this.machines) };
        if (path === "/v1/projects")
            return { status: 200, text: JSON.stringify({ projects: this.projects }) };
        if (path === "/v1/sessions")
            return { status: 200, text: JSON.stringify({ sessions: this.sessions }) };
        return { status: 404, text: "{}" };
    }

    /** What was sent, so a test can read the body that went out. */
    sent: { path: string; body: string }[] = [];

    async post({ path, body }: { path: string; body: string }) {
        this.sent.push({ path, body });
        if (path.endsWith("/attachments/request-upload"))
            return {
                status: 200,
                text: JSON.stringify({
                    ref: "sessions/s-file/attachments/abc",
                    uploadUrl: "https://relay.example.com/blobs/abc",
                    method: "PUT",
                }),
            };
        return { status: 200, text: JSON.stringify({ messages: [] }) };
    }

    emit(event: string, payload: unknown) {
        for (const listener of this.#handlers.get(event) ?? []) listener(payload);
    }
}

/*
Records as the relay stores them, encrypted under the account key.

The defaults are the fields the metadata schemas insist on. They are spelled
out rather than left to the caller so that a test says only what it is about —
and so that a schema growing a new required field fails here once, loudly,
instead of in every test at random.
*/
const SESSION_METADATA = { path: "/w", host: "a-machine" };
const MACHINE_METADATA = {
    host: "a-machine",
    platform: "darwin",
    kissopenCliVersion: "1.0.0",
    kissopenHomeDir: "/home/a/.kissopen",
    homeDir: "/home/a",
};

async function sessionRecord(id: string, metadata: Record<string, unknown>, updatedAt = 1000) {
    await account.initializeSessions(new Map([[id, null]]));
    const encryption = account.getSessionEncryption(id)!;
    return {
        id,
        seq: 1,
        active: true,
        updatedAt,
        metadata: await encryption.encryptMetadata({ ...SESSION_METADATA, ...metadata } as never),
        metadataVersion: 1,
    };
}

async function machineRecord(id: string, metadata: Record<string, unknown>, activeAt = 1000) {
    await account.initializeMachines(new Map([[id, null]]));
    const encryption = account.getMachineEncryption(id)!;
    return {
        id,
        active: true,
        activeAt,
        metadata: await encryption.encryptMetadata({ ...MACHINE_METADATA, ...metadata } as never),
        metadataVersion: 1,
    };
}

/*
A project record, named under the account's own key.

The null data key is the legacy form and the one an account still has for its
older projects, so it is what a test that says nothing about keys gets.
*/
async function projectRecord(id: string, name: string) {
    const encryptor = await account.openEncryption(null);
    const [cipher] = await encryptor.encrypt([{ name, kind: "local" }]);
    return { id, metadata: Buffer.from(cipher!).toString("base64"), dataEncryptionKey: null };
}

async function started(relay: FakeRelay) {
    const reader = new RelayReader(credentials, relay, LOCAL);
    const seen: RelaySnapshot[] = [];
    reader.onChange((snapshot) => seen.push(snapshot));
    await reader.start();
    return { reader, seen };
}

describe("reading the account's relay", () => {
    it("shows the account's machines with their names readable", async () => {
        const relay = new FakeRelay();
        relay.machines = [await machineRecord("m-mac", { host: "mac-studio" })];
        const { reader } = await started(relay);
        const [machine] = reader.snapshot().machines;
        expect(machine.id).toBe("m-mac");
        expect((machine.metadata as { host?: string })?.host).toBe("mac-studio");
    });

    // The cloud workspace is not a special case on the wire: it registers as
    // one more machine, and this desktop should see it the way the phone does.
    it("shows the cloud workspace as one more machine", async () => {
        const relay = new FakeRelay();
        relay.machines = [await machineRecord("m-cloud", { host: "cloud" })];
        relay.sessions = [
            await sessionRecord("s-cloud", { path: "/home/agent", machineId: "m-cloud" }),
        ];
        const { reader } = await started(relay);
        const [session] = reader.snapshot().sessions;
        expect(session.machineId).toBe("m-cloud");
        expect(reader.snapshot().machines.map((m) => m.id)).toContain("m-cloud");
    });

    // Work started on one computer has to be findable from another, which is
    // the whole point of reading this at all.
    it("shows sessions from every machine, newest first", async () => {
        const relay = new FakeRelay();
        relay.sessions = [
            await sessionRecord("s-old", { path: "/a", machineId: "m-mac" }, 10),
            await sessionRecord("s-new", { path: "/b", machineId: "m-win" }, 20),
        ];
        const { reader } = await started(relay);
        expect(reader.snapshot().sessions.map((s) => s.id)).toEqual(["s-new", "s-old"]);
    });

    it("lists the machines before the sessions that name them", async () => {
        const relay = new FakeRelay();
        await started(relay);
        expect(relay.paths).toEqual(["/v1/machines", "/v1/projects", "/v1/sessions"]);
    });

    it("adds a session the relay announces while connected", async () => {
        const relay = new FakeRelay();
        const { reader } = await started(relay);
        expect(reader.snapshot().sessions).toHaveLength(0);
        relay.emit("update", {
            body: { t: "new-session", session: await sessionRecord("s-fresh", { path: "/c" }) },
        });
        await new Promise((resolve) => setImmediate(resolve));
        expect(reader.snapshot().sessions.map((s) => s.id)).toEqual(["s-fresh"]);
    });

    it("removes a session the relay says is gone", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-doomed", { path: "/d" })];
        const { reader } = await started(relay);
        relay.emit("update", { body: { t: "delete-session", id: "s-doomed" } });
        await new Promise((resolve) => setImmediate(resolve));
        expect(reader.snapshot().sessions).toHaveLength(0);
    });

    // The relay carries every kind of change the account can make, including
    // ones this version has no opinion about. Falling over on one would take
    // the rest of the stream down with it.
    it("ignores an update it does not understand", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-keep", { path: "/e" })];
        const { reader } = await started(relay);
        relay.emit("update", { body: { t: "something-from-a-newer-build" } });
        relay.emit("update", { nonsense: true });
        relay.emit("update", null);
        await new Promise((resolve) => setImmediate(resolve));
        expect(reader.snapshot().sessions.map((s) => s.id)).toEqual(["s-keep"]);
    });

    // Hiding it would make a conversation that exists look like one that does
    // not, which is worse than showing it without a name.
    it("keeps a session whose metadata will not open, without a name", async () => {
        const relay = new FakeRelay();
        const foreign = await Encryption.create(new Uint8Array(32).fill(9));
        await foreign.initializeSessions(new Map([["s-foreign", null]]));
        relay.sessions = [
            {
                id: "s-foreign",
                seq: 1,
                active: true,
                updatedAt: 5,
                metadata: await foreign
                    .getSessionEncryption("s-foreign")!
                    .encryptMetadata({ ...SESSION_METADATA, path: "/secret" } as never),
                metadataVersion: 1,
            },
        ];
        const { reader } = await started(relay);
        const [session] = reader.snapshot().sessions;
        expect(session.id).toBe("s-foreign");
        expect(session.metadata).toBeNull();
    });

    /*
     * Both shapes, because the relay uses both and may well change which. The
     * cost of guessing wrong is silence: an empty list reads as an account
     * with one computer, and nobody goes looking for a bug in that.
     */
    it("reads a list whether it arrives bare or under a name", async () => {
        for (const bare of [true, false]) {
            const relay = new FakeRelay();
            const record = await machineRecord("m1", { host: "box" });
            relay.get = async ({ path }: { path: string }) => ({
                status: 200,
                text:
                    path === "/v1/machines"
                        ? JSON.stringify(bare ? [record] : { machines: [record] })
                        : path === "/v1/projects"
                          ? JSON.stringify({ projects: [] })
                          : JSON.stringify({ sessions: [] }),
            });
            const { reader } = await started(relay);
            expect(reader.snapshot().machines.map((m) => m.id)).toEqual(["m1"]);
        }
    });

    /*
     * What remote control lists on a machine's card. A project record does not
     * say which machine it is on — nothing in it could — so the sessions that
     * name both are what place it.
     */
    it("places a project on the machine its sessions are on, by name", async () => {
        const relay = new FakeRelay();
        relay.machines = [await machineRecord("m-mac", { host: "mac-studio" })];
        relay.projects = [await projectRecord("p-kiss", "kissopen")];
        relay.sessions = [
            await sessionRecord("s1", { path: "/w", machineId: "m-mac" }, 10),
            await sessionRecord("s2", { path: "/w", machineId: "m-mac" }, 20),
        ];
        relay.sessions = relay.sessions.map((session) => ({
            ...(session as object),
            projectId: "p-kiss",
        }));
        const { reader } = await started(relay);
        const [project] = reader.snapshot().projects;
        expect(project.id).toBe("p-kiss");
        expect(project.name).toBe("kissopen");
        expect(project.machineId).toBe("m-mac");
        expect(project.sessions).toBe(2);
    });

    // The same project opened on two computers is two rows, because it is two
    // places a reader can go — and only the sessions say where those are.
    it("lists one project once per machine it is worked on", async () => {
        const relay = new FakeRelay();
        relay.projects = [await projectRecord("p-kiss", "kissopen")];
        relay.sessions = [
            {
                ...(await sessionRecord("s-mac", { path: "/w", machineId: "m-mac" })),
                projectId: "p-kiss",
            },
            {
                ...(await sessionRecord("s-win", { path: "/w", machineId: "m-win" })),
                projectId: "p-kiss",
            },
        ];
        const { reader } = await started(relay);
        expect(
            reader
                .snapshot()
                .projects.map((p) => p.machineId)
                .sort(),
        ).toEqual(["m-mac", "m-win"]);
    });

    // A project whose name will not open is not a project called "Untitled":
    // the card says it cannot be read, and the row still leads somewhere.
    it("keeps a project whose name will not open, without a name", async () => {
        const relay = new FakeRelay();
        const foreign = await Encryption.create(new Uint8Array(32).fill(8));
        const encryptor = await foreign.openEncryption(null);
        const [cipher] = await encryptor.encrypt([{ name: "secret", kind: "local" }]);
        relay.projects = [
            {
                id: "p-foreign",
                metadata: Buffer.from(cipher!).toString("base64"),
                dataEncryptionKey: null,
            },
        ];
        relay.sessions = [
            {
                ...(await sessionRecord("s-f", { path: "/w", machineId: "m-mac" })),
                projectId: "p-foreign",
            },
        ];
        const { reader } = await started(relay);
        const [project] = reader.snapshot().projects;
        expect(project.id).toBe("p-foreign");
        expect(project.name).toBeNull();
    });

    // An answer that is neither shape is a failure, not an empty account.
    it("refuses an answer that is not a list at all", async () => {
        const relay = new FakeRelay();
        relay.get = async () => ({ status: 200, text: JSON.stringify({ unexpected: true }) });
        const reader = new RelayReader(credentials, relay, LOCAL);
        await expect(reader.start()).rejects.toThrow("不是列表");
    });

    /*
     * The first write path. The relay authorises sending on the account alone,
     * so this desktop may talk to one of the person's machines exactly as
     * their phone does — what is held here is that it sends the right thing to
     * the right place, and that the machine on the other end can read it.
     */
    it("says something in a conversation on another machine", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-mac", { machineId: "m-mac" })];
        const { reader } = await started(relay);

        await reader.say("s-mac", "在 Windows 上接着说");

        expect(relay.sent).toHaveLength(1);
        expect(relay.sent[0].path).toBe("/v3/sessions/s-mac/messages");

        // The body is opened with the account's own key, the way the receiving
        // machine will open it. Anything less would test JSON, not a message.
        const body = JSON.parse(relay.sent[0].body) as {
            messages: { localId: string; content: string }[];
        };
        expect(body.messages).toHaveLength(1);
        expect(body.messages[0].localId).toBeTruthy();
        const decrypted = await account.getSessionEncryption("s-mac")!.decryptMessages([
            {
                id: "echo",
                seq: 1,
                localId: null,
                content: { t: "encrypted", c: body.messages[0].content },
                createdAt: 1,
                updatedAt: 1,
            },
        ] as never);
        expect(decrypted[0]?.content).toMatchObject({
            role: "user",
            content: { type: "text", text: "在 Windows 上接着说" },
        });
    });

    it("reports a refused send rather than pretending it went", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-mac", { machineId: "m-mac" })];
        const { reader } = await started(relay);
        relay.post = async () => ({ status: 403, text: "{}" });
        await expect(reader.say("s-mac", "会被拒绝")).rejects.toThrow("403");
    });

    // The window is showing a transcript; a message arriving on the machine it
    // came from has to reach it, or a conversation goes quiet after one reply.
    it("says which conversation gained a message", async () => {
        const relay = new FakeRelay();
        const { reader } = await started(relay);
        const heard: string[] = [];
        reader.onArrival((sessionId) => heard.push(sessionId));
        relay.emit("update", { body: { t: "new-message", sid: "s-mac", message: {} } });
        expect(heard).toEqual(["s-mac"]);
    });

    it("reports a relay that refuses rather than showing an empty account", async () => {
        const relay = new FakeRelay();
        relay.get = async () => ({ status: 401, text: "{}" });
        const reader = new RelayReader(credentials, relay, LOCAL);
        await expect(reader.start()).rejects.toThrow("401");
    });
});

/*
The three things a reader can ask of the machine a conversation runs on.

Each one is a shape the agent on the other end reads. A field spelled
differently here would fail as "nothing happened": the agent would keep
waiting, and this desktop would look like it had done its part.
*/
describe("asking the machine a conversation runs on", () => {
    it("answers a permission under the request's own key", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-ask", { path: "/w" })];
        const { reader } = await started(relay);
        await reader.decide("s-ask", "agent-7:tool-3", true);

        const [call] = relay.calls;
        expect(call.method).toBe("s-ask:permission");
        const sent = await account.getSessionEncryption("s-ask")!.decryptRaw(call.params);
        expect(sent).toEqual({ id: "agent-7:tool-3", approved: true, decision: "approved" });
    });

    it("says denied both ways, because the CLI reads both", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-deny", { path: "/w" })];
        const { reader } = await started(relay);
        await reader.decide("s-deny", "req-1", false);
        const sent = await account
            .getSessionEncryption("s-deny")!
            .decryptRaw(relay.calls[0].params);
        expect(sent).toEqual({ id: "req-1", approved: false, decision: "denied" });
    });

    /*
     * The reason is not decoration: the agent puts it into the transcript as
     * the tool result, and it is what the next turn reads to find out why it
     * was interrupted.
     */
    it("stops a run with the reason the agent will record", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-stop", { path: "/w" })];
        const { reader } = await started(relay);
        await reader.abort("s-stop");
        expect(relay.calls[0].method).toBe("s-stop:abort");
        const sent = (await account
            .getSessionEncryption("s-stop")!
            .decryptRaw(relay.calls[0].params)) as { reason?: string };
        expect(sent.reason).toContain("STOP what you are doing");
    });

    /*
     * A refusal has to arrive as one. The reader pressed a control, and a
     * machine that will not do it is something to say out loud — silence here
     * reads as "it worked".
     */
    it("reports a machine that refuses", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-no", { path: "/w" })];
        const { reader } = await started(relay);
        relay.answer = { ok: false, error: "机器拒绝了" };
        await expect(reader.decide("s-no", "req-1", true)).rejects.toThrow("机器拒绝了");
    });

    // Not a silent no-op: on the other end an agent is blocked waiting for
    // this, and a control that quietly did nothing is worse than none.
    it("refuses to answer for a session this account cannot open", async () => {
        const relay = new FakeRelay();
        const { reader } = await started(relay);
        await expect(reader.decide("s-nowhere", "req-1", true)).rejects.toThrow(
            "无法用当前账号的密钥打开",
        );
    });
});

/*
A file on its way into a conversation on another machine.

What matters is that the bytes leave this process already encrypted, and that
the record naming them arrives before the message that talks about them. The
agent reads the stream in order: a question about a picture that has not
arrived yet is a question about nothing.
*/
describe("putting a file into a conversation elsewhere", () => {
    it("uploads the bytes encrypted, then names them ahead of the message", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-file", { path: "/w" })];
        const { reader } = await started(relay);

        const plain = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const uploaded: Uint8Array[] = [];
        const realFetch = globalThis.fetch;
        globalThis.fetch = (async (_url: unknown, init: { body?: unknown }) => {
            uploaded.push(new Uint8Array(init.body as ArrayBufferView["buffer"] as never));
            return { ok: true, status: 200 } as never;
        }) as never;
        try {
            await reader.say("s-file", "看看这个", undefined, [
                { name: "shot.png", mediaType: "image/png", bytes: plain, width: 4, height: 2 },
            ]);
        } finally {
            globalThis.fetch = realFetch;
        }

        // Nothing readable left this process: what went to the store is
        // longer than the file and shares none of its opening bytes.
        expect(uploaded).toHaveLength(1);
        expect(uploaded[0].length).toBeGreaterThan(plain.length);
        expect(Array.from(uploaded[0].slice(0, plain.length))).not.toEqual(Array.from(plain));

        const send = relay.sent.find((request) => request.path.includes("/v3/sessions/"))!;
        const { messages } = JSON.parse(send.body) as { messages: { content: string }[] };
        expect(messages).toHaveLength(2);
        const encryption = account.getSessionEncryption("s-file")!;
        const first = (await encryption.decryptRaw(messages[0].content)) as {
            content: { data: { ev: { t: string; ref: string; image?: unknown } } };
        };
        expect(first.content.data.ev.t).toBe("file");
        expect(first.content.data.ev.ref).toBe("sessions/s-file/attachments/abc");
        expect(first.content.data.ev.image).toEqual({ width: 4, height: 2 });
        const second = (await encryption.decryptRaw(messages[1].content)) as {
            content: { text: string };
        };
        expect(second.content.text).toBe("看看这个");
    });

    /*
     * A picture that silently did not arrive is indistinguishable from one the
     * agent chose not to mention. Better to fail the whole send: the reader
     * still has their words and their file.
     */
    it("fails the send when the file will not go", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-fail", { path: "/w" })];
        const { reader } = await started(relay);
        const realFetch = globalThis.fetch;
        globalThis.fetch = (async () => ({ ok: false, status: 500 }) as never) as never;
        try {
            await expect(
                reader.say("s-fail", "看看", undefined, [
                    { name: "a.png", mediaType: "image/png", bytes: new Uint8Array([1]) },
                ]),
            ).rejects.toThrow("附件上传失败");
        } finally {
            globalThis.fetch = realFetch;
        }
        expect(relay.sent.some((request) => request.path.includes("/v3/sessions/"))).toBe(false);
    });
});

/*
A checkout on another machine.

The reading itself is the shared module's — the same one the phone uses, so a
change looks the same on both. What these hold is the join: that this desktop
asks under the session's own key, refuses a session that does not offer its
files, and hands the answer back whole.
*/
describe("reading another machine's checkout", () => {
    const BASE = "a".repeat(40);

    /** Metadata for a session that advertises the whole Git surface. */
    const gitCapable = {
        ...rigMetadataFixture,
        capabilities: {
            ...rigMetadataFixture.capabilities!,
            files: { ...rigMetadataFixture.capabilities!.files, read: true },
            rpcMethods: [
                ...rigMetadataFixture.capabilities!.rpcMethods,
                "gitState",
                "readFileAtRevision",
            ],
        },
    };

    it("asks the session for its Git state and hands back what it said", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-git", gitCapable as never)];
        const { reader } = await started(relay);
        relay.results.set("gitState", {
            success: true,
            git: {
                facts: {
                    branch: "main",
                    detached: false,
                    head: BASE,
                    upstream: null,
                    ahead: 0,
                    behind: 0,
                },
                comparison: "ready",
                base: BASE,
                changedFiles: 1,
                insertions: 2,
                deletions: 0,
                countsExact: true,
                conflicted: false,
                files: [
                    {
                        path: "src/a.ts",
                        status: "modified",
                        staged: false,
                        unstaged: true,
                        binary: false,
                    },
                ],
                filesTruncated: false,
                scannedAt: 1,
            },
        });

        const git = await reader.gitState("s-git");
        expect(relay.calls[0].method).toBe("s-git:gitState");
        expect(git.base).toBe(BASE);
        expect(git.files.map((file) => file.path)).toEqual(["src/a.ts"]);
    });

    /*
     * A machine whose agent does not offer its files is an ordinary thing to
     * meet. It is refused here rather than asked and left waiting for an
     * answer that is never coming.
     */
    it("refuses a session that does not offer its files", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-plain", { path: "/w" })];
        const { reader } = await started(relay);
        await expect(reader.gitState("s-plain")).rejects.toThrow("not available");
        expect(relay.calls).toHaveLength(0);
    });

    // Both sides of a change, each read under the session's own key.
    it("reads the two sides of one changed file", async () => {
        const relay = new FakeRelay();
        relay.sessions = [await sessionRecord("s-file2", gitCapable as never)];
        const { reader } = await started(relay);
        relay.results.set("readFileAtRevision", {
            success: true,
            content: Buffer.from("before\n").toString("base64"),
        });
        relay.results.set("readFile", {
            success: true,
            content: Buffer.from("after\n").toString("base64"),
            hash: "b".repeat(64),
        });

        const content = await reader.gitFile("s-file2", BASE, {
            path: "src/a.ts",
            status: "modified",
            staged: false,
            unstaged: true,
            binary: false,
        });
        expect(content).toEqual({ kind: "text", oldText: "before\n", newText: "after\n" });
    });
});
