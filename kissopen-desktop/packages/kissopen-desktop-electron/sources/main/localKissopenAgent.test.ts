import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KissopenAgentDaemonClient } from "./kissopenAgentDaemonClient";
import {
    localKissopenAgentConnectorCreate,
    type KissopenAgentProcessHost,
} from "./localKissopenAgent";

const directories: string[] = [];
afterEach(async () => {
    await Promise.all(
        directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
});

describe("local WorPar Agent connection", () => {
    it("connects to an exact daemon named by KISSOPEN_AGENT_SERVER_SOCKET_PATH and KISSOPEN_AGENT_SERVER_TOKEN_PATH, never discovering or starting WorPar Agent", async () => {
        const root = await mkdtemp(join(tmpdir(), "kissopen-local-kissopen-agent-"));
        directories.push(root);
        const tokenPath = join(root, "token");
        const socketPath = join(root, "server.sock");
        await writeFile(tokenPath, "existing-token\n");
        const host: KissopenAgentProcessHost = {
            execFile: vi.fn(async () => {
                throw new Error("A running daemon must not trigger command discovery.");
            }),
        };
        const health = vi.fn().mockResolvedValue({
            status: "ready",
            healthy: true,
            ready: true,
            version: { daemon: "0.2.19", protocol: 17 },
        });
        const clientCreate = vi.fn(() => ({ health }) as unknown as KissopenAgentDaemonClient);
        const wait = vi.fn(async () => undefined);
        const connector = localKissopenAgentConnectorCreate({
            host,
            environment: {
                KISSOPEN_AGENT_SERVER_SOCKET_PATH: socketPath,
                KISSOPEN_AGENT_SERVER_TOKEN_PATH: tokenPath,
                SHELL: "/bin/zsh",
            },
            configuredShell: "/bin/zsh",
            clientCreate,
            wait,
        });

        const connection = await connector.connect();

        expect(connection.version).toBe("0.2.19");
        expect(clientCreate).toHaveBeenCalledWith({
            socketPath,
            token: "existing-token",
        });
        expect(health).toHaveBeenCalledOnce();
        expect(host.execFile).not.toHaveBeenCalled();
        expect(wait).not.toHaveBeenCalled();
    });
});
