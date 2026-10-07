import { t } from "kissopen-desktop-state";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";
import { ScrollArea } from "./Scrollbar";

export type ComposerPanelProps = {
    /** What the reading is, said in the words the command that opened it uses. */
    title: string;
    /** A word about the reading's own freshness, beside the title. */
    status?: string;
    /**
     * Puts the panel away. It is required rather than optional: a reading the
     * reader cannot close is one they are stuck in.
     */
    onClose: () => void;
    /** The reading itself — a content block, not a surface of its own. */
    children: ReactNode;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/**
 * ComposerPanel — a bounded, dismissible card the write end carries directly
 * above the composer.
 *
 * It exists because a reading about the session — what its subagents are doing,
 * what it has spent — is not a place to go. Given the whole surface it replaces
 * the transcript with a screen that has no way back; given this card it sits in
 * the one part of the conversation the reader cannot scroll away from, while
 * the transcript stays where it was. Its height is capped and its body scrolls,
 * so a session with forty subagents in it takes no more room than a session
 * with one.
 *
 * Props only: it holds nothing, fetches nothing, and reports the close upward.
 */
export function ComposerPanel(props: ComposerPanelProps) {
    return (
        <section
            className={["kissopen-composer-panel", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="composer-panel"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <header
                className="kissopen-composer-panel__header"
                data-kissopen-desktop-ui="composer-panel-header"
            >
                <div className="kissopen-composer-panel__heading">
                    <span
                        className="kissopen-composer-panel__title"
                        data-kissopen-desktop-ui="composer-panel-title"
                    >
                        {props.title}
                    </span>
                    {props.status === undefined ? null : (
                        <span
                            className="kissopen-composer-panel__status"
                            data-kissopen-desktop-ui="composer-panel-status"
                        >
                            {props.status}
                        </span>
                    )}
                </div>
                <Button
                    aria-label={t("Close {title}", { title: props.title })}
                    icon="close"
                    iconOnly
                    onClick={props.onClose}
                    size="small"
                    variant="ghost"
                />
            </header>
            <ScrollArea
                axes="both"
                className="kissopen-composer-panel__body"
                data-kissopen-desktop-ui="composer-panel-body"
                viewportClassName="kissopen-composer-panel__body-viewport"
            >
                <div className="kissopen-composer-panel__content">{props.children}</div>
            </ScrollArea>
        </section>
    );
}
