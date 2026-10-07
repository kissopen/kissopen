import { t } from "kissopen-desktop-state";
import { useState, type ReactNode } from "react";
import { KissopenMark } from "./KissopenMark";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Menu, type MenuItem } from "./Menu";
import { Sidebar, type SidebarItem, type SidebarSection } from "./Sidebar";

export type WebShellRailItem = {
    readonly id: string;
    readonly label: string;
    readonly icon: IconName;
};

export type WebShellList = {
    readonly title: string;
    /** The one act the column leads with — a new chat, a new project. */
    readonly action?: {
        readonly label: string;
        readonly icon: IconName;
        readonly onClick: () => void;
    };
    readonly sections: readonly SidebarSection[];
    readonly activeItemId: string;
    readonly onItemSelect: (id: string) => void;
    readonly itemMenuItems?: (item: SidebarItem) => MenuItem[];
    readonly onItemMenuSelect?: (item: SidebarItem, actionId: string) => void;
};

export type WebShellProps = {
    readonly rail: readonly WebShellRailItem[];
    readonly activeId: string;
    readonly onSelect: (id: string) => void;
    readonly account?: {
        readonly name: string;
        readonly initials: string;
        readonly imageUrl?: string;
        readonly menu: readonly MenuItem[];
        readonly onMenuSelect: (id: string) => void;
    };
    /** One offer at the top of the rail's end, such as 分享赢好礼: a glyph over its label. */
    readonly promo?: {
        readonly icon: IconName;
        readonly label: string;
        readonly onOpen: () => void;
    };
    readonly appearance: "light" | "dark";
    readonly onAppearanceToggle: () => void;
    /** The interface language; omitted where it cannot be changed. */
    readonly language?: {
        readonly value: "system" | "zh" | "en";
        readonly onChange: (value: "system" | "zh" | "en") => void;
    };
    /** The column of things in the open area: chats, projects. Absent where the area has none. */
    readonly list?: WebShellList;
    readonly children: ReactNode;
    /** A panel that belongs to what is open — a project's files — in place of the assistant's. */
    readonly panel?: ReactNode;
    /** The assistant's column: what happened, what waits, what runs. */
    readonly assistant?: ReactNode;
};

/**
 * C-302 WebShell — the PC web client's window.
 *
 * Four columns, the way a browser on a wide screen reads best: a rail of the
 * account's areas, the list of things in the open area, what is open, and the
 * assistant's column beside it. The rail never moves; the list is there only
 * where an area has one; the right column is the open thing's own panel when it
 * has one and the assistant's otherwise, and either can be put away.
 */
// Each language is named in itself, so a reader who cannot read the current
// interface can still find their own.
const LANGUAGES = [
    { id: "system", label: () => t("System") },
    { id: "zh", label: () => "中文" },
    { id: "en", label: () => "English" },
] as const;

export function WebShell(props: WebShellProps) {
    const [menuOpen, setMenuOpen] = useState<"account" | "language" | undefined>(undefined);
    const accountOpen = menuOpen === "account";
    const languageOpen = menuOpen === "language";
    const language = props.language;
    const [listHidden, setListHidden] = useState(false);
    const [asideHidden, setAsideHidden] = useState(false);
    const aside = props.panel ?? props.assistant;
    const list = props.list;
    return (
        <div className="kissopen-web-shell" data-kissopen-desktop-ui="web-shell">
            <nav className="kissopen-web-shell__rail" aria-label={t("导航")}>
                <KissopenMark className="kissopen-web-shell__mark" label={t("KissOpen")} size={30} />
                <div className="kissopen-web-shell__rail-items">
                    {props.rail.map((item) => (
                        <button
                            aria-current={item.id === props.activeId ? "page" : undefined}
                            className="kissopen-web-shell__rail-item"
                            key={item.id}
                            onClick={() => props.onSelect(item.id)}
                            title={item.label}
                            type="button"
                        >
                            <Icon name={item.icon} size={20} />
                            <span className="kissopen-web-shell__rail-label">{item.label}</span>
                        </button>
                    ))}
                </div>
                <div className="kissopen-web-shell__rail-end">
                    {props.promo && (
                        <button
                            className="kissopen-web-shell__rail-item kissopen-web-shell__rail-item--promo"
                            onClick={props.promo.onOpen}
                            title={props.promo.label}
                            type="button"
                        >
                            <Icon name={props.promo.icon} size={20} />
                            <span className="kissopen-web-shell__rail-label">
                                {props.promo.label}
                            </span>
                        </button>
                    )}
                    <button
                        aria-label={props.appearance === "dark" ? t("浅色") : t("深色")}
                        className="kissopen-web-shell__rail-item"
                        onClick={props.onAppearanceToggle}
                        title={props.appearance === "dark" ? t("浅色") : t("深色")}
                        type="button"
                    >
                        <Icon name={props.appearance === "dark" ? "sun" : "moon"} size={18} />
                    </button>
                    {language && (
                        <div className="kissopen-web-shell__account">
                            <button
                                aria-expanded={languageOpen}
                                aria-haspopup="menu"
                                aria-label={t("Language")}
                                className="kissopen-web-shell__rail-item"
                                onClick={() => setMenuOpen(languageOpen ? undefined : "language")}
                                title={t("Language")}
                                type="button"
                            >
                                <Icon name="globe" size={18} />
                            </button>
                            {languageOpen && (
                                <div
                                    className="kissopen-web-shell__scrim"
                                    onClick={() => setMenuOpen(undefined)}
                                    role="presentation"
                                />
                            )}
                            {languageOpen && (
                                <div className="kissopen-web-shell__account-menu">
                                    <Menu
                                        items={LANGUAGES.map((option) => ({
                                            kind: "item" as const,
                                            id: option.id,
                                            label: option.label(),
                                            ...(option.id === language.value
                                                ? { icon: "check" as const }
                                                : {}),
                                        }))}
                                        onSelect={(id) => {
                                            setMenuOpen(undefined);
                                            if (id !== language.value)
                                                language.onChange(id as "system" | "zh" | "en");
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {props.account && (
                        <div className="kissopen-web-shell__account">
                            <button
                                aria-expanded={accountOpen}
                                aria-haspopup="menu"
                                aria-label={props.account.name}
                                className="kissopen-web-shell__avatar"
                                onClick={() => setMenuOpen(accountOpen ? undefined : "account")}
                                title={props.account.name}
                                type="button"
                            >
                                <Avatar
                                    {...(props.account.imageUrl
                                        ? { imageUrl: props.account.imageUrl }
                                        : {})}
                                    initials={props.account.initials}
                                    size="sm"
                                    tone="ocean"
                                />
                            </button>
                            {accountOpen && (
                                <div
                                    className="kissopen-web-shell__scrim"
                                    onClick={() => setMenuOpen(undefined)}
                                    role="presentation"
                                />
                            )}
                            {accountOpen && (
                                <div className="kissopen-web-shell__account-menu">
                                    <Menu
                                        items={[...props.account.menu]}
                                        onSelect={(id) => {
                                            setMenuOpen(undefined);
                                            props.account?.onMenuSelect(id);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>
            {list && !listHidden && (
                <div className="kissopen-web-shell__list">
                    <div className="kissopen-web-shell__list-head">
                        <span className="kissopen-web-shell__list-title">{list.title}</span>
                        <Button
                            aria-label={t("收起列表")}
                            icon="sidebar-collapse"
                            iconOnly
                            onClick={() => setListHidden(true)}
                            size="small"
                            variant="ghost"
                        />
                    </div>
                    {list.action && (
                        <div className="kissopen-web-shell__list-action">
                            <Button
                                icon={list.action.icon}
                                onClick={list.action.onClick}
                                size="medium"
                                variant="secondary"
                            >
                                {list.action.label}
                            </Button>
                        </div>
                    )}
                    <Sidebar
                        activeItemId={list.activeItemId}
                        className="kissopen-web-shell__sections"
                        {...(list.itemMenuItems ? { itemMenuItems: list.itemMenuItems } : {})}
                        {...(list.onItemMenuSelect
                            ? { onItemMenuSelect: list.onItemMenuSelect }
                            : {})}
                        onItemSelect={list.onItemSelect}
                        sections={[...list.sections]}
                    />
                </div>
            )}
            <main className="kissopen-web-shell__content">
                {list && listHidden && (
                    <Button
                        aria-label={t("展开列表")}
                        className="kissopen-web-shell__reopen kissopen-web-shell__reopen--list"
                        icon="sidebar-expand"
                        iconOnly
                        onClick={() => setListHidden(false)}
                        size="small"
                        variant="ghost"
                    />
                )}
                {aside && asideHidden && (
                    <Button
                        aria-label={t("展开右栏")}
                        className="kissopen-web-shell__reopen kissopen-web-shell__reopen--aside"
                        icon="panel-expand"
                        iconOnly
                        onClick={() => setAsideHidden(false)}
                        size="small"
                        variant="ghost"
                    />
                )}
                {props.children}
            </main>
            {aside && !asideHidden && (
                <aside
                    className="kissopen-web-shell__aside"
                    data-panel={props.panel ? "" : undefined}
                >
                    <Button
                        aria-label={t("收起右栏")}
                        className="kissopen-web-shell__aside-close"
                        icon="panel-collapse"
                        iconOnly
                        onClick={() => setAsideHidden(true)}
                        size="small"
                        variant="ghost"
                    />
                    {aside}
                </aside>
            )}
        </div>
    );
}
