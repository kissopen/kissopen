import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import {
    KISSOPEN_AGENT_TERMINAL_CAPABILITY_PROTOCOL_PREFIX,
    KISSOPEN_AGENT_TERMINAL_PROTOCOL,
    kissopenAgentTerminalBridgeCreate,
    type KissopenAgentTerminalBridge,
} from "./kissopenAgentTerminalBridge";

const capability = "test-capability";
const path = "/v0/workspaces/workspace-1/terminals/terminal-1/attach";

interface Fixture {
    readonly attachTerminal: ReturnType<typeof vi.fn>;
    readonly bridge: KissopenAgentTerminalBridge;
    readonly host: string;
    readonly server: ReturnType<typeof createServer>;
}

const fixtures: Fixture[] = [];

afterEach(async () => {
    await Promise.all(
        fixtures.splice(0).map(
            ({ bridge, server }) =>
                new Promise<void>((resolve) => {
                    bridge.close();
                    server.close(() => resolve());
                }),
        ),
    );
});

async function fixtureCreate(
    options: { readonly capability?: string; readonly expectedHost?: boolean } = {
        capability,
        expectedHost: true,
    },
): Promise<Fixture> {
    const attachTerminal = vi.fn(() => Promise.resolve(new PassThrough()));
    let host: string | undefined;
    const bridge = kissopenAgentTerminalBridgeCreate({
        ...(options.capability ? { capability: options.capability } : {}),
        allowedOrigin: "http://127.0.0.1:5174",
        client: () => Promise.resolve({ attachTerminal }),
        ...(options.expectedHost ? { expectedHost: () => host } : {}),
    });
    const server = createServer();
    server.on("upgrade", (request, socket, head) => bridge.upgrade(request, socket, head));
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    host = `127.0.0.1:${address.port}`;
    const fixture = { attachTerminal, bridge, host, server };
    fixtures.push(fixture);
    return fixture;
}

function connect(
    fixture: Fixture,
    options: {
        readonly capability?: string;
        readonly host?: string;
        readonly origin?: string | null;
    } = {},
): Promise<WebSocket> {
    const protocols = [KISSOPEN_AGENT_TERMINAL_PROTOCOL];
    if (options.capability)
        protocols.push(`${KISSOPEN_AGENT_TERMINAL_CAPABILITY_PROTOCOL_PREFIX}${options.capability}`);
    const headers: Record<string, string> = { host: options.host ?? fixture.host };
    if (options.origin !== null) headers.origin = options.origin ?? "null";
    const socket = new WebSocket(`ws://${fixture.host}${path}`, protocols, { headers });
    return new Promise((resolve, reject) => {
        socket.once("open", () => resolve(socket));
        socket.once("unexpected-response", (_request: IncomingMessage, response) => {
            reject(
                Object.assign(new Error(`Upgrade rejected with ${response.statusCode}`), response),
            );
        });
        socket.once("error", reject);
    });
}

describe("kissopenAgentTerminalBridge", () => {
    it.each([
        ["null", "null"],
        ["missing", null],
        ["file", "file:///Applications/KISSOPEN%202.app/index.html"],
    ] as const)("rejects a %s Origin without the capability", async (_name, origin) => {
        const fixture = await fixtureCreate();

        await expect(connect(fixture, { origin })).rejects.toMatchObject({ statusCode: 403 });
        expect(fixture.attachTerminal).not.toHaveBeenCalled();
    });

    it("rejects a forged Host even with the capability", async () => {
        const fixture = await fixtureCreate();

        await expect(
            connect(fixture, { capability, host: "attacker.example", origin: "null" }),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(fixture.attachTerminal).not.toHaveBeenCalled();
    });

    it("does not derive an allowed Origin from a forged Host", async () => {
        const fixture = await fixtureCreate({});

        await expect(
            connect(fixture, { host: "attacker.example", origin: "http://attacker.example" }),
        ).rejects.toMatchObject({ statusCode: 403 });
        expect(fixture.attachTerminal).not.toHaveBeenCalled();
    });

    it("attaches and reconnects with the packaged renderer capability", async () => {
        const fixture = await fixtureCreate();

        const first = await connect(fixture, { capability, origin: "null" });
        first.close();
        await new Promise<void>((resolve) => first.once("close", () => resolve()));
        const second = await connect(fixture, { capability, origin: "null" });

        expect(fixture.attachTerminal).toHaveBeenCalledTimes(2);
        expect(fixture.attachTerminal).toHaveBeenNthCalledWith(1, "workspace-1", "terminal-1");
        expect(fixture.attachTerminal).toHaveBeenNthCalledWith(2, "workspace-1", "terminal-1");
        second.close();
    });
});
