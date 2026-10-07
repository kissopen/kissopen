import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, useCallback, useId, useRef, useState } from "react";
import type { Dimension } from "./dimensions";
import { toCssDimension } from "./dimensions";
import { Icon } from "./Icon";
import { WindowOverlay } from "./WindowOverlay";
export type SelectSize = "small" | "medium" | "large";
export type SelectOption = {
    value: string;
    label: string;
    disabled?: boolean;
};
export type SelectProps = {
    /** Accessible name for the control when no visible `label` is shown. */
    "aria-label"?: string;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    value?: string;
    onValueChange?: (value: string) => void;
    options: SelectOption[];
    label?: string;
    placeholder?: string;
    size?: SelectSize;
    disabled?: boolean;
    error?: string;
    hint?: string;
    fullWidth?: boolean;
    /* Optional, additive: give the control an explicit width or bind a form. */
    id?: string;
    name?: string;
    width?: Dimension;
};
/* Chevron affordance grows with the control but stays smaller than the field. */
const chevronSizes: Record<SelectSize, 14 | 16> = {
    small: 14,
    medium: 16,
    large: 16,
};
/** Rows the open list shows before it scrolls: 28px rows plus the 4px padding. */
const LIST_MAX_HEIGHT = 8 * 28 + 10;
const LIST_GAP = 4;
const VIEWPORT_MARGIN = 8;

/** Where the open list sits, measured from the control when it opens. */
type ListPlacement = {
    readonly left: number;
    readonly width: number;
    readonly maxHeight: number;
} & ({ readonly top: number } | { readonly bottom: number });

/**
 * C-019 Select — a styled single-select. The closed control is a measurable
 * value `<span>` and a tuned Icon chevron under a transparent trigger button;
 * the open list is the house Menu card rather than the engine's own popup,
 * which on Windows is an operating-system list that ignores the theme. The
 * list is fixed to the viewport from the control's measured box, so a
 * scrolling or clipping settings column cannot cut it off, and it opens
 * upwards when the space below is too short. Placeholder, error, hint,
 * disabled, and size are prop-driven so a fixture renders every state without
 * a store.
 */
export function Select(props: SelectProps) {
    const [local] = partitionComponentProps(props, [
        "aria-label",
        "className",
        "data-testid",
        "style",
        "value",
        "onValueChange",
        "options",
        "label",
        "placeholder",
        "size",
        "disabled",
        "error",
        "hint",
        "fullWidth",
        "id",
        "name",
        "width",
    ]);
    const [placement, setPlacement] = useState<ListPlacement | undefined>(undefined);
    const trigger = useRef<HTMLButtonElement>(null);
    const list = useRef<HTMLDivElement | null>(null);
    const listId = useId();
    const size = () => local.size ?? "medium";
    const matched = () => local.options.find((option) => option.value === local.value);
    const placeholderVisible = () => matched() === undefined && local.placeholder !== undefined;
    const displayLabel = () =>
        placeholderVisible()
            ? local.placeholder
            : (matched()?.label ?? local.options[0]?.label ?? "");
    const message = () => local.error ?? local.hint;
    // The trigger draws no text of its own, so its name carries the value too.
    const accessibleName = (): string => {
        const name = local["aria-label"] ?? local.label;
        const value = displayLabel() ?? "";
        return name === undefined ? value : `${name}: ${value}`;
    };
    const open = placement !== undefined && !local.disabled;

    const optionButtons = (): HTMLElement[] =>
        list.current
            ? [...list.current.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)')]
            : [];
    const listOpen = (): void => {
        const box = trigger.current?.getBoundingClientRect();
        if (!box || local.disabled || local.options.length === 0) return;
        const wanted = Math.min(LIST_MAX_HEIGHT, local.options.length * 28 + 10);
        const below = window.innerHeight - box.bottom - LIST_GAP - VIEWPORT_MARGIN;
        const above = box.top - LIST_GAP - VIEWPORT_MARGIN;
        const upwards = below < wanted && above > below;
        setPlacement({
            left: box.left - 1,
            width: box.width + 2,
            maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, upwards ? above : below)),
            ...(upwards
                ? { bottom: window.innerHeight - box.top + 1 + LIST_GAP }
                : { top: box.bottom + 1 + LIST_GAP }),
        });
    };
    const listClose = (returnFocus: boolean): void => {
        setPlacement(undefined);
        if (returnFocus) trigger.current?.focus();
    };
    const choose = (value: string): void => {
        listClose(true);
        if (value !== local.value) local.onValueChange?.(value);
    };
    // The list's commit is the moment its rows exist; the chosen row takes focus
    // there so arrow keys continue from the current value.
    const listRef = useCallback((node: HTMLDivElement | null): void => {
        list.current = node;
        if (!node) return;
        const rows = [...node.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)')];
        const chosen = rows.find((row) => row.getAttribute("aria-selected") === "true");
        const row = chosen ?? rows[0];
        row?.focus();
        row?.scrollIntoView({ block: "nearest" });
    }, []);

    return (
        <div
            className={["kissopen-select", local.className].filter(Boolean).join(" ")}
            data-disabled={local.disabled ? "" : undefined}
            data-error={local.error ? "" : undefined}
            data-full-width={local.fullWidth ? "" : undefined}
            data-open={open ? "" : undefined}
            data-placeholder={placeholderVisible() ? "" : undefined}
            data-kissopen-desktop-ui="select"
            data-size={size()}
            data-testid={local["data-testid"]}
            style={{
                ...local.style,
                ...(local.fullWidth
                    ? {}
                    : local.width === undefined
                      ? {}
                      : { width: toCssDimension(local.width) }),
            }}
        >
            {local.label
                ? ((label) => (
                      <label
                          className="kissopen-select__label"
                          data-kissopen-desktop-ui="select-label"
                          htmlFor={local.id}
                      >
                          {label}
                      </label>
                  ))(local.label)
                : null}
            <div className="kissopen-select__control" data-kissopen-desktop-ui="select-control">
                <span
                    aria-hidden="true"
                    className="kissopen-select__value"
                    data-placeholder={placeholderVisible() ? "" : undefined}
                    data-kissopen-desktop-ui="select-value"
                >
                    {displayLabel()}
                </span>
                <span
                    aria-hidden="true"
                    className="kissopen-select__chevron"
                    data-kissopen-desktop-ui="select-chevron"
                >
                    <Icon name="chevron-down" size={chevronSizes[size()]} />
                </span>
                <button
                    aria-controls={open ? listId : undefined}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-label={accessibleName()}
                    className="kissopen-select__trigger"
                    data-kissopen-desktop-ui="select-trigger"
                    disabled={local.disabled}
                    id={local.id}
                    name={local.name}
                    ref={trigger}
                    onClick={() => {
                        if (open) listClose(false);
                        else listOpen();
                    }}
                    onKeyDown={(event) => {
                        if (open) return;
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            listOpen();
                        }
                    }}
                    role="combobox"
                    type="button"
                    value={local.value ?? ""}
                />
            </div>
            {open ? (
                <WindowOverlay>
                    <button
                        aria-hidden="true"
                        className="kissopen-select__backdrop"
                        data-kissopen-desktop-ui="select-backdrop"
                        onClick={() => listClose(false)}
                        onWheel={() => listClose(false)}
                        tabIndex={-1}
                        type="button"
                    />
                    <div
                        className="kissopen-menu kissopen-select__list"
                        data-kissopen-desktop-ui="select-list"
                        data-size={size()}
                        id={listId}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                listClose(true);
                                return;
                            }
                            if (event.key === "Tab") {
                                listClose(false);
                                return;
                            }
                            const rows = optionButtons();
                            if (rows.length === 0) return;
                            if (event.key === "Home" || event.key === "End") {
                                event.preventDefault();
                                rows[event.key === "Home" ? 0 : rows.length - 1]?.focus();
                                return;
                            }
                            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                            event.preventDefault();
                            const at = rows.indexOf(document.activeElement as HTMLElement);
                            const step = event.key === "ArrowDown" ? 1 : -1;
                            const next =
                                at < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, at + step));
                            rows[next]?.focus();
                            rows[next]?.scrollIntoView({ block: "nearest" });
                        }}
                        ref={listRef}
                        role="listbox"
                        tabIndex={-1}
                        style={{
                            left: `${placement.left}px`,
                            width: `${placement.width}px`,
                            ...("top" in placement
                                ? { top: `${placement.top}px` }
                                : { bottom: `${placement.bottom}px` }),
                        }}
                    >
                        <div
                            className="kissopen-menu__list"
                            style={{ maxHeight: `${placement.maxHeight}px` }}
                        >
                            <div className="kissopen-menu__rows">
                                {local.options.map((option) => {
                                    const selected = option.value === local.value;
                                    return (
                                        <button
                                            aria-selected={selected}
                                            className="kissopen-menu__item kissopen-select__option"
                                            data-kissopen-desktop-ui="select-option"
                                            data-selected={selected ? "" : undefined}
                                            disabled={option.disabled}
                                            key={option.value}
                                            onClick={() => choose(option.value)}
                                            role="option"
                                            type="button"
                                        >
                                            <span className="kissopen-menu__item-label">
                                                {option.label}
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className="kissopen-select__check"
                                            >
                                                {selected ? <Icon name="check" size={14} /> : null}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </WindowOverlay>
            ) : null}
            {message()
                ? ((text) => (
                      <span
                          className="kissopen-select__message"
                          data-kissopen-desktop-ui={local.error ? "select-error" : "select-hint"}
                      >
                          {text}
                      </span>
                  ))(message())
                : null}
        </div>
    );
}
