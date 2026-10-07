/*
Being there when the computer is.

Scheduled tasks that run on this machine need something on it to take them,
and the daemon — which survives the app quitting — is started by nothing but
this app. So the app is a login item, and closing its window does not end it:
it goes on in the menu bar, where Quit still is for whoever wants it gone.

Registered once. A person who then turns it off in System Settings has said
something, and re-registering on every launch would be arguing with them; the
menu bar item lets them turn it back on.
*/
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { uptime } from "node:os";
import { join } from "node:path";
import { app } from "electron";

/** Passed on Windows, where a login item's arguments are honoured. */
const LOGIN_ARGUMENT = "--kissopen-login";

/** Whether the platform has login items this app can register itself as. */
export function loginItemSupported(): boolean {
    return app.isPackaged && (process.platform === "darwin" || process.platform === "win32");
}

export function loginItemEnabled(): boolean {
    if (!loginItemSupported()) return false;
    try {
        return app.getLoginItemSettings().openAtLogin;
    } catch {
        return false;
    }
}

export function loginItemSet(enabled: boolean): void {
    if (!loginItemSupported()) return;
    try {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            ...(process.platform === "win32" ? { args: [LOGIN_ARGUMENT] } : {}),
        });
    } catch {
        // The platform refused. The menu bar item reads the setting back, so
        // it will show what is actually true.
    }
}

/** Registers the login item on this machine's first run of a build that has one. */
export async function loginItemOfferOnce(): Promise<void> {
    if (!loginItemSupported()) return;
    const marker = join(app.getPath("userData"), "login-item-offered");
    if (existsSync(marker)) return;
    loginItemSet(true);
    await writeFile(marker, String(Date.now())).catch(() => undefined);
}

/**
 * Whether this launch is the login item's rather than a person's.
 *
 * A launch at login should not put a window on a desk nobody has sat down at
 * yet; the app waits in the menu bar until it is asked for. Windows says so in
 * the argument the login item was registered with. macOS 13 and later tells
 * an app nothing about why it was launched, so the nearest honest reading is
 * used: a launch within the first minutes of the machine being up is the
 * login item's. A person who opens the app that soon after booting finds it
 * in the menu bar and the Dock, one click from its window.
 */
export function launchedAtLogin(): boolean {
    if (!loginItemSupported()) return false;
    if (process.platform === "win32") return process.argv.includes(LOGIN_ARGUMENT);
    return uptime() < 180;
}
