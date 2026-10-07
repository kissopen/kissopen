import { useState, type ReactNode } from "react";
import { Button } from "../../src/Button";
import { Sidebar, type SidebarSection } from "../../src/Sidebar";
import { SidebarFooter } from "../../src/SidebarFooter";
import { SidebarSpaces, type SidebarSpace } from "../../src/SidebarSpaces";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-261";

function Frame(props: { children: ReactNode; height: number }) {
    return (
        <div
            style={{
                background: "var(--groupped-background)",
                border: "1px solid var(--divider)",
                display: "flex",
                height: `${String(props.height)}px`,
                overflow: "hidden",
                width: "300px",
            }}
        >
            {props.children}
        </div>
    );
}

const workSections: SidebarSection[] = [
    {
        id: "work-views",
        items: [
            { badge: 6, icon: "inbox", id: "inbox", kind: "view", label: "Inbox", unread: true },
            { icon: "spark", id: "runs", kind: "view", label: "Agent runs", meta: "3" },
        ],
    },
    {
        id: "work-projects",
        items: [
            { id: "kissopen", initials: "H", kind: "project", label: "kissopen" },
            { depth: 1, id: "kissopen-spaces", kind: "workspace", label: "sidebar-spaces" },
            { id: "kissopen-agent", initials: "H", kind: "project", label: "kissopen-agent" },
        ],
        label: "Projects",
    },
];

const readingSections: SidebarSection[] = [
    {
        id: "reading-views",
        items: [
            { icon: "doc", id: "notes", kind: "view", label: "Notes" },
            { icon: "star", id: "saved", kind: "view", label: "Saved" },
            { icon: "globe", id: "feeds", kind: "view", label: "Feeds", meta: "12" },
        ],
    },
];

const opsSections: SidebarSection[] = [
    {
        id: "ops-views",
        items: [
            { icon: "terminal", id: "hosts", kind: "view", label: "Hosts" },
            { icon: "shield", id: "audit", kind: "view", label: "Audit" },
        ],
        label: "Operations",
    },
];

/** One space's body: the ordinary navigation column, minus its own footer. */
function SpaceBody(props: { activeItemId: string; sections: SidebarSection[]; title: string }) {
    return (
        <Sidebar
            activeItemId={props.activeItemId}
            onItemSelect={() => {}}
            sections={props.sections}
            style={{ width: "100%" }}
            title={props.title}
        />
    );
}

const SPACES: readonly SidebarSpace[] = [
    {
        content: <SpaceBody activeItemId="inbox" sections={workSections} title="Work" />,
        emoji: "🛠️",
        id: "work",
        label: "Work",
    },
    {
        content: <SpaceBody activeItemId="notes" sections={readingSections} title="Reading" />,
        icon: "doc",
        id: "reading",
        label: "Reading",
    },
    {
        content: <SpaceBody activeItemId="hosts" sections={opsSections} title="Operations" />,
        icon: "terminal",
        id: "ops",
        label: "Operations",
    },
];

function LiveSpaces(props: { create?: boolean; leading?: ReactNode }) {
    const [active, setActive] = useState("work");
    return (
        <SidebarSpaces
            activeSpaceId={active}
            leading={props.leading}
            onSpaceCreate={props.create === false ? undefined : () => {}}
            onSpaceSelect={setActive}
            spaces={SPACES}
        />
    );
}

/** The strip on its own, for the states that are about the strip rather than the travel. */
const MARK_ONLY_SPACES: readonly SidebarSpace[] = SPACES.map(({ content: _content, ...space }) => ({
    ...space,
}));

function StripOnly(props: { activeSpaceId: string; create?: boolean; leading?: ReactNode }) {
    return (
        <SidebarSpaces
            activeSpaceId={props.activeSpaceId}
            leading={props.leading}
            onSpaceCreate={props.create === false ? undefined : () => {}}
            onSpaceSelect={() => {}}
            spaces={MARK_ONLY_SPACES}
            style={{ flex: "none" }}
        />
    );
}

export function SidebarSpacesPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="The spaces a navigation column is divided into: one showing at a time, switched by swiping the column sideways or by the marks in the 40px strip pinned beneath them."
            title="Sidebar spaces"
        >
            <Specimen
                detail="Every space stays mounted · two-finger swipe across the column, or press a mark · 40px strip on a top hairline"
                label="Spaces in a column"
                number="01"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <Frame height={520}>
                        <LiveSpaces
                            leading={
                                <Button
                                    aria-label="Archive"
                                    icon="archive"
                                    iconOnly
                                    size="small"
                                    variant="ghost"
                                />
                            }
                        />
                    </Frame>
                    <DimensionRule label="300 px column · 520 px viewport · strip 40 px" />
                </div>
            </Specimen>

            <Specimen
                detail="A space's own footer sits under the strip, so the identity row belongs to the column rather than to one space."
                label="With the column footer"
                number="01b"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <Frame height={520}>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                                width: "100%",
                            }}
                        >
                            <LiveSpaces />
                            <div
                                style={{
                                    borderTop: "1px solid var(--divider)",
                                    display: "flex",
                                    flex: "none",
                                    alignItems: "center",
                                    height: "56px",
                                    padding: "0 12px",
                                }}
                            >
                                <SidebarFooter
                                    appearance="light"
                                    initials="SK"
                                    name="Steve"
                                    onAppearanceToggle={() => {}}
                                    onSettingsOpen={() => {}}
                                    online
                                />
                            </div>
                        </div>
                    </Frame>
                    <DimensionRule label="strip 40 px · footer 56 px" />
                </div>
            </Specimen>

            <Specimen
                detail="Each mark is 28px: the current one is filled and full-strength, the rest are muted until hovered."
                label="Switcher states"
                number="02"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {(
                        [
                            { id: "work", label: "First space current" },
                            { id: "reading", label: "Middle space current" },
                            { id: "ops", label: "Last space current" },
                        ] as const
                    ).map((state) => (
                        <div
                            key={state.id}
                            style={{ display: "flex", flexDirection: "column", gap: "6px" }}
                        >
                            <Frame height={40}>
                                <StripOnly activeSpaceId={state.id} />
                            </Frame>
                            <DimensionRule label={state.label} />
                        </div>
                    ))}
                </div>
            </Specimen>

            <Specimen
                detail="Both edge lanes are equal and always present, so the marks stay on the column's centre whatever the lanes carry."
                label="Strip lanes"
                number="03"
                stage="app"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <Frame height={40}>
                            <StripOnly activeSpaceId="work" />
                        </Frame>
                        <DimensionRule label="Add control only" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <Frame height={40}>
                            <StripOnly
                                activeSpaceId="work"
                                leading={
                                    <Button
                                        aria-label="Archive"
                                        icon="archive"
                                        iconOnly
                                        size="small"
                                        variant="ghost"
                                    />
                                }
                            />
                        </Frame>
                        <DimensionRule label="Leading control and add control" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <Frame height={40}>
                            <StripOnly activeSpaceId="work" create={false} />
                        </Frame>
                        <DimensionRule label="Fixed set of spaces · no control in either lane" />
                    </div>
                </div>
            </Specimen>
        </ComponentPage>
    );
}
