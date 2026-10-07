/*
 * Names this checkout's Electron binary after the build it runs.
 *
 * macOS takes the Dock tile, the Cmd+Tab entry, and the bold first menu from the
 * running bundle's Info.plist, and no runtime call reaches them: `app.setName`
 * arrives long after the process was registered. An unpackaged Kissopen therefore
 * presents itself as "Electron" everywhere the system names an application, and
 * two checkouts running side by side are indistinguishable — which is the whole
 * problem the development identity exists to solve.
 *
 * So the bundle is renamed before it starts. This touches only the Electron
 * unpacked into this workspace's own node_modules by its postinstall (never a
 * shared pnpm store object, and never a packaged Kissopen, which carries its real
 * name from electron-builder), and it is idempotent: reinstalling Electron
 * restores the stock name and the next development run renames it again.
 *
 * The identifier is renamed with the name, and has to be. LaunchServices keys
 * what it knows about an application — the name it prints, the icon it draws,
 * the permissions it has been granted — on the bundle identifier, and every
 * unpacked Electron ships the same `com.github.Electron`. Renaming only the name
 * leaves this checkout filed under an identifier every other Electron build on
 * this machine also claims, so the system answers from whichever it recorded
 * first and the Dock goes on saying "Electron" however often the name is set.
 *
 * The label is derived the way `packages/kissopen-desktop-electron/sources/main/buildIdentity.ts`
 * derives it, and the two must keep agreeing: one build, one name.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEFAULT_BRANCHES = new Set(["main", "master"]);

function git(args) {
    try {
        const output = execFileSync("git", args, {
            cwd: workspace,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 5000,
        }).trim();
        return output.length > 0 ? output : undefined;
    } catch {
        return undefined;
    }
}

function buildLabel() {
    const root = git(["rev-parse", "--show-toplevel"]);
    if (!root) return undefined;
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "HEAD";
    const gitDir = git(["rev-parse", "--git-dir"]);
    const commonDir = git(["rev-parse", "--git-common-dir"]);
    const worktree =
        gitDir !== undefined &&
        commonDir !== undefined &&
        resolve(workspace, gitDir) !== resolve(workspace, commonDir);
    if (worktree) return basename(root);
    return branch !== "HEAD" && !DEFAULT_BRANCHES.has(branch) ? branch : "dev";
}

function electronBundle() {
    // Electron belongs to the desktop package, so its binary is unpacked there.
    const entry = join(
        workspace,
        "packages",
        "kissopen-desktop-electron",
        "node_modules",
        "electron",
        "index.js",
    );
    if (!existsSync(entry)) return undefined;
    // `node_modules/electron` is a symlink into the pnpm layout; resolving it is
    // what finds the real, per-workspace unpacked binary beside it.
    const home = dirname(resolve(entry));
    const bundle = join(home, "dist", "Electron.app", "Contents", "Info.plist");
    return existsSync(bundle) ? bundle : undefined;
}

const label = buildLabel();
const plist = electronBundle();
if (!label || !plist) process.exit(0);

const name = label === "dev" ? "kissopen Dev" : `kissopen Dev — ${label}`;
// The checkout's own path, not its label, is what has to be unique: a label is a
// branch name, and `feature/x` and `feature-x` reduce to the same characters a
// bundle identifier admits. Two checkouts sharing an identifier are one
// application to LaunchServices, which is the collision being avoided.
const identifier = `com.kissopen.opensource.desktop.dev.${createHash("sha256").update(workspace).digest("hex").slice(0, 12)}`;
const entries = [
    ["CFBundleName", name],
    ["CFBundleDisplayName", name],
    ["CFBundleIdentifier", identifier],
];
for (const [key, value] of entries) {
    try {
        execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plist], {
            stdio: "ignore",
        });
    } catch {
        // A bundle that cannot be renamed still runs; it just keeps the stock
        // name, which is a worse window rather than a broken one.
    }
}
/*
 * Tell LaunchServices to read the bundle again. Without this the rename lands in
 * a file macOS has already made up its mind about: it answers from the record it
 * cached the last time this bundle was registered, so a first run after a fresh
 * install — exactly when the name has just changed — shows the old one.
 */
try {
    execFileSync(
        "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
        ["-f", resolve(dirname(plist), "..")],
        { stdio: "ignore", timeout: 15000 },
    );
} catch {
    // Registration is a courtesy to the Dock, not a condition of running.
}
console.log(`Development Electron named "${name}".`);
