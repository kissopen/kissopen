import { t } from "kissopen-desktop-state";
import { renderAsync } from "docx-preview";
import { useCallback, useState } from "react";
import { DocumentViewerNotice, documentBytesRead } from "./DocumentViewerNotice";

export type WordDocumentViewerProps = {
    /** Where the .docx bytes are: an app-served address or an object URL. */
    url: string;
    name: string;
};

type WordState =
    | { readonly status: "loading" }
    | { readonly status: "ready" }
    | { readonly status: "error"; readonly message: string };

/**
 * C-296b WordDocumentViewer — a Word document drawn as pages, with docx-preview.
 *
 * The document keeps its own page size, margins, fonts, tables and pictures, so
 * it reads the way its author laid it out. Its styles are scoped to its own
 * wrapper and removed with it.
 */
export function WordDocumentViewer(props: WordDocumentViewerProps) {
    const [state, setState] = useState<WordState>({ status: "loading" });
    const { url } = props;
    const mount = useCallback(
        (node: HTMLDivElement | null) => {
            if (node === null) return undefined;
            let cancelled = false;
            let resizeObserver: ResizeObserver | undefined;
            let resizeFrame = 0;
            setState({ status: "loading" });
            void (async () => {
                const bytes = await documentBytesRead(url);
                if (cancelled) return;
                await renderAsync(bytes, node, node, {
                    className: "kissopen-docx",
                    inWrapper: true,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    renderComments: false,
                    renderChanges: false,
                    useBase64URL: true,
                });
                if (cancelled) return;
                // A page wider than the column is scaled down to fit it rather than
                // scrolled sideways; a page that fits is shown at its real size.
                const pages = node.querySelectorAll<HTMLElement>("section.kissopen-docx");
                const wrapper = node.querySelector<HTMLElement>(".kissopen-docx-wrapper");
                const pageWidth = Math.max(0, ...Array.from(pages, (page) => page.offsetWidth));
                if (wrapper !== null && pageWidth > 0) {
                    const width = pageWidth + 32;
                    wrapper.style.width = `${String(width)}px`;
                    wrapper.style.marginInline = "auto";
                    const fit = () => {
                        if (node.clientWidth > 0)
                            wrapper.style.zoom = String(Math.min(1, node.clientWidth / width));
                    };
                    fit();
                    resizeObserver = new ResizeObserver(() => {
                        cancelAnimationFrame(resizeFrame);
                        resizeFrame = requestAnimationFrame(fit);
                    });
                    resizeObserver.observe(node);
                }
                setState({ status: "ready" });
            })().catch((error: unknown) => {
                if (cancelled) return;
                setState({
                    status: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            });
            return () => {
                cancelled = true;
                resizeObserver?.disconnect();
                cancelAnimationFrame(resizeFrame);
                node.replaceChildren();
            };
        },
        [url],
    );
    return (
        <div className="kissopen-document-viewer" data-kissopen-desktop-ui="word-document-viewer">
            {state.status === "ready" ? null : (
                <DocumentViewerNotice
                    name={props.name}
                    state={state.status === "error" ? { error: state.message } : "loading"}
                />
            )}
            <div
                aria-label={t("Pages of {name}", { name: props.name })}
                className="kissopen-document-viewer__scroll kissopen-document-viewer__scroll--word"
                ref={mount}
                role="document"
            />
        </div>
    );
}
