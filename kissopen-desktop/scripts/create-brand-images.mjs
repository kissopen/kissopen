import { copyFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const workspace = resolve(import.meta.dirname, "..");
const ui = resolve(workspace, "packages/kissopen-desktop-ui/src/assets/brand");
const imports = [
    ["svg/kissopen-mark-accent.svg", resolve(ui, "kissopen-mark.svg")],
    ["svg/kissopen-mark-light.svg", resolve(ui, "kissopen-mark-white.svg")],
    ["svg/kissopen-mark-accent.svg", resolve(ui, "kissopen-glyph.svg")],
    ["icon/mark-accent/kissopen-mark-accent-512.png", resolve(ui, "logo-black.png")],
    ["icon/mark-accent/kissopen-mark-accent-512.png", resolve(ui, "logo-white.png")],
    ["icon/mark-accent/kissopen-mark-accent-512.png", resolve(ui, "kissopen-logo.png")],
    ["lockup/svg/kissopen-lockup-horizontal-inverse.svg", resolve(ui, "lockup-light.svg")],
    ["lockup/svg/kissopen-lockup-horizontal-primary.svg", resolve(ui, "lockup-dark.svg")],
    [
        "icon/web/android-chrome-192x192.png",
        resolve(workspace, "packages/kissopen-desktop-electron/public/favicon.png"),
    ],
    [
        "icon/web/android-chrome-192x192.png",
        resolve(workspace, "packages/kissopen-desktop-web/public/favicon.png"),
    ],
    [
        "icon/macos/KISSOPEN.iconset/icon_512x512@2x.png",
        resolve(workspace, ".github/logo-light.png"),
    ],
    [
        "icon/macos/KISSOPEN.iconset/icon_512x512@2x.png",
        resolve(workspace, ".github/logo-dark.png"),
    ],
    [
        "lockup/png/kissopen-lockup-horizontal-inverse-1536.png",
        resolve(workspace, ".github/logotype-light.png"),
    ],
    [
        "lockup/png/kissopen-lockup-horizontal-primary-1536.png",
        resolve(workspace, ".github/logotype-dark.png"),
    ],
];
for (const [source, target] of imports) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, "brand", source), target);
}
console.log("Imported canonical KissOpen lockups and UI images.");
