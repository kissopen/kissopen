import { constants } from "node:fs";
import type { Dirent } from "node:fs";
import { randomUUID } from "node:crypto";
import { access, chmod, lstat, mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { kissopenAgentBinaryPath, type KissopenDaemonPaths } from "./kissopenAgentBinaryPaths";

export const SEMANTIC_VERSION_PATTERN =
    "^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$";
interface KissopenAgentBinaryConfig {
    readonly downloadedVersions: readonly string[];
    readonly selectedVersion: string;
}

export interface KissopenAgentBinary {
    readonly path: string;
    readonly version: string;
}

export async function kissopenAgentBinarySelected(
    paths: KissopenDaemonPaths,
): Promise<KissopenAgentBinary | undefined> {
    const config = await kissopenAgentBinaryConfigRead(paths);
    if (config === undefined || !config.downloadedVersions.includes(config.selectedVersion)) {
        return undefined;
    }
    const path = kissopenAgentBinaryPath(paths, config.selectedVersion);
    return (await executableFile(path)) ? { path, version: config.selectedVersion } : undefined;
}

export async function kissopenAgentBinarySelect(
    paths: KissopenDaemonPaths,
    selectedVersion: string,
): Promise<KissopenAgentBinaryConfig> {
    await mkdir(paths.distDirectory, { mode: 0o700, recursive: true });
    await chmod(paths.distDirectory, 0o700);
    const downloadedVersions = await kissopenAgentBinaryDownloaded(paths);
    if (!downloadedVersions.includes(selectedVersion)) {
        throw new Error(`WorPar Agent ${selectedVersion} is not completely installed.`);
    }
    const config: KissopenAgentBinaryConfig = { downloadedVersions, selectedVersion };
    if (!kissopenAgentBinaryConfigValid(config)) {
        throw new Error("The downloaded WorPar Agent versions could not be recorded.");
    }
    const temporaryPath = `${paths.binaryConfigPath}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
        await handle.writeFile(`${JSON.stringify(config, null, 2)}\n`, "utf8");
        await handle.sync();
        await handle.chmod(0o600);
    } catch (error) {
        await handle.close();
        await rm(temporaryPath, { force: true });
        throw error;
    }
    await handle.close();
    try {
        await rename(temporaryPath, paths.binaryConfigPath);
        await chmod(paths.binaryConfigPath, 0o600);
    } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }
    return config;
}

/**
 * Every version completely installed on this machine, oldest name first. A
 * directory only counts once its binary is present and executable, so a version
 * left behind by an interrupted download is never offered as selectable.
 */
export async function kissopenAgentBinaryDownloaded(paths: KissopenDaemonPaths): Promise<string[]> {
    let entries: Dirent<string>[];
    try {
        entries = await readdir(paths.versionsDirectory, { withFileTypes: true });
    } catch (error) {
        if (missing(error)) return [];
        throw error;
    }
    const versions: string[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !new RegExp(SEMANTIC_VERSION_PATTERN, "u").test(entry.name)) {
            continue;
        }
        if (await executableFile(kissopenAgentBinaryPath(paths, entry.name))) {
            versions.push(entry.name);
        }
    }
    return versions.sort((left, right) => left.localeCompare(right, "en"));
}

export async function executableFile(path: string): Promise<boolean> {
    try {
        const information = await lstat(path);
        if (!information.isFile()) return false;
        await access(path, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

async function kissopenAgentBinaryConfigRead(
    paths: KissopenDaemonPaths,
): Promise<KissopenAgentBinaryConfig | undefined> {
    try {
        const parsed: unknown = JSON.parse(await readFile(paths.binaryConfigPath, "utf8"));
        return kissopenAgentBinaryConfigValid(parsed) ? parsed : undefined;
    } catch (error) {
        if (missing(error) || error instanceof SyntaxError) return undefined;
        throw error;
    }
}

function kissopenAgentBinaryConfigValid(value: unknown): value is KissopenAgentBinaryConfig {
    if (!record(value)) return false;
    if (Object.keys(value).some((key) => key !== "downloadedVersions" && key !== "selectedVersion"))
        return false;
    if (!semanticVersion(value.selectedVersion)) return false;
    if (!Array.isArray(value.downloadedVersions) || value.downloadedVersions.length > 100)
        return false;
    const versions = value.downloadedVersions;
    return versions.every(semanticVersion) && new Set(versions).size === versions.length;
}

function semanticVersion(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length <= 128 &&
        new RegExp(SEMANTIC_VERSION_PATTERN, "u").test(value)
    );
}

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function missing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}
