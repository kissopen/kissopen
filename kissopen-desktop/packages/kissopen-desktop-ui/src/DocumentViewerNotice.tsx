import { t } from "kissopen-desktop-state";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

/**
 * The one "still opening" and "could not open" notice the document viewers
 * share, drawn in FilePreview's own notice style so a document that fails reads
 * the same as any other file that fails.
 */
export function DocumentViewerNotice(props: {
    name: string;
    state: "loading" | { readonly error: string };
}) {
    if (props.state === "loading")
        return (
            <div className="kissopen-file-preview__notice kissopen-document-viewer__notice">
                <Spinner size={16} />
                <span className="kissopen-file-preview__notice-title">
                    {t("Opening {name}…", { name: props.name })}
                </span>
            </div>
        );
    return (
        <div
            className="kissopen-file-preview__notice kissopen-document-viewer__notice"
            data-tone="danger"
        >
            <Icon name="close" size={20} />
            <span className="kissopen-file-preview__notice-title">
                {t("{name} could not be opened", { name: props.name })}
            </span>
            <span className="kissopen-file-preview__notice-detail">{props.state.error}</span>
        </div>
    );
}

/** The bytes behind an app-served address or an object URL. */
export async function documentBytesRead(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(t("The file could not be read ({status}).", { status: response.status }));
    return await response.arrayBuffer();
}
