import { t } from "kissopen-desktop-state";
import type { ReactNode } from "react";
import { AppShell } from "../../AppShell";
import { Box } from "../../Box";
import { type IconName } from "../../Icon";
import { KissopenPageHeading } from "../../KissopenPageHeading";
import { ScrollArea } from "../../Scrollbar";
import { Sidebar } from "../../Sidebar";

export interface KissopenAgentSettingsCategory {
    readonly id: string;
    readonly label: string;
    readonly icon: IconName;
}

export type KissopenAgentSettingsShellProps = {
    activeCategoryId: string;
    categories: readonly KissopenAgentSettingsCategory[];
    children: ReactNode;
    /** The open category's own subtitle, shown under its title. */
    description?: string;
    onCategorySelect: (id: string) => void;
    /** Leaves settings and returns to the workspace. */
    onClose: () => void;
    title: string;
    /** Native macOS window chrome, matching the workspace shell it replaces. */
    windowControls?: boolean;
    windowFullScreen?: boolean;
    /** A connection rail holds the window's left edge; see `AppShell`. */
    connectionRail?: boolean;
};

/**
 * The local workspace's settings window: a permanent category column beside one
 * category's body.
 *
 * The column is not the workspace sidebar and does not collapse — settings is a
 * two-pane place with nothing to gain from hiding half of it — so the control at
 * the top of that column is the way back out rather than a collapse toggle. It is
 * the `Sidebar` drill-down heading. In a native window it sits below the
 * traffic-light lane, like the workspace's brand; web and full screen need no lane.
 */
export function KissopenAgentSettingsShell(props: KissopenAgentSettingsShellProps) {
    return (
        <AppShell
            className="kissopen-agent-settings-shell"
            windowControls={props.windowControls}
            windowFullScreen={props.windowFullScreen}
            connectionRail={props.connectionRail}
            sidebar={
                <Sidebar
                    activeItemId={props.activeCategoryId}
                    onBack={props.onClose}
                    onItemSelect={props.onCategorySelect}
                    sections={[
                        {
                            id: "categories",
                            items: props.categories.map((category) => ({
                                icon: category.icon,
                                id: category.id,
                                kind: "view" as const,
                                label: category.label,
                            })),
                        },
                    ]}
                    title={t("Settings")}
                />
            }
        >
            <KissopenPageHeading
                title={props.title}
                description={props.description}
                icon={categoryIcon(props)}
            />
            <ScrollArea
                className="kissopen-agent-settings__body"
                data-kissopen-desktop-ui="kissopen-agent-settings-body"
                viewportClassName="kissopen-agent-settings__body-viewport"
            >
                <Box className="kissopen-agent-settings__content">{props.children}</Box>
            </ScrollArea>
        </AppShell>
    );
}

function categoryIcon(props: KissopenAgentSettingsShellProps): IconName {
    return (
        props.categories.find((category) => category.id === props.activeCategoryId)?.icon ??
        "settings"
    );
}

export interface KissopenAgentSettingsSectionProps {
    children: ReactNode;
    description?: string;
    /**
     * `form` tiles `FormRow`s, which already carry their own hairline, so the
     * block adds no gap. `cards` separates free-standing cards instead.
     */
    rows?: "form" | "cards";
    /**
     * Omitted when the category's own header already names the block — the
     * first section of a one-subject category would otherwise repeat the title
     * printed directly above it.
     */
    title?: string;
}

/** One block of settings rows inside a category body, titled or not. */
export function KissopenAgentSettingsSection(props: KissopenAgentSettingsSectionProps) {
    return (
        <section
            className="kissopen-agent-settings__section"
            data-kissopen-desktop-ui="kissopen-agent-settings-section"
        >
            {props.title === undefined && props.description === undefined ? null : (
                <Box className="kissopen-agent-settings__section-heading">
                    {props.title === undefined ? null : (
                        <h2
                            className="kissopen-agent-settings__section-title"
                            data-kissopen-desktop-ui="kissopen-agent-settings-section-title"
                        >
                            {props.title}
                        </h2>
                    )}
                    {props.description ? (
                        <p
                            className="kissopen-agent-settings__section-description"
                            data-kissopen-desktop-ui="kissopen-agent-settings-section-description"
                        >
                            {props.description}
                        </p>
                    ) : null}
                </Box>
            )}
            <Box className="kissopen-agent-settings__section-rows" data-rows={props.rows ?? "form"}>
                {props.children}
            </Box>
        </section>
    );
}
