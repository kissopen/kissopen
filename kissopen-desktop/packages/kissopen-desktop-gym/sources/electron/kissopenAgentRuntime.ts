import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

import {
    gymKissopenAgentCommandCreate,
    gymRunProfileWrite,
    kissopenAgentExecutableResolve,
} from "./paths.js";
import { GymKissopenAgentClient } from "./kissopenAgentProtocol.js";
import type { GymInferenceServer, GymRunPaths, KissopenAgentRuntime } from "./types.js";

const execFileAsync = promisify(execFile);

export interface StartedKissopenAgentRuntime extends KissopenAgentRuntime {
    readonly client: GymKissopenAgentClient;
}

export async function kissopenAgentRuntimeCreate(
    paths: GymRunPaths,
    inference: GymInferenceServer,
): Promise<StartedKissopenAgentRuntime> {
    const kissopenAgentExecutable = await kissopenAgentExecutableResolve();
    const command = await gymKissopenAgentCommandCreate(paths, kissopenAgentExecutable);
    const publicConfig = join(paths.root, "KISSOPEN", "Config");
    await Promise.all(
        [
            publicConfig,
            join(paths.home, ".config"),
            join(paths.home, ".cache"),
            join(paths.home, ".local", "share"),
            join(paths.home, ".local", "state"),
        ].map((directory) => mkdir(directory, { recursive: true })),
    );
    await writeFile(
        join(publicConfig, "kissopen.toml"),
        "[settings]\nkissopen_integration = false\n",
        "utf8",
    );
    const environment = environmentCreate(paths, inference);
    await gymRunProfileWrite(paths, environment);
    // Electron/Playwright can terminate its Node controller before ordinary
    // finally cleanup runs (for example, a host GUI launch abort). A detached
    // Kissopen Agent from that attempt still owns this run's socket and retains the old
    // inference endpoint. Stop only this isolated run's daemon before starting
    // its next lifetime so a retry cannot silently attach to stale transport.
    await execFileAsync(command, ["stop"], {
        cwd: paths.root,
        env: environment,
        timeout: 15_000,
        maxBuffer: 2 * 1024 * 1024,
    }).catch(() => undefined);
    await unlink(paths.socketPath).catch(() => undefined);
    const runtime = new LocalKissopenAgentRuntime(paths, command, environment, inference);
    await runtime.start();
    return runtime;
}

class LocalKissopenAgentRuntime implements StartedKissopenAgentRuntime {
    readonly #paths: GymRunPaths;
    readonly #inference: GymInferenceServer;
    readonly #environment: Record<string, string>;
    readonly #command: string;
    #token = "";
    #client: GymKissopenAgentClient | undefined;

    constructor(
        paths: GymRunPaths,
        command: string,
        environment: Record<string, string>,
        inference: GymInferenceServer,
    ) {
        this.#paths = paths;
        this.#command = command;
        this.#environment = environment;
        this.#inference = inference;
    }

    get command(): string {
        return this.#command;
    }

    get environment(): Record<string, string> {
        return this.#environment;
    }

    get socketPath(): string {
        return this.#paths.socketPath;
    }

    get tokenPath(): string {
        return this.#paths.tokenPath;
    }

    get token(): string {
        if (!this.#token) throw new Error("KISSOPEN Agent runtime has not started.");
        return this.#token;
    }

    get client(): GymKissopenAgentClient {
        if (this.#client === undefined) throw new Error("KISSOPEN Agent runtime has not started.");
        return this.#client;
    }

    async start(): Promise<void> {
        await execFileAsync(this.#command, ["start"], {
            cwd: this.#paths.root,
            env: this.#environment,
            timeout: 30_000,
            maxBuffer: 2 * 1024 * 1024,
        });
        await waitForToken(this.tokenPath, 30_000);
        this.#token = (await readFile(this.tokenPath, "utf8")).trim();
        if (!this.#token)
            throw new Error("KISSOPEN Agent daemon wrote an empty authentication token.");
        this.#client = new GymKissopenAgentClient(this.socketPath, this.#token);
        await waitForHealth(this.#client, 30_000);
    }

    async stop(): Promise<void> {
        await execFileAsync(this.#command, ["stop"], {
            cwd: this.#paths.root,
            env: this.#environment,
            timeout: 15_000,
            maxBuffer: 2 * 1024 * 1024,
        }).catch(() => undefined);
        this.#client = undefined;
        this.#token = "";
        await unlink(this.socketPath).catch(() => undefined);
        await this.#inference.stop().catch(() => undefined);
    }
}

function environmentCreate(
    paths: GymRunPaths,
    inference: GymInferenceServer,
): Record<string, string> {
    const safeSystemPath = "/usr/bin:/bin:/usr/sbin:/sbin";
    return {
        KISSOPEN_HOME_DIR: paths.kissopenHome,
        HOME: paths.home,
        LANG: "C.UTF-8",
        LOGNAME: "kissopen-desktop-gym",
        PATH: `${paths.bin}:${safeSystemPath}`,
        // The run's login shell must exist on the host: zsh ships with macOS,
        // while Linux hosts (including CI runners) are only guaranteed bash.
        // The fixtures seed both .zprofile and .bash_profile in the run home.
        SHELL: process.platform === "linux" ? "/bin/bash" : "/bin/zsh",
        TERM: "xterm-256color",
        USER: "kissopen-desktop-gym",
        XDG_CACHE_HOME: join(paths.home, ".cache"),
        XDG_CONFIG_HOME: join(paths.home, ".config"),
        XDG_DATA_HOME: join(paths.home, ".local", "share"),
        XDG_STATE_HOME: join(paths.home, ".local", "state"),
        KISSOPEN_AGENT_PROJECTS_DIRECTORY: paths.projects,
        KISSOPEN_AGENT_SERVER_SOCKET_PATH: paths.socketPath,
        KISSOPEN_AGENT_SERVER_TOKEN_PATH: paths.tokenPath,
        KISSOPEN_AGENT_WORKSPACES_DIRECTORY: paths.workspaces,
        KISSOPEN_GYM_INFERENCE_URL: inference.url,
        KISSOPEN_GYM_TOKEN: inference.token,
        TMPDIR: paths.tmp,
    };
}

async function waitForToken(path: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const token = (await readFile(path, "utf8")).trim();
            if (token) return;
        } catch {
            // The detached daemon is still starting.
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for the isolated KISSOPEN Agent token at ${path}.`);
}

async function waitForHealth(client: GymKissopenAgentClient, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            await client.health();
            return;
        } catch (error) {
            lastError = error;
        }
        await delay(100);
    }
    throw new Error(`Timed out waiting for isolated KISSOPEN Agent health: ${String(lastError)}`);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        timer.unref?.();
    });
}
