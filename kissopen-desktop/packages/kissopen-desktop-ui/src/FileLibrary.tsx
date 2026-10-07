import { localeCurrent, t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Icon, type IconName } from "./Icon";
import { KissopenPageHeading } from "./KissopenPageHeading";
import { ScrollArea } from "./Scrollbar";
import { SegmentedControl } from "./SegmentedControl";
import { TextField } from "./TextField";
import { partitionComponentProps } from "./componentProps";

/** The kinds a library file can be. The caller decides; the component only draws them. */
export type FileLibraryKind = "document" | "data" | "image";
export type FileLibraryFilter = FileLibraryKind | "all";
/** How the files are laid out: a dated list, or tiles with a picture's own preview. */
export type FileLibraryView = "list" | "grid";
export type FileLibrarySource = {
    id: string;
    label: string;
};
/** How the files are grouped: by the project each belongs to, or by when it arrived. */
export type FileLibraryGrouping = "project" | "time";
/** The project a file is in, named the way the reader knows it. */
export type FileLibraryProject = {
    /** Stable across machines: the same folder on two computers is two projects. */
    id: string;
    name: string;
};
export type FileLibraryItem = {
    id: string;
    name: string;
    kind: FileLibraryKind;
    /** Bytes; absent when the machine holding the file did not say. */
    size?: number;
    /** Epoch milliseconds. */
    created: number;
    /** The project whose folder holds the file; absent for one kept with chats. */
    project?: FileLibraryProject;
    /** Where the file was last used; absent for a file never sent anywhere. */
    source?: FileLibrarySource;
    /** Already attached to the composer, so the row says so instead of offering it again. */
    selected?: boolean;
    /** Whether the row offers "use in chat"; images have no composer slot on desktop yet. */
    attachable?: boolean;
    /**
     * Where a picture can be shown from. Rows and tiles draw it; a file without one, or
     * one that fails to load, shows its kind instead.
     */
    previewUrl?: string;
};
export type FileLibraryProps = {
    description?: string;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    items: readonly FileLibraryItem[];
    filter: FileLibraryFilter;
    onFilterChange?: (filter: FileLibraryFilter) => void;
    search: string;
    onSearchChange?: (search: string) => void;
    /** Defaults to the list. The caller keeps the choice. */
    view?: FileLibraryView;
    onViewChange?: (view: FileLibraryView) => void;
    onUpload?: () => void;
    /**
     * Why the last upload did not land, in the reader's words. The library is
     * the whole content region, so nothing else on screen would say it.
     */
    error?: string;
    /** Attach the file to the current chat. */
    onItemUse?: (id: string) => void;
    /** Open the file itself, on a double-click of its row. */
    onItemOpen?: (id: string) => void;
    /** Requests a project picture only when its thumbnail approaches the viewport. */
    onItemPreviewRequest?: (id: string) => void;
    /** Open the conversation in `source`. */
    onItemSourceOpen?: (id: string) => void;
    /**
     * The instant the date groups are measured from — when the list was loaded,
     * not a clock read during render. Fixtures pin it so screenshots stay still.
     */
    now: number;
    /** Keeps every row's hover actions visible in deterministic blueprint fixtures. */
    actionsVisible?: boolean;
    /**
     * Names the one conversation the list is narrowed to. The caller does the
     * narrowing; this only says so, and offers the way back to everything.
     */
    scopeLabel?: string;
    onScopeClear?: () => void;
};

const kindLabels: Record<FileLibraryKind, string> = {
    document: t("文档"),
    data: t("数据"),
    image: t("图片"),
};
const kindIcons: Record<FileLibraryKind, IconName> = {
    document: "doc",
    data: "braces",
    image: "image",
};
const filters: readonly { value: FileLibraryFilter; label: string }[] = [
    { value: "all", label: t("全部") },
    { value: "document", label: t("文档") },
    { value: "data", label: t("数据") },
    { value: "image", label: t("图片") },
];
const groupings: readonly { value: FileLibraryGrouping; label: string; icon: IconName }[] = [
    { value: "project", label: t("按项目"), icon: "folder" },
    { value: "time", label: t("按时间"), icon: "clock" },
];
const views: readonly { value: FileLibraryView; label: string }[] = [
    { value: "list", label: t("列表") },
    { value: "grid", label: t("平铺") },
];
const DAY = 86_400_000;

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Midnight of the local day `at` falls in. */
function dayStart(at: number): number {
    const date = new Date(at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function groupLabel(created: number, now: number): string {
    const today = dayStart(now);
    if (created >= today) return t("今天");
    if (created >= today - DAY) return t("昨天");
    if (created >= today - 7 * DAY) return t("过去 7 天");
    if (created >= today - 30 * DAY) return t("过去 30 天");
    return t("更早");
}

function timeLabel(created: number, now: number): string {
    const date = new Date(created);
    const two = (n: number) => String(n).padStart(2, "0");
    if (created >= dayStart(now) - DAY) return `${two(date.getHours())}:${two(date.getMinutes())}`;
    if (date.getFullYear() === new Date(now).getFullYear())
        return date.toLocaleDateString(localeCurrent() === "zh" ? "zh-CN" : "en-US", {
            month: "short",
            day: "numeric",
        });
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

const UNASSIGNED = "unassigned";
type FileLibraryGroup = { id: string; label: string; items: FileLibraryItem[] };

/** Consecutive runs of the same day bucket; the files arrive newest first. */
function groupFilesByDay(items: readonly FileLibraryItem[], now: number): FileLibraryGroup[] {
    const groups: FileLibraryGroup[] = [];
    for (const item of items) {
        const label = groupLabel(item.created, now);
        const last = groups[groups.length - 1];
        if (last?.label === label) last.items.push(item);
        else groups.push({ id: label, label, items: [item] });
    }
    return groups;
}

/**
 * One group per project, the one with the newest file first, as 计划任务
 * groups its tasks; files kept with chats come last, under 未关联项目.
 */
function groupFilesByProject(items: readonly FileLibraryItem[]): FileLibraryGroup[] {
    const groups = new Map<string, FileLibraryGroup>();
    const unassigned: FileLibraryItem[] = [];
    for (const item of items) {
        if (!item.project) {
            unassigned.push(item);
            continue;
        }
        const id = `project:${item.project.id}`;
        const group = groups.get(id);
        if (group) group.items.push(item);
        else groups.set(id, { id, label: item.project.name, items: [item] });
    }
    return [
        ...groups.values(),
        ...(unassigned.length
            ? [{ id: UNASSIGNED, label: t("未关联项目"), items: unassigned }]
            : []),
    ];
}

/**
 * C-282 FileLibrary — every file the reader has given KISSOPEN or had made
 * in a project, grouped by project (or by day) and filterable by kind. Each row names the conversation the
 * file was last used in, so the list reads as history rather than as a bucket.
 * Props-only: the caller owns the filter, the search text, and what "use" and
 * "open" do.
 */
export function FileLibrary(props: FileLibraryProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "description",
        "data-testid",
        "style",
        "items",
        "filter",
        "onFilterChange",
        "search",
        "onSearchChange",
        "view",
        "onViewChange",
        "onUpload",
        "error",
        "onItemUse",
        "onItemOpen",
        "onItemPreviewRequest",
        "onItemSourceOpen",
        "now",
        "actionsVisible",
        "scopeLabel",
        "onScopeClear",
    ]);
    const now = local.now;
    const view: FileLibraryView = local.view ?? "list";
    const query = local.search.trim().toLowerCase();
    const visible = local.items.filter(
        (item) =>
            (local.filter === "all" || item.kind === local.filter) &&
            (!query ||
                item.name.toLowerCase().includes(query) ||
                item.project?.name.toLowerCase().includes(query) ||
                item.source?.label.toLowerCase().includes(query)),
    );
    const [grouping, setGrouping] = useState<FileLibraryGrouping>("project");
    const newestFirst = [...visible].sort((a, b) => b.created - a.created);
    const groups =
        grouping === "project"
            ? groupFilesByProject(newestFirst)
            : groupFilesByDay(newestFirst, now);
    const uploadAction = local.onUpload
        ? { label: t("上传文件"), icon: "plus" as const, onClick: local.onUpload }
        : undefined;

    return (
        <section
            className={["kissopen-file-library", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="file-library"
            data-testid={local["data-testid"]}
            style={local.style}
            {...(local.actionsVisible ? { "data-actions-visible": "" } : {})}
        >
            <KissopenPageHeading
                eyebrow={`${t("KissOpen")} · ${t("你的文件都在这里")}`}
                title={t("资料库")}
                description={
                    local.description ??
                    (local.items.length
                        ? t("{count} 个文件，来自你的项目与对话", { count: local.items.length })
                        : t("项目里上传和生成的文件、对话中用到的文件都会收在这里"))
                }
                actions={
                    local.onUpload && (
                        <Button icon="plus" onClick={local.onUpload}>
                            {t("上传文件")}
                        </Button>
                    )
                }
            />
            {local.error ? (
                <Banner
                    className="kissopen-file-library__error"
                    tone="danger"
                    // Any request here can fail, not only an upload; the message says which.
                    title={t("操作没有完成")}
                >
                    {local.error}
                </Banner>
            ) : null}
            {local.items.length > 0 && (
                <div
                    className="kissopen-file-library__toolbar"
                    data-kissopen-desktop-ui="file-library-toolbar"
                >
                    <TextField
                        aria-label={t("搜索资料库")}
                        className="kissopen-file-library__search"
                        leadingIcon="search"
                        onValueChange={local.onSearchChange}
                        placeholder={t("搜索文件名或项目")}
                        size="small"
                        value={local.search}
                    />
                    {local.scopeLabel && (
                        <span className="kissopen-file-library__scope">
                            <Icon name="chat" size={12} />
                            <span className="kissopen-file-library__scope-label">
                                {local.scopeLabel}
                            </span>
                            {local.onScopeClear && (
                                <button
                                    aria-label={t("显示全部文件")}
                                    className="kissopen-file-library__scope-clear"
                                    onClick={local.onScopeClear}
                                    type="button"
                                >
                                    <Icon name="close" size={12} />
                                </button>
                            )}
                        </span>
                    )}
                    <SegmentedControl
                        aria-label={t("文件分组")}
                        onChange={(value) => setGrouping(value as FileLibraryGrouping)}
                        segments={groupings.map((option) => ({ ...option }))}
                        size="small"
                        value={grouping}
                    />
                    <SegmentedControl
                        aria-label={t("按类型筛选")}
                        onChange={(value) => local.onFilterChange?.(value as FileLibraryFilter)}
                        segments={filters.map((filter) => ({ ...filter }))}
                        size="small"
                        value={local.filter}
                    />
                    {local.onViewChange && (
                        <SegmentedControl
                            aria-label={t("展现方式")}
                            onChange={(value) => local.onViewChange?.(value as FileLibraryView)}
                            segments={views.map((option) => ({ ...option }))}
                            size="small"
                            value={view}
                        />
                    )}
                </div>
            )}
            <ScrollArea
                className="kissopen-file-library__scroll"
                viewportClassName="kissopen-file-library__viewport"
            >
                {local.items.length === 0 ? (
                    <EmptyState
                        action={uploadAction}
                        description={t(
                            "项目里上传的材料、助手生成的文件，以及聊天中添加的文件，都会按项目收在资料库里，随时再次使用。",
                        )}
                        icon="files"
                        size="panel"
                        title={t("资料库还是空的")}
                    />
                ) : visible.length === 0 ? (
                    <EmptyState
                        description={t("换个关键词，或切换到「全部」再看看。")}
                        icon="search"
                        size="panel"
                        title={t("没有匹配的文件")}
                    />
                ) : (
                    <div
                        className="kissopen-file-library__list"
                        data-kissopen-desktop-ui="file-library-list"
                        data-view={view}
                    >
                        {groups.map((group) => (
                            <section className="kissopen-file-library__group" key={group.id}>
                                <h2 className="kissopen-file-library__group-label">
                                    {grouping === "project" && (
                                        <Icon
                                            name={group.id === UNASSIGNED ? "chat" : "folder"}
                                            size={12}
                                        />
                                    )}
                                    <span>{group.label}</span>
                                    <span className="kissopen-file-library__group-count">
                                        {group.items.length}
                                    </span>
                                </h2>
                                {view === "grid" ? (
                                    <div className="kissopen-file-library__grid">
                                        {group.items.map((item) => (
                                            <FileLibraryCard
                                                onPreviewRequest={local.onItemPreviewRequest}
                                                item={item}
                                                key={item.id}
                                                now={now}
                                                showProject={grouping === "time"}
                                                onOpen={local.onItemOpen}
                                                onSourceOpen={local.onItemSourceOpen}
                                                onUse={local.onItemUse}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    group.items.map((item) => (
                                        <FileLibraryRow
                                            onPreviewRequest={local.onItemPreviewRequest}
                                            item={item}
                                            key={item.id}
                                            now={now}
                                            showProject={grouping === "time"}
                                            onOpen={local.onItemOpen}
                                            onSourceOpen={local.onItemSourceOpen}
                                            onUse={local.onItemUse}
                                        />
                                    ))
                                )}
                            </section>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </section>
    );
}

function FileLibraryRow(props: {
    onPreviewRequest?: (id: string) => void;
    item: FileLibraryItem;
    now: number;
    /** Names the file's project, when the groups do not already. */
    showProject: boolean;
    onUse?: (id: string) => void;
    onOpen?: (id: string) => void;
    onSourceOpen?: (id: string) => void;
}) {
    const { item } = props;
    const attachable = item.attachable !== false && !!props.onUse;
    return (
        <div
            className="kissopen-file-library__row"
            data-kind={item.kind}
            data-kissopen-desktop-ui="file-library-row"
            {...(item.selected ? { "data-selected": "" } : {})}
            {...(props.onOpen
                ? { onDoubleClick: () => props.onOpen?.(item.id), title: t("双击打开") }
                : {})}
        >
            <span className="kissopen-file-library__tile" aria-hidden="true">
                <FileLibraryPicture item={item} size={18} onRequest={props.onPreviewRequest} />
            </span>
            <div className="kissopen-file-library__copy">
                <span className="kissopen-file-library__name" title={item.name}>
                    {item.name}
                </span>
                <span className="kissopen-file-library__meta">
                    <span>{kindLabels[item.kind]}</span>
                    {item.size !== undefined && (
                        <>
                            <span className="kissopen-file-library__dot" aria-hidden="true" />
                            <span>{formatFileSize(item.size)}</span>
                        </>
                    )}
                    {props.showProject && item.project && (
                        <>
                            <span className="kissopen-file-library__dot" aria-hidden="true" />
                            <span className="kissopen-file-library__source">
                                <Icon name="folder" size={12} />
                                <span className="kissopen-file-library__source-label">
                                    {item.project.name}
                                </span>
                            </span>
                        </>
                    )}
                    {item.source && (
                        <>
                            <span className="kissopen-file-library__dot" aria-hidden="true" />
                            {props.onSourceOpen ? (
                                <button
                                    className="kissopen-file-library__source"
                                    onClick={() => props.onSourceOpen?.(item.id)}
                                    type="button"
                                >
                                    <Icon name="chat" size={12} />
                                    <span className="kissopen-file-library__source-label">
                                        {item.source.label}
                                    </span>
                                </button>
                            ) : (
                                <span className="kissopen-file-library__source">
                                    <Icon name="chat" size={12} />
                                    <span className="kissopen-file-library__source-label">
                                        {item.source.label}
                                    </span>
                                </span>
                            )}
                        </>
                    )}
                    {item.selected && (
                        <>
                            <span className="kissopen-file-library__dot" aria-hidden="true" />
                            <span className="kissopen-file-library__selected">
                                {t("已加入聊天")}
                            </span>
                        </>
                    )}
                </span>
            </div>
            <span className="kissopen-file-library__time">
                {timeLabel(item.created, props.now)}
            </span>
            <span className="kissopen-file-library__actions">
                {attachable && (
                    <Button
                        aria-label={item.selected ? t("前往聊天") : t("用于聊天")}
                        icon="paperclip"
                        iconOnly
                        onClick={() => props.onUse?.(item.id)}
                        size="small"
                        variant="ghost"
                    />
                )}
                {props.onOpen && (
                    <Button
                        aria-label={t("打开文件")}
                        icon="open-external"
                        iconOnly
                        onClick={() => props.onOpen?.(item.id)}
                        size="small"
                        variant="ghost"
                    />
                )}
                {item.source && props.onSourceOpen && (
                    <Button
                        aria-label={t("打开对话")}
                        icon="arrow-right"
                        iconOnly
                        onClick={() => props.onSourceOpen?.(item.id)}
                        size="small"
                        variant="ghost"
                    />
                )}
            </span>
        </div>
    );
}

/**
 * One file as a tile: its picture when it is a picture, its kind otherwise,
 * then its name and when it arrived. The same actions as a row, on hover,
 * and a double-click opens it.
 */
function FileLibraryCard(props: {
    onPreviewRequest?: (id: string) => void;
    item: FileLibraryItem;
    now: number;
    /** Names the file's project, when the groups do not already. */
    showProject: boolean;
    onUse?: (id: string) => void;
    onOpen?: (id: string) => void;
    onSourceOpen?: (id: string) => void;
}) {
    const { item } = props;
    const attachable = item.attachable !== false && !!props.onUse;
    return (
        <div
            className="kissopen-file-library__card"
            data-kind={item.kind}
            data-kissopen-desktop-ui="file-library-card"
            {...(item.selected ? { "data-selected": "" } : {})}
            {...(props.onOpen
                ? { onDoubleClick: () => props.onOpen?.(item.id), title: t("双击打开") }
                : {})}
        >
            <span className="kissopen-file-library__thumb">
                <FileLibraryPicture item={item} size={32} onRequest={props.onPreviewRequest} />
            </span>
            <span className="kissopen-file-library__card-name" title={item.name}>
                {item.name}
            </span>
            <span className="kissopen-file-library__card-meta">
                {item.size !== undefined && (
                    <>
                        <span>{formatFileSize(item.size)}</span>
                        <span className="kissopen-file-library__dot" aria-hidden="true" />
                    </>
                )}
                <span>{timeLabel(item.created, props.now)}</span>
                {item.selected && (
                    <>
                        <span className="kissopen-file-library__dot" aria-hidden="true" />
                        <span className="kissopen-file-library__selected">{t("已加入聊天")}</span>
                    </>
                )}
            </span>
            <span className="kissopen-file-library__actions kissopen-file-library__card-actions">
                {attachable && (
                    <Button
                        aria-label={item.selected ? t("前往聊天") : t("用于聊天")}
                        icon="paperclip"
                        iconOnly
                        onClick={() => props.onUse?.(item.id)}
                        size="small"
                        variant="secondary"
                    />
                )}
                {props.onOpen && (
                    <Button
                        aria-label={t("打开文件")}
                        icon="open-external"
                        iconOnly
                        onClick={() => props.onOpen?.(item.id)}
                        size="small"
                        variant="secondary"
                    />
                )}
                {item.source && props.onSourceOpen && (
                    <Button
                        aria-label={t("打开对话")}
                        icon="arrow-right"
                        iconOnly
                        onClick={() => props.onSourceOpen?.(item.id)}
                        size="small"
                        variant="secondary"
                    />
                )}
            </span>
        </div>
    );
}

/** Shared by list rows and cards; loading and failed pictures retain a stable icon. */
function FileLibraryPicture(props: {
    item: FileLibraryItem;
    size: 18 | 32;
    onRequest?: (id: string) => void;
}) {
    const { item, onRequest } = props;
    const [failedUrl, setFailedUrl] = useState<string | undefined>();
    const picture =
        item.kind === "image" && item.previewUrl !== failedUrl ? item.previewUrl : undefined;
    return (
        <span
            className="kissopen-file-library__picture"
            ref={(element) => {
                if (!element || item.kind !== "image" || item.previewUrl || !onRequest) return;
                const observer = new IntersectionObserver(
                    (entries) => {
                        if (!entries.some((entry) => entry.isIntersecting)) return;
                        observer.disconnect();
                        onRequest(item.id);
                    },
                    { rootMargin: "120px" },
                );
                observer.observe(element);
                return () => observer.disconnect();
            }}
        >
            {picture ? (
                <img
                    alt=""
                    className="kissopen-file-library__thumb-image"
                    decoding="async"
                    draggable={false}
                    loading="lazy"
                    onError={() => setFailedUrl(picture)}
                    src={picture}
                />
            ) : (
                <Icon name={item.selected ? "check" : kindIcons[item.kind]} size={props.size} />
            )}
        </span>
    );
}
