/*
The account's scheduled tasks and its cloud workspace's plugins.

Both go to the business API rather than the relay, and both go through the
same guarded transport everything else in this window uses: the main process
holds the credential and decides which paths may be reached at all. Nothing
here chooses a host.

Answers are the server's own shapes, generated from `internal/api`. A field
spelled differently here would compile and then be empty on screen, which is
the failure that takes longest to find.
*/
import type {
    CatalogList,
    CloudPluginConnectionStarted,
    CloudPluginsList,
    Schedule,
    ScheduleRun,
    ScheduleBody,
    ScheduleDraft,
    ScheduleDraftBody,
    ScheduleDraftSaid,
    NotificationSettings,
    ScheduleMachine,
    SchedulesList,
    ScheduleRunsList,
    ScheduleStatus,
    ScheduleUpdate,
    ScheduleCreate,
} from "kissopen-desktop-state";
import { t } from "kissopen-desktop-state";

/** How this window reaches the business API. The renderer owns the transport. */
export type CloudRequest = (
    path: string,
    method?: "GET" | "POST",
    /*
     * An object, because the bridge serialises it as one. A bare value would
     * be accepted here and rejected at the boundary, which is the wrong place
     * to find out.
     */
    body?: Readonly<Record<string, unknown>>,
) => Promise<{ status: number; text: string }>;

/**
 * One call, answered or thrown with something worth showing.
 *
 * The server writes its errors for the reader, in their language, so its own
 * sentence is used where there is one. Inventing a friendlier one here would
 * replace "this plugin needs an account connection" with "request failed".
 */
async function call<T>(
    request: CloudRequest,
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Readonly<Record<string, unknown>>,
): Promise<T> {
    const response = await request(path, method, body);
    let parsed: unknown;
    try {
        parsed = JSON.parse(response.text);
    } catch {
        throw new Error(t("服务器的应答无法解析（{status}）", { status: response.status }));
    }
    if (response.status >= 400) {
        const said = (parsed as { error?: string } | null)?.error;
        throw new CloudCallError(
            response.status,
            said || t("请求失败（{status}）", { status: response.status }),
        );
    }
    return parsed as T;
}

/** Keeps protocol compatibility decisions tied to the HTTP fact, not translated error text. */
export class CloudCallError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "CloudCallError";
    }
}

/**
 * Every schedule the account has, and every computer a new one could go to.
 *
 * The machines come from here rather than from the relay because readiness is
 * the server's fact: a computer can be online, reachable and still refuse a
 * task, because nothing is delivered to it — its desktop comes for the run,
 * and one that has never come has nothing to come with. `machines` absent is
 * an older server, which is "cannot tell" rather than "none are ready".
 */
export async function schedulesRead(request: CloudRequest): Promise<{
    readonly schedules: readonly Schedule[];
    readonly machines?: readonly ScheduleMachine[];
    /** Finished results nobody has looked at, across every schedule. */
    readonly unread: number;
    readonly localMachineId?: string;
}> {
    const body = await call<SchedulesList>(request, "/schedules");
    return {
        schedules: body.schedules ?? [],
        unread: body.unread ?? 0,
        ...(body.machines ? { machines: body.machines } : {}),
        ...(body.local_machine_id ? { localMachineId: body.local_machine_id } : {}),
    };
}

export async function scheduleCreateDirect(
    request: CloudRequest,
    values: ScheduleCreate,
): Promise<Schedule> {
    return (
        await call<ScheduleBody>(request, "/schedules", "POST", {
            ...values,
            id: crypto.randomUUID(),
        })
    ).schedule;
}

/** Runs a schedule now, outside its own times; the run is reported like any other. */
export async function scheduleRunNow(
    request: CloudRequest,
    scheduleId: string,
): Promise<ScheduleRun> {
    const answer = await call<{ run: ScheduleRun }>(
        request,
        `/schedules/${encodeURIComponent(scheduleId)}/run`,
        "POST",
        { id: crypto.randomUUID() },
    );
    return answer.run;
}

/** Saves editable fields without changing the target, project or enabled state. */
export async function scheduleUpdate(
    request: CloudRequest,
    scheduleId: string,
    values: ScheduleUpdate,
): Promise<Schedule> {
    const answer = await call<ScheduleBody>(
        request,
        `/schedules/${encodeURIComponent(scheduleId)}`,
        "POST",
        values,
    );
    return answer.schedule;
}

/**
 * Gives a cloud project the board schedule a new one is made with: rebuilt
 * every morning at nine. For a project made before the cloud built boards,
 * which has none until somebody asks for its board.
 */
export async function cloudBoardScheduleCreate(
    request: CloudRequest,
    project: { readonly path: string; readonly name: string },
): Promise<Schedule> {
    const answer = await call<ScheduleBody>(request, "/schedules", "POST", {
        target: "cloud",
        kind: "board",
        project_path: project.path,
        project_name: project.name,
        name: `构建项目看板：${project.name}`,
        instruction: "构建项目看板",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        recurrence: "daily",
        at_minute: 9 * 60,
    });
    return answer.schedule;
}

/**
 * Marks one result as looked at.
 *
 * The reader's own act: opening the list does not mean every result in it was
 * read, so this is sent when one is actually opened.
 */
export async function scheduleRunRead(
    request: CloudRequest,
    scheduleId: string,
    runId: string,
): Promise<void> {
    await call<{ run?: ScheduleRun }>(
        request,
        `/schedules/${encodeURIComponent(scheduleId)}/runs/${encodeURIComponent(runId)}/read`,
        "POST",
        {},
    );
}

/** What this account asked to be told about a finished task. */
export async function notificationChoiceRead(request: CloudRequest): Promise<string> {
    return (await call<NotificationSettings>(request, "/notifications")).schedules || "all";
}

export async function notificationChoiceSet(
    request: CloudRequest,
    schedules: string,
): Promise<void> {
    await call<NotificationSettings>(request, "/notifications", "POST", { schedules });
}

/** The runs of one schedule, newest first. */
export async function scheduleRunsRead(
    request: CloudRequest,
    scheduleId: string,
): Promise<readonly ScheduleRun[]> {
    const answer = await call<ScheduleRunsList>(
        request,
        `/schedules/${encodeURIComponent(scheduleId)}/runs`,
    );
    return answer.runs ?? [];
}

/** Pauses, resumes or ends one schedule. */
export async function scheduleStatusSet(
    request: CloudRequest,
    scheduleId: string,
    status: ScheduleStatus,
): Promise<void> {
    await call(request, `/schedules/${encodeURIComponent(scheduleId)}`, "POST", { status });
}

/** Deletes one schedule. Withdraws the runs the executor has not accepted. */
export async function scheduleDelete(request: CloudRequest, scheduleId: string): Promise<void> {
    await call(request, `/schedules/${encodeURIComponent(scheduleId)}`, "POST", { delete: true });
}

/**
 * Asks to stop one run.
 *
 * Asking is all it is: work already handed to a machine stops when that
 * machine gets round to it, which is why the run carries the moment the
 * request was made rather than a state called "cancelled".
 */
export async function scheduleRunCancel(
    request: CloudRequest,
    scheduleId: string,
    runId: string,
): Promise<void> {
    await call(
        request,
        `/schedules/${encodeURIComponent(scheduleId)}/runs/${encodeURIComponent(runId)}/cancel`,
        "POST",
        {},
    );
}

/** The plugins installed in the account's cloud workspace. */
export async function pluginsRead(request: CloudRequest): Promise<CloudPluginsList> {
    const answer = await call<CloudPluginsList>(request, "/cloud/plugins");
    return { ...answer, plugins: answer.plugins ?? [] };
}

/** Turns one installed plugin on or off, or removes it. */
export async function pluginSet(
    request: CloudRequest,
    id: string,
    change: { enabled: boolean; remove?: boolean },
): Promise<void> {
    await call(request, `/cloud/plugins/${encodeURIComponent(id)}`, "POST", change);
}

/**
 * Restarts the assistant onto the current selection.
 *
 * Separate from changing the selection on purpose: a person switching three
 * plugins should restart once, when they are done, not three times.
 */
export async function pluginsApply(request: CloudRequest): Promise<void> {
    await call(request, "/cloud/plugins/apply", "POST", {});
}

/**
 * Begins connecting an account to one of a plugin's servers.
 *
 * Answers with where to send the person. The server does the rest when the
 * browser comes back to it; this window only has to notice, by reading the
 * list again, that the server is now connected.
 */
export async function pluginConnectionStart(
    request: CloudRequest,
    id: string,
    server: string,
): Promise<string> {
    const answer = await call<CloudPluginConnectionStarted>(
        request,
        `/cloud/plugins/${encodeURIComponent(id)}/connections/${encodeURIComponent(server)}`,
        "POST",
        {},
    );
    return answer.authorization_url;
}

/** Forgets the account behind one of a plugin's servers. */
export async function pluginConnectionDisconnect(
    request: CloudRequest,
    id: string,
    server: string,
): Promise<void> {
    await call(
        request,
        `/cloud/plugins/${encodeURIComponent(id)}/connections/${encodeURIComponent(server)}/disconnect`,
        "POST",
        {},
    );
}

/** Everything this deployment publishes. */
export async function catalogRead(request: CloudRequest): Promise<CatalogList["plugins"]> {
    return (await call<CatalogList>(request, "/cloud/catalog")).plugins ?? [];
}

/** Installs one published package into the account's workspace. */
export async function catalogInstall(request: CloudRequest, id: string): Promise<void> {
    await call(request, `/cloud/catalog/${encodeURIComponent(id)}`, "POST", {});
}

/*
Reads a sentence as a schedule, without saving one.

Two answers, and only one of them is a plan: either the server understood and
returns a draft to confirm, or it did not and returns the one thing it still
needs to know. The second is not an error — it is the conversation carrying on
— so it comes back as a value rather than a throw.
*/
export async function scheduleDraftRead(
    request: CloudRequest,
    text: string,
    timezone: string,
    /*
     * Everything said before this line, oldest first. The server asks when a
     * sentence does not say when to run, and an answer means nothing without
     * the question: sending only the newest line is how "ten at night" became
     * a schedule the server could not read.
     */
    said: readonly ScheduleDraftSaid[] = [],
): Promise<ScheduleDraftBody> {
    return call<ScheduleDraftBody>(request, "/schedules/draft", "POST", {
        text,
        timezone,
        ...(said.length > 0 ? { said } : {}),
    });
}

/**
 * Creates the schedule a draft describes.
 *
 * The draft's own fields are sent back rather than re-derived: the server
 * worked out the rule and the first occurrence, and a client recomputing
 * either would be a second opinion about when this happens.
 */
export async function scheduleCreate(
    request: CloudRequest,
    draft: ScheduleDraft,
    /** On a work machine, the folder the task runs in; omitted means its assistant. */
    project?: { readonly path: string; readonly name: string },
): Promise<Schedule> {
    const answer = await call<ScheduleBody>(request, "/schedules", "POST", {
        target: draft.target,
        ...(project ? { project_path: project.path, project_name: project.name } : {}),
        name: draft.name,
        instruction: draft.instruction,
        timezone: draft.timezone,
        recurrence: draft.recurrence,
        interval_minutes: draft.interval_minutes ?? 0,
        weekday: draft.weekday,
        at_minute: draft.at_minute,
        once_at: draft.once_at,
    });
    return answer.schedule;
}

/** A project on another computer or in the cloud, as its analysis of new material names it. */
export interface ProjectAnalysisPlace {
    /** `cloud`, or `machine:<id>` for another computer. */
    readonly target: string;
    readonly path: string;
    readonly name: string;
}

/** Whether new material in a project is read by the AI, and when the next reading starts. */
export interface ProjectAnalysis {
    readonly enabled: boolean;
    /** 0 when none is waiting. */
    readonly due_at: number;
    readonly limited?: boolean;
}

export async function projectAnalysisRead(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
): Promise<ProjectAnalysis> {
    return (
        await call<{ analysis: ProjectAnalysis }>(request, "/project-analysis/read", "POST", {
            target: place.target,
            project_path: place.path,
        })
    ).analysis;
}

export async function projectAnalysisSet(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
    enabled: boolean,
): Promise<ProjectAnalysis> {
    return (
        await call<{ analysis: ProjectAnalysis }>(request, "/project-analysis", "POST", {
            target: place.target,
            project_path: place.path,
            project_name: place.name,
            enabled,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        })
    ).analysis;
}

/** Files were just uploaded into the project: its analysis is set for a couple of minutes from now. */
export async function projectFilesUploaded(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
): Promise<ProjectAnalysis> {
    return (
        await call<{ analysis: ProjectAnalysis }>(request, "/project-uploads", "POST", {
            target: place.target,
            project_path: place.path,
            project_name: place.name,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        })
    ).analysis;
}

/** What starting a board card's conversation on another computer or in the cloud answered. */
export interface ProjectCardStarted {
    /** The card's conversation, as the server settled it. */
    readonly agentId: string;
    /** Whether a run was started now; false when the conversation was already there. */
    readonly started: boolean;
    /** Where the run stands, when one was started; `waiting_device` is a computer that is off. */
    readonly runStatus?: string;
}

/**
 * Starts a board card's own conversation where the project is. The server
 * makes a card run that creates the conversation and tells it what the card
 * is for; a conversation that already exists is only named back.
 */
export async function projectCardStart(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
    card: {
        readonly id: string;
        readonly title: string;
        readonly label: string;
        readonly prompt: string;
    },
): Promise<ProjectCardStarted> {
    const answer = await call<{
        agent_id?: string;
        started?: boolean;
        run?: ScheduleRun;
    }>(request, "/schedules", "POST", {
        kind: "card",
        target: place.target,
        project_path: place.path,
        project_name: place.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        card: { id: card.id, title: card.title, label: card.label, prompt: card.prompt },
    });
    return {
        agentId: answer.agent_id ?? "",
        started: answer.started === true,
        ...(answer.run?.status ? { runStatus: answer.run.status } : {}),
    };
}

/**
 * Starts a new conversation in a project on another computer or in the cloud,
 * with the person's first message as it is. Each start is a new conversation;
 * the answer names the agent it will run as, to find in the relay once it is up.
 */
export async function projectChatStart(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
    text: string,
): Promise<ProjectCardStarted> {
    const answer = await call<{
        agent_id?: string;
        started?: boolean;
        run?: ScheduleRun;
    }>(request, "/schedules", "POST", {
        kind: "chat",
        target: place.target,
        project_path: place.path,
        project_name: place.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        instruction: text,
    });
    return {
        agentId: answer.agent_id ?? "",
        started: answer.started === true,
        ...(answer.run?.status ? { runStatus: answer.run.status } : {}),
    };
}

/** Prepares an empty conversation. No user message is sent by the scheduled-run executor. */
export async function projectChatPrepare(
    request: CloudRequest,
    place: ProjectAnalysisPlace,
    name: string,
    startId: string,
): Promise<string> {
    const answer = await call<{ agent_id: string; run?: ScheduleRun }>(
        request,
        "/schedules",
        "POST",
        {
            kind: "conversation",
            target: place.target,
            project_path: place.path,
            project_name: place.name,
            name,
            start_id: startId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        },
    );
    if (!answer.agent_id) throw new Error(t("没能开始新对话。"));
    if (
        answer.run?.status === "failed" ||
        answer.run?.status === "missed" ||
        answer.run?.status === "cancelled"
    )
        throw new Error(answer.run.error || t("没能开始新对话。"));
    return answer.agent_id;
}
