import type { ReactNode } from "react";
import { type IconName } from "./Icon";
import lockupLight from "./assets/brand/lockup-light.svg";
import { ScrollArea } from "./Scrollbar";
import { KissopenAgentSettingsSection } from "./pages/settings/KissopenAgentSettingsShell";

export interface KissopenShellProps {
    readonly selected: string;
    readonly tabs: readonly { id: string; title: string; icon?: IconName }[];
    readonly onSelect: (id: string) => void;
    readonly workspace: ReactNode;
    readonly cloud: ReactNode;
    /** Conversation surfaces own their transcript scrollport and composer. */
    readonly conversation?: ReactNode;
}
export function KissopenShell(props: KissopenShellProps) {
    return (
        <div className="kissopen-shell" data-kissopen-desktop-ui="kissopen-shell">
            <div className="kissopen-workspace" hidden={props.selected !== "workspace"}>
                {props.workspace}
            </div>
            {props.selected !== "workspace" &&
                (props.conversation ?? (
                    <ScrollArea className="kissopen-scroll">
                        <div className="kissopen-content">{props.cloud}</div>
                    </ScrollArea>
                ))}
        </div>
    );
}
export function KissopenSplitPane(props: {
    readonly sidebar: ReactNode;
    readonly children: ReactNode;
}) {
    return (
        <div className="kissopen-split-pane">
            <div className="kissopen-split-pane__sidebar">{props.sidebar}</div>
            <div className="kissopen-split-pane__conversation">{props.children}</div>
        </div>
    );
}
export function KissopenSection(props: { readonly title: string; readonly children: ReactNode }) {
    return (
        <KissopenAgentSettingsSection title={props.title} rows="cards">
            {props.children}
        </KissopenAgentSettingsSection>
    );
}
export function KissopenActions(props: { readonly children: ReactNode }) {
    return <div className="kissopen-actions">{props.children}</div>;
}
export function KissopenNotice(props: { readonly children: ReactNode; readonly error?: boolean }) {
    return (
        <div
            className="kissopen-notice"
            data-error={props.error || undefined}
            role={props.error ? "alert" : "status"}
        >
            {props.children}
        </div>
    );
}

/**
 * Official outlined KissOpen lockup, identical across languages.
 * ThemeScope selects the supplied inverse/primary asset through CSS.
 * Size the complete unit with `--kissopen-lockup-height`, never individual letters.
 */
export function KissopenLockup(props: {
    readonly className?: string;
    /** Kept for caller compatibility; the brand is identical in every language. */
    readonly language?: "zh" | "en";
}) {
    return (
        <span
            aria-label="KissOpen"
            className={["kissopen-lockup", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="lockup"
            role="img"
        >
            <img alt="" aria-hidden="true" className="kissopen-lockup__image" src={lockupLight} />
        </span>
    );
}

/** The drawing the lockup's mark uses; its box is sized by the stylesheet. */

export function KissopenWordmark() {
    return <KissopenLockup className="kissopen-wordmark" />;
}
