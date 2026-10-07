import { ConversationCapsule } from "../../src/ConversationCapsule";
import type { MenuItem } from "../../src/Menu";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-283";

const noop = () => {};

const items: MenuItem[] = [
    { kind: "item", id: "rename", label: "重命名", icon: "edit" },
    { kind: "item", id: "pin", label: "置顶", icon: "star" },
    { kind: "item", id: "files", label: "本对话的文件", icon: "paperclip" },
    { kind: "item", id: "find", label: "在对话中查找", icon: "search" },
    { kind: "separator" },
    { kind: "item", id: "archive", label: "归档", icon: "archive" },
    { kind: "item", id: "delete", label: "删除", icon: "trash", danger: true },
];

const stage: Record<string, string> = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    width: "420px",
    height: "56px",
    padding: "0 16px",
};

export function ConversationCapsulePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The two actions above an open conversation joined into one pill: start a new one on the left, everything else behind the right."
            title="ConversationCapsule"
        >
            <Specimen
                detail="32px pill · two 28px ghost buttons · hairline between · pinned to the header's trailing edge"
                label="In a 56px header"
                number="01"
                stage="chrome"
            >
                <div style={stage}>
                    <ConversationCapsule items={items} onCompose={noop} onSelect={noop} />
                </div>
                <DimensionRule label="capsule 32px · 1px divider · pill radius · 2px inner padding" />
            </Specimen>

            <Specimen
                detail="menu only, for a surface with no compose action — no divider is drawn"
                label="Menu alone"
                number="02"
                stage="chrome"
            >
                <div style={stage}>
                    <ConversationCapsule items={items} onSelect={noop} />
                </div>
            </Specimen>

            <Specimen
                detail="nothing is open yet, so both halves are inert"
                label="Disabled"
                number="03"
                stage="chrome"
            >
                <div style={stage}>
                    <ConversationCapsule disabled items={items} onCompose={noop} onSelect={noop} />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
