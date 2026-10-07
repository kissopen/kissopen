// Keep release assets reproducible from the supplied, vendored KissOpen VI.
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const source = resolve(import.meta.dirname, "../../brand/icon/macos");
const target = resolve(
    import.meta.dirname,
    "../packages/kissopen-desktop-electron/assets/app-icon/generated",
);
await mkdir(target, { recursive: true });
for (const [from, to] of [
    ["KISSOPEN.icns", "app-icon.icns"],
    ["KISSOPEN.iconset/icon_512x512@2x.png", "app-icon-mac.png"],
    ["KISSOPEN.iconset/icon_512x512@2x.png", "dock-light.png"],
    ["KISSOPEN.iconset/icon_512x512@2x.png", "dock-dark.png"],
])
    await copyFile(resolve(source, from), resolve(target, to));
console.log("Imported canonical KissOpen macOS and Dock icons.");
