import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
    access,
    mkdir,
    readFile,
    readlink,
    readdir,
    rm,
    symlink,
    unlink,
    writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { GymOwnerMarker, GymProfile, GymRunPaths } from "./types.js";

const OWNER_MARKER = ".kissopen-desktop-gym-owner.json";
const RUNS_DIRECTORY = "hdg";
const MAX_UNIX_SOCKET_PATH_BYTES = 103;
const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const SAFE_SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
const SAFE_PROFILE_ENVIRONMENT = new Set([
    "KISSOPEN_HOME_DIR",
    "HOME",
    "LANG",
    "LOGNAME",
    "PATH",
    "KISSOPEN_AGENT_PROJECTS_DIRECTORY",
    "KISSOPEN_AGENT_SERVER_SOCKET_PATH",
    "KISSOPEN_AGENT_SERVER_TOKEN_PATH",
    "KISSOPEN_AGENT_WORKSPACES_DIRECTORY",
    "KISSOPEN_GYM_INFERENCE_URL",
    "KISSOPEN_GYM_TOKEN",
    "SHELL",
    "TERM",
    "TMPDIR",
    "USER",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
]);

export function workspaceRootResolve(): string {
    return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

/** Short, host-temporary ownership root shared by every desktop Gym run. */
export function gymRunsRootResolve(): string {
    return resolve(tmpdir(), RUNS_DIRECTORY);
}

export async function gymRunPathsCreate(
    profile: GymProfile,
    requestedRoot?: string,
    requestedArtifactDirectory?: string,
): Promise<{ readonly paths: GymRunPaths; readonly marker: GymOwnerMarker }> {
    const workspaceRoot = workspaceRootResolve();
    const runId = randomUUID();
    const root = resolve(requestedRoot ?? join(gymRunsRootResolve(), `g-${runId.slice(0, 8)}`));
    assertSafeRunRoot(root);
    const artifacts = artifactDirectoryResolve(root, workspaceRoot, requestedArtifactDirectory);
    await assertArtifactDirectoryFresh(artifacts, requestedArtifactDirectory !== undefined);
    const paths = runPathsResolve(root, workspaceRoot, artifacts);
    socketPathAssert(paths.socketPath);
    await mkdir(gymRunsRootResolve(), { recursive: true });
    try {
        await mkdir(root);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            throw new Error(
                `Refusing to use an existing Gym root without a fresh run path: ${root}`,
            );
        }
        throw error;
    }
    const marker: GymOwnerMarker = {
        kind: "kissopen-desktop-gym-run",
        schemaVersion: 1,
        runId,
        profile,
        createdAt: new Date().toISOString(),
        artifactDirectory: artifacts,
    };
    try {
        await Promise.all([
            mkdir(paths.home, { recursive: true }),
            mkdir(paths.tmp, { recursive: true }),
            mkdir(paths.projects, { recursive: true }),
            mkdir(paths.workspaces, { recursive: true }),
            mkdir(paths.agentHome, { recursive: true }),
            mkdir(paths.bin, { recursive: true }),
            mkdir(paths.artifacts, { recursive: true }),
        ]);
        await writeFile(paths.marker, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
        return { paths, marker };
    } catch (error) {
        await rm(root, { force: true, recursive: true });
        throw error;
    }
}

export async function gymRunMarkerRead(root: string): Promise<GymOwnerMarker> {
    const marker = await readOwnerMarker(resolve(root));
    if (marker === undefined) {
        throw new Error(`The requested path is not an owned Gym run: ${root}`);
    }
    return marker;
}

export async function gymRunPathsRead(root: string): Promise<GymRunPaths> {
    const rootPath = resolve(root);
    const marker = await gymRunMarkerRead(rootPath);
    const workspaceRoot = workspaceRootResolve();
    assertSafeRunRoot(rootPath);
    const paths = runPathsResolve(
        rootPath,
        workspaceRoot,
        artifactDirectoryResolve(rootPath, workspaceRoot, marker.artifactDirectory),
    );
    socketPathAssert(paths.socketPath);
    return paths;
}

export function gymRunPathsWithKissopenAgentWorkspace(
    paths: GymRunPaths,
    kissopenAgentWorkspacePath: string,
): GymRunPaths {
    return { ...paths, kissopenAgentWorkspacePath };
}

export async function gymRunClean(root: string): Promise<void> {
    const resolved = resolve(root);
    const marker = await gymRunMarkerRead(resolved);
    assertSafeRunRoot(resolved);
    if (marker.kind !== "kissopen-desktop-gym-run" || marker.schemaVersion !== 1) {
        throw new Error(`Unsupported Gym ownership marker at ${resolved}`);
    }
    const socketPath = runPathsResolve(
        resolved,
        workspaceRootResolve(),
        join(resolved, "artifacts"),
    ).socketPath;
    await unlink(socketPath).catch(() => undefined);
    await rm(resolved, { force: true, recursive: true, maxRetries: 3, retryDelay: 50 });
}

export async function gymRunProfileWrite(
    paths: GymRunPaths,
    values: Readonly<Record<string, string>>,
): Promise<void> {
    const unsafe = Object.keys(values).find((name) => !SAFE_PROFILE_ENVIRONMENT.has(name));
    if (unsafe !== undefined) {
        throw new Error(`Refusing to persist non-isolated Gym environment variable: ${unsafe}`);
    }
    const lines = [
        "# Generated by kissopen-desktop-gym. This profile is disposable and run-owned.",
        `export PATH=${shellQuote(`${paths.bin}:${SAFE_SYSTEM_PATH}`)}`,
        ...Object.entries(values)
            .filter(([name]) => name !== "PATH")
            .map(([name, value]) => `export ${name}=${shellQuote(value)}`),
        "",
    ];
    await Promise.all([
        writeFile(join(paths.home, ".zprofile"), lines.join("\n"), "utf8"),
        writeFile(join(paths.home, ".bash_profile"), lines.join("\n"), "utf8"),
    ]);
}

export async function gymKissopenAgentCommandCreate(
    paths: GymRunPaths,
    kissopenAgentExecutable: string,
): Promise<string> {
    const command = join(paths.bin, "kissopen-agent");
    try {
        const existing = await readlink(command);
        if (existing === kissopenAgentExecutable) return command;
        await unlink(command);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await symlink(kissopenAgentExecutable, command);
    return command;
}

export function electronEntrypointResolve(workspaceRoot = workspaceRootResolve()): {
    readonly executable: string;
    readonly main: string;
} {
    return {
        executable:
            process.env.KISSOPEN_DESKTOP_ELECTRON_EXECUTABLE?.trim() ||
            // The electron package exports its real binary path. The `.bin`
            // shim would resolve to a `.cmd` wrapper on Windows, which cannot
            // be spawned directly.
            (createRequire(
                join(workspaceRoot, "packages", "kissopen-desktop-electron", "package.json"),
            )("electron") as string),
        main: join(workspaceRoot, "packages", "kissopen-desktop-electron", "dist", "main.js"),
    };
}

export async function kissopenAgentExecutableResolve(): Promise<string> {
    const configured = process.env.KISSOPEN_DESKTOP_AGENT_EXECUTABLE?.trim();
    if (configured) {
        if (!isAbsolute(configured)) {
            throw new Error("KISSOPEN_DESKTOP_AGENT_EXECUTABLE must be an absolute path.");
        }
        await executableAssert(configured);
        return configured;
    }

    const sourceKissopenHome = kissopenHomeResolve(process.env, homedir());
    const configPath = join(sourceKissopenHome, "dist", "config.json");
    let selectedVersion: string;
    try {
        const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("selectedVersion" in parsed) ||
            typeof parsed.selectedVersion !== "string" ||
            !SEMANTIC_VERSION_PATTERN.test(parsed.selectedVersion)
        ) {
            throw new Error(`KISSOPEN Agent selection is invalid at ${configPath}.`);
        }
        selectedVersion = parsed.selectedVersion;
    } catch (error) {
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(
                "No selected KISSOPEN Agent installation was found. Set KISSOPEN_DESKTOP_AGENT_EXECUTABLE to an installed kissopen-agent binary.",
                { cause: error },
            );
        }
        throw error;
    }
    const executable = join(sourceKissopenHome, "dist", "version", selectedVersion, "kissopen-agent");
    await executableAssert(executable);
    return executable;
}

function artifactDirectoryResolve(root: string, workspaceRoot: string, requested?: string): string {
    const directory = resolve(root, requested ?? "artifacts");
    const workspaceContext = resolve(workspaceRoot, ".context");
    if (!pathWithin(root, directory) && !pathWithin(workspaceContext, directory)) {
        throw new Error(
            "Gym artifacts must stay inside the run root or the workspace .context directory.",
        );
    }
    return directory;
}

function pathWithin(parent: string, candidate: string): boolean {
    const value = relative(resolve(parent), resolve(candidate));
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

async function assertArtifactDirectoryFresh(directory: string, requested: boolean): Promise<void> {
    if (!requested) return;
    try {
        const entries = await readdir(directory);
        if (entries.length > 0) {
            throw new Error(
                `Refusing to populate a pre-existing nonempty Gym artifact directory: ${directory}`,
            );
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

function assertSafeRunRoot(root: string): void {
    const normalized = resolve(root);
    if (dirname(normalized) !== gymRunsRootResolve()) {
        throw new Error(`Gym roots must be direct children of ${gymRunsRootResolve()}: ${root}`);
    }
}

function runPathsResolve(root: string, workspaceRoot: string, artifacts: string): GymRunPaths {
    const kissopenHome = join(root, ".kissopen");
    const agentHome = join(kissopenHome, "agent");
    return {
        workspaceRoot,
        root,
        kissopenHome,
        home: join(root, "home"),
        tmp: join(root, "tmp"),
        projects: join(root, "projects"),
        workspaces: join(root, "workspaces"),
        agentHome,
        socketPath: join(agentHome, "server.sock"),
        tokenPath: join(agentHome, "token"),
        electronUserData: join(root, "electron-user-data"),
        kissopenAgentWorkspacePath: join(root, "workspaces"),
        bin: join(root, "bin"),
        artifacts,
        marker: join(root, OWNER_MARKER),
        manifest: join(root, "manifest.json"),
        inferenceLog: join(root, "inference.ndjson"),
        streamLog: join(root, "stream-events.ndjson"),
        cluster: join(root, "session-cluster.json"),
    };
}

function socketPathAssert(socketPath: string): void {
    if (process.platform === "win32") return;
    const bytes = Buffer.byteLength(socketPath);
    if (bytes <= MAX_UNIX_SOCKET_PATH_BYTES) return;
    throw new Error(
        `Gym socket path is ${String(bytes)} bytes; Unix permits ${String(MAX_UNIX_SOCKET_PATH_BYTES)}: ${socketPath}`,
    );
}

function kissopenHomeResolve(environment: NodeJS.ProcessEnv, homeDirectory: string): string {
    const configured = environment.KISSOPEN_HOME_DIR?.trim();
    if (!configured) return join(homeDirectory, ".kissopen");
    const expanded = configured.startsWith("~")
        ? join(homeDirectory, configured.slice(1))
        : configured;
    return isAbsolute(expanded) ? expanded : join(homeDirectory, expanded);
}

async function executableAssert(path: string): Promise<void> {
    try {
        await access(path, constants.X_OK);
    } catch (error) {
        throw new Error(`KISSOPEN Agent executable is unavailable at ${path}.`, { cause: error });
    }
}

async function readOwnerMarker(root: string): Promise<GymOwnerMarker | undefined> {
    try {
        await access(join(root, OWNER_MARKER));
        const parsed = JSON.parse(
            await readFile(join(root, OWNER_MARKER), "utf8"),
        ) as Partial<GymOwnerMarker>;
        if (
            parsed.kind !== "kissopen-desktop-gym-run" ||
            parsed.schemaVersion !== 1 ||
            typeof parsed.runId !== "string" ||
            typeof parsed.profile !== "string" ||
            typeof parsed.createdAt !== "string" ||
            (parsed.artifactDirectory !== undefined && typeof parsed.artifactDirectory !== "string")
        ) {
            throw new Error(`Invalid Gym ownership marker at ${root}`);
        }
        return parsed as GymOwnerMarker;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
