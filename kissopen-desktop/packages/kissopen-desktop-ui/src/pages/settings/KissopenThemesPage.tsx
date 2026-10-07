import {
    t,
    type Theme,
    type ThemeDoc,
    type ThemeDraft,
    type ThemePalette,
    type ThemesPage,
} from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { EmptyState } from "../../EmptyState";
import { Icon } from "../../Icon";
import { KissopenPageHeading } from "../../KissopenPageHeading";
import { ScrollArea } from "../../Scrollbar";
import { Select } from "../../Select";
import { TextField } from "../../TextField";

export type KissopenThemesPageProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** The theme page; null while it is being read. */
    themes: ThemesPage | null;
    /** Why the page could not be read. */
    error?: string;
    /** The account's theme; null for the product's own look. */
    current: Theme | null;
    gallery: {
        readonly q: string;
        readonly themes: readonly Theme[];
        readonly total: number;
    } | null;
    draft: ThemeDraft | null;
    /** A theme someone shared by link, offered until applied or ignored. */
    shared: Theme | null;
    busy: "" | "generating" | "saving" | "uploading";
    /** Why the last thing asked did not happen. */
    themeError?: string;
    /** Local-model capability or setup guidance, supplied by the product store. */
    generationHint?: string;
    /** The link that opens a theme in the web app, for sharing. */
    shareLink: (id: string) => string;
    onGalleryLoad: (q: string) => void;
    onSelect: (id: string) => void;
    onGenerate: (prompt: string) => void;
    onDraftEdit: (theme: Theme) => void;
    onDraftChange: (change: Partial<Pick<ThemeDraft, "name" | "description" | "doc">>) => void;
    onDraftClear: () => void;
    onDraftSave: () => void;
    onDelete: (id: string) => void;
    onPublish: (id: string, published: boolean) => void;
    onImport: (text: string) => void;
    onExport: (theme: Theme) => void;
    onImageUpload: (file: File) => void;
    onShareDismiss: () => void;
};

const PALETTE_ROLES: readonly { key: keyof ThemePalette; label: string }[] = [
    { key: "accent", label: t("强调色") },
    { key: "on_accent", label: t("强调色上的文字") },
    { key: "canvas", label: t("窗口底色") },
    { key: "surface", label: t("卡片") },
    { key: "raised", label: t("侧栏") },
    { key: "text", label: t("文字") },
    { key: "muted", label: t("次要文字") },
    { key: "line", label: t("分割线") },
    { key: "success", label: t("成功") },
    { key: "warning", label: t("警告") },
    { key: "danger", label: t("危险") },
];

const SOURCE_LABELS: Record<string, string> = {
    system: t("官方"),
    ai: t("AI 生成"),
    user: t("自制"),
};

/** One appearance of a theme, small: the canvas, a card, two lines of text and the accent. */
function Swatch(props: { palette: ThemePalette; label: string }) {
    const p = props.palette;
    return (
        <span
            aria-label={props.label}
            className="kissopen-themes__swatch"
            role="img"
            style={{ background: p.canvas, borderColor: p.line }}
        >
            <span className="kissopen-themes__swatch-card" style={{ background: p.surface }}>
                <span style={{ background: p.text }} />
                <span style={{ background: p.muted }} />
                <span className="kissopen-themes__swatch-accent" style={{ background: p.accent }} />
            </span>
        </span>
    );
}

/** Both appearances side by side. */
export function ThemeSwatches(props: { doc: ThemeDoc; className?: string }) {
    return (
        <span className={["kissopen-themes__swatches", props.className].filter(Boolean).join(" ")}>
            <Swatch label={t("浅色")} palette={props.doc.light} />
            <Swatch label={t("深色")} palette={props.doc.dark} />
        </span>
    );
}

function ThemeCard(props: {
    theme: Theme;
    current: boolean;
    onSelect: () => void;
    actions?: readonly { label: string; onClick: () => void; danger?: boolean }[];
}) {
    const theme = props.theme;
    return (
        <li className="kissopen-themes__card" data-current={props.current ? "" : undefined}>
            <button
                aria-pressed={props.current}
                className="kissopen-themes__card-open"
                onClick={props.onSelect}
                type="button"
            >
                {props.current ? (
                    <span className="kissopen-themes__current-ribbon">{t("使用中")}</span>
                ) : null}
                <ThemeSwatches doc={theme.doc} />
                <span className="kissopen-themes__card-text">
                    <strong>
                        {theme.name}
                        {theme.featured ? (
                            <em className="kissopen-themes__chip">{t("精选")}</em>
                        ) : null}
                    </strong>
                    {theme.description ? <span>{theme.description}</span> : null}
                    <small>
                        {theme.owner
                            ? t("{name} 制作", { name: theme.owner })
                            : SOURCE_LABELS[theme.source]}
                        {theme.uses > 0 ? ` · ${t("{count} 人使用", { count: theme.uses })}` : ""}
                        {theme.mine ? ` · ${theme.public ? t("已发布") : t("私密")}` : ""}
                    </small>
                </span>
            </button>
            {props.actions && props.actions.length > 0 ? (
                <span className="kissopen-themes__card-actions">
                    {props.actions.map((action) => (
                        <Button
                            key={action.label}
                            onClick={action.onClick}
                            size="small"
                            variant={action.danger ? "danger" : "ghost"}
                        >
                            {action.label}
                        </Button>
                    ))}
                </span>
            ) : null}
        </li>
    );
}

/** The draft, editable: name, type, shape, every colour, and the picture behind. */
function DraftEditor(props: KissopenThemesPageProps & { draft: ThemeDraft }) {
    const draft = props.draft;
    const doc = draft.doc;
    const [again, setAgain] = useState("");
    const palette = (which: "light" | "dark") => (
        <div className="kissopen-themes__palette">
            <h4>{which === "light" ? t("浅色") : t("深色")}</h4>
            {PALETTE_ROLES.map((role) => (
                <label key={role.key} className="kissopen-themes__colour">
                    <input
                        aria-label={role.label}
                        disabled={props.busy === "uploading"}
                        onChange={(event) =>
                            props.onDraftChange({
                                doc: {
                                    ...doc,
                                    [which]: {
                                        ...doc[which],
                                        [role.key]: event.currentTarget.value,
                                    },
                                },
                            })
                        }
                        type="color"
                        value={doc[which][role.key]}
                    />
                    <span>{role.label}</span>
                    <code>{doc[which][role.key]}</code>
                </label>
            ))}
        </div>
    );
    const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        props.onImageUpload(file);
    };
    const background = doc.background;
    return (
        <div className="kissopen-themes__editor" data-kissopen-desktop-ui="themes-editor">
            <div className="kissopen-themes__editor-head">
                <ThemeSwatches className="kissopen-themes__swatches--large" doc={doc} />
                <div className="kissopen-themes__editor-fields">
                    <TextField
                        disabled={props.busy === "uploading"}
                        label={t("名字")}
                        onValueChange={(name) => props.onDraftChange({ name })}
                        value={draft.name}
                    />
                    <TextField
                        disabled={props.busy === "uploading"}
                        label={t("一句话介绍")}
                        onValueChange={(description) => props.onDraftChange({ description })}
                        value={draft.description}
                    />
                    <div className="kissopen-themes__editor-row">
                        <Select
                            disabled={props.busy === "uploading"}
                            label={t("字体")}
                            onValueChange={(font) =>
                                props.onDraftChange({
                                    doc: { ...doc, font: font as ThemeDoc["font"] },
                                })
                            }
                            options={[
                                { value: "sans", label: t("默认") },
                                { value: "serif", label: t("宋体") },
                                { value: "mono", label: t("等宽") },
                            ]}
                            value={doc.font}
                        />
                        <Select
                            disabled={props.busy === "uploading"}
                            label={t("圆角")}
                            onValueChange={(radius) =>
                                props.onDraftChange({
                                    doc: { ...doc, radius: radius as ThemeDoc["radius"] },
                                })
                            }
                            options={[
                                { value: "sharp", label: t("方正") },
                                { value: "soft", label: t("柔和") },
                                { value: "round", label: t("圆润") },
                            ]}
                            value={doc.radius}
                        />
                    </div>
                </div>
            </div>
            <div className="kissopen-themes__palettes">
                {palette("light")}
                {palette("dark")}
            </div>
            <div aria-busy={props.busy === "uploading"} className="kissopen-themes__background">
                <h4>{t("背景图")}</h4>
                <p>{t("画在首页和侧栏后面；JPEG、PNG 或 WebP，3 MB 以内。")}</p>
                <div className="kissopen-themes__editor-row">
                    <label
                        className="kissopen-themes__file"
                        data-disabled={props.busy !== "" ? "" : undefined}
                    >
                        <input
                            accept="image/jpeg,image/png,image/webp"
                            disabled={props.busy !== ""}
                            onChange={pick}
                            type="file"
                        />
                        <Icon name="image" size={16} />
                        <span>
                            {props.busy === "uploading"
                                ? t("正在上传…")
                                : background
                                  ? t("换一张")
                                  : t("选择图片")}
                        </span>
                    </label>
                    {background ? (
                        <>
                            <label className="kissopen-themes__range">
                                <span>{t("显示程度")}</span>
                                <input
                                    disabled={props.busy === "uploading"}
                                    max={100}
                                    min={5}
                                    onChange={(event) =>
                                        props.onDraftChange({
                                            doc: {
                                                ...doc,
                                                background: {
                                                    ...background,
                                                    opacity:
                                                        Number(event.currentTarget.value) / 100,
                                                },
                                            },
                                        })
                                    }
                                    type="range"
                                    value={Math.round(background.opacity * 100)}
                                />
                            </label>
                            <label className="kissopen-themes__range">
                                <span>{t("模糊")}</span>
                                <input
                                    disabled={props.busy === "uploading"}
                                    max={40}
                                    min={0}
                                    onChange={(event) =>
                                        props.onDraftChange({
                                            doc: {
                                                ...doc,
                                                background: {
                                                    ...background,
                                                    blur: Number(event.currentTarget.value),
                                                },
                                            },
                                        })
                                    }
                                    type="range"
                                    value={background.blur}
                                />
                            </label>
                            <Button
                                disabled={props.busy === "uploading"}
                                onClick={() => {
                                    const { background: _gone, ...rest } = doc;
                                    props.onDraftChange({ doc: rest });
                                }}
                                size="small"
                                variant="ghost"
                            >
                                {t("移除背景")}
                            </Button>
                        </>
                    ) : null}
                </div>
                {props.busy === "uploading" ? (
                    <Banner tone="info">{t("正在上传背景图片，请稍候。")}</Banner>
                ) : background && props.busy === "" && !props.themeError ? (
                    <Banner tone="success">
                        {t("背景已预览，保存主题后会在下次打开时保留。")}
                    </Banner>
                ) : null}
            </div>
            <div className="kissopen-themes__again">
                <TextField
                    disabled={props.busy !== "" || !props.themes?.can_generate}
                    onSubmit={() => {
                        if (again.trim() && props.busy === "" && props.themes?.can_generate)
                            props.onGenerate(again.trim());
                    }}
                    onValueChange={setAgain}
                    placeholder={t("让 AI 改一改，比如「强调色换成绿色」")}
                    value={again}
                />
                <Button
                    disabled={!again.trim() || props.busy !== "" || !props.themes?.can_generate}
                    loading={props.busy === "generating"}
                    onClick={() => {
                        props.onGenerate(again.trim());
                    }}
                    variant="secondary"
                >
                    {t("改一改")}
                </Button>
            </div>
            {props.generationHint ? <p>{props.generationHint}</p> : null}
            <div className="kissopen-themes__editor-actions">
                <Button
                    disabled={!draft.name.trim() || props.busy !== ""}
                    loading={props.busy === "saving"}
                    onClick={props.onDraftSave}
                    variant="primary"
                >
                    {draft.id ? t("保存修改") : t("保存并使用")}
                </Button>
                <Button onClick={props.onDraftClear} variant="ghost">
                    {t("放弃")}
                </Button>
            </div>
        </div>
    );
}

/** A titled block of the page, in the library's own section style. */
function Section(props: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="kissopen-themes__section">
            <div className="work-library__section-intro">
                <h2>{props.title}</h2>
                {props.description ? <p>{props.description}</p> : null}
            </div>
            {props.children}
        </section>
    );
}

/**
 * C-309 KissopenThemesPage — 主题: a sidebar destination that opens on the
 * gallery, the product's own themes always first in it. Making a theme,
 * importing one and searching are the heading's three actions.
 */
export function KissopenThemesPage(props: KissopenThemesPageProps) {
    /** Which of the heading's actions is open; a draft always shows its editor. */
    const [mode, setMode] = useState<"gallery" | "make">("gallery");
    const [importing, setImporting] = useState(false);
    const [searching, setSearching] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [search, setSearch] = useState("");
    const [pasted, setPasted] = useState("");
    const [copied, setCopied] = useState("");
    const themes = props.themes;
    const making = props.draft !== null || mode === "make";
    const heading = (
        <KissopenPageHeading
            eyebrow={`${t("KissOpen")} · ${t("换个样子")}`}
            title={making ? t("制作我的主题") : t("主题广场")}
            description={
                making
                    ? t("说说想要的感觉，或者从一个主题改起。")
                    : t("选一个主题，每一台登录了这个账号的设备都会换上。")
            }
            actions={
                making ? (
                    <Button
                        onClick={() => {
                            if (props.draft) props.onDraftClear();
                            setMode("gallery");
                        }}
                        variant="secondary"
                    >
                        {t("返回主题广场")}
                    </Button>
                ) : (
                    <div className="kissopen-themes__actions">
                        <Button icon="plus" onClick={() => setMode("make")} variant="primary">
                            {t("制作我的主题")}
                        </Button>
                        <Button
                            aria-pressed={importing}
                            icon="doc"
                            onClick={() => setImporting((open) => !open)}
                            variant="secondary"
                        >
                            {t("导入")}
                        </Button>
                        <Button
                            aria-pressed={searching}
                            icon="search"
                            onClick={() => {
                                if (searching && search) {
                                    setSearch("");
                                    props.onGalleryLoad("");
                                }
                                setSearching(!searching);
                            }}
                            variant="secondary"
                        >
                            {t("搜索")}
                        </Button>
                    </div>
                )
            }
        />
    );
    const page = (children: React.ReactNode) => (
        <div
            className={["work-library-page", "kissopen-themes", props.className]
                .filter(Boolean)
                .join(" ")}
            data-kissopen-desktop-ui="kissopen-themes-page"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {heading}
            <ScrollArea className="work-library" viewportClassName="work-library__viewport">
                <div className="work-library__content kissopen-themes__content" data-headed="">
                    {props.themeError ? (
                        <Banner tone="danger" title={t("没有完成")}>
                            {props.themeError}
                        </Banner>
                    ) : null}
                    {children}
                </div>
            </ScrollArea>
        </div>
    );
    if (!themes)
        return page(
            props.error ? (
                <EmptyState
                    description={props.error}
                    icon="sun"
                    size="panel"
                    title={t("主题暂时读取不到")}
                />
            ) : (
                <EmptyState
                    description={t("正在读取主题。")}
                    icon="sun"
                    size="panel"
                    title={t("正在加载")}
                />
            ),
        );
    const currentId = props.current?.id ?? "";
    const copy = (id: string) => {
        void navigator.clipboard.writeText(props.shareLink(id)).then(() => {
            setCopied(id);
            setTimeout(() => setCopied((value) => (value === id ? "" : value)), 1600);
        });
    };
    const generate = () => {
        if (!prompt.trim() || props.busy !== "" || !themes?.can_generate) return;
        props.onGenerate(prompt.trim());
    };
    const mineCard = (theme: Theme) => (
        <ThemeCard
            key={theme.id}
            actions={[
                {
                    label: t("编辑"),
                    onClick: () => {
                        props.onDraftEdit(theme);
                        setMode("make");
                    },
                },
                {
                    label: theme.public ? t("取消发布") : t("发布到广场"),
                    onClick: () => props.onPublish(theme.id, !theme.public),
                },
                ...(theme.public
                    ? [
                          {
                              label: copied === theme.id ? t("链接已复制") : t("分享"),
                              onClick: () => copy(theme.id),
                          },
                      ]
                    : []),
                { label: t("导出"), onClick: () => props.onExport(theme) },
                { label: t("删除"), onClick: () => props.onDelete(theme.id), danger: true },
            ]}
            current={theme.id === currentId}
            onSelect={() => props.onSelect(theme.id)}
            theme={theme}
        />
    );

    if (making)
        return page(
            <>
                {props.draft ? (
                    <DraftEditor
                        {...props}
                        draft={props.draft}
                        onDraftClear={() => {
                            props.onDraftClear();
                            setMode("gallery");
                        }}
                        onDraftSave={() => {
                            props.onDraftSave();
                            setMode("gallery");
                        }}
                    />
                ) : (
                    <Section
                        title={t("用 AI 生成")}
                        description={
                            props.generationHint ||
                            (themes.can_generate
                                ? t(
                                      "说说想要的感觉，比如「秋天的暖色调」「像纸一样的浅色」，马上就能看到。",
                                  )
                                : t("现在没有可用的模型，暂时不能生成。"))
                        }
                    >
                        <div className="kissopen-themes__generate">
                            <TextField
                                disabled={!themes.can_generate || props.busy !== ""}
                                onSubmit={generate}
                                onValueChange={setPrompt}
                                placeholder={t("想要什么样的主题？")}
                                value={prompt}
                            />
                            <Button
                                disabled={
                                    !themes.can_generate || !prompt.trim() || props.busy !== ""
                                }
                                icon="spark"
                                loading={props.busy === "generating"}
                                onClick={generate}
                                variant="primary"
                            >
                                {t("生成")}
                            </Button>
                        </div>
                    </Section>
                )}
                {!props.draft && themes.mine.length > 0 ? (
                    <Section
                        title={t("我的主题")}
                        description={t("或者从自己的主题改起：点「编辑」。")}
                    >
                        <ul className="kissopen-themes__list">{themes.mine.map(mineCard)}</ul>
                    </Section>
                ) : null}
            </>,
        );

    // The product's own themes are always in the gallery, first; while a search
    // is on they are held to it the way the server holds everyone else's.
    const query = (props.gallery?.q ?? "").toLocaleLowerCase();
    const official = themes.system.filter(
        (theme) =>
            !query || `${theme.name} ${theme.description}`.toLocaleLowerCase().includes(query),
    );
    const shared = props.gallery ? props.gallery.themes : themes.featured;
    const galleryThemes = [...official, ...shared.filter((theme) => theme.source !== "system")];
    const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        void file.text().then((text) => {
            props.onImport(text);
            setImporting(false);
        });
    };
    return page(
        <>
            {props.shared ? (
                <Banner
                    action={{ label: t("套用"), onClick: () => props.onSelect(props.shared!.id) }}
                    icon="gift"
                    onDismiss={props.onShareDismiss}
                    tone="info"
                    title={t("{name} 分享了主题「{theme}」", {
                        name: props.shared.owner || t("有人"),
                        theme: props.shared.name,
                    })}
                >
                    {t("现在看到的就是这个主题的样子。")}
                </Banner>
            ) : null}

            {importing ? (
                <div className="kissopen-themes__panel">
                    <div className="work-library__section-intro">
                        <h2>{t("导入")}</h2>
                        <p>{t("粘贴一份主题文件的内容或别人分享的链接，也可以选一个主题文件。")}</p>
                    </div>
                    <TextField
                        fullWidth
                        multiline
                        onValueChange={setPasted}
                        placeholder={t("主题文件的 JSON，或分享链接")}
                        rows={3}
                        value={pasted}
                    />
                    <div className="kissopen-themes__editor-actions">
                        <Button
                            disabled={!pasted.trim()}
                            onClick={() => {
                                props.onImport(pasted);
                                setPasted("");
                                setImporting(false);
                            }}
                            variant="primary"
                        >
                            {t("导入")}
                        </Button>
                        <label className="kissopen-themes__file">
                            <input
                                accept="application/json,.json"
                                onChange={pickFile}
                                type="file"
                            />
                            <Icon name="files" size={16} />
                            <span>{t("选择文件")}</span>
                        </label>
                        <Button onClick={() => setImporting(false)} variant="ghost">
                            {t("取消")}
                        </Button>
                    </div>
                </div>
            ) : null}

            {searching ? (
                <div className="kissopen-themes__generate">
                    <TextField
                        autoFocus
                        leadingIcon="search"
                        onSubmit={() => props.onGalleryLoad(search.trim())}
                        onValueChange={setSearch}
                        placeholder={t("搜索主题，按回车")}
                        type="search"
                        value={search}
                    />
                </div>
            ) : null}

            <div className="kissopen-themes__current">
                {props.current ? (
                    <ThemeSwatches doc={props.current.doc} />
                ) : (
                    <Icon name="sun" size={18} />
                )}
                <strong>{t("正在使用：{name}", { name: props.current?.name ?? t("默认") })}</strong>
                {props.current ? (
                    <Button onClick={() => props.onSelect("")} size="small" variant="secondary">
                        {t("恢复默认")}
                    </Button>
                ) : null}
            </div>

            {/* The page is the gallery; its heading already says so. */}
            <section className="kissopen-themes__section">
                {galleryThemes.length === 0 ? (
                    <p className="kissopen-themes__empty">
                        {query
                            ? t("没有找到「{q}」。", { q: props.gallery?.q ?? "" })
                            : t("还没有人分享主题。")}
                    </p>
                ) : (
                    <ul className="kissopen-themes__grid">
                        {galleryThemes.map((theme) => (
                            <ThemeCard
                                key={theme.id}
                                current={theme.id === currentId}
                                onSelect={() => props.onSelect(theme.id)}
                                theme={theme}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {themes.mine.length > 0 ? (
                <Section
                    title={t("我的主题")}
                    description={t(
                        "生成、导入或改过的主题都在这里。发布后别人能在主题广场看到并使用。",
                    )}
                >
                    <ul className="kissopen-themes__list">{themes.mine.map(mineCard)}</ul>
                </Section>
            ) : null}
        </>,
    );
}
