import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { desktopFlavorNames, desktopFlavorRead } from "./desktopFlavors.mjs";

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)));
const desktopDirectory = join(workspace, "packages", "kissopen-desktop-electron");
const require = createRequire(join(desktopDirectory, "package.json"));
const { Arch, Platform, build } = require("electron-builder");
const packageJson = JSON.parse(await readFile(join(desktopDirectory, "package.json"), "utf8"));
const releaseVersion = process.env.RELEASE_VERSION ?? packageJson.version;
if (!/^\d+\.\d+\.\d+(?:-preview\.(?:0|[1-9]\d*))?$/u.test(releaseVersion))
    throw new Error("RELEASE_VERSION must be a stable or numbered preview version.");
packageJson.version = releaseVersion;
const localWebOrigin = "https://local.app.happy.engineering";
const flavor = argument("--flavor", ["all", ...desktopFlavorNames], "all");
const architecture = argument("--arch", ["all", "arm64", "x64"], "all");
const flavors = flavor === "all" ? desktopFlavorNames : [flavor];
const architectures = architecture === "all" ? ["arm64", "x64"] : [architecture];

if (process.platform !== "darwin")
    throw new Error("Signed Kissopen macOS releases must be built on macOS.");
releaseEnvironmentValidate();
await keychainSigningIdentityValidate();
await keychainNotarizationCredentialsValidate();

await run("pnpm", ["desktop:assets"]);
await run("pnpm", ["--dir", "packages/kissopen-desktop-electron", "typecheck"]);

for (const selectedFlavorName of flavors) {
    const selectedFlavor = desktopFlavorRead(selectedFlavorName);
    await rm(join(desktopDirectory, "dist"), { force: true, recursive: true });
    const environment =
        selectedFlavorName === "local-web"
            ? {
                  KISSOPEN_DESKTOP_FLAVOR: "local-web",
                  KISSOPEN_LOCAL_WEB_ORIGIN: localWebOrigin,
              }
            : { KISSOPEN_DESKTOP_FLAVOR: "standard", KISSOPEN_LOCAL_WEB_SITE: "0" };
    if (selectedFlavorName === "standard") await viteBuild("vite.config.ts");
    await viteBuild("vite.main.config.ts", environment);
    await viteBuild("vite.preload.config.ts");

    const staging = join("release", ".staging", selectedFlavorName);
    await rm(join(desktopDirectory, staging), { force: true, recursive: true });
    await run("pnpm", [
        "--config.node-linker=hoisted",
        "--os",
        "darwin",
        ...architectures.flatMap((value) => ["--cpu", value]),
        "--filter",
        "kissopen-desktop-electron",
        "deploy",
        "--legacy",
        "--prod",
        join("packages", "kissopen-desktop-electron", staging),
    ]);
    await stagedPackagePrepare(join(desktopDirectory, staging, "package.json"), selectedFlavor);
    const output = join("release", selectedFlavor.output);
    await rm(join(desktopDirectory, output), { force: true, recursive: true });
    await mkdir(join(desktopDirectory, output), { recursive: true });
    const config = builderConfiguration(
        packageJson.build,
        output,
        staging,
        selectedFlavorName,
        selectedFlavor,
    );
    try {
        await build({
            config,
            projectDir: join(desktopDirectory, staging),
            publish: "never",
            targets: Platform.MAC.createTarget(
                ["dmg", "zip"],
                ...architectures.map((value) => (value === "arm64" ? Arch.arm64 : Arch.x64)),
            ),
        });
    } finally {
        await rm(join(desktopDirectory, staging), { force: true, recursive: true });
    }
    await releaseVerify(selectedFlavor, output);
    if (architectures.length === 2)
        await run(
            process.execPath,
            ["scripts/create-mac-update-manifest.mjs", selectedFlavorName],
            {
                RELEASE_VERSION: packageJson.version,
            },
        );
}

console.log(
    `Built, signed, notarized, stapled, and verified ${flavors.join(", ")} for ${architectures.join(", ")}.`,
);

function builderConfiguration(base, output, app, flavorName, selectedFlavor) {
    const buildResources = join(desktopDirectory, "build");
    const entitlements = join(buildResources, "entitlements.mac.plist");
    const icon = join(desktopDirectory, "assets", "app-icon", "generated", "app-icon.icns");
    return {
        ...structuredClone(base),
        appId: selectedFlavor.appId,
        productName: selectedFlavor.productName,
        artifactName: `${selectedFlavor.artifactPrefix}-\${version}-\${arch}.\${ext}`,
        forceCodeSigning: true,
        beforeBuild: () => false,
        afterPack: (context) => bundledAgentSign(context, selectedFlavor, entitlements),
        electronVersion: packageJson.devDependencies.electron.replace(/^\D+/u, ""),
        directories: {
            buildResources,
            output: join(desktopDirectory, output),
        },
        extraResources: [
            ...(base.extraResources ?? []).map((resource) => ({
                ...resource,
                from: resolve(desktopDirectory, resource.from),
            })),
            {
                from: join(workspace, "LICENSE"),
                to: "licenses/DESKTOP-LICENSE.txt",
            },
            {
                from: join(workspace, "packages/kissopen-desktop-ui/src/assets/animations/LICENSE"),
                to: "licenses/ANIMATIONS-LICENSE.txt",
            },
            {
                from: join(desktopDirectory, app, "source-receipt.json"),
                to: "source-receipt.json",
            },
            {
                from: join(desktopDirectory, app, "node_modules"),
                to: "node_modules",
                filter: [
                    "**/*",
                    "!.pnpm{,/**/*}",
                    "!.modules.yaml",
                    "!.pnpm-workspace-state-v1.json",
                    "!.bin{,/**/*}",
                    // These linked workspace libraries are already bundled by Vite.
                    "!@kissopen{,/**/*}",
                ],
            },
        ],
        ...(flavorName === "local-web"
            ? {
                  files: [
                      "dist/main.js",
                      "dist/preload.cjs",
                      "assets/app-icon/generated/app-icon.png",
                      "package.json",
                  ],
              }
            : {}),
        mac: {
            ...base.mac,
            // The engine is signed in afterPack before its checksum is written.
            // Re-signing it here would invalidate the checksum used on first launch.
            signIgnore: [
                ...(base.mac.signIgnore ?? []),
                "/Contents/Resources/kissopen-agent/kissopen-agent$",
            ],
            entitlements,
            entitlementsInherit: entitlements,
            icon,
        },
        publish: { ...structuredClone(base.publish), channel: selectedFlavor.channel },
    };
}

async function bundledAgentVerify(directory, architecture) {
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    const binary = join(directory, "kissopen-agent");
    const sha256 = createHash("sha256")
        .update(await readFile(binary))
        .digest("hex");
    if (
        manifest.platform !== "darwin" ||
        manifest.arch !== architecture ||
        manifest.sha256 !== sha256
    )
        throw new Error(
            `Bundled agent platform, architecture, or checksum mismatch in ${directory}.`,
        );
    return { manifest, binary };
}

async function bundledAgentSign(context, selectedFlavor, entitlements) {
    const directory = join(
        context.appOutDir,
        `${selectedFlavor.productName}.app`,
        "Contents",
        "Resources",
        "kissopen-agent",
    );
    const { manifest, binary } = await bundledAgentVerify(directory, Arch[context.arch]);
    const packager = context.packager;
    const keychainFile = (await packager.codeSigningInfo.value).keychainFile;
    const options = packager.platformSpecificBuildOptions;
    const identity = await packager.helper.findSigningIdentity(
        false,
        false,
        options.identity,
        keychainFile,
        options,
    );
    if (!identity?.name.startsWith("Developer ID Application:"))
        throw new Error("Bundled agent signing requires a Developer ID Application identity.");
    await run("codesign", [
        "--force",
        "--sign",
        identity.hash ?? identity.name,
        "--timestamp",
        "--options",
        "runtime",
        "--entitlements",
        entitlements,
        ...(keychainFile ? ["--keychain", keychainFile] : []),
        binary,
    ]);
    await run("codesign", ["--verify", "--strict", "--verbose=2", binary]);
    manifest.sha256 = createHash("sha256")
        .update(await readFile(binary))
        .digest("hex");
    await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/*
 * Reads back what was actually packaged, because the updater is configured in one
 * place and consumed in another and only the built app says which one won.
 *
 * It confirms the app asks for the manifest and updater cache this flavor
 * declares. It does not inspect the published manifest, which is written later in
 * the release job; that file no longer disagreeing is a property of both sides
 * reading `desktopFlavors.mjs` rather than something checked here.
 */
async function releaseVerify(selectedFlavor, output) {
    const releaseDirectory = join(desktopDirectory, output);
    for (const selectedArchitecture of architectures) {
        const applicationDirectory = selectedArchitecture === "arm64" ? "mac-arm64" : "mac";
        const application = join(
            releaseDirectory,
            applicationDirectory,
            `${selectedFlavor.productName}.app`,
        );
        const dmg = join(
            releaseDirectory,
            `${selectedFlavor.artifactPrefix}-${packageJson.version}-${selectedArchitecture}.dmg`,
        );
        const updaterConfigurationPath = join(
            application,
            "Contents",
            "Resources",
            "app-update.yml",
        );
        const updaterConfiguration = parse(await readFile(updaterConfigurationPath, "utf8"));
        const packagedLicense = await readFile(
            join(application, "Contents", "Resources", "licenses", "DESKTOP-LICENSE.txt"),
            "utf8",
        );
        if (packagedLicense !== (await readFile(join(workspace, "LICENSE"), "utf8")))
            throw new Error("The packaged desktop license does not match its upstream notice.");
        if (updaterConfiguration.url !== selectedFlavor.updateUrl)
            throw new Error("The open-source package contains an unexpected update origin.");
        const bundleId = await commandOutput("/usr/libexec/PlistBuddy", [
            "-c",
            "Print :CFBundleIdentifier",
            join(application, "Contents", "Info.plist"),
        ]);
        const bundleVersion = await commandOutput("/usr/libexec/PlistBuddy", [
            "-c",
            "Print :CFBundleShortVersionString",
            join(application, "Contents", "Info.plist"),
        ]);
        if (bundleId.trim() !== selectedFlavor.appId || bundleVersion.trim() !== releaseVersion)
            throw new Error("The packaged application identity or version is incorrect.");
        const packagedManifest = `${String(updaterConfiguration.channel)}-mac.yml`;
        const publishedManifest = `${selectedFlavor.channel}-mac.yml`;
        if (packagedManifest !== publishedManifest)
            throw new Error(
                `${updaterConfigurationPath} requests ${packagedManifest}, but this flavor publishes ${publishedManifest}.`,
            );
        if (updaterConfiguration.updaterCacheDirName !== selectedFlavor.updaterCacheDirName)
            throw new Error(
                `${updaterConfigurationPath} uses updater cache ${String(updaterConfiguration.updaterCacheDirName)}, expected ${selectedFlavor.updaterCacheDirName}.`,
            );
        const { binary } = await bundledAgentVerify(
            join(application, "Contents", "Resources", "kissopen-agent"),
            selectedArchitecture,
        );
        await run("codesign", ["--verify", "--strict", "--verbose=2", binary]);
        await run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", application]);
        await run("xcrun", ["stapler", "validate", application]);
        await run("spctl", ["--assess", "--type", "execute", "--verbose=4", application]);
        await run("hdiutil", ["verify", dmg]);
    }
}

async function stagedPackagePrepare(path, selectedFlavor) {
    const metadata = JSON.parse(await readFile(path, "utf8"));
    metadata.version = releaseVersion;
    delete metadata.dependencies["@kissopen/kissopen-agent-client"];
    delete metadata.dependencies["@kissopen/kissopen-sync"];
    delete metadata.build;
    delete metadata.devDependencies;
    const updaterSuffix = "-updater";
    if (!selectedFlavor.updaterCacheDirName.endsWith(updaterSuffix))
        throw new Error(
            `Updater cache ${selectedFlavor.updaterCacheDirName} must end in ${updaterSuffix}.`,
        );
    // electron-builder derives updaterCacheDirName by appending `-updater` to
    // the staged package name. Each distribution therefore needs its own name
    // here even though both are built from the same source package.
    metadata.name = selectedFlavor.updaterCacheDirName.slice(0, -updaterSuffix.length);
    await writeFile(path, `${JSON.stringify(metadata, null, 4)}\n`);
    const extraction = JSON.parse(await readFile(join(workspace, "..", "EXTRACTION.json"), "utf8"));
    const lock = JSON.parse(
        await readFile(join(workspace, "..", "agent-artifacts.lock.json"), "utf8"),
    );
    const receipt = {
        product: "kissopen",
        version: releaseVersion,
        appId: selectedFlavor.appId,
        extractedSourceCommit: extraction.sourceCommit,
        sourceState: "local-uncommitted-extraction",
        published: false,
        agentVersion: lock.agentVersion,
        agentArtifactManifestSha256: lock.manifestSha256,
        compiledMainSha256: createHash("sha256")
            .update(await readFile(join(dirname(path), "dist", "main.js")))
            .digest("hex"),
    };
    await writeFile(
        join(dirname(path), "source-receipt.json"),
        `${JSON.stringify(receipt, null, 2)}\n`,
    );
}

function commandOutput(command, arguments_) {
    return new Promise((resolvePromise, reject) => {
        execFile(command, arguments_, { encoding: "utf8" }, (error, stdout) =>
            error ? reject(error) : resolvePromise(stdout),
        );
    });
}

function releaseEnvironmentValidate() {
    const appleIdNames = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
    const apiKeyNames = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
    const keychainNames = ["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"];
    const appleIdReady = appleIdNames.every((name) => Boolean(process.env[name]));
    const apiKeyReady = apiKeyNames.every((name) => Boolean(process.env[name]));
    const keychainReady = keychainNames.every((name) => Boolean(process.env[name]));
    if (!appleIdReady && !apiKeyReady && !keychainReady)
        throw new Error(
            `Set one complete notarization environment: ${apiKeyNames.join(", ")} (recommended), ${appleIdNames.join(", ")}, or ${keychainNames.join(", ")}.`,
        );
    const cscLink = Boolean(process.env.CSC_LINK);
    const cscPassword = Boolean(process.env.CSC_KEY_PASSWORD);
    if (cscLink !== cscPassword)
        throw new Error("Set both CSC_LINK and CSC_KEY_PASSWORD, or neither for Keychain signing.");
}

async function keychainNotarizationCredentialsValidate() {
    if (process.env.APPLE_ID || process.env.APPLE_APP_SPECIFIC_PASSWORD) return;
    if (process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_ID || process.env.APPLE_API_ISSUER)
        return;
    await new Promise((resolvePromise, reject) => {
        execFile(
            "xcrun",
            [
                "notarytool",
                "history",
                "--keychain-profile",
                process.env.APPLE_KEYCHAIN_PROFILE,
                "--keychain",
                process.env.APPLE_KEYCHAIN,
                "--output-format",
                "json",
            ],
            { encoding: "utf8" },
            (error) => {
                if (error)
                    reject(
                        new Error(
                            `Keychain notarization credentials could not be validated: ${error.message}`,
                        ),
                    );
                else resolvePromise();
            },
        );
    });
}

async function keychainSigningIdentityValidate() {
    if (process.env.CSC_LINK) return;
    const result = await new Promise((resolvePromise, reject) => {
        execFile(
            "security",
            ["find-identity", "-v", "-p", "codesigning"],
            { encoding: "utf8" },
            (error, stdout) => {
                if (error) reject(error);
                else resolvePromise(stdout);
            },
        );
    });
    if (!result.includes("Developer ID Application:"))
        throw new Error(
            "No Developer ID Application identity is installed; set CSC_LINK or import it into Keychain.",
        );
}

function argument(name, allowed, fallback) {
    const prefix = `${name}=`;
    const inline = process.argv.find((value) => value.startsWith(prefix));
    const index = process.argv.indexOf(name);
    const value = inline?.slice(prefix.length) ?? (index >= 0 ? process.argv[index + 1] : fallback);
    if (!allowed.includes(value)) throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
    return value;
}

function viteBuild(configName, environment = {}) {
    const configuration = {
        root: desktopDirectory,
        configFile: join(desktopDirectory, configName),
        define: { __KISSOPEN_APP_VERSION__: JSON.stringify(releaseVersion) },
    };
    return run(
        process.execPath,
        [
            "--import",
            "tsx",
            "--input-type=module",
            "--eval",
            `import { build } from "vite"; await build(${JSON.stringify(configuration)});`,
        ],
        environment,
    );
}

function run(command, arguments_, environment = {}) {
    console.log(`\n$ ${command} ${arguments_.join(" ")}`);
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, arguments_, {
            cwd: workspace,
            env: { ...process.env, ...environment },
            stdio: "inherit",
        });
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (code === 0) resolvePromise();
            else
                reject(
                    new Error(
                        `${command} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}.`,
                    ),
                );
        });
    });
}
