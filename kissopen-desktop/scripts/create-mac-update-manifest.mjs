import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { desktopFlavorNames, desktopFlavorRead } from "./desktopFlavors.mjs";

/*
 * Takes the distribution to publish for, not a directory and a channel. Those
 * two used to be given separately and could name different distributions, which
 * is exactly how the nightly app ended up asking for a manifest nobody wrote.
 */
const flavorName = process.argv[2];
if (!flavorName)
    throw new Error(
        `Name the distribution to write a manifest for: ${desktopFlavorNames.join(", ")}.`,
    );
const flavor = desktopFlavorRead(flavorName);
const releaseDirectory = resolve("packages/kissopen-desktop-electron/release", flavor.output);
const version = process.env.RELEASE_VERSION ?? process.env.GITHUB_REF_NAME?.replace(/^v/u, "");
if (!version) throw new Error("Set RELEASE_VERSION or run from a v* GitHub tag.");
const channel = flavor.channel;
const names = (await readdir(releaseDirectory))
    .filter((name) =>
        ["arm64", "x64"].some((arch) =>
            ["zip", "dmg"].some(
                (extension) => name === `${flavor.artifactPrefix}-${version}-${arch}.${extension}`,
            ),
        ),
    )
    .sort();
if (names.length !== 4)
    throw new Error(
        `Expected one ZIP and one DMG for each arm64 and x64 ${flavor.productName} architecture in ${releaseDirectory}, found: ${names.join(", ")}`,
    );
const files = await Promise.all(
    names.map(async (name) => {
        const path = join(releaseDirectory, name);
        return {
            url: basename(path),
            sha512: createHash("sha512")
                .update(await readFile(path))
                .digest("base64"),
            size: (await stat(path)).size,
        };
    }),
);
const preferred = files.find((file) => file.url.endsWith("-arm64.zip"));
if (!preferred) throw new Error("The preferred arm64 update ZIP is missing.");
const yaml = [
    `version: ${version}`,
    "files:",
    ...files.flatMap((file) => [
        `  - url: ${file.url}`,
        `    sha512: ${file.sha512}`,
        `    size: ${file.size}`,
    ]),
    `path: ${preferred.url}`,
    `sha512: ${preferred.sha512}`,
    `releaseDate: ${new Date().toISOString()}`,
    `releaseName: ${flavor.productName} ${version}`,
    "",
].join("\n");
const manifest = join(releaseDirectory, `${channel}-mac.yml`);
await writeFile(manifest, yaml);
console.log(`Wrote ${manifest}.`);
