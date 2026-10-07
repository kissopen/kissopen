import {
    KissopenHome,
    type KissopenHomeData,
    type KissopenHomeProject,
} from "../../src/KissopenHome";
import { ComponentPage, DimensionRule, Specimen } from "../kit";
import type { KissopenHomeDigest } from "kissopen-desktop-state";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-291";

const noop = () => {};
/* A fixed "now" keeps the greeting, the date and the "updated" times identical on every render. */
const now = new Date(2026, 8, 24, 9, 30).getTime();
const HOUR = 3_600_000;
const wide: Record<string, string> = { display: "flex", width: "1280px", height: "900px" };
const narrow: Record<string, string> = { display: "flex", width: "1000px", height: "1500px" };
const short: Record<string, string> = { display: "flex", width: "1280px", height: "560px" };

/* What a model writes for a cross-border e-commerce manager leading ten people. */
const data: KissopenHomeData = {
    greeting: "你的海外业务，今天有了新进展。",
    focus: {
        title: "今天，先关注这两件事",
        summary: "黑五筹备进入最后两周，美国仓的补货要今天定下来。",
        items: [
            { title: "确认美国仓补货计划", icon: "box" },
            { title: "审核 3 组黑五广告素材", icon: "image" },
        ],
    },
    team: {
        title: "团队的这一周",
        subtitle: "10 位伙伴 · 4 个协作事项",
        members: [
            { name: "林悦", group: "运营" },
            { name: "周航", group: "运营" },
            { name: "陈思", group: "运营" },
            { name: "王磊", group: "运营" },
            { name: "赵雪", group: "增长" },
            { name: "刘洋", group: "增长" },
            { name: "孙琪", group: "增长" },
            { name: "吴凡", group: "供应链" },
            { name: "郑可", group: "供应链" },
            { name: "何宁", group: "供应链" },
        ],
        groups: [
            { name: "运营", count: 4, progress: 72 },
            { name: "增长", count: 3, progress: 58 },
            { name: "供应链", count: 3, progress: 41 },
        ],
        support: "2 位伙伴需要支持",
    },
    projects: [
        {
            name: "黑五活动筹备",
            tag: "US · 营销活动",
            progress: 72,
            status: "on_track",
            status_label: "",
            picture: "sneakers",
        },
        {
            name: "欧洲站新品上线",
            tag: "EU · 新品",
            progress: 45,
            status: "at_risk",
            status_label: "素材延期",
            picture: "cup",
        },
        {
            name: "美国仓补货",
            tag: "US · 供应链",
            progress: 60,
            status: "waiting",
            status_label: "待你确认",
            picture: "boxes",
        },
    ],
    forecast: {
        title: "接下来，可能发生什么",
        subtitle: "未来 3 周销售额预测",
        range: "+12% ~ +18%",
        unit: "$",
        labels: ["9/1", "9/8", "9/15", "9/22", "9/29", "10/6", "10/13"],
        actual: [98, 104, 112, 118],
        predicted: [118, 126, 133, 141],
        note: "黑五预热带动搜索量上升",
    },
    wins: {
        title: "本周的小成果",
        value: "$128,400",
        label: "本周销售额",
        delta: "+8.6%",
        metrics: [
            { label: "订单", value: "2,146" },
            { label: "转化率", value: "3.8%" },
        ],
        bars: [14, 17, 16, 21, 19, 24, 22],
        bar_labels: ["一", "二", "三", "四", "五", "六", "日"],
        note: "新品贡献了 23% 的增长",
    },
};

const projects: KissopenHomeProject[] = [
    {
        id: "p1",
        name: "黑五选品表",
        place: "James 的 MacBook",
        updatedAt: now - 2 * HOUR,
        conversations: 6,
    },
    {
        id: "p2",
        name: "欧洲站 listing",
        place: "James 的 MacBook",
        updatedAt: now - 26 * HOUR,
        conversations: 3,
    },
    {
        id: "p3",
        name: "周报",
        place: "办公室电脑",
        updatedAt: now - 20 * 60_000,
        conversations: 12,
    },
];

const handlers = {
    onAsk: noop,
    onConnect: noop,
    projectCreate: {
        first: false,
        onFolderPick: () => Promise.resolve(undefined),
        onCreate: () => Promise.resolve(),
    },
    onProjectOpen: noop,
    onProjectsOpen: noop,
    onRetry: noop,
};

const decisionDigest: KissopenHomeDigest = {
    boards: 3,
    focus: [],
    projects: [],
    milestones: [],
    stats: [],
    decisions: [
        {
            projectId: "restaurant",
            projectName: "我想开一个餐厅 · 云端",
            title: "确认具体城市与商圈",
            question:
                "请确认具体城市（以及是否已有目标商圈），我把参考租金区间、可考察商圈类型和竞争判断收窄到你的城市。可直接写出城市名，或说明是否已有候选商圈、是否已在谈具体铺位。",
        },
        {
            projectId: "restaurant",
            projectName: "我想开一个餐厅 · 云端",
            title: "从六个定位方案中选一个",
            question:
                "六个定位方案已对比完，结论是优先验证本地家常地方菜、川渝江湖菜。湘赣现炒只在有稳定炒锅团队、合格排烟和午晚双高峰时才做。还需走完 18–24 家竞品走访。",
        },
        {
            projectId: "launch",
            projectName: "海外业务增长与新品发布计划 · 办公室电脑",
            title: "补充目标客群与预算",
            question: "请补充预算上限和目标客群，再确定第一轮投放规模。",
        },
        {
            projectId: "product",
            projectName: "KISSOPEN",
            title: "记忆的数据结构",
            question: "事实、推断、冲突、来源与置信度怎么写；定了才能动数据层。",
        },
        {
            projectId: "product",
            projectName: "KISSOPEN",
            title: "自主执行的边界",
            question: "哪些动作允许我直接做完、哪些必须先问你？",
        },
    ].map((item, index) => ({
        projectId: item.projectId,
        projectName: item.projectName,
        question: item.question,
        state: index === 2 ? "waiting_material" : "needs_decision",
        card: {
            id: `decision-${index}`,
            title: item.title,
            detail: item.question,
            state: index === 2 ? "waiting_material" : "needs_decision",
        },
    })),
};

export function KissopenHomePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The home page: the reader's work at a glance as tiles. Until their own work exists it is a demonstration written for their industry and job, marked as such; real projects replace the demonstration's as soon as there are some."
            title="KissopenHome"
        >
            <Specimen
                detail="375px main pane · single-column cards and wrapped controls, regardless of window width"
                label="Phone-width workspace"
                number="08"
                stage="app"
            >
                <div style={{ width: 375, height: 820 }}>
                    <KissopenHome
                        data={data}
                        digest={decisionDigest}
                        name="James"
                        now={now}
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Full-width decisions and separate action footers; the home page has no floating composer."
                label="Waiting for your decision"
                number="06"
                stage="app"
            >
                <div style={wide}>
                    <KissopenHome digest={decisionDigest} name="James" now={now} {...handlers} />
                </div>
            </Specimen>
            <Specimen
                detail="The same decisions wrap with the desktop content width; long copy never shares a row with the action"
                label="Decisions in a narrow window"
                number="07"
                stage="app"
            >
                <div style={narrow}>
                    <KissopenHome digest={decisionDigest} name="James" now={now} {...handlers} />
                </div>
            </Specimen>
            <Specimen
                detail="1320px measure · 20px gaps · cards 20px radius · top row 1.75 : 1 · content ends with a 28px gutter"
                label="Demonstration"
                number="01"
                stage="app"
            >
                <div style={wide}>
                    <KissopenHome data={data} name="James" now={now} {...handlers} />
                </div>
                <DimensionRule label="title 34/700 · card title 18/700 · focus card 330px min · landscape on the right half" />
            </Specimen>

            <Specimen
                detail="the reader's own projects replace the demonstration's · a green chip names them"
                label="With real projects"
                number="02"
                stage="app"
            >
                <div style={wide}>
                    <KissopenHome
                        data={data}
                        name="James"
                        now={now}
                        projects={projects}
                        {...handlers}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="below 1100px every row stacks into one column"
                label="Narrow window"
                number="03"
                stage="app"
            >
                <div style={narrow}>
                    <KissopenHome data={data} name="James" now={now} {...handlers} />
                </div>
            </Specimen>

            <Specimen
                detail="the first demonstration is still being written · shimmering placeholders"
                label="Loading"
                number="04"
                stage="app"
            >
                <div style={short}>
                    <KissopenHome name="James" now={now} {...handlers} />
                </div>
            </Specimen>

            <Specimen
                detail="the demonstration could not be fetched · one retry link"
                label="Problem"
                number="05"
                stage="app"
            >
                <div style={short}>
                    <KissopenHome error="首页暂时没准备好" name="James" now={now} {...handlers} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
