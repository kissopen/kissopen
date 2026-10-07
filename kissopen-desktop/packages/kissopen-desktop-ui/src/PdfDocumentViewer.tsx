import { t } from "kissopen-desktop-state";
import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy,
    type RenderTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useState } from "react";
import { DocumentViewerNotice, documentBytesRead } from "./DocumentViewerNotice";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfDocumentViewerProps = {
    /** Where the PDF's bytes are: an app-served address or an object URL. */
    url: string;
    name: string;
};

type PdfState =
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly pages: number }
    | { readonly status: "error"; readonly message: string };

/**
 * C-296a PdfDocumentViewer — a PDF drawn page by page with PDF.js.
 *
 * Every page gets its place at once, at its real proportions, so the scrollbar
 * is honest from the start; a page is drawn only when it comes near the
 * viewport, so a long document opens as fast as a short one. Pages are drawn at
 * the width of the column and the screen's pixel density.
 */
export function PdfDocumentViewer(props: PdfDocumentViewerProps) {
    const [state, setState] = useState<PdfState>({ status: "loading" });
    const { url } = props;
    // Stable for one address, so the document is not opened again on every render.
    const mount = useCallback(
        (node: HTMLDivElement | null) => {
            if (node === null) return undefined;
            let cancelled = false;
            let document: PDFDocumentProxy | undefined;
            let loading: PDFDocumentLoadingTask | undefined;
            let observer: IntersectionObserver | undefined;
            let resizeObserver: ResizeObserver | undefined;
            let resizeTimer: ReturnType<typeof setTimeout> | undefined;
            const visible = new Set<HTMLDivElement>();
            const renders = new Map<HTMLDivElement, { width: number; task?: RenderTask }>();
            const failed = (error: unknown) => {
                if (cancelled) return;
                setState({
                    status: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            };
            setState({ status: "loading" });
            void (async () => {
                const bytes = await documentBytesRead(url);
                if (cancelled) return;
                loading = getDocument({ data: new Uint8Array(bytes) });
                document = await loading.promise;
                if (cancelled) return;
                const ratio = window.devicePixelRatio || 1;
                observer = new IntersectionObserver(
                    (entries) => {
                        for (const entry of entries) {
                            const holder = entry.target as HTMLDivElement;
                            if (!entry.isIntersecting) {
                                visible.delete(holder);
                                continue;
                            }
                            visible.add(holder);
                            void pageDraw(holder);
                        }
                    },
                    { root: node, rootMargin: "800px 0px" },
                );
                const pageDraw = async (holder: HTMLDivElement) => {
                    if (cancelled || document === undefined) return;
                    const width = holder.clientWidth;
                    const previous = renders.get(holder);
                    if (width <= 0 || previous?.width === width) return;
                    previous?.task?.cancel();
                    const render: { width: number; task?: RenderTask } = { width };
                    renders.set(holder, render);
                    try {
                        const page = await document.getPage(Number(holder.dataset["page"]));
                        if (cancelled || renders.get(holder) !== render) return;
                        const unscaled = page.getViewport({ scale: 1 });
                        const viewport = page.getViewport({
                            scale: (width / unscaled.width) * ratio,
                        });
                        const canvas = window.document.createElement("canvas");
                        canvas.width = Math.max(1, Math.floor(viewport.width));
                        canvas.height = Math.max(1, Math.floor(viewport.height));
                        canvas.className = "kissopen-document-viewer__canvas";
                        render.task = page.render({ canvas, viewport });
                        await render.task.promise;
                        if (cancelled || renders.get(holder) !== render) return;
                        // Keep the old canvas visible until its sharper replacement is ready.
                        holder.replaceChildren(canvas);
                    } catch (error: unknown) {
                        if (cancelled || renders.get(holder) !== render) return;
                        failed(error);
                    }
                };
                resizeObserver = new ResizeObserver(() => {
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(() => {
                        for (const holder of visible) void pageDraw(holder);
                    }, 120);
                });
                resizeObserver.observe(node);
                for (let number = 1; number <= document.numPages; number += 1) {
                    const page = await document.getPage(number);
                    if (cancelled) return;
                    const unscaled = page.getViewport({ scale: 1 });
                    const holder = window.document.createElement("div");
                    holder.className = "kissopen-document-viewer__page";
                    holder.dataset["page"] = String(number);
                    holder.style.aspectRatio = `${String(unscaled.width)} / ${String(unscaled.height)}`;
                    node.append(holder);
                    observer.observe(holder);
                }
                setState({ status: "ready", pages: document.numPages });
            })().catch(failed);
            return () => {
                cancelled = true;
                observer?.disconnect();
                resizeObserver?.disconnect();
                clearTimeout(resizeTimer);
                for (const render of renders.values()) render.task?.cancel();
                void loading?.destroy();
                node.replaceChildren();
            };
        },
        [url],
    );
    return (
        <div className="kissopen-document-viewer" data-kissopen-desktop-ui="pdf-document-viewer">
            {state.status === "ready" ? null : (
                <DocumentViewerNotice
                    name={props.name}
                    state={state.status === "error" ? { error: state.message } : "loading"}
                />
            )}
            <div
                aria-label={t("Pages of {name}", { name: props.name })}
                className="kissopen-document-viewer__scroll kissopen-document-viewer__scroll--pages"
                ref={mount}
                role="document"
            />
        </div>
    );
}
