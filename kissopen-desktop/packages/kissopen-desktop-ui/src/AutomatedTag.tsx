import { t } from "kissopen-desktop-state";
import { Icon } from "./Icon";
export type AutomatedTagProps = {
    className?: string;
    /**
     * Accessible sentence read in place of the visible caption. Defaults to a
     * plain description of automation attribution so a screen reader announces
     * the meaning rather than the bare word.
     */
    "aria-label"?: string;
};
/**
 * Restrained inline marker for a user-attributed message that was posted through
 * automation — a plugin or API acting on the author's behalf — rather than typed
 * by hand. It is deliberately quiet: a small chip glyph beside a muted mono
 * "Automated" caption that reads as author metadata, never as a loud status pill
 * and never as the separate agent/system identity treatment. It carries no
 * product logic; the caller decides when a message is automated and composes it
 * beside the author.
 */
export function AutomatedTag(props: AutomatedTagProps) {
    return (
        <span
            aria-label={props["aria-label"] ?? t("Posted automatically on the author’s behalf")}
            className={["kissopen-automated-tag", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="automated-tag"
            role="note"
        >
            <span
                aria-hidden="true"
                className="kissopen-automated-tag__icon"
                data-kissopen-desktop-ui="automated-tag-icon"
            >
                <Icon name="agents" size={12} />
            </span>
            <span
                aria-hidden="true"
                className="kissopen-automated-tag__label"
                data-kissopen-desktop-ui="automated-tag-label"
            >
                {t("Automated")}
            </span>
        </span>
    );
}
