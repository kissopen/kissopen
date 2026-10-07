import { ChatStart } from "../../src/ChatStart";
import { ConversationView } from "../../src/ConversationView";
import {
    composerCapabilitiesNone,
    type ComposerSnapshot,
    type ConversationEntry,
} from "kissopen-desktop-state";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-300";

const start = () => Promise.resolve(true);
const noop = () => {};
const composer: ComposerSnapshot = {
    scopeId: "new-cloud-chat",
    text: "",
    attachments: [],
    revision: 0,
    submission: { status: "idle" },
    focused: false,
    agentUserIds: [],
    mentionCandidates: [],
    capabilities: composerCapabilitiesNone,
};
const firstMessage: ConversationEntry = {
    kind: "message",
    source: "local",
    delivery: "sending",
    message: {
        id: "first",
        chatId: "new-cloud-chat",
        sequence: "0",
        changePts: "0",
        sender: { id: "reader", kind: "human", displayName: "你", username: "you" },
        text: "ping",
        reactions: [],
        attachments: [],
        createdAt: "2026-10-01T12:00:00.000Z",
    },
};
const stage: Record<string, string> = {
    display: "flex",
    flexDirection: "column",
    width: "960px",
    height: "560px",
};

export function ChatStartPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="A conversation not started yet: what it is for and the box for the first message. The draft stays until the caller says the conversation is on its way."
            title="ChatStart"
        >
            {(["idle", "preparing", "failed"] as const).map((phase) => (
                <Specimen
                    key={phase}
                    label={`Cloud conversation — ${phase}`}
                    number={`cloud-${phase}`}
                    stage="surface"
                    detail="The same conversation shell, transcript and composer before and after the first send"
                >
                    <div style={stage}>
                        <ConversationView
                            title="新对话"
                            subtitle="云端助手"
                            conversationId="new-cloud-chat"
                            viewerId="reader"
                            entries={phase === "preparing" ? [firstMessage] : []}
                            composer={phase === "failed" ? { ...composer, text: "ping" } : composer}
                            composerDisabled={phase === "preparing"}
                            composerPlaceholder="和云端助手说点什么…"
                            running={phase === "preparing"}
                            notice={
                                phase === "preparing"
                                    ? "正在准备对话，你的消息会自动发送。"
                                    : phase === "failed"
                                      ? "暂时无法连接，草稿已保留。"
                                      : undefined
                            }
                            onComposerSend={noop}
                            onComposerValueChange={noop}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                label="New chat"
                number="01"
                stage="app"
                detail="empty state over a 760px composer"
            >
                <div style={stage}>
                    <ChatStart
                        description="说点什么，会开始一段新的云端对话。之前的对话在左边「最近的对话」里。"
                        onStart={start}
                        placeholder="和云端助手说点什么…"
                        title="新对话"
                    />
                </div>
                <DimensionRule label="24px padding · composer max 760px, centred" />
            </Specimen>
        </ComponentPage>
    );
}
