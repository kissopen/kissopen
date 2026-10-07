import { useState, type CSSProperties, type ReactNode } from "react";

export interface ScrollingTextProps {
    readonly children: ReactNode;
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
}

/** Ignore sub-pixel scroll/layout rounding when deciding an edge is reached. */
const EDGE_EPSILON = 1;

/**
 * ScrollingText — one line of text that scrolls sideways instead of being cut
 * off. A command, path, or failure reason longer than its row stays reachable:
 * the reader drags or wheels the line rather than losing its tail to an
 * ellipsis.
 *
 * Whichever side still hides content carries a short alpha fade, so the line
 * reads as continuing rather than as ending mid-word, and the fade disappears
 * once that side is fully scrolled. The fade is a mask, not a coloured overlay,
 * so the row works over any surface behind it.
 */
export function ScrollingText(props: ScrollingTextProps) {
    const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({
        start: false,
        end: false,
    });
    const measure = (node: HTMLElement) => {
        const start = node.scrollLeft > EDGE_EPSILON;
        const end = node.scrollLeft + node.clientWidth < node.scrollWidth - EDGE_EPSILON;
        setEdges((current) =>
            current.start === start && current.end === end ? current : { start, end },
        );
    };
    return (
        <div
            className={["kissopen-scrolling-text", props.className].filter(Boolean).join(" ")}
            data-fade-end={edges.end ? "" : undefined}
            data-fade-start={edges.start ? "" : undefined}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"]}
            data-testid={props["data-testid"]}
            onScroll={(event) => measure(event.currentTarget)}
            ref={(node) => {
                if (!node) return undefined;
                measure(node);
                // Overflow depends on both the row's width and the text inside
                // it, and neither change is an event: the observer is the only
                // way to learn the fades no longer match what is hidden.
                const observer = new ResizeObserver(() => measure(node));
                observer.observe(node);
                const content = node.firstElementChild;
                if (content) observer.observe(content);
                return () => observer.disconnect();
            }}
            style={props.style}
        >
            <span className="kissopen-scrolling-text__content">{props.children}</span>
        </div>
    );
}
