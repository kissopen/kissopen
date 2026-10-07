/*
The menu bar item: the mark, and what each of its two buttons does.

The left one summons the bar at the bottom of the screen, because the common
errand is to say something rather than to inspect anything. The right one opens
the menu, which reports: the version installed, how much of each limit is
spent, and how fresh that is.

A native menu, deliberately, for the things only a native menu has — the bar's
own material, the row highlight, the keyboard behaviour. What it costs is
layout: a menu item carries a label and an image and nothing else, so a figure
cannot be aligned right of its label and a control cannot sit inside a row.
macOS allows a custom view per item; Electron does not expose it. So the bar
under each limit is that item's image, and everything else is a label.

Windows lays the same template out differently, and two of the macOS choices
break there. Its menu keeps one icon column down the left for every row, as
wide as the widest image in the menu — so a bar drawn as an item's image widens
that column for the whole menu and pushes every label into a narrow strip at the
right. And it sizes the menu by labels alone, so a second line is cut off. On
Windows the figure therefore stays in the label with no bar under it, and what
macOS puts on a second line goes after the label on the first.

The menu is never attached with `setContextMenu`: that would claim the left
button too, and there would be nowhere left to put the bar at the bottom of the
screen.

Nothing here reaches the business API. The plan arrives from the process that
holds the credential, so the credential stays where it is.
*/
import { Menu, Tray, app, nativeImage } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { t } from "kissopen-desktop-state/i18n";
import type { Billing, UsageWindow } from "kissopen-desktop-state";
import { appVersion } from "./appVersion";
import { trayUsageBar } from "./trayUsageBar";

/**
 * Whether items can carry an image beside a label and a second line under it.
 * Only the macOS menu lays those out as intended; see the note at the top.
 */
const MENU_HAS_ROOM = process.platform === "darwin";

/**
 * A row with a word of detail: under the label where the menu has room for a
 * second line, after it on the same line where it does not.
 */
function withDetail(
    label: string,
    detail: string,
): Pick<Electron.MenuItemConstructorOptions, "label" | "sublabel"> {
    return MENU_HAS_ROOM ? { label, sublabel: detail } : { label: `${label} · ${detail}` };
}

/** What the item's own commands reach. Supplied by the process that owns them. */
export interface KissopenTrayTargets {
    /** Brings the window forward, opening one when none is open. */
    open: () => void;
    /** Summons the bar at the bottom of the screen. */
    quickBar: () => void;
    /** Ends the application, the way the Quit item in the app menu does. */
    quit: () => void;
    /** The account's plan, or nothing when there is no account to ask about. */
    billing?: () => Promise<Billing | undefined>;
    /** Whether the app starts with the computer. Absent where the platform has no such thing. */
    loginItem?: { readonly get: () => boolean; readonly set: (enabled: boolean) => void };
}

/**
 * How often the plan is re-read while the item sits there.
 *
 * The menu is built from what was last read rather than from a fresh request,
 * because a menu has to appear on the press: an item that waited for the
 * network would open late or, on a bad connection, not at all. Five minutes is
 * far finer than any of the windows it reports, whose smallest is five hours.
 */
const PLAN_INTERVAL_MS = 5 * 60 * 1000;

let tray: Tray | undefined;
let plan: Billing | undefined;
/** When the plan was last read, so the menu can say how fresh it is. */
let planReadAt = 0;

/**
 * Puts the item in the menu bar, and keeps the plan it reports current.
 *
 * Safe to call once. A second call is ignored rather than adding a second item,
 * which is the shape this kind of bug takes.
 */
export function kissopenTrayInstall(targets: KissopenTrayTargets): void {
    if (tray) return;
    const icon = trayImage();
    if (!icon) return;
    const item = new Tray(icon);
    tray = item;
    item.setToolTip("kissopen");
    // No `setContextMenu`: it would claim the left button as well.
    item.on("click", () => targets.quickBar());
    item.on("right-click", () => {
        item.popUpContextMenu(trayMenu(targets));
        // Read for the next press rather than this one. The menu is already on
        // screen; what this keeps fresh is what the press after it will show.
        void refresh(targets);
    });
    void refresh(targets);
    const timer = setInterval(() => void refresh(targets), PLAN_INTERVAL_MS);
    timer.unref();
    app.once("will-quit", () => {
        clearInterval(timer);
        item.destroy();
        tray = undefined;
    });
}

/** Re-reads the plan, so the menu opens on something recent. */
async function refresh(targets: KissopenTrayTargets): Promise<void> {
    if (!targets.billing) return;
    plan = await targets.billing().catch(() => undefined);
    planReadAt = Date.now();
}

/**
 * The mark, as the platform wants it.
 *
 * macOS is handed a template image, which it tints to match the rest of the bar
 * and inverts while the menu is open; everywhere else draws the icon as given,
 * so those get the brand's own colour. Absent artwork means no item at all
 * rather than an empty square: a build that did not generate it should look
 * like nothing was added, not like something broke.
 */
function trayImage(): Electron.NativeImage | undefined {
    const directory = join(fileDirectory(), "..", "assets", "tray", "generated");
    const name = process.platform === "darwin" ? "trayTemplate.png" : "tray.png";
    const path = join(directory, name);
    if (!existsSync(path)) return undefined;
    const image = nativeImage.createFromPath(path);
    if (image.isEmpty()) return undefined;
    // The name alone would do this on macOS, but the image is loaded by path.
    if (process.platform === "darwin") image.setTemplateImage(true);
    return image;
}

function fileDirectory(): string {
    return fileURLToPath(new URL(".", import.meta.url));
}

/** The menu, rebuilt on every press so it never shows a stale plan. */
function trayMenu(targets: KissopenTrayTargets): Menu {
    const items: Electron.MenuItemConstructorOptions[] = [
        /*
         * The whole row opens the window rather than a control inside it. A
         * row is the only thing in a menu that can be pressed, so the row is
         * what carries the action, and the version rides under it on the
         * second line macOS gives an item.
         */
        {
            ...withDetail(
                "kissopen",
                t("Version {version} · tap to open", { version: appVersion }),
            ),
            toolTip: t("Open WorPar"),
            click: () => targets.open(),
        },
        { type: "separator" },
    ];
    if (targets.billing) {
        items.push(...planItems());
        items.push(
            { type: "separator" },
            {
                ...withDetail(t("Refresh"), readAgo()),
                click: () => {
                    void refresh(targets);
                },
            },
            { type: "separator" },
        );
    }
    if (targets.loginItem) {
        const loginItem = targets.loginItem;
        items.push(
            /*
             * Here rather than in settings because this is the one control
             * about the item itself: whether it is in the menu bar before
             * anybody has opened a window. Scheduled tasks on this computer
             * depend on it, so it is on by default and one press to change.
             */
            {
                label: t("Open at login"),
                type: "checkbox",
                checked: loginItem.get(),
                click: (item) => loginItem.set(item.checked),
            },
            { type: "separator" },
        );
    }
    items.push({ label: "Quit kissopen", click: () => targets.quit() });
    return Menu.buildFromTemplate(items);
}

/**
 * How long ago the plan was read.
 *
 * Under the refresh item rather than on a line of its own, because the two
 * belong together: what a reader wants before pressing it is whether it is
 * worth pressing.
 */
function readAgo(): string {
    if (!planReadAt) return t("not read yet");
    const minutes = Math.floor((Date.now() - planReadAt) / 60_000);
    if (minutes < 1) return t("updated just now");
    if (minutes < 60) return t("updated {count}m ago", { count: String(minutes) });
    return t("updated {count}h ago", { count: String(Math.floor(minutes / 60)) });
}

/**
 * The plan and its limits, or one line saying why there are none.
 *
 * Signed out and "not read yet" are different answers and are told apart,
 * because the first is something the reader can act on and the second is
 * something they only have to wait for.
 */
function planItems(): Electron.MenuItemConstructorOptions[] {
    if (!plan) return [{ label: t("Sign in to see your plan"), enabled: false }];
    const items: Electron.MenuItemConstructorOptions[] = [
        { label: t("Plan usage · {name}", { name: plan.plan.name }), enabled: false },
    ];
    const limits = plan.windows.filter((window) => window.limit > 0);
    if (!limits.length) return [...items, { label: t("No limits on this plan"), enabled: false }];
    for (const window of limits) {
        items.push({ label: planLine(window), enabled: false });
        // The bar is its own row because an item draws its image beside the
        // label, and a bar beside words is a smudge rather than a measure.
        // Only on macOS: elsewhere an image widens the icon column of every
        // row, and the percent in the line above already says it.
        if (MENU_HAS_ROOM) {
            items.push({ label: "", icon: trayUsageBar(usedPercent(window)), enabled: false });
        }
    }
    return items;
}

/** How far into this limit the account is, as a whole percent. */
function usedPercent(window: UsageWindow): number {
    return Math.min(100, Math.round((window.used / window.limit) * 100));
}

/** One limit as a single line: a menu label cannot align a figure to its right. */
function planLine(window: UsageWindow): string {
    const percent = usedPercent(window);
    const name = windowName(window.kind);
    // A window nothing has been spent into has no reset to report, and the
    // one-time allowance never resets at all — it is spent once and gone.
    const resets =
        window.resets_at && window.kind !== "grant" ? resetIn(window.resets_at) : undefined;
    return resets ? `${name} · ${percent}% · ${resets}` : `${name} · ${percent}%`;
}

function windowName(kind: UsageWindow["kind"]): string {
    if (kind === "5h") return t("5-hour limit");
    if (kind === "week") return t("Weekly");
    if (kind === "month") return t("Monthly");
    return t("One-time allowance");
}

/**
 * How long until a window frees up, in the largest unit that still says
 * something. "resets in 4h" is what a reader checks this for; a timestamp
 * would make them do the subtraction themselves.
 *
 * `resetsAt` is milliseconds, the unit the business server computes it in.
 */
function resetIn(resetsAt: number): string | undefined {
    const minutes = Math.ceil((resetsAt - Date.now()) / 60_000);
    if (minutes <= 0) return undefined;
    if (minutes < 60) return t("resets in {count}m", { count: String(minutes) });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("resets in {count}h", { count: String(hours) });
    return t("resets in {count}d", { count: String(Math.floor(hours / 24)) });
}
