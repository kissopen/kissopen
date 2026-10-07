import {
    ProjectBoard,
    type ProjectBoardDocument,
    type ProjectBoardRecent,
} from "../../src/ProjectBoard";
import { ComponentPage, DimensionRule, Specimen } from "../kit";
import { BoardCardDetail } from "../../src/BoardCardDetail";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-294";

const noop = () => {};
const watch = () => noop;
const now = new Date(2026, 8, 24, 16, 0).getTime();
const wide: Record<string, string> = { display: "flex", width: "1280px", height: "1080px" };
const short: Record<string, string> = { display: "flex", width: "1280px", height: "620px" };

/* A launch project: the agent chose a road, decisions and files. */
const launch: ProjectBoardDocument = {
    title: "10 月完成产品发布",
    subtitle: "把发布计划、关键决定和实际进展放在同一个地方。",
    icon: "rocket",
    due: "10 月 31 日",
    blocks: [
        {
            type: "focus",
            id: "releaseplan",
            state: "needs_decision",
            size: "wide",
            eyebrow: "现在最重要的一步",
            title: "先确认发布计划，后续提醒才会生效。",
            detail: "范围已经冻结，测试还有 12 个问题待修。",
            action: { label: "查看并确认计划", prompt: "请把发布计划列给我确认。" },
            chips: [
                { title: "范围冻结", icon: "box" },
                { title: "测试", icon: "doc" },
                { title: "灰度发布", icon: "chart" },
            ],
        },
        {
            type: "list",
            size: "third",
            title: "待你决定",
            badge: "2 项待确认",
            items: [
                {
                    title: "确认里程碑计划",
                    detail: "检查 5 个关键节点",
                    tone: "warn",
                    action: { label: "确认", prompt: "确认里程碑计划" },
                },
                {
                    title: "启用每周推进提醒",
                    detail: "每周汇总进展",
                    tone: "accent",
                    action: { label: "启用", prompt: "启用每周推进提醒" },
                },
            ],
        },
        {
            type: "milestones",
            size: "wide",
            title: "发布路线",
            note: "建议节点 · 确认后开始跟踪",
            items: [
                { title: "范围冻结", detail: "明确版本范围", state: "done", icon: "box" },
                { title: "测试", detail: "修复问题", state: "current", icon: "doc" },
                { title: "灰度", detail: "小范围验证", state: "todo", icon: "chart" },
                { title: "Go/No-Go", detail: "最终决策", state: "todo", icon: "check" },
                { title: "正式发布", detail: "10 月 31 日", state: "todo", icon: "rocket" },
            ],
        },
        {
            type: "files",
            size: "third",
            title: "最新资料",
            items: [
                { name: "发布计划.docx", path: "outputs/发布计划.docx", detail: "昨天生成" },
                { name: "功能清单.xlsx", path: "uploads/功能清单.xlsx", detail: "你上传的" },
            ],
        },
        {
            type: "note",
            size: "full",
            title: "AI 的提醒",
            body: "当前计划仍待确认。可以先补充验收标准，让后续建议更准确。",
        },
    ],
};

/* A sales project: the agent chose figures, a chart and a table instead. */
const sales: ProjectBoardDocument = {
    title: "华东区三季度销售",
    subtitle: "跟踪签约额、重点客户和本月目标。",
    icon: "money",
    due: "9 月 30 日",
    blocks: [
        {
            type: "stats",
            size: "full",
            title: "本月到目前",
            items: [
                { label: "签约额", value: "¥4,910,000", delta: "+11.2%", trend: "up" },
                { label: "新增商机", value: "18", delta: "+3", trend: "up" },
                { label: "报价转化率", value: "31%", delta: "-2%", trend: "down" },
            ],
        },
        {
            type: "chart",
            size: "half",
            title: "每周签约额",
            note: "单位：万元",
            kind: "bar",
            unit: "",
            labels: ["第1周", "第2周", "第3周", "第4周"],
            series: [
                { name: "今年", values: [98, 120, 134, 139] },
                { name: "去年", values: [90, 101, 110, 118] },
            ],
        },
        {
            type: "table",
            size: "half",
            title: "重点客户",
            columns: ["客户", "阶段", "金额"],
            rows: [
                ["华东精工", "报价中", "¥860,000"],
                ["恒远机械", "待签约", "¥1,200,000"],
                ["南方电子", "试用", "¥420,000"],
            ],
        },
        {
            type: "progress",
            size: "half",
            title: "目标完成度",
            items: [
                { label: "季度签约额", percent: 68, detail: "还差 ¥2.3M" },
                { label: "新客户数", percent: 45, detail: "9 / 20" },
            ],
        },
        {
            type: "text",
            size: "half",
            title: "本周小结",
            body: "恒远机械进入待签约阶段，南方电子试用反馈良好。下周重点推进华东精工的报价。",
        },
    ],
};

const recent: ProjectBoardRecent[] = [
    { id: "s1", title: "整理发布范围", updatedAt: now - 44_000 },
    { id: "s2", title: "测试问题汇总", updatedAt: now - 3 * 3_600_000 },
];

const handlers = {
    onCard: noop,
    onAsk: noop,
    onBuild: noop,
    onConversationOpen: noop,
    onScheduleOpen: noop,
    onSetup: noop,
    onWatch: watch,
};

export function ProjectBoardPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A project's first screen: the board its agent built from the project's chats and files, from whatever blocks it chose for this project, above the project's recent conversations and an ask bar."
            title="ProjectBoard"
        >
            <Specimen
                label="Card details stay beside the board"
                detail="Open progress without sending a message; evidence, files and decisions are separate from continuing a conversation."
                number="10"
                stage="app"
            >
                <div style={short}>
                    <ProjectBoard
                        build={{ running: false }}
                        name="发布项目"
                        now={now}
                        recent={[]}
                        state="ready"
                        document={launch}
                        project={{
                            goal: "发布产品",
                            direction: "",
                            decisions: [
                                {
                                    card: "releaseplan",
                                    at: "2026-10-02",
                                    question: "发布范围",
                                    choice: "先发布桌面端",
                                },
                            ],
                            cards: {
                                releaseplan: {
                                    title: "确认发布计划",
                                    state: "needs_decision",
                                    note: "已完成三个发布方案的对比，等待确认上线范围。",
                                    question: {
                                        text: "先小范围试用，还是直接公开发布？",
                                        options: ["小范围试用", "公开发布"],
                                    },
                                    files: ["outputs/发布计划.docx"],
                                    verified: false,
                                    updated: "2026-10-02 10:00",
                                },
                            },
                        }}
                        {...handlers}
                        onFileOpen={noop}
                    />
                </div>
            </Specimen>
            {(["todo", "in_progress", "waiting_material", "needs_decision", "done"] as const).map(
                (state) => (
                    <Specimen
                        key={state}
                        label={`Detail · ${state}`}
                        detail="Explicit state; no invented progress or execution history"
                        number={`11-${state}`}
                        stage="surface"
                    >
                        <div style={{ display: "flex", width: "400px", height: "620px" }}>
                            <BoardCardDetail
                                card={{
                                    id: "releaseplan",
                                    title: "产品发布计划",
                                    detail: "已整理现有资料，下一步需要确认发布范围。",
                                    state,
                                }}
                                decisions={[]}
                                onClose={noop}
                                onContinue={noop}
                            />
                        </div>
                    </Specimen>
                ),
            )}
            {(["cached", "unavailable", "current"] as const).map((sync) => (
                <Specimen
                    key={sync}
                    detail="Saved content remains mounted while reconnecting or refreshing"
                    label={`Saved board · ${sync}`}
                    number={`08-${sync}`}
                    stage="app"
                >
                    <div style={wide}>
                        <ProjectBoard
                            build={{ running: false }}
                            name="十月产品发布"
                            now={now}
                            recent={recent}
                            state="ready"
                            document={launch}
                            sync={sync}
                            {...handlers}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                detail="First visit with no saved copy: explain the failure instead of showing an endless loader"
                label="Offline without a saved board"
                number="09"
                stage="app"
            >
                <div style={short}>
                    <ProjectBoard
                        build={{ running: false }}
                        name="新项目"
                        now={now}
                        recent={recent}
                        state="loading"
                        sync="unavailable"
                        unavailable
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="First read: quiet skeleton cards, an accessible loading status, and recent chats remain available"
                label="Loading the project board"
                number="07"
                stage="app"
            >
                <div style={wide}>
                    <ProjectBoard
                        build={{ running: false }}
                        name="十月收入10w"
                        now={now}
                        recent={recent}
                        state="loading"
                        {...handlers}
                    />
                </div>
            </Specimen>
            {(["submitting", "waiting"] as const).map((phase) => (
                <Specimen
                    key={phase}
                    detail="Immediate feedback before the executor starts; build stays disabled"
                    label={phase === "submitting" ? "Submitting a board build" : "Waiting to start"}
                    number={phase === "submitting" ? "04" : "05"}
                    stage="app"
                >
                    <div style={short}>
                        <ProjectBoard
                            build={{ running: true, phase }}
                            name="新项目"
                            now={now}
                            recent={[]}
                            state="missing"
                            {...handlers}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                detail="A failed submission is visible on the board and the button is available again"
                label="Submission failed"
                number="06"
                stage="app"
            >
                <div style={short}>
                    <ProjectBoard
                        build={{ running: false, lastError: "网络连接超时，请重试" }}
                        name="新项目"
                        now={now}
                        recent={[]}
                        state="missing"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="focus, decisions, milestones, files and a note, as the agent chose them"
                label="A launch project"
                number="01"
                stage="app"
            >
                <div style={wide}>
                    <ProjectBoard
                        build={{
                            running: false,
                            schedule: "每天 09:00 自动更新",
                            lastEndedAt: now - 2 * 3_600_000,
                        }}
                        document={launch}
                        name="launch"
                        now={now}
                        recent={recent}
                        state="ready"
                        {...handlers}
                        onFilesOpen={() => undefined}
                        analysis={{ enabled: true, dueAt: now + 90_000, onToggle: () => undefined }}
                    />
                </div>
                <DimensionRule label="blocks wrap by size: full · wide 2/3 · half · third · 18px gaps" />
            </Specimen>
            <Specimen
                detail="figures, a bar chart, a table, progress and text — a different board for a different project"
                label="A sales project"
                number="02"
                stage="app"
            >
                <div style={wide}>
                    <ProjectBoard
                        build={{ running: true, schedule: "工作日 18:00 自动更新" }}
                        document={sales}
                        name="sales"
                        now={now}
                        recent={[]}
                        state="ready"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="no board built yet · build now or set a schedule"
                label="Not built"
                number="03"
                stage="app"
            >
                <div style={short}>
                    <ProjectBoard
                        build={{ running: false }}
                        name="新项目"
                        now={now}
                        recent={[]}
                        state="missing"
                        {...handlers}
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
