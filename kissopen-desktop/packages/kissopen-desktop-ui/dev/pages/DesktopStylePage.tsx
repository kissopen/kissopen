import { useState } from "react";
import { Button } from "../../src/Button";
import { FileLibrary } from "../../src/FileLibrary";
import { Sidebar } from "../../src/Sidebar";
import { TabbedPane } from "../../src/TabbedPane";
import { type TabItem } from "../../src/Tabs";
import {
    KissopenAgentSettingsShell,
    KissopenAgentSettingsSection,
} from "../../src/pages/settings/KissopenAgentSettingsShell";
import { TextField } from "../../src/TextField";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-298";

const initialTabs: TabItem[] = [
    { id: "board", label: "看板", icon: "home", closable: false },
    { id: "city", label: "具体城市与商圈", icon: "chat" },
    { id: "report", label: "十月运营复盘与下一阶段行动计划", icon: "doc", busy: true },
];

function WorkspaceFixture() {
    const [tabs, setTabs] = useState(initialTabs);
    const [active, setActive] = useState("city");
    const [destination, setDestination] = useState("files");
    const [search, setSearch] = useState("");
    return (
        <div
            style={{
                display: "flex",
                width: "100%",
                maxWidth: 1280,
                height: 720,
                overflow: "hidden",
            }}
        >
            <Sidebar
                roomy
                activeItemId={destination}
                onItemSelect={setDestination}
                actions={[
                    { id: "home", label: "首页", icon: "home", kind: "view" },
                    { id: "work", label: "工作", icon: "tasks", kind: "view" },
                    { id: "files", label: "资料库", icon: "doc", kind: "view" },
                    { id: "schedule", label: "计划任务", icon: "clock", kind: "view" },
                ]}
                sections={[
                    {
                        id: "assistants",
                        label: "助手",
                        items: [{ id: "secretary", label: "小秘书", icon: "spark", kind: "view" }],
                    },
                    {
                        id: "projects",
                        label: "项目",
                        items: [
                            { id: "restaurant", label: "我想开一个餐厅", kind: "workspace" },
                            { id: "launch", label: "十月产品发布", kind: "workspace" },
                        ],
                    },
                    {
                        id: "recent",
                        label: "最近的对话",
                        items: [
                            {
                                id: "summary",
                                label: "整理本周工作小结",
                                icon: "chat",
                                kind: "view",
                            },
                        ],
                    },
                ]}
            />
            <TabbedPane
                size="medium"
                tabs={tabs}
                activeId={active}
                onSelect={setActive}
                onClose={(id) => {
                    setTabs(tabs.filter((tab) => tab.id !== id));
                    if (active === id) setActive("board");
                }}
                onReorder={(ids) => setTabs(ids.map((id) => tabs.find((tab) => tab.id === id)!))}
                actions={
                    <Button
                        variant="ghost"
                        size="small"
                        icon="plus"
                        iconOnly
                        aria-label="新建标签"
                        onClick={() => {
                            setTabs(initialTabs);
                            setActive("city");
                        }}
                    />
                }
                trailing={
                    <Button
                        variant="ghost"
                        size="small"
                        icon="clock"
                        iconOnly
                        aria-label="历史记录"
                    />
                }
            >
                <FileLibrary
                    items={[
                        {
                            id: "report",
                            name: "九月运营复盘.md",
                            kind: "document",
                            size: 18432,
                            created: 1790640000000,
                            source: { id: "review", label: "整理本月的重点成果" },
                        },
                        {
                            id: "sales",
                            name: "销售数据汇总.csv",
                            kind: "data",
                            size: 412000,
                            created: 1790640000000,
                        },
                    ]}
                    filter="all"
                    search={search}
                    onSearchChange={setSearch}
                    now={1790640000000}
                />
            </TabbedPane>
        </div>
    );
}

export function DesktopStylePage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Desktop Style"
            summary="Shared workspace chrome: rounded tabs, calm sidebar, lavender accents and card-based destination pages. Fixture data only; closing tabs does not archive conversations."
        >
            <Specimen
                number="01"
                label="Workspace consistency"
                detail="Resize the window; select, close and reorder tabs; compare light and dark appearances."
                stage="app"
            >
                <WorkspaceFixture />
            </Specimen>
            <Specimen
                number="02"
                label="Settings consistency"
                detail="The compact settings sidebar shares the workspace palette; form sections use the destination card language."
                stage="app"
            >
                <div style={{ display: "flex", width: "100%", height: 600 }}>
                    <KissopenAgentSettingsShell
                        activeCategoryId="account"
                        categories={[
                            { id: "account", label: "账号", icon: "users" },
                            { id: "general", label: "通用", icon: "settings" },
                        ]}
                        title="账号"
                        description="管理你的个人信息与工作偏好"
                        onCategorySelect={() => {}}
                        onClose={() => {}}
                    >
                        <KissopenAgentSettingsSection
                            title="个人信息"
                            description="让助手更了解你，提供更合适的帮助。"
                        >
                            <TextField label="称呼" value="James" onValueChange={() => {}} />
                            <div>
                                <Button>保存修改</Button>
                            </div>
                        </KissopenAgentSettingsSection>
                    </KissopenAgentSettingsShell>
                </div>
            </Specimen>
        </ComponentPage>
    );
}
