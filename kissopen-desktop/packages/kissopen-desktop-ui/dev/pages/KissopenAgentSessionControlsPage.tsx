import {
    KissopenAgentControlMenu,
    KissopenAgentSessionControls,
} from "../../src/KissopenAgentSessionControls";
import { ComponentPage, Specimen } from "../kit";

/* A stand-in for an installed application's artwork: the real one comes from
   the bundle at runtime, and the blueprint must stay self-contained. */
const APP_ICON =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2b6cb0"/><path d="M20 22h24v6H20zm0 12h24v6H20z" fill="#fff"/></svg>',
    );
import { kissopenAgentMenus } from "./kissopenAgentChatFixtures";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-151";

export function KissopenAgentSessionControlsPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="KISSOPEN Agent session control bar: model / effort / permission / service-tier dropdowns built on Menu, driven by a KissopenAgentMenusSnapshot."
            title="KissopenAgentSessionControls"
        >
            <Specimen
                detail="four control menus with the current option check-marked"
                label="Control bar"
                number="01"
                stage="surface"
            >
                <div style={{ width: "620px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentSessionControls
                        menus={kissopenAgentMenus}
                        onEffortChange={() => undefined}
                        onModelChange={() => undefined}
                        onPermissionModeChange={() => undefined}
                        onServiceTierChange={() => undefined}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="the quiet composer-footer form: no box, dimmed until pointed at"
                label="Ghost variant"
                number="02"
                stage="surface"
            >
                <div style={{ width: "620px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentSessionControls
                        fields={["permission", "tier"]}
                        menuPlacement="above"
                        menus={kissopenAgentMenus}
                        onEffortChange={() => undefined}
                        onModelChange={() => undefined}
                        onPermissionModeChange={() => undefined}
                        onServiceTierChange={() => undefined}
                        variant="ghost"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="a provider without a fast tier: the speed control is absent, not a one-row menu"
                label="Regular only"
                number="03"
                stage="surface"
            >
                <div style={{ width: "620px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentSessionControls
                        fields={["permission", "tier"]}
                        menuPlacement="above"
                        menus={{
                            ...kissopenAgentMenus,
                            serviceTierOptions: [{ tier: null, label: "Regular", current: true }],
                        }}
                        onEffortChange={() => undefined}
                        onModelChange={() => undefined}
                        onPermissionModeChange={() => undefined}
                        onServiceTierChange={() => undefined}
                        variant="ghost"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="the current model, effort, access, and speed remain legible but cannot be changed"
                label="Read only"
                number="04"
                stage="surface"
            >
                <div style={{ width: "620px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentSessionControls
                        disabled
                        menus={kissopenAgentMenus}
                        onEffortChange={() => undefined}
                        onModelChange={() => undefined}
                        onPermissionModeChange={() => undefined}
                        onServiceTierChange={() => undefined}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="a trigger wearing an application's own icon, as Open in does"
                label="Leading icon"
                number="05"
                stage="surface"
            >
                <div style={{ width: "320px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentControlMenu
                        items={[
                            { kind: "item", id: "vscode", label: "VS Code", iconUrl: APP_ICON },
                            { kind: "item", id: "finder", label: "Finder", iconUrl: APP_ICON },
                        ]}
                        label="Open in"
                        leadingIconUrl={APP_ICON}
                        onSelect={() => undefined}
                    />
                </div>
            </Specimen>

            <Specimen
                detail="the label side repeats the last choice; only the chevron opens the list"
                label="Split trigger"
                number="06"
                stage="surface"
            >
                <div style={{ width: "320px", padding: "12px", background: "var(--surface)" }}>
                    <KissopenAgentControlMenu
                        items={[
                            { kind: "item", id: "vscode", label: "VS Code", iconUrl: APP_ICON },
                            { kind: "item", id: "finder", label: "Finder", iconUrl: APP_ICON },
                            { kind: "separator" },
                            { kind: "item", id: "copy-path", label: "Copy path", icon: "doc" },
                        ]}
                        label="Open in"
                        leadingIconUrl={APP_ICON}
                        onPrimary={() => undefined}
                        onSelect={() => undefined}
                        primaryLabel="Open in VS Code"
                    />
                </div>
            </Specimen>

            <Specimen
                detail="one control opened to its Menu popover"
                label="Open control menu"
                number="07"
                stage="surface"
            >
                <div
                    style={{
                        width: "320px",
                        height: "220px",
                        padding: "12px",
                        background: "var(--surface)",
                    }}
                >
                    <KissopenAgentControlMenu
                        items={[
                            {
                                kind: "item",
                                id: "medium",
                                label: "Medium (default)",
                                icon: "check",
                            },
                            { kind: "item", id: "high", label: "High" },
                        ]}
                        label="Effort"
                        onSelect={() => undefined}
                        value="Medium"
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
