/**
 * The one description of each macOS distribution Kissopen ships.
 *
 * Every value here is needed by more than one step of a release — the builder
 * names the app with it, the updater manifest is named from it, and the upload
 * has to pick the right files — and a release only works when all of those steps
 * agree. They agreed by coincidence until they didn't: the nightly app was built
 * asking its updater for `nightly-mac.yml` while the release workflow published
 * `local-mac.yml`, so every nightly since the distribution existed silently
 * failed its update check and stayed on the version it was installed with.
 *
 * So each distribution is described once, here, and every step derives what it
 * needs rather than restating it. `channel` in particular is load-bearing:
 * electron-builder writes it into the packaged `app-update.yml`, which is the
 * name the installed app will ask for, and `releaseVerify` refuses to ship a
 * build whose packaged channel disagrees with the manifest we publish.
 */
export const desktopFlavors = {
    standard: {
        appId: "com.kissopen.opensource.desktop",
        artifactPrefix: "kissopen",
        /** electron-updater's stable release channel. */
        channel: "latest",
        updateUrl: "https://kissopen.com/downloads/desktop/stable/",
        output: "standard",
        productName: "KissOpen",
        /** Electron-updater's on-disk download cache; distinct from Nightly's. */
        updaterCacheDirName: "kissopen-oss-desktop-updater",
    },
};

/** Flavor names in the order a full release builds them. */
export const desktopFlavorNames = Object.keys(desktopFlavors);

/** Resolves one flavor by name, refusing a name no distribution answers to. */
export function desktopFlavorRead(name) {
    const flavor = desktopFlavors[name];
    if (!flavor)
        throw new Error(
            `Unknown desktop flavor "${name}". Expected one of: ${desktopFlavorNames.join(", ")}.`,
        );
    return flavor;
}
