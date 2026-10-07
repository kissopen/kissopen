import { WorkStart, type WorkStartExample, type WorkStartProject } from "../../src/WorkStart";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-293";

const noop = () => {};
const projects: WorkStartProject[] = [
    {
        id: "p1",
        name: "我想开一个餐厅",
        place: "云端",
        summary: "选址与菜单定稿",
        hasBoard: true,
        progress: 45,
    },
    { id: "p2", name: "九月经营复盘", place: "", summary: "", hasBoard: false },
    {
        id: "p3",
        name: "欧洲站新品上线",
        place: "MacBook Pro",
        summary: "物流与报关准备",
        hasBoard: true,
        progress: 70,
    },
    { id: "p4", name: "年会策划", place: "", summary: "预算待确认", hasBoard: true },
];
const wide: Record<string, string> = { display: "flex", width: "1280px", height: "960px" };
const narrow: Record<string, string> = { display: "flex", width: "1000px", height: "1500px" };

const examples: WorkStartExample[] = [
    { title: "筹备黑五促销", detail: "把活动方案、素材和时间表放在一起", picture: "bag" },
    { title: "推进欧洲站新品上线", detail: "从选品到上架，持续跟进关键节点", picture: "megaphone" },
    { title: "梳理美国仓补货计划", detail: "汇总销量与库存，形成可执行方案", picture: "boxes" },
    {
        title: "整理本月工作汇报",
        detail: "汇总各项进展，写成一份能直接发出的汇报",
        picture: "document",
    },
    { title: "准备季度汇报 PPT", detail: "从数据到结论，一步步做成汇报材料", picture: "chart" },
    { title: "做一份竞品调研", detail: "收集资料、对比要点，形成结论", picture: "laptop" },
];

export function WorkStartPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The 工作 page while no project is open: what a project is, and one question — what the reader wants to push forward — that starts one."
            title="WorkStart"
        >
            <Specimen
                detail="1320px measure · hero 1.75 : 1 · input 60px with a 48px button · example cards 112×84 pictures"
                label="First project"
                number="01"
                stage="app"
            >
                <div style={wide}>
                    <WorkStart
                        examples={examples}
                        onFolderAdd={noop}
                        onProjectOpen={noop}
                        onStart={noop}
                        projects={projects}
                    />
                </div>
                <DimensionRule label="title 34/700 · question 28/700 · cards 20px radius · formula strip 68px" />
            </Specimen>
            <Specimen
                detail="the folder is being chosen · the button waits and says so"
                label="Creating"
                number="02"
                stage="app"
            >
                <div style={wide}>
                    <WorkStart busy examples={examples} onFolderAdd={noop} onStart={noop} />
                </div>
            </Specimen>
            <Specimen
                detail="the machine refused the folder · the reason under the hint"
                label="Problem"
                number="03"
                stage="app"
            >
                <div style={wide}>
                    <WorkStart
                        error="这个文件夹已经是一个项目了。"
                        examples={examples}
                        onFolderAdd={noop}
                        onStart={noop}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="below 1180px the cards stack"
                label="Narrow window"
                number="04"
                stage="app"
            >
                <div style={narrow}>
                    <WorkStart examples={examples.slice(0, 3)} onStart={noop} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
