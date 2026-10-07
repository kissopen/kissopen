import { useState } from "react";
import { t } from "kissopen-desktop-state/i18n";
import type { ComposerSnapshot, ConversationEntry } from "kissopen-desktop-state";
import { ConversationView } from "../../src/ConversationView";
import { Button } from "../../src/Button";
import { ChannelHeader } from "../../src/ChannelHeader";
import { TabbedPane } from "../../src/TabbedPane";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-012c";
const body = [
    "第三篇写好了，约 490 字，跟前两篇凑在一起正好三个方向。",
    "**先问一句**",
    '同事发来一句"这个方案再看一下吧"，你会怎么想？',
    '有人立刻紧张：是不是做砸了，是不是领导不满意，是不是要重做。一整天心里打鼓，手上的活也乱了。也有人顺手回一句："是哪里不合适？我下午两点前给你改好。"十分钟后，对方说只是想把标题换个说法。',
    "同一句话，两种人生。差别不在那句话，而在我们愿不愿意先问一句。",
    "我们太擅长替别人把话说完。对方只说了上半句，我们脑子里已经补完下半句，还替他把语气加重了几分。补出来的内容，其实来自自己的担心：怕被否定，怕不被喜欢，怕事情失控。它不是事实，只是心情的投影。",
    '误会大多不是从恶意开始的，而是从沉默开始的。没说出口的疑问，会在心里慢慢长成结论；一个没被确认的猜测，会在几个来回之后变成"他就是这样的人"。',
    '先问一句，其实不丢人。它只说明你在乎这件事，也不愿意替别人下结论。问的时候把话说得具体些：不是"你是不是不高兴"，而是"刚才那句话我没太听懂，你指的是哪一部分"。具体的问法，才换得来具体的回答。',
    "问清楚了，你会发现，很多让你失眠的事，只是别人的一句话，或者一次没来得及说明的忙碌。你开口的那一刻，误会就已经开始变小了。",
    "话不必说得漂亮，说明白就够了。",
    "文稿在 [先问一句.md](outputs/先问一句.md)，前两篇分别是 [把一件事做完.md](outputs/把一件事做完.md) 和 [走一段路.md](outputs/走一段路.md)。",
    '三篇已经能凑成一组了：做事的方法、生活的感受、跟人相处。如果你想继续加，我建议再补一篇关于"怎么面对犯错"的，主题上就齐了；也可以直接说个具体题目，我按你的来。',
].join("\n\n");

export function ChineseMessagePage() {
    const [width, setWidth] = useState(880);
    const [streaming, setStreaming] = useState(false);
    const [height, setHeight] = useState(760);
    const [project, setProject] = useState(false);
    const entries: ConversationEntry[] = [
        {
            kind: "agentActivity",
            id: "write",
            sequence: "1",
            activity: {
                kind: "labeled",
                label: "Write",
                subject: "Article",
                status: "success",
                mono: true,
            },
        },
        {
            kind: "message",
            source: "server",
            delivery: "sent",
            message: {
                id: "article",
                chatId: "chinese-prose",
                sequence: "2",
                changePts: "1",
                sender: { id: "agent", displayName: "WorPar", username: "worpar", kind: "agent" },
                text: body,
                attachments: [],
                reactions: [],
                createdAt: "2026-10-01T17:19:00.000Z",
                generationStatus: streaming ? "streaming" : "complete",
            },
        },
        ...(!streaming
            ? [
                  {
                      kind: "turnStatus" as const,
                      id: "completed",
                      sequence: "3",
                      status: "complete" as const,
                      reason: "completed" as const,
                      durationMs: 12000,
                  },
              ]
            : []),
    ];
    const composer: ComposerSnapshot = {
        agentUserIds: [],
        attachments: [],
        capabilities: { commands: [], mentions: false, shellMode: false },
        focused: false,
        mentionCandidates: [],
        revision: 0,
        scopeId: "chinese-prose",
        submission: { status: "idle" },
        text: "",
    };
    return (
        <ComponentPage
            number={componentNumber}
            title="Chinese message geometry"
            summary="Compact 14px / 22px chat typography: long CJK prose and file links at full width and beside a file preview."
        >
            <Specimen
                number="01"
                label="Chinese prose"
                detail="The estimate uses the same text measure as the agent message."
                stage="app"
            >
                <Button onClick={() => setWidth(width === 880 ? 560 : 880)}>
                    Change width ({width})
                </Button>
                <Button onClick={() => setStreaming(!streaming)}>
                    {streaming ? "Complete reply" : "Stream reply"}
                </Button>
                <Button onClick={() => setHeight(height === 760 ? 480 : 760)}>
                    Change height ({height})
                </Button>
                <Button onClick={() => setProject(!project)}>
                    {project ? "Standalone conversation" : "Project conversation"}
                </Button>
                <div style={{ width, height }}>
                    {project ? (
                        <div className="kissopen-relay-place">
                            <ChannelHeader icon="inbox" title="云端项目 - 我想开一个餐厅" />
                            <TabbedPane
                                className="kissopen-relay-pages"
                                activeId="direction"
                                tabs={[
                                    { id: "board", label: "看板", icon: "home", closable: false },
                                    {
                                        id: "direction",
                                        label: "主攻菜系方向",
                                        avatarId: "direction",
                                    },
                                    {
                                        id: "schedule",
                                        label: "每隔一小时给我发一句打气的话",
                                        avatarId: "schedule",
                                    },
                                    { id: "chef", label: "厨师长与炒锅资源", avatarId: "chef" },
                                    { id: "ping", label: "ping", avatarId: "ping" },
                                ]}
                                onSelect={() => {}}
                                onClose={() => {}}
                                actions={<Button icon="plus" aria-label="New conversation" />}
                            >
                                <ConversationView
                                    title="主攻菜系方向"
                                    subtitle={t("云端")}
                                    agentAuthor={{
                                        id: "agent",
                                        displayName: "WorPar",
                                        username: "worpar",
                                        kind: "agent",
                                    }}
                                    conversationId="chinese-project"
                                    entries={entries}
                                    composer={composer}
                                    running={streaming}
                                    onComposerSend={() => {}}
                                    onComposerValueChange={() => {}}
                                />
                            </TabbedPane>
                        </div>
                    ) : (
                        <ConversationView
                            agentAuthor={{
                                id: "agent",
                                displayName: "WorPar",
                                username: "worpar",
                                kind: "agent",
                            }}
                            conversationId="chinese-prose"
                            entries={entries}
                            composer={composer}
                            running={streaming}
                            onComposerSend={() => {}}
                            onComposerValueChange={() => {}}
                        />
                    )}
                </div>
            </Specimen>
        </ComponentPage>
    );
}
