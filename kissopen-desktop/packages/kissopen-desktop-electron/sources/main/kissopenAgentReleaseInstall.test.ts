import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { kissopenAgentBinarySelected } from "./kissopenAgentBinaryConfig";
import { kissopenDaemonPaths, KISSOPEN_AGENT_BINARY_FILE_NAME } from "./kissopenAgentBinaryPaths";
import { kissopenAgentReleaseInstall, type KissopenAgentRelease } from "./kissopenAgentRelease";

const temporaryRoots: string[] = [];
afterEach(async () => {
    const parent = resolve(tmpdir()) + sep;
    for (const root of temporaryRoots.splice(0)) {
        if (!resolve(root).startsWith(parent) || !root.includes("kissopen-release-install-")) {
            throw new Error("Refusing to remove an unexpected fixture directory.");
        }
        await rm(root, { recursive: true, force: true });
    }
});

describe("WorPar Agent release installation on the real filesystem", () => {
    it("flushes, installs, and selects a verified executable", async () => {
        const fixture = await createRelease();
        const binary = await kissopenAgentReleaseInstall(fixture.release, fixture.paths, {
            fetch: fixture.fetch,
        });
        expect(binary.path).toBe(
            join(
                fixture.paths.versionsDirectory,
                fixture.release.version,
                KISSOPEN_AGENT_BINARY_FILE_NAME,
            ),
        );
        expect(await readFile(binary.path, "utf8")).toBe(fixture.contents);
        expect(await kissopenAgentBinarySelected(fixture.paths)).toEqual(binary);
        expect(await readFile(fixture.paths.binaryConfigPath, "utf8")).toContain(
            fixture.release.version,
        );
    });

    it("does not install or select bytes that fail checksum verification", async () => {
        const fixture = await createRelease();
        await expect(
            kissopenAgentReleaseInstall(
                {
                    ...fixture.release,
                    asset: { ...fixture.release.asset, digest: `sha256:${"0".repeat(64)}` },
                },
                fixture.paths,
                { fetch: fixture.fetch },
            ),
        ).rejects.toThrow("checksum does not match");
        expect(await kissopenAgentBinarySelected(fixture.paths)).toBeUndefined();
        await expect(
            stat(join(fixture.paths.versionsDirectory, fixture.release.version)),
        ).rejects.toMatchObject({ code: "ENOENT" });
    });
});

async function createRelease() {
    const root = await mkdtemp(join(tmpdir(), "kissopen-release-install-"));
    temporaryRoots.push(root);
    const source = join(root, "source");
    await mkdir(source);
    const archivedBinaryName = "kissopen-agent-test.exe";
    const contents = "verified executable fixture\n";
    await writeFile(join(source, archivedBinaryName), contents);
    const archivePath = join(root, "release.tar.gz");
    const tar =
        process.platform === "win32"
            ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
            : "tar";
    await promisify(execFile)(tar, ["-czf", archivePath, "-C", source, archivedBinaryName], {
        windowsHide: true,
    });
    const bytes = await readFile(archivePath);
    const assetUrl = "https://release-fixture.invalid/kissopen-agent.tar.gz";
    const release: KissopenAgentRelease = {
        archivedBinaryName,
        version: "0.0.99-test",
        asset: {
            browser_download_url: assetUrl,
            digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
            name: "kissopen-agent.tar.gz",
            size: bytes.length,
        },
    };
    const fetch: typeof globalThis.fetch = async (url) => {
        expect(String(url)).toBe(assetUrl);
        const response = new Response(bytes);
        Object.defineProperty(response, "url", { value: assetUrl });
        return response;
    };
    return {
        contents,
        release,
        fetch,
        paths: kissopenDaemonPaths({ KISSOPEN_HOME_DIR: join(root, "kissopen") }),
    };
}
