import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import {
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type HTMLAttributes,
    type ReactNode,
} from "react";
import { type AvatarType, type ToneName } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Menu, type MenuItem } from "./Menu";
export type ChannelMember = {
    initials: string;
    tone?: ToneName;
    type?: AvatarType;
};
export type ChannelHeaderProps = Omit<HTMLAttributes<HTMLElement>, "style"> & {
    actions?: ReactNode;
    agentCount?: number;
    icon?: "hash" | "spark" | "inbox" | "home";
    memberCount?: number;
    /** Overflow "⋮" menu shown at the right edge. No button renders when empty. */
    menuItems?: MenuItem[];
    menuLabel?: string;
    onMembersClick?: () => void;
    membersLabel?: string;
    onMenuSelect?: (id: string) => void;
    /** Makes the icon+title a button that opens channel/user details. */
    onTitleClick?: () => void;
    /** Star toggle shown before the title. No star renders when omitted. */
    onStarToggle?: () => void;
    starLabel?: string;
    starred?: boolean;
    style?: CSSProperties;
    title: string;
    /** Compact agent-authored content attached to the named project/workspace. */
    titleAccessory?: ReactNode;
    titleLabel?: string;
    topic?: string;
};
/**
 * 56px channel context strip at the top of the main app surface, modeled on
 * Slack: an optional leading star toggle, a clickable channel icon + title that
 * opens details, a truncating topic, and a right cluster with a member-count
 * pill, an agent chip, a free actions slot, and an overflow "⋮" menu.
 */
export function ChannelHeader(props: ChannelHeaderProps) {
    const [local, rest] = partitionComponentProps(props, [
        "actions",
        "agentCount",
        "className",
        "icon",
        "memberCount",
        "menuItems",
        "menuLabel",
        "onMembersClick",
        "membersLabel",
        "onMenuSelect",
        "onTitleClick",
        "onStarToggle",
        "starLabel",
        "starred",
        "style",
        "title",
        "titleAccessory",
        "titleLabel",
        "topic",
    ]);
    const [menuOpen, setMenuOpen] = useState(false);
    const root = useRef<HTMLElement>(null);
    const menuActions = () =>
        (local.menuItems ?? []).filter((item) => item.kind === "item").length > 0;
    const hasMenu = () => Boolean(local.onMenuSelect) && menuActions();
    // eslint-disable-next-line kissopen-react/no-layout-effect -- an open header menu owns document-level outside-click and Escape listeners that are attached after commit and completely removed when it closes
    useLayoutEffect(() => {
        if (!menuOpen) return;
        const close = (event: Event) => {
            if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        const dismiss = () => setMenuOpen(false);
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", closeOnEscape);
        window.addEventListener("resize", dismiss);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", closeOnEscape);
            window.removeEventListener("resize", dismiss);
        };
    }, [menuOpen]);
    const titleInner = (
        <>
            <span
                className="kissopen-channel-header__icon"
                data-kissopen-desktop-ui="channel-header-icon"
            >
                <Icon name={local.icon ?? "hash"} size={16} />
            </span>
            <span
                className="kissopen-channel-header__title"
                data-kissopen-desktop-ui="channel-header-title"
            >
                <span className="kissopen-channel-header__title-ink">{local.title}</span>
            </span>
        </>
    );
    return (
        <header
            {...rest}
            className={["kissopen-channel-header", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="channel-header"
            ref={root}
            style={local.style}
        >
            <div
                className="kissopen-channel-header__info"
                data-kissopen-desktop-ui="channel-header-info"
            >
                {local.onStarToggle
                    ? ((toggle) => (
                          <button
                              aria-label={local.starLabel ?? (local.starred ? "Unstar" : "Star")}
                              aria-pressed={local.starred ? "true" : "false"}
                              className="kissopen-channel-header__star"
                              data-kissopen-desktop-ui="channel-header-star"
                              data-starred={local.starred ? "" : undefined}
                              onClick={() => toggle()}
                              type="button"
                          >
                              <Icon name="star" size={16} />
                          </button>
                      ))(local.onStarToggle)
                    : null}
                {local.onTitleClick ? (
                    ((open) => (
                        <button
                            aria-label={local.titleLabel ?? `Open ${local.title} details`}
                            className="kissopen-channel-header__lead kissopen-channel-header__lead--button"
                            data-kissopen-desktop-ui="channel-header-lead"
                            onClick={() => open()}
                            type="button"
                        >
                            {titleInner}
                        </button>
                    ))(local.onTitleClick)
                ) : (
                    <h2
                        className="kissopen-channel-header__lead"
                        data-kissopen-desktop-ui="channel-header-lead"
                    >
                        {titleInner}
                    </h2>
                )}
                {local.topic ? (
                    <>
                        <span
                            aria-hidden="true"
                            className="kissopen-channel-header__dot"
                            data-kissopen-desktop-ui="channel-header-dot"
                        />
                        <span
                            className="kissopen-channel-header__topic"
                            data-kissopen-desktop-ui="channel-header-topic"
                        >
                            <span className="kissopen-channel-header__topic-ink">
                                {local.topic}
                            </span>
                        </span>
                    </>
                ) : null}
            </div>
            {local.titleAccessory ? (
                <div
                    className="kissopen-channel-header__title-accessory"
                    data-kissopen-desktop-ui="channel-header-title-accessory"
                >
                    {local.titleAccessory}
                </div>
            ) : null}
            <div
                className="kissopen-channel-header__meta"
                data-kissopen-desktop-ui="channel-header-meta"
            >
                {local.memberCount !== undefined
                    ? ((_) => {
                          const label = () =>
                              local.membersLabel ??
                              `${local.memberCount} ${local.memberCount === 1 ? "member" : "members"}`;
                          const inner = (
                              <>
                                  <Icon name="users" size={16} />
                                  <span
                                      className="kissopen-channel-header__member-count"
                                      data-kissopen-desktop-ui="channel-header-member-count"
                                  >
                                      <span className="kissopen-channel-header__member-count-ink">
                                          {local.memberCount}
                                      </span>
                                  </span>
                              </>
                          );
                          return local.onMembersClick ? (
                              ((click) => (
                                  <button
                                      aria-label={label()}
                                      className="kissopen-channel-header__members kissopen-channel-header__members--button"
                                      data-kissopen-desktop-ui="channel-header-members"
                                      onClick={() => click()}
                                      type="button"
                                  >
                                      {inner}
                                  </button>
                              ))(local.onMembersClick)
                          ) : (
                              <span
                                  className="kissopen-channel-header__members"
                                  data-kissopen-desktop-ui="channel-header-members"
                              >
                                  {inner}
                              </span>
                          );
                      })(local.memberCount !== undefined)
                    : null}
                {local.agentCount !== undefined ? (
                    <Badge
                        className="kissopen-channel-header__agents"
                        icon="spark"
                        label={local.agentCount === 1 ? "1 agent" : `${local.agentCount} agents`}
                        variant="accent"
                    />
                ) : null}
                {local.actions ? (
                    <div
                        className="kissopen-channel-header__actions"
                        data-kissopen-desktop-ui="channel-header-actions"
                    >
                        {local.actions}
                    </div>
                ) : null}
                {hasMenu() ? (
                    <div
                        className="kissopen-channel-header__menu"
                        data-kissopen-desktop-ui="channel-header-menu"
                    >
                        <Button
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            aria-label={local.menuLabel ?? t("Channel menu")}
                            icon="more"
                            iconOnly
                            onClick={() => setMenuOpen((open) => !open)}
                            size="small"
                            variant="ghost"
                        />
                        {menuOpen ? (
                            <div
                                className="kissopen-channel-header__menu-popover"
                                data-kissopen-desktop-ui="channel-header-menu-popover"
                            >
                                <Menu
                                    items={local.menuItems ?? []}
                                    onSelect={(id) => {
                                        setMenuOpen(false);
                                        local.onMenuSelect?.(id);
                                    }}
                                    width={216}
                                />
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </header>
    );
}
