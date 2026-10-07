import type { ReactElement } from "react";

/**
 * The zoom read-out, the way a browser shows one: what scale the window is now
 * at, said once at the top of the window and then gone.
 *
 * It holds no timer. The fade is a CSS animation, so a caller restarts it by
 * giving the element a `key` that changes whenever zoom is asked for — including
 * when the answer is the same number as last time, which is exactly when a
 * reader most needs to be told (⌘0 at 100%, or ⌘− against the floor).
 *
 * Hidden from assistive technology on purpose. It is a visual echo of a command
 * the reader has just issued, not a report they were waiting for; a live region
 * mounted together with its own content does not announce anyway.
 */
export function ZoomIndicator(props: { percent: number }): ReactElement {
    return (
        <div aria-hidden="true" className="kissopen-zoom-indicator">
            {props.percent}%
        </div>
    );
}
