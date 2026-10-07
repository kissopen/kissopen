import { t } from "kissopen-desktop-state";
import type { CSSProperties } from "react";
import { Button } from "./Button";
import type { MenuItem } from "./Menu";
import { MenuButton } from "./MenuButton";
import { partitionComponentProps } from "./componentProps";

export type ConversationCapsuleProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** Starts a new conversation; the left half of the capsule. */
    onCompose?: () => void;
    composeLabel?: string;
    /** What the right half opens. The caller owns every row and its meaning. */
    items: readonly MenuItem[];
    onSelect: (id: string) => void;
    menuLabel?: string;
    menuWidth?: number;
    disabled?: boolean;
};

/**
 * C-283 ConversationCapsule — the two actions a reader wants on an open
 * conversation, joined into one pill: start a new one on the left, everything
 * else behind the right. They are paired rather than left as two loose icons
 * because they are the only chrome above a conversation, and a single shape
 * reads as one control instead of two stray glyphs over the text.
 *
 * Props-only: it owns no menu state beyond what `MenuButton` needs, and knows
 * nothing about what the rows do.
 */
export function ConversationCapsule(props: ConversationCapsuleProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "onCompose",
        "composeLabel",
        "items",
        "onSelect",
        "menuLabel",
        "menuWidth",
        "disabled",
    ]);
    return (
        <div
            className={["kissopen-conversation-capsule", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="conversation-capsule"
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {local.onCompose && (
                <Button
                    aria-label={local.composeLabel ?? t("新建对话")}
                    className="kissopen-conversation-capsule__action"
                    disabled={local.disabled}
                    icon="edit"
                    iconOnly
                    onClick={local.onCompose}
                    size="small"
                    variant="ghost"
                />
            )}
            <MenuButton
                align="end"
                disabled={local.disabled}
                icon="more"
                items={local.items}
                label={t("更多")}
                {...(local.menuLabel ? { menuLabel: local.menuLabel } : {})}
                menuWidth={local.menuWidth ?? 220}
                onSelect={local.onSelect}
                size="small"
                variant="ghost"
            />
        </div>
    );
}
