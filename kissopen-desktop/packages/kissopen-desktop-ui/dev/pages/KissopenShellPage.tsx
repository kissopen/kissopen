import { useState } from "react";
import {
    KissopenWordmark,
    KissopenShell,
    KissopenSplitPane,
    KissopenSection,
    KissopenNotice,
} from "../../src/KissopenShell";
import { ConversationView } from "../../src/ConversationView";
import { Sidebar } from "../../src/Sidebar";
import { Select } from "../../src/Select";
import { Button } from "../../src/Button";
import { TextField } from "../../src/TextField";
import { Box } from "../../src/Box";
import { EmptyState } from "../../src/EmptyState";
import type { ConversationEntry } from "kissopen-desktop-state";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "M-001";
const entries: ConversationEntry[] = [
    {
        kind: "message",
        source: "server",
        delivery: "sent",
        message: {
            id: "question",
            chatId: "example",
            sequence: "1",
            changePts: "1",
            sender: { id: "viewer", displayName: "你", username: "viewer", kind: "human" },
            text: "帮我整理一下这周的计划，先做什么？",
            reactions: [],
            attachments: [],
            createdAt: "",
        },
    },
    {
        kind: "message",
        source: "server",
        delivery: "sent",
        message: {
            id: "answer",
            chatId: "example",
            sequence: "2",
            changePts: "1",
            sender: {
                id: "KISSOPEN",
                displayName: "KISSOPEN",
                username: "KISSOPEN",
                kind: "agent",
            },
            text: "可以先按**截止时间和影响**排列优先级：\n\n1. 今天：明确目标，列出必须完成的三件事。\n2. 周中：留出不被打断的时间处理核心工作。\n3. 周五：回顾结果，调整下周计划。\n\n把待办事项发给我，我们一起细化。",
            generationStatus: "complete",
            reactions: [],
            attachments: [],
            createdAt: "",
        },
    },
];
export function KissopenShellPage() {
    const [draft, setDraft] = useState("");
    const [selected, select] = useState("chat");
    return (
        <ComponentPage
            number={componentNumber}
            title="KISSOPEN"
            summary="原有会话、侧栏和输入组件承载 KISSOPEN 服务。"
        >
            <Specimen
                number="01"
                label="聊天与工作"
                detail="Same ConversationView, virtualized transcript and composer as Bot/work sessions"
            >
                <Box height={680} width="100%">
                    <KissopenShell
                        selected={selected}
                        tabs={[
                            { id: "workspace", title: "工作空间", icon: "agents" },
                            { id: "chat", title: "聊天", icon: "chat" },
                            { id: "reports", title: "报告", icon: "doc" },
                            { id: "files", title: "文件", icon: "files" },
                            { id: "billing", title: "额度", icon: "zap" },
                        ]}
                        onSelect={select}
                        workspace={
                            <EmptyState
                                icon="agents"
                                title="工作空间"
                                description="Bot、项目、会话与工具继续使用原有界面。"
                            />
                        }
                        cloud={
                            <KissopenSection title="KISSOPEN 账号">
                                <KissopenWordmark />
                                <TextField label="内测邀请码" type="password" />
                                <Button>登录</Button>
                            </KissopenSection>
                        }
                        conversation={
                            selected === "chat" ? (
                                <KissopenSplitPane
                                    sidebar={
                                        <Sidebar
                                            title="聊天"
                                            activeItemId="example"
                                            composeLabel="新对话"
                                            onCompose={() => setDraft("")}
                                            onItemSelect={() => undefined}
                                            sections={[
                                                {
                                                    id: "history",
                                                    label: "最近的对话",
                                                    items: [
                                                        {
                                                            id: "example",
                                                            kind: "channel",
                                                            icon: "chat",
                                                            label: "本周计划",
                                                        },
                                                        {
                                                            id: "writing",
                                                            kind: "channel",
                                                            icon: "chat",
                                                            label: "文案与灵感",
                                                        },
                                                    ],
                                                },
                                            ]}
                                        />
                                    }
                                >
                                    <ConversationView
                                        title="本周计划"
                                        entries={entries}
                                        viewerId="viewer"
                                        conversationId="example"
                                        composer={{
                                            scopeId: "example",
                                            text: draft,
                                            attachments: [],
                                            revision: 0,
                                            focused: false,
                                            agentUserIds: [],
                                            mentionCandidates: [],
                                            submission: { status: "idle" },
                                            capabilities: {
                                                shellMode: false,
                                                commands: [],
                                                mentions: false,
                                            },
                                        }}
                                        onComposerValueChange={setDraft}
                                        onComposerSend={() => setDraft("")}
                                        composerPlaceholder="发送消息…"
                                        composerControls={
                                            <Select
                                                aria-label="模型"
                                                value="example"
                                                options={[{ value: "example", label: "默认模型" }]}
                                                size="small"
                                            />
                                        }
                                    />
                                </KissopenSplitPane>
                            ) : undefined
                        }
                    />
                </Box>
            </Specimen>
            <Specimen
                number="02"
                label="连接提示"
                detail="Inline status without replacing or resetting the workspace"
            >
                <KissopenSection title="账号与额度">
                    <KissopenNotice>工作助手已启用。</KissopenNotice>
                    <KissopenNotice error>暂时无法连接，草稿已保留。</KissopenNotice>
                    <Button variant="secondary">查看额度</Button>
                </KissopenSection>
            </Specimen>
        </ComponentPage>
    );
}
