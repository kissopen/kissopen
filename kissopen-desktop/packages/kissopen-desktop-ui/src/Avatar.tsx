import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type HTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
export type AvatarSize = "xs" | "sm" | "md" | "lg";
export type AvatarType = "human" | "agent";
export type ToneName = "violet" | "ember" | "mint" | "ocean" | "rose" | "amber" | "slate" | "brand";
export type AvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, "style"> & {
    /**
     * Marks an entity that is named by a symbol rather than by a person or a
     * picture — the home project, say. It replaces the initials, and an
     * `imageUrl` still wins over it.
     */
    icon?: IconName;
    /** Uses the Kissopen brand image selected by the surrounding theme. */
    imageTheme?: "brand";
    imageUrl?: string;
    initials: string;
    online?: boolean;
    size?: AvatarSize;
    style?: CSSProperties;
    tone?: ToneName;
    type?: AvatarType;
};
/** Glyph size per avatar box, leaving the tile's ink inset on every size. */
const iconSize = { xs: 12, sm: 16, md: 18, lg: 20 } as const satisfies Record<AvatarSize, number>;
export function Avatar(props: AvatarProps) {
    const [local, rest] = partitionComponentProps(props, [
        "children",
        "className",
        "icon",
        "imageTheme",
        "imageUrl",
        "initials",
        "online",
        "size",
        "style",
        "tone",
        "type",
    ]);
    const size = () => local.size ?? "md";
    const type = () => local.type ?? "human";
    const tone = () => local.tone ?? "slate";
    return (
        <span
            {...rest}
            className={["kissopen-avatar", local.className].filter(Boolean).join(" ")}
            data-image={local.imageUrl ? "" : undefined}
            data-image-theme={local.imageTheme}
            data-kissopen-desktop-ui="avatar"
            data-size={size()}
            data-tone={tone()}
            data-type={type()}
            style={local.style}
            role={props["aria-label"] ? "img" : undefined}
            aria-hidden={props["aria-label"] ? undefined : "true"}
        >
            {local.imageUrl ? (
                <img
                    className={[
                        "kissopen-avatar__image",
                        local.imageTheme === "brand" ? "kissopen-brand-logo" : undefined,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    data-kissopen-desktop-ui="avatar-image"
                    src={local.imageUrl}
                    alt=""
                    draggable={false}
                />
            ) : local.icon ? (
                <span className="kissopen-avatar__glyph" data-kissopen-desktop-ui="avatar-glyph">
                    <Icon name={local.icon} size={iconSize[size()]} />
                </span>
            ) : (
                <span
                    className="kissopen-avatar__initials"
                    data-kissopen-desktop-ui="avatar-initials"
                >
                    {local.initials}
                </span>
            )}
            {local.online && (
                <span
                    className="kissopen-avatar__presence"
                    data-kissopen-desktop-ui="avatar-presence"
                    aria-hidden="true"
                />
            )}
        </span>
    );
}
