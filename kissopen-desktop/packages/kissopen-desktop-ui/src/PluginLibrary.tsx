import { useRef, useState, type ReactNode } from "react";
import { t } from "kissopen-desktop-state";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { KissopenPageHeading } from "./KissopenPageHeading";
import { ScrollArea } from "./Scrollbar";
import { SegmentedControl } from "./SegmentedControl";
import { Spinner } from "./Spinner";
import { Switch } from "./Switch";
import { TextField } from "./TextField";
import { Banner } from "./Banner";

export type LibraryPlugin = {
    id: string;
    name: string;
    description: string;
    icon?: string;
    version: string;
    skills: number;
    servers?: number;
    executionLocation?: string;
    connectionsManagedElsewhere?: boolean;
    installed: boolean;
    enabled: boolean;
    status: string;
    notice?: string;
    disabled: boolean;
    busy: boolean;
    onInstall?: () => void;
    onToggle?: (enabled: boolean) => void;
    onRemove?: () => void;
    connections: readonly {
        id: string;
        name: string;
        connected: boolean;
        error?: string;
        onConnect: () => void;
    }[];
};

/** A plugin library. Only search and navigation are local UI state. */
export function PluginLibrary(props: {
    plugins: readonly LibraryPlugin[];
    loading: boolean;
    notices?: ReactNode;
    description?: string;
    onImport?: (file: File) => Promise<void>;
    importDisabled?: boolean;
    connectionsVisible?: boolean;
}) {
    const [tab, setTab] = useState("plugins");
    const [collection, setCollection] = useState("installed");
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const opener = useRef<HTMLButtonElement | null>(null);
    const importInput = useRef<HTMLInputElement | null>(null);
    const selected = props.plugins.find((item) => item.id === selectedId);
    const needle = query.trim().toLocaleLowerCase();
    const matches = props.plugins.filter((item) =>
        [item.name, item.description, ...item.connections.map((connection) => connection.name)]
            .join(" ")
            .toLocaleLowerCase()
            .includes(needle),
    );
    const visible = matches.filter((item) =>
        tab === "skills"
            ? item.installed && item.skills > 0
            : tab === "connections"
              ? item.installed && item.connections.length > 0
              : collection === "market" || item.installed,
    );
    const installedCount = props.plugins.filter((item) => item.installed).length;
    return (
        <>
            <div className="work-library-page" style={selected ? { display: "none" } : undefined}>
                <KissopenPageHeading
                    eyebrow={`${t("KissOpen")} · ${t("给助手更多能力")}`}
                    title={t("插件")}
                    description={props.description ?? t("连接常用应用，让日常工作少几个步骤。")}
                    actions={
                        <>
                            {props.onImport ? (
                                <>
                                    <input
                                        ref={importInput}
                                        type="file"
                                        accept=".zip,application/zip"
                                        hidden
                                        aria-label={t("导入插件 ZIP")}
                                        onChange={(event) => {
                                            const file = event.currentTarget.files?.[0];
                                            event.currentTarget.value = "";
                                            if (file) void props.onImport?.(file);
                                        }}
                                    />
                                    <Button
                                        variant="secondary"
                                        icon="plus"
                                        disabled={props.importDisabled}
                                        onClick={() => importInput.current?.click()}
                                    >
                                        {t("导入插件 ZIP")}
                                    </Button>
                                </>
                            ) : null}
                            <Button
                                icon="plus"
                                onClick={() => {
                                    setTab("plugins");
                                    setCollection("market");
                                    setQuery("");
                                }}
                            >
                                {t("添加插件")}
                            </Button>
                        </>
                    }
                />
                <ScrollArea className="work-library" viewportClassName="work-library__viewport">
                    <div className="work-library__content" data-headed="">
                        <div className="work-library__toolbar">
                            <SegmentedControl
                                aria-label={t("能力分类")}
                                value={tab}
                                onChange={setTab}
                                segments={[
                                    { value: "plugins", label: t("插件"), icon: "plugin" },
                                    { value: "skills", label: t("技能"), icon: "spark" },
                                    ...(props.connectionsVisible === false
                                        ? []
                                        : [
                                              {
                                                  value: "connections",
                                                  label: t("应用授权"),
                                                  icon: "shield" as const,
                                              },
                                          ]),
                                ]}
                            />
                            <div className="work-library__search">
                                <TextField
                                    type="search"
                                    leadingIcon="search"
                                    aria-label={t("搜索名称或用途")}
                                    placeholder={t("搜索名称或用途")}
                                    value={query}
                                    onValueChange={setQuery}
                                    fullWidth
                                />
                            </div>
                        </div>
                        {props.notices}
                        {tab === "plugins" ? (
                            <nav className="work-library__subnav" aria-label={t("插件列表")}>
                                <button
                                    type="button"
                                    aria-pressed={collection === "installed"}
                                    onClick={() => setCollection("installed")}
                                >
                                    {t("已安装")} <span>{installedCount}</span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={collection === "market"}
                                    onClick={() => setCollection("market")}
                                >
                                    {t("插件市场")} <span>{props.plugins.length}</span>
                                </button>
                            </nav>
                        ) : (
                            <div className="work-library__section-intro">
                                <h2>
                                    {tab === "skills" ? t("插件提供的技能") : t("管理应用连接")}
                                </h2>
                                <p>
                                    {tab === "skills"
                                        ? t("技能随插件一起启用。这里展示已安装插件提供的技能包。")
                                        : t("授权后，助手才能在你的许可范围内使用应用数据。")}
                                </p>
                            </div>
                        )}
                        {props.loading ? (
                            <div className="work-library__pending" role="status">
                                <Spinner size={16} />
                                {t("Reading the workspace's plugins…")}
                            </div>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon={tab === "connections" ? "link" : "plugin"}
                                title={query ? t("没有匹配的结果") : t("这里还没有内容")}
                                description={
                                    query
                                        ? t("换个名称或用途试试。")
                                        : t("到插件市场添加需要的能力，安装后会出现在这里。")
                                }
                            />
                        ) : (
                            <div className="work-library__cards">
                                {visible.map((item) =>
                                    tab === "connections" ? (
                                        item.connections.map((connection) => (
                                            <article
                                                key={`${item.id}:${connection.id}`}
                                                className="work-library__card work-library__plugin-card"
                                            >
                                                <button
                                                    type="button"
                                                    className="work-library__plugin-open"
                                                    aria-label={t("查看 {name} 的详情", {
                                                        name: item.name,
                                                    })}
                                                    onClick={(event) => {
                                                        opener.current = event.currentTarget;
                                                        setSelectedId(item.id);
                                                    }}
                                                />
                                                <div className="work-library__card-head">
                                                    <PluginMark item={item} />
                                                    <div className="work-library__naming">
                                                        <h3>{connection.name}</h3>
                                                        <span>{item.name}</span>
                                                    </div>
                                                </div>
                                                <p className="work-library__description">
                                                    {connection.error ||
                                                        (connection.connected
                                                            ? t("已授权，助手可以使用这个应用。")
                                                            : t(
                                                                  "连接你的账号，开始使用这个应用。",
                                                              ))}
                                                </p>
                                                <footer className="work-library__card-footer">
                                                    <span
                                                        className="work-library__status"
                                                        data-active={connection.connected}
                                                    >
                                                        <Icon name="dot" size={12} />
                                                        {connection.connected
                                                            ? t("已连接")
                                                            : t("未连接")}
                                                    </span>
                                                    <Button
                                                        size="small"
                                                        variant={
                                                            connection.connected
                                                                ? "ghost"
                                                                : "secondary"
                                                        }
                                                        disabled={item.disabled}
                                                        loading={item.busy}
                                                        onClick={connection.onConnect}
                                                    >
                                                        {connection.connected
                                                            ? t("Disconnect")
                                                            : t("Connect")}
                                                    </Button>
                                                </footer>
                                            </article>
                                        ))
                                    ) : (
                                        <article
                                            key={item.id}
                                            className="work-library__card work-library__plugin-card"
                                            data-compact={tab === "skills"}
                                        >
                                            <button
                                                type="button"
                                                className="work-library__plugin-open"
                                                aria-label={t("查看 {name} 的详情", {
                                                    name: item.name,
                                                })}
                                                onClick={(event) => {
                                                    opener.current = event.currentTarget;
                                                    setSelectedId(item.id);
                                                }}
                                            />
                                            <div className="work-library__card-head">
                                                <PluginMark item={item} />
                                                <div className="work-library__naming">
                                                    <h3>{item.name}</h3>
                                                    <span>
                                                        {tab === "skills"
                                                            ? t("{count} skills", {
                                                                  count: item.skills,
                                                              })
                                                            : item.version
                                                              ? `v${item.version.replace(/^v/, "")}`
                                                              : t("云端插件")}
                                                    </span>
                                                </div>
                                                {item.installed && item.onToggle ? (
                                                    <Switch
                                                        aria-label={t("启用 {name}", {
                                                            name: item.name,
                                                        })}
                                                        checked={item.enabled}
                                                        disabled={item.disabled}
                                                        onChange={item.onToggle}
                                                    />
                                                ) : null}
                                            </div>
                                            <p
                                                className="work-library__description"
                                                title={item.description}
                                            >
                                                {item.description || t("为助手扩展工作能力。")}
                                            </p>
                                            {item.notice ? (
                                                <p className="work-library__notice">
                                                    {item.notice}
                                                </p>
                                            ) : null}
                                            <footer className="work-library__card-footer">
                                                <span
                                                    className="work-library__status"
                                                    data-active={item.enabled}
                                                >
                                                    {item.busy ? (
                                                        <Spinner size={12} />
                                                    ) : (
                                                        <Icon
                                                            name={
                                                                tab === "skills" ? "spark" : "dot"
                                                            }
                                                            size={12}
                                                        />
                                                    )}
                                                    {item.status}
                                                </span>
                                                {item.installed ? (
                                                    <div className="work-library__actions">
                                                        {item.connections.length > 0 ? (
                                                            <Button
                                                                size="small"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setTab("connections");
                                                                    setQuery(item.name);
                                                                }}
                                                            >
                                                                {t("管理授权")}
                                                            </Button>
                                                        ) : null}
                                                        {item.onRemove ? (
                                                            <Button
                                                                size="small"
                                                                variant="ghost"
                                                                disabled={item.disabled}
                                                                onClick={item.onRemove}
                                                                aria-label={t("移除 {name}", {
                                                                    name: item.name,
                                                                })}
                                                            >
                                                                {t("Remove")}
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="small"
                                                        icon="plus"
                                                        variant="secondary"
                                                        disabled={item.disabled}
                                                        loading={item.busy}
                                                        onClick={item.onInstall}
                                                    >
                                                        {t("Install")}
                                                    </Button>
                                                )}
                                            </footer>
                                        </article>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            {selected ? (
                <PluginDetails
                    key={selected.id}
                    item={selected}
                    notices={props.notices}
                    onBack={() => {
                        setSelectedId(null);
                        requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
                    }}
                />
            ) : null}
        </>
    );
}

/** Full-page detail, using the same authoritative item and callbacks as its card. */
export function PluginDetails(props: {
    item: LibraryPlugin;
    notices?: ReactNode;
    onBack: () => void;
}) {
    const { item } = props;
    return (
        <ScrollArea className="work-library" viewportClassName="work-library__viewport">
            <div className="work-library__content work-library__plugin-detail">
                <div className="work-library__detail-back">
                    <Button variant="ghost" icon="reply" onClick={props.onBack} autoFocus>
                        {t("返回插件")}
                    </Button>
                </div>
                <header className="work-library__heading">
                    <div className="work-library__card-head">
                        <PluginMark item={item} />
                        <div>
                            <span className="work-library__eyebrow">{t("插件详情")}</span>
                            <h1>{item.name}</h1>
                            <span className="work-library__status" data-active={item.enabled}>
                                {item.busy ? <Spinner size={12} /> : <Icon name="dot" size={12} />}
                                {item.status}
                            </span>
                        </div>
                    </div>
                    <div className="work-library__actions">
                        {item.installed ? (
                            <>
                                {item.onToggle ? (
                                    <Button
                                        variant="secondary"
                                        disabled={item.disabled || item.busy}
                                        loading={item.busy}
                                        onClick={() => item.onToggle?.(!item.enabled)}
                                    >
                                        {item.enabled ? t("停用插件") : t("启用插件")}
                                    </Button>
                                ) : null}
                                {item.onRemove ? (
                                    <Button
                                        variant="ghost"
                                        icon="trash"
                                        disabled={item.disabled || item.busy}
                                        onClick={item.onRemove}
                                    >
                                        {t("Remove")}
                                    </Button>
                                ) : null}
                            </>
                        ) : item.onInstall ? (
                            <Button
                                icon="plus"
                                disabled={item.disabled}
                                loading={item.busy}
                                onClick={item.onInstall}
                            >
                                {t("Install")}
                            </Button>
                        ) : null}
                    </div>
                </header>
                {props.notices}
                {item.notice ? (
                    <Banner tone="neutral" title={t("使用提示")}>
                        {item.notice}
                    </Banner>
                ) : null}
                <section className="work-library__detail-section">
                    <h2>{t("插件介绍")}</h2>
                    <p className="work-library__plugin-description">
                        {item.description || t("暂时没有更详细的介绍。")}
                    </p>
                </section>
                <section className="work-library__detail-section">
                    <h2>{t("插件信息")}</h2>
                    <dl className="work-library__plugin-facts">
                        <div>
                            <dt>{t("版本")}</dt>
                            <dd>{item.version ? `v${item.version.replace(/^v/, "")}` : "—"}</dd>
                        </div>
                        <div>
                            <dt>{t("包含技能")}</dt>
                            <dd>{t("{count} skills", { count: item.skills })}</dd>
                        </div>
                        <div>
                            <dt>{t("运行位置")}</dt>
                            <dd>{item.executionLocation ?? t("云端工作空间")}</dd>
                        </div>
                        {item.servers !== undefined ? (
                            <div>
                                <dt>{t("MCP 服务")}</dt>
                                <dd>{item.servers}</dd>
                            </div>
                        ) : null}
                    </dl>
                </section>
                <section className="work-library__detail-section">
                    <h2>{item.connectionsManagedElsewhere ? t("MCP 配置") : t("应用授权")}</h2>
                    <p className="work-library__plugin-description">
                        {item.connectionsManagedElsewhere
                            ? t(
                                  "插件声明的兼容 MCP 随启用选择一起应用；需要账号授权的服务请在本机 Agent 的 MCP 设置中配置。",
                              )
                            : t("授权后，助手才能在你的许可范围内使用应用数据。")}
                    </p>
                    {item.connections.length ? (
                        item.connections.map((connection) => (
                            <div className="work-library__detail-connection" key={connection.id}>
                                <div className="work-library__naming">
                                    <h3>{connection.name}</h3>
                                    <span>{connection.connected ? t("已连接") : t("未连接")}</span>
                                    {connection.error ? (
                                        <span role="alert">{connection.error}</span>
                                    ) : null}
                                </div>
                                <Button
                                    variant="secondary"
                                    disabled={item.disabled}
                                    loading={item.busy}
                                    onClick={connection.onConnect}
                                >
                                    {connection.connected ? t("Disconnect") : t("Connect")}
                                </Button>
                            </div>
                        ))
                    ) : !item.connectionsManagedElsewhere ? (
                        <p className="work-library__plugin-description">
                            {item.installed
                                ? t("当前没有可管理的应用连接。")
                                : t("安装后可在这里查看和管理应用连接。")}
                        </p>
                    ) : null}
                </section>
            </div>
        </ScrollArea>
    );
}

function PluginMark({ item }: { item: LibraryPlugin }) {
    return (
        <span className="work-library__mark">
            {item.icon ? (
                <img src={item.icon} alt="" />
            ) : (
                <Icon name={item.skills > 0 ? "spark" : "plugin"} size={24} />
            )}
        </span>
    );
}
