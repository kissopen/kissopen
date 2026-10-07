import { appendFile, writeFile } from "node:fs/promises";

import type {
    GymCatalogSnapshot,
    GymDurableCounts,
    GymManifest,
    GymProject,
    GymRunPaths,
} from "./types.js";
import type { GymKissopenAgentClient } from "./kissopenAgentProtocol.js";
import type { StartedKissopenAgentRuntime } from "./kissopenAgentRuntime.js";
import type { GymInferenceServer } from "./types.js";
import { kissopenAgentRuntimeCreate } from "./kissopenAgentRuntime.js";

const historyCompactionInterval = 16;

export interface SeededHistory {
    readonly runtime: StartedKissopenAgentRuntime;
    readonly sessionIds: readonly string[];
    readonly clusterWorkspaceId: string;
    readonly clusterSessionIds: readonly string[];
    readonly seededTurns: number;
    readonly durableCounts: GymDurableCounts;
    readonly persistedAfterRestart: boolean;
}

export async function durableHistorySeed(
    paths: GymRunPaths,
    manifest: GymManifest,
    projects: readonly GymProject[],
    runtime: StartedKissopenAgentRuntime,
    inference: GymInferenceServer,
): Promise<SeededHistory> {
    const checkouts = await readyCheckouts(projects, runtime.client);
    if (checkouts.length === 0)
        throw new Error("No ready KISSOPEN Agent checkout exists for session seeding.");
    const clusterCheckout =
        checkouts.find((checkout) => checkout.path === paths.kissopenAgentWorkspacePath) ??
        checkouts[0];
    if (clusterCheckout === undefined) {
        throw new Error("No ready managed workspace exists for the durable session cluster.");
    }
    const sessionIds: string[] = [];
    const clusterSessionCount = Math.min(
        Math.max(1, manifest.seed.clusterSessionCount),
        manifest.target.sessions,
    );
    const clusterSessions = await Promise.all(
        Array.from({ length: clusterSessionCount }, () =>
            runtime.client.createAgent(clusterCheckout.workspaceId),
        ),
    );
    const clusterSessionIds = clusterSessions.map((created) => created.agent.id);
    sessionIds.push(...clusterSessionIds);
    const target = manifest.target.sessions;
    for (let index = sessionIds.length; index < target; index += 1) {
        const checkout = checkouts[index % checkouts.length];
        const created = await runtime.client.createAgent(checkout.workspaceId);
        sessionIds.push(created.agent.id);
        if ((index + 1) % 50 === 0 || index + 1 === target) {
            console.log(`Gym seeded ${index + 1}/${target} durable sessions.`);
        }
    }

    let seededTurns = 0;
    const turnsBySession = new Map<string, number>();
    const historySessionCount = Math.min(manifest.seed.historySessions, sessionIds.length);
    const targetTurns = Math.max(0, manifest.target.turns);
    for (
        let sessionIndex = 0;
        sessionIndex < historySessionCount && seededTurns < targetTurns;
        sessionIndex += 1
    ) {
        const sessionId = sessionIds[sessionIndex];
        if (sessionId === undefined) break;
        const turnLimit =
            sessionIndex < manifest.seed.longChatSessionCount
                ? Math.max(
                      manifest.seed.longChatTurnsPerSession,
                      manifest.seed.clusterTurnsPerSession,
                  )
                : manifest.seed.historyTurnsPerSession;
        for (let turn = 0; turn < turnLimit && seededTurns < targetTurns; turn += 1) {
            const mode = seededTurns < manifest.seed.toolHeavyTurns ? "tool-heavy" : "compact";
            const longChatMarker =
                sessionIndex < manifest.seed.longChatSessionCount ? " [gym-long-chat-session]" : "";
            const submission = await runtime.client.sendMessage(
                sessionId,
                `Gym history turn ${turn + 1} for session ${sessionIndex + 1}. ` +
                    `Use the deterministic ${mode} response lane and keep the response stable.` +
                    `${longChatMarker} [gym-history-session-${sessionIndex + 1}-turn-${turn + 1}]`,
            );
            await runtime.client.waitForAgentIdle(sessionId, submission.runId, 90_000);
            seededTurns += 1;
            const sessionTurns = (turnsBySession.get(sessionId) ?? 0) + 1;
            turnsBySession.set(sessionId, sessionTurns);
            if (sessionTurns % historyCompactionInterval === 0) {
                // Keep the visible durable transcript long while bounding the
                // provider context used for the next inference. This exercises
                // the same public compaction path as a user, rather than
                // fabricating or deleting transcript rows.
                await runtime.client.compactAgent(sessionId);
            }
        }
    }
    const durableCounts = await durableCountsRead(sessionIds, runtime.client, seededTurns);
    await appendFile(
        paths.inferenceLog,
        `${JSON.stringify({
            kind: "history-seeded",
            sessions: sessionIds.length,
            turns: seededTurns,
            durableCounts,
            limitation: manifest.seed.limitation,
        })}\n`,
        "utf8",
    );
    await appendFile(paths.streamLog, "", "utf8");
    await writeClusterArtifact(paths.cluster, clusterCheckout.workspaceId, clusterSessionIds);

    const persistedSessionId = sessionIds[0];
    if (persistedSessionId === undefined) {
        throw new Error("KISSOPEN Agent did not create a session for persistence verification.");
    }
    const beforeRestartMessages = await runtime.client.agentMessageCount(persistedSessionId);
    if (beforeRestartMessages === 0) {
        throw new Error("The seeded KISSOPEN Agent has no durable messages before restart.");
    }

    await runtime.stop();
    await inference.start();
    const restarted = await kissopenAgentRuntimeCreate(paths, inference);
    const afterRestart = await restarted.client.getAgent(persistedSessionId);
    const afterRestartMessages = await restarted.client.agentMessageCount(persistedSessionId);
    const persistedAfterRestart =
        afterRestart.agent.id === persistedSessionId &&
        afterRestartMessages >= beforeRestartMessages;
    if (!persistedAfterRestart) {
        throw new Error("KISSOPEN Agent durable history did not survive daemon restart.");
    }
    return {
        runtime: restarted,
        sessionIds,
        clusterWorkspaceId: clusterCheckout.workspaceId,
        clusterSessionIds,
        seededTurns,
        durableCounts,
        persistedAfterRestart,
    };
}

async function writeClusterArtifact(
    path: string,
    workspaceId: string,
    sessionIds: readonly string[],
): Promise<void> {
    await writeFile(
        path,
        `${JSON.stringify(
            {
                schemaVersion: 1,
                workspaceId,
                sessionIds,
            },
            null,
            2,
        )}\n`,
        "utf8",
    );
}

async function durableCountsRead(
    sessionIds: readonly string[],
    client: GymKissopenAgentClient,
    turns: number,
): Promise<GymDurableCounts> {
    const batchSize = 32;
    let messages = 0;
    for (let offset = 0; offset < sessionIds.length; offset += batchSize) {
        const batch = sessionIds.slice(offset, offset + batchSize);
        const counts = await Promise.all(
            batch.map(async (sessionId) => await client.agentMessageCount(sessionId)),
        );
        messages += counts.reduce((total, count) => total + count, 0);
    }
    return {
        messages,
        sessions: sessionIds.length,
        turns,
    };
}

export async function catalogSnapshotRead(
    client: GymKissopenAgentClient,
    expectedSessionIds?: readonly string[],
): Promise<GymCatalogSnapshot> {
    const registeredProjects = await client.projects();
    const workspaceLists = await Promise.all(
        registeredProjects.projects.map((project) => client.listWorkspaces(project.id)),
    );
    // Current Kissopen Agent includes each registered project's root checkout in this
    // collection; the Gym's worktree target counts only checkouts beside it.
    const projectPaths = new Set(registeredProjects.projects.map((project) => project.path));
    const workspaces = workspaceLists
        .flatMap((result) => result.workspaces)
        .filter((workspace) => !projectPaths.has(workspace.path));
    const agentCount = (await client.agentIds()).length;
    if (expectedSessionIds !== undefined) {
        await persistedSessionIdsVerify(client, expectedSessionIds);
    }
    return {
        // The home project is implicit and omitted by the project list.
        projectCount: registeredProjects.projects.length + 1,
        worktreeCount: workspaces.length,
        readyWorktreeCount: workspaces.filter(
            (workspace) => workspace.status === "active" && workspace.initialization === "ready",
        ).length,
        archivedWorktreeCount: workspaces.filter(
            (workspace) => workspace.status === "archived" || workspace.archivedAt != null,
        ).length,
        sessionCount: agentCount,
    };
}

async function persistedSessionIdsVerify(
    client: GymKissopenAgentClient,
    sessionIds: readonly string[],
): Promise<void> {
    const batchSize = 32;
    for (let offset = 0; offset < sessionIds.length; offset += batchSize) {
        const batch = sessionIds.slice(offset, offset + batchSize);
        await Promise.all(batch.map((sessionId) => client.getAgent(sessionId)));
    }
}

async function readyCheckouts(
    projects: readonly GymProject[],
    client: GymKissopenAgentClient,
): Promise<readonly { readonly path: string; readonly workspaceId: string }[]> {
    const result: Array<{ readonly path: string; readonly workspaceId: string }> = [];
    for (const project of projects) {
        result.push({ path: project.path, workspaceId: project.id });
        const workspaces = await client.listWorkspaces(project.id);
        for (const workspace of workspaces.workspaces) {
            if (workspace.status === "active" && workspace.initialization === "ready") {
                result.push({ path: workspace.path, workspaceId: workspace.id });
            }
        }
    }
    return result;
}
