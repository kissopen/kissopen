import { t } from "kissopen-desktop-state";
import { Icon } from "./Icon";

export type ComposerAttachmentRemoveButtonProps = {
    name: string;
    onRemove: () => void;
};

/**
 * Shared remove action for compact and reading-size composer attachments. The
 * 28px target is centered on the attachment's top-right corner; its visible
 * 18px disc straddles that corner without covering the preview.
 */
export function ComposerAttachmentRemoveButton(props: ComposerAttachmentRemoveButtonProps) {
    return (
        <button
            aria-label={t("Remove {name}", { name: props.name })}
            className="kissopen-composer-attachment-remove"
            data-kissopen-desktop-ui="composer-attachment-remove"
            onClick={props.onRemove}
            type="button"
        >
            <Icon name="close" size={12} />
        </button>
    );
}
