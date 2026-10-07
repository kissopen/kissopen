import { PassThrough } from "node:stream";
import { request } from "node:http";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    kissopenAgentHttpProxyCreate,
    type KissopenAgentHttpProxyHandle,
} from "./kissopenAgentHttpProxy";
import {
    KISSOPEN_AGENT_TERMINAL_CAPABILITY_PROTOCOL_PREFIX,
    KISSOPEN_AGENT_TERMINAL_PROTOCOL,
} from "./kissopenAgentTerminalBridge";

describe("authenticated WorPar Agent loopback proxy", () => {
    let proxy: KissopenAgentHttpProxyHandle | undefined;

    afterEach(() => proxy?.close());

    it("rejects hostile origins, DNS-rebinding Hosts, text/plain mutations, and bad capabilities", async () => {
        const getWorkspace = vi.fn();
        proxy = await kissopenAgentHttpProxyCreate({ client: { getWorkspace } as never });
        const target = `${proxy.url}/open-in`;
        const expectedHost = new URL(proxy.url).host;

        const hostile = await fetch(target, {
            method: "POST",
            headers: {
                host: expectedHost,
                origin: "https://hostile.example",
                "content-type": "text/plain",
            },
            body: "{}",
        });
        expect(hostile.status).toBe(403);

        expect(
            await requestStatus(target, {
                host: "attacker.example",
                "content-type": "application/json",
            }),
        ).toBe(403);

        const plain = await fetch(target, {
            method: "POST",
            headers: { host: expectedHost, "content-type": "text/plain" },
            body: "{}",
        });
        expect(plain.status).toBe(415);

        const badCapability = new URL(target);
        badCapability.pathname = badCapability.pathname.replace(/^\/[A-Za-z0-9_-]+/, "/wrong");
        const unauthorized = await fetch(badCapability, {
            method: "POST",
            headers: { host: expectedHost, "content-type": "application/json" },
            body: "{}",
        });
        expect(unauthorized.status).toBe(403);
        expect(getWorkspace).not.toHaveBeenCalled();
    });

    it("rejects terminal upgrades with weak origins or missing/wrong capabilities", async () => {
        const attachTerminal = vi.fn(async () => new PassThrough());
        proxy = await kissopenAgentHttpProxyCreate({ client: { attachTerminal } as never });
        const base = new URL(proxy.url);
        const capability = base.pathname.slice(1);
        const socketUrl = `${proxy.url.replace(
            /^http/,
            "ws",
        )}/v0/workspaces/workspace/terminals/terminal/attach`;
        const capabilityProtocol = `${KISSOPEN_AGENT_TERMINAL_CAPABILITY_PROTOCOL_PREFIX}${capability}`;

        for (const origin of [undefined, "null", "file://", `http://${base.host}`]) {
            expect(
                await upgradeStatus(socketUrl, [KISSOPEN_AGENT_TERMINAL_PROTOCOL], origin),
                `origin ${String(origin)}`,
            ).toBe(403);
        }
        expect(
            await upgradeStatus(
                socketUrl,
                [
                    KISSOPEN_AGENT_TERMINAL_PROTOCOL,
                    `${KISSOPEN_AGENT_TERMINAL_CAPABILITY_PROTOCOL_PREFIX}wrong`,
                ],
                "null",
            ),
        ).toBe(403);

        const connected = new WebSocket(
            socketUrl,
            [KISSOPEN_AGENT_TERMINAL_PROTOCOL, capabilityProtocol],
            {
                origin: "null",
            },
        );
        await new Promise<void>((resolve, reject) => {
            connected.once("open", resolve);
            connected.once("error", reject);
        });
        connected.close();
        expect(attachTerminal).toHaveBeenCalledOnce();
        expect(attachTerminal).toHaveBeenCalledWith("workspace", "terminal");
    });
});

function upgradeStatus(
    url: string,
    protocols: string[],
    origin: string | undefined,
): Promise<number> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url, protocols, origin === undefined ? {} : { origin });
        socket.once("unexpected-response", (_request, response) => {
            resolve(response.statusCode ?? 0);
            response.destroy();
        });
        socket.once("open", () => {
            socket.close();
            reject(new Error("WebSocket unexpectedly connected"));
        });
        socket.once("error", () => undefined);
    });
}

function requestStatus(url: string, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
        const outgoing = request(url, { method: "POST", headers }, (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
        });
        outgoing.once("error", reject);
        outgoing.end("{}");
    });
}
