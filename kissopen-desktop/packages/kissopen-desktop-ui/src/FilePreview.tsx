import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { CodeBlock } from "./CodeBlock";
import { FileTreeFamilyIcon, fileTreeFamily } from "./FileTree";
import { FilePathLabel } from "./FilePathLabel";
import { Icon, type IconName } from "./Icon";
import { ImageViewer } from "./ImageViewer";
import { MarkdownDocument } from "./MarkdownDocument";
import { PdfDocumentViewer } from "./PdfDocumentViewer";
import { SlidesViewer } from "./SlidesViewer";
import { SpreadsheetViewer } from "./SpreadsheetViewer";
import { WordDocumentViewer } from "./WordDocumentViewer";
import { ScrollArea } from "./Scrollbar";
import { SegmentedControl } from "./SegmentedControl";
import { Spinner } from "./Spinner";
import { VideoViewer } from "./VideoViewer";
import { Ionicon } from "./vectorIcons/VectorIcon";
/**
 * How a file is shown. `binary` is the honest answer for something this surface
 * cannot render — an executable, an archive, a format nobody wrote a viewer for
 * — and says so with the file's own facts rather than a wall of mojibake.
 */
export type FilePreviewKind =
    | "image"
    | "video"
    | "audio"
    | "markdown"
    | "html"
    | "text"
    | "pdf"
    /** A Word document drawn as pages: docx and its templates. */
    | "document"
    /** A workbook drawn as tables: Excel, OpenDocument and WPS sheets. */
    | "spreadsheet"
    /** A PowerPoint deck drawn as slides. */
    | "presentation"
    /**
     * A document in a format nothing here reads — doc, ppt, WPS, RTF and their
     * kin — shown as the PDF the host converted it to. Its content is that PDF's
     * address; without one it has only the file's facts.
     */
    | "converted"
    | "binary";
/** What the preview is looking at, once the caller has resolved the bytes. */
export type FilePreviewContent =
    | { readonly type: "loading" }
    | { readonly type: "error"; readonly message: string }
    /** A URL the browser can render directly: an object URL or an app-served asset. */
    | { readonly type: "url"; readonly url: string }
    /** Decoded text, for the Markdown and source views. */
    | { readonly type: "text"; readonly text: string }
    /** Nothing to render, only the facts about the file. */
    | { readonly type: "unavailable" };
export type FilePreviewProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** Full path or name. Its last segment titles the preview. */
    path: string;
    /** Overrides the kind derived from the path — use it when the bytes disagree. */
    kind?: FilePreviewKind;
    content: FilePreviewContent;
    /**
     * Stable identity for the authoritative text behind this preview. It is
     * forwarded to every Pierre renderer beneath the preview so remounting a
     * file can reuse worker-pool highlighting.
     */
    cacheKey?: string;
    /** Human-readable size, shown beside the name. */
    size?: string;
    /** Keeps ready content visible while its authoritative revision revalidates. */
    updating?: boolean;
    /**
     * Intrinsic pixel size of an image or a recording's frames, shown beside its
     * size. Absent lets the file state its own once it decodes, which is the
     * only place that fact exists for a file the caller only holds an address
     * for.
     */
    dimensions?: string;
    /** Trailing header controls, e.g. Download or Open in editor. */
    actions?: ReactNode;
    /**
     * Shows this picture or recording in a window of the host's own. Present
     * only where such a window exists, so the control is absent rather than
     * inert in a browser.
     */
    onMediaWindowOpen?: () => void;
    /**
     * Opens a file a rendered Markdown document links to. Absent leaves those
     * links inert, which is the honest answer on a surface with no workspace
     * behind it.
     */
    onFileOpen?: (path: string) => void;
    /**
     * Opens a file this surface cannot show — a Word or PowerPoint document —
     * in the application the machine uses for it. Absent where no host can.
     */
    onOpenDefault?: () => void;
    /**
     * A PowerPoint deck the slide viewer could not draw. A host that can convert
     * it to a PDF shows that instead; without one the preview says it failed.
     */
    onPresentationFailed?: () => void;
    /**
     * The file as a page rather than as characters, supplied by the host: an
     * HTML document has a rendered face this surface cannot draw itself, since
     * running a page is the embedder's job. Absent leaves such a file readable
     * as source only, which is the honest state before its address is known.
     */
    rendered?: ReactNode;
    onClose?: () => void;
    closeLabel?: string;
};

/** Which face of a Markdown file is showing: the document, or what it is written in. */
type MarkdownFace = "rendered" | "source";

const MARKDOWN_FACES: readonly { value: MarkdownFace; label: string }[] = [
    { value: "rendered", label: t("Rendered") },
    { value: "source", label: t("Source") },
];
/** File extensions this surface can actually render, by how it renders them. */
const EXTENSION_KIND: Record<string, FilePreviewKind> = {
    avif: "image",
    bmp: "image",
    gif: "image",
    heic: "image",
    ico: "image",
    jpeg: "image",
    jpg: "image",
    png: "image",
    svg: "image",
    tiff: "image",
    webp: "image",
    m4v: "video",
    mkv: "video",
    mov: "video",
    mp4: "video",
    webm: "video",
    aac: "audio",
    flac: "audio",
    m4a: "audio",
    mp3: "audio",
    ogg: "audio",
    wav: "audio",
    markdown: "markdown",
    md: "markdown",
    mdx: "markdown",
    htm: "html",
    html: "html",
    pdf: "pdf",
    docx: "document",
    docm: "document",
    dotx: "document",
    dotm: "document",
    xlsx: "spreadsheet",
    xlsm: "spreadsheet",
    xlsb: "spreadsheet",
    xls: "spreadsheet",
    xlt: "spreadsheet",
    xltx: "spreadsheet",
    xltm: "spreadsheet",
    ods: "spreadsheet",
    et: "spreadsheet",
    ett: "spreadsheet",
    pptx: "presentation",
    pptm: "presentation",
    ppsx: "presentation",
    potx: "presentation",
    doc: "converted",
    dot: "converted",
    wps: "converted",
    wpt: "converted",
    rtf: "converted",
    odt: "converted",
    ppt: "converted",
    pps: "converted",
    pot: "converted",
    dps: "converted",
    dpt: "converted",
    odp: "converted",
};
/**
 * Kinds whose bytes are opaque and that have no viewer of their own here: a
 * preview asks the caller for a URL and hands that address straight to the
 * element which can render it. Pictures and recordings are also opaque, but they
 * are answered further up by the viewers built for them.
 */
const URL_KINDS = new Set<FilePreviewKind>([
    "audio",
    "pdf",
    "document",
    "spreadsheet",
    "presentation",
    "converted",
]);
/**
 * Documents a machine opens in an application of its own — Word, PowerPoint,
 * Excel, Keynote and their kin. The preview has no viewer for them; a host that
 * can hand them to the system offers that instead.
 */
export const OFFICE_DOCUMENT_EXTENSIONS: readonly string[] = [
    "doc",
    "docm",
    "docx",
    "dot",
    "dotm",
    "dotx",
    "dps",
    "dpt",
    "epub",
    "et",
    "ett",
    "key",
    "numbers",
    "odg",
    "odp",
    "ods",
    "odt",
    "pages",
    "pot",
    "potx",
    "pps",
    "ppsx",
    "ppt",
    "pptm",
    "pptx",
    "rtf",
    "vsd",
    "vsdx",
    "wps",
    "wpt",
    "xls",
    "xlsb",
    "xlsm",
    "xlsx",
    "xlt",
    "xltm",
    "xltx",
];

/** Whether a path names one of those documents. */
export function fileIsOfficeDocument(path: string): boolean {
    const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
    const dot = name.lastIndexOf(".");
    return dot > 0 && OFFICE_DOCUMENT_EXTENSIONS.includes(name.slice(dot + 1));
}
/**
 * Extensions whose bytes are opaque to every viewer here. Named explicitly
 * because being unrecognized is not evidence of being binary: a checkout is
 * full of `LICENSE`, `CHANGELOG`, `.nvmrc`, and one-off suffixes that are all
 * plain text, and refusing them left most of what a transcript points at
 * unopenable.
 */
const OPAQUE_EXTENSIONS = new Set([
    // Office and other document formats: zip packages or binary containers,
    // which read as text are nothing but mojibake.
    ...OFFICE_DOCUMENT_EXTENSIONS,
    "a",
    "bin",
    "class",
    "db",
    "deb",
    "dll",
    "dmg",
    "dylib",
    "eot",
    "exe",
    "iso",
    "jar",
    "node",
    "o",
    "otf",
    "pkg",
    "pyc",
    "pyo",
    "rpm",
    "so",
    "sqlite",
    "sqlite3",
    "ttf",
    "war",
    "wasm",
    "whl",
    "woff",
    "woff2",
]);
/**
 * What the preview should do with a file, from its name.
 *
 * A name this surface has a viewer for is shown with it, an archive or a
 * compiled artefact is binary, and everything else is read as text: the reason
 * to open a file at all is to read it, and the far more common wrong answer was
 * calling a perfectly readable file binary because nobody had listed its
 * extension.
 */
export function filePreviewKind(path: string): FilePreviewKind {
    const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot + 1) : "";
    const known = EXTENSION_KIND[ext];
    if (known) return known;
    if (OPAQUE_EXTENSIONS.has(ext)) return "binary";
    return fileTreeFamily({ kind: "file", name }) === "archive" ? "binary" : "text";
}
/** Header glyph for each kind — what sort of thing is being looked at. */
const KIND_ICON: Record<FilePreviewKind, IconName> = {
    audio: "mic",
    binary: "doc",
    html: "globe",
    image: "image",
    markdown: "doc",
    pdf: "doc",
    document: "doc",
    spreadsheet: "doc",
    presentation: "doc",
    converted: "doc",
    text: "code",
    video: "play",
};
/**
 * C-169 FilePreview — one file, shown rather than downloaded.
 *
 * Clicking a JPEG shows the JPEG, a video plays, and a Markdown file renders as
 * prose. This is the single surface behind every "open this file" in the
 * product; where it appears — a main content tab, the side panel — is the
 * caller's decision, and the preview fills whatever region it is given.
 *
 * Props only. The caller resolves the bytes, decides whether they became a URL
 * or text, and owns the loading and failure states; the preview renders what it
 * is handed and never fetches.
 */
export function FilePreview(props: FilePreviewProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "path",
        "kind",
        "content",
        "cacheKey",
        "size",
        "updating",
        "dimensions",
        "actions",
        "onFileOpen",
        "onOpenDefault",
        "onPresentationFailed",
        "onMediaWindowOpen",
        "rendered",
        "onClose",
        "closeLabel",
    ]);
    // Which face of a Markdown file is showing is a property of looking at it,
    // not of the file or the product, so it stays here and resets when the
    // preview is replaced by a different file.
    const [face, setFace] = useState<MarkdownFace>("rendered");
    // What the file turned out to be, keyed by the address it was measured
    // from, so neither a different file nor a new revision of this one ever
    // wears the previous one's dimensions.
    const [measured, setMeasured] = useState<{ source: string; dimensions: string }>();
    const kind = local.kind ?? filePreviewKind(local.path);
    const name = local.path.slice(local.path.lastIndexOf("/") + 1);
    const family = fileTreeFamily({ kind: "file", name });
    const source = local.content.type === "url" ? local.content.url : local.path;
    const dimensions =
        local.dimensions ?? (measured?.source === source ? measured.dimensions : undefined);
    const meta = [dimensions, local.size].filter(Boolean).join(" · ");
    return (
        <section
            className={["kissopen-file-preview", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="file-preview"
            data-kind={kind}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <header
                className="kissopen-file-preview__header"
                data-kissopen-desktop-ui="file-preview-header"
            >
                <span
                    className="kissopen-file-family-glyph kissopen-file-preview__glyph"
                    data-family={family}
                    data-kissopen-desktop-ui="file-preview-glyph"
                >
                    <FileTreeFamilyIcon family={family} size={16} />
                </span>
                <FilePathLabel className="kissopen-file-preview__path" path={local.path} />
                {meta ? (
                    <span
                        className="kissopen-file-preview__meta"
                        data-kissopen-desktop-ui="file-preview-meta"
                    >
                        {meta}
                    </span>
                ) : null}
                <span className="kissopen-file-preview__actions">
                    {local.updating ? (
                        <span
                            aria-live="polite"
                            className="kissopen-file-preview__updating"
                            data-kissopen-desktop-ui="file-preview-updating"
                        >
                            <Spinner size={12} tone="muted" />
                            {t("Updating…")}
                        </span>
                    ) : null}
                    {(kind === "markdown" || local.rendered !== undefined) &&
                    local.content.type === "text" ? (
                        <SegmentedControl
                            data-testid="file-preview-face"
                            onChange={(value) => setFace(value as MarkdownFace)}
                            segments={[...MARKDOWN_FACES]}
                            size="compact"
                            value={face}
                        />
                    ) : null}
                    {local.actions}
                    {local.onClose ? (
                        <Button
                            aria-label={local.closeLabel ?? t("Close preview")}
                            icon="close"
                            iconOnly
                            onClick={() => local.onClose?.()}
                            size="small"
                            variant="ghost"
                        />
                    ) : null}
                </span>
            </header>
            <div
                className="kissopen-file-preview__body"
                data-kissopen-desktop-ui="file-preview-body"
            >
                <FilePreviewBody
                    content={local.content}
                    cacheKey={local.cacheKey}
                    face={face}
                    kind={kind}
                    name={name}
                    onFileOpen={local.onFileOpen}
                    onMediaMeasure={(size) =>
                        setMeasured({
                            source,
                            dimensions: `${String(size.width)} × ${String(size.height)}`,
                        })
                    }
                    onMediaWindowOpen={local.onMediaWindowOpen}
                    onOpenDefault={local.onOpenDefault}
                    onPresentationFailed={local.onPresentationFailed}
                    rendered={local.rendered}
                />
            </div>
        </section>
    );
}
/**
 * The rendered file itself. Every branch that cannot show the content says why
 * in the same centered notice, so a failed image and an unviewable archive read
 * as the same kind of answer instead of two different broken states.
 */
function FilePreviewBody(props: {
    content: FilePreviewContent;
    cacheKey?: string;
    face: MarkdownFace;
    kind: FilePreviewKind;
    name: string;
    onFileOpen?: (path: string) => void;
    onMediaMeasure: (size: { readonly width: number; readonly height: number }) => void;
    onMediaWindowOpen?: () => void;
    onOpenDefault?: () => void;
    onPresentationFailed?: () => void;
    rendered?: ReactNode;
}) {
    // A picture is handed to the shared viewer in every state, including the
    // ones that have no picture: its loading, failed, and unviewable notices are
    // the ones a reader already knows from every other place an image opens.
    if (props.kind === "image" && props.content.type !== "text")
        return (
            <ImageViewer
                actions={
                    props.onMediaWindowOpen ? (
                        <>
                            <Button
                                aria-label={t("Open in a new window")}
                                iconOnly
                                onClick={props.onMediaWindowOpen}
                                size="small"
                                variant="ghost"
                            >
                                <Ionicon name="open-outline" size={14} />
                            </Button>
                            <span className="kissopen-image-viewer__divider" />
                        </>
                    ) : undefined
                }
                content={props.content}
                name={props.name}
                onNaturalSize={props.onMediaMeasure}
            />
        );
    // And a recording likewise, for the same reason: one video surface, whether
    // it is playing, still opening, or a format nothing here can decode.
    if (props.kind === "video" && props.content.type !== "text")
        return (
            <VideoViewer
                actions={
                    props.onMediaWindowOpen ? (
                        <Button
                            aria-label={t("Open in a new window")}
                            iconOnly
                            onClick={props.onMediaWindowOpen}
                            size="small"
                            variant="ghost"
                        >
                            <Ionicon name="open-outline" size={14} />
                        </Button>
                    ) : undefined
                }
                content={props.content}
                name={props.name}
                onNaturalSize={props.onMediaMeasure}
            />
        );
    if (props.content.type === "loading")
        return (
            <div
                className="kissopen-file-preview__notice"
                data-kissopen-desktop-ui="file-preview-loading"
            >
                <Spinner size={16} />
                <span className="kissopen-file-preview__notice-title">
                    {t("Opening {name}…", { name: props.name })}
                </span>
            </div>
        );
    if (props.content.type === "error")
        return (
            <div
                className="kissopen-file-preview__notice"
                data-kissopen-desktop-ui="file-preview-error"
                data-tone="danger"
            >
                <Icon name="close" size={20} />
                <span className="kissopen-file-preview__notice-title">
                    {t("{name} could not be opened", { name: props.name })}
                </span>
                <span className="kissopen-file-preview__notice-detail">
                    {props.content.message}
                </span>
            </div>
        );
    if (props.content.type === "url" && URL_KINDS.has(props.kind)) {
        const url = props.content.url;
        if (props.kind === "audio")
            return (
                <div
                    className="kissopen-file-preview__stage"
                    data-kissopen-desktop-ui="file-preview-stage"
                >
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a workspace file has no caption track to offer */}
                    <audio
                        className="kissopen-file-preview__audio"
                        controls
                        data-kissopen-desktop-ui="file-preview-audio"
                        src={url}
                    />
                </div>
            );
        if (props.kind === "document") return <WordDocumentViewer name={props.name} url={url} />;
        if (props.kind === "spreadsheet") return <SpreadsheetViewer name={props.name} url={url} />;
        if (props.kind === "presentation")
            return (
                <SlidesViewer
                    name={props.name}
                    url={url}
                    {...(props.onPresentationFailed
                        ? { onFailed: props.onPresentationFailed }
                        : {})}
                />
            );
        // A PDF, or the PDF a document in another format was converted to.
        return <PdfDocumentViewer name={props.name} url={url} />;
    }
    // A page the host renders wins over every text view of the same bytes: it is
    // what the reader asked for by opening the file at all.
    if (props.rendered !== undefined && props.face === "rendered") return props.rendered;
    if (props.content.type === "text" && props.kind === "markdown" && props.face === "rendered")
        return (
            <MarkdownDocument
                {...(props.onFileOpen ? { onFileOpen: props.onFileOpen } : {})}
                {...(props.cacheKey ? { cacheKey: props.cacheKey } : {})}
                text={props.content.text}
            />
        );
    // Source is highlighted by the same engine as the working-tree diff, and
    // numbered, because a file read whole is a file whose lines get referred to.
    // The header above already names it, so the renderer's own header is off.
    if (props.content.type === "text")
        return (
            <ScrollArea
                axes="both"
                className="kissopen-file-preview__source"
                data-kissopen-desktop-ui="file-preview-code"
                placement="overlay"
                viewportClassName="kissopen-file-preview__source-viewport"
            >
                <CodeBlock
                    className="kissopen-file-preview__source-renderer"
                    {...(props.cacheKey ? { cacheKey: props.cacheKey } : {})}
                    lineNumbers
                    name={props.name}
                    text={props.content.text}
                />
            </ScrollArea>
        );
    return (
        <div
            className="kissopen-file-preview__notice"
            data-kissopen-desktop-ui="file-preview-unavailable"
        >
            <Icon name={KIND_ICON[props.kind]} size={20} />
            <span className="kissopen-file-preview__notice-title">
                {t("{name} has no preview", { name: props.name })}
            </span>
            <span className="kissopen-file-preview__notice-detail">
                {props.onOpenDefault
                    ? t("Open it in the application this computer uses for it.")
                    : t("This file is not a format KissOpen can show.")}
            </span>
            {props.onOpenDefault ? (
                <Button onClick={props.onOpenDefault} size="small" variant="secondary">
                    {t("Open in default app")}
                </Button>
            ) : null}
        </div>
    );
}
