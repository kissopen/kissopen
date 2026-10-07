import type { GymManifest, GymProfile } from "./types.js";

const measuredBaselineHostSnapshot = {
    messages: 55_890,
} as const;

const measuredBaseline = {
    totalProjects: 17,
    regularProjects: 16,
    totalWorktrees: 45,
    readyWorktrees: 8,
    archivedWorktrees: 37,
    sessions: 524,
    primarySessions: 151,
    subagentShapedSessions: 373,
    turns: 1_411,
    // A seeded turn must persist both its user prompt and agent response.
    messageRange: [2 * 1_411, 55_890],
    fileCount: 2_800,
    changedFileCount: 336,
    largeFileBytes: 26_395_200,
    largeFileLines: 268_800,
} as const;

const limitation =
    "KISSOPEN Agent 0.2.0 exposes no public endpoint for manufacturing subagent rows. " +
    "This dataset creates the measured session-row load through supported session APIs and " +
    "represents the subagent population with deterministic, tool-heavy primary-session history; " +
    "it never fabricates SQLite rows.";

const manifests: Readonly<Record<GymProfile, GymManifest>> = {
    smoke: {
        schemaVersion: 1,
        datasetVersion: "electron-performance-v1-smoke",
        profile: "smoke",
        label: "Small deterministic launch and warm-cache lane",
        hostSnapshot: { messages: 60 },
        target: {
            totalProjects: 2,
            regularProjects: 1,
            totalWorktrees: 2,
            readyWorktrees: 1,
            archivedWorktrees: 1,
            sessions: 6,
            primarySessions: 6,
            subagentShapedSessions: 3,
            turns: 30,
            messageRange: [60, 64],
            fileCount: 38,
            changedFileCount: 9,
            largeFileBytes: 101_280,
            largeFileLines: 1_120,
        },
        seed: {
            projectWorktreeDistribution: [2],
            historySessions: 4,
            historyTurnsPerSession: 2,
            clusterSessionCount: 4,
            clusterTurnsPerSession: 24,
            longChatSessionCount: 1,
            longChatTurnsPerSession: 24,
            longChatResponseLines: 256,
            longTranscriptLines: 80,
            toolHeavyTurns: 0,
            exactSubagentRows: false,
            limitation,
        },
    },
    realistic: {
        schemaVersion: 1,
        datasetVersion: "electron-performance-v1-realistic",
        profile: "realistic",
        label: "Measured local KISSOPEN Agent catalog shape with long durable history",
        hostSnapshot: measuredBaselineHostSnapshot,
        target: measuredBaseline,
        seed: {
            projectWorktreeDistribution: [19, 15, 8, 2, 1, ...Array.from({ length: 11 }, () => 0)],
            historySessions: 524,
            historyTurnsPerSession: 3,
            clusterSessionCount: 4,
            clusterTurnsPerSession: 80,
            longChatSessionCount: 8,
            longChatTurnsPerSession: 80,
            longChatResponseLines: 1_200,
            longTranscriptLines: 600,
            toolHeavyTurns: 32,
            exactSubagentRows: false,
            limitation,
        },
    },
    stress: {
        schemaVersion: 1,
        datasetVersion: "electron-performance-v1-stress",
        profile: "stress",
        label: "Oversized catalog and transcript retention lane",
        hostSnapshot: { messages: 110_000 },
        target: {
            totalProjects: 24,
            regularProjects: 23,
            totalWorktrees: 72,
            readyWorktrees: 16,
            archivedWorktrees: 56,
            sessions: 1_024,
            primarySessions: 1_024,
            subagentShapedSessions: 700,
            turns: 3_000,
            messageRange: [2 * 3_000, 110_000],
            fileCount: 8_901,
            changedFileCount: 851,
            largeFileBytes: 120_957_000,
            largeFileLines: 1_214_400,
        },
        seed: {
            projectWorktreeDistribution: [
                24,
                20,
                12,
                8,
                5,
                3,
                ...Array.from({ length: 17 }, () => 0),
            ],
            historySessions: 1_024,
            historyTurnsPerSession: 3,
            clusterSessionCount: 4,
            clusterTurnsPerSession: 120,
            longChatSessionCount: 12,
            longChatTurnsPerSession: 120,
            longChatResponseLines: 2_400,
            longTranscriptLines: 1_200,
            toolHeavyTurns: 96,
            exactSubagentRows: false,
            limitation,
        },
    },
};

export function gymManifestRead(profile: GymProfile): GymManifest {
    return manifests[profile];
}

export function gymProfilesList(): readonly GymProfile[] {
    return ["smoke", "realistic", "stress"];
}
