/* Scheduled tasks in a card overview; setup and history stay in a dialog.
 * The server owns all scheduling and execution. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Banner,
    ScheduledTaskLibrary,
    ScheduledTaskDialog,
    ScheduledTaskDetails,
    Select,
    ScheduledTaskCreateDialog,
} from "kissopen-desktop-ui";
import { t } from "kissopen-desktop-state";
import type { Schedule, ScheduleMachine, ScheduleRun } from "kissopen-desktop-state";
import {
    notificationChoiceRead,
    notificationChoiceSet,
    scheduleDelete,
    scheduleRunCancel,
    scheduleRunRead,
    scheduleRunsRead,
    scheduleStatusSet,
    scheduleUpdate,
    scheduleRunNow,
    schedulesRead,
    scheduleCreateDirect,
    type CloudRequest,
} from "./relayCloudApi";
import { RelayScheduleCreate } from "./relayScheduleCreate";
import type { RelayMachineView, RelayProjectView, RelaySessionView } from "../shared/relayContract";
import { relayMachineName } from "./relayStore";
import {
    absolute,
    describeNextRun,
    describeRecurrence,
    describeRun,
    describeStatus,
    describeTarget,
    runFinished,
} from "./relayScheduleText";

/*
How often to look again.

Something other than this window moves the list: the server fires the triggers,
so a run can start and finish while the page is only open. The phone re-reads
on the same rhythm, and the two agreeing is worth more than either being
cleverer.
*/
const LIST_INTERVAL_MS = 20_000;
const RUNS_INTERVAL_MS = 15_000;

export function RelaySchedulesView(props: {
    readonly request: CloudRequest;
    /** Self-hosted clients must not offer a commercial cloud execution target. */
    readonly allowCloud?: boolean;
    readonly localProjects?: readonly { path: string; name: string }[];
    /** The account's machines, so a task can be sent to one and named by it. */
    readonly machines: readonly RelayMachineView[];
    /** Their projects and conversations, which is where a folder's path is known from. */
    readonly projects: readonly RelayProjectView[];
    readonly sessions: readonly RelaySessionView[];
    /**
     * A task an assistant proposed in a conversation. The view opens on a new
     * task with this already said, rather than on the list.
     */
    readonly draft?: string;
    /** The proposal was created or dropped, so it is no longer waiting. */
    readonly onDraftSettled?: () => void;
    /**
     * A task the agent created in a conversation, by ID. The view opens on the
     * list with that task pointed at; its details stay a choice, because they
     * carry Delete and reading them marks its results read.
     */
    readonly focus?: string;
}) {
    const [schedules, setSchedules] = useState<readonly Schedule[]>([]);
    /** Account-service roster plus the native bridge's stable identity. */
    const [ready, setReady] = useState<
        { machines: readonly ScheduleMachine[]; localMachineId?: string } | undefined
    >(undefined);
    /*
     * The places a task can run, and what to call each. The cloud is one
     * place whatever machine happens to host it, so the machine the relay
     * lists as the cloud is folded into that row rather than shown twice.
     */
    const names = useMemo(
        () =>
            new Map([
                ...props.machines.map(
                    (machine) => [machine.id, relayMachineName(machine)] as const,
                ),
                ...(ready?.machines ?? []).map(
                    (machine) => [machine.machine_id, machine.name] as const,
                ),
            ]),
        [props.machines, ready],
    );
    /*
     * One row per computer, not per registration. An Agent reinstalled on the
     * same machine registers again under a new id and the old one stays in
     * the roster; a person picking where a task runs means the computer, and
     * the registration that is live — or was most recently — is the one with
     * a daemon behind it to take the task.
     */
    /*
     * The folders on each machine. The relay's project carries a name; the
     * path is on the conversations held in it, which is the only place the
     * account's key opens it. A project with no conversation whose path can
     * be read is left out rather than offered as a folder nobody can open.
     */
    const projectsOf = useCallback(
        (target: string) => {
            if (props.allowCloud === false && target === `machine:${ready?.localMachineId}`)
                return props.localProjects ?? [];
            const machineId = target.startsWith("machine:") ? target.slice("machine:".length) : "";
            if (!machineId) return [];
            return props.projects
                .filter((project) => project.machineId === machineId)
                .flatMap((project) => {
                    const path = props.sessions.find(
                        (session) =>
                            session.machineId === machineId &&
                            session.projectId === project.id &&
                            session.metadata?.path,
                    )?.metadata?.path;
                    return path ? [{ path, name: project.name ?? path }] : [];
                });
        },
        [props.projects, props.sessions, props.localProjects, props.allowCloud, ready],
    );
    /** The computers the server will accept a task for, once it has said. */
    /** Finished results nobody has looked at. */
    const [unread, setUnread] = useState(0);
    /** What this account asked to be told about, once the server has said. */
    const [notify, setNotify] = useState("all");
    const targets = useMemo(() => {
        /*
         * Which of these computers can actually be given a task.
         *
         * Undefined until the first list answers, and from a server that does
         * not say: then nothing is marked, because refusing a choice on a
         * guess is worse than letting the server refuse it with its reason.
         */
        const readyIds = ready && new Set(ready.machines.map((machine) => machine.machine_id));
        const best = new Map<string, RelayMachineView>();
        for (const machine of props.machines) {
            if (machine.kind === "cloud") continue;
            const name = relayMachineName(machine);
            const held = best.get(name);
            if (
                !held ||
                Number(machine.active) - Number(held.active) > 0 ||
                (machine.active === held.active && machine.activeAt > held.activeAt)
            )
                best.set(name, machine);
        }
        return [
            ...(props.allowCloud === false
                ? []
                : [{ value: "cloud", label: t("Cloud workspace") }]),
            ...[...best.values()].map((machine) => {
                const name =
                    machine.kind === "this"
                        ? t("This computer ({name})", { name: relayMachineName(machine) })
                        : relayMachineName(machine);
                /*
                 * A computer whose desktop has never asked for runs cannot be
                 * given one: it is offered, so the person can see it is theirs,
                 * and disabled with the one thing that makes it usable. Before
                 * this it looked available and only said no at the last step,
                 * after the whole task had been settled.
                 */
                if (readyIds && !readyIds.has(machine.id)) {
                    return {
                        value: `machine:${machine.id}`,
                        label: t("{name} — open KissOpen Desktop on it once", { name }),
                        disabled: true,
                    };
                }
                return { value: `machine:${machine.id}`, label: name };
            }),
            ...(ready?.machines ?? [])
                .filter((machine) => !props.machines.some((item) => item.id === machine.machine_id))
                .map((machine) => ({
                    value: `machine:${machine.machine_id}`,
                    label:
                        machine.machine_id === ready?.localMachineId
                            ? t("This computer ({name})", { name: machine.name })
                            : machine.name,
                })),
        ];
    }, [props.machines, ready, props.allowCloud]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);
    /*
     * The task whose edit form is open. Editing starts from its details, and
     * closing the form — saved or not — goes back to them.
     */
    const [editingId, setEditingId] = useState<string | null>(null);
    const runNow = async (scheduleId: string) => {
        const run = await scheduleRunNow(props.request, scheduleId);
        setSchedules((current) =>
            current.map((item) => (item.id === scheduleId ? { ...item, last_run: run } : item)),
        );
    };
    // A conversation proposal opens the setup dialog immediately; the card
    // overview remains mounted underneath so closing it preserves its position.
    const [composing, setComposing] = useState(props.draft !== undefined);

    const reload = useCallback(
        async (signal: { cancelled: boolean }) => {
            try {
                const read = await schedulesRead(props.request);
                if (signal.cancelled) return;
                setSchedules(read.schedules);
                setUnread(read.unread);
                if (read.machines)
                    setReady({
                        machines: read.machines,
                        ...(read.localMachineId ? { localMachineId: read.localMachineId } : {}),
                    });
                setError("");
            } catch (thrown) {
                if (!signal.cancelled) setError((thrown as Error).message);
            } finally {
                if (!signal.cancelled) setLoading(false);
            }
        },
        [props.request],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        if (props.allowCloud !== false)
            void (async () => {
                try {
                    const choice = await notificationChoiceRead(props.request);
                    if (!signal.cancelled) setNotify(choice);
                } catch {
                    // The default stands. A preference that could not be read is
                    // not worth an error on the page it sits in the corner of.
                }
            })();
        void reload(signal);
        const timer = setInterval(
            () => {
                if (document.visibilityState === "visible") void reload(signal);
            },
            props.allowCloud === false ? 2000 : LIST_INTERVAL_MS,
        );
        return () => {
            signal.cancelled = true;
            clearInterval(timer);
        };
    }, [reload, props.allowCloud]);

    // A plan somebody deleted elsewhere is closed rather than left showing a
    // detail pane for something the account no longer has.
    const open = useMemo(
        () => schedules.find((schedule) => schedule.id === openId),
        [schedules, openId],
    );
    useEffect(() => {
        if (openId && !open) setOpenId(null);
    }, [openId, open]);

    const act = useCallback(
        async (work: () => Promise<void>) => {
            try {
                await work();
                await reload({ cancelled: false });
            } catch (thrown) {
                setError((thrown as Error).message);
            }
        },
        [reload],
    );

    return (
        <ScheduledTaskLibrary
            loading={loading}
            {...(props.focus === undefined ? {} : { focusedId: props.focus })}
            description={
                unread > 0
                    ? t("{count} 个结果还没看过。", { count: unread })
                    : t("你安排的事，助手会按时完成。这里也包含对话中创建的任务。")
            }
            schedules={schedules.map((schedule) => ({
                id: schedule.id,
                name: schedule.name,
                instruction: schedule.instruction,
                status: schedule.status,
                statusLabel: describeStatus(schedule),
                recurrence: describeRecurrence(schedule),
                nextRun: describeNextRun(schedule) ?? "",
                lastRun: describeRun(schedule.last_run),
                target: describeTarget(schedule, names),
                project: schedule.project_path
                    ? {
                          id: JSON.stringify([schedule.target, schedule.project_path]),
                          name: schedule.project_name || schedule.project_path,
                      }
                    : null,
                onOpen: () => {
                    setOpenId(schedule.id);
                    setComposing(false);
                },
                onToggle: (enabled) =>
                    act(() =>
                        scheduleStatusSet(
                            props.request,
                            schedule.id,
                            enabled ? "active" : "paused",
                        ),
                    ),
                edit: {
                    values: schedule,
                    onSave: async (values) => {
                        const saved = await scheduleUpdate(props.request, schedule.id, {
                            name: values.name,
                            instruction: values.instruction,
                            recurrence: values.recurrence,
                            interval_minutes: values.interval_minutes ?? 0,
                            timezone: values.timezone,
                            weekday: values.weekday,
                            at_minute: values.at_minute,
                            once_at: values.once_at,
                        });
                        setSchedules((current) =>
                            current.map((item) =>
                                item.id === saved.id ? { ...saved, last_run: item.last_run } : item,
                            ),
                        );
                        // The update response omits run history; reconcile any queued runs
                        // withdrawn by the edit without making a successful save look failed.
                        void reload({ cancelled: false });
                    },
                },
            }))}
            onCreate={() => {
                setComposing(true);
                setOpenId(null);
            }}
            editingId={editingId}
            onEditingChange={(id) => {
                if (id === null && editingId !== null) setOpenId(editingId);
                setEditingId(id);
            }}
            notificationControl={
                props.allowCloud === false ? null : (
                    <Select
                        aria-label={t("Tell me when one finishes")}
                        options={[
                            { value: "all", label: t("Tell me every result") },
                            { value: "failures", label: t("Tell me only about failures") },
                            { value: "off", label: t("Do not tell me") },
                        ]}
                        value={notify}
                        onValueChange={(next) => {
                            const before = notify;
                            setNotify(next);
                            void notificationChoiceSet(props.request, next).catch((thrown) => {
                                setNotify(before);
                                setError((thrown as Error).message);
                            });
                        }}
                    />
                )
            }
            notices={
                error ? (
                    <Banner tone="danger" title={t("Scheduled tasks")}>
                        {error}
                    </Banner>
                ) : null
            }
            dialog={
                composing && props.allowCloud === false ? (
                    <ScheduledTaskCreateDialog
                        targets={targets}
                        projects={projectsOf}
                        {...(props.draft === undefined ? {} : { initialInstruction: props.draft })}
                        onClose={() => {
                            setComposing(false);
                            props.onDraftSettled?.();
                        }}
                        onSave={async (values, target, project) => {
                            await scheduleCreateDirect(props.request, {
                                ...values,
                                target,
                                kind: "task",
                                ...(project
                                    ? { project_path: project.path, project_name: project.name }
                                    : {}),
                            });
                            setComposing(false);
                            props.onDraftSettled?.();
                            void reload({ cancelled: false });
                        }}
                    />
                ) : composing ? (
                    <ScheduledTaskDialog
                        title={t("新建任务")}
                        composing
                        onClose={() => {
                            setComposing(false);
                            props.onDraftSettled?.();
                        }}
                    >
                        <RelayScheduleCreate
                            request={props.request}
                            targets={targets}
                            projects={projectsOf}
                            {...(props.draft === undefined ? {} : { initialRequest: props.draft })}
                            onCreated={() => {
                                setComposing(false);
                                props.onDraftSettled?.();
                                void reload({ cancelled: false });
                            }}
                            onCancel={() => {
                                setComposing(false);
                                props.onDraftSettled?.();
                            }}
                        />
                    </ScheduledTaskDialog>
                ) : open ? (
                    <ScheduledTaskDialog
                        title={t("任务详情与运行记录")}
                        onClose={() => setOpenId(null)}
                    >
                        {error ? (
                            <Banner tone="danger" title={t("Scheduled tasks")}>
                                {error}
                            </Banner>
                        ) : null}
                        <ScheduleDetail
                            onRunRead={(runId) => {
                                setUnread((count) => Math.max(0, count - 1));
                                void scheduleRunRead(props.request, open.id, runId).catch(() => {});
                            }}
                            request={props.request}
                            names={names}
                            schedule={open}
                            onStatus={(status) =>
                                void act(() => scheduleStatusSet(props.request, open.id, status))
                            }
                            onDelete={() => void act(() => scheduleDelete(props.request, open.id))}
                            runDisabled={!!open.last_run && !runFinished(open.last_run)}
                            onRun={() => runNow(open.id)}
                            onEdit={() => {
                                setOpenId(null);
                                setEditingId(open.id);
                            }}
                            onCancelRun={(runId) =>
                                void act(() => scheduleRunCancel(props.request, open.id, runId))
                            }
                        />
                    </ScheduledTaskDialog>
                ) : null
            }
        />
    );
}

/** One plan: what it is, and everything it has done. */
function ScheduleDetail(props: {
    readonly request: CloudRequest;
    readonly names: ReadonlyMap<string, string>;
    /** Says one result has now been looked at. */
    readonly onRunRead: (runId: string) => void;
    readonly schedule: Schedule;
    readonly onStatus: (status: "active" | "paused" | "ended") => void;
    readonly onDelete: () => void;
    readonly runDisabled: boolean;
    readonly onRun: () => Promise<void>;
    readonly onEdit: () => void;
    readonly onCancelRun: (runId: string) => void;
}) {
    const [runs, setRuns] = useState<readonly ScheduleRun[]>([]);
    /* Reads the history again now, so a run started here appears without waiting for the next read. */
    const runsReadNow = useRef<(() => void) | undefined>(undefined);
    const runsShownFor = useRef<string | null>(null);
    /*
     * Results this pane has already reported as read.
     *
     * Opening a schedule is looking at its results: they are on screen, in
     * full, with what each one said. The guard is against saying so twice for
     * one run as the list re-polls, not against saying so at all.
     */
    const reported = useRef(new Set<string>());
    const [error, setError] = useState("");
    const scheduleId = props.schedule.id;

    useEffect(() => {
        const signal = { cancelled: false };
        const read = async () => {
            try {
                const answer = await scheduleRunsRead(props.request, scheduleId);
                if (!signal.cancelled) {
                    setRuns(answer);
                    setError("");
                    // On screen is looked at: this pane shows every result in
                    // full, so nothing here stays unread behind a fold.
                    for (const run of answer) {
                        if (run.read_at || reported.current.has(run.id)) continue;
                        if (run.status !== "succeeded" && run.status !== "failed") continue;
                        reported.current.add(run.id);
                        props.onRunRead(run.id);
                    }
                }
            } catch (thrown) {
                if (!signal.cancelled) setError((thrown as Error).message);
            }
        };
        // Another task's history is cleared at once; this task's stays while it is read again.
        if (runsShownFor.current !== scheduleId) setRuns([]);
        runsShownFor.current = scheduleId;
        void read();
        runsReadNow.current = () => void read();
        const timer = setInterval(() => void read(), RUNS_INTERVAL_MS);
        return () => {
            signal.cancelled = true;
            clearInterval(timer);
        };
    }, [props.request, scheduleId]);

    const schedule = props.schedule;
    return (
        <ScheduledTaskDetails
            name={schedule.name}
            instruction={schedule.instruction}
            recurrence={describeRecurrence(schedule)}
            target={describeTarget(schedule, props.names)}
            status={schedule.status}
            statusLabel={describeStatus(schedule)}
            pauseReason={schedule.pause_reason}
            error={error}
            onStatus={props.onStatus}
            onDelete={props.onDelete}
            runDisabled={props.runDisabled}
            onRun={async () => {
                await props.onRun();
                runsReadNow.current?.();
            }}
            onEdit={props.onEdit}
            runs={runs.map((run) => ({
                id: run.id,
                when: absolute(run.scheduled_for),
                status: describeRun(run),
                summary: run.error || run.summary || "",
                ...(runFinished(run) || run.cancel_requested_at > 0
                    ? {}
                    : { onStop: () => props.onCancelRun(run.id) }),
            }))}
        />
    );
}
