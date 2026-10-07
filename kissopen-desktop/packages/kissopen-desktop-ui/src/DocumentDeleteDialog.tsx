import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { Banner } from "./Banner";
import { Box } from "./Box";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { ModalOverlay } from "./ModalOverlay";
export type DocumentDeleteDialogProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** Title of the document being deleted; falls back to "Untitled document". */
    documentTitle: string;
    /** The delete request is in flight; actions disable. */
    pending?: boolean;
    /** Terminal delete failure, shown inside the dialog for retry. */
    error?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
};
/**
 * C-139 DocumentDeleteDialog — the destructive confirmation for deleting a
 * collaborative document. It states that the document, its complete edit
 * history, and every channel attachment disappear for all members at once.
 * Hosts itself on the standard centered ModalOverlay scrim; clicking the dim
 * cancels unless the delete is already in flight. Presentational and fully
 * controlled; the consumer owns the delete request and supplies
 * pending/failure state.
 */
export function DocumentDeleteDialog(props: DocumentDeleteDialogProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "style",
        "documentTitle",
        "pending",
        "error",
        "onConfirm",
        "onCancel",
    ]);
    const title = () => local.documentTitle || t("Untitled document");
    return (
        <ModalOverlay onDismiss={local.pending ? undefined : local.onCancel}>
            <Modal
                {...rest}
                className={["kissopen-document-delete-dialog", local.className]
                    .filter(Boolean)
                    .join(" ")}
                footer={
                    <Box className="kissopen-document-delete-dialog__actions">
                        <Button
                            disabled={local.pending}
                            onClick={() => local.onCancel?.()}
                            variant="ghost"
                        >
                            {t("Cancel")}
                        </Button>
                        <Button
                            data-testid="document-delete-confirm"
                            disabled={local.pending}
                            onClick={() => local.onConfirm?.()}
                            variant="danger"
                        >
                            {local.pending ? t("Deleting…") : t("Delete document")}
                        </Button>
                    </Box>
                }
                icon="trash"
                onClose={local.pending ? undefined : local.onCancel}
                size="small"
                title={t("Delete “{title}”?", { title: title() })}
                tone="danger"
            >
                <Box className="kissopen-document-delete-dialog__body">
                    {local.error ? (
                        <Banner
                            data-testid="document-delete-error"
                            tone="danger"
                            title={t("Delete failed")}
                        >
                            {local.error}
                        </Banner>
                    ) : null}
                    <span
                        className="kissopen-document-delete-dialog__message"
                        data-kissopen-desktop-ui="document-delete-message"
                    >
                        {t(
                            "This permanently deletes {title} for everyone: its content, complete edit history, and every channel it is attached to. This cannot be undone.",
                            { title: title() },
                        )}
                    </span>
                </Box>
            </Modal>
        </ModalOverlay>
    );
}
