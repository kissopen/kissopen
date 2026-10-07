import { useState, type CSSProperties } from "react";

export interface TypedTextProps {
    readonly value: string;
    /**
     * Types the first value too, not only the ones that replace it.
     *
     * A live tool row is why this exists. Whether its subject ever changes is an
     * accident of the wire: a command whose arguments streamed in arrives as a
     * series of values and types itself, while the identical command delivered
     * whole arrives once and does not — so the same act animates or not
     * depending on how the provider chunked it. A row that opts in types
     * whenever it appears, and the effect stops depending on the transport.
     *
     * Only for text appearing while the reader watches. On a surface that mounts
     * settled rows this would set every one of them typing at once.
     */
    readonly typeInitial?: boolean;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
}

/**
 * TypedText — a live label that retypes itself whenever its text changes: the
 * replacement is written out character by character in monospace, the way the
 * line it describes would have been typed by the terminal it came from.
 *
 * The text a label arrives with is never typed, unless `typeInitial` asks for
 * it. Only text that replaced earlier text animates, so opening or reloading a
 * surface does not set every settled label typing at once. The `key` remounts
 * the span for each new value, which restarts the animation, and the last
 * rendered value is compared during render so a label returning to an earlier
 * word still types.
 */
export function TypedText(props: TypedTextProps) {
    const [shown, setShown] = useState({
        value: props.value,
        typed: props.typeInitial ?? false,
    });
    if (shown.value !== props.value) setShown({ value: props.value, typed: true });
    return (
        <span
            key={props.value}
            className="kissopen-typed-text"
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"]}
            data-testid={props["data-testid"]}
            data-typing={shown.typed ? "" : undefined}
            style={
                {
                    // A label is never typed out in less than one step.
                    "--kissopen-typed-chars": Math.max(1, props.value.length),
                } as CSSProperties
            }
        >
            {props.value}
        </span>
    );
}
