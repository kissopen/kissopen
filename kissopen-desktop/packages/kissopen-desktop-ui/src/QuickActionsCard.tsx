import { t } from "kissopen-desktop-state";
import { type CSSProperties } from "react";
import { KeyCap } from "./Badge";
import type { CommandPaletteRowEmphasis } from "./CommandPaletteResults";
import { Icon, type IconName } from "./Icon";
import { commandShortcut, type KeyboardShortcut } from "./keyboardShortcut";
import { Ionicon } from "./vectorIcons/VectorIcon";
export type QuickActionsCardItem = {
    id: string;
    /** Leading glyph. An `emphasis` takes the lane instead. */
    icon?: IconName;
    /**
     * The product's own mark for this row's kind of news, drawn exactly as the
     * palette draws it, so the preview and what K promotes it into agree.
     */
    emphasis?: CommandPaletteRowEmphasis;
    title: string;
    /** The chord that runs it. While Command is held, these keys are pressable. */
    shortcut?: KeyboardShortcut;
};
export type QuickActionsCardProps = {
    /** What the reader could do next. Cap the list at what a glance holds — six. */
    items: readonly QuickActionsCardItem[];
    /** The footer's chord (default ⌘K) and what it opens. */
    footerShortcut?: KeyboardShortcut;
    footerLabel?: string;
    className?: string;
    style?: CSSProperties;
    "data-testid"?: string;
};
const PALETTE_SHORTCUT = commandShortcut("k");
/**
 * C-274 QuickActionsCard — what holding Command puts in the middle of the
 * window: the same rows the empty palette offers, each wearing the chord that
 * runs it, over a footer saying ⌘K opens the rest.
 *
 * It wears the palette card's own frame — same width, radius, surface, and
 * shadow — so pressing K while still holding Command promotes this card into
 * the palette in the same place rather than swapping one card for another.
 *
 * It is a read-out, not a surface: `aria-hidden`, pointer-transparent, no
 * `role="dialog"` or `role="menu"`, and never hosted in a ModalOverlay. That is
 * not a style choice. `windowShortcutBlocked()` treats any of those as a modal
 * and switches every window chord off — including the held-Command detection
 * that put this card on screen and the very chords it is showing. Model it on
 * ZoomIndicator, never on Modal. It holds no timer either: the shell owns the
 * hold gesture and mounts this only while it lasts.
 */
export function QuickActionsCard(props: QuickActionsCardProps) {
    return (
        <div
            aria-hidden="true"
            className={["kissopen-quick-actions", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="quick-actions-card"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <div
                className="kissopen-quick-actions__list"
                data-kissopen-desktop-ui="quick-actions-list"
            >
                {props.items.map((item) => (
                    <div
                        className="kissopen-quick-actions__row"
                        data-kissopen-desktop-ui="quick-actions-row"
                        data-row-id={item.id}
                        key={item.id}
                    >
                        <span
                            className="kissopen-quick-actions__glyph"
                            data-emphasis={item.emphasis}
                            data-kissopen-desktop-ui="quick-actions-glyph"
                        >
                            {item.emphasis === "update" ? (
                                <Ionicon name="arrow-up-circle" size={18} />
                            ) : item.icon ? (
                                <Icon name={item.icon} size={18} />
                            ) : null}
                        </span>
                        <span
                            className="kissopen-quick-actions__title"
                            data-kissopen-desktop-ui="quick-actions-title"
                        >
                            {item.title}
                        </span>
                        {item.shortcut ? <KeyCap decorative keys={item.shortcut.caps} /> : null}
                    </div>
                ))}
            </div>
            <div
                className="kissopen-quick-actions__footer"
                data-kissopen-desktop-ui="quick-actions-footer"
            >
                <KeyCap decorative keys={(props.footerShortcut ?? PALETTE_SHORTCUT).caps} />
                <span
                    className="kissopen-quick-actions__footer-label"
                    data-kissopen-desktop-ui="quick-actions-footer-label"
                >
                    {props.footerLabel ?? t("Command palette")}
                </span>
            </div>
        </div>
    );
}
