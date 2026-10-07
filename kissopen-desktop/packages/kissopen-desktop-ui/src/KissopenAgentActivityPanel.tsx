import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import type {
    KissopenAgentBackgroundProcess,
    KissopenAgentGoal,
    KissopenAgentGoalStatus,
    SubagentSummary,
    KissopenAgentTask,
    KissopenAgentTaskStatus,
} from "kissopen-desktop-state";
import { Button } from "./Button";
import { CompactActivityRow } from "./CompactActivityRow";
import { DelegatedAgentActivity } from "./DelegatedAgentActivity";
import { Icon } from "./Icon";
import { ScrollArea } from "./Scrollbar";

export type KissopenAgentActivityPanelProps = {
    /** Opens the native Completed disclosure on its first render; omitted is closed. */
    completedInitiallyOpen?: boolean;
    /** The session's persistent goal, when one is set (`/goal`). */
    goal?: KissopenAgentGoal;
    /** The session task list in display order (`/tasks`). */
    tasks: readonly KissopenAgentTask[];
    /** Delegated subagents for the live monitor (`/agents`). */
    subagents: readonly SubagentSummary[];
    /** Running background terminals (`/ps`). */
    backgroundProcesses: readonly KissopenAgentBackgroundProcess[];
    /** Requests termination of one background terminal (`/stop`); omit to hide the control. */
    onBackgroundProcessStop?: (processId: number) => void;
    /** Opens one delegated child session through the owning workspace. */
    onSubagentSelect?: (sessionId: string) => void;
    /** Reference "now" (epoch millis) for computing subagent elapsed time. */
    now: number;
    /** `panel` fills and scrolls a side-panel tab; the default is inline content. */
    placement?: "content" | "panel";
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

const GOAL_STATUS_LABELS: Record<KissopenAgentGoalStatus, string> = {
    active: "Active",
    blocked: "Blocked",
    complete: "Done",
    paused: "Paused",
};

const TASK_STATUS_LABELS: Record<KissopenAgentTaskStatus, string> = {
    pending: "Pending",
    in_progress: "In progress",
    completed: "Done",
};

function priorityOrdered<T>(items: readonly T[], priority: (item: T) => number): readonly T[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort(
            (left, right) => priority(left.item) - priority(right.item) || left.index - right.index,
        )
        .map(({ item }) => item);
}

function taskPriority(task: KissopenAgentTask): number {
    return task.status === "in_progress" ? 0 : task.status === "pending" ? 1 : 2;
}

function subagentPriority(subagent: SubagentSummary): number {
    switch (subagent.status) {
        case "running":
            return 0;
        case "queued":
            return 1;
        case "idle":
            return 2;
        case "suspended":
            return 3;
        case "completed":
            return 4;
        case "aborted":
        case "error":
        case "archived":
            return 5;
    }
}

function SectionHeading(props: { count?: number; label: string }) {
    return (
        <h3 className="kissopen-agent-activity__heading">
            <span
                className="kissopen-agent-activity__heading-label"
                data-kissopen-desktop-ui="kissopen-agent-activity-heading-label"
            >
                {props.label}
            </span>
            {props.count === undefined ? null : (
                <span className="kissopen-agent-activity__count">{props.count}</span>
            )}
        </h3>
    );
}

function GoalSection(props: { goal: KissopenAgentGoal }) {
    const { goal } = props;
    return (
        <section
            className="kissopen-agent-activity__section"
            data-kissopen-desktop-ui="kissopen-agent-activity-goal"
        >
            <SectionHeading label={t("Goal")} />
            <div
                className="kissopen-agent-activity__list"
                data-kissopen-desktop-ui="kissopen-agent-activity-list"
            >
                <CompactActivityRow
                    arguments={[goal.objective]}
                    accessibleLabel={`Goal ${goal.objective}, ${GOAL_STATUS_LABELS[goal.status]}`}
                    icon="tasks"
                    meta={[GOAL_STATUS_LABELS[goal.status]]}
                    placement="panel"
                    verb="Goal"
                />
            </div>
        </section>
    );
}

function TaskRow(props: { task: KissopenAgentTask }) {
    const { task } = props;
    const label = task.status === "in_progress" && task.activeForm ? task.activeForm : task.subject;
    return (
        <li
            className="kissopen-agent-activity__task"
            data-kissopen-desktop-ui="kissopen-agent-activity-task"
        >
            <CompactActivityRow
                arguments={[label]}
                accessibleLabel={`Task ${label}, ${TASK_STATUS_LABELS[task.status]}`}
                icon="tasks"
                meta={[TASK_STATUS_LABELS[task.status]]}
                placement="panel"
                verb="Task"
            />
        </li>
    );
}

function SubagentRow(props: {
    subagent: SubagentSummary;
    now: number;
    onSelect?: (sessionId: string) => void;
}) {
    const { subagent, now } = props;
    return (
        <li
            className="kissopen-agent-activity__subagent"
            data-kissopen-desktop-ui="kissopen-agent-activity-subagent"
        >
            <DelegatedAgentActivity
                child={{
                    sessionId: subagent.id,
                    description: subagent.description,
                    ...(subagent.taskName === undefined ? {} : { taskName: subagent.taskName }),
                    modelId: subagent.modelId,
                    status: subagent.status,
                    ...(subagent.activeSince === undefined
                        ? {}
                        : { activeSince: subagent.activeSince }),
                    ...(subagent.elapsedMs === undefined ? {} : { elapsedMs: subagent.elapsedMs }),
                    ...(subagent.totalTokens === undefined
                        ? {}
                        : { totalTokens: subagent.totalTokens }),
                }}
                completedLabel="Done"
                now={now}
                onSelect={props.onSelect}
                placement="panel"
            />
        </li>
    );
}

function BackgroundProcessRow(props: {
    process: KissopenAgentBackgroundProcess;
    onStop?: (processId: number) => void;
}) {
    const { process } = props;
    return (
        <li
            className="kissopen-agent-activity__process"
            data-kissopen-desktop-ui="kissopen-agent-activity-process"
        >
            <CompactActivityRow
                arguments={[process.command]}
                accessibleLabel={`Terminal ${process.command}, running`}
                icon="terminal"
                meta={["running", process.cwd]}
                placement="panel"
                trailing={
                    props.onStop ? (
                        <span
                            data-kissopen-desktop-ui="kissopen-agent-activity-process-stop"
                            data-testid="kissopen-agent-activity-process-stop"
                        >
                            <Button
                                onClick={() => props.onStop?.(process.id)}
                                size="small"
                                variant="ghost"
                            >
                                {t("Stop")}
                            </Button>
                        </span>
                    ) : undefined
                }
                verb="Terminal"
            />
        </li>
    );
}

function AgentSection(props: {
    agents: readonly SubagentSummary[];
    now: number;
    onSelect?: (sessionId: string) => void;
}) {
    if (props.agents.length === 0) return null;
    return (
        <section
            className="kissopen-agent-activity__section"
            data-kissopen-desktop-ui="kissopen-agent-activity-subagents"
        >
            <SectionHeading count={props.agents.length} label={t("Agents")} />
            <ul
                className="kissopen-agent-activity__list"
                data-kissopen-desktop-ui="kissopen-agent-activity-list"
            >
                {props.agents.map((subagent) => (
                    <SubagentRow
                        key={subagent.id}
                        now={props.now}
                        onSelect={props.onSelect}
                        subagent={subagent}
                    />
                ))}
            </ul>
        </section>
    );
}

function TerminalSection(props: {
    processes: readonly KissopenAgentBackgroundProcess[];
    onStop?: (processId: number) => void;
}) {
    if (props.processes.length === 0) return null;
    return (
        <section
            className="kissopen-agent-activity__section"
            data-kissopen-desktop-ui="kissopen-agent-activity-processes"
        >
            <SectionHeading count={props.processes.length} label={t("Terminals")} />
            <ul
                className="kissopen-agent-activity__list"
                data-kissopen-desktop-ui="kissopen-agent-activity-list"
            >
                {props.processes.map((process) => (
                    <BackgroundProcessRow
                        key={process.id}
                        process={process}
                        onStop={props.onStop}
                    />
                ))}
            </ul>
        </section>
    );
}

/**
 * KissopenAgentActivityPanel — the read-only session activity monitor combining the TUI's
 * `/goal`, `/tasks`, `/agents`, and `/ps` views. Live agents and terminals lead;
 * settled agents remain mounted inside a collapsed disclosure. An optional
 * selection callback turns agent readouts into session-navigation buttons. Every
 * value flows from the reactive session snapshot (reconciled from
 * `tasks_changed`/`goal_changed`/`subagent_changed`/`background_processes_changed`
 * SSE events), so this component holds no product state and starts no work.
 */
export function KissopenAgentActivityPanel(props: KissopenAgentActivityPanelProps) {
    const { goal, tasks, subagents, backgroundProcesses } = props;
    const orderedTasks = priorityOrdered(tasks, taskPriority);
    const orderedSubagents = priorityOrdered(subagents, subagentPriority);
    const runningSubagents = orderedSubagents.filter(
        (subagent) =>
            subagent.status === "idle" ||
            subagent.status === "queued" ||
            subagent.status === "running" ||
            subagent.status === "suspended",
    );
    const completedSubagents = orderedSubagents.filter(
        (subagent) =>
            subagent.status === "completed" ||
            subagent.status === "aborted" ||
            subagent.status === "error" ||
            subagent.status === "archived",
    );
    const hasRunning = runningSubagents.length > 0 || backgroundProcesses.length > 0;
    const empty =
        goal === undefined &&
        tasks.length === 0 &&
        subagents.length === 0 &&
        backgroundProcesses.length === 0;
    const content = (
        <section
            className={["kissopen-agent-activity", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-activity-panel"
            data-placement={props.placement === "panel" ? "panel" : undefined}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {empty ? (
                <p
                    className="kissopen-agent-activity__empty"
                    data-kissopen-desktop-ui="kissopen-agent-activity-empty"
                >
                    {t("No goal, tasks, agents, or background terminals for this session yet.")}
                </p>
            ) : (
                <>
                    {hasRunning ? (
                        <section
                            className="kissopen-agent-activity__group"
                            data-kissopen-desktop-ui="kissopen-agent-activity-running"
                        >
                            <h2 className="kissopen-agent-activity__group-heading">
                                {t("Running")}
                            </h2>
                            <div className="kissopen-agent-activity__group-content">
                                <AgentSection
                                    agents={runningSubagents}
                                    now={props.now}
                                    onSelect={props.onSubagentSelect}
                                />
                                <TerminalSection
                                    processes={backgroundProcesses}
                                    onStop={props.onBackgroundProcessStop}
                                />
                            </div>
                        </section>
                    ) : null}

                    {goal ? <GoalSection goal={goal} /> : null}

                    {tasks.length > 0 ? (
                        <section
                            className="kissopen-agent-activity__section"
                            data-kissopen-desktop-ui="kissopen-agent-activity-tasks"
                        >
                            <SectionHeading count={tasks.length} label={t("Tasks")} />
                            <ul
                                className="kissopen-agent-activity__list"
                                data-kissopen-desktop-ui="kissopen-agent-activity-list"
                            >
                                {orderedTasks.map((task) => (
                                    <TaskRow key={task.id} task={task} />
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    {completedSubagents.length > 0 ? (
                        <details
                            className="kissopen-agent-activity__completed"
                            data-kissopen-desktop-ui="kissopen-agent-activity-completed"
                            open={props.completedInitiallyOpen || undefined}
                        >
                            <summary className="kissopen-agent-activity__completed-summary">
                                <Icon
                                    className="kissopen-agent-activity__completed-chevron"
                                    name="chevron-right"
                                    size={12}
                                />
                                <h2 className="kissopen-agent-activity__completed-heading">
                                    {t("Completed")}
                                </h2>
                                <span className="kissopen-agent-activity__count">
                                    {completedSubagents.length}
                                </span>
                            </summary>
                            <div className="kissopen-agent-activity__completed-content">
                                <AgentSection
                                    agents={completedSubagents}
                                    now={props.now}
                                    onSelect={props.onSubagentSelect}
                                />
                            </div>
                        </details>
                    ) : null}
                </>
            )}
        </section>
    );
    return props.placement === "panel" ? (
        <ScrollArea
            axes="both"
            className="kissopen-agent-activity-panel-scroll"
            data-kissopen-desktop-ui="kissopen-agent-activity-panel-scroll"
            viewportClassName="kissopen-agent-activity-panel-scroll__viewport"
        >
            <div className="kissopen-agent-activity-panel-scroll__content">{content}</div>
        </ScrollArea>
    ) : (
        content
    );
}
