import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export async function generateWindowsIcons(_sharp) {
    const brand = resolve(import.meta.dirname, "../../brand/icon");
    const target = resolve(
        import.meta.dirname,
        "../packages/kissopen-desktop-electron/assets/app-icon/generated",
    );
    await mkdir(target, { recursive: true });
    await copyFile(resolve(brand, "windows/kissopen.ico"), resolve(target, "app-icon.ico"));
    await copyFile(resolve(brand, "app/kissopen-icon-1024.png"), resolve(target, "app-icon.png"));
    console.log("Imported canonical KissOpen Windows icons.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await generateWindowsIcons();
