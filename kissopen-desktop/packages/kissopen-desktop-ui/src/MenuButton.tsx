import { t } from "kissopen-desktop-state";
import { useCallback, useId, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { Icon, type IconName, type IconProps } from "./Icon";
import { Menu, type MenuItem } from "./Menu";

export interface MenuButtonProps {
    readonly label: string;
    readonly icon: IconName;
    /**
     * Optical size of the trigger glyph, for a name backed by the heavier of the
     * two families. An Octicons glyph is drawn across the full 16 box where an
     * Ionicons outline uses a 14 × 12 ink box, so at the button's own 14px it
     * paints visibly larger than the Ionicons buttons beside it; 12px is where
     * the two inks match. Defaults to the button's size for its own family.
     */
    readonly iconSize?: IconProps["size"];
    /** Static rows, or a catalog materialized only when the menu opens. */
    readonly items: readonly MenuItem[] | (() => readonly MenuItem[]);
    readonly onSelect: (id: string) => void;
    readonly align?: "start" | "end";
    readonly disabled?: boolean;
    /** Caps a long menu to a scrollable viewport while keeping its trigger fixed. */
    readonly menuMaxHeight?: number;
    /** Fixed heading above the menu's scrollable rows. */
    readonly menuLabel?: string;
    /** Keeps large catalogs in bounded DOM pages while leaving every row reachable. */
    readonly menuPageSize?: number;
    readonly menuWidth?: number;
    readonly size?: ButtonSize;
    readonly variant?: ButtonVariant;
    readonly "data-testid"?: string;
}

/**
 * A compact icon action with a corner-anchored Menu. It owns only whether its
 * popover is open; the caller owns every item and what choosing one means.
 */
export function MenuButton(props: MenuButtonProps) {
    const [open, setOpen] = useState(false);
    const [materializedItems, setMaterializedItems] = useState<readonly MenuItem[]>([]);
    const [menuPage, setMenuPage] = useState(0);
    const [triggerBottom, setTriggerBottom] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const expanded = open && !props.disabled;
    const triggerFocus = (): void => {
        root.current?.querySelector<HTMLElement>(":scope > button")?.focus();
    };
    const menuItems = (): HTMLElement[] =>
        root.current
            ? [...root.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]
            : [];
    // The popover's commit is the exact lifetime boundary at which its first
    // menu item exists, so focus does not depend on React's microtask ordering.
    const popoverRef = useCallback((node: HTMLDivElement | null): void => {
        node?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    }, []);
    const close = (returnFocus: boolean): void => {
        setOpen(false);
        if (returnFocus) triggerFocus();
    };
    const allItems = typeof props.items === "function" ? materializedItems : props.items;
    const pageSize =
        props.menuPageSize !== undefined && props.menuPageSize > 0
            ? Math.floor(props.menuPageSize)
            : undefined;
    const pageCount =
        pageSize === undefined ? 1 : Math.max(1, Math.ceil(allItems.length / pageSize));
    const currentPage = Math.min(menuPage, pageCount - 1);
    const pageName = props.menuLabel?.toLowerCase() ?? "items";
    const pageItems =
        pageSize === undefined
            ? allItems
            : allItems.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    const previousPageId = `${menuId}-previous-page`;
    const nextPageId = `${menuId}-next-page`;
    const visibleItems: readonly MenuItem[] = [
        ...(currentPage > 0
            ? [
                  {
                      id: previousPageId,
                      kind: "item" as const,
                      label: `Previous ${pageName} (${String(currentPage)} of ${String(pageCount)})`,
                  },
              ]
            : []),
        ...pageItems,
        ...(currentPage + 1 < pageCount
            ? [
                  {
                      id: nextPageId,
                      kind: "item" as const,
                      label: `More ${pageName} (${String(currentPage + 2)} of ${String(pageCount)})`,
                  },
              ]
            : []),
    ];
    return (
        <div
            className="kissopen-menu-button"
            data-align={props.align === "end" ? "end" : undefined}
            data-kissopen-desktop-ui="menu-button"
            data-testid={props["data-testid"]}
            ref={root}
            onKeyDown={(event) => {
                if (!expanded) return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    close(true);
                    return;
                }
                if (event.key === "Tab") {
                    close(false);
                    return;
                }
                const items = menuItems();
                if (items.length === 0) return;
                if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    items[event.key === "Home" ? 0 : items.length - 1]?.focus();
                    return;
                }
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const active = document.activeElement as HTMLElement | null;
                const at = active ? items.indexOf(active) : -1;
                const step = event.key === "ArrowDown" ? 1 : -1;
                const next = at < 0 ? (step > 0 ? 0 : items.length - 1) : at + step;
                items[(next + items.length) % items.length]?.focus();
            }}
        >
            <Button
                aria-controls={expanded ? menuId : undefined}
                aria-expanded={expanded}
                aria-haspopup="menu"
                aria-label={props.label}
                disabled={props.disabled}
                {...(props.iconSize === undefined ? { icon: props.icon } : {})}
                iconOnly
                onClick={(event) => {
                    if (expanded) close(false);
                    else {
                        setMaterializedItems(
                            typeof props.items === "function" ? props.items() : props.items,
                        );
                        setMenuPage(0);
                        setTriggerBottom(event.currentTarget.getBoundingClientRect().bottom);
                        setOpen(true);
                    }
                }}
                size={props.size ?? "small"}
                variant={props.variant ?? "ghost"}
            >
                {props.iconSize === undefined ? null : (
                    <Icon name={props.icon} size={props.iconSize} />
                )}
            </Button>
            {expanded ? (
                <>
                    <button
                        aria-label={t("Close menu")}
                        className="kissopen-menu-button__backdrop"
                        data-kissopen-desktop-ui="menu-button-backdrop"
                        onClick={() => close(true)}
                        tabIndex={-1}
                        type="button"
                    />
                    <div
                        className="kissopen-menu-button__popover"
                        data-kissopen-desktop-ui="menu-button-popover"
                        ref={popoverRef}
                    >
                        <Menu
                            id={menuId}
                            items={[...visibleItems]}
                            label={props.menuLabel}
                            onSelect={(id) => {
                                if (id === previousPageId) {
                                    setMenuPage((page) => Math.max(0, page - 1));
                                    requestAnimationFrame(() => menuItems()[0]?.focus());
                                    return;
                                }
                                if (id === nextPageId) {
                                    setMenuPage((page) => Math.min(pageCount - 1, page + 1));
                                    requestAnimationFrame(() => menuItems()[0]?.focus());
                                    return;
                                }
                                close(true);
                                props.onSelect(id);
                            }}
                            {...(props.menuMaxHeight === undefined
                                ? {}
                                : {
                                      style: {
                                          maxHeight: `max(0px, min(${String(props.menuMaxHeight)}px, calc(100vh - ${String(triggerBottom)}px - 8px)))`,
                                      },
                                  })}
                            width={props.menuWidth}
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}
