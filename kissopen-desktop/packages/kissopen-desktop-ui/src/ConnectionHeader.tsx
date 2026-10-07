import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export interface ConnectionHeaderProps {
    /**
     * What is wrong, in the window's own words. Absent means nothing is wrong
     * and the header takes no space at all.
     */
    readonly message?: string;
    /** Whether KISSOPEN is still trying. A settled failure gets no spinner. */
    readonly retrying?: boolean;
    /**
     * This band is the top edge of a desktop window that draws no title bar of
     * its own, so it inherits that title bar's two jobs: keeping clear of the
     * macOS traffic lights, which the system paints at a fixed spot regardless
     * of what is beneath them, and being draggable, because it has taken the
     * strip the window used to be dragged by.
     */
    readonly windowControls?: boolean;
    /**
     * The window is in macOS full screen, where the traffic lights are gone.
     * The band stops standing in for a title bar: it closes the space it kept
     * clear of the lights and returns to its own short height, while staying
     * draggable for the same reason every other lane does.
     */
    readonly windowFullScreen?: boolean;
}

/**
 * C-269 ConnectionHeader — the window saying it is out of touch, across its
 * whole width.
 *
 * It is a band at the very top of the window that pushes everything else down
 * rather than floating over it. That is the point: an overlay covers a corner of
 * somebody's work and can be missed, while a band that moves the window is
 * impossible to miss and takes nothing away. Losing the machine is a fact about
 * the entire window — every project, every session, every terminal in it is
 * equally out of reach — so it is stated once, at the window's edge, instead of
 * repeated onto each surface that would have to say the same thing.
 *
 * It never blocks. Everything below stays mounted, scrollable, readable, and
 * editable; only the actions that genuinely need the machine are disabled, and
 * they say so where they are. This band adds no modality of its own.
 *
 * It renders nothing when there is nothing wrong, so a healthy window is exactly
 * as tall as it ever was.
 */
export function ConnectionHeader(props: ConnectionHeaderProps) {
    if (props.message === undefined) return null;
    return (
        <div
            className="kissopen-connection-header"
            data-kissopen-desktop-ui="connection-header"
            data-testid="connection-header"
            data-window-controls={props.windowControls === true ? "" : undefined}
            data-window-full-screen={
                props.windowControls === true && props.windowFullScreen === true ? "" : undefined
            }
            // Polite, not assertive: this interrupts nothing the reader is
            // doing, and a machine that drops and returns must not talk over
            // whatever they are in the middle of.
            aria-live="polite"
            role="status"
        >
            <span className="kissopen-connection-header__icon" aria-hidden="true">
                {props.retrying === true ? <Spinner size={14} /> : <Icon name="alert" size={14} />}
            </span>
            <span className="kissopen-connection-header__label">{props.message}</span>
        </div>
    );
}
