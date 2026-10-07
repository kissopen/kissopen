import { app } from "electron";

/**
 * Above this the badge stops counting and says "more than this". The Dock icon
 * is small and a four-digit badge reads as a smear; past a hundred waiting
 * conversations the exact number has stopped being the useful fact anyway.
 */
const BADGE_MAXIMUM = 99;

/**
 * What macOS should print on the Dock icon for a number of waiting
 * conversations. Empty means no badge at all: nothing waiting is the absence of
 * the mark, not a circle containing a zero.
 */
export function dockBadgeText(count: number): string {
    if (!Number.isFinite(count) || count <= 0) return "";
    const whole = Math.floor(count);
    return whole > BADGE_MAXIMUM ? `${String(BADGE_MAXIMUM)}+` : String(whole);
}

/**
 * Reads a count off the one-way IPC message that carries it. A one-way channel
 * has nowhere to report a bad payload, so anything that is not a plain
 * non-negative whole number is simply not a count and is dropped.
 */
export function dockUnreadCountRead(value: unknown): number | undefined {
    if (!Number.isSafeInteger(value)) return undefined;
    const count = value as number;
    return count < 0 ? undefined : count;
}

/**
 * The text currently on the icon. The Dock is one shared object owned by the
 * process, so this is deliberately process-wide: it exists only to keep the
 * shell from asking the operating system to repaint a mark it is already
 * showing, which a live session does on nearly every reconcile.
 */
let applied = "";

/**
 * Marks the Dock icon with the number of conversations waiting for the person.
 *
 * `app.dock` is macOS-only and absent before the app is ready; either way there
 * is simply no Dock to mark, which is not a failure.
 */
export function dockBadgeApply(count: number): void {
    const text = dockBadgeText(count);
    if (text === applied) return;
    applied = text;
    try {
        app.dock?.setBadge(text);
    } catch {
        // A Dock that refuses the mark must not take the window down with it.
    }
}

/**
 * Takes the mark off. Used when the window that was reporting the count is gone,
 * so a number nobody is maintaining any more cannot sit on the icon.
 */
export function dockBadgeClear(): void {
    dockBadgeApply(0);
}
