import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
const source = resolve(import.meta.dirname, "../../brand/icon/macos");
const target = resolve(
    import.meta.dirname,
    "../packages/kissopen-desktop-electron/assets/tray/generated",
);
await mkdir(target, { recursive: true });
for (const suffix of ["", "@2x"]) {
    const from = resolve(source, `kissopen-menubarTemplate${suffix}.png`);
    await copyFile(from, resolve(target, `trayTemplate${suffix}.png`));
    // Non-template platforms use the same alpha geometry in brand Blurple.
    const { data, info } = await sharp(from)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 145;
        data[i + 1] = 132;
        data[i + 2] = 217;
    }
    await sharp(data, { raw: info })
        .png()
        .toFile(resolve(target, `tray${suffix}.png`));
}
console.log("Imported canonical KissOpen tray templates.");
