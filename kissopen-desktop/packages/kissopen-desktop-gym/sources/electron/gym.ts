import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { catalogSnapshotRead, durableHistorySeed } from "./history.js";
import { gymInferenceServerCreate } from "./inferenceServer.js";
import { gymManifestRead } from "./manifest.js";
import { gymRunPathsCreate, gymRunPathsRead, gymRunPathsWithKissopenAgentWorkspace } from "./paths.js";
import { gitFixturesCreate } from "./fixtures.js";
import { kissopenAgentRuntimeCreate, type StartedKissopenAgentRuntime } from "./kissopenAgentRuntime.js";
import { electronWorkloadsRun } from "./workloads.js";
import type {
    ElectronRunResult,
    GymCatalogSnapshot,
    GymDurableCounts,
    GymFixtureCounts,
    GymManifest,
    GymProfile,
    GymProject,
    GymRunPaths,
    GymRunSummary,
    GymWorkloadName,
} from "./types.js";

const PREPARED_STATE_FILE = "prepared.json";

export interface PreparedGym {
    readonly paths: GymRunPaths;
    readonly manifest: GymManifest;
    readonly projects: readonly GymProject[];
    readonly fixture: GymFixtureCounts;
    readonly sessionIds: readonly string[];
    readonly clusterWorkspaceId: string;
    readonly clusterSessionIds: readonly string[];
    readonly catalog: GymCatalogSnapshot;
    readonly seededTurns: number;
    readonly durableCounts: GymDurableCounts;
    readonly persistedAfterRestart: boolean;
}

export async function gymPrepare(options: {
    readonly profile: GymProfile;
    readonly root?: string;
    readonly artifactDirectory?: string;
}): Promise<PreparedGym> {
    const manifest = gymManifestRead(options.profile);
    const created = await gymRunPathsCreate(
        options.profile,
        options.root,
        options.artifactDirectory,
    );
    let runPaths = created.paths;
    await writeFile(runPaths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const inference = gymInferenceServerCreate(manifest, runPaths.inferenceLog);
    let runtime: StartedKissopenAgentRuntime | undefined;
    try {
        await inference.start();
        runtime = await kissopenAgentRuntimeCreate(runPaths, inference);
        const fixtures = await gitFixturesCreate(runPaths, manifest, runtime.client);
        const projects = fixtures.projects;
        runPaths = gymRunPathsWithKissopenAgentWorkspace(runPaths, fixtures.kissopenAgentWorkspacePath);
        // Git worktrees are mutated after Kissopen Agent creates their checkout. Restart
        // the real daemon once so its file/change projections are rebuilt from
        // the durable dirty trees before sessions are created and consumed by
        // Electron.
        await runtime.stop();
        await inference.start();
        runtime = await kissopenAgentRuntimeCreate(runPaths, inference);
        const history = await durableHistorySeed(runPaths, manifest, projects, runtime, inference);
        runtime = history.runtime;
        const catalog = await catalogSnapshotRead(runtime.client, history.sessionIds);
        // Keep achieved durable scale inspectable even when a versioned target
        // is intentionally not claimed. This file is written before target
        // validation so a failed realistic/stress preparation still reports
        // what the supported Kissopen Agent APIs actually created.
        await writeFile(
            join(runPaths.root, "achieved.json"),
            `${JSON.stringify(
                {
                    schemaVersion: manifest.schemaVersion,
                    profile: manifest.profile,
                    manifest,
                    catalog,
                    durableCounts: history.durableCounts,
                    hostSnapshot: manifest.hostSnapshot,
                    fixture: fixtures.fixture,
                    seededTurns: history.seededTurns,
                    clusterWorkspaceId: history.clusterWorkspaceId,
                    clusterSessionIds: history.clusterSessionIds,
                    streamArtifact: runPaths.streamLog,
                    persistedAfterRestart: history.persistedAfterRestart,
                },
                null,
                2,
            )}\n`,
            "utf8",
        );
        validateCatalog(manifest, catalog);
        validateDurableCounts(manifest, history.durableCounts);
        validateFixtureCounts(manifest, fixtures.fixture);
        const prepared: PreparedGym = {
            paths: runPaths,
            manifest,
            projects,
            fixture: fixtures.fixture,
            sessionIds: history.sessionIds,
            clusterWorkspaceId: history.clusterWorkspaceId,
            clusterSessionIds: history.clusterSessionIds,
            catalog,
            seededTurns: history.seededTurns,
            durableCounts: history.durableCounts,
            persistedAfterRestart: history.persistedAfterRestart,
        };
        await writeFile(
            join(runPaths.root, PREPARED_STATE_FILE),
            `${JSON.stringify(
                {
                    manifest,
                    fixture: fixtures.fixture,
                    projects,
                    sessionIds: history.sessionIds,
                    clusterWorkspaceId: history.clusterWorkspaceId,
                    clusterSessionIds: history.clusterSessionIds,
                    kissopenAgentWorkspacePath: runPaths.kissopenAgentWorkspacePath,
                    catalog,
                    seededTurns: history.seededTurns,
                    durableCounts: history.durableCounts,
                    persistedAfterRestart: history.persistedAfterRestart,
                },
                null,
                2,
            )}\n`,
            "utf8",
        );
        await runtime.stop();
        runtime = undefined;
        return prepared;
    } catch (error) {
        await runtime?.stop().catch(() => undefined);
        await inference.stop().catch(() => undefined);
        throw error;
    }
}

export async function gymRun(options: {
    readonly root: string;
    readonly workload: GymWorkloadName;
    readonly uiTrace?: boolean;
}): Promise<GymRunSummary> {
    const preparedPaths = await gymRunPathsRead(options.root);
    const state = await preparedStateRead(preparedPaths);
    const paths = state.paths;
    await mkdir(paths.artifacts, { recursive: true });
    const inference = gymInferenceServerCreate(state.manifest, paths.inferenceLog);
    let runtime: StartedKissopenAgentRuntime | undefined;
    let electron: ElectronRunResult | undefined;
    try {
        await inference.start();
        runtime = await kissopenAgentRuntimeCreate(paths, inference);
        electron = await electronWorkloadsRun({
            paths,
            manifest: state.manifest,
            projects: state.projects,
            runtime,
            sessionIds: state.sessionIds,
            clusterSessionIds: state.clusterSessionIds,
            workload: options.workload,
            uiTrace: options.uiTrace === true,
        });
        const electronResult = electron;
        if (electronResult === undefined)
            throw new Error("Electron workload did not return a result.");
        const summary: GymRunSummary = {
            root: paths.root,
            profile: state.manifest.profile,
            manifest: state.manifest,
            catalog: await catalogSnapshotRead(runtime.client, state.sessionIds),
            fixture: state.fixture,
            history: {
                seededSessions: state.sessionIds.length,
                seededTurns: state.seededTurns,
                clusterWorkspaceId: state.clusterWorkspaceId,
                clusterSessionIds: state.clusterSessionIds,
                durableCounts: state.durableCounts,
                persistedAfterRestart: state.persistedAfterRestart,
                streamArtifact: paths.streamLog,
            },
            electron: electronResult,
        };
        const summaryPath = join(paths.artifacts, "run-summary.json");
        await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
        const failedSamples = electronResult.samples.filter(
            (sample) => sample.details?.status === "failed",
        );
        if (failedSamples.length > 0) {
            const failures = failedSamples
                .map((sample) => {
                    const error =
                        typeof sample.details?.error === "string"
                            ? `: ${sample.details.error}`
                            : "";
                    return `${sample.name}${error}`;
                })
                .join("; ");
            throw new Error(
                `Electron workload failure was recorded in ${summaryPath}: ${failures}`,
            );
        }
        return {
            ...summary,
            electron: {
                ...electronResult,
                artifacts: [...electronResult.artifacts, summaryPath],
            },
        };
    } finally {
        await runtime?.stop().catch(() => undefined);
        await inference.stop().catch(() => undefined);
    }
}

async function preparedStateRead(paths: GymRunPaths): Promise<PreparedGym> {
    const raw = JSON.parse(await readFile(join(paths.root, PREPARED_STATE_FILE), "utf8")) as {
        readonly manifest: GymManifest;
        readonly projects: readonly GymProject[];
        readonly fixture: GymFixtureCounts;
        readonly sessionIds: readonly string[];
        readonly clusterWorkspaceId: string;
        readonly clusterSessionIds: readonly string[];
        readonly kissopenAgentWorkspacePath: string;
        readonly catalog: GymCatalogSnapshot;
        readonly seededTurns: number;
        readonly durableCounts: GymDurableCounts;
        readonly persistedAfterRestart: boolean;
    };
    return {
        paths: { ...paths, kissopenAgentWorkspacePath: raw.kissopenAgentWorkspacePath },
        manifest: raw.manifest,
        projects: raw.projects,
        fixture: raw.fixture,
        sessionIds: raw.sessionIds,
        clusterWorkspaceId: raw.clusterWorkspaceId,
        clusterSessionIds: raw.clusterSessionIds,
        catalog: raw.catalog,
        seededTurns: raw.seededTurns,
        durableCounts: raw.durableCounts,
        persistedAfterRestart: raw.persistedAfterRestart,
    };
}

function validateCatalog(manifest: GymManifest, catalog: GymCatalogSnapshot): void {
    const expected = manifest.target;
    const failures: string[] = [];
    if (catalog.projectCount !== expected.totalProjects) {
        failures.push(`projects=${catalog.projectCount}, expected=${expected.totalProjects}`);
    }
    if (catalog.worktreeCount !== expected.totalWorktrees) {
        failures.push(`worktrees=${catalog.worktreeCount}, expected=${expected.totalWorktrees}`);
    }
    if (catalog.readyWorktreeCount !== expected.readyWorktrees) {
        failures.push(`ready=${catalog.readyWorktreeCount}, expected=${expected.readyWorktrees}`);
    }
    if (catalog.archivedWorktreeCount !== expected.archivedWorktrees) {
        failures.push(
            `archived=${catalog.archivedWorktreeCount}, expected=${expected.archivedWorktrees}`,
        );
    }
    if (catalog.sessionCount > expected.sessions) {
        failures.push(
            `visibleSessions=${catalog.sessionCount}, durableTarget=${expected.sessions}`,
        );
    }
    if (failures.length > 0) {
        throw new Error(`Gym catalog did not match its versioned manifest: ${failures.join("; ")}`);
    }
}

function validateDurableCounts(manifest: GymManifest, achieved: GymDurableCounts): void {
    const expected = manifest.target;
    const failures: string[] = [];
    const minimumMessages = expected.turns * 2;
    for (const field of ["sessions", "turns"] as const) {
        if (achieved[field] !== expected[field])
            failures.push(`${field}=${achieved[field]}, expected=${expected[field]}`);
    }
    if (expected.messageRange[0] < minimumMessages) {
        failures.push(
            `messageRangeMin=${expected.messageRange[0]}, expectedAtLeast=${minimumMessages}`,
        );
    }
    if (!rangeContains(expected.messageRange, achieved.messages)) {
        failures.push(
            `messages=${achieved.messages}, expectedRange=${expected.messageRange.join("..")}`,
        );
    }
    if (failures.length > 0) {
        throw new Error(
            `Gym durable history did not match its versioned manifest; achieved counts are recorded but the target is not claimed: ${failures.join("; ")}`,
        );
    }
}

function rangeContains(range: readonly [number, number], value: number): boolean {
    return value >= range[0] && value <= range[1];
}

function validateFixtureCounts(manifest: GymManifest, achieved: GymFixtureCounts): void {
    const expected = manifest.target;
    const failures: string[] = [];
    for (const field of [
        "fileCount",
        "changedFileCount",
        "largeFileBytes",
        "largeFileLines",
    ] as const) {
        if (achieved[field] !== expected[field]) {
            failures.push(`${field}=${achieved[field]}, expected=${expected[field]}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(
            `Gym file fixture did not match its versioned manifest; achieved counts are recorded but the target is not claimed: ${failures.join("; ")}`,
        );
    }
}
