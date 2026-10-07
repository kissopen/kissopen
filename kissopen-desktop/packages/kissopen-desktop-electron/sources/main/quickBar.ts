/*
The bar the menu bar's left button summons.

It is a window, but it is not one of the application's windows: it carries no
frame, sits above everything, takes focus only for as long as somebody is
typing into it, and leaves the moment they look away. What it holds is one
sentence on its way to the account's cloud workspace.

It stands at the bottom of whichever screen the pointer is on, inside that
screen's working area so it clears the Dock and the taskbar. Bottom rather
than centre because that is where a person's hands already are and because the
centre of a screen is where a modal goes — and this interrupts nothing.
*/
import { BrowserWindow, screen } from "electron";
import { quickBarArgument, quickBarView } from "../shared/desktopContract";

/** The bar's width, and the height it opens at before it has measured itself. */
const WIDTH = 720;
const HEIGHT = 104;
/** Clear of the Dock rather than against it. */
const BOTTOM_MARGIN = 72;

let bar: BrowserWindow | undefined;
/** The height the bar last reported, so the window is sized to it, not to a guess. */
let measured = HEIGHT;

export interface QuickBarAddress {
    /** Where the renderer is served from, in this run of this flavour. */
    readonly rendererUrl: string;
    /** Passed to the preload so it exposes the reduced bridge. */
    readonly preloadPath: string;
}

/**
 * Shows the bar, creating it the first time and reusing it after.
 *
 * Reused rather than rebuilt because building it means loading the renderer,
 * and a bar that took a second to appear would be slower than opening the
 * window it exists to save. A second summon while it is already up puts it
 * back in front, on the screen the pointer is on now.
 */
export function quickBarShow(address: QuickBarAddress): void {
    if (bar && !bar.isDestroyed()) {
        quickBarPlace(bar);
        bar.show();
        bar.focus();
        return;
    }
    /*
     * The first summon waits for the document. A transparent window shown
     * before its contents have painted is a rectangle of nothing sitting over
     * the reader's screen, which is worse than the beat it saves.
     */
    const created = quickBarCreate(address);
    bar = created;
    created.once("ready-to-show", () => {
        if (created.isDestroyed()) return;
        quickBarPlace(created);
        created.show();
        created.focus();
    });
}

/** Hides the bar, keeping it loaded for the next summon. */
export function quickBarHide(): void {
    if (bar && !bar.isDestroyed()) bar.hide();
}

/**
 * Takes the height the bar measured and sizes the window to it, keeping the
 * bar's bottom edge where it was — the window is anchored to the bottom of the
 * screen, so it grows and shrinks upward.
 *
 * Ignored when it is not a sane number: this comes from a window, and one that
 * reported zero would leave nothing on screen to type into.
 */
export function quickBarResize(height: number): void {
    if (!Number.isFinite(height) || height < 60 || height > 600) return;
    measured = Math.round(height);
    if (bar && !bar.isDestroyed()) {
        quickBarPlace(bar);
        // The shadow is computed from the window's opaque pixels, and macOS
        // does not recompute it on its own after a transparent window's
        // contents change shape.
        if (process.platform === "darwin") bar.invalidateShadow();
    }
}

/** Ends the bar for good, when the application is going away. */
export function quickBarClose(): void {
    if (bar && !bar.isDestroyed()) bar.destroy();
    bar = undefined;
}

function quickBarCreate(address: QuickBarAddress): BrowserWindow {
    const window = new BrowserWindow({
        width: WIDTH,
        height: measured,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        /*
         * The window hugs the bar exactly, and both the corners and the shadow
         * are the system's. Corners from the same mask that shapes the shadow:
         * a CSS radius under a system shadow leaves the antialiased corner
         * pixels counted as opaque, and the shadow pokes out square at all four
         * corners. Nothing inside the window paints but the dialog itself; a
         * CSS shadow would need a margin to land in, and that margin is the
         * faint block that kept showing behind it.
         */
        hasShadow: true,
        roundedCorners: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        // A panel floats above full-screen spaces on macOS, which is where a
        // bar summoned by a keystroke has to be able to appear.
        ...(process.platform === "darwin" ? { type: "panel" as const } : {}),
        webPreferences: {
            additionalArguments: [quickBarArgument],
            contextIsolation: true,
            nodeIntegration: false,
            preload: address.preloadPath,
            sandbox: true,
        },
    });
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Nothing opens from the bar, and the bar goes nowhere: one field cannot
    // navigate, and a bar that could would be a browser nobody asked for.
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const stay = (event: Electron.Event, candidate: string) => {
        if (candidate !== address.rendererUrl) event.preventDefault();
    };
    window.webContents.on("will-navigate", stay);
    window.webContents.on("will-redirect", stay);
    /*
     * Looking away dismisses it. That is the contract of a thing summoned over
     * somebody else's screen: it must never be something they have to go and
     * close. What was typed goes with it, which is why the draft is the bar's
     * own state and not saved anywhere.
     */
    window.on("blur", () => window.hide());
    window.on("closed", () => {
        bar = undefined;
    });
    void window.loadURL(address.rendererUrl).catch(() => undefined);
    return window;
}

/** Puts the bar on the screen the pointer is on, at the bottom of its work area. */
function quickBarPlace(window: BrowserWindow): void {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = display.workArea;
    window.setBounds({
        width: WIDTH,
        height: measured,
        x: Math.round(area.x + (area.width - WIDTH) / 2),
        y: Math.round(area.y + area.height - measured - BOTTOM_MARGIN),
    });
}

/**
 * The address the bar is loaded with.
 *
 * The same document the window loads, asked for the view it should mount, so
 * the first frame is already the bar rather than the application appearing for
 * a beat behind it.
 */
export function quickBarAddress(base: string): string {
    const url = new URL(base);
    url.searchParams.set(quickBarView.key, quickBarView.value);
    return url.toString();
}
