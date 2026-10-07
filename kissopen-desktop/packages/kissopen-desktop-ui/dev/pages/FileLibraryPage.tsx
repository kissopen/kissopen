import { FileLibrary, type FileLibraryItem } from "../../src/FileLibrary";
import { ComponentPage, DimensionRule, Specimen } from "../kit";
import previewPicture from "../../src/assets/secretary/secretary-still.jpg";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-282";

const noop = () => {};

/* A fixed "now" keeps the day groups and times identical on every render. */
const now = new Date(2026, 8, 18, 14, 30).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const restaurant = { id: "local:p1", name: "我想开一个餐厅" };
const report = { id: "cloud:p2", name: "云端 - 月度经营报告" };

const items: FileLibraryItem[] = [
    {
        id: "p1",
        name: "选址对比.xlsx",
        kind: "data",
        size: 48_200,
        created: now - HOUR,
        project: restaurant,
    },
    {
        id: "p2",
        name: "菜单初稿.docx",
        kind: "document",
        size: 31_900,
        created: now - 3 * HOUR,
        project: restaurant,
    },
    {
        id: "p3",
        name: "门头效果图-a1b2.png",
        previewUrl: previewPicture,
        kind: "image",
        size: 1_204_000,
        created: now - DAY - HOUR,
        project: restaurant,
    },
    {
        id: "p4",
        name: "九月经营报告.pdf",
        kind: "document",
        size: 380_000,
        created: now - 2 * DAY,
        project: report,
    },
    {
        id: "f1",
        name: "第三季度复盘.md",
        kind: "document",
        size: 18_432,
        created: now - 2 * HOUR,
        source: { id: "c1", label: "帮我整理季度复盘要点" },
        selected: true,
    },
    {
        id: "f2",
        name: "订单导出-2026-09.csv",
        kind: "data",
        size: 412_000,
        created: now - 5 * HOUR,
        source: { id: "c4", label: "九月订单异常分析" },
    },
    {
        id: "f3",
        name: "IMG_2041.png",
        kind: "image",
        size: 236_000,
        created: now - DAY - 3 * HOUR,
        source: { id: "c2", label: "这张图里的错误提示是什么意思" },
        attachable: false,
    },
    {
        id: "f4",
        name: "config.json",
        kind: "data",
        size: 2_048,
        created: now - DAY - 6 * HOUR,
    },
    {
        id: "f5",
        name: "产品需求说明（草稿，带很长很长很长很长很长很长的文件名以便看到省略号）.txt",
        kind: "document",
        size: 61_000,
        created: now - 4 * DAY,
        source: { id: "c3", label: "把需求说明改成对外的一页纸" },
    },
    {
        id: "f6",
        name: "会议纪要-0812.md",
        kind: "document",
        size: 9_800,
        created: now - 37 * DAY,
        source: { id: "c5", label: "八月项目周报" },
    },
];

const stage: Record<string, string> = {
    display: "flex",
    width: "960px",
    height: "560px",
};

const handlers = {
    description: "本机项目中的文件。添加资料请使用项目文件面板，文件不会上传到账号服务器。",
    onFilterChange: noop,
    onItemOpen: noop,
    onItemSourceOpen: noop,
    onItemUse: noop,
    onSearchChange: noop,
    onUpload: noop,
};

export function FileLibraryPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Every file the reader has given KISSOPEN, newest first, grouped by day and filterable by kind; each row names the conversation or report it was last used in."
            title="FileLibrary"
        >
            <Specimen
                detail="Grid overflow scrolls inside the fixed-height library; thumbnails retain their size and missing images retain their icon"
                label="Image thumbnails"
                number="00"
                stage="surface"
            >
                <div style={stage}>
                    <FileLibrary
                        filter="image"
                        items={items}
                        now={now}
                        search=""
                        view="grid"
                        {...handlers}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Fixed-height library · all groups retain their natural height · scroll and drag the track to reach the final file"
                label="Populated library"
                number="01"
                stage="surface"
            >
                <div style={stage}>
                    <FileLibrary
                        actionsVisible
                        filter="all"
                        items={items}
                        now={now}
                        search=""
                        {...handlers}
                    />
                </div>
                <DimensionRule label="row 56px · tile 36px · name 13/500 · meta 12 · time tabular · actions 60px reserved" />
            </Specimen>

            <Specimen
                detail="segment 数据 · only CSV and JSON rows remain · groups recomputed"
                label="Filtered by kind"
                number="02"
                stage="surface"
            >
                <div style={stage}>
                    <FileLibrary filter="data" items={items} now={now} search="" {...handlers} />
                </div>
            </Specimen>

            <Specimen
                detail="search with no match · inline guidance instead of a blank list"
                label="No match"
                number="03"
                stage="surface"
            >
                <div style={stage}>
                    <FileLibrary filter="all" items={items} now={now} search="预算" {...handlers} />
                </div>
            </Specimen>

            <Specimen
                detail="no files yet · toolbar hidden · upload as the single action"
                label="Empty library"
                number="04"
                stage="surface"
            >
                <div style={stage}>
                    <FileLibrary filter="all" items={[]} now={now} search="" {...handlers} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
