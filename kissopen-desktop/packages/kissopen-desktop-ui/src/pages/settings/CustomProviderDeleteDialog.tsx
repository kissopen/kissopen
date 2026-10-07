import { useState } from "react";
import { t } from "kissopen-desktop-state";
import { Modal } from "../../Modal";
import { Button } from "../../Button";
import { Banner } from "../../Banner";

/** C-709. Removing a connection is distinct from deleting any conversation. */
export function CustomProviderDeleteDialog(props: {
    name: string;
    onDelete(): Promise<void>;
    onClose(): void;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const remove = async () => {
        if (saving) return;
        setSaving(true);
        setError(undefined);
        try {
            await props.onDelete();
            props.onClose();
        } catch (reason) {
            setSaving(false);
            setError(
                t(reason instanceof Error ? reason.message : "Unable to delete this provider."),
            );
        }
    };
    return (
        <Modal
            title={t("Delete provider")}
            size="small"
            onClose={saving ? undefined : props.onClose}
            footer={
                <>
                    <Button variant="ghost" disabled={saving} onClick={props.onClose}>
                        {t("Cancel")}
                    </Button>
                    <Button variant="danger" loading={saving} onClick={() => void remove()}>
                        {t("Delete")}
                    </Button>
                </>
            }
        >
            <div className="kissopen-custom-provider">
                <strong>{props.name}</strong>
                <p>
                    {t(
                        "This removes the saved connection and API Key, and stops active work using it. Chat and usage history are kept. Choose another model to continue affected conversations.",
                    )}
                </p>
                {error ? (
                    <Banner tone="danger" title={t("Provider unchanged")}>
                        {error}
                    </Banner>
                ) : null}
            </div>
        </Modal>
    );
}
