import { Menu, type MenuItem } from "../../src/Menu";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-027";

const messageActions: MenuItem[] = [
    { kind: "item", id: "copy", label: "Copy link", icon: "link", shortcut: "⌘C" },
    { kind: "item", id: "star", label: "Add to starred", icon: "star" },
    { kind: "item", id: "view", label: "View details", icon: "eye", shortcut: "⌘I" },
    { kind: "separator" },
    { kind: "item", id: "edit", label: "Edit message", icon: "edit", shortcut: "⌘E" },
    {
        kind: "item",
        id: "delete",
        label: "Delete message",
        icon: "close",
        danger: true,
        shortcut: "⇧⌘D",
    },
];

const grouped: MenuItem[] = [
    { kind: "label", label: "Sort by" },
    { kind: "item", id: "recent", label: "Most recent", icon: "clock" },
    { kind: "item", id: "unread", label: "Unread first", icon: "inbox" },
    { kind: "separator" },
    { kind: "label", label: "Filter" },
    { kind: "item", id: "mentions", label: "Only mentions", icon: "at" },
    { kind: "item", id: "muted", label: "Include muted", icon: "bell", disabled: true },
];

const textOnly: MenuItem[] = [
    { kind: "item", id: "rename", label: "Rename" },
    { kind: "item", id: "duplicate", label: "Duplicate", shortcut: "⌘D" },
    { kind: "item", id: "archive", label: "Archive" },
    { kind: "separator" },
    { kind: "item", id: "leave", label: "Leave channel", danger: true },
];

const states: MenuItem[] = [
    { kind: "item", id: "reply", label: "Reply", icon: "reply" },
    { kind: "item", id: "pin", label: "Pin (disabled)", icon: "star", disabled: true },
    { kind: "separator" },
    { kind: "item", id: "remove", label: "Remove", icon: "close", danger: true },
];

export function MenuPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Dropdown / context-menu popover — 220px raised card, 28px item rows, icon gutter, KeyCap shortcuts, mono section labels, danger items, and 1px separators."
            title="Menu"
        >
            <Specimen
                detail="Chinese and English information uses natural text widths; actual shortcuts retain key caps"
                label="Account hints"
                number="M-00"
                stage="app"
            >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", padding: "28px" }}>
                    <Menu
                        width={240}
                        items={[
                            {
                                kind: "item",
                                id: "usage",
                                label: "用量",
                                icon: "zap",
                                hint: "82% 剩余",
                            },
                            {
                                kind: "item",
                                id: "profile",
                                label: "个人资料",
                                icon: "users",
                            },
                            {
                                kind: "item",
                                id: "settings",
                                label: "设置",
                                icon: "settings",
                                shortcut: "⌘,",
                            },
                        ]}
                    />
                    <Menu
                        width={260}
                        items={[
                            {
                                kind: "item",
                                id: "usage",
                                label: "Usage",
                                icon: "zap",
                                hint: "82% left",
                            },
                            {
                                kind: "item",
                                id: "profile",
                                label: "Profile",
                                icon: "users",
                            },
                            {
                                kind: "item",
                                id: "settings",
                                label: "Settings",
                                icon: "settings",
                                shortcut: "⌘,",
                            },
                        ]}
                    />
                </div>
            </Specimen>
            <div className="specimen-grid">
                <Specimen
                    detail="220px card · 28px rows · icon gutter · ⌘ shortcuts · danger"
                    label="Context menu"
                    number="M-01"
                    stage="app"
                >
                    <div style={{ display: "grid", gap: "8px", padding: "28px" }}>
                        <div style={{ width: "220px" }}>
                            <DimensionRule label="width 220" />
                        </div>
                        <Menu items={messageActions} />
                    </div>
                </Specimen>

                <Specimen
                    detail="mono section labels · separators · disabled row"
                    label="Grouped"
                    number="M-02"
                    stage="app"
                >
                    <div style={{ padding: "28px" }}>
                        <Menu items={grouped} width={224} />
                    </div>
                </Specimen>
            </div>

            <div className="specimen-grid">
                <Specimen
                    detail="no icons — labels sit on the 8px edge, no gutter reserved"
                    label="Text only"
                    number="M-03"
                    stage="app"
                >
                    <div style={{ display: "grid", gap: "8px", padding: "28px" }}>
                        <div style={{ width: "192px" }}>
                            <DimensionRule label="width 192" />
                        </div>
                        <Menu items={textOnly} width={192} />
                    </div>
                </Specimen>

                <Specimen
                    detail="resting · disabled (0.4 alpha) · danger row"
                    label="States"
                    number="M-04"
                    stage="app"
                >
                    <div style={{ padding: "28px" }}>
                        <Menu items={states} width={200} />
                    </div>
                </Specimen>
            </div>
        </ComponentPage>
    );
}
