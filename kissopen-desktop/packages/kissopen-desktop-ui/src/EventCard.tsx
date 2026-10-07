import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes } from "react";
import { Badge, type BadgeVariant } from "./Badge";
import { Icon, type IconName } from "./Icon";
/* `ref` is omitted because the root is a <div> or a <button> depending on `onSelect`. */
export type EventCardProps = Omit<HTMLAttributes<HTMLElement>, "onSelect" | "ref" | "style"> & {
    badge?: {
        label: string;
        variant: BadgeVariant;
    };
    from?: string;
    icon?: IconName;
    meta?: string;
    onSelect?: () => void;
    style?: CSSProperties;
    time?: string;
    title: string;
    to?: string;
};
/**
 * Compact 44px status-transition row: icon chip, title (+ inline meta), then a
 * right-aligned `from → to` transition or a status Badge, and a mono time.
 * Renders a real <button> whenever `onSelect` is provided.
 */
export function EventCard(props: EventCardProps) {
    const [local, rest] = partitionComponentProps(props, [
        "badge",
        "className",
        "from",
        "icon",
        "meta",
        "onSelect",
        "style",
        "time",
        "title",
        "to",
    ]);
    const rootClass = () => ["kissopen-event-card", local.className].filter(Boolean).join(" ");
    const hasSide = () => Boolean((local.from && local.to) || local.badge || local.time);
    const content = () => (
        <>
            {local.icon
                ? ((name) => (
                      <span
                          className="kissopen-event-card__chip"
                          data-kissopen-desktop-ui="event-card-chip"
                      >
                          <Icon name={name} size={16} />
                      </span>
                  ))(local.icon)
                : null}
            <span className="kissopen-event-card__text" data-kissopen-desktop-ui="event-card-text">
                <span
                    className="kissopen-event-card__title"
                    data-kissopen-desktop-ui="event-card-title"
                >
                    {local.title}
                </span>
                {local.meta ? (
                    <span
                        className="kissopen-event-card__meta"
                        data-kissopen-desktop-ui="event-card-meta"
                    >
                        {local.meta}
                    </span>
                ) : null}
            </span>
            {hasSide() ? (
                <span
                    className="kissopen-event-card__side"
                    data-kissopen-desktop-ui="event-card-side"
                >
                    {local.from && local.to ? (
                        <span
                            className="kissopen-event-card__transition"
                            data-kissopen-desktop-ui="event-card-transition"
                        >
                            <span
                                className="kissopen-event-card__from"
                                data-kissopen-desktop-ui="event-card-from"
                            >
                                {local.from}
                            </span>
                            <Icon name="arrow-right" size={12} />
                            <span
                                className="kissopen-event-card__to"
                                data-kissopen-desktop-ui="event-card-to"
                            >
                                {local.to}
                            </span>
                        </span>
                    ) : local.badge ? (
                        ((badge) => <Badge label={badge.label} variant={badge.variant} />)(
                            local.badge,
                        )
                    ) : null}
                    {local.time ? (
                        <span
                            className="kissopen-event-card__time"
                            data-kissopen-desktop-ui="event-card-time"
                        >
                            {local.time}
                        </span>
                    ) : null}
                </span>
            ) : null}
        </>
    );
    return local.onSelect ? (
        <button
            {...rest}
            className={rootClass()}
            data-clickable=""
            data-kissopen-desktop-ui="event-card"
            onClick={() => local.onSelect?.()}
            style={local.style}
            type="button"
        >
            {content()}
        </button>
    ) : (
        <div
            {...rest}
            className={rootClass()}
            data-kissopen-desktop-ui="event-card"
            style={local.style}
        >
            {content()}
        </div>
    );
}
