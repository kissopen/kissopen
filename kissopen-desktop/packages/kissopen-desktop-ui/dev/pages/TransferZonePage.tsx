import { useState } from "react";
import { EmptyState } from "../../src/EmptyState";
import { TabbedPane } from "../../src/TabbedPane";
import { type TabItem } from "../../src/Tabs";
import { TransferZone } from "../../src/TransferZone";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-171";

const MAIN_ZONE = "blueprint-main";
const SIDE_ZONE = "blueprint-side";

interface Held {
    readonly id: string;
    readonly label: string;
    readonly icon: TabItem["icon"];
    readonly side: boolean;
}

const held: readonly Held[] = [
    { id: "chat", label: "Refactor the router", icon: "chat", side: false },
    { id: "readme", label: "README.md", icon: "doc", side: false },
    { id: "terminal", label: "Terminal 1", icon: "terminal", side: true },
    { id: "page", label: "localhost:3000", icon: "globe", side: true },
];

/**
 * Both strips, live: a tab dragged out of one lands in the other, and so does
 * one moved with alt and an arrow key or from its own context menu. The
 * conversation tab is deliberately not transferable, which is what the strip
 * looks like when a tab has only one home.
 */
function LiveTransfer() {
    const [placement, setPlacement] = useState<Readonly<Record<string, boolean>>>({});
    const [mainActive, setMainActive] = useState("chat");
    const [sideActive, setSideActive] = useState("terminal");
    const sideOf = (item: Held): boolean => placement[item.id] ?? item.side;
    const tabsOf = (side: boolean): TabItem[] =>
        held
            .filter((item) => sideOf(item) === side)
            .map((item) => ({ icon: item.icon, id: item.id, label: item.label }));
    const move = (id: string, zone: string): void => {
        setPlacement({ ...placement, [id]: zone === SIDE_ZONE });
        if (zone === SIDE_ZONE) setSideActive(id);
        else setMainActive(id);
    };
    return (
        <div
            style={{
                border: "1px solid var(--divider)",
                display: "flex",
                height: "300px",
                width: "720px",
            }}
        >
            <TransferZone
                icon="panel-collapse"
                id={MAIN_ZONE}
                label="Open in the main content"
                style={{ flex: "1 1 auto" }}
            >
                <TabbedPane
                    activeId={mainActive}
                    onSelect={setMainActive}
                    onTransfer={move}
                    tabs={tabsOf(false)}
                    transferTargets={[
                        { label: "the side panel", side: "trailing", zone: SIDE_ZONE },
                    ]}
                    transferable={(tab) => tab.id !== "chat"}
                >
                    <EmptyState
                        description="Drag a tab across, or press alt and the arrow pointing where it should go."
                        icon="chat"
                        size="panel"
                        title="Main content"
                    />
                </TabbedPane>
            </TransferZone>
            <TransferZone
                icon="panel-expand"
                id={SIDE_ZONE}
                label="Open in the side panel"
                style={{ borderLeft: "1px solid var(--divider)", flex: "0 0 280px" }}
            >
                <TabbedPane
                    activeId={sideActive}
                    onSelect={setSideActive}
                    onTransfer={move}
                    tabs={tabsOf(true)}
                    transferTargets={[
                        { label: "the main content", side: "leading", zone: MAIN_ZONE },
                    ]}
                >
                    <EmptyState
                        description="Everything here can be moved to the main content."
                        icon="terminal"
                        size="panel"
                        title="Side panel"
                    />
                </TabbedPane>
            </TransferZone>
        </div>
    );
}

function Region(props: { label: string; state?: "armed" | "over" }) {
    return (
        <div
            style={{
                border: "1px solid var(--divider)",
                display: "flex",
                height: "160px",
                width: "260px",
            }}
        >
            <TransferZone id={`static-${props.label}`} label="Open here" state={props.state}>
                <EmptyState icon="files" size="panel" title="A region" />
            </TransferZone>
        </div>
    );
}

export function TransferZonePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The region a tab lands in when it is dragged out of another strip: nothing at all until a drag begins, then an inset outline and what dropping here would do."
            title="Transfer zone"
        >
            <div className="specimen-grid">
                <Specimen
                    detail="the region as it is whenever nothing is being dragged"
                    label="At rest"
                    number="Z-01"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <Region label="rest" />
                        <DimensionRule label="no outline · no badge · content untouched" />
                    </div>
                </Specimen>
                <Specimen
                    detail="a transferable tab has been picked up somewhere in the window"
                    label="Armed"
                    number="Z-02"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <Region label="armed" state="armed" />
                        <DimensionRule label="dashed outline · inset 8 · badge 70%" />
                    </div>
                </Specimen>
                <Specimen
                    detail="the pointer is inside: releasing now drops the tab here"
                    label="Over"
                    number="Z-03"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <Region label="over" state="over" />
                        <DimensionRule label="solid accent outline · badge 100% · ripple fill" />
                    </div>
                </Specimen>
                <Specimen
                    detail="drag a tab between the strips, or move one with alt+arrow or its menu"
                    label="Both strips, live"
                    number="Z-04"
                    stage="app"
                >
                    <div style={{ padding: "24px" }}>
                        <LiveTransfer />
                        <DimensionRule label="carried label follows the pointer · escape cancels" />
                    </div>
                </Specimen>
            </div>
        </ComponentPage>
    );
}
