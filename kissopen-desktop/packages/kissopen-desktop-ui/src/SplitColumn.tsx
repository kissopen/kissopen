import { useRef, useState, type CSSProperties, type ReactNode } from "react";

const HANDLE_HEIGHT = 8;
const DEFAULT_BOTTOM_HEIGHT = 320;
const DEFAULT_MIN_HEIGHT = 120;
const KEYBOARD_STEP = 16;

export interface SplitColumnProps {
    /** The upper region. It takes whatever height the lower one leaves. */
    top: ReactNode;
    /** The lower region, whose height the divider owns. */
    bottom: ReactNode;
    /** Starting height of the lower region, clamped on first drag. */
    defaultBottomHeight?: number;
    minTopHeight?: number;
    minBottomHeight?: number;
    resizeLabel?: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(min, value), Math.max(min, max));
}

/**
 * Two stacked regions separated by a draggable horizontal divider. The lower
 * region's height is the boundary — the upper one absorbs the rest — because the
 * lower region here holds fixed-cell content (a terminal grid) whose useful size
 * a user sets deliberately, while the upper one is a list that reads fine at any
 * height.
 *
 * The height is local UI state, like the shell's own splitters: it is a property
 * of the window the user arranged, not product state, and callers stay props-only.
 * Both minimums are honoured against the live container height, so shrinking the
 * window never leaves one region with nothing.
 */
export function SplitColumn(props: SplitColumnProps) {
    const root = useRef<HTMLDivElement>(null);
    const bottom = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointerY: number; height: number } | null>(null);
    const minTop = props.minTopHeight ?? DEFAULT_MIN_HEIGHT;
    const minBottom = props.minBottomHeight ?? DEFAULT_MIN_HEIGHT;
    const [bottomHeight, bottomHeightSet] = useState(
        props.defaultBottomHeight ?? DEFAULT_BOTTOM_HEIGHT,
    );
    /** The tallest the lower region may be in the box the parent gives us now. */
    function maxBottom(): number {
        const available = root.current?.getBoundingClientRect().height ?? 0;
        return Math.max(minBottom, available - HANDLE_HEIGHT - minTop);
    }
    /**
     * What the lower region is actually painting. CSS clamps the stored height
     * against the live container, so a resize starts from the rendered box rather
     * than from a stale number the window has since made impossible.
     */
    function rendered(): number {
        return bottom.current?.getBoundingClientRect().height ?? bottomHeight;
    }
    function apply(height: number) {
        bottomHeightSet(clamp(Math.round(height), minBottom, maxBottom()));
    }
    return (
        <div
            className="kissopen-split-column"
            data-kissopen-desktop-ui="split-column"
            ref={root}
            style={
                {
                    "--kissopen-split-column-min-top": `${minTop}px`,
                    "--kissopen-split-column-min-bottom": `${minBottom}px`,
                } as CSSProperties
            }
        >
            <div className="kissopen-split-column__top" data-kissopen-desktop-ui="split-column-top">
                {props.top}
            </div>
            <div
                aria-label={props.resizeLabel ?? "Resize"}
                aria-orientation="horizontal"
                aria-valuemin={minBottom}
                aria-valuenow={Math.round(bottomHeight)}
                className="kissopen-split-column__handle"
                data-kissopen-desktop-ui="split-column-handle"
                onKeyDown={(event) => {
                    const delta =
                        event.key === "ArrowUp"
                            ? KEYBOARD_STEP
                            : event.key === "ArrowDown"
                              ? -KEYBOARD_STEP
                              : undefined;
                    if (delta !== undefined) {
                        event.preventDefault();
                        apply(rendered() + delta);
                    } else if (event.key === "Home") {
                        event.preventDefault();
                        apply(minBottom);
                    } else if (event.key === "End") {
                        event.preventDefault();
                        apply(maxBottom());
                    }
                }}
                onLostPointerCapture={() => {
                    drag.current = null;
                }}
                onPointerCancel={() => {
                    drag.current = null;
                }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    drag.current = { pointerY: event.clientY, height: rendered() };
                    try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                        // Synthetic or already-released pointers cannot be captured; the
                        // move handler still works when events target this element.
                    }
                }}
                onPointerMove={(event) => {
                    const start = drag.current;
                    if (!start) return;
                    // Dragging the divider up grows the lower region.
                    apply(start.height + (start.pointerY - event.clientY));
                }}
                onPointerUp={(event) => {
                    drag.current = null;
                    try {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    } catch {
                        // Capture may already be lost; clearing drag state above is enough.
                    }
                }}
                role="separator"
                // A focusable window splitter is an intentionally interactive separator
                // (WAI-ARIA window-splitter pattern): it must take keyboard focus so the
                // Arrow/Home/End resize keys above are reachable without a pointer.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable resize separator
                tabIndex={0}
            >
                <span
                    className="kissopen-split-column__line"
                    data-kissopen-desktop-ui="split-column-line"
                />
            </div>
            <div
                className="kissopen-split-column__bottom"
                data-kissopen-desktop-ui="split-column-bottom"
                ref={bottom}
                style={{ height: `${bottomHeight}px` } as CSSProperties}
            >
                {props.bottom}
            </div>
        </div>
    );
}
