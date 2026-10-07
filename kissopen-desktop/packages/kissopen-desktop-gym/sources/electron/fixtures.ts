import { execFile } from "node:child_process";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { GymKissopenAgentClient, KissopenAgentWorkspace } from "./kissopenAgentProtocol.js";
import type { GymFixtureCounts, GymManifest, GymProject, GymRunPaths } from "./types.js";

const execFileAsync = promisify(execFile);

interface FixtureScale {
    readonly generatedFiles: number;
    readonly nestedFiles: number;
    readonly largeTextFiles: number;
    readonly largeLinesPerFile: number;
    readonly largeChangedLines: number;
    readonly addedFiles: number;
}

interface RepositoryFixture {
    readonly index: number;
    readonly name: string;
    readonly path: string;
    readonly largePaths: readonly string[];
}

export interface GitFixturesResult {
    readonly projects: readonly GymProject[];
    readonly fixture: GymFixtureCounts;
    readonly kissopenAgentWorkspacePath: string;
}

/**
 * Creates actual repositories and worktrees first, then applies the same
 * deterministic dirty checkout shape to the project and every ready
 * workspace. Archived worktrees remain clean so archive behavior is not
 * confused with working-tree state.
 */
export async function gitFixturesCreate(
    paths: GymRunPaths,
    manifest: GymManifest,
    client: GymKissopenAgentClient,
): Promise<GitFixturesResult> {
    const distribution = manifest.seed.projectWorktreeDistribution;
    if (distribution.length !== manifest.target.regularProjects) {
        throw new Error(
            `Gym worktree distribution has ${distribution.length} entries, expected ${manifest.target.regularProjects} regular projects.`,
        );
    }
    if (
        distribution.reduce((total, count) => total + count, 0) !== manifest.target.totalWorktrees
    ) {
        throw new Error("Gym worktree distribution does not match its target worktree count.");
    }
    const gitEnvironment = {
        HOME: paths.home,
        LANG: "C.UTF-8",
        PATH: `${paths.bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
        TMPDIR: paths.tmp,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
    };
    const repositories = await Promise.all(
        Array.from({ length: manifest.target.regularProjects }, (_, index) =>
            createRepository(paths.projects, index, manifest, gitEnvironment),
        ),
    );
    const projects: GymProject[] = [];
    const createdWorktrees: Array<{
        readonly projectId: string;
        readonly workspace: KissopenAgentWorkspace;
    }> = [];
    for (const repository of repositories) {
        // Registering after this mutation lets Kissopen Agent's initial project scan expose
        // the deterministic changed-file projection immediately. Ready
        // worktrees are updated below once their paths exist.
        await workingTreeChangesApply(repository.path, manifest);
        const result = await client.registerProject(repository.path);
        await client.waitForWorkspace(result.project.id, "ready", 90_000);
        const worktreeCount = manifest.seed.projectWorktreeDistribution[repository.index] ?? 0;
        const worktrees: KissopenAgentWorkspace[] = [];
        for (let index = 0; index < worktreeCount; index += 1) {
            const created = await client.createWorkspace(
                result.project.id,
                `${repository.name}-work-${String(index + 1).padStart(2, "0")}`,
            );
            const ready = await client.waitForWorkspace(created.workspace.id, "ready", 90_000);
            worktrees.push(ready);
            createdWorktrees.push({ projectId: result.project.id, workspace: ready });
        }
        projects.push({
            id: result.project.id,
            name: result.project.name ?? repository.name,
            path: result.project.path,
            worktreeIds: worktrees.map((worktree) => worktree.id),
        });
    }
    const archivedCount = Math.max(0, createdWorktrees.length - manifest.target.readyWorktrees);
    const archivedIds = new Set(
        createdWorktrees.slice(0, archivedCount).map((entry) => entry.workspace.id),
    );
    for (const entry of createdWorktrees.slice(0, archivedCount)) {
        await client.archiveWorkspace(entry.workspace);
        await client.waitForWorkspace(entry.workspace.id, "archived", 90_000);
    }

    await Promise.all(
        repositories.map(async (repository) => {
            const readyWorkspacePaths = createdWorktrees
                .filter(
                    (entry) =>
                        entry.projectId === projects[repository.index]?.id &&
                        !archivedIds.has(entry.workspace.id),
                )
                .map((entry) => entry.workspace.path);
            await Promise.all(
                readyWorkspacePaths.map((checkout) => workingTreeChangesApply(checkout, manifest)),
            );
        }),
    );

    const fixtureCounts = await Promise.all(
        repositories.map((repository) => fixtureCountsRead(repository)),
    );
    const fixture = fixtureCounts.reduce(
        (total, current) => ({
            fileCount: total.fileCount + current.fileCount,
            changedFileCount: total.changedFileCount + current.changedFileCount,
            largeFileBytes: total.largeFileBytes + current.largeFileBytes,
            largeFileLines: total.largeFileLines + current.largeFileLines,
        }),
        emptyFixtureCounts(),
    );
    const kissopenAgentWorkspacePath = createdWorktrees.find(
        (entry) => !archivedIds.has(entry.workspace.id),
    )?.workspace.path;
    if (kissopenAgentWorkspacePath === undefined) {
        throw new Error("Gym did not create a ready managed workspace for tool workloads.");
    }
    return { fixture, projects, kissopenAgentWorkspacePath };
}

function scaleFor(manifest: GymManifest): FixtureScale {
    if (manifest.profile === "smoke") {
        return {
            addedFiles: 4,
            generatedFiles: 12,
            largeChangedLines: 160,
            largeLinesPerFile: 240,
            largeTextFiles: 3,
            nestedFiles: 12,
        };
    }
    if (manifest.profile === "realistic") {
        return {
            addedFiles: 16,
            generatedFiles: 48,
            largeChangedLines: 900,
            largeLinesPerFile: 1_800,
            largeTextFiles: 8,
            nestedFiles: 96,
        };
    }
    return {
        addedFiles: 32,
        generatedFiles: 96,
        largeChangedLines: 1_800,
        largeLinesPerFile: 4_000,
        largeTextFiles: 12,
        nestedFiles: 240,
    };
}

async function createRepository(
    root: string,
    index: number,
    manifest: GymManifest,
    environment: NodeJS.ProcessEnv,
): Promise<RepositoryFixture> {
    const scale = scaleFor(manifest);
    const name = `gym-project-${String(index + 1).padStart(2, "0")}`;
    const path = join(root, name);
    await mkdir(path, { recursive: true });
    const largePaths = [
        "src/long-transcript.md",
        ...Array.from(
            { length: scale.largeTextFiles },
            (_, file) => `docs/large/large-${String(file + 1).padStart(3, "0")}.md`,
        ),
        "src/changes/modified/deep/large-modified.md",
        "src/changes/added/deep/added-large.md",
    ];
    const files: Array<readonly [string, string]> = [
        [
            "README.md",
            [
                `# ${name}`,
                "",
                "This repository belongs to the deterministic KISSOPEN Desktop performance Gym.",
                "It exercises real Git project/worktree/file APIs with nested changed files.",
                "",
                "## Pierre Markdown fixture",
                "",
                "The README deliberately contains a fenced block for the rendered Markdown lane.",
                "",
                "```ts",
                "export const markdownWarmPath = 'README.md';",
                "export const renderer = 'pierre';",
                "```",
                "",
            ].join("\n"),
        ],
        [
            "package.json",
            JSON.stringify(
                {
                    name,
                    private: true,
                    scripts: { build: "node ./scripts/build.mjs" },
                },
                null,
                2,
            ) + "\n",
        ],
        [
            "src/long-transcript.md",
            largeLines(
                manifest.seed.longTranscriptLines,
                (line) =>
                    `| ${String(line).padStart(5, "0")} | ${name} | durable transcript fixture | ${"stable ".repeat(8)}|`,
            ),
        ],
        ["scripts/build.mjs", "console.log('deterministic gym fixture build');\n"],
    ];
    for (let file = 0; file < scale.generatedFiles; file += 1) {
        files.push([
            `src/generated/module-${String(file + 1).padStart(3, "0")}.ts`,
            [
                `export const module${file + 1} = {`,
                `    project: ${JSON.stringify(name)},`,
                `    index: ${file + 1},`,
                `    values: [${Array.from({ length: 32 }, (_, value) => value + file).join(", ")}],`,
                "};",
                "",
            ].join("\n"),
        ]);
    }
    for (let file = 0; file < scale.nestedFiles; file += 1) {
        const branch = String((file % 12) + 1).padStart(2, "0");
        const section = String(Math.floor(file / 12) + 1).padStart(2, "0");
        files.push([
            `src/features/feature-${branch}/section-${section}/component-${String(file + 1).padStart(3, "0")}.tsx`,
            [
                `export function Component${file + 1}() {`,
                `    return ${JSON.stringify(`${name} nested fixture ${file + 1}`)};`,
                "}",
                "",
            ].join("\n"),
        ]);
    }
    for (let file = 0; file < scale.largeTextFiles; file += 1) {
        files.push([
            `docs/large/large-${String(file + 1).padStart(3, "0")}.md`,
            largeLines(
                scale.largeLinesPerFile,
                (line) =>
                    `## ${name} large document ${file + 1} · line ${String(line).padStart(5, "0")} · stable fixture text for diff and source rendering`,
            ),
        ]);
    }
    files.push(
        ["src/recent-change.ts", `export const recentChange = ${JSON.stringify(name)};\n`],
        [
            "src/changes/rename-source.ts",
            [
                `export const renameSource = ${JSON.stringify(name)};`,
                "export const renameVersion = 1;",
                "",
            ].join("\n"),
        ],
        [
            "src/changes/delete-me.md",
            `This deterministic file is deleted in the working tree for ${name}.\n`,
        ],
        [
            "src/changes/modified/deep/large-modified.md",
            largeLines(16, (line) => `baseline modified fixture ${line} for ${name}`),
        ],
    );
    for (const [file, content] of files) {
        const destination = join(path, file);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, content, "utf8");
    }
    await runGit(path, ["init", "--quiet", "--initial-branch=main"], environment);
    await runGit(path, ["config", "user.email", "gym@example.invalid"], environment);
    await runGit(path, ["config", "user.name", "KISSOPEN Desktop Gym"], environment);
    await runGit(path, ["add", "."], environment);
    await runGit(path, ["commit", "--quiet", "-m", "Initial deterministic fixture"], environment);
    // KISSOPEN Agent's Git scanner measures working-tree changes against origin/main.
    // The isolated fixture has no network remote, so provide a local remote
    // tracking ref pointing at the real baseline commit instead of making the
    // scanner report an unavailable comparison.
    await runGit(path, ["update-ref", "refs/remotes/origin/main", "HEAD"], environment);
    return { index, largePaths, name, path };
}

async function workingTreeChangesApply(path: string, manifest: GymManifest): Promise<void> {
    const scale = scaleFor(manifest);
    const checkoutLabel = path.split("/").at(-1) ?? "checkout";
    await writeFile(
        join(path, "src/recent-change.ts"),
        [
            `export const recentChange = ${JSON.stringify(`${manifest.profile}-working-tree`)};`,
            `export const changedCheckout = ${JSON.stringify(checkoutLabel)};`,
            "",
        ].join("\n"),
        "utf8",
    );
    await writeFile(
        join(path, "src/changes/modified/deep/large-modified.md"),
        largeLines(
            scale.largeChangedLines,
            (line) =>
                `modified working-tree line ${String(line).padStart(5, "0")} · ${manifest.profile} · ${checkoutLabel}`,
        ),
        "utf8",
    );
    await mkdir(join(path, "src/changes/renamed"), { recursive: true });
    // Leave the rename and deletion unstaged. Kissopen Agent's changed-file projection
    // reads the working-tree diff, so staging these entries would hide them
    // from the UI even though `git status` still reports them.
    await rename(
        join(path, "src/changes/rename-source.ts"),
        join(path, "src/changes/renamed/renamed-source.ts"),
    );
    await writeFile(
        join(path, "src/changes/renamed/renamed-source.ts"),
        [
            `export const renameSource = ${JSON.stringify(checkoutLabel)};`,
            "export const renameVersion = 2;",
            "",
        ].join("\n"),
        "utf8",
    );
    await unlink(join(path, "src/changes/delete-me.md"));
    for (let file = 0; file < scale.addedFiles; file += 1) {
        const destination =
            file === 0
                ? join(path, "src/changes/added/deep/added-large.md")
                : join(
                      path,
                      `src/changes/added/deep/added-${String(file + 1).padStart(3, "0")}.ts`,
                  );
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(
            destination,
            file === 0
                ? largeLines(
                      scale.largeChangedLines,
                      (line) =>
                          `added working-tree line ${String(line).padStart(5, "0")} · ${manifest.profile} · ${checkoutLabel}`,
                  )
                : [
                      `export const addedFixture${file + 1} = ${JSON.stringify(checkoutLabel)};`,
                      `export const addedIndex = ${file + 1};`,
                      "",
                  ].join("\n"),
            "utf8",
        );
    }
}

async function fixtureCountsRead(repository: RepositoryFixture): Promise<GymFixtureCounts> {
    const files = (
        await runGitCapture(repository.path, [
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ])
    )
        .split("\0")
        .filter((file) => file.length > 0);
    const status = (
        await runGitCapture(repository.path, ["status", "--porcelain=v1", "--untracked-files=all"])
    )
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
    let largeFileBytes = 0;
    let largeFileLines = 0;
    for (const file of repository.largePaths) {
        const content = await readFile(join(repository.path, file));
        largeFileBytes += content.byteLength;
        largeFileLines += content.toString("utf8").split("\n").length - 1;
    }
    const existingFiles = await Promise.all(
        files.map(async (file) => {
            try {
                return (await stat(join(repository.path, file))).isFile();
            } catch {
                return false;
            }
        }),
    );
    return {
        changedFileCount: status.length,
        fileCount: existingFiles.filter(Boolean).length,
        largeFileBytes,
        largeFileLines,
    };
}

function largeLines(count: number, line: (line: number) => string): string {
    return `${Array.from({ length: count }, (_, index) => line(index + 1)).join("\n")}\n`;
}

function emptyFixtureCounts(): GymFixtureCounts {
    return {
        changedFileCount: 0,
        fileCount: 0,
        largeFileBytes: 0,
        largeFileLines: 0,
    };
}

async function runGit(
    cwd: string,
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
): Promise<void> {
    await execFileAsync("git", args, {
        cwd,
        env: { ...environment, GIT_TERMINAL_PROMPT: "0" },
        maxBuffer: 4 * 1024 * 1024,
        timeout: 60_000,
    });
}

async function runGitCapture(cwd: string, args: readonly string[]): Promise<string> {
    const result = await execFileAsync("git", args, {
        cwd,
        env: {
            HOME: process.env.HOME,
            LANG: "C.UTF-8",
            PATH: process.env.PATH,
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
        },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 60_000,
    });
    return result.stdout;
}
