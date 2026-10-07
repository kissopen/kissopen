import { createHash } from "node:crypto";
import {
    KissopenAgentApiError,
    type LocalTask,
    type LocalTaskRun,
    type LocalTaskRule,
    type UpdateLocalTask,
} from "@kissopen/kissopen-agent-client";
import type {
    Schedule,
    ScheduleRun,
    ScheduleCreate,
    ScheduleUpdate,
    SchedulesList,
} from "kissopen-desktop-state";
import type { KissopenCloudRequest, KissopenCloudResponse } from "../shared/kissopenCloud";
import {
    KissopenAgentDaemonClient,
    kissopenAgentDaemonPathsResolve,
    kissopenAgentDaemonTokenRead,
} from "./kissopenAgentDaemonClient";

const answer = (status: number, value: unknown): KissopenCloudResponse => ({
    status,
    text: JSON.stringify(value),
});
const options = () => ({ signal: AbortSignal.timeout(15000) });
/** Only projection lives in Electron; no task state, account token or scheduling timer. */
export async function localScheduledTasksRequest(
    request: KissopenCloudRequest,
): Promise<KissopenCloudResponse> {
    try {
        const paths = kissopenAgentDaemonPathsResolve();
        const token = await kissopenAgentDaemonTokenRead(paths.tokenPath);
        if (!token)
            return answer(503, {
                error: "The local Agent is not ready. Scheduled tasks will be available when it connects.",
            });
        const api = new KissopenAgentDaemonClient({ socketPath: paths.socketPath, token })
            .localTasks;
        if (request.path === "/schedules" && request.method === "GET") {
            const tasks: LocalTask[] = [];
            let after: string | undefined;
            for (let page = 0; page < 20; page++) {
                const read = await api.list({ ...(after ? { after } : {}), limit: 100 }, options());
                tasks.push(...read.tasks);
                if (!read.nextCursor) break;
                after = read.nextCursor;
                if (page === 19) throw new Error("There are too many tasks to display at once.");
            }
            const body: SchedulesList = {
                schedules: tasks.map(taskProjection),
                machines: [{ machine_id: "local", name: "This computer", last_seen: Date.now() }],
                local_machine_id: "local",
                unread: tasks.filter(
                    (task) =>
                        task.lastRun?.endedAt !== null &&
                        task.lastRun &&
                        task.lastRun.readAt === null,
                ).length,
            };
            return answer(200, body);
        }
        if (request.path === "/schedules" && request.method === "POST") {
            const body = request.body as unknown as ScheduleCreate & { id?: string };
            if (!body || !validIdentity(body.id))
                return answer(400, {
                    error: "A stable task identity is required. Reopen the task form and try again.",
                });
            if (body.target !== "machine:local" || body.kind === "board")
                return answer(400, { error: "Choose This computer for a local task." });
            const bootstrap = await api.bootstrap(options());
            let agentId: string | undefined;
            if (body.project_path) {
                const project = bootstrap.projects.find(
                    (p) =>
                        p.compute.type === "host" &&
                        p.compute.path === body.project_path &&
                        p.archivedAt === null,
                );
                if (!project)
                    return answer(400, {
                        error: "Choose an existing local project for this task.",
                    });
                agentId = project.agents.find((agent) => agent.archivedAt === null)?.id;
                if (!agentId) {
                    const created = await api.createAgent(
                        {
                            id: agentIdentifier(body.id),
                            workspaceId: project.id,
                            title: body.name,
                        },
                        options(),
                    );
                    agentId = created.agent.id;
                }
            } else {
                agentId = bootstrap.bots?.find(
                    (b) => b.systemKey === "chief_of_staff" && b.archivedAt === null,
                )?.agent.id;
            }
            if (!agentId)
                return answer(409, {
                    error: "Set up a local assistant before creating a scheduled task.",
                });
            const created = await api.create(
                {
                    id: body.id,
                    agentId,
                    name: body.name,
                    instruction: body.instruction,
                    rule: ruleProjection(body),
                },
                options(),
            );
            return answer(201, { schedule: taskProjection(created.task) });
        }
        const match =
            /^\/schedules\/([A-Za-z0-9_-]+)(?:\/(run|runs)(?:\/([A-Za-z0-9_-]+)\/(read|cancel))?)?$/u.exec(
                request.path,
            );
        if (!match)
            return answer(400, {
                error: "Create a local task in the current conversation or Scheduled tasks.",
            });
        const id = match[1]!;
        if (!match[2] && request.method === "GET") {
            const read = await api.get(id, options());
            return answer(200, { schedule: taskProjection(read.task) });
        }
        if (!match[2] && request.method === "POST") {
            const body = request.body as unknown as ScheduleUpdate;
            if (!body || typeof body !== "object")
                return answer(400, {
                    error: "The task update is incomplete. Reopen the task and try again.",
                });
            const patch: UpdateLocalTask = {
                ...(body.name == null ? {} : { name: body.name }),
                ...(body.instruction == null ? {} : { instruction: body.instruction }),
                ...(body.status === undefined
                    ? {}
                    : { status: body.status as UpdateLocalTask["status"] }),
                ...(body.delete === undefined ? {} : { delete: body.delete }),
            };
            if (
                body.recurrence !== undefined ||
                body.timezone !== undefined ||
                body.at_minute !== undefined ||
                body.interval_minutes !== undefined ||
                body.once_at !== undefined ||
                body.weekday !== undefined
            ) {
                const current = await api.get(id, options());
                patch.revision = current.task.revision;
                const previous = taskProjection(current.task);
                patch.rule = ruleProjection({
                    recurrence: body.recurrence ?? previous.recurrence,
                    timezone: body.timezone ?? previous.timezone,
                    interval_minutes: body.interval_minutes ?? previous.interval_minutes,
                    weekday: body.weekday ?? previous.weekday,
                    at_minute: body.at_minute ?? previous.at_minute,
                    once_at: body.once_at ?? previous.once_at,
                });
            }
            return answer(200, {
                schedule: taskProjection((await api.update(id, patch, options())).task),
            });
        }
        if (match[2] === "run" && request.method === "POST") {
            const body = request.body as { id?: string } | undefined;
            if (!body || !validIdentity(body.id))
                return answer(400, {
                    error: "A stable run identity is required. Refresh the task list before trying again.",
                });
            return answer(201, {
                run: runProjection((await api.run(id, { id: body.id }, options())).run),
            });
        }
        if (match[2] === "runs" && !match[3] && request.method === "GET")
            return answer(200, {
                runs: (await api.runs(id, { limit: 200 }, options())).runs.map(runProjection),
            });
        if (match[4] === "read" && request.method === "POST")
            return answer(200, {
                run: runProjection((await api.read(id, match[3]!, options())).run),
            });
        return answer(409, {
            error: "To stop running work, open its conversation and use Stop. Pausing a task only stops future runs.",
        });
    } catch (error) {
        if (error instanceof KissopenAgentApiError)
            return answer(error.status, {
                error:
                    error.status === 404 &&
                    error.message.includes("unavailable in this Agent version")
                        ? "Update the local Agent to enable local scheduled tasks."
                        : error.message,
            });
        return answer(503, {
            error:
                error instanceof Error
                    ? error.message
                    : "The local Agent could not be reached. Your saved tasks have not been changed.",
        });
    }
}
function ruleProjection(
    value: Pick<
        ScheduleCreate,
        "recurrence" | "timezone" | "interval_minutes" | "weekday" | "at_minute" | "once_at"
    >,
): LocalTaskRule {
    return {
        recurrence: value.recurrence as LocalTaskRule["recurrence"],
        timezone: value.timezone,
        ...(value.recurrence === "interval" ? { intervalMinutes: value.interval_minutes } : {}),
        ...(value.recurrence === "weekly" ? { weekday: value.weekday } : {}),
        ...(["daily", "weekdays", "weekly"].includes(value.recurrence)
            ? { atMinute: value.at_minute }
            : {}),
        ...(value.recurrence === "once" ? { onceAt: value.once_at } : {}),
    };
}
function taskProjection(task: LocalTask): Schedule {
    return {
        id: task.id,
        name: task.name,
        instruction: task.instruction,
        target: "machine:local",
        kind: "task",
        project_path: task.projectPath,
        project_name: task.projectName,
        timezone: task.rule.timezone,
        recurrence: task.rule.recurrence,
        interval_minutes: task.rule.intervalMinutes ?? 0,
        weekday: task.rule.weekday ?? 0,
        at_minute: task.rule.atMinute ?? 0,
        once_at: task.rule.onceAt ?? 0,
        next_run_at: task.nextRunAt ?? 0,
        status: task.status,
        catch_up_window: 300000,
        pause_reason: "",
        created_by: "local",
        version: task.revision,
        created: task.createdAt,
        updated: task.updatedAt,
        ...(task.lastRun ? { last_run: runProjection(task.lastRun) } : {}),
    };
}
function runProjection(run: LocalTaskRun): ScheduleRun {
    return {
        id: run.id,
        schedule_id: run.taskId,
        scheduled_for: run.scheduledFor,
        start_before: run.scheduledFor + 300000,
        started_at: run.startedAt ?? 0,
        ended_at: run.endedAt ?? 0,
        status: run.status,
        reconciliation: "",
        cancel_requested_at: 0,
        session_id: run.agentId,
        summary: run.summary,
        error: run.error,
        retry_of_run_id: "",
        delivery_attempts: 1,
        read_at: run.readAt ?? 0,
    };
}
function validIdentity(value: unknown): value is string {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
}
function agentIdentifier(taskId: string): string {
    return "a" + createHash("sha256").update(taskId).digest("hex").slice(0, 23);
}
