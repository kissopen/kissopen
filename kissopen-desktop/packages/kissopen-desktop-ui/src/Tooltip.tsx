import { useId, type CSSProperties, type ReactNode } from "react";
import { partitionComponentProps } from "./componentProps";

export type TooltipPlacement = "top" | "bottom";

export interface TooltipProps {
    /** The trigger. It keeps its own box; the bubble leaves the flow entirely. */
    readonly children: ReactNode;
    readonly className?: string;
    readonly "data-testid"?: string;
    /** Bubble text. With none, the trigger renders bare and nothing wraps it. */
    readonly label?: string;
    /**
     * Forces the bubble open regardless of pointer or focus, with no delay, so
     * the revealed state is directly renderable by a blueprint fixture or test.
     */
    readonly open?: boolean;
    readonly placement?: TooltipPlacement;
    readonly style?: CSSProperties;
}

/**
 * C-179 Tooltip — the house replacement for the native `title` attribute:
 * secondary detail held behind a trigger and revealed on hover or focus.
 *
 * Hover, focus, and the dwell before the bubble appears are all owned by
 * `tooltip.css`, on the same model as the floating shortcut hint in
 * `badge.css`. That keeps the component stateless: there is no timer to leak
 * when a virtualized row unmounts under the pointer mid-scroll, and no render
 * caused by moving the mouse across a transcript.
 *
 * The bubble is an overlay anchored to the trigger, not a sibling in its row,
 * so it never changes the layout it explains. It stays in the accessibility
 * tree while hidden — invisible through `opacity`, never `visibility` — so the
 * `aria-describedby` description is announced without needing a pointer.
 * Content must still be non-essential: a trigger that is not focusable offers
 * no keyboard route to the bubble, exactly as `title` did not.
 */
export function Tooltip(props: TooltipProps) {
    const [local] = partitionComponentProps(props, [
        "children",
        "className",
        "data-testid",
        "label",
        "open",
        "placement",
        "style",
    ]);
    const bubbleId = useId();
    if (local.label === undefined) return <>{local.children}</>;
    return (
        <span
            aria-describedby={bubbleId}
            className={["kissopen-tooltip", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="tooltip"
            data-open={local.open ? "" : undefined}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            {local.children}
            <span
                className="kissopen-tooltip__bubble"
                data-kissopen-desktop-ui="tooltip-bubble"
                data-placement={local.placement ?? "top"}
                id={bubbleId}
                role="tooltip"
            >
                {local.label}
            </span>
        </span>
    );
}
