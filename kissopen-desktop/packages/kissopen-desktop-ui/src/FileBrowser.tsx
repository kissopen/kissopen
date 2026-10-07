import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { useRef, useState, type CSSProperties } from "react";
import { FileTree, type FileTreeNode, type FileTreeProps } from "./FileTree";
import { compactCount, changeCountLabel } from "./countText";
import { Icon } from "./Icon";
import { SegmentedControl } from "./SegmentedControl";
import { Ionicon } from "./vectorIcons/VectorIcon";
/** What the last upload did, said under the controls until it is dismissed. */
export type FileBrowserUploadNotice = {
    readonly tone: "progress" | "done" | "error";
    readonly text: string;
    readonly onDismiss?: () => void;
};
/** Which files the listing is about: only what changed, or the whole checkout. */
export type FileBrowserScope = "changed" | "all";
/** Whether the listing nests into directories or reads as one flat run of files. */
export type FileBrowserLayout = "flat" | "tree";
export type FileBrowserProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    scope: FileBrowserScope;
    /** Product file panels can omit Git-only browsing while keeping the reusable diff view. */
    hideChanges?: boolean;
    onScopeChange?: (scope: FileBrowserScope) => void;
    /** Per-scope refusal; a cached scope remains available while an uncached one can be disabled. */
    scopeUnavailable?: Partial<Readonly<Record<FileBrowserScope, string>>>;
    layout: FileBrowserLayout;
    onLayoutChange?: (layout: FileBrowserLayout) => void;
    /** Rows to list. Passed straight through to FileTree. */
    nodes: readonly FileTreeNode[];
    selectedId?: FileTreeProps["selectedId"];
    onSelect?: FileTreeProps["onSelect"];
    onOpen?: FileTreeProps["onOpen"];
    onToggle?: FileTreeProps["onToggle"];
    onDirectoryPrefetch?: FileTreeProps["onDirectoryPrefetch"];
    onFilePrefetch?: FileTreeProps["onFilePrefetch"];
    onLoadMore?: FileTreeProps["onLoadMore"];
    loading?: boolean;
    loadingLabel?: string;
    emptyLabel?: string;
    /** Rows the listing holds, stated beside the controls rather than over them. */
    count: number | undefined;
    /** Total lines the listed files gained and lost, when the scope has a diff. */
    addedLines?: number;
    deletedLines?: number;
    /** Optional truthfulness note under the controls (e.g. a truncated listing). */
    note?: string;
    /** Why file rows cannot open or select remote content; directory disclosure stays local. */
    fileActionsUnavailable?: string;
    /**
     * Takes files the reader drops on the listing or picks with the upload
     * button. Absent, the listing offers neither.
     */
    onUpload?: (files: File[]) => void;
    uploadNotice?: FileBrowserUploadNotice;
};
const SCOPES: { value: FileBrowserScope; label: string }[] = [
    { value: "all", label: t("All Files") },
    { value: "changed", label: t("Changes") },
];
/**
 * C-168 FileBrowser — the file listing of a workspace panel.
 *
 * One 32px control row and a scrolling `FileTree` beneath it. The row carries
 * the one-layer All Files / Changes choice. Changes adds diff totals and the
 * flat List / Tree choice; All Files is always a lazy tree.
 *
 * Every exclusive control in the row is one layer: no enclosing track, and
 * only the selected option carries the shared selection fill and outline. No
 * rule separates the row from the files. A panel this narrow is read as one
 * column, and each hairline drawn across it cuts that column into pieces that
 * have to be reassembled by eye.
 *
 * Props only — the caller supplies the nodes and every handler; the browser
 * never fetches.
 */
export function FileBrowser(props: FileBrowserProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "scope",
        "hideChanges",
        "onScopeChange",
        "scopeUnavailable",
        "layout",
        "onLayoutChange",
        "nodes",
        "selectedId",
        "onSelect",
        "onOpen",
        "onToggle",
        "onDirectoryPrefetch",
        "onFilePrefetch",
        "onLoadMore",
        "loading",
        "loadingLabel",
        "emptyLabel",
        "count",
        "addedLines",
        "deletedLines",
        "note",
        "fileActionsUnavailable",
        "onUpload",
        "uploadNotice",
    ]);
    // Whether files are being dragged over the listing: the drop target shows
    // itself only while something could land on it.
    const [dropping, setDropping] = useState(false);
    const picker = useRef<HTMLInputElement>(null);
    const onUpload = local.onUpload;
    const carriesFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");
    const added = local.addedLines !== undefined && local.addedLines > 0;
    const deleted = local.deletedLines !== undefined && local.deletedLines > 0;
    return (
        <section
            aria-label={local.scope === "all" ? "All files" : "Changed files"}
            className={["kissopen-file-browser", local.className].filter(Boolean).join(" ")}
            data-dropping={dropping ? "" : undefined}
            data-kissopen-desktop-ui="file-browser"
            data-testid={local["data-testid"]}
            style={local.style}
            {...(onUpload
                ? {
                      onDragEnter: (event: React.DragEvent) => {
                          if (!carriesFiles(event)) return;
                          event.preventDefault();
                          setDropping(true);
                      },
                      onDragOver: (event: React.DragEvent) => {
                          if (!carriesFiles(event)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                      },
                      onDragLeave: (event: React.DragEvent) => {
                          // Only leaving the listing itself ends the drag, not
                          // moving from one row onto the next.
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                              setDropping(false);
                      },
                      onDrop: (event: React.DragEvent) => {
                          if (!carriesFiles(event)) return;
                          event.preventDefault();
                          setDropping(false);
                          const files = Array.from(event.dataTransfer.files);
                          if (files.length > 0) onUpload(files);
                      },
                  }
                : {})}
        >
            <div
                className="kissopen-file-browser__controls"
                data-kissopen-desktop-ui="file-browser-controls"
            >
                <SegmentedControl
                    aria-label={t("Files shown")}
                    className="kissopen-file-browser__scopes"
                    onChange={(scope) => local.onScopeChange?.(scope as FileBrowserScope)}
                    segments={SCOPES.filter(
                        (scope) => !local.hideChanges || scope.value === "all",
                    ).map((scope) => ({
                        ...scope,
                        ...(local.scopeUnavailable?.[scope.value] === undefined
                            ? {}
                            : {
                                  disabled: true,
                                  title: local.scopeUnavailable[scope.value],
                              }),
                    }))}
                    size="compact"
                    value={local.scope}
                />
                {local.scope === "changed" ? (
                    <>
                        <span
                            className="kissopen-file-browser__summary"
                            data-kissopen-desktop-ui="file-browser-summary"
                        >
                            <span className="kissopen-file-browser__count">
                                {local.count === undefined
                                    ? undefined
                                    : `${compactCount(local.count)} ${local.count === 1 ? "file" : "files"}`}
                            </span>
                            {added || deleted ? (
                                <span className="kissopen-file-browser__lines">
                                    {added ? (
                                        <span
                                            aria-hidden="true"
                                            className="kissopen-file-browser__added"
                                        >{`+${compactCount(local.addedLines ?? 0)}`}</span>
                                    ) : null}
                                    {deleted ? (
                                        <span
                                            aria-hidden="true"
                                            className="kissopen-file-browser__deleted"
                                        >{`−${compactCount(local.deletedLines ?? 0)}`}</span>
                                    ) : null}
                                    {/* Out of flow, so the pair keeps the row's spacing. */}
                                    <span className="kissopen-visually-hidden">
                                        {changeCountLabel(
                                            local.addedLines ?? 0,
                                            local.deletedLines ?? 0,
                                        )}
                                    </span>
                                </span>
                            ) : null}
                        </span>
                        <div className="kissopen-file-browser__layouts" role="group">
                            <button
                                aria-label={t("List files")}
                                aria-pressed={local.layout === "flat"}
                                className="kissopen-file-browser__layout"
                                data-active={local.layout === "flat" ? "" : undefined}
                                data-kissopen-desktop-ui="file-browser-layout"
                                onClick={() => local.onLayoutChange?.("flat")}
                                type="button"
                            >
                                <Icon name="files" size={14} />
                            </button>
                            <button
                                aria-label={t("Nest files into directories")}
                                aria-pressed={local.layout === "tree"}
                                className="kissopen-file-browser__layout"
                                data-active={local.layout === "tree" ? "" : undefined}
                                data-kissopen-desktop-ui="file-browser-layout"
                                onClick={() => local.onLayoutChange?.("tree")}
                                type="button"
                            >
                                <Icon name="branch" size={14} />
                            </button>
                        </div>
                    </>
                ) : null}
                {onUpload ? (
                    <>
                        <button
                            aria-label={t("Upload files")}
                            className="kissopen-file-browser__upload"
                            data-kissopen-desktop-ui="file-browser-upload"
                            disabled={local.uploadNotice?.tone === "progress"}
                            onClick={() => picker.current?.click()}
                            title={t("Upload files to uploads/")}
                            type="button"
                        >
                            <Ionicon name="cloud-upload-outline" size={15} />
                        </button>
                        <input
                            hidden
                            multiple
                            onChange={(event) => {
                                const files = Array.from(event.currentTarget.files ?? []);
                                event.currentTarget.value = "";
                                if (files.length > 0) onUpload(files);
                            }}
                            ref={picker}
                            type="file"
                        />
                    </>
                ) : null}
            </div>
            {local.uploadNotice ? (
                <div
                    className="kissopen-file-browser__notice"
                    data-kissopen-desktop-ui="file-browser-upload-notice"
                    data-tone={local.uploadNotice.tone}
                    role={local.uploadNotice.tone === "error" ? "alert" : "status"}
                >
                    <span className="kissopen-file-browser__notice-text">
                        {local.uploadNotice.text}
                    </span>
                    {local.uploadNotice.onDismiss ? (
                        <button
                            aria-label={t("Dismiss")}
                            className="kissopen-file-browser__notice-dismiss"
                            onClick={local.uploadNotice.onDismiss}
                            type="button"
                        >
                            <Icon name="close" size={12} />
                        </button>
                    ) : null}
                </div>
            ) : null}
            {dropping ? (
                <div
                    aria-hidden="true"
                    className="kissopen-file-browser__drop"
                    data-kissopen-desktop-ui="file-browser-drop"
                >
                    <Ionicon name="cloud-upload-outline" size={28} />
                    <span>{t("Drop to upload into uploads/")}</span>
                </div>
            ) : null}
            {local.note ? (
                <div
                    className="kissopen-file-browser__note"
                    data-kissopen-desktop-ui="file-browser-note"
                >
                    {local.note}
                </div>
            ) : null}
            {/* The tree does its own scrolling here, because a checkout listing
                draws only the rows on screen and nothing outside it can know
                how tall the rest would have been. */}
            <div
                className="kissopen-file-browser__body"
                data-kissopen-desktop-ui="file-browser-body"
            >
                <FileTree
                    emptyLabel={local.emptyLabel}
                    label={local.scope === "all" ? "All files" : "Changed files"}
                    loading={local.loading}
                    loadingLabel={local.loadingLabel}
                    nodes={local.nodes}
                    filesUnavailable={local.fileActionsUnavailable}
                    onDirectoryPrefetch={local.onDirectoryPrefetch}
                    onFilePrefetch={local.onFilePrefetch}
                    onLoadMore={local.onLoadMore}
                    onOpen={local.onOpen}
                    onSelect={local.onSelect}
                    onToggle={local.onToggle}
                    selectedId={local.selectedId}
                    virtualize
                />
            </div>
        </section>
    );
}
