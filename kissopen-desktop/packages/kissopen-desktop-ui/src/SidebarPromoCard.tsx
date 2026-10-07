import { t } from "kissopen-desktop-state";
import { type CSSProperties } from "react";
import { partitionComponentProps } from "./componentProps";
import { Icon, type IconName } from "./Icon";

export type SidebarPromoCardProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    icon: IconName;
    title: string;
    /** One quiet line under the title, such as what the offer is worth. */
    detail?: string;
    /** The whole card is the button: it opens what the card offers. */
    onOpen: () => void;
    /** Closes the card for good; its owner remembers that it was closed. */
    onDismiss: () => void;
};

/**
 * C-308 SidebarPromoCard — a rounded card pinned above the sidebar's footer
 * (the avatar and name) that offers one thing, such as 分享赢好礼. The card
 * opens it; the small close button at the trailing edge puts it away.
 */
export function SidebarPromoCard(props: SidebarPromoCardProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "icon",
        "title",
        "detail",
        "onOpen",
        "onDismiss",
    ]);
    return (
        <div
            className={["kissopen-sidebar-promo", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="sidebar-promo-card"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <button
                className="kissopen-sidebar-promo__open"
                data-kissopen-desktop-ui="sidebar-promo-open"
                onClick={() => local.onOpen()}
                type="button"
            >
                <span className="kissopen-sidebar-promo__icon" aria-hidden="true">
                    <Icon name={local.icon} size={18} />
                </span>
                <span className="kissopen-sidebar-promo__text">
                    <span className="kissopen-sidebar-promo__title">{local.title}</span>
                    {local.detail ? (
                        <span className="kissopen-sidebar-promo__detail">{local.detail}</span>
                    ) : null}
                </span>
            </button>
            <button
                aria-label={t("Dismiss")}
                className="kissopen-sidebar-promo__dismiss"
                data-kissopen-desktop-ui="sidebar-promo-dismiss"
                onClick={() => local.onDismiss()}
                type="button"
            >
                <Icon name="close" size={14} />
            </button>
        </div>
    );
}
