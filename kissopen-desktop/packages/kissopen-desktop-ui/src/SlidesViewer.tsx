import { t } from "kissopen-desktop-state";
import { init } from "pptx-preview";
import { useCallback, useState } from "react";
import { DocumentViewerNotice, documentBytesRead } from "./DocumentViewerNotice";

export type SlidesViewerProps = {
    /** Where the .pptx bytes are: an app-served address or an object URL. */
    url: string;
    name: string;
    /**
     * The deck could not be drawn here. A host that can show it another way —
     * as the PDF its server converts it to — takes over; without one, the
     * viewer says it could not open the file.
     */
    onFailed?: () => void;
};

type SlidesState =
    | { readonly status: "loading" }
    | { readonly status: "ready" }
    | { readonly status: "error"; readonly message: string };

/**
 * C-296d SlidesViewer — a PowerPoint deck as a column of slides, with
 * pptx-preview. Each slide is drawn at the column's width and its own 16:9 or
 * 4:3 shape, one under another, the way a deck is skimmed.
 */
export function SlidesViewer(props: SlidesViewerProps) {
    const [state, setState] = useState<SlidesState>({ status: "loading" });
    const { url, onFailed } = props;
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
                // Render once at a stable logical size; fit the existing deck
                // into the pane without reloading it or replacing its slides.
                const width = 960;
                const previewer = init(node, {
                    width,
                    mode: "list",
                });
                const fit = () => {
                    if (node.clientWidth > 32)
                        previewer.wrapper.style.zoom = String((node.clientWidth - 32) / width);
                };
                fit();
                resizeObserver = new ResizeObserver(() => {
                    cancelAnimationFrame(resizeFrame);
                    resizeFrame = requestAnimationFrame(fit);
                });
                resizeObserver.observe(node);
                await previewer.preview(bytes);
                // The library reports some decks it cannot read only to the
                // console and draws nothing; an empty list is that failure.
                await new Promise((resolve) => setTimeout(resolve, 400));
                if (cancelled) return;
                if ((node.querySelector(".pptx-preview-wrapper")?.childElementCount ?? 0) === 0)
                    throw new Error(t("This presentation could not be drawn here."));
                setState({ status: "ready" });
            })().catch((error: unknown) => {
                if (cancelled) return;
                if (onFailed !== undefined) {
                    onFailed();
                    return;
                }
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
        [url, onFailed],
    );
    return (
        <div className="kissopen-document-viewer" data-kissopen-desktop-ui="slides-viewer">
            {state.status === "ready" ? null : (
                <DocumentViewerNotice
                    name={props.name}
                    state={state.status === "error" ? { error: state.message } : "loading"}
                />
            )}
            <div
                aria-label={t("Slides of {name}", { name: props.name })}
                className="kissopen-document-viewer__scroll kissopen-document-viewer__scroll--slides"
                ref={mount}
                role="document"
            />
        </div>
    );
}
