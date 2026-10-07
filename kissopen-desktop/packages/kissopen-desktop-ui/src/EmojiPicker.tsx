import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties } from "react";
import { TextField } from "./TextField";
export type EmojiItem = {
    id: string;
    char?: string;
    imageUrl?: string;
    name: string;
};
export type EmojiPickerProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    emoji: EmojiItem[];
    recent?: string[];
    query?: string;
    onQueryChange?: (value: string) => void;
    onSelect?: (id: string) => void;
    columns?: number;
    /** Search-field placeholder copy (default "Search emoji"). */
    searchPlaceholder?: string;
    /** Section label above the recent row (default "Recently used"). */
    recentLabel?: string;
    /** Section label above the full grid when a recent row is shown (default "All emoji"). */
    allLabel?: string;
    /** Message shown when the emoji list is empty (default "No emoji found"). */
    emptyLabel?: string;
};
/* Fixed square slot for every emoji, unicode or custom image (DESIGN.md: put
 * font emoji in a fixed, explicitly sized slot and keep labels separate). */
const CELL = 36;
const DEFAULT_COLUMNS = 8;
/* Card border-box = grid (columns × CELL) + 2×8 padding + 2×1 hairline. */
const CHROME = 18;
function EmojiCell(props: {
    bottomLeft?: boolean;
    bottomRight?: boolean;
    item: EmojiItem;
    onSelect?: (id: string) => void;
}) {
    return (
        <button
            aria-label={props.item.name}
            className="kissopen-emoji-picker__cell"
            data-emoji-id={props.item.id}
            data-picker-bottom-left={props.bottomLeft ? "" : undefined}
            data-picker-bottom-right={props.bottomRight ? "" : undefined}
            data-kissopen-desktop-ui="emoji-picker-cell"
            onClick={() => props.onSelect?.(props.item.id)}
            title={props.item.name}
            type="button"
        >
            <span
                className="kissopen-emoji-picker__art"
                data-kissopen-desktop-ui="emoji-picker-art"
            >
                {props.item.imageUrl ? (
                    ((url) => (
                        <img
                            alt=""
                            className="kissopen-emoji-picker__image"
                            data-kissopen-desktop-ui="emoji-picker-image"
                            draggable={false}
                            src={url}
                        />
                    ))(props.item.imageUrl)
                ) : (
                    <span
                        className="kissopen-emoji-picker__glyph"
                        data-kissopen-desktop-ui="emoji-picker-glyph"
                    >
                        {props.item.char}
                    </span>
                )}
            </span>
        </button>
    );
}
/**
 * C-043 EmojiPicker — reaction-picker popover on the raised surface. A search
 * field over an emoji grid of fixed, equal 36px slots. Every emoji (unicode
 * char or custom image) sits in the same explicitly sized art slot so the grid
 * stays perfectly regular regardless of artwork; names ride in aria-label/title
 * rather than overlapping the glyph. Props-only and fully controlled: the host
 * filters `emoji` for the current `query` and the component only renders it.
 */
export function EmojiPicker(props: EmojiPickerProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "style",
        "emoji",
        "recent",
        "query",
        "onQueryChange",
        "onSelect",
        "columns",
        "searchPlaceholder",
        "recentLabel",
        "allLabel",
        "emptyLabel",
    ]);
    const columns = () => local.columns ?? DEFAULT_COLUMNS;
    const searching = () => (local.query ?? "") !== "";
    const recentItems = () => {
        const ids = local.recent;
        if (searching() || !ids || ids.length === 0) return [];
        const byId = new Map(local.emoji.map((item) => [item.id, item]));
        return ids
            .map((id) => byId.get(id))
            .filter((item): item is EmojiItem => item !== undefined);
    };
    const hasRecent = () => recentItems().length > 0;
    const gridColumns = () => `repeat(${columns()}, ${CELL}px)`;
    const lastRowStart = () =>
        local.emoji.length === 0
            ? -1
            : Math.floor((local.emoji.length - 1) / columns()) * columns();
    const lastRowFillsGrid = () => local.emoji.length > 0 && local.emoji.length % columns() === 0;
    return (
        <div
            {...rest}
            className={["kissopen-emoji-picker", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="emoji-picker"
            style={{ ...local.style, width: `${columns() * CELL + CHROME}px` }}
        >
            <div
                className="kissopen-emoji-picker__search"
                data-kissopen-desktop-ui="emoji-picker-search"
            >
                <TextField
                    fullWidth
                    leadingIcon="search"
                    onValueChange={(value) => local.onQueryChange?.(value)}
                    placeholder={local.searchPlaceholder ?? t("Search emoji")}
                    size="small"
                    type="search"
                    value={local.query ?? ""}
                />
            </div>

            {hasRecent() ? (
                <section
                    className="kissopen-emoji-picker__section"
                    data-kissopen-desktop-ui="emoji-picker-recent-section"
                >
                    <div
                        className="kissopen-emoji-picker__label"
                        data-kissopen-desktop-ui="emoji-picker-recent-label"
                    >
                        {local.recentLabel ?? t("Recently used")}
                    </div>
                    <div
                        className="kissopen-emoji-picker__grid"
                        data-kissopen-desktop-ui="emoji-picker-recent-grid"
                        style={{ gridTemplateColumns: gridColumns() }}
                    >
                        {recentItems().map((item) => (
                            <EmojiCell key={item.id} item={item} onSelect={local.onSelect} />
                        ))}
                    </div>
                </section>
            ) : null}

            <section
                className="kissopen-emoji-picker__section"
                data-kissopen-desktop-ui="emoji-picker-all-section"
            >
                {hasRecent() ? (
                    <div
                        className="kissopen-emoji-picker__label"
                        data-kissopen-desktop-ui="emoji-picker-all-label"
                    >
                        {local.allLabel ?? t("All emoji")}
                    </div>
                ) : null}
                {local.emoji.length > 0 ? (
                    <div
                        className="kissopen-emoji-picker__grid"
                        data-kissopen-desktop-ui="emoji-picker-grid"
                        style={{ gridTemplateColumns: gridColumns() }}
                    >
                        {local.emoji.map((item, index) => (
                            <EmojiCell
                                bottomLeft={index === lastRowStart()}
                                key={item.id}
                                bottomRight={lastRowFillsGrid() && index === local.emoji.length - 1}
                                item={item}
                                onSelect={local.onSelect}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className="kissopen-emoji-picker__empty"
                        data-kissopen-desktop-ui="emoji-picker-empty"
                    >
                        {local.emptyLabel ?? t("No emoji found")}
                    </div>
                )}
            </section>
        </div>
    );
}
