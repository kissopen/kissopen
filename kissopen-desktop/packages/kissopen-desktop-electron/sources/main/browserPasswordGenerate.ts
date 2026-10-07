import { randomBytes } from "node:crypto";
import { BrowserWindow, clipboard, dialog, type WebContents } from "electron";
import { t } from "kissopen-desktop-state/i18n";

/** User-only helper. The password never crosses IPC or enters an Agent transcript. */
export async function browserPasswordGenerate(owner: WebContents): Promise<void> {
    const window = BrowserWindow.fromWebContents(owner);
    if (!window || window.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(window, {
        type: "info",
        title: t("Generate a strong password"),
        message: t("Generate and copy a password?"),
        detail: t(
            "Paste it into the website yourself and save it in your password manager. It will not be sent to the AI or saved in chat. The clipboard copy expires after 60 seconds.",
        ),
        buttons: [t("Cancel"), t("Generate and copy")],
        defaultId: 1,
        cancelId: 0,
    });
    if (response !== 1 || owner.isDestroyed() || window.isDestroyed()) return;
    const password = `Aa9!${randomBytes(24).toString("base64url")}`;
    clipboard.writeText(password);
    setTimeout(() => {
        if (clipboard.readText() === password) clipboard.clear();
    }, 60_000).unref();
}
