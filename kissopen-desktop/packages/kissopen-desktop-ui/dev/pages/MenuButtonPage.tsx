import { MenuButton } from "../../src/MenuButton";
import type { MenuItem } from "../../src/Menu";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-027a";

const historyItems: MenuItem[] = [
    { kind: "label", label: "Archived sessions" },
    { kind: "item", id: "session-1", label: "Navigation cleanup", icon: "archive" },
    { kind: "item", id: "session-2", label: "Weekly plan usage", icon: "archive" },
    { kind: "separator" },
    { kind: "label", label: "Recent files" },
    { kind: "item", id: "file-1", label: "/…/navigation/history.ts", icon: "doc" },
    { kind: "item", id: "file-2", label: "/…/ui/AppShell.tsx", icon: "doc" },
];

export function MenuButtonPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Compact icon action with a corner-anchored Menu. Opening moves focus into the first enabled row; Escape and selection return it to the trigger."
            title="Menu button"
        >
            <div className="specimen-grid">
                <Specimen
                    detail="28px icon trigger · end-aligned 300px popover · fixed heading · bounded history pages"
                    label="End aligned"
                    number="MB-01"
                    stage="app"
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            padding: "28px",
                            width: "380px",
                        }}
                    >
                        <MenuButton
                            align="end"
                            icon="history"
                            items={historyItems}
                            label="Open workspace history"
                            menuLabel="Tab history"
                            menuMaxHeight={220}
                            menuPageSize={4}
                            menuWidth={300}
                            onSelect={() => {}}
                        />
                    </div>
                    <DimensionRule label="trigger 28 px · popover 300 px · 4 px corner gap" />
                </Specimen>

                <Specimen
                    detail="disabled trigger · no popover · standard ghost-button treatment"
                    label="Unavailable"
                    number="MB-02"
                    stage="surface"
                >
                    <div style={{ display: "flex", padding: "28px" }}>
                        <MenuButton
                            disabled
                            icon="history"
                            items={historyItems}
                            label="Workspace history unavailable"
                            onSelect={() => {}}
                        />
                    </div>
                </Specimen>
            </div>
        </ComponentPage>
    );
}
