import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { kissopenDaemonPaths } from "./kissopenAgentBinaryPaths";
import { localRuntimeProbe } from "./localKissopenAgent";

const capability = "kissopen-desktop-link-v1";

interface PreparedLegacyCli {
    readonly node: string;
    readonly entry: string;
    readonly environment: NodeJS.ProcessEnv;
}

/** Installation precedes the phone steps; linking only uses the prepared CLI. */
export function legacyCliConnectorCreate(launchEnvironment: () => Promise<NodeJS.ProcessEnv>): {
    prepare(current: () => boolean): Promise<void>;
    connect(current: () => boolean): Promise<void>;
} {
    let prepared: PreparedLegacyCli | undefined;
    let preparing: Promise<void> | undefined;
    let connecting: Promise<void> | undefined;
    return {
        async prepare(current) {
            requireCurrent(current);
            if (prepared) return;
            preparing ??= prepare(current, launchEnvironment)
                .then((result) => {
                    requireCurrent(current);
                    prepared = result;
                })
                .finally(() => {
                    preparing = undefined;
                });
            await preparing;
            requireCurrent(current);
        },
        async connect(current) {
            requireCurrent(current);
            // Settings can link directly; onboarding prepares on the app-download screen.
            // Both explicit actions share the same cached preparation operation.
            if (!prepared) await this.prepare(current);
            const cli = prepared;
            if (!cli) throw new Error("Prepare the WorPar CLI before connecting your phone.");
            connecting ??= (async () => {
                // Do not install during authentication or trust a replaced global binary.
                if (
                    (
                        await command(
                            cli.node,
                            [cli.entry, "auth", "desktop", "--check"],
                            cli.environment,
                            30_000,
                        )
                    ).trim() !== capability
                ) {
                    prepared = undefined;
                    throw new Error(
                        "The WorPar CLI changed during setup. Try again to prepare it safely.",
                    );
                }
                requireCurrent(current);
                try {
                    await command(
                        cli.node,
                        [cli.entry, "auth", "desktop"],
                        cli.environment,
                        120_000,
                    );
                } catch {
                    // Never forward arbitrary subprocess output: it can contain credentials.
                    throw new Error(
                        "WorPar could not link the terminal CLI. Check that your existing CLI uses the same account and server as WorPar Mobile, then try again. For details, run WorPar auth desktop in your terminal.",
                    );
                }
                requireCurrent(current);
            })().finally(() => {
                connecting = undefined;
            });
            await connecting;
            requireCurrent(current);
        },
    };
}

function requireCurrent(current: () => boolean): void {
    if (!current()) throw new Error("WorPar Mobile setup changed. Try connecting again.");
}

async function prepare(
    current: () => boolean,
    launchEnvironment: () => Promise<NodeJS.ProcessEnv>,
): Promise<PreparedLegacyCli> {
    requireCurrent(current);
    const nativeEnvironment = await launchEnvironment();
    if (
        nativeEnvironment.KISSOPEN_AGENT_SERVER_SOCKET_PATH?.trim() ||
        nativeEnvironment.KISSOPEN_AGENT_SERVER_TOKEN_PATH?.trim()
    )
        throw new Error(
            "Automatic terminal linking is unavailable for a custom WorPar Agent connection. Use the CLI on that Agent's machine.",
        );
    const probe = await localRuntimeProbe();
    if (!probe.nodeCommand)
        throw new Error(
            "Install Node.js with npm to connect Claude Code and Codex to WorPar Mobile.",
        );
    const node = await realpath(probe.nodeCommand);
    const environment: NodeJS.ProcessEnv = {
        ...probe.environment,
        KISSOPEN_HOME_DIR: kissopenDaemonPaths(nativeEnvironment).kissopenHome,
        KISSOPEN_VARIANT: "stable",
        KISSOPEN_BOOT_AGENT: "0",
    };
    // Match the environment captured for the native daemon, not later shell edits.
    const nativeServer =
        nativeEnvironment.KISSOPEN_AGENT_KISSOPEN_SERVER_URL?.trim() ||
        nativeEnvironment.KISSOPEN_SERVER_URL?.trim();
    if (nativeServer) environment.KISSOPEN_SERVER_URL = nativeServer;
    else delete environment.KISSOPEN_SERVER_URL;
    delete environment.KISSOPEN_AGENT_KISSOPEN_SERVER_URL;
    // The selected Node must also be the one npm and the CLI's children find.
    const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
    environment[pathKey] = `${dirname(node)}${delimiter}${environment[pathKey] ?? ""}`;
    const run = async (entry: string, args: readonly string[], timeout = 30_000) => {
        requireCurrent(current);
        return command(node, [entry, ...args], environment, timeout);
    };
    const supported = async (entry: string): Promise<boolean> => {
        try {
            return (await run(entry, ["auth", "desktop", "--check"])).trim() === capability;
        } catch {
            requireCurrent(current);
            return false;
        }
    };
    // A main-process-only review override never installs or replaces a global CLI.
    const override = process.env.KISSOPEN_DESKTOP_LEGACY_CLI_PATH;
    let entry: string;
    if (override !== undefined) {
        if (!isAbsolute(override) || !override.endsWith(".mjs"))
            throw new Error(
                "KISSOPEN_DESKTOP_LEGACY_CLI_PATH must name an absolute built CLI .mjs file.",
            );
        entry = await realpath(override);
        if (!(await supported(entry)))
            throw new Error(
                "The review CLI does not support safe desktop linking. Rebuild the WorPar CLI.",
            );
    } else {
        const npm = await npmEntryResolve(environment[pathKey] ?? "");
        const root = (await run(npm, ["root", "--global"])).trim();
        if (!isAbsolute(root))
            throw new Error("npm did not report an absolute global package directory.");
        let installed = await kissopenEntryResolve(root);
        if (!installed || !(await supported(installed))) {
            try {
                await run(
                    npm,
                    ["install", "--global", "kissopen@latest", "--no-audit", "--no-fund"],
                    300_000,
                );
            } catch {
                throw new Error(
                    "WorPar could not update the terminal CLI. Check your npm installation and permissions, then try again.",
                );
            }
            installed = await kissopenEntryResolve(root);
            if (!installed || !(await supported(installed)))
                throw new Error(
                    "The published WorPar CLI does not support safe desktop linking yet. Your existing sign-in has not been replaced. Try again after the compatible CLI is available.",
                );
        }
        entry = installed;
    }
    requireCurrent(current);
    return { node, entry, environment };
}

/** Resolve npm's JS entry, never pass a .cmd wrapper through a shell. */
async function npmEntryResolve(path: string): Promise<string> {
    for (const directory of path.split(delimiter).filter(isAbsolute)) {
        const candidates =
            process.platform === "win32"
                ? [join(directory, "node_modules", "npm", "bin", "npm-cli.js")]
                : [join(directory, "npm")];
        for (const candidate of candidates) {
            try {
                const entry = await realpath(candidate);
                const manifest: unknown = JSON.parse(
                    await readFile(join(dirname(entry), "..", "package.json"), "utf8"),
                );
                if (
                    entry.endsWith(`${sep}bin${sep}npm-cli.js`) &&
                    isRecord(manifest) &&
                    manifest.name === "npm"
                )
                    return entry;
            } catch {
                // Continue to the next npm installation in the login environment.
            }
        }
    }
    throw new Error(
        "WorPar could not find npm beside your Node.js installation. Install Node.js with npm and try again.",
    );
}

/** Ignore unrelated `kissopen` commands on PATH; only use the known npm package. */
async function kissopenEntryResolve(root: string): Promise<string | undefined> {
    try {
        const directory = await realpath(join(root, "kissopen"));
        const manifest: unknown = JSON.parse(
            await readFile(join(directory, "package.json"), "utf8"),
        );
        if (
            !isRecord(manifest) ||
            manifest.name !== "kissopen" ||
            !isRecord(manifest.bin) ||
            typeof manifest.bin.kissopen !== "string"
        )
            return undefined;
        const entry = await realpath(resolve(directory, manifest.bin.kissopen));
        const within = relative(directory, entry);
        if (!within || within.startsWith(`..${sep}`) || within === ".." || isAbsolute(within))
            return undefined;
        return entry;
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function command(
    node: string,
    args: readonly string[],
    env: NodeJS.ProcessEnv,
    timeout: number,
): Promise<string> {
    return new Promise((resolvePromise, reject) => {
        execFile(
            node,
            [...args],
            { env, timeout, windowsHide: true, encoding: "utf8", maxBuffer: 1024 * 1024 },
            (error, stdout) => {
                if (error) reject(new Error("The WorPar CLI command did not complete."));
                else resolvePromise(stdout);
            },
        );
    });
}
