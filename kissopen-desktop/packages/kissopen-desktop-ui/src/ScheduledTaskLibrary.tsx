import { useRef, useState, type ReactNode } from "react";
import { t, type Schedule } from "kissopen-desktop-state";
import { Button } from "./Button";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { KissopenPageHeading } from "./KissopenPageHeading";
import { Modal } from "./Modal";
import { ModalOverlay } from "./ModalOverlay";
import { ScrollArea } from "./Scrollbar";
import { SegmentedControl } from "./SegmentedControl";
import { Spinner } from "./Spinner";
import { Switch } from "./Switch";
import { TextField } from "./TextField";
import { Select } from "./Select";

export type ScheduleEditValues = Pick<
    Schedule,
    | "name"
    | "instruction"
    | "recurrence"
    | "timezone"
    | "weekday"
    | "at_minute"
    | "once_at"
    | "interval_minutes"
>;

export type LibrarySchedule = {
    id: string;
    name: string;
    instruction: string;
    status: "active" | "paused" | "ended" | "completed";
    statusLabel: string;
    recurrence: string;
    nextRun: string;
    lastRun: string;
    target: string;
    /** Stable project identity, scoped to its execution location; null for general tasks. */
    project: { id: string; name: string } | null;
    onOpen: () => void;
    onToggle: (enabled: boolean) => void | Promise<void>;
    edit?: { values: ScheduleEditValues; onSave: (values: ScheduleEditValues) => Promise<void> };
};

export function ScheduledTaskLibrary(props: {
    schedules: readonly LibrarySchedule[];
    loading: boolean;
    description: string;
    notificationControl?: ReactNode;
    notices?: ReactNode;
    dialog?: ReactNode;
    onCreate: () => void;
    /**
     * The task the person was sent here to see, by ID — a task created in a
     * conversation, say. Its card is scrolled into view, takes keyboard focus
     * on its name, and wears an accent ring until the person does something
     * here. A task not in the list yet is pointed at when it arrives; one that
     * never arrives leaves the list as it is.
     */
    focusedId?: string;
    /**
     * Which task's edit form is open, when the page decides — it is opened from
     * a task's details, which the page draws. Left out, the library keeps it.
     */
    editingId?: string | null;
    onEditingChange?: (id: string | null) => void;
}) {
    const [grouping, setGrouping] = useState("project");
    const [ownEditingId, setOwnEditingId] = useState<string | null>(null);
    const editingId = props.onEditingChange ? (props.editingId ?? null) : ownEditingId;
    const setEditingId = props.onEditingChange ?? setOwnEditingId;
    /* The pointed-at task the person has since acted past; its ring is gone. */
    const [focusSettled, setFocusSettled] = useState<string | null>(null);
    const focused = props.focusedId === focusSettled ? undefined : props.focusedId;
    const focusSettle = () => {
        if (focused !== undefined) setFocusSettled(focused);
    };
    const editing = props.schedules.find((item) => item.id === editingId);
    const groups =
        grouping === "project"
            ? groupSchedulesByProject(props.schedules)
            : grouping === "status"
              ? [
                    {
                        id: "active",
                        name: t("正在安排"),
                        items: props.schedules.filter((item) => item.status === "active"),
                    },
                    {
                        id: "paused",
                        name: t("已暂停"),
                        items: props.schedules.filter((item) => item.status === "paused"),
                    },
                    {
                        id: "ended",
                        name: t("已结束"),
                        items: props.schedules.filter(
                            (item) => item.status === "ended" || item.status === "completed",
                        ),
                    },
                ]
              : [...new Set(props.schedules.map((item) => item.target))].map((target) => ({
                    id: target,
                    name: target,
                    items: props.schedules.filter((item) => item.target === target),
                }));
    return (
        <>
            <div className="work-library-page">
                <KissopenPageHeading
                    eyebrow={`${t("KissOpen")} · ${t("让工作按时发生")}`}
                    title={t("计划任务")}
                    description={props.description}
                    actions={
                        <Button icon="plus" onClick={props.onCreate}>
                            {t("新建任务")}
                        </Button>
                    }
                />
                <ScrollArea className="work-library" viewportClassName="work-library__viewport">
                    <div
                        className="work-library__content"
                        data-headed=""
                        onKeyDown={focusSettle}
                        onPointerDown={focusSettle}
                    >
                        <div className="work-library__toolbar">
                            <SegmentedControl
                                aria-label={t("任务分组")}
                                value={grouping}
                                onChange={setGrouping}
                                segments={[
                                    { value: "project", label: t("按项目"), icon: "inbox" },
                                    { value: "status", label: t("按状态"), icon: "tasks" },
                                    { value: "target", label: t("按执行位置"), icon: "globe" },
                                ]}
                            />
                            <div className="work-library__notification">
                                <Icon name="bell" size={16} />
                                {props.notificationControl}
                            </div>
                        </div>
                        {props.notices}
                        {props.loading && props.schedules.length === 0 ? (
                            <div className="work-library__pending" role="status">
                                <Spinner size={16} />
                                {t("Reading your scheduled tasks…")}
                            </div>
                        ) : props.schedules.length === 0 ? (
                            <EmptyState
                                icon="clock"
                                title={t("把重复的事，交给助手")}
                                description={t(
                                    "比如：每周五下午整理本周进展。说清要做什么、什么时候做，确认后就能开始。",
                                )}
                                action={{ label: t("新建任务"), onClick: props.onCreate }}
                            />
                        ) : (
                            groups
                                .filter((group) => group.items.length > 0)
                                .map((group) => (
                                    <section key={group.id} className="work-library__section">
                                        <h2>
                                            {group.name}
                                            <span className="work-library__count">
                                                {group.items.length}
                                            </span>
                                        </h2>
                                        <div className="work-library__cards">
                                            {group.items.map((item) => (
                                                <article
                                                    key={item.id}
                                                    className="work-library__card work-library__task"
                                                    data-ended={
                                                        item.status === "ended" ||
                                                        item.status === "completed"
                                                    }
                                                    data-focused={focused === item.id}
                                                    ref={
                                                        focused === item.id
                                                            ? scheduleCardReveal
                                                            : undefined
                                                    }
                                                >
                                                    <div className="work-library__card-head">
                                                        <span className="work-library__mark">
                                                            <Icon name="clock" size={24} />
                                                        </span>
                                                        <div className="work-library__naming">
                                                            <button
                                                                type="button"
                                                                className="work-library__title-button"
                                                                onClick={item.onOpen}
                                                            >
                                                                {item.name}
                                                            </button>
                                                            <span>{item.statusLabel}</span>
                                                        </div>
                                                        {item.status === "active" ||
                                                        item.status === "paused" ? (
                                                            <TaskSwitch item={item} />
                                                        ) : null}
                                                    </div>
                                                    <p
                                                        className="work-library__description"
                                                        title={item.instruction}
                                                    >
                                                        {item.instruction}
                                                    </p>
                                                    <div className="work-library__task-meta">
                                                        <span>
                                                            <Icon name="clock" size={14} />
                                                            {item.recurrence}
                                                        </span>
                                                        <span>
                                                            <Icon name="globe" size={14} />
                                                            {item.target}
                                                        </span>
                                                    </div>
                                                    <footer className="work-library__card-footer">
                                                        <div className="work-library__run">
                                                            <span>
                                                                {item.nextRun || item.statusLabel}
                                                            </span>
                                                            <small>{item.lastRun}</small>
                                                        </div>
                                                        <Button
                                                            size="small"
                                                            variant="ghost"
                                                            icon="history"
                                                            onClick={item.onOpen}
                                                        >
                                                            {t("详情与记录")}
                                                        </Button>
                                                    </footer>
                                                </article>
                                            ))}
                                        </div>
                                    </section>
                                ))
                        )}
                    </div>
                </ScrollArea>
            </div>
            {editing?.edit ? (
                <ScheduleEditDialog
                    key={editing.id}
                    edit={editing.edit}
                    target={editing.target}
                    onClose={() => setEditingId(null)}
                />
            ) : (
                props.dialog
            )}
        </>
    );
}

/**
 * Shows the pointed-at card: centred in the library's own scrollport, so the
 * page around the library does not move, and its name focused, so the
 * keyboard starts where the eye does. A ref callback rather than an effect —
 * it runs when the card is attached, which is when the task arrives. Stable
 * at module scope, so later renders of the same card do not run it again.
 */
function scheduleCardReveal(card: HTMLElement | null) {
    if (!card) return;
    const viewport = card.closest(".work-library__viewport");
    if (viewport) {
        const port = viewport.getBoundingClientRect();
        const box = card.getBoundingClientRect();
        if (box.top < port.top || box.bottom > port.bottom)
            viewport.scrollTop += box.top - port.top - Math.max(0, (port.height - box.height) / 2);
    }
    card.querySelector<HTMLElement>(".work-library__title-button")?.focus({ preventScroll: true });
}

/*
Runs the task once now, from its details. Its own pending state and one line of
feedback under the actions: the submission is quick, and what the run does is
followed in the history just below.
*/
function ScheduledTaskRun(props: { onRun: () => Promise<void>; disabled: boolean }) {
    const busy = useRef(false);
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
    return (
        <>
            <Button
                variant="secondary"
                icon="play"
                loading={pending}
                disabled={props.disabled}
                aria-busy={pending}
                title={pending ? t("正在提交…") : props.disabled ? t("任务进行中") : t("立即运行")}
                onClick={async () => {
                    if (busy.current || props.disabled) return;
                    busy.current = true;
                    setPending(true);
                    setFeedback(null);
                    try {
                        await props.onRun();
                        setFeedback({
                            error: false,
                            message: t("已提交运行，请在记录中查看进展。"),
                        });
                    } catch (error) {
                        setFeedback({
                            error: true,
                            message:
                                error instanceof Error ? error.message : t("提交失败，请重试。"),
                        });
                    } finally {
                        busy.current = false;
                        setPending(false);
                    }
                }}
            >
                {t("立即运行")}
            </Button>
            {feedback ? (
                <span
                    className="work-library__action-feedback"
                    data-error={feedback.error}
                    role={feedback.error ? "alert" : "status"}
                >
                    {feedback.message}
                </span>
            ) : null}
        </>
    );
}

function localDateTime(at: number) {
    if (!at) return "";
    const date = new Date(at);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ScheduleEditDialog(props: {
    edit: NonNullable<LibrarySchedule["edit"]>;
    target: string;
    onClose: () => void;
    title?: string;
    submitLabel?: string;
    beforeFields?: ReactNode;
    description?: string;
    creating?: boolean;
}) {
    // A draft is captured once on opening; background refreshes must not overwrite typing.
    const [initial] = useState(props.edit.values);
    const [name, setName] = useState(initial.name);
    const [instruction, setInstruction] = useState(initial.instruction);
    const [recurrence, setRecurrence] = useState(initial.recurrence);
    const [weekday, setWeekday] = useState(String(initial.weekday));
    const [interval, setInterval] = useState(String(initial.interval_minutes || 30));
    const [time, setTime] = useState(
        `${String(Math.floor(initial.at_minute / 60)).padStart(2, "0")}:${String(initial.at_minute % 60).padStart(2, "0")}`,
    );
    const [once, setOnce] = useState(localDateTime(initial.once_at));
    const [pending, setPending] = useState(false);
    const busy = useRef(false);
    const [error, setError] = useState("");
    const close = () => {
        if (!busy.current) props.onClose();
    };
    return (
        <ScheduledTaskDialog title={props.title ?? t("编辑任务")} onClose={close}>
            <div className="work-library__edit">
                {props.beforeFields}
                <TextField
                    label={t("任务名称")}
                    value={name}
                    onValueChange={setName}
                    disabled={pending}
                    required
                    fullWidth
                    autoFocus
                />
                <TextField
                    label={t("执行内容")}
                    value={instruction}
                    onValueChange={setInstruction}
                    disabled={pending}
                    multiline
                    rows={4}
                    required
                    fullWidth
                />
                <Select
                    label={t("重复频率")}
                    value={recurrence}
                    disabled={pending}
                    options={[
                        { value: "once", label: t("仅一次") },
                        { value: "interval", label: t("按分钟间隔") },
                        { value: "daily", label: t("每天") },
                        { value: "weekdays", label: t("工作日") },
                        { value: "weekly", label: t("每周") },
                    ]}
                    onValueChange={(value) => {
                        if (
                            value === "once" ||
                            value === "interval" ||
                            value === "daily" ||
                            value === "weekdays" ||
                            value === "weekly"
                        )
                            setRecurrence(value);
                    }}
                />
                {recurrence === "weekly" ? (
                    <Select
                        label={t("星期")}
                        value={weekday}
                        disabled={pending}
                        onValueChange={setWeekday}
                        options={[
                            "Sunday",
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                        ].map((day, index) => ({ value: String(index), label: t(day) }))}
                    />
                ) : null}
                {recurrence === "interval" ? (
                    <TextField
                        label={t("执行间隔（分钟）")}
                        type="text"
                        value={interval}
                        onValueChange={setInterval}
                        disabled={pending}
                        required
                        fullWidth
                        hint={t(
                            "支持 1–10080 分钟。保存或恢复后等待一个间隔首次执行；上一次未结束时不会重复启动。",
                        )}
                    />
                ) : recurrence === "once" ? (
                    <TextField
                        label={t("运行时间")}
                        type="datetime-local"
                        value={once}
                        onValueChange={setOnce}
                        disabled={pending}
                        required
                        fullWidth
                        hint={t("按本机时区：{zone}", {
                            zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        })}
                    />
                ) : (
                    <TextField
                        label={t("运行时间")}
                        type="time"
                        value={time}
                        onValueChange={setTime}
                        disabled={pending}
                        required
                        fullWidth
                        hint={t("任务时区：{zone}", { zone: initial.timezone })}
                    />
                )}
                <p className="work-library__description">
                    {props.description ??
                        `${props.target} · ${t("保存不会改变任务的启用状态，也不会立即运行。")}`}
                </p>
                {error ? (
                    <Banner tone="danger" title={t("无法保存")}>
                        {error}
                    </Banner>
                ) : null}
                <div className="work-library__actions">
                    <Button variant="secondary" disabled={pending} onClick={close}>
                        {t("取消")}
                    </Button>
                    <Button
                        loading={pending}
                        onClick={async () => {
                            if (busy.current) return;
                            setError("");
                            if (!name.trim() || !instruction.trim()) {
                                setError(t("请填写任务名称和执行内容。"));
                                return;
                            }
                            const onceAt =
                                once === localDateTime(initial.once_at)
                                    ? initial.once_at
                                    : new Date(once).getTime();
                            if (
                                recurrence === "once" &&
                                (!Number.isFinite(onceAt) ||
                                    onceAt <= 0 ||
                                    ((props.creating ||
                                        once !== localDateTime(initial.once_at) ||
                                        initial.recurrence !== "once") &&
                                        onceAt <= Date.now()))
                            ) {
                                setError(t("请选择未来的运行时间。"));
                                return;
                            }
                            if (
                                recurrence === "interval" &&
                                (!/^\d+$/.test(interval) ||
                                    Number(interval) < 1 ||
                                    Number(interval) > 10080)
                            ) {
                                setError(t("请输入 1–10080 之间的整数分钟。"));
                                return;
                            }
                            if (
                                recurrence !== "once" &&
                                recurrence !== "interval" &&
                                !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
                            ) {
                                setError(t("请填写有效的运行时间。"));
                                return;
                            }
                            busy.current = true;
                            setPending(true);
                            try {
                                await props.edit.onSave({
                                    ...initial,
                                    name: name.trim(),
                                    instruction: instruction.trim(),
                                    recurrence,
                                    interval_minutes:
                                        recurrence === "interval" ? Number(interval) : 0,
                                    weekday: Number(weekday),
                                    at_minute:
                                        recurrence === "once" || recurrence === "interval"
                                            ? initial.at_minute
                                            : Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
                                    once_at: recurrence === "once" ? onceAt : initial.once_at,
                                });
                                props.onClose();
                            } catch (thrown) {
                                setError(
                                    thrown instanceof Error
                                        ? thrown.message
                                        : t("保存失败，请重试。"),
                                );
                            } finally {
                                busy.current = false;
                                setPending(false);
                            }
                        }}
                    >
                        {props.submitLabel ?? t("保存修改")}
                    </Button>
                </div>
            </div>
        </ScheduledTaskDialog>
    );
}

/** The same time editor as Edit, without a cloud-model parsing dependency. */
export function ScheduledTaskCreateDialog(props: {
    targets: readonly { value: string; label: string; disabled?: boolean }[];
    projects: (target: string) => readonly { path: string; name: string }[];
    initialInstruction?: string;
    onSave: (
        values: ScheduleEditValues,
        target: string,
        project: { path: string; name: string } | undefined,
    ) => Promise<void>;
    onClose: () => void;
}) {
    const [selectedTarget, setTarget] = useState("");
    const target = props.targets.some((item) => item.value === selectedTarget && !item.disabled)
        ? selectedTarget
        : (props.targets.find((item) => !item.disabled)?.value ?? "");
    const [selectedProject, setProject] = useState("");
    const projects = props.projects(target);
    const project = projects.find((item) => item.path === selectedProject);
    const [initial] = useState<ScheduleEditValues>(() => ({
        name: "",
        instruction: props.initialInstruction ?? "",
        recurrence: "daily",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        weekday: 1,
        at_minute: 540,
        once_at: Date.now() + 3600000,
        interval_minutes: 30,
    }));
    return (
        <ScheduleEditDialog
            title={t("新建任务")}
            submitLabel={t("创建任务")}
            target={target}
            onClose={props.onClose}
            creating
            description={t(
                "由选定电脑的本机 Agent 执行。电脑需保持运行并登录；创建后按计划执行，不会立即运行。",
            )}
            beforeFields={
                <>
                    <Select
                        label={t("执行位置")}
                        value={target}
                        options={[...props.targets]}
                        onValueChange={(next) => {
                            setTarget(next);
                            setProject("");
                        }}
                    />
                    <Select
                        label={t("项目")}
                        value={project?.path ?? ""}
                        options={[
                            { value: "", label: t("本机助手（不指定项目）") },
                            ...projects.map((item) => ({ value: item.path, label: item.name })),
                        ]}
                        onValueChange={setProject}
                    />
                </>
            }
            edit={{
                values: initial,
                onSave: async (values) => {
                    if (!target)
                        throw new Error(
                            t("这台电脑尚未准备好接收计划任务，请保持桌面端登录并稍后再试。"),
                        );
                    await props.onSave(values, target, project);
                },
            }}
        />
    );
}

function groupSchedulesByProject(schedules: readonly LibrarySchedule[]) {
    const groups = new Map<string, { id: string; name: string; items: LibrarySchedule[] }>();
    const unassigned: LibrarySchedule[] = [];
    for (const item of schedules) {
        if (!item.project) {
            unassigned.push(item);
            continue;
        }
        const id = `project:${item.project.id}`;
        const group = groups.get(id);
        if (group) group.items.push(item);
        else groups.set(id, { id, name: item.project.name, items: [item] });
    }
    return [...groups.values(), { id: "unassigned", name: t("未关联项目"), items: unassigned }];
}

/** Task setup and history stay in context, without replacing the overview. */
export function ScheduledTaskDialog(props: {
    title: string;
    onClose: () => void;
    composing?: boolean;
    children: ReactNode;
}) {
    return (
        <ModalOverlay>
            <Modal
                title={props.title}
                size="large"
                onClose={props.onClose}
                className="work-library__dialog"
            >
                <div className="work-library__dialog-content" data-composing={props.composing}>
                    {props.children}
                </div>
            </Modal>
        </ModalOverlay>
    );
}

function TaskSwitch({ item }: { item: LibrarySchedule }) {
    const [pending, setPending] = useState(false);
    return (
        <Switch
            aria-label={t("启用 {name}", { name: item.name })}
            checked={item.status === "active"}
            disabled={pending}
            onChange={async (enabled) => {
                setPending(true);
                try {
                    await item.onToggle(enabled);
                } finally {
                    setPending(false);
                }
            }}
        />
    );
}

export function ScheduledTaskDetails(props: {
    name: string;
    instruction: string;
    recurrence: string;
    target: string;
    status: LibrarySchedule["status"];
    statusLabel: string;
    pauseReason?: string;
    error?: string;
    onStatus: (status: "active" | "paused" | "ended") => void;
    onDelete: () => void;
    /** Runs it once now; absent where a task cannot be run by hand. */
    onRun?: () => Promise<void>;
    /** A run is still under way, so another cannot start. */
    runDisabled?: boolean;
    /** Opens its edit form; absent where a task cannot be edited. */
    onEdit?: () => void;
    runs: readonly {
        id: string;
        when: string;
        status: string;
        summary: string;
        onStop?: () => void;
    }[];
}) {
    return (
        <div className="work-library__details">
            <div className="work-library__card-head">
                <span className="work-library__mark">
                    <Icon name="clock" size={24} />
                </span>
                <div className="work-library__naming">
                    <h3>{props.name}</h3>
                    <span>{props.statusLabel}</span>
                </div>
            </div>
            <div className="work-library__detail-rule">
                <span>
                    <Icon name="clock" size={16} />
                    {props.recurrence}
                </span>
                <span>
                    <Icon name="globe" size={16} />
                    {props.target}
                </span>
            </div>
            <p className="work-library__instruction">{props.instruction}</p>
            {props.pauseReason ? (
                <Banner tone="neutral" title={t("Paused by KissOpen")}>
                    {props.pauseReason}
                </Banner>
            ) : null}
            <div className="work-library__actions">
                {props.onRun ? (
                    <ScheduledTaskRun onRun={props.onRun} disabled={props.runDisabled ?? false} />
                ) : null}
                {props.onEdit ? (
                    <Button variant="secondary" icon="edit" onClick={props.onEdit}>
                        {t("编辑")}
                    </Button>
                ) : null}
                {props.status === "active" ? (
                    <Button
                        variant="secondary"
                        icon="pause"
                        onClick={() => props.onStatus("paused")}
                    >
                        {t("Pause")}
                    </Button>
                ) : props.status === "paused" ? (
                    <Button
                        variant="secondary"
                        icon="play"
                        onClick={() => props.onStatus("active")}
                    >
                        {t("Resume")}
                    </Button>
                ) : null}
                {props.status === "active" || props.status === "paused" ? (
                    <Button variant="ghost" onClick={() => props.onStatus("ended")}>
                        {t("End")}
                    </Button>
                ) : null}
                <Button variant="ghost" icon="trash" onClick={props.onDelete}>
                    {t("Delete")}
                </Button>
            </div>
            <section className="work-library__section">
                <h2>
                    {t("Run history")}
                    <span className="work-library__count">{props.runs.length}</span>
                </h2>
                {props.error ? (
                    <Banner tone="danger" title={t("Run history")}>
                        {props.error}
                    </Banner>
                ) : null}
                {props.runs.length === 0 ? (
                    <p className="work-library__description">{t("Has not run yet")}</p>
                ) : (
                    props.runs.map((run) => (
                        <article className="work-library__history" key={run.id}>
                            <header>
                                <span>{run.when}</span>
                                <span>{run.status}</span>
                            </header>
                            <p>{run.summary}</p>
                            {run.onStop ? (
                                <Button size="small" variant="secondary" onClick={run.onStop}>
                                    {t("Stop")}
                                </Button>
                            ) : null}
                        </article>
                    ))
                )}
            </section>
        </div>
    );
}
