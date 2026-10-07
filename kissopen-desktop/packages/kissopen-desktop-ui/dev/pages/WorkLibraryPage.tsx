import { useState, type ReactNode } from "react";
import { PluginDetails, PluginLibrary, type LibraryPlugin } from "../../src/PluginLibrary";
import {
    ScheduledTaskLibrary,
    ScheduledTaskDialog,
    ScheduledTaskDetails,
    ScheduledTaskCreateDialog,
    type LibrarySchedule,
} from "../../src/ScheduledTaskLibrary";
import { Button } from "../../src/Button";
import { TextField } from "../../src/TextField";
import { Select } from "../../src/Select";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-297";
const noop = () => {};
const plugin = (
    id: string,
    name: string,
    description: string,
    skills: number,
    installed = true,
): LibraryPlugin => ({
    id,
    name,
    description,
    skills,
    installed,
    enabled: installed,
    version: "1.2.0",
    status: installed ? "已启用" : "可安装",
    disabled: false,
    busy: false,
    connections: [],
    onToggle: noop,
    onInstall: noop,
    onRemove: noop,
});
const plugins: LibraryPlugin[] = [
    plugin(
        "presentations",
        "演示文稿",
        "从一个想法到一份完整的演示文稿。整理大纲、设计版式，让汇报更轻松。",
        3,
    ),
    plugin(
        "spreadsheets",
        "表格",
        "分析业务数据、处理公式和制作图表，把杂乱的数据变成清晰的结论。",
        2,
    ),
    plugin("documents", "文档", "起草方案、整理会议纪要、修改长文档，帮你把想法表达清楚。", 4),
    {
        ...plugin("mail", "工作邮箱", "整理邮件、跟进客户，把需要你关注的消息及时带回来。", 1),
        connections: [{ id: "mail", name: "工作邮箱", connected: false, onConnect: noop }],
    },
    {
        ...plugin("calendar", "日历助手", "了解你的日程，安排会议，让每一件事都有合适的时间。", 2),
        connections: [{ id: "calendar", name: "日历", connected: true, onConnect: noop }],
    },
    {
        ...plugin("research", "研究助手", "搜集信息、比较方案，并为每个结论保留来源。", 5),
        enabled: false,
        status: "待应用",
        notice: "启用更改将在助手重启后生效。",
    },
    plugin("design", "设计助手", "将灵感整理成设计方向，协助准备品牌内容与营销素材。", 3, false),
    plugin(
        "knowledge",
        "团队知识库",
        "查找团队资料，整理已有经验，让下一次工作不用从头开始。",
        2,
        false,
    ),
];
const tasks: LibrarySchedule[] = [
    {
        id: "weekly",
        project: { id: "cloud:sales", name: "海外电商运营" },
        name: "每周业务小结",
        instruction: "整理本周销售、项目进展和需要我决定的事，生成一份简短的周报。",
        status: "active",
        statusLabel: "进行中",
        recurrence: "每周五 17:30 · Asia/Shanghai",
        nextRun: "下次：10 月 2 日 17:30",
        lastRun: "上次已完成 · 9 月 25 日",
        target: "云端工作空间",
        onOpen: noop,
        onToggle: noop,
    },
    {
        id: "customers",
        project: { id: "cloud:sales", name: "海外电商运营" },
        name: "跟进重点客户",
        instruction: "每天检查需要跟进的客户，准备联系建议；发送消息前先让我确认。",
        status: "active",
        statusLabel: "进行中",
        recurrence: "工作日 09:00 · Asia/Shanghai",
        nextRun: "下次：明天 09:00",
        lastRun: "上次已完成 · 今天 09:02",
        target: "云端工作空间",
        onOpen: noop,
        onToggle: noop,
    },
    {
        id: "files",
        project: null,
        name: "整理下载文件",
        instruction: "将本周下载的文件分类整理，列出可能重复的文档，不直接删除。",
        status: "active",
        statusLabel: "进行中",
        recurrence: "每周一 10:00 · Asia/Shanghai",
        nextRun: "下次：10 月 5 日 10:00",
        lastRun: "还没有运行记录",
        target: "我的 MacBook",
        onOpen: noop,
        onToggle: noop,
    },
    {
        id: "stock",
        project: { id: "cloud:inventory", name: "库存管理" },
        name: "库存变化提醒",
        instruction: "对比重点商品的库存变化，发现库存不足时提醒我。",
        status: "paused",
        statusLabel: "已暂停",
        recurrence: "每隔 15 分钟",
        nextRun: "恢复后继续运行",
        lastRun: "上次失败 · 需要重新连接应用",
        target: "云端工作空间",
        onOpen: noop,
        onToggle: noop,
    },
];
function frame(children: ReactNode) {
    return <div style={{ display: "flex", width: 1120, height: 780 }}>{children}</div>;
}
function TasksFixture(props: { focusedId?: string }) {
    const [shownTasks, setShownTasks] = useState(tasks);
    const [dialog, setDialog] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const selected = shownTasks.find((item) => item.name === dialog);
    return (
        <ScheduledTaskLibrary
            loading={false}
            editingId={editingId}
            onEditingChange={setEditingId}
            {...(props.focusedId === undefined ? {} : { focusedId: props.focusedId })}
            description="你安排的事，助手会按时完成。这里也包含对话中创建的任务。"
            schedules={shownTasks.map((item) => ({
                ...item,
                onOpen: () => setDialog(item.name),
                edit: {
                    values: item.edit?.values ?? {
                        name: item.name,
                        instruction: item.instruction,
                        recurrence: item.id === "stock" ? "interval" : "weekly",
                        interval_minutes: item.id === "stock" ? 15 : 0,
                        timezone: "Asia/Shanghai",
                        weekday: 5,
                        at_minute: 1050,
                        once_at: 0,
                    },
                    onSave: async (values) => {
                        await new Promise((resolve) => setTimeout(resolve, 700));
                        if (item.id === "files")
                            throw new Error("暂时无法保存，请重试。（预览失败状态）");
                        setShownTasks((current) =>
                            current.map((task) =>
                                task.id === item.id
                                    ? {
                                          ...task,
                                          name: values.name,
                                          instruction: values.instruction,
                                          recurrence:
                                              values.recurrence === "interval"
                                                  ? `每隔 ${values.interval_minutes} 分钟`
                                                  : `${values.recurrence} · ${String(Math.floor(values.at_minute / 60)).padStart(2, "0")}:${String(values.at_minute % 60).padStart(2, "0")} · ${values.timezone}`,
                                          edit: { values, onSave: async () => {} },
                                      }
                                    : task,
                            ),
                        );
                    },
                },
            }))}
            onCreate={() => setDialog("新建任务")}
            notificationControl={
                <Select
                    aria-label="通知偏好"
                    value="all"
                    options={[{ value: "all", label: "每次完成时通知我" }]}
                />
            }
            dialog={
                dialog ? (
                    <ScheduledTaskDialog title={dialog} onClose={() => setDialog(null)}>
                        {selected ? (
                            <ScheduledTaskDetails
                                {...selected}
                                onStatus={noop}
                                onDelete={noop}
                                onRun={async () => {
                                    await new Promise((resolve) => setTimeout(resolve, 700));
                                }}
                                onEdit={() => {
                                    setEditingId(selected.id);
                                    setDialog(null);
                                }}
                                runs={[
                                    {
                                        id: "run-1",
                                        when: "2026 年 9 月 25 日 17:30",
                                        status: "已完成",
                                        summary:
                                            "已整理本周 3 个项目的进展，并标出 2 项需要你确认的决定。周报已放入项目资料。",
                                    },
                                ]}
                            />
                        ) : (
                            <>
                                <TextField
                                    label="想让助手定时做什么？"
                                    placeholder="例如：每周五下午五点整理本周工作"
                                    multiline
                                    rows={4}
                                    fullWidth
                                />
                                <Button onClick={() => setDialog(null)}>关闭预览</Button>
                            </>
                        )}
                    </ScheduledTaskDialog>
                ) : null
            }
        />
    );
}
export function WorkLibraryPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Work library"
            contract="Props only"
            summary="Cloud plugins, bundled skills, account connections and scheduled-task cards. No transport or fake integrations."
        >
            <Specimen
                number="01"
                label="Plugins"
                detail="Installed, market, skills and authorization"
                stage="app"
            >
                {frame(
                    <PluginLibrary
                        plugins={plugins.map((item) => ({
                            ...item,
                            executionLocation: "Local Agent",
                            connectionsManagedElsewhere: true,
                            connections: [],
                        }))}
                        loading={false}
                        connectionsVisible={false}
                        onImport={async () => {}}
                        description="Local Agent plugins; import an archive or choose from the catalog."
                    />,
                )}
            </Specimen>
            <Specimen
                number="02"
                label="Scheduled tasks"
                detail="Project (default) / status / execution location and in-context dialogs"
                stage="app"
            >
                {frame(<TasksFixture />)}
            </Specimen>
            <Specimen
                number="02b"
                label="Scheduled tasks, one pointed at"
                detail="focusedId: the task a conversation sent the person to — scrolled into the library's view, name focused, accent ring until they act here"
                stage="app"
            >
                {frame(<TasksFixture focusedId="files" />)}
            </Specimen>
            <Specimen number="03" label="Empty library" detail="First use" stage="app">
                {frame(<PluginLibrary plugins={[]} loading={false} />)}
            </Specimen>
            <Specimen number="04" label="Loading" detail="Keep navigation visible" stage="app">
                {frame(<PluginLibrary plugins={[]} loading />)}
            </Specimen>
            <Specimen
                number="04b"
                label="Create a local scheduled task"
                detail="Explicit time, minute intervals, device and project; no cloud model needed"
                stage="app"
            >
                {frame(<LocalTaskFixture />)}
            </Specimen>
            <Specimen
                number="05"
                label="Plugin detail"
                detail="Full description, app connections and existing actions"
                stage="app"
            >
                {frame(
                    <PluginDetails
                        item={plugins.find((item) => item.id === "mail")!}
                        onBack={noop}
                    />,
                )}
            </Specimen>
        </ComponentPage>
    );
}

function LocalTaskFixture() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button onClick={() => setOpen(true)}>Create a local task</Button>
            {open ? (
                <ScheduledTaskCreateDialog
                    targets={[{ value: "machine:example", label: "This computer" }]}
                    projects={() => [{ path: "/sample/project", name: "Example project" }]}
                    onSave={async () => {
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </>
    );
}
