import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import * as Y from "yjs";
import { Button } from "./Button";
import { DocumentDeleteDialog } from "./DocumentDeleteDialog";
import {
    DocumentEditor,
    type DocumentEditorCommentUser,
    type DocumentEditorPresence,
    type DocumentEditorPresencePayload,
    type DocumentEditorUser,
} from "./DocumentEditor";
import { SURFACE_HEADER_HEIGHT } from "./InfoPanel";
import { ScrollArea } from "./Scrollbar";
import { Toolbar } from "./Toolbar";

export interface DocumentSurfaceParticipant {
    readonly name: string;
    readonly color: string;
}

export interface DocumentSurfaceProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly title: string;
    readonly saveState: "idle" | "dirty" | "saving" | "error";
    readonly saveError?: string;
    /** Initial hydration only. */
    readonly loading?: boolean;
    /** Load failure message. */
    readonly error?: string;
    readonly participants?: readonly DocumentSurfaceParticipant[];
    readonly onTitleCommit?: (title: string) => void;
    readonly onClose?: () => void;
    /** Shows a trash header action; invoked only after the user confirms. */
    readonly onDelete?: () => void;
    readonly ydoc: Y.Doc;
    readonly user: DocumentEditorUser;
    readonly presence?: readonly DocumentEditorPresence[];
    readonly onPresence?: (payload: DocumentEditorPresencePayload) => void;
    readonly editable?: boolean;
    readonly theme?: "light" | "dark";
    /** The local user's stable id; enables inline comment threads. */
    readonly commentUserId?: string;
    /** Resolves comment author ids to display identities. */
    readonly commentUsersResolve?: (
        userIds: readonly string[],
    ) => Promise<readonly DocumentEditorCommentUser[]>;
    /** The document's text after each change, for a host that keeps a readable copy. */
    readonly onMarkdown?: (markdown: string) => void;
    /** Shows the editor's block drag menu. */
    readonly blockDragEnabled?: boolean;
}

const SAVE_LABELS = {
    idle: "Saved",
    dirty: "Saving…",
    saving: "Saving…",
    error: "Not saved",
} as const;

/**
 * C-082 DocumentSurface — one collaborative document as a complete surface:
 * a 56px header with an inline-committable title, live save status, remote
 * participant chips, and a close action above the BlockNote editor body.
 * Props only — the host owns the session store, save pipeline, and presence
 * relay.
 */
export function DocumentSurface(props: DocumentSurfaceProps) {
    // Local UI state only: whether the destructive confirmation is showing.
    const [deleteConfirming, setDeleteConfirming] = useState(false);
    const commitTitle = (value: string) => {
        const next = value.trim();
        if (next !== props.title) props.onTitleCommit?.(next);
    };
    const body = () => {
        if (props.loading)
            return (
                <div className="kissopen-document-surface__status">{t("Opening document…")}</div>
            );
        if (props.error !== undefined)
            return (
                <div className="kissopen-document-surface__status" data-kissopen-tone="danger">
                    {props.error}
                </div>
            );
        return (
            <DocumentEditor
                commentUserId={props.commentUserId}
                commentUsersResolve={props.commentUsersResolve}
                blockDragEnabled={props.blockDragEnabled}
                editable={props.editable}
                onMarkdown={props.onMarkdown}
                onPresence={props.onPresence}
                presence={props.presence}
                theme={props.theme}
                user={props.user}
                ydoc={props.ydoc}
            />
        );
    };
    return (
        <section
            className={["kissopen-document-surface", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="document-surface"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <Toolbar
                className="kissopen-document-surface__header"
                height={SURFACE_HEADER_HEIGHT}
                leading={
                    <input
                        aria-label={t("Document title")}
                        className="kissopen-document-surface__title"
                        data-kissopen-desktop-ui="document-surface-title"
                        defaultValue={props.title}
                        // Remount when the authoritative title changes so the
                        // uncontrolled input never mirrors props into state.
                        key={props.title}
                        onBlur={(event) => commitTitle(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                            }
                        }}
                        placeholder={t("Untitled document")}
                        readOnly={props.onTitleCommit === undefined}
                        type="text"
                    />
                }
                trailing={
                    <>
                        <span
                            className="kissopen-document-surface__save"
                            data-kissopen-desktop-ui="document-surface-save"
                            data-state={props.saveState}
                        >
                            {props.saveState === "error" && props.saveError
                                ? props.saveError
                                : SAVE_LABELS[props.saveState]}
                        </span>
                        {(props.participants ?? []).map((participant, index) => (
                            <span
                                className="kissopen-document-surface__participant"
                                key={`${participant.name}-${index}`}
                                style={{ background: participant.color }}
                                title={participant.name}
                            >
                                {(participant.name || "?").slice(0, 1).toUpperCase()}
                            </span>
                        ))}
                        {props.onDelete ? (
                            <Button
                                aria-label={t("Delete document")}
                                icon="trash"
                                iconOnly
                                onClick={() => setDeleteConfirming(true)}
                                size="small"
                                variant="ghost"
                            />
                        ) : null}
                        {props.onClose ? (
                            <Button
                                aria-label={t("Close document")}
                                icon="close"
                                iconOnly
                                onClick={() => props.onClose?.()}
                                size="small"
                                variant="ghost"
                            />
                        ) : null}
                    </>
                }
            />
            <ScrollArea
                axes="both"
                className="kissopen-document-surface__body"
                viewportClassName="kissopen-document-surface__body-viewport"
            >
                {body()}
            </ScrollArea>
            {deleteConfirming ? (
                <DocumentDeleteDialog
                    data-testid="document-surface-delete-dialog"
                    documentTitle={props.title}
                    onCancel={() => setDeleteConfirming(false)}
                    onConfirm={() => {
                        setDeleteConfirming(false);
                        props.onDelete?.();
                    }}
                />
            ) : null}
        </section>
    );
}
