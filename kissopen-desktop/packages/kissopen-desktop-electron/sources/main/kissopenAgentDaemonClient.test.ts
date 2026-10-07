import { localAgentSocketPath } from "./localAgentSocketPath";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    kissopenAgentDaemonConnectionUnavailable,
    KissopenAgentDaemonHttpError,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";

describe("kissopenAgentDaemonPathsResolve", () => {
    it("matches WorPar Agent's default and environment-overridden daemon paths", () => {
        const homeDirectory =
            process.platform === "win32" ? join("C:\\Users", "steve") : "/Users/steve";
        expect(kissopenAgentDaemonPathsResolve({}, homeDirectory)).toEqual({
            socketPath: localAgentSocketPath(join(homeDirectory, ".kissopen", "agent")),
            tokenPath: join(homeDirectory, ".kissopen", "agent", "token"),
        });
        const configuredHome =
            process.platform === "win32" ? "C:\\private kissopen" : "/private/kissopen";
        expect(
            kissopenAgentDaemonPathsResolve({ KISSOPEN_HOME_DIR: configuredHome }, homeDirectory),
        ).toEqual({
            socketPath: localAgentSocketPath(join(configuredHome, "agent")),
            tokenPath: join(configuredHome, "agent", "token"),
        });
        expect(
            kissopenAgentDaemonPathsResolve(
                {
                    KISSOPEN_AGENT_SERVER_SOCKET_PATH: "/tmp/override.sock",
                    KISSOPEN_AGENT_SERVER_TOKEN_PATH: "/tmp/override.token",
                },
                homeDirectory,
            ),
        ).toEqual({
            socketPath: "/tmp/override.sock",
            tokenPath: "/tmp/override.token",
        });
    });
});

describe("kissopenAgentDaemonTokenRead", () => {
    it("reads a trimmed token and treats a missing token as unavailable", async () => {
        const directory = await mkdtemp(join(tmpdir(), "kissopen-agent-token-"));
        const tokenPath = join(directory, "token");
        try {
            expect(await kissopenAgentDaemonTokenRead(tokenPath)).toBeUndefined();
            await writeFile(tokenPath, "secret\n");
            expect(await kissopenAgentDaemonTokenRead(tokenPath)).toBe("secret");
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });
});

describe("kissopenAgentDaemonConnectionUnavailable", () => {
    it("treats a rejected token from a restarted daemon as an unusable connection", () => {
        expect(
            kissopenAgentDaemonConnectionUnavailable(
                new KissopenAgentDaemonHttpError(401, "unauthorized"),
            ),
        ).toBe(true);
        expect(
            kissopenAgentDaemonConnectionUnavailable(
                new KissopenAgentDaemonHttpError(403, "forbidden"),
            ),
        ).toBe(true);
        expect(
            kissopenAgentDaemonConnectionUnavailable(
                Object.assign(new Error("socket gone"), { code: "ENOENT" }),
            ),
        ).toBe(true);
    });

    it("leaves daemon-reported failures to the caller", () => {
        expect(
            kissopenAgentDaemonConnectionUnavailable(
                new KissopenAgentDaemonHttpError(404, "no session"),
            ),
        ).toBe(false);
        expect(
            kissopenAgentDaemonConnectionUnavailable(new KissopenAgentDaemonHttpError(500, "boom")),
        ).toBe(false);
        expect(kissopenAgentDaemonConnectionUnavailable(new Error("ordinary failure"))).toBe(false);
    });
});
