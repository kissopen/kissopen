import { useState, type ReactNode } from "react";
import { composerCapabilitiesNone } from "kissopen-desktop-state";
import { AppShell } from "../../src/AppShell";
import { ProjectBoard, type ProjectBoardDocument } from "../../src/ProjectBoard";
import { ConversationView } from "../../src/ConversationView";
import { Button } from "../../src/Button";
import { Sidebar } from "../../src/Sidebar";
import { commandShortcut } from "../../src/keyboardShortcut";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-010";
const panelShortcut = commandShortcut("b", { alt: true });
/*
 * Slot placeholders: the shell composes TitleBar, Rail, Sidebar, and content
 * built elsewhere, so the blueprint marks each region with a dashed slot and
 * its contract dimension instead of duplicating those components.
 */
function Slot(props: { height?: string; label: string; note?: string; width?: string }) {
    return (
        <div
            style={{
                alignItems: "center",
                borderRadius: "6px",
                boxSizing: "border-box",
                color: "var(--input-placeholder)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                height: props.height ?? "100%",
                justifyContent: "center",
                margin: "6px",
                outline: "1px dashed var(--surface-selected)",
                outlineOffset: "-6px",
                width: props.width ?? "auto",
            }}
        >
            <span
                style={{
                    color: "var(--text-secondary)",
                    font: "700 11px var(--kissopen-font-mono)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                }}
            >
                {props.label}
            </span>
            {props.note ? (
                <span
                    style={{ font: "500 10px var(--kissopen-font-mono)", letterSpacing: "0.04em" }}
                >
                    {props.note}
                </span>
            ) : null}
        </div>
    );
}
const titleBarSlot = () => (
    <div style={{ boxSizing: "border-box", height: "38px", display: "flex" }}>
        <Slot height="auto" label="titleBar" note="38px" width="100%" />
    </div>
);
const railSlot = () => <Slot label="rail" note="76px" width="76px" />;
const sidebarSlot = () => <Slot label="sidebar" note="288px" width="288px" />;
function window1024(children: ReactNode) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "1024px" }}>
            <div style={{ height: "704px", width: "1024px" }}>{children}</div>
            <DimensionRule label="1024px × 704px — a representative window" />
        </div>
    );
}

/*
 * At the minimum desktop width the inspector overlays the reading column.
 */
const LANE_MIN = 250;
const WORKSPACE_MIN = 375;
const WINDOW_MIN = 720;

function windowAtMinimum(children: ReactNode) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                width: `${String(WINDOW_MIN)}px`,
            }}
        >
            <div style={{ height: "480px", width: `${String(WINDOW_MIN)}px` }}>{children}</div>
            <DimensionRule
                label={`${String(WINDOW_MIN)}px × 480px — main ≥ ${String(WORKSPACE_MIN)}px; inspector overlays if needed`}
            />
        </div>
    );
}

function shortcutShell(revealed: boolean) {
    return window1024(
        <div
            data-shortcut-hints={revealed ? "" : undefined}
            style={{ display: "flex", height: "100%", width: "100%" }}
        >
            <AppShell
                shortcutHints="display"
                sidebar={<Slot label="sidebar" note="resizable · 288px" />}
                sidebarCollapsible
                titleBar={titleBarSlot()}
            >
                <div
                    style={{
                        alignItems: "flex-start",
                        display: "flex",
                        height: "100%",
                        justifyContent: "flex-end",
                        padding: "14px 20px",
                    }}
                >
                    <Button
                        aria-label="Show panel"
                        icon="panel-expand"
                        iconOnly
                        shortcut={panelShortcut}
                        size="small"
                        variant="ghost"
                    />
                </div>
            </AppShell>
        </div>,
    );
}

const compactBoard: ProjectBoardDocument = {
    title: "十月新品发布",
    subtitle: "收窄主内容区后，项目自动切换为单列布局。",
    icon: "rocket",
    due: "10 月 31 日",
    blocks: [
        {
            type: "focus",
            id: "launch",
            size: "half",
            state: "needs_decision",
            eyebrow: "下一步",
            chips: [],
            title: "确认首批上架商品与推广预算",
            detail: "样品已齐，请确认优先上架的商品。",
            action: { label: "确认方案", prompt: "确认首批上架方案" },
        },
        {
            type: "milestones",
            size: "half",
            title: "90 天四个阶段",
            note: "W6 是关键检查点，请在这里确认下一步。",
            items: [
                { title: "定位验证期", detail: "前 3 周发 15 条", state: "current", icon: "flag" },
                { title: "爆款复制期", detail: "每周跟进 2 条内容", state: "todo", icon: "rocket" },
                {
                    title: "放量冲刺期",
                    detail: "确认预算和发布排期",
                    state: "todo",
                    icon: "rocket",
                },
            ],
        },
    ],
};
const watchCompact = () => () => {};
function CompactWorkspaceSpecimen() {
    const [width, setWidth] = useState(1280);
    const [panelWidth, setPanelWidth] = useState(340);
    const [panelOpen, setPanelOpen] = useState(true);
    const [chat, setChat] = useState(false);
    const [draft, setDraft] = useState("");
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => setWidth(1280)}>1280 px window</Button>
                <Button onClick={() => setWidth(720)}>720 px window</Button>
                <Button onClick={() => setChat(!chat)}>{chat ? "Show board" : "Show chat"}</Button>
                <Button onClick={() => setPanelOpen(!panelOpen)}>
                    {panelOpen ? "Close inspector" : "Open inspector"}
                </Button>
            </div>
            <div style={{ width, height: 760 }}>
                <AppShell
                    sidebar={<Slot label="Navigation" />}
                    sidebarCollapsible
                    sidebarDefaultWidth={250}
                >
                    <AppShell
                        embedded
                        panelResizable
                        panelWidth={panelWidth}
                        onPanelWidthChange={setPanelWidth}
                        panel={
                            panelOpen ? (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 16,
                                        padding: 16,
                                    }}
                                >
                                    <Button onClick={() => setPanelOpen(false)}>Close file</Button>
                                    <p>Drag the divider left until the main pane is 375px wide.</p>
                                </div>
                            ) : undefined
                        }
                    >
                        {chat ? (
                            <ConversationView
                                title="十月新品发布计划与资料"
                                subtitle="云端"
                                conversationId="compact-chat"
                                viewerId="reader"
                                entries={[]}
                                composer={{
                                    scopeId: "compact-chat",
                                    text: draft,
                                    attachments: [],
                                    revision: 0,
                                    submission: { status: "idle" },
                                    focused: false,
                                    agentUserIds: [],
                                    mentionCandidates: [],
                                    capabilities: composerCapabilitiesNone,
                                }}
                                composerPlaceholder="输入草稿，调整宽度后仍会保留…"
                                onComposerValueChange={setDraft}
                                onComposerSend={() => {}}
                            />
                        ) : (
                            <ProjectBoard
                                name="新品发布"
                                now={0}
                                state="ready"
                                document={compactBoard}
                                build={{ running: false }}
                                recent={[]}
                                onWatch={watchCompact}
                                onAsk={() => {}}
                                onConversationOpen={() => {}}
                                onFilesOpen={() => {}}
                            />
                        )}
                    </AppShell>
                </AppShell>
            </div>
        </div>
    );
}

export function AppShellPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Window composition: chrome base, 38px title bar row, rail | main card with no top/left inset, an 8px right/bottom inset, a macOS-matched 8px radius, and a darker sidebar lane separated by an inset hairline."
            title="AppShell"
        >
            <Specimen
                number="00"
                label="Phone-width workspace"
                detail="375px minimum · compact below 600px · nested cloud shell · resize without losing the draft"
                stage="app"
            >
                <CompactWorkspaceSpecimen />
            </Specimen>
            {[false, true].map((fullScreen) => (
                <Specimen
                    key={String(fullScreen)}
                    number={fullScreen ? "00b" : "00a"}
                    label={
                        fullScreen
                            ? "macOS navigation — full screen"
                            : "macOS navigation — windowed"
                    }
                    detail={
                        fullScreen
                            ? "Compact heading without native controls"
                            : "Native controls above the brand · 48px safe inset"
                    }
                    stage="chrome"
                >
                    {window1024(
                        <AppShell
                            windowControls
                            windowFullScreen={fullScreen}
                            sidebar={
                                <Sidebar
                                    brand
                                    activeItemId="chat"
                                    onItemSelect={() => {}}
                                    sections={[]}
                                    actions={[
                                        {
                                            id: "chat",
                                            kind: "channel",
                                            icon: "chat",
                                            label: "Chat",
                                        },
                                    ]}
                                />
                            }
                        >
                            <Slot label="Account workspace" />
                        </AppShell>,
                    )}
                </Specimen>
            ))}
            <Specimen
                detail="rail 76px · no top/left inset · 8px right/bottom + panel gap · radius 8px · darker sidebar + inset separator share the card with workspace"
                label="Full composition with panel"
                number="01"
                stage="chrome"
            >
                {window1024(
                    <AppShell
                        panel={<Slot label="panel" note="340px · agent desk" />}
                        rail={railSlot()}
                        sidebar={sidebarSlot()}
                        titleBar={titleBarSlot()}
                    >
                        <Slot
                            label="children"
                            note="main workspace · --colors-groupped-background"
                        />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="no panel — sidebar and workspace share one card, flush to rail/title with 8px right/bottom clearance"
                label="Rail + sidebar, no panel"
                number="02"
                stage="chrome"
            >
                {window1024(
                    <AppShell rail={railSlot()} sidebar={sidebarSlot()} titleBar={titleBarSlot()}>
                        <Slot label="children" note="workspace beside the 288px sidebar" />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="sidebar omitted · panelWidth 300 — the panel keeps its explicit width, the main card takes the rest"
                label="Rail only, custom panel width"
                number="03"
                stage="chrome"
            >
                {window1024(
                    <AppShell
                        panel={<Slot label="panel" note="panelWidth 300" />}
                        panelWidth={300}
                        rail={railSlot()}
                        titleBar={titleBarSlot()}
                    >
                        <Slot label="children" note="main workspace" />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="sidebarCollapsible + panelResizable: an 8px drag separator (role=separator) sits on each inner edge, and the sidebar carries a collapse control"
                label="Resizable sidebar + inspector"
                number="04"
                stage="chrome"
            >
                {window1024(
                    <AppShell
                        panel={<Slot label="panel" note="resizable · 340px" />}
                        panelResizable
                        rail={railSlot()}
                        sidebar={<Slot label="sidebar" note="resizable · 288px" />}
                        sidebarCollapsible
                        titleBar={titleBarSlot()}
                    >
                        <Slot label="children" note="main workspace" />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="collapsed sidebar: the sidebar DOM stays mounted but hidden, replaced by a 48px reveal lane whose button restores it"
                label="Sidebar collapsed"
                number="05"
                stage="chrome"
            >
                {window1024(
                    <AppShell
                        rail={railSlot()}
                        sidebar={<Slot label="sidebar" note="hidden while collapsed" />}
                        sidebarCollapsible
                        sidebarDefaultCollapsed
                        titleBar={titleBarSlot()}
                    >
                        <Slot label="children" note="workspace spans the freed space" />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="The collapse control keeps its header lane when Bots is first, leaving the section's create action clear. A leading Create row can share the compact fullscreen lane."
                label="Fullscreen sidebar actions"
                number="05b"
                stage="chrome"
            >
                {[false, true].map((compose) => (
                    <div key={String(compose)}>
                        {window1024(
                            <AppShell
                                connectionRail
                                rail={railSlot()}
                                sidebar={
                                    <Sidebar
                                        activeItemId=""
                                        onCompose={compose ? () => {} : undefined}
                                        onItemSelect={() => {}}
                                        onSectionAction={() => {}}
                                        sections={[
                                            {
                                                action: { icon: "plus", label: "Create bot" },
                                                id: "bots",
                                                label: "Bots",
                                                items: [
                                                    {
                                                        id: "chief-of-staff",
                                                        kind: "agent",
                                                        label: "小秘书",
                                                        icon: "chat",
                                                    },
                                                ],
                                            },
                                        ]}
                                    />
                                }
                                sidebarCollapsible
                                windowControls
                                windowFullScreen
                            >
                                <Slot label="workspace" />
                            </AppShell>,
                        )}
                    </div>
                ))}
            </Specimen>

            <Specimen
                detail="trace + input: the panel body (live trace) fills the column while a panelFooter keeps the composer pinned at the bottom; the panel body identity is unaffected as the footer mounts"
                label="Trace with composer footer"
                number="06"
                stage="chrome"
            >
                {window1024(
                    <AppShell
                        panel={
                            <Slot label="panel body" note="AgentTracePanel · ongoing inference" />
                        }
                        panelFooter={
                            <div
                                style={{ boxSizing: "border-box", height: "96px", display: "flex" }}
                            >
                                <Slot
                                    height="auto"
                                    label="panelFooter"
                                    note="composer dock"
                                    width="100%"
                                />
                            </div>
                        }
                        panelResizable
                        rail={railSlot()}
                        sidebar={<Slot label="sidebar" note="resizable · 288px" />}
                        sidebarCollapsible
                        titleBar={titleBarSlot()}
                    >
                        <Slot label="children" note="main workspace" />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="default state: shortcut KeyCaps stay in the DOM but paint nothing and leave both 28px controls unchanged"
                label="Command shortcuts · rest"
                number="07"
                stage="chrome"
            >
                {shortcutShell(false)}
            </Specimen>

            <Specimen
                detail="deterministic held-Command state after the 500ms discovery delay: the sidebar toggle and descendant panel control reveal out-of-flow KeyCaps without changing either hit box"
                label="Command shortcuts · held"
                number="08"
                stage="chrome"
            >
                {shortcutShell(true)}
            </Specimen>

            <Specimen
                detail="720×480 desktop minimum. The main reading column keeps at least 375px; the inspector overlays when both columns cannot fit."
                label="Every lane at its minimum"
                number="10"
                stage="chrome"
            >
                {windowAtMinimum(
                    <AppShell
                        panel={
                            <Slot
                                label="panel"
                                note={`shrunk to its ${String(LANE_MIN)}px floor`}
                            />
                        }
                        rail={railSlot()}
                        sidebar={
                            <Slot
                                label="sidebar"
                                note={`shrunk to its ${String(LANE_MIN)}px floor`}
                            />
                        }
                        titleBar={titleBarSlot()}
                    >
                        <Slot
                            label="children"
                            note={`holding the remaining ${String(WORKSPACE_MIN)}px`}
                        />
                    </AppShell>,
                )}
            </Specimen>

            <Specimen
                detail="Both lanes resizable in the narrowest window, which is where a lane's own cap stops being the whole answer. Drag either handle outward: it stops as soon as the workspace is down to its floor, because a lane is bounded by the room the rail, the lane opposite, and that floor leave it — not by the window alone. Two lanes each inside their own cap could otherwise ask for more than the window had between them, and since the content region clips, the far lane was cut off by the window edge rather than the middle refusing to give."
                label="Neither lane may take the middle's floor"
                number="11"
                stage="chrome"
            >
                {windowAtMinimum(
                    <AppShell
                        panel={<Slot label="panel" note="resizable · capped by what is left" />}
                        panelResizable
                        rail={railSlot()}
                        sidebar={<Slot label="sidebar" note="resizable · capped by what is left" />}
                        sidebarCollapsible
                        titleBar={titleBarSlot()}
                    >
                        <Slot label="children" note={`never below ${String(WORKSPACE_MIN)}px`} />
                    </AppShell>,
                )}
            </Specimen>
        </ComponentPage>
    );
}
