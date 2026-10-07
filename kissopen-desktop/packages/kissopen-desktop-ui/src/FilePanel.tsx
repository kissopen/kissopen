import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { Button } from "./Button";
import { FileTree, type FileTreeNode, type FileTreeProps } from "./FileTree";
import { Icon } from "./Icon";
import { SURFACE_HEADER_HEIGHT } from "./InfoPanel";
import { ScrollArea } from "./Scrollbar";
import { Toolbar } from "./Toolbar";
export type FilePanelProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    title?: string;
    /** Header subtitle — typically the branch name or workspace revision. */
    subtitle?: string;
    onClose?: () => void;
    closeLabel?: string;
    /** The workspace tree. Passed straight through to FileTree. */
    nodes: readonly FileTreeNode[];
    selectedId?: FileTreeProps["selectedId"];
    onSelect?: FileTreeProps["onSelect"];
    onOpen?: FileTreeProps["onOpen"];
    onToggle?: FileTreeProps["onToggle"];
    onLoadMore?: FileTreeProps["onLoadMore"];
    loading?: boolean;
    loadingLabel?: string;
    emptyLabel?: string;
    /** Optional message shown under the header (e.g. a git-status hint). */
    note?: string;
};
/**
 * C-053 FilePanel — the workspace file-tree side panel. A 56px surface header
 * (shared height with ChannelHeader / InfoPanel) with an optional
 * branch/revision subtitle and close button, then a scrolling FileTree body.
 * Props only — the app supplies the tree nodes and the selection/expansion
 * handlers; the panel never fetches.
 */
export function FilePanel(props: FilePanelProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "title",
        "subtitle",
        "onClose",
        "closeLabel",
        "nodes",
        "selectedId",
        "onSelect",
        "onOpen",
        "onToggle",
        "onLoadMore",
        "loading",
        "loadingLabel",
        "emptyLabel",
        "note",
    ]);
    return (
        <section
            className={["kissopen-file-panel", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="file-panel"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <Toolbar
                className="kissopen-file-panel__header"
                height={SURFACE_HEADER_HEIGHT}
                leading={<Icon name="files" size={16} />}
                subtitle={local.subtitle}
                title={local.title ?? "Files"}
                trailing={
                    local.onClose ? (
                        <Button
                            aria-label={local.closeLabel ?? t("Close files")}
                            icon="close"
                            iconOnly
                            onClick={() => local.onClose?.()}
                            size="small"
                            variant="ghost"
                        />
                    ) : null
                }
            />
            {local.note ? (
                <div
                    className="kissopen-file-panel__note"
                    data-kissopen-desktop-ui="file-panel-note"
                >
                    {local.note}
                </div>
            ) : null}
            <ScrollArea
                className="kissopen-file-panel__body"
                data-kissopen-desktop-ui="file-panel-body"
                data-scrollbar-rows=""
                viewportClassName="kissopen-file-panel__body-viewport"
            >
                <div
                    className="kissopen-file-panel__body-content"
                    data-kissopen-desktop-ui="file-panel-body-content"
                >
                    <FileTree
                        emptyLabel={local.emptyLabel}
                        loading={local.loading}
                        loadingLabel={local.loadingLabel}
                        nodes={local.nodes}
                        onLoadMore={local.onLoadMore}
                        onOpen={local.onOpen}
                        onSelect={local.onSelect}
                        onToggle={local.onToggle}
                        selectedId={local.selectedId}
                    />
                </div>
            </ScrollArea>
        </section>
    );
}
