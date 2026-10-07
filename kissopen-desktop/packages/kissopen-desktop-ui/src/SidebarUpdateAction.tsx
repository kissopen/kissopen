import { t } from "kissopen-desktop-state";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Ionicon } from "./vectorIcons/VectorIcon";

export interface SidebarUpdateActionProps {
    /** Operation the host needs for this update source once it is ready. */
    action: "refresh" | "restart" | "install";
    /** Opens the panel on the first render, for blueprint fixtures and tests. */
    defaultOpen?: boolean;
    /** Detail shown while the update is arriving, such as download progress. */
    detail?: string;
    /** Applies the ready update through the operation named by `action`. */
    onAction?: () => void;
    status: "available" | "downloading" | "downloaded";
    /**
     * Which of the two things that can update this one is. It names the subject
     * — a version alone does not say what it is a version of — and it decides
     * what the panel promises about work in flight, which is the only question
     * anyone actually has before pressing the button.
     */
    subject: "application" | "kissopenAgent";
    /** Human-readable identity of the incoming version or build. */
    version?: string;
}

function versionLabel(version: string | undefined): string {
    if (!version) return "New version";
    return /^\d/u.test(version) ? `v${version}` : version;
}

/**
 * What survives the update. The answer is "everything" either way, so it is one
 * short line: the reader is deciding whether to press a button, not reading
 * release notes. Only the reason differs — Kissopen's own update takes the window
 * away while the agents carry on without it, and an agent's update hands its
 * running sessions over rather than dropping them.
 */
function assurance(subject: SidebarUpdateActionProps["subject"]): string {
    return subject === "kissopenAgent"
        ? "Running agents keep working."
        : "Agents keep working during the update.";
}

/**
 * SidebarUpdateAction — the standing sign that a newer version exists. The
 * footer keeps one 28px slot for it: a filled orange arrow-up-circle, the only
 * colour in a row of neutral ghost controls, so news is legible at a glance
 * without being read. The version, its state, and the action that applies it
 * live in the panel it opens above itself.
 *
 * A sentence in the footer was the wrong size for this: "Install · KISSOPEN Agent
 * v0.3.10" is either truncated or wider than the navigation it sits under, and
 * it spends the row on text nobody reads twice. The mark is either there or it
 * is not; the words appear when the reader asks for them.
 */
export function SidebarUpdateAction(props: SidebarUpdateActionProps) {
    const [open, setOpen] = useState(props.defaultOpen ?? false);
    const root = useRef<HTMLDivElement>(null);
    const version = versionLabel(props.version);
    // The name comes first wherever there is one, because "Install · v0.4.2" in
    // a corner of the window does not say what is being installed. Kissopen's own
    // update is the exception: the window it is named after is the thing the
    // reader is looking at.
    const subject = props.subject === "kissopenAgent" ? `KissOpen Agent ${version}` : version;
    const actionLabel =
        props.action === "refresh" ? "Refresh" : props.action === "install" ? "Install" : "Restart";
    const ready = props.status === "downloaded" && props.onAction !== undefined;
    const state =
        props.status === "downloaded"
            ? t("Ready to {actionLabel}", { actionLabel: actionLabel.toLowerCase() })
            : props.status === "downloading"
              ? (props.detail ?? "Downloading")
              : "Available to download";
    // The trigger is a glyph, so its own name has to carry everything the row
    // used to say out loud.
    const triggerLabel = ready ? `${actionLabel} ${subject}` : `${subject} — ${state}`;

    // eslint-disable-next-line kissopen-react/no-layout-effect -- an open popover owns document-level outside-pointer and Escape listeners that are attached after commit and completely removed when it closes
    useLayoutEffect(() => {
        if (!open) return;
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsidePointer, true);
        document.addEventListener("keydown", closeOnEscape, true);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            document.removeEventListener("keydown", closeOnEscape, true);
        };
    }, [open]);

    return (
        <div
            className="kissopen-sidebar-update"
            data-kissopen-desktop-ui="sidebar-update-action"
            data-open={open ? "" : undefined}
            data-status={props.status}
            ref={root}
        >
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={triggerLabel}
                className="kissopen-sidebar-update__trigger"
                data-kissopen-desktop-ui="sidebar-update-action-trigger"
                onClick={() => setOpen((current) => !current)}
                title={triggerLabel}
                type="button"
            >
                <Ionicon name="arrow-up-circle" size={20} />
            </button>
            {/* The mark says only that there is news; the words that changed are
                spoken here, where a state change is announced whether or not the
                panel is open. */}
            <span aria-live="polite" className="kissopen-visually-hidden" role="status">
                {`${subject} — ${state}`}
            </span>
            {open ? (
                <div
                    aria-label={t("Update")}
                    className="kissopen-sidebar-update__panel"
                    data-kissopen-desktop-ui="sidebar-update-action-panel"
                    role="menu"
                >
                    <span className="kissopen-sidebar-update__copy">
                        <span
                            className="kissopen-sidebar-update__eyebrow"
                            data-kissopen-desktop-ui="sidebar-update-action-eyebrow"
                        >
                            {t("Update")}
                        </span>
                        <span
                            className="kissopen-sidebar-update__subject"
                            data-kissopen-desktop-ui="sidebar-update-action-subject"
                            title={subject}
                        >
                            {subject}
                        </span>
                        <span
                            className="kissopen-sidebar-update__state"
                            data-kissopen-desktop-ui="sidebar-update-action-state"
                        >
                            {state}
                        </span>
                    </span>
                    <span
                        className="kissopen-sidebar-update__assurance"
                        data-kissopen-desktop-ui="sidebar-update-action-assurance"
                    >
                        {assurance(props.subject)}
                    </span>
                    {ready ? (
                        <Button
                            className="kissopen-sidebar-update__apply"
                            fullWidth
                            onClick={() => {
                                setOpen(false);
                                props.onAction?.();
                            }}
                            role="menuitem"
                            size="small"
                            variant="primary"
                        >
                            {actionLabel}
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
