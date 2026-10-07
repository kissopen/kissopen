import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The lane `AppShell` keeps as its own last child for surfaces that cover the
 * window. It is `null` wherever there is no shell — a blueprint specimen, a
 * test fixture, a surface mounted on its own — and a `WindowOverlay` then
 * simply stays where it was written.
 */
export const WindowOverlayHostContext = createContext<HTMLElement | null>(null);

/**
 * Hangs a window-covering surface off the shell rather than off whatever part
 * of the product opened it.
 *
 * A modal is written where it belongs in the product — the conversation owns
 * the viewer for its own pictures — but `--kissopen-z-overlay` only means "above
 * the app" in the stacking context the window itself is drawn in. The chat sits
 * inside a `DeferredPane` layer, which is positioned and given a z-index of its
 * own, so an overlay left in place is sealed inside that layer: the sidebar's
 * collapse control and its resize divider went on painting over a full-window
 * picture, because they are chrome of the shell and the picture was not.
 *
 * Moving the surface to the shell's own overlay lane resolves its z-index
 * against the window, which is what a modal-class surface means by "above". It
 * also puts it back inside `.kissopen-desktop-app-shell`, so the window-chrome
 * reservations — the lane held clear of the macOS traffic lights, the drag
 * regions — reach it exactly as they reach every other heading in the window.
 */
export function WindowOverlay(props: { children: ReactNode }) {
    const host = useContext(WindowOverlayHostContext);
    return host === null ? <>{props.children}</> : createPortal(props.children, host);
}
