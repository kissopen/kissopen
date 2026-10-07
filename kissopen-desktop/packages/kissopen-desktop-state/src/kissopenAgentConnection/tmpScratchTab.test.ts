import { expect, it, vi } from "vitest";
import { connectKissopenAgent } from "./connectKissopenAgent.js";
import type { GroupsState, ProjectGroup } from "./types.js";
import { fakeKissopenAgentDaemonCreate } from "../testing/fakeKissopenAgentDaemon.js";

it("scratch: optimistic workspace and session are in the group stream before the daemon answers", async () => {
    const daemon = fakeKissopenAgentDaemonCreate();
    const connection = connectKissopenAgent({
        endpoint: "http://kissopen-agent.test/",
        token: "token",
        client: daemon.client,
        wait: () => new Promise((resolve) => setTimeout(resolve, 0)),
        now: () => 1_000,
    });
    daemon.projectSeed({ id: "project-a" });
    let projects: readonly ProjectGroup[] = [];
    let state: GroupsState = { connection: "connecting", sessionsComplete: false };
    connection.connectGroups({
        onChange(next, nextState) {
            projects = next;
            state = nextState;
        },
        onError() {},
    });
    await vi.waitFor(() => expect(state.connection).toBe("live"));

    daemon.pause("createWorkspace");
    daemon.pause("createAgent");

    const workspaceId = connection.createWorkspace({ name: "Kigali", projectId: "project-a" });
    const sessionId = connection.createSession(
        { cwd: "", workspaceId },
        new Promise(() => undefined),
    );

    const project = projects.find((candidate) => candidate.id === "project-a");
    const workspace = project?.workspaces.find((candidate) => candidate.id === workspaceId);
    expect(workspace, "optimistic workspace missing from group stream").toBeDefined();
    expect(
        workspace?.sessions.map((session) => session.id),
        "optimistic session missing from workspace group",
    ).toEqual([sessionId]);

    connection.close();
});
