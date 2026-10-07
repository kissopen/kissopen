import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { kissopenDaemonPaths, kissopenAgentBinaryPath } from "./kissopenAgentBinaryPaths";
import {
    kissopenAgentBinarySelected,
    kissopenAgentBinarySelect,
    SEMANTIC_VERSION_PATTERN,
} from "./kissopenAgentBinaryConfig";
import { kissopenAgentVersionNewer } from "./kissopenAgentVersion";

/** How long the old agent is given to finish its work and hand over. */
const RELOAD_TIMEOUT_MS = 3 * 60_000;

/*
The installer carries the full forked runtime. First launch does not silently
download a different upstream Agent that lacks Kissopen's provider extensions.

A newer installer over an older agent installs its own too. It used to stop at
any agent already chosen, so a computer that first ran an older build kept that
agent through every later install: the window then said the agent was too old
and went looking online for a release that was never published there. An agent
at least as new as the bundled one — one the person updated to, or picked — is
left alone.
*/
export async function kissopenBundledAgentInstall(
    resources: string,
    environment: NodeJS.ProcessEnv,
): Promise<void> {
    return kissopenAgentArtifactInstall(join(resources, "kissopen-agent"), environment);
}

/** The same checksum-verified artifact boundary for packaged and development hosts. */
export async function kissopenAgentArtifactInstall(
    directory: string,
    environment: NodeJS.ProcessEnv,
): Promise<void> {
    const paths = kissopenDaemonPaths(environment);
    const selected = await kissopenAgentBinarySelected(paths);
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as {
        version: string;
        platform: string;
        arch: string;
        sha256: string;
    };
    if (
        !new RegExp(SEMANTIC_VERSION_PATTERN, "u").test(manifest.version) ||
        manifest.platform !== process.platform ||
        manifest.arch !== process.arch ||
        !/^[a-f0-9]{64}$/u.test(manifest.sha256)
    )
        throw new Error("The bundled kissopen Agent does not match this platform.");
    if (selected && !kissopenAgentVersionNewer(manifest.version, selected.version)) return;
    const source = join(
        directory,
        process.platform === "win32" ? "kissopen-agent.exe" : "kissopen-agent",
    );
    const bytes = await readFile(source);
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256)
        throw new Error("The bundled kissopen Agent failed integrity verification. Please reinstall.");
    const target = kissopenAgentBinaryPath(paths, manifest.version);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(source, `${target}.tmp`);
    await chmod(`${target}.tmp`, 0o700);
    await rename(`${target}.tmp`, target);
    await kissopenAgentBinarySelect(paths, manifest.version);
    // The older agent may still be running from before; it hands over to this
    // one. A reload that fails leaves the old one, which the window reports.
    if (selected) await agentReload(target, environment).catch(() => undefined);
}

function agentReload(executable: string, environment: NodeJS.ProcessEnv): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(
            executable,
            ["reload"],
            { env: environment, timeout: RELOAD_TIMEOUT_MS, windowsHide: true },
            (error) => (error === null ? resolve() : reject(error)),
        );
    });
}

/**
 * Installs the agent a development run just built, so `pnpm dev` starts the same
 * way the installed app does.
 *
 * Without this the desktop falls back to downloading a published release, and
 * this fork has none — first launch sits on "Launching KISSOPEN Agent" behind an
 * HTTP 404 forever. The binary is whatever `build-binary.ts --target <host>`
 * produced; a run with nothing built simply skips, leaving the old behaviour.
 */
export async function kissopenDevAgentInstall(
    source: string | undefined,
    environment: NodeJS.ProcessEnv,
): Promise<boolean> {
    if (!source) return false;
    const paths = kissopenDaemonPaths(environment);
    if (await kissopenAgentBinarySelected(paths)) return true;
    let bytes: Buffer;
    try {
        bytes = await readFile(source);
    } catch {
        return false;
    }
    const version = JSON.parse(
        await readFile(join(dirname(source), "..", "..", "package.json"), "utf8"),
    ).version as string;
    if (!new RegExp(SEMANTIC_VERSION_PATTERN, "u").test(version)) return false;
    const target = kissopenAgentBinaryPath(paths, version);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(`${target}.tmp`, bytes, { mode: 0o700 });
    await rename(`${target}.tmp`, target);
    await kissopenAgentBinarySelect(paths, version);
    return true;
}
