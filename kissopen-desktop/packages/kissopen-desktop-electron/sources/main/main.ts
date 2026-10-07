import { kissopenAgentArtifactInstall } from "./kissopenBundledAgent";
import { communityAgentEnvironment, communityUserDataDirectory } from "./communityDesktop";
import { DesktopBrowserAutomation } from "./browserAutomation";
import { browserPasswordGenerate } from "./browserPasswordGenerate";
import { createHash } from "node:crypto";
import type { DesktopBrowserScope } from "../shared/browserAutomation";
import { relayAccountId, relayAccountChanged, relayBrowserControl } from "./relay/relayBinding";
import { localeCurrent, localeResolve, localeSet, t } from "kissopen-desktop-state/i18n";
import { kissopenAgentMenuBarDisable } from "./kissopenAgentMenuBar";
import { kissopenCloudRequest } from "./kissopenCloud";
import { kissopenFileOpen } from "./kissopenFileOpen";
import { kissopenTrayInstall } from "./kissopenTray";
import { launchedAtLogin, loginItemEnabled, loginItemSet, loginItemSupported } from "./loginItem";
import {
    quickBarAddress,
    quickBarClose,
    quickBarHide,
    quickBarResize,
    quickBarShow,
} from "./quickBar";
import { relayCloudSay } from "./relay/relayBinding";
import {
    relayAbortRun,
    relayArchiveSession,
    relayClearSession,
    relayDeleteSession,
    relayConversationRead,
    relayCurrent,
    relayAnswerQuestion,
    relayCancelQuestion,
    relayDecideRequest,
    relayFileOpen,
    relayFileRead,
    relayDirectoryList,
    relayFileUpload,
    relayGitFileRead,
    relayGitStateRead,
    relaySaySend,
    relayTerminalAttach,
    relayTerminalCreate,
    relayTerminalDetach,
    relayTerminalList,
    relayTerminalResize,
    relayTerminalStop,
    relayTerminalWrite,
} from "./relay/relayBinding";
import type { KissopenAgentGitFile } from "../shared/relayContract";
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    nativeTheme,
    screen,
    session as electronSession,
    shell,
    webContents as electronWebContents,
    type BrowserWindowConstructorOptions,
    type MenuItemConstructorOptions,
    type OpenDialogOptions,
    type WebContents,
} from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DesktopRuntime } from "./desktopRuntime";
import { desktopInstanceMenuTargets } from "./applicationMenu";
import {
    desktopWindowTarget,
    localWebNavigationAllowed,
    rendererNavigationAllowed,
} from "./navigation";
import { appVersion } from "./appVersion";
import { desktopFlavor } from "./desktopFlavor";
import { dockBadgeApply, dockBadgeClear, dockUnreadCountRead } from "./dockBadge";
import { desktopUpdaterCreate } from "./updater";
import { DesktopWindowLifecycle, type DesktopWindowBounds } from "./windowLifecycle";
import {
    desktopDaemonVersionValidate,
    desktopStartRequestValidate,
    desktopTopologyIdValidate,
} from "./runtimeValidation";
import {
    buildIdentityArgument,
    debugMetricsArgument,
    desktopIpc,
    kissopenHtmlPreviewPartition,
    mediaPreviewArgument,
    mediaPreviewView,
    type DesktopBrowserProxyTarget,
    type DesktopBrowserStatus,
    type DesktopCloudAuthConfiguration,
    type DesktopDebugSnapshot,
    type DesktopGuestKeyEvent,
    type DesktopMediaPreview,
    type DesktopNavigationStep,
    type DesktopPreviewNavigation,
    type DesktopPreviewNavigationStep,
    type RelayAttachment,
} from "../shared/desktopContract";
import {
    desktopReactDevtoolsMessageValidate,
    type DesktopProfilerBuildMode,
    type DesktopProfilerRequest,
    type DesktopProfilerSnapshot,
    type DesktopReactDevtoolsMessage,
} from "../shared/desktopProfiler";
import {
    mediaPreviewAddressAllowed,
    mediaPreviewNavigationAllowed,
    mediaPreviewResolve,
    mediaPreviewTitle,
} from "./mediaPreviewWindow";
import { localKissopenAgentConnectorCreate, localRuntimeProbe } from "./localKissopenAgent";
import { LocalOnboarding } from "./localOnboarding";
import { legacyCliConnectorCreate } from "./legacyCliConnect";
import {
    desktopBrowserCommandValidate,
    desktopBrowserProxyTargetValidate,
} from "./kissopenAgentIpcValidation";
import { htmlPreviewProxyCreate, type HtmlPreviewProxyHandle } from "./htmlPreviewProxy";
import { kissopenAgentRendererOrigin } from "./kissopenAgentRendererProxy";
import {
    kissopenAgentRendererSessionCreate,
    type KissopenAgentRendererSession,
} from "./kissopenAgentRendererSession";
import { KissopenAgentServiceBrowser } from "./kissopenAgentServiceBrowser";
import { DesktopConfigStore } from "./desktopConfig";
import { DesktopDebugController } from "./desktopDebugController";
import { desktopMainInspectorStart } from "./desktopInspector";
import { DesktopProfilerController } from "./desktopProfilerController";
import { DesktopWindowStateStore } from "./windowState";
import { desktopBuildIdentityRead } from "./buildIdentity";
import { DesktopDaemonController } from "./desktopDaemonController";
import { cloudAuthProductionRedirectUri } from "../shared/cloudAuthConfig";

if (process.platform !== "darwin" && process.platform !== "linux" && process.platform !== "win32") {
    console.error("WorPar Place desktop is available only on macOS, Linux, and Windows.");
    app.exit(1);
}
const buildIdentity = desktopBuildIdentityRead(app.isPackaged, app.getAppPath());
const desktopGymActive = process.env.KISSOPEN_DESKTOP_GYM_PROFILE !== undefined;
const desktopProfilerLaunchMode =
    process.env.KISSOPEN_DESKTOP_PROFILE_MODE === "optimized" || desktopGymActive
        ? "optimized"
        : process.env.KISSOPEN_DESKTOP_PROFILE_MODE === "development"
          ? "development"
          : undefined;
const desktopProfilerNamePreserving =
    desktopProfilerLaunchMode === "optimized" && process.env.KISSOPEN_DESKTOP_PROFILE === "1";

function desktopProfilerBuildLabel(): string | undefined {
    const checkout = buildIdentity?.label;
    const namePreservingSuffix = desktopProfilerNamePreserving
        ? " + keepNames requested (profile launch)"
        : "";
    if (desktopProfilerLaunchMode === "development") {
        return checkout
            ? `development/non-representative${namePreservingSuffix} — ${checkout}`
            : `development/non-representative${namePreservingSuffix}`;
    }
    if (desktopProfilerLaunchMode === "optimized") {
        return checkout
            ? `optimized${namePreservingSuffix} — ${checkout}`
            : `optimized${namePreservingSuffix}`;
    }
    return checkout;
}

function desktopProfilerBuildMode(): DesktopProfilerBuildMode {
    return desktopProfilerLaunchMode ?? "standard";
}
/*
 * A development build says so everywhere the system can name an application. The
 * menu bar and the About item read the application name, which is otherwise
 * literally "Electron" while running unpackaged — a window that claims to be
 * Electron tells the reader nothing about which of their checkouts it came from.
 */
// This is a separate installation: never preserve or migrate commercial process/Keychain identity.
const applicationName = buildIdentity ? "kissopen OSS Dev" : "kissopen OSS";
app.setName(applicationName);
/** The product's name in the reader's language, for menus and window titles. */
function applicationDisplayName(): string {
    return buildIdentity ? "kissopen Dev" : "kissopen";
}
/*
 * Each checkout is its own installation of the app. Everything below is keyed on
 * the user-data directory — the single-instance lock above all — so sharing one
 * would mean the second checkout's window silently quitting into the first
 * checkout's window instead of opening, which is precisely what someone running
 * two builds side by side is trying to avoid. Separate directories also keep one
 * worktree's settings, window geometry, and saved instances out of another's.
 */
app.setPath("userData", communityUserDataDirectory(app.getPath("appData"), buildIdentity?.label));
// Keep each product installation/check-out's agent and encryption keys separate.
// Resolve this after the checkout-specific user-data directory is selected.
process.env.KISSOPEN_HOME_DIR = join(app.getPath("userData"), "runtime", ".kissopen");
// Only now is this process identifiable, so only now can it claim to be the one.
if (!app.requestSingleInstanceLock()) app.quit();

const dirname = fileURLToPath(new URL(".", import.meta.url));
const generatedApplicationIconPath = join(
    dirname,
    "..",
    "assets",
    "app-icon",
    "generated",
    "app-icon.png",
);
const applicationIconPath = existsSync(generatedApplicationIconPath)
    ? generatedApplicationIconPath
    : undefined;
/**
 * The two Dock tiles the running app chooses between by appearance.
 *
 * A white tile with the Blurple mark for a light desktop, an indigo tile with
 * the light mark for a dark one. The bundle's own icon is a single static
 * image and cannot follow the system the way a window does, so the app sets
 * its Dock icon at runtime and these are what it sets.
 */
function generatedDockIconPath(name: "dock-light" | "dock-dark"): string | undefined {
    const path = join(dirname, "..", "assets", "app-icon", "generated", `${name}.png`);
    return existsSync(path) ? path : undefined;
}
const dockLightIconPath = generatedDockIconPath("dock-light");
const dockDarkIconPath = generatedDockIconPath("dock-dark");

/**
 * Points the Dock icon at the tile that suits the desktop's appearance.
 *
 * macOS only, and a runtime override of the Dock alone: the bundle icon the
 * Finder and the updater read is untouched. It re-runs whenever the system
 * switches between light and dark, so the icon switches with it.
 */
function dockAppearanceApply(): void {
    if (process.platform !== "darwin" || !app.dock) return;
    const path = nativeTheme.shouldUseDarkColors ? dockDarkIconPath : dockLightIconPath;
    if (path) app.dock.setIcon(path);
}
/*
 * The title carries the checkout as well, because that is what Mission Control,
 * the Window menu, and the app switcher's window list have room to show. The
 * ordinary checkout on the default branch is simply "WorPar Dev": it is the one
 * window with nothing to distinguish it from, and naming it twice says nothing.
 */
function windowTitle(): string {
    return buildIdentity && buildIdentity.label !== "dev"
        ? `${applicationDisplayName()} — ${buildIdentity.label}`
        : applicationDisplayName();
}
const desktopDebugEnabled =
    !app.isPackaged &&
    (process.env.KISSOPEN_DESKTOP_DEBUG === "1" || process.argv.includes("--debug"));

function desktopDebugRendererDefaultPort(): number {
    if (!buildIdentity || buildIdentity.label === "dev") return 9222;
    let hash = 2_166_136_261;
    for (const character of buildIdentity.path) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16_777_619);
    }
    return 10_000 + ((hash >>> 0) % 20_000);
}

function desktopDebugRendererPortRead(): number {
    const fallback = desktopDebugRendererDefaultPort();
    const raw = process.env.KISSOPEN_DEBUG_RENDERER_PORT?.trim();
    if (raw === undefined || raw.length === 0) return fallback;
    const port = Number(raw);
    if (Number.isInteger(port) && port >= 1024 && port <= 65_535) return port;
    console.warn(
        `[kissopen debug] Invalid KISSOPEN_DEBUG_RENDERER_PORT=${raw}; using ${fallback}.`,
    );
    return fallback;
}

const desktopDebugRendererPort = desktopDebugEnabled
    ? desktopDebugRendererPortRead()
    : desktopDebugRendererDefaultPort();

function desktopDebugLog(message: string): void {
    if (desktopDebugEnabled) console.log(`[kissopen debug] ${message}`);
}

function desktopDebugError(message: string, error?: unknown): void {
    if (!desktopDebugEnabled) return;
    console.error(
        `[kissopen debug] ${message}${error === undefined ? "" : `: ${errorMessage(error)}`}`,
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function windowBackgroundColor(): string {
    return nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "#f5f5f5";
}
const developmentRendererOrigin = process.env.VITE_DEV_SERVER_URL
    ? new URL(process.env.VITE_DEV_SERVER_URL).origin
    : undefined;
const titleBarHeight = 40;
const macosTrafficLightSize = 14;
const windowsWithTitleBarOverlay = new WeakSet<BrowserWindow>();
/*
 * macOS hides the native title bar and positions its traffic lights inside the
 * renderer's own 40px bar. Windows does the same with the native caption
 * buttons drawn as an overlay at the same height. Linux keeps its native frame:
 * with no overlay mechanism, a hidden title bar would leave the window without
 * close/minimize controls entirely.
 */
function platformWindowChrome(): Electron.BrowserWindowConstructorOptions {
    return process.platform === "darwin"
        ? {
              titleBarStyle: "hidden",
              trafficLightPosition: {
                  x: 14,
                  y: (titleBarHeight - macosTrafficLightSize) / 2,
              },
          }
        : process.platform === "win32"
          ? {
                titleBarStyle: "hidden",
                titleBarOverlay: windowsTitleBarOverlay(),
            }
          : {};
}

function windowsTitleBarOverlay(): Electron.TitleBarOverlay {
    // Match kissopen-desktop-ui/src/theme.css's header-background/header-tint.
    return {
        height: titleBarHeight,
        color: nativeTheme.shouldUseDarkColors ? "#212121" : "#ffffff",
        symbolColor: nativeTheme.shouldUseDarkColors ? "#ffffff" : "#18171c",
    };
}

function windowAppearanceApply(): void {
    for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed()) continue;
        window.setBackgroundColor(windowBackgroundColor());
        if (process.platform === "win32" && windowsWithTitleBarOverlay.has(window))
            window.setTitleBarOverlay(windowsTitleBarOverlay());
    }
}

nativeTheme.themeSource = "system";
// Independent Kissopen Agent realtime streams share the loopback HTTP proxy.
// Keep them from exhausting Chromium's per-host sockets and starving API requests.
app.commandLine.appendSwitch("ignore-connections-limit", "127.0.0.1,kissopen-agent");
// The exact virtual origin is local to Electron's authenticated proxy. Unlike
// localhost, this requested hostname is not inherently trustworthy to Chromium;
// mark only this origin local so the hosted HTTPS renderer can also consume it.
app.commandLine.appendSwitch(
    "unsafely-treat-insecure-origin-as-secure",
    `${kissopenAgentRendererOrigin},ws://kissopen-agent`,
);
// Never resolve this private origin through DNS, including if proxy setup fails.
app.commandLine.appendSwitch("host-resolver-rules", "MAP kissopen-agent ~NOTFOUND");
app.commandLine.appendSwitch("disable-quic");
app.commandLine.appendSwitch("force-webrtc-ip-handling-policy", "disable_non_proxied_udp");
if (desktopDebugEnabled) {
    // This branch is unavailable in packaged builds. Chromium's raw CDP server
    // has no authentication, so even an explicit flag must remain development
    // tooling bound to loopback.
    app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
    app.commandLine.appendSwitch("remote-debugging-port", String(desktopDebugRendererPort));
    try {
        const mainInspectorUrl = desktopMainInspectorStart();
        desktopDebugLog(`main inspector: ${mainInspectorUrl}`);
    } catch (error) {
        desktopDebugError("could not start the main-process inspector", error);
    }
    desktopDebugLog(`renderer CDP: http://127.0.0.1:${desktopDebugRendererPort}`);
    desktopDebugLog(`renderer targets: http://127.0.0.1:${desktopDebugRendererPort}/json/list`);
    desktopDebugLog(
        `attach with Playwright: connectOverCDP("http://127.0.0.1:${desktopDebugRendererPort}")`,
    );
}

let runtime: DesktopRuntime;
let daemonController: DesktopDaemonController;
let desktopConfigStore: DesktopConfigStore;
let desktopDebugController: DesktopDebugController | undefined;
let desktopDebugDaemonAttemptedConnectionId: number | undefined;
let desktopProfilerController: DesktopProfilerController;
let desktopWindowStateStore: DesktopWindowStateStore;
let onboarding: LocalOnboarding;
let quitting = false;
let quitCleanup: Promise<void> | undefined;
/** Each workspace keeps its own network profile, including while its tabs are hidden. */
const browserProxies = new Map<string, KissopenAgentServiceBrowser>();
const browserAutomation = new DesktopBrowserAutomation({
    account: relayAccountId,
    request: (scope, request) =>
        scope.kind === "relay"
            ? relayBrowserControl(scope.sessionId, request)
            : runtime.browserControl(scope, scope.agentId, request),
    publish: (owner, event) => owner.send(desktopIpc.browserAutomationEvent, event),
    navigate: async (guest, scope, url) => {
        const target = {
            connectionId: scope.kind === "local" ? scope.connectionId : null,
            workspaceId: scope.workspaceId,
        };
        const browser = browserProxies.get(browserPartition(target));
        if (!browser?.owns(guest)) throw new Error("This tab no longer belongs to the workspace.");
        const result = await browser.command(guest, { action: "load", url });
        if (!result.ok) throw new Error(result.description || "The browser could not navigate.");
    },
});
relayAccountChanged(() => browserAutomation.closeAll());
function browserPartition(target: DesktopBrowserProxyTarget): string {
    return `${KissopenAgentServiceBrowser.partition(target)}-${createHash("sha256")
        .update(relayAccountId() ?? "local-only")
        .digest("hex")
        .slice(0, 24)}`;
}

function browserScopeValidate(raw: unknown): DesktopBrowserScope {
    if (!raw || typeof raw !== "object") throw new Error("Invalid browser scope.");
    const value = raw as Record<string, unknown>;
    const workspaceId = value.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId || workspaceId.length > 256)
        throw new Error("Invalid workspace.");
    if (
        value.kind === "relay" &&
        typeof value.sessionId === "string" &&
        /^[a-zA-Z0-9_-]{1,128}$/u.test(value.sessionId)
    )
        return { kind: "relay", sessionId: value.sessionId, workspaceId };
    if (
        value.kind === "local" &&
        typeof value.agentId === "string" &&
        /^[a-z][a-z0-9]*$/u.test(value.agentId) &&
        (value.connectionId === null ||
            (typeof value.connectionId === "string" &&
                /^[a-z][a-z0-9_-]{0,63}$/u.test(value.connectionId)))
    )
        return {
            kind: "local",
            agentId: value.agentId,
            connectionId: value.connectionId,
            workspaceId,
        };
    throw new Error("Invalid browser scope.");
}
function browserBindingId(raw: unknown): string {
    if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{32,128}$/u.test(raw))
        throw new Error("Invalid browser binding.");
    return raw;
}
let htmlPreviewProxy: HtmlPreviewProxyHandle | undefined;
let browserProxyConnectionId: number | undefined;
let browserProxyOperation = Promise.resolve();
// Automation needs a real laid-out window without taking focus from the work
// happening beside it.
const windowLifecycle = new DesktopWindowLifecycle<BrowserWindow>((window) => {
    if (desktopGymActive) window.showInactive();
    else window.show();
});
const cloudAuthConfiguration: DesktopCloudAuthConfiguration = {
    environment: "production",
    redirectUri: cloudAuthProductionRedirectUri,
};
const cloudAuthProtocol = new URL(cloudAuthConfiguration.redirectUri).protocol.slice(0, -1);
let cloudAuthCallback: string | undefined;

function cloudAuthCallbackRead(candidate: string): string | undefined {
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === `${cloudAuthProtocol}:` && parsed.hostname === "callback"
            ? parsed.href
            : undefined;
    } catch {
        return undefined;
    }
}

if (
    !(app.isPackaged
        ? app.setAsDefaultProtocolClient(cloudAuthProtocol)
        : process.argv[1]
          ? app.setAsDefaultProtocolClient(cloudAuthProtocol, process.execPath, [process.argv[1]])
          : app.setAsDefaultProtocolClient(cloudAuthProtocol))
)
    console.warn(`WorPar could not register the ${cloudAuthProtocol}: callback protocol.`);

app.on("open-url", (event, candidate) => {
    const callback = cloudAuthCallbackRead(candidate);
    if (!callback) return;
    event.preventDefault();
    cloudAuthCallback = callback;
    const window = windowLifecycle.get();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(desktopIpc.cloudAuthCallbackReceived);
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
});
const unavailableBrowserProxy = "http://127.0.0.1:9";
let kissopenAgentRendererSession: KissopenAgentRendererSession | undefined;
/*
 * The one window a file is shown in outside the application. There is exactly
 * one because a reader looking at a file is looking at a file: opening another
 * points this window at the new one rather than accumulating windows nobody
 * asked for and nobody will close.
 */
let mediaPreviewWindow: BrowserWindow | undefined;
let mediaPreviewSubject: DesktopMediaPreview | undefined;
function desktopDebugPublish(snapshot: DesktopDebugSnapshot): void {
    const window = windowLifecycle.get();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(desktopIpc.debugChanged, snapshot);
}

function desktopDaemonSenderRequire(sender: WebContents): void {
    const presenting = windowLifecycle.get();
    if (!presenting || presenting.webContents !== sender)
        throw new Error("This window cannot control WorPar Agent.");
}

function desktopDebugSenderRequire(sender: WebContents): void {
    const presenting = windowLifecycle.get();
    if (!presenting || presenting.webContents !== sender)
        throw new Error("This window cannot control the debugger.");
}

function desktopDebugRuntimeLog(snapshot: ReturnType<DesktopRuntime["get"]>): void {
    if (!desktopDebugEnabled) return;
    switch (snapshot.phase) {
        case "choosing":
            desktopDebugLog("runtime phase=choosing");
            return;
        case "starting":
            desktopDebugLog(`runtime phase=starting: ${snapshot.message}`);
            return;
        case "error":
            desktopDebugError(`runtime phase=error: ${snapshot.message}`);
            return;
        case "ready":
            desktopDebugLog(
                `runtime phase=ready mode=${snapshot.mode} connection=${snapshot.connectionId}`,
            );
            return;
        default: {
            const exhaustive: never = snapshot;
            return exhaustive;
        }
    }
}

/** Starts the KISSOPEN Agent inspector for each fresh local connection in CLI debug mode. */
function desktopDebugDaemonStartIfReady(snapshot: ReturnType<DesktopRuntime["get"]>): void {
    const debugController = desktopDebugController;
    if (
        !desktopDebugEnabled ||
        !debugController ||
        snapshot.phase !== "ready" ||
        snapshot.mode !== "local"
    )
        return;
    const connectionId = snapshot.connectionId;
    if (desktopDebugDaemonAttemptedConnectionId === connectionId) return;
    desktopDebugDaemonAttemptedConnectionId = connectionId;
    void debugController
        .start("daemon")
        .then((debugSnapshot) => {
            const target = debugSnapshot.daemon;
            if (target.status === "running" && target.url) {
                desktopDebugLog(`WorPar Agent daemon inspector: ${target.url}`);
            } else {
                desktopDebugError(
                    `WorPar Agent daemon inspector did not start (${target.status})${
                        target.error ? `: ${target.error}` : ""
                    }`,
                );
            }
        })
        .catch((error) => desktopDebugError("WorPar Agent daemon inspector startup failed", error));
}

function desktopProfilerPublish(snapshot: DesktopProfilerSnapshot): void {
    const window = windowLifecycle.get();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(desktopIpc.profilerChanged, snapshot);
}

function desktopProfilerSenderRequire(sender: WebContents): void {
    const presenting = windowLifecycle.get();
    if (!presenting || presenting.webContents !== sender)
        throw new Error("This window cannot control the profiler.");
}

function desktopProfilerRequestValidate(input: unknown): DesktopProfilerRequest {
    if (input === undefined) return {};
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("The profiler request is invalid.");
    const durationMs = (input as { readonly durationMs?: unknown }).durationMs;
    if (durationMs === undefined) return {};
    if (
        typeof durationMs !== "number" ||
        !Number.isInteger(durationMs) ||
        durationMs < 1_000 ||
        durationMs > 10 * 60_000
    )
        throw new Error("The profiler duration must be between one second and ten minutes.");
    return { durationMs };
}

/** The one native folder chooser, shared by the renderer's request and first-run setup. */
async function directoryPickShow(owner: BrowserWindow | undefined): Promise<string | undefined> {
    const options: OpenDialogOptions = {
        buttonLabel: t("Choose"),
        properties: ["openDirectory", "createDirectory"],
        title: t("Choose a WorPar Agent working directory"),
    };
    const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options);
    return result.canceled ? undefined : result.filePaths[0];
}

/**
 * Which document is presenting Kissopen. It advances on every main-frame navigation
 * or reload, on a renderer that is lost or crashes, and on a window that is
 * replaced, so a `webContents` id — which survives all of those — is never the
 * whole answer to "is this still the reader who asked?".
 */
let presentationEpoch = 0;

function presentationAdvance(): void {
    presentationEpoch += 1;
}

/** The presenting document's identity: which renderer, and which of its lives. */
function presentationIdentity(): string {
    const window = windowLifecycle.get();
    const presenting = window && !window.isDestroyed() ? window.webContents.id : undefined;
    return `${presenting ?? "none"}:${presentationEpoch}`;
}

/**
 * Only the window that is actually presenting KISSOPEN right now may drive first-run
 * setup. Every one of these operations installs software, writes durable choices,
 * or opens a native picker, so a renderer that has been replaced — a reload, a
 * topology change, a window that lost its turn — must not be able to reach them
 * with a preload it still holds. Which step may run is checked separately and
 * authoritatively by first-run setup itself, against the stage it is on.
 */
function onboardingSenderRequire(sender: Electron.WebContents): void {
    const presenting = windowLifecycle.get();
    if (!presenting || presenting.isDestroyed() || presenting.webContents !== sender)
        throw new Error("First-run setup is not being presented by this window.");
}

const legacyCli = legacyCliConnectorCreate(() => daemonController.launchEnvironment());

function legacyCliSenderCurrent(event: Electron.IpcMainInvokeEvent): () => boolean {
    onboardingSenderRequire(event.sender);
    if (event.senderFrame !== event.sender.mainFrame)
        throw new Error("Only the desktop window can set up the terminal CLI.");
    const presentation = presentationIdentity();
    const initial = runtime.get();
    if (initial.phase !== "ready" || initial.mode !== "local")
        throw new Error("Connect your local WorPar Agent before setting up the terminal CLI.");
    return () => {
        const current = runtime.get();
        return (
            presentationIdentity() === presentation &&
            current.phase === "ready" &&
            current.mode === "local" &&
            current.connectionId === initial.connectionId
        );
    };
}

async function browserProxyFailClosed(browserSession: Electron.Session): Promise<void> {
    await browserSession.setProxy({
        mode: "fixed_servers",
        proxyBypassRules: "<-loopback>",
        proxyRules: unavailableBrowserProxy,
    });
    await browserSession.closeAllConnections();
}

function browserProxySerial<T>(work: () => Promise<T>): Promise<T> {
    const next = browserProxyOperation.then(work, work);
    browserProxyOperation = next.then(
        () => undefined,
        () => undefined,
    );
    return next;
}

function browserProxyApply(target: DesktopBrowserProxyTarget): Promise<string> {
    return browserProxySerial(async () => {
        const partition = browserPartition(target);
        if (browserProxies.has(partition)) return partition;
        if (browserProxies.size >= 128)
            throw new Error("Too many workspace browser profiles are open.");
        const browserSession = electronSession.fromPartition(partition, { cache: true });
        await browserSessionConfigure(browserSession);
        let candidate: KissopenAgentServiceBrowser | undefined;
        try {
            candidate = await KissopenAgentServiceBrowser.create(browserSession, target, runtime);
            browserProxies.set(partition, candidate);
            return partition;
        } catch (error) {
            candidate?.close();
            await browserProxyFailClosed(browserSession);
            throw error;
        }
    });
}

function browserWebUrl(candidate: string, allowBlank = false): string | undefined {
    if (allowBlank && candidate === "about:blank") return candidate;
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? parsed.href
            : undefined;
    } catch {
        return undefined;
    }
}

function browserOpenPublish(window: BrowserWindow, candidate: string): void {
    const url = browserWebUrl(candidate);
    if (!url || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(desktopIpc.browserOpenRequested, url);
}

/**
 * Keeps Chromium's true engine/version while removing the Electron/app tokens
 * that make sites serve an embedded-shell variant.
 */
function browserUserAgent(defaultUserAgent: string): string {
    return defaultUserAgent
        .replace(/\sElectron\/\S+/giu, "")
        .replace(/\sKissopen(?:%20|\s)Place(?:%20|\s)Desktop\/\S+/giu, "")
        .replace(/\s{2,}/gu, " ")
        .trim();
}

async function browserSessionConfigure(browserSession: Electron.Session): Promise<void> {
    browserSession.setUserAgent(browserUserAgent(browserSession.getUserAgent()), app.getLocale());
    await browserProxyFailClosed(browserSession);

    const permissionLabels = new Map<string, string>([
        ["clipboard-read", "read the clipboard"],
        ["display-capture", "share the screen"],
        ["geolocation", "use your location"],
        ["media", "use the camera or microphone"],
        ["midi", "use MIDI devices"],
        ["notifications", "show notifications"],
        ["pointerLock", "capture the pointer"],
    ]);
    browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const label = permissionLabels.get(permission);
        const requestingUrl = browserWebUrl(details.requestingUrl || webContents.getURL());
        if (!label || !requestingUrl) {
            callback(false);
            return;
        }
        const requestingOrigin = new URL(requestingUrl).origin;
        const host = webContents.hostWebContents;
        const owner = host ? BrowserWindow.fromWebContents(host) : undefined;
        const options = {
            buttons: [t("Don't Allow"), t("Allow")],
            cancelId: 0,
            defaultId: 0,
            detail: t("{origin} wants to {action}.", {
                origin: requestingOrigin,
                action: t(label),
            }),
            message: t("Website permission"),
            noLink: true,
            type: "question" as const,
        };
        void (owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options))
            .then((result) => callback(result.response === 1))
            .catch(() => callback(false));
    });
}

function htmlPreviewSessionGet() {
    return electronSession.fromPartition(kissopenHtmlPreviewPartition, { cache: false });
}

/**
 * Points the preview profile at Kissopen's own HTML preview proxy and walls it off
 * from everything else.
 *
 * A workspace document runs its own scripts, and a page in a checkout may name
 * any address in the world — a tracker, an endpoint it was told to call, a
 * script from a CDN. Loopback is deliberately *not* bypassed, so every request
 * such a page makes, including the one for the document itself, arrives at the
 * preview proxy: it answers for the document's own folder and refuses the rest
 * of the internet. A preview therefore shows what the file contains, and can
 * neither call home nor reach anything Kissopen is signed in to.
 */
async function htmlPreviewSessionConfigure(): Promise<void> {
    const previewSession = htmlPreviewSessionGet();
    await previewSession.setProxy({
        mode: "fixed_servers",
        proxyBypassRules: "<-loopback>",
        proxyRules: htmlPreviewProxy
            ? `http://127.0.0.1:${String(htmlPreviewProxy.port)}`
            : unavailableBrowserProxy,
    });
    previewSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
        callback(false),
    );
    previewSession.setPermissionCheckHandler(() => false);
    await previewSession.closeAllConnections();
}

/**
 * Whether an address is one of this process's own preview sites. The proxy
 * publishes each document folder under `.localhost`, which is loopback by
 * specification, so a page keeps the secure context it would have when served
 * for real.
 */
function htmlPreviewUrl(candidate: string): string | undefined {
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === "http:" &&
            parsed.port === "" &&
            parsed.hostname.endsWith(".localhost")
            ? parsed.href
            : undefined;
    } catch {
        return undefined;
    }
}

app.on("login", (event, _webContents, _details, authInfo, callback) => {
    if (!authInfo.isProxy || authInfo.host !== "127.0.0.1") return;
    // Chromium's ws:// CONNECT uses proxy login before its inner Upgrade can
    // carry request-bound admission. Only the exact owning guest may obtain it.
    for (const browser of browserProxies.values()) {
        if (authInfo.port !== browser.proxy.port) continue;
        event.preventDefault();
        if (_webContents && browser.owns(_webContents))
            callback(browser.proxy.username, browser.proxy.password);
        else callback();
        return;
    }
    if (authInfo.port === htmlPreviewProxy?.port) {
        event.preventDefault();
        callback(htmlPreviewProxy.username, htmlPreviewProxy.password);
    }
});

function browserGuestAttach(window: BrowserWindow): void {
    window.webContents.on("will-attach-webview", (event, webPreferences, params) => {
        const previewGuest = params.partition === kissopenHtmlPreviewPartition;
        const allowed = previewGuest
            ? htmlPreviewUrl(params.src) !== undefined
            : browserProxies.has(params.partition) && params.src === "about:blank";
        if (!allowed) {
            event.preventDefault();
            return;
        }
        // Guest pages never inherit a preload or Node privilege from the app.
        delete webPreferences.preload;
        webPreferences.contextIsolation = true;
        webPreferences.nodeIntegration = false;
        webPreferences.nodeIntegrationInSubFrames = false;
        webPreferences.nodeIntegrationInWorker = false;
        webPreferences.sandbox = true;
        webPreferences.webSecurity = true;
        webPreferences.allowRunningInsecureContent = false;
    });
    window.webContents.on("did-attach-webview", (_event, guest) => {
        guest.on("before-input-event", (_inputEvent, input) => {
            const type =
                input.type === "keyDown"
                    ? ("keydown" as const)
                    : input.type === "keyUp"
                      ? ("keyup" as const)
                      : undefined;
            // Ordinary guest typing stays wholly inside the guest. Command
            // input also reaches the host so window shortcuts and held-Command
            // discovery keep working after the page itself takes focus.
            if (!type || (!input.meta && input.key !== "Meta") || window.isDestroyed()) return;
            window.webContents.send(desktopIpc.guestKey, {
                altKey: input.alt,
                code: input.code,
                ctrlKey: input.control,
                isComposing: input.isComposing,
                key: input.key,
                location: input.location,
                metaKey: input.meta,
                repeat: input.isAutoRepeat,
                shiftKey: input.shift,
                type,
            } satisfies DesktopGuestKeyEvent);
        });
        if (guest.session === htmlPreviewSessionGet()) {
            // A preview is one page of one file. Following a link out of it, or
            // opening a window from it, is browsing, and browsing is the browser
            // tab's job — so the guest stays on the document it was opened with.
            guest.setWindowOpenHandler(({ url }) => {
                // A document cannot turn an unsolicited popup into trusted service navigation.
                try {
                    const address = new URL(url);
                    if (
                        address.hostname === "localhost" ||
                        address.hostname.endsWith(".localhost") ||
                        address.hostname.endsWith(".kissopen.invalid") ||
                        address.hostname.startsWith("127.") ||
                        ["[::1]", "0.0.0.0"].includes(address.hostname)
                    )
                        return { action: "deny" };
                    browserOpenPublish(window, url);
                } catch {
                    /* Invalid navigation is refused. */
                }
                return { action: "deny" };
            });
            const stayOnPreview = (event: Electron.Event, candidate: string) => {
                if (htmlPreviewUrl(candidate) === undefined) event.preventDefault();
            };
            guest.on("will-navigate", stayOnPreview);
            guest.on("will-redirect", stayOnPreview);
            htmlPreviewLifecyclePublish(window, guest);
            return;
        }
        const browser = [...browserProxies.values()].find(
            (profile) => profile.session === guest.session,
        );
        if (!browser) {
            guest.close();
            return;
        }
        browser.register(guest);
        guest.setUserAgent(guest.session.getUserAgent());
        guest.setWindowOpenHandler(({ url }) => {
            if (browser.popupAllowed(guest, url)) browserOpenPublish(window, url);
            return { action: "deny" };
        });
        const navigationGuard = (event: Electron.Event, candidate: string) => {
            if (!browserWebUrl(candidate, true)) event.preventDefault();
        };
        guest.on("will-navigate", navigationGuard);
        guest.on("will-redirect", navigationGuard);
        // Only the main process observes a guest's response code. The renderer
        // needs it to tell a served error page from a blank failed navigation.
        guest.on("did-navigate", (_navigation, url, status, statusText) => {
            if (window.isDestroyed()) return;
            window.webContents.send(desktopIpc.browserStatusChanged, {
                guestId: guest.id,
                url,
                status,
                statusText,
            } satisfies DesktopBrowserStatus);
        });
    });
}

/**
 * Publishes the life of a preview guest's main-frame document as one ordered
 * stream, numbered by navigation.
 *
 * A preview reloads in place whenever the file behind it changes, so a guest
 * outlives many documents and its id says nothing about which one an event
 * belongs to. Only this process sees the whole sequence — the start, the
 * response code, the finish, the failure, the lost renderer — so it is the only
 * place that can put those in one order and stamp each with the navigation it
 * came from. The renderer then ignores anything older than the document it is
 * on, and cannot be told by a slow answer from a previous revision that the
 * page it is showing is broken.
 *
 * The counter is monotonic per guest and never restarts: a reload is a new
 * navigation, and the number only ever goes up while the guest exists.
 */
function htmlPreviewLifecyclePublish(window: BrowserWindow, guest: WebContents): void {
    let navigation = 0;
    const publish = (step: DesktopPreviewNavigationStep): void => {
        if (window.isDestroyed() || guest.isDestroyed()) return;
        window.webContents.send(desktopIpc.previewNavigationChanged, {
            guestId: guest.id,
            navigationId: navigation,
            ...step,
        } satisfies DesktopPreviewNavigation);
    };
    guest.on("did-start-navigation", (details) => {
        // A fragment or a history entry inside the same document is not a new
        // page, and the document on screen keeps whatever it already said.
        if (!details.isMainFrame || details.isSameDocument) return;
        navigation += 1;
        publish({ phase: "started", url: details.url });
    });
    guest.on("did-navigate", (_event, url, status, statusText) => {
        publish({ phase: "responded", url, status, statusText });
    });
    guest.on("did-finish-load", () => {
        publish({ phase: "loaded", url: guest.getURL() });
    });
    guest.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
        // ERR_ABORTED is how Chromium reports a load this guest replaced or
        // stopped itself, which is the superseding navigation's business.
        if (!isMainFrame || code === -3) return;
        publish({ phase: "failed", url: validatedURL, code, description });
    });
    guest.on("render-process-gone", (_event, details) => {
        publish({ phase: "gone", url: guest.getURL(), reason: details.reason });
    });
}

function windowOptions(
    bounds: DesktopWindowBounds | undefined,
    webPreferences: BrowserWindowConstructorOptions["webPreferences"],
): BrowserWindowConstructorOptions {
    return {
        backgroundColor: windowBackgroundColor(),
        title: windowTitle(),
        width: bounds?.width ?? 1100,
        height: bounds?.height ?? 760,
        ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
        /* Kissopen's native desktop minimum; AppShell states the same contract. */
        minWidth: 720,
        minHeight: 480,
        ...(applicationIconPath ? { icon: applicationIconPath } : {}),
        show: false,
        ...platformWindowChrome(),
        webPreferences,
    };
}

/**
 * Keeps the window wearing the name this build was given. Every page here
 * carries the same `<title>`, and Chromium hands it to the window on load, which
 * would put one identical name on every checkout's window — exactly the
 * confusion this title exists to prevent.
 *
 * Refusing the page's title is not enough on its own: the name is also applied
 * around navigation, when no title event is emitted to refuse. So the window is
 * renamed again at each point a load can have overwritten it, which is cheap and
 * leaves no ordering to get wrong.
 */
function windowTitleHold(window: BrowserWindow): void {
    const hold = () => {
        if (!window.isDestroyed()) window.setTitle(windowTitle());
    };
    window.on("page-title-updated", (event) => {
        event.preventDefault();
        hold();
    });
    window.webContents.on("did-finish-load", hold);
    window.webContents.on("did-navigate", hold);
    window.webContents.on("did-navigate-in-page", hold);
    hold();
}

function windowGeometryRemember(window: BrowserWindow): void {
    const remember = () => {
        if (!window.isDestroyed()) desktopWindowStateStore.remember(window.getNormalBounds());
    };
    window.on("move", remember);
    window.on("resize", remember);
    remember();
}

/**
 * The conversation the bar last put something into.
 *
 * Remembered so "open the conversation" opens that one rather than whatever
 * the window happened to be showing. It is a session id and nothing else: the
 * bar never holds a transcript.
 */
let quickBarConversation: string | undefined;

/*
 * Whether the window is being held back.
 *
 * A launch at login is the login item's, not a person's: the app takes its
 * place in the menu bar and starts this machine's Agent, and the window waits
 * until somebody asks for it — the Dock, the menu bar item, a second launch.
 * Once asked, this stays false for the rest of the run.
 */
let windowDeferred = launchedAtLogin();

/** Brings the window forward, opening one when this run has none. */
function windowShow(): void {
    windowDeferred = false;
    const existing = windowLifecycle.get();
    const window = existing ?? windowSynchronize(runtime.get());
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
}

/**
 * Where the bar loads its document from, in this flavour and this run.
 *
 * Computed on each summon rather than once, because a development run's server
 * address is not known until it is up, and a bar that captured an address at
 * start-up would hold a stale one for the life of the process.
 */
function quickBarAddressCurrent(): { rendererUrl: string; preloadPath: string } {
    return {
        rendererUrl: quickBarAddress(rendererBase()),
        preloadPath: join(dirname, "preload.cjs"),
    };
}

/** Where this flavour serves the renderer from, in this run. */
function rendererBase(): string {
    const hostedOrigin =
        desktopFlavor.kind === "local-web" ? desktopFlavor.rendererOrigin : undefined;
    const developmentUrl = hostedOrigin ? undefined : process.env.VITE_DEV_SERVER_URL;
    return hostedOrigin
        ? `${hostedOrigin}/?desktop=1&mode=local`
        : (developmentUrl ?? pathToFileURL(join(dirname, "renderer", "index.html")).toString());
}

function localWindowCreate(bounds?: DesktopWindowBounds) {
    const hostedOrigin =
        desktopFlavor.kind === "local-web" ? desktopFlavor.rendererOrigin : undefined;
    const developmentUrl = hostedOrigin ? undefined : process.env.VITE_DEV_SERVER_URL;
    const rendererPath = join(dirname, "renderer", "index.html");
    const hostedUrl = hostedOrigin ? `${hostedOrigin}/?desktop=1&mode=local` : undefined;
    const rendererUrl = hostedUrl ?? developmentUrl ?? pathToFileURL(rendererPath).toString();
    const window = new BrowserWindow({
        ...windowOptions(bounds, {
            // The build a window runs is fixed for its whole life, so the preload
            // is handed it as a launch argument rather than made to ask for it:
            // the shell can then render its identity in the first frame.
            ...(buildIdentity
                ? {
                      additionalArguments: [
                          `${buildIdentityArgument}${JSON.stringify(buildIdentity)}`,
                          ...(desktopDebugEnabled ? [debugMetricsArgument] : []),
                      ],
                  }
                : desktopDebugEnabled
                  ? { additionalArguments: [debugMetricsArgument] }
                  : {}),
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(dirname, "preload.cjs"),
            sandbox: true,
            webviewTag: true,
        }),
    });
    if (process.platform === "win32") windowsWithTitleBarOverlay.add(window);
    kissopenAgentRendererSession?.windowRegister(
        window.webContents,
        rendererUrl,
        developmentUrl !== undefined || hostedOrigin !== undefined,
    );
    if (desktopDebugEnabled) {
        desktopDebugLog(`renderer window created; loading ${rendererUrl}`);
        window.webContents.on("dom-ready", () =>
            desktopDebugLog(`renderer DOM ready: ${window.webContents.getURL()}`),
        );
        window.webContents.on("did-finish-load", () =>
            desktopDebugLog(`renderer finished loading: ${window.webContents.getURL()}`),
        );
        window.webContents.on(
            "did-fail-load",
            (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
                if (isMainFrame)
                    desktopDebugError(
                        `renderer failed to load ${validatedURL} (${errorCode} ${errorDescription})`,
                    );
            },
        );
        // Renderer output is intentionally mirrored only in explicit local
        // debug mode; it may contain URLs or other development-only details.
        window.webContents.on("console-message", (details) =>
            desktopDebugLog(
                `renderer console level=${details.level}: ${details.message} (${details.sourceId}:${details.lineNumber})`,
            ),
        );
        window.webContents.on("render-process-gone", (_event, details) =>
            desktopDebugError(
                `renderer process exited (${details.reason}, code ${details.exitCode})`,
            ),
        );
        window.webContents.on("unresponsive", () =>
            desktopDebugError("renderer became unresponsive"),
        );
        window.webContents.on("responsive", () => desktopDebugLog("renderer responsive again"));
    }
    windowTitleHold(window);
    windowGeometryRemember(window);
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (browserWebUrl(url)) browserOpenPublish(window, url);
        else if (url.startsWith("mailto:")) void shell.openExternal(url);
        return { action: "deny" };
    });
    browserGuestAttach(window);
    const preventUntrustedNavigation = (event: Electron.Event, url: string) => {
        const allowed = hostedOrigin
            ? localWebNavigationAllowed(url, hostedOrigin)
            : rendererNavigationAllowed(url, rendererUrl, developmentUrl !== undefined);
        if (!allowed) event.preventDefault();
    };
    window.webContents.on("will-navigate", preventUntrustedNavigation);
    window.webContents.on("will-redirect", preventUntrustedNavigation);
    const ownerId = window.webContents.id;
    // A document is not a window. The same `webContents` survives a reload and a
    // main-frame navigation, so setup's idea of who it is working for advances
    // with the document rather than with the window: work started by the page
    // that was here a moment ago is not owed to the page that replaced it.
    window.webContents.on("did-start-navigation", (details) => {
        if (!details.isMainFrame) return;
        if (!details.isSameDocument) desktopProfilerController?.navigationStarted();
        presentationAdvance();
    });
    presentationAdvance();
    const cleanup = () => {
        presentationAdvance();
        desktopProfilerController?.refresh();
        // The mark on the Dock belongs to the window that reported it. This one
        // is going away — reloaded, gone, or replaced — so it takes its own mark
        // with it, unless another window is already presenting and has set its
        // own; wiping that would leave the icon lying about the live window.
        const presenting = windowLifecycle.get();
        if (!presenting || presenting.webContents.id === ownerId) dockBadgeClear();
    };
    window.webContents.on("render-process-gone", cleanup);
    window.webContents.on("destroyed", cleanup);
    // macOS full screen hides the traffic lights without changing anything the
    // renderer can query, so the window tells it directly and the shell drops the
    // lane it reserves for them.
    const windowStatePublish = () => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) return;
        window.webContents.send(desktopIpc.windowStateChanged, {
            fullScreen: window.isFullScreen(),
        });
    };
    window.on("enter-full-screen", windowStatePublish);
    window.on("leave-full-screen", windowStatePublish);
    // Back and Forward. The window owns its stack, so only a direction travels;
    // where it lands is the renderer's to decide.
    const navigationStepPublish = (direction: "back" | "forward") => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) return;
        window.webContents.send(desktopIpc.navigationStep, {
            direction,
        } satisfies DesktopNavigationStep);
    };
    // The mouse's side buttons on Windows and Linux; macOS delivers the same
    // buttons to the renderer as pointer buttons, and they are read there.
    window.on("app-command", (_event, command) => {
        if (command === "browser-backward") navigationStepPublish("back");
        if (command === "browser-forward") navigationStepPublish("forward");
    });
    // macOS two-finger swipe, delivered only while its system preference is on.
    window.on("swipe", (_event, direction) => {
        if (direction === "right") navigationStepPublish("back");
        if (direction === "left") navigationStepPublish("forward");
    });
    window.webContents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cleanup();
    });
    return {
        load: () => {
            const load = hostedUrl
                ? window.loadURL(hostedUrl)
                : developmentUrl
                  ? window.loadURL(developmentUrl)
                  : window.loadFile(rendererPath);
            return load.catch((error) => {
                desktopDebugError("renderer load promise rejected", error);
                throw error;
            });
        },
        window,
    };
}

/**
 * Every Kissopen Agent proxy this process is currently running. A file may be shown in a
 * window of its own only if its address is on one of them, which is what keeps a
 * privileged window pointed at this machine's own KISSOPEN Agents and nothing else.
 */
function mediaPreviewBases(): readonly (string | undefined)[] {
    const snapshot = runtime.get();
    return [
        snapshot.phase === "ready" && snapshot.activeTarget.authentication === "kissopenAgent"
            ? snapshot.activeTarget.kissopenAgentHttpUrl
            : undefined,
    ];
}

/**
 * Keeps the preview window named after the file rather than after the bundle.
 * Every page in this build carries the same `<title>`, which Chromium would
 * otherwise hand to the window and put one generic name on a window whose whole
 * job is to say which file it is showing.
 */
function mediaPreviewNameHold(window: BrowserWindow): void {
    const hold = () => {
        if (window.isDestroyed()) return;
        window.setTitle(
            mediaPreviewSubject ? mediaPreviewTitle(mediaPreviewSubject.path) : windowTitle(),
        );
    };
    window.on("page-title-updated", (event) => {
        event.preventDefault();
        hold();
    });
    window.webContents.on("did-finish-load", hold);
    window.webContents.on("did-navigate", hold);
    hold();
}

/**
 * The window one file is shown in, outside the application window.
 *
 * It is the same renderer document, loaded with the view it should mount, so it
 * inherits the page's Content-Security-Policy, context isolation, and sandbox
 * rather than being a second, laxer boundary. It is launched with the argument
 * that makes the preload hand it the preview bridge instead of the
 * application's, so it can ask this process for the file, close itself, and
 * nothing else. It hosts no plugin bundle and no browser guest, opens no window,
 * and cannot leave the one document it was opened with.
 */
function mediaPreviewWindowCreate(): BrowserWindow {
    const hostedOrigin =
        desktopFlavor.kind === "local-web" ? desktopFlavor.rendererOrigin : undefined;
    const developmentUrl = hostedOrigin ? undefined : process.env.VITE_DEV_SERVER_URL;
    const rendererPath = join(dirname, "renderer", "index.html");
    const address = (base: string): string => {
        const url = new URL(base);
        url.searchParams.set(mediaPreviewView.key, mediaPreviewView.value);
        return url.toString();
    };
    const rendererUrl = hostedOrigin
        ? address(`${hostedOrigin}/?desktop=1&mode=local`)
        : developmentUrl
          ? address(developmentUrl)
          : address(pathToFileURL(rendererPath).toString());
    const window = new BrowserWindow({
        backgroundColor: windowBackgroundColor(),
        title: windowTitle(),
        width: 1100,
        height: 760,
        minWidth: 480,
        minHeight: 360,
        ...(applicationIconPath ? { icon: applicationIconPath } : {}),
        show: false,
        webPreferences: {
            additionalArguments: [mediaPreviewArgument],
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(dirname, "preload.cjs"),
            sandbox: true,
        },
    });
    mediaPreviewNameHold(window);
    kissopenAgentRendererSession?.windowRegister(
        window.webContents,
        rendererUrl,
        developmentUrl !== undefined || hostedOrigin !== undefined,
        true,
    );
    // A preview window opens no windows and goes nowhere: a link inside it
    // would be a link inside a picture or a recording, which does not exist.
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const stay = (event: Electron.Event, candidate: string) => {
        if (!mediaPreviewNavigationAllowed(candidate, rendererUrl)) event.preventDefault();
    };
    window.webContents.on("will-navigate", stay);
    window.webContents.on("will-redirect", stay);
    window.once("ready-to-show", () => {
        if (window.isDestroyed()) return;
        // Maximized rather than macOS full screen: full screen would take the
        // file to a Space of its own and hide the window it was opened from,
        // which is the opposite of looking at a file beside the work it belongs to.
        window.maximize();
        window.show();
    });
    window.on("closed", () => {
        if (mediaPreviewWindow === window) {
            mediaPreviewWindow = undefined;
            mediaPreviewSubject = undefined;
        }
    });
    // A window that never loaded is not a window showing a file. It is
    // retired rather than shown empty, so the next open builds a live one instead
    // of reusing a blank frame that would answer nothing it is sent.
    const failed = () => {
        if (mediaPreviewWindow === window) {
            mediaPreviewWindow = undefined;
            mediaPreviewSubject = undefined;
        }
        if (!window.isDestroyed()) window.destroy();
    };
    window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
        // Only the document failing counts, and only when it failed rather than
        // was superseded: an aborted load (-3) is a load that was replaced.
        if (isMainFrame && code !== -3) failed();
    });
    // A renderer that died leaves a frame that can still be raised and sent
    // files, and would answer none of them. It retires on the same path as a
    // document that never arrived.
    window.webContents.on("render-process-gone", failed);
    void window.loadURL(rendererUrl).catch(failed);
    return window;
}

/** Points the preview window at `preview`, opening it the first time. */
function mediaPreviewShow(preview: DesktopMediaPreview): void {
    mediaPreviewSubject = preview;
    const existing = mediaPreviewWindow;
    if (existing && !existing.isDestroyed()) {
        existing.setTitle(mediaPreviewTitle(preview.path));
        if (!existing.webContents.isDestroyed())
            existing.webContents.send(desktopIpc.mediaPreviewChanged, preview);
        if (existing.isMinimized()) existing.restore();
        existing.show();
        existing.focus();
        return;
    }
    mediaPreviewWindow = mediaPreviewWindowCreate();
}

/**
 * Retires the preview window once the address behind it can no longer be served.
 * The file is addressed on a KISSOPEN Agent proxy, so a KISSOPEN Agent that goes away takes the
 * window with it rather than leaving a frame around a request that will now fail.
 */
function mediaPreviewRevalidate(): void {
    const window = mediaPreviewWindow;
    if (!window || window.isDestroyed()) return;
    const subject = mediaPreviewSubject;
    if (subject && mediaPreviewAddressAllowed(subject.url, mediaPreviewBases())) return;
    mediaPreviewSubject = undefined;
    mediaPreviewWindow = undefined;
    window.destroy();
}

function windowSynchronize(snapshot: ReturnType<DesktopRuntime["get"]>): BrowserWindow | undefined {
    if (windowDeferred) return undefined;
    const restoredBounds = desktopWindowStateStore.restore(
        screen.getAllDisplays(),
        screen.getPrimaryDisplay(),
    );
    if (desktopFlavor.kind === "local-web")
        return windowLifecycle.synchronize("local-web", (bounds) =>
            localWindowCreate(bounds ?? restoredBounds),
        );
    return windowLifecycle.synchronize(desktopWindowTarget(snapshot).key, (bounds) =>
        localWindowCreate(bounds ?? restoredBounds),
    );
}

/*
 * One zoom step, and the report that goes with it.
 *
 * The factor is read back after the level is set rather than predicted from it,
 * so a step the engine refused at its own floor or ceiling reports where the
 * window actually ended up. The report is sent unconditionally, including when
 * the level did not move: ⌘0 at 100% and ⌘− against the floor are exactly the
 * two moments the reader needs telling that the command was heard.
 */
function zoomStep(next: (level: number) => number): void {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!window) return;
    const contents = window.webContents;
    contents.zoomLevel = next(contents.zoomLevel);
    contents.send(desktopIpc.zoomChanged, Math.round(contents.zoomFactor * 100));
}

/*
 * The View menu, stated rather than taken from `role: "viewMenu"`. The roles
 * zoom the window without telling it, and a window that cannot hear its own
 * zoom cannot show what it is now at. The items and their accelerators are the
 * roles' own, including the half-level step.
 */
// A function rather than a constant: its labels are read when the menu is built,
// in the language chosen then, not once when this module loads.
const viewMenu = (): MenuItemConstructorOptions => ({
    label: t("View"),
    submenu: [
        { role: "reload", label: t("Reload") },
        { role: "forceReload", label: t("Force Reload") },
        { role: "toggleDevTools", label: t("Toggle Developer Tools") },
        { type: "separator" },
        { label: t("Actual Size"), accelerator: "CmdOrCtrl+0", click: () => zoomStep(() => 0) },
        {
            label: t("Zoom In"),
            accelerator: "CmdOrCtrl+Plus",
            click: () => zoomStep((level) => level + 0.5),
        },
        /* The key actually under the finger. "Plus" is the shifted name of it,
           and it is the one the menu prints, but nobody holds shift to zoom;
           taking the menu on ourselves means owning both spellings, where the
           role had the platform's own. Hidden, so the menu still reads ⌘+. */
        {
            label: t("Zoom In"),
            accelerator: "CmdOrCtrl+=",
            click: () => zoomStep((level) => level + 0.5),
            visible: false,
        },
        {
            label: t("Zoom Out"),
            accelerator: "CmdOrCtrl+-",
            click: () => zoomStep((level) => level - 0.5),
        },
        { type: "separator" },
        { role: "togglefullscreen", label: t("Toggle Full Screen") },
    ],
});

function applicationMenuInstall(snapshot: ReturnType<DesktopRuntime["get"]>): void {
    const targets = desktopInstanceMenuTargets(snapshot);
    const instances: MenuItemConstructorOptions[] = targets.map((target) => ({
        label: target.label,
        type: "checkbox",
        checked: target.active,
        click: () => void runtime.topologySelect(target.id).catch(() => undefined),
    }));
    if (instances.length === 0) instances.push({ label: t("No saved instances"), enabled: false });
    // The About panel names the product in the reader's language, as the menu does.
    app.setAboutPanelOptions({ applicationName: applicationDisplayName() });
    instances.push(
        { type: "separator" },
        {
            label: t("Choose or Add Instance…"),
            accelerator: "CmdOrCtrl+Shift+I",
            click: () => void runtime.reset().catch(() => undefined),
        },
    );
    const navigationStepSend = (direction: "back" | "forward"): void => {
        const focused = BrowserWindow.getFocusedWindow();
        if (!focused || focused.webContents.isDestroyed()) return;
        focused.webContents.send(desktopIpc.navigationStep, {
            direction,
        } satisfies DesktopNavigationStep);
    };
    const template: MenuItemConstructorOptions[] = [
        process.platform === "darwin"
            ? {
                  // macOS reads the bold first menu from this label. Left to the
                  // default it is the running binary's name — "Electron" in any
                  // build that is not packaged — which names the toolkit rather
                  // than the app.
                  label: applicationDisplayName(),
                  role: "appMenu",
                  submenu: [
                      {
                          role: "about",
                          label: t("About {name}", { name: applicationDisplayName() }),
                      },
                      { type: "separator" },
                      { role: "services" },
                      { type: "separator" },
                      { role: "hide" },
                      { role: "hideOthers" },
                      { role: "unhide" },
                      { type: "separator" },
                      { role: "quit", label: t("Quit {name}", { name: applicationDisplayName() }) },
                  ],
              }
            : {
                  // The services/hide roles above exist only on macOS; other
                  // platforms put quit under an ordinary first menu.
                  label: applicationDisplayName(),
                  submenu: [
                      {
                          role: "about",
                          label: t("About {name}", { name: applicationDisplayName() }),
                      },
                      { type: "separator" },
                      { role: "quit", label: t("Quit {name}", { name: applicationDisplayName() }) },
                  ],
              },
        ...(desktopFlavor.kind === "local-web"
            ? []
            : [{ label: t("Instances"), submenu: instances } as MenuItemConstructorOptions]),
        // Spelled out rather than `role: "editMenu"`: a role menu is labelled in
        // the language Electron started in, not the one the reader chose.
        {
            label: t("Edit"),
            submenu: [
                { role: "undo", label: t("Undo") },
                { role: "redo", label: t("Redo") },
                { type: "separator" },
                { role: "cut", label: t("Cut") },
                { role: "copy", label: t("Copy") },
                { role: "paste", label: t("Paste") },
                { role: "delete", label: t("Delete") },
                { type: "separator" },
                { role: "selectAll", label: t("Select All") },
            ],
        },
        viewMenu(),
        {
            // The two items every browser puts here, on the same keys. They
            // carry a direction to the focused window, which alone knows where
            // going back lands.
            label: t("History"),
            submenu: [
                {
                    label: t("Back"),
                    accelerator: "CmdOrCtrl+[",
                    click: () => navigationStepSend("back"),
                },
                {
                    label: t("Forward"),
                    accelerator: "CmdOrCtrl+]",
                    click: () => navigationStepSend("forward"),
                },
            ],
        },
        process.platform === "darwin"
            ? { role: "windowMenu", label: t("Window") }
            : {
                  label: t("Window"),
                  submenu: [
                      { role: "minimize", label: t("Minimize") },
                      { role: "close", label: t("Close") },
                  ],
              },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

void app
    .whenReady()
    .then(async () => {
        if (desktopGymActive) app.dock?.hide();
        kissopenAgentRendererSession = await kissopenAgentRendererSessionCreate(
            electronSession.defaultSession,
        );
        htmlPreviewProxy = await htmlPreviewProxyCreate();
        await htmlPreviewSessionConfigure();
        const desktopRoot = join(app.getPath("userData"), "desktop");
        desktopWindowStateStore = await DesktopWindowStateStore.create(
            join(desktopRoot, "window-state.json"),
        );
        desktopConfigStore = await DesktopConfigStore.create(join(desktopRoot, "config.json"));
        // The menus and dialogs speak the language the reader chose in the
        // window, read from the same saved preferences.
        localeSet(
            localeResolve(
                desktopConfigStore.get().language ?? "system",
                app.getPreferredSystemLanguages(),
            ),
        );
        // Apply the remembered source before the first window is created, so
        // its native background and Chromium guests start in the chosen theme.
        nativeTheme.themeSource = desktopConfigStore.get().appearance;
        nativeTheme.on("updated", windowAppearanceApply);
        // The Dock icon follows the same appearance the window does, set now
        // that the remembered source is in force and re-set on every change.
        if (!desktopGymActive) dockAppearanceApply();
        nativeTheme.on("updated", dockAppearanceApply);
        const discoveredEnvironment = await localRuntimeProbe().then(
            (probe) => probe.environment,
            () => process.env,
        );
        const launchEnvironment = communityAgentEnvironment(
            discoveredEnvironment,
            process.env.KISSOPEN_HOME_DIR!,
        );
        const managedDaemon = true;
        if (managedDaemon) {
            // Packaged runs carry the agent in resources. A development run takes
            // the one this repository just built, so `pnpm dev` reaches a working
            // window instead of waiting on a release this fork never published.
            await kissopenAgentArtifactInstall(
                app.isPackaged
                    ? join(process.resourcesPath, "kissopen-agent")
                    : join(app.getAppPath(), "build", "kissopen-agent", process.arch),
                launchEnvironment,
            );
        }
        await kissopenAgentMenuBarDisable();
        daemonController = await DesktopDaemonController.create({
            channel:
                appVersion.includes("preview") || desktopFlavor.kind === "local-web"
                    ? "preview"
                    : "stable",
            environment: launchEnvironment,
            launchEnvironment: async () => launchEnvironment,
            managed: managedDaemon,
            updatesEnabled: false,
        });
        daemonController.subscribe((snapshot) => {
            const window = windowLifecycle.get();
            if (window && !window.isDestroyed())
                window.webContents.send(desktopIpc.daemonChanged, snapshot);
        });
        const connector = localKissopenAgentConnectorCreate({
            daemonBinary: daemonController,
            debug: desktopDebugLog,
            environment: launchEnvironment,
        });
        const rendererOrigin =
            desktopFlavor.kind === "local-web"
                ? desktopFlavor.rendererOrigin
                : developmentRendererOrigin;
        runtime = await DesktopRuntime.create(
            {
                root: desktopRoot,
            },
            {
                localKissopenAgentConnector: connector,
                ...(kissopenAgentRendererSession
                    ? { rendererProxy: kissopenAgentRendererSession.proxy }
                    : {}),
                // A hosted local renderer and the Vite development renderer both
                // call the loopback proxy cross-origin. Only their exact,
                // build-owned origin receives CORS access.
                ...(rendererOrigin ? { rendererOrigin } : {}),
                ...(htmlPreviewProxy ? { htmlPreview: htmlPreviewProxy } : {}),
                fileOpen: (path: string) => shell.openPath(path),
            },
        );
        const debugController = new DesktopDebugController({
            changed: desktopDebugPublish,
            daemon: () => {
                const snapshot = runtime.get();
                if (snapshot.phase !== "ready" || snapshot.mode !== "local") return undefined;
                const connectionId = snapshot.connectionId;
                return {
                    connectionId,
                    startInspector: () => runtime.localInspectorStart(connectionId),
                    stopInspector: () => runtime.localInspectorStop(connectionId),
                };
            },
            renderer: () => {
                const window = windowLifecycle.get();
                return window && !window.isDestroyed() ? window.webContents : undefined;
            },
        });
        desktopDebugController = debugController;
        if (desktopDebugEnabled) {
            // The main inspector was opened before app readiness so a failure
            // during runtime initialization is still attachable. This call
            // records that existing endpoint in the controller as well.
            void debugController.start("main").then((debugSnapshot) => {
                if (debugSnapshot.main.status !== "running")
                    desktopDebugError(
                        `main inspector state is ${debugSnapshot.main.status}${
                            debugSnapshot.main.error ? `: ${debugSnapshot.main.error}` : ""
                        }`,
                    );
            });
        }
        desktopProfilerController = new DesktopProfilerController({
            artifactRoot: desktopRoot,
            buildMode: desktopProfilerBuildMode(),
            ...(desktopProfilerBuildLabel() ? { buildLabel: desktopProfilerBuildLabel() } : {}),
            changed: desktopProfilerPublish,
            renderer: () => {
                const window = windowLifecycle.get();
                return window && !window.isDestroyed() ? window.webContents : undefined;
            },
        });
        // First-run setup follows the runtime rather than owning a connection of
        // its own: the daemon is started, connected, and left running by the
        // runtime alone, and setup only reads its state and asks it to try again.
        onboarding = await LocalOnboarding.create({
            ...(managedDaemon ? { daemon: daemonController } : {}),
            directoryPick: () => directoryPickShow(windowLifecycle.get()),
            // Which window setup is working for. A native picker outlives the
            // window that opened it, so setup reads this again before it acts on
            // what came back.
            presentation: presentationIdentity,
            recordPath: join(desktopRoot, "local-onboarding.json"),
            runtime,
        });
        onboarding.subscribe((snapshot) => {
            const window = windowLifecycle.get();
            if (window && !window.isDestroyed())
                window.webContents.send(desktopIpc.onboardingChanged, snapshot);
        });
        const updater = desktopUpdaterCreate({
            preview: desktopFlavor.kind === "local-web",
            // Only signed stable macOS bundles use KissOpen's independent update feed.
            // Development and preview builds never contact an update service.
            packaged:
                app.isPackaged &&
                process.platform === "darwin" &&
                desktopFlavor.kind === "standard" &&
                !appVersion.includes("preview"),
            update: (snapshot) => runtime.updateSet(snapshot),
        });
        runtime.subscribe((snapshot) => {
            daemonController.runtimeSet(snapshot);
            desktopDebugRuntimeLog(snapshot);
            const connectionId = snapshot.phase === "ready" ? snapshot.connectionId : undefined;
            if (connectionId !== browserProxyConnectionId) {
                for (const proxy of browserProxies.values()) proxy.connectionsClose();
                browserProxyConnectionId = connectionId;
            }
            mediaPreviewRevalidate();
            const previous = windowLifecycle.get();
            const window = windowSynchronize(snapshot);
            applicationMenuInstall(snapshot);
            if (
                window &&
                window === previous &&
                (desktopFlavor.kind === "local-web" ||
                    desktopWindowTarget(snapshot).kind === "local")
            )
                window.webContents.send(desktopIpc.runtimeChanged, snapshot);
            debugController.refresh();
            desktopDebugDaemonStartIfReady(snapshot);
            desktopProfilerController.refresh();
        });
        daemonController.runtimeSet(runtime.get());
        ipcMain.handle(desktopIpc.kissopenRequest, (event, request) => {
            desktopDaemonSenderRequire(event.sender);
            return kissopenCloudRequest(request, () => daemonController.restart());
        });
        ipcMain.handle(desktopIpc.kissopenFileOpen, (_event, url: unknown, name: unknown) =>
            kissopenFileOpen(
                typeof url === "string" ? url : "",
                typeof name === "string" ? name : "",
            ),
        );
        // A window that has just opened asks; every later change is pushed.
        ipcMain.handle(desktopIpc.relayGet, () => relayCurrent());
        ipcMain.handle(desktopIpc.relayConversation, (_event, sessionId: unknown) =>
            relayConversationRead(typeof sessionId === "string" ? sessionId : ""),
        );
        ipcMain.handle(
            desktopIpc.relaySay,
            (
                _event,
                sessionId: unknown,
                text: unknown,
                mode: unknown,
                files: unknown,
                displayText: unknown,
            ) =>
                relaySaySend(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof text === "string" ? text : "",
                    (mode ?? undefined) as
                        | { model?: string; modelProviderId?: string; effort?: string }
                        | undefined,
                    Array.isArray(files) ? (files as RelayAttachment[]) : [],
                    typeof displayText === "string" && displayText.trim().length > 0
                        ? displayText
                        : undefined,
                ),
        );
        ipcMain.handle(
            desktopIpc.relayDecide,
            (_event, sessionId: unknown, requestId: unknown, approved: unknown) =>
                relayDecideRequest(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof requestId === "string" ? requestId : "",
                    approved === true,
                ),
        );
        ipcMain.handle(
            desktopIpc.relayAnswerQuestion,
            (_event, sessionId: unknown, requestId: unknown, answers: unknown) =>
                relayAnswerQuestion(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof requestId === "string" ? requestId : "",
                    questionAnswers(answers),
                ),
        );
        ipcMain.handle(
            desktopIpc.relayCancelQuestion,
            (_event, sessionId: unknown, requestId: unknown) =>
                relayCancelQuestion(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof requestId === "string" ? requestId : "",
                ),
        );
        ipcMain.handle(desktopIpc.relayClear, (_event, sessionId: unknown) =>
            relayClearSession(typeof sessionId === "string" ? sessionId : ""),
        );
        ipcMain.handle(desktopIpc.relayArchive, (_event, sessionId: unknown) =>
            relayArchiveSession(typeof sessionId === "string" ? sessionId : ""),
        );
        ipcMain.handle(desktopIpc.relayDelete, (_event, sessionId: unknown) =>
            relayDeleteSession(typeof sessionId === "string" ? sessionId : ""),
        );
        ipcMain.handle(desktopIpc.relayAbort, (_event, sessionId: unknown) =>
            relayAbortRun(typeof sessionId === "string" ? sessionId : ""),
        );
        ipcMain.handle(desktopIpc.relayGitState, (_event, sessionId: unknown) =>
            relayGitStateRead(typeof sessionId === "string" ? sessionId : ""),
        );
        const asText = (value: unknown) => (typeof value === "string" ? value : "");
        const asCount = (value: unknown) =>
            typeof value === "number" && Number.isFinite(value) ? value : 0;
        ipcMain.handle(desktopIpc.relayTerminalList, (_event, sessionId: unknown) =>
            relayTerminalList(asText(sessionId)),
        );
        ipcMain.handle(
            desktopIpc.relayTerminalCreate,
            (_event, sessionId: unknown, request: unknown) =>
                relayTerminalCreate(
                    asText(sessionId),
                    (request ?? {}) as { cols?: number; rows?: number },
                ),
        );
        ipcMain.handle(
            desktopIpc.relayTerminalResize,
            (_event, sessionId: unknown, terminalId: unknown, cols: unknown, rows: unknown) =>
                relayTerminalResize(
                    asText(sessionId),
                    asText(terminalId),
                    asCount(cols),
                    asCount(rows),
                ),
        );
        ipcMain.handle(
            desktopIpc.relayTerminalStop,
            (_event, sessionId: unknown, terminalId: unknown) =>
                relayTerminalStop(asText(sessionId), asText(terminalId)),
        );
        ipcMain.handle(
            desktopIpc.relayTerminalAttach,
            (_event, sessionId: unknown, terminalId: unknown) =>
                relayTerminalAttach(asText(sessionId), asText(terminalId)),
        );
        ipcMain.handle(desktopIpc.relayTerminalWrite, (_event, handle: unknown, chunk: unknown) =>
            relayTerminalWrite(
                asCount(handle),
                chunk instanceof Uint8Array ? chunk : new Uint8Array(),
            ),
        );
        ipcMain.on(desktopIpc.relayTerminalDetach, (_event, handle: unknown) => {
            relayTerminalDetach(asCount(handle));
        });
        /*
         * The file is validated by the shared reader against its own schema
         * before anything is asked of the other machine, so what crosses here
         * is passed on rather than trusted.
         */
        ipcMain.handle(
            desktopIpc.relayGitFile,
            (_event, sessionId: unknown, gitBase: unknown, file: unknown) =>
                relayGitFileRead(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof gitBase === "string" ? gitBase : "",
                    file as KissopenAgentGitFile,
                ),
        );
        /*
         * A file named by a conversation on another machine, opened here.
         *
         * The bytes are fetched over the relay and the copy is handed to this
         * machine's own opener — the same `shell.openPath` a local workspace
         * uses, and with the same refusal of anything that would be run rather
         * than read.
         */
        ipcMain.handle(desktopIpc.relayFileOpen, (_event, sessionId: unknown, path: unknown) =>
            relayFileOpen(
                typeof sessionId === "string" ? sessionId : "",
                typeof path === "string" ? path : "",
                (target: string) => shell.openPath(target),
            ),
        );
        ipcMain.handle(
            desktopIpc.relayFileRead,
            (_event, sessionId: unknown, path: unknown, project: unknown) =>
                relayFileRead(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof path === "string" ? path : "",
                    project,
                ),
        );
        ipcMain.handle(
            desktopIpc.relayFileUpload,
            (_event, sessionId: unknown, path: unknown, bytes: unknown) =>
                relayFileUpload(
                    typeof sessionId === "string" ? sessionId : "",
                    typeof path === "string" ? path : "",
                    bytes instanceof Uint8Array ? bytes : new Uint8Array(),
                ),
        );
        ipcMain.handle(desktopIpc.relayDirectoryList, (_event, sessionId: unknown, path: unknown) =>
            relayDirectoryList(
                typeof sessionId === "string" ? sessionId : "",
                typeof path === "string" ? path : "",
            ),
        );
        ipcMain.handle(desktopIpc.runtimeGet, () => runtime.get());
        ipcMain.handle(desktopIpc.desktopConfigGet, () => desktopConfigStore.get());
        ipcMain.handle(desktopIpc.desktopConfigWrite, async (_event, config: unknown) => {
            await desktopConfigStore.write(config);
            const locale = localeResolve(
                desktopConfigStore.get().language ?? "system",
                app.getPreferredSystemLanguages(),
            );
            if (locale === localeCurrent()) return;
            localeSet(locale);
            applicationMenuInstall(runtime.get());
        });
        ipcMain.handle(desktopIpc.cloudAuthCallbackTake, (event) => {
            desktopDaemonSenderRequire(event.sender);
            const callback = cloudAuthCallback;
            cloudAuthCallback = undefined;
            return callback;
        });
        ipcMain.handle(desktopIpc.cloudAuthCallbackPending, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return cloudAuthCallback !== undefined;
        });
        ipcMain.handle(desktopIpc.cloudAuthConfigurationGet, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return cloudAuthConfiguration;
        });
        ipcMain.handle(desktopIpc.cloudAuthOpen, (event, candidate: unknown) => {
            desktopDaemonSenderRequire(event.sender);
            if (typeof candidate !== "string")
                throw new Error("WorPar Agent returned an invalid Cloud authorization URL.");
            const url = new URL(candidate);
            if (url.protocol !== "https:")
                throw new Error("WorPar Agent returned an invalid Cloud authorization URL.");
            return shell.openExternal(url.href);
        });
        /*
         * A link out of a conversation, into the reader's own browser.
         *
         * http and https only, and parsed here rather than trusted: what
         * arrives is text an agent wrote, and everything else a URL can name
         * — a file, a program, a protocol handler — is something this window
         * must not hand to the operating system on its say-so.
         */
        ipcMain.handle(desktopIpc.linkOpen, async (_event, candidate: unknown) => {
            if (typeof candidate !== "string") return false;
            let url: URL;
            try {
                url = new URL(candidate);
            } catch {
                return false;
            }
            if (url.protocol !== "https:" && url.protocol !== "http:") return false;
            await shell.openExternal(url.href);
            return true;
        });
        ipcMain.handle(desktopIpc.daemonGet, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.get();
        });
        ipcMain.handle(desktopIpc.daemonDownload, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.download();
        });
        ipcMain.handle(desktopIpc.daemonStart, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.start();
        });
        ipcMain.handle(desktopIpc.daemonUpgrade, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.upgrade();
        });
        ipcMain.handle(desktopIpc.daemonCheck, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.checkForUpdate();
        });
        ipcMain.handle(desktopIpc.daemonInstall, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.install();
        });
        ipcMain.handle(desktopIpc.daemonInstallDismiss, (event) => {
            desktopDaemonSenderRequire(event.sender);
            daemonController.installDismiss();
        });
        ipcMain.handle(desktopIpc.daemonInstallKill, (event) => {
            desktopDaemonSenderRequire(event.sender);
            daemonController.installKill();
        });
        ipcMain.handle(desktopIpc.daemonRestart, (event) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.restart();
        });
        ipcMain.handle(desktopIpc.daemonVersionSelect, (event, version: unknown) => {
            desktopDaemonSenderRequire(event.sender);
            return daemonController.versionSelect(desktopDaemonVersionValidate(version));
        });
        ipcMain.handle(desktopIpc.debugGet, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.get();
        });
        ipcMain.handle(desktopIpc.debugAllStart, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.startAll();
        });
        ipcMain.handle(desktopIpc.debugAllStop, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.stopAll();
        });
        ipcMain.handle(desktopIpc.debugMainInspectorStart, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.start("main");
        });
        ipcMain.handle(desktopIpc.debugMainInspectorStop, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.stop("main");
        });
        ipcMain.handle(desktopIpc.debugRendererInspectorStart, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.start("renderer");
        });
        ipcMain.handle(desktopIpc.debugRendererInspectorStop, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.stop("renderer");
        });
        ipcMain.handle(desktopIpc.debugDaemonInspectorStart, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.start("daemon");
        });
        ipcMain.handle(desktopIpc.debugDaemonInspectorStop, (event) => {
            desktopDebugSenderRequire(event.sender);
            return debugController.stop("daemon");
        });
        ipcMain.handle(desktopIpc.profilerGet, (event) => {
            desktopProfilerSenderRequire(event.sender);
            return desktopProfilerController.get();
        });
        ipcMain.handle(desktopIpc.profilerStart, (event, request: unknown) => {
            desktopProfilerSenderRequire(event.sender);
            return desktopProfilerController.start(desktopProfilerRequestValidate(request));
        });
        ipcMain.handle(desktopIpc.profilerStop, (event) => {
            desktopProfilerSenderRequire(event.sender);
            return desktopProfilerController.stop();
        });
        ipcMain.on(desktopIpc.profilerReactMessage, (event, raw: unknown) => {
            const presenting = windowLifecycle.get();
            if (!presenting || presenting.webContents !== event.sender) return;
            const message: DesktopReactDevtoolsMessage | undefined =
                desktopReactDevtoolsMessageValidate(raw);
            if (message) desktopProfilerController.reactMessage(message);
        });
        ipcMain.handle(desktopIpc.browserProxyApply, (event, target: unknown) => {
            desktopDaemonSenderRequire(event.sender);
            if (event.senderFrame !== event.sender.mainFrame)
                throw new Error("Only WorPar can configure a browser profile.");
            return browserProxyApply(desktopBrowserProxyTargetValidate(target));
        });
        const browserSenderRequire = (event: Electron.IpcMainInvokeEvent) => {
            desktopDaemonSenderRequire(event.sender);
            if (event.senderFrame !== event.sender.mainFrame)
                throw new Error("Only the app can control its browser.");
        };
        ipcMain.handle(desktopIpc.browserPasswordGenerate, (event) => {
            browserSenderRequire(event);
            return browserPasswordGenerate(event.sender);
        });
        ipcMain.handle(desktopIpc.browserAutomationStart, (event, id: unknown, scope: unknown) => {
            browserSenderRequire(event);
            return browserAutomation.start(
                event.sender,
                browserBindingId(id),
                browserScopeValidate(scope),
            );
        });
        ipcMain.handle(desktopIpc.browserAutomationStop, (event, id: unknown) => {
            browserSenderRequire(event);
            browserAutomation.stop(event.sender, browserBindingId(id));
        });
        ipcMain.handle(
            desktopIpc.browserAutomationBind,
            (event, id: unknown, guestId: unknown, rawTarget: unknown) => {
                browserSenderRequire(event);
                const tabId = browserBindingId(id);
                const scope = browserAutomation.scope(event.sender, tabId);
                const target = desktopBrowserProxyTargetValidate(rawTarget);
                if (
                    scope.workspaceId !== target.workspaceId ||
                    (scope.kind === "local" ? scope.connectionId : null) !== target.connectionId
                )
                    throw new Error("Browser workspace mismatch.");
                const browser = browserProxies.get(browserPartition(target));
                const guest =
                    typeof guestId === "number" ? electronWebContents.fromId(guestId) : undefined;
                if (!guest || !browser?.owns(guest)) throw new Error("Invalid browser guest.");
                browserAutomation.bind(event.sender, tabId, guest);
            },
        );
        ipcMain.handle(
            desktopIpc.browserAutomationAction,
            (event, id: unknown, action: unknown) => {
                browserSenderRequire(event);
                if (action !== "pause" && action !== "resume" && action !== "close")
                    throw new Error("Invalid browser action.");
                return browserAutomation.action(event.sender, browserBindingId(id), action);
            },
        );
        ipcMain.handle(
            desktopIpc.browserCommand,
            (event, rawTarget: unknown, guestId: unknown, rawCommand: unknown) => {
                desktopDaemonSenderRequire(event.sender);
                if (
                    event.senderFrame !== event.sender.mainFrame ||
                    !Number.isSafeInteger(guestId) ||
                    (guestId as number) <= 0
                )
                    throw new Error("Invalid browser tab.");
                const target = desktopBrowserProxyTargetValidate(rawTarget);
                const browser = browserProxies.get(browserPartition(target));
                const guest = electronWebContents.fromId(guestId as number);
                if (
                    !browser ||
                    !guest ||
                    guest.hostWebContents !== event.sender ||
                    !browser.owns(guest)
                )
                    throw new Error("This browser tab does not belong to this workspace.");
                return browser.command(guest, desktopBrowserCommandValidate(rawCommand));
            },
        );
        ipcMain.handle(desktopIpc.applicationMenuOpen, () => {
            Menu.getApplicationMenu()?.popup();
        });
        // `nativeTheme` is Chromium's preferred-color-scheme source for every
        // WebContents in this process, including webview guests and nested
        // frames. Only the currently presented local window may choose it.
        ipcMain.on(desktopIpc.appearanceSet, (event, raw: unknown) => {
            const presenting = windowLifecycle.get();
            if (!presenting || presenting.webContents !== event.sender) return;
            if (raw !== "dark" && raw !== "light" && raw !== "system") return;
            nativeTheme.themeSource = raw;
            windowAppearanceApply();
        });
        // One-way: the window states what is waiting and the shell marks the
        // icon. Only the window this shell is currently presenting may do so, so
        // a superseded renderer still shutting down cannot repaint over the one
        // that replaced it, and a malformed count is dropped rather than guessed.
        ipcMain.on(desktopIpc.dockUnreadSet, (event, raw: unknown) => {
            const presenting = windowLifecycle.get();
            if (!presenting || presenting.webContents !== event.sender) return;
            const count = dockUnreadCountRead(raw);
            if (count !== undefined) dockBadgeApply(count);
        });
        ipcMain.handle(desktopIpc.mediaPreviewOpen, (event, raw: unknown) => {
            // Only the window this shell is presenting opens a preview window, so
            // a superseded renderer still shutting down cannot put one on screen
            // after the window that asked for it is gone.
            const presenting = windowLifecycle.get();
            if (!presenting || presenting.webContents !== event.sender)
                throw new Error("This window cannot open a preview window.");
            // The renderer names the file; this process decides whether that
            // name is one of its own KISSOPEN Agent's, so a window is never opened onto an
            // address this build is not already serving.
            const preview = mediaPreviewResolve(raw, mediaPreviewBases());
            if (!preview)
                throw new Error("That file is not served by a WorPar Agent in this window.");
            mediaPreviewShow(preview);
        });
        ipcMain.handle(desktopIpc.mediaPreviewGet, (event) =>
            mediaPreviewWindow &&
            !mediaPreviewWindow.isDestroyed() &&
            mediaPreviewWindow.webContents === event.sender
                ? mediaPreviewSubject
                : undefined,
        );
        ipcMain.handle(desktopIpc.mediaPreviewClose, (event) => {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window && window === mediaPreviewWindow) window.close();
        });
        ipcMain.handle(desktopIpc.directoryPick, async (event) => {
            const owner = BrowserWindow.fromWebContents(event.sender);
            const options: OpenDialogOptions = {
                buttonLabel: t("Add"),
                // No `createDirectory`: what is chosen here becomes a project,
                // and Kissopen Agent only accepts the top level of a Git repository — so a
                // folder made in this dialog could only ever be refused.
                properties: ["openDirectory"],
                title: t("Choose a project folder"),
            };
            const result = owner
                ? await dialog.showOpenDialog(owner, options)
                : await dialog.showOpenDialog(options);
            return result.canceled ? undefined : result.filePaths[0];
        });
        ipcMain.handle(desktopIpc.onboardingGet, (event) => {
            onboardingSenderRequire(event.sender);
            return onboarding.get();
        });
        ipcMain.handle(desktopIpc.legacyCliPrepare, (event) =>
            legacyCli.prepare(legacyCliSenderCurrent(event)),
        );
        ipcMain.handle(desktopIpc.legacyCliConnect, (event) =>
            legacyCli.connect(legacyCliSenderCurrent(event)),
        );
        ipcMain.handle(desktopIpc.onboardingProjectChoose, (event) => {
            onboardingSenderRequire(event.sender);
            return onboarding.projectChoose();
        });
        ipcMain.handle(desktopIpc.onboardingChiefOfStaffComplete, (event) => {
            onboardingSenderRequire(event.sender);
            if (event.senderFrame !== event.sender.mainFrame)
                throw new Error("Only the desktop window can finish first-run setup.");
            return onboarding.chiefOfStaffComplete();
        });
        ipcMain.handle(desktopIpc.onboardingAssistantsContinue, (event) => {
            onboardingSenderRequire(event.sender);
            onboarding.assistantsContinue();
        });
        ipcMain.handle(desktopIpc.onboardingProfileCreate, (event, input: unknown) => {
            onboardingSenderRequire(event.sender);
            if (
                !input ||
                typeof input !== "object" ||
                typeof (input as { name?: unknown }).name !== "string" ||
                typeof (input as { email?: unknown }).email !== "string"
            )
                throw new Error("That profile is invalid.");
            const profile = input as { readonly email: string; readonly name: string };
            return onboarding.profileCreate({ email: profile.email, name: profile.name });
        });
        ipcMain.handle(desktopIpc.runtimeStart, (_event, request: unknown) =>
            runtime.start(desktopStartRequestValidate(request)),
        );
        ipcMain.handle(desktopIpc.runtimeRetry, () => runtime.retry());
        ipcMain.handle(desktopIpc.runtimeReset, () => runtime.reset());
        ipcMain.handle(desktopIpc.topologySelect, (_event, topologyId: unknown) =>
            runtime.topologySelect(desktopTopologyIdValidate(topologyId)),
        );
        ipcMain.handle(desktopIpc.updateInstall, () => updater.install());
        ipcMain.handle(desktopIpc.windowStateGet, (event) => ({
            fullScreen: BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
        }));
        windowSynchronize(runtime.get());
        applicationMenuInstall(runtime.get());
        /*
         * The menu bar item, and the bar its left button summons.
         *
         * Installed here rather than earlier because both of its commands need
         * something to reach: a window to bring forward, and a relay to say
         * something over. An item that appeared first would be an item whose
         * every press failed for a second.
         */
        ipcMain.handle(desktopIpc.quickBarSend, async (_event, text: unknown) => {
            if (typeof text !== "string" || !text.trim())
                return { ok: false, error: t("Nothing to send") };
            const sent = await relayCloudSay(text.trim());
            if (sent.ok) quickBarConversation = sent.sessionId;
            return sent.ok ? { ok: true } : { ok: false, error: sent.error };
        });
        ipcMain.handle(desktopIpc.quickBarClose, () => {
            quickBarHide();
        });
        // Sent, not invoked: the bar is telling the window its height, not
        // asking it anything.
        ipcMain.on(desktopIpc.quickBarHeight, (_event, height: unknown) => {
            if (typeof height === "number") quickBarResize(height);
        });
        ipcMain.handle(desktopIpc.quickBarOpenConversation, () => {
            quickBarHide();
            windowShow();
        });
        kissopenTrayInstall({
            open: () => windowShow(),
            quickBar: () => windowShow(),
            quit: () => app.quit(),
            ...(loginItemSupported()
                ? { loginItem: { get: loginItemEnabled, set: loginItemSet } }
                : {}),
        });
        // Resident by default, so scheduled tasks on this computer have
        // something here to take them. Once: a person who turns it off has
        // said something, and the menu bar item is where they turn it back on.
        // A local preview must not register itself to start at login automatically.
        desktopDebugRuntimeLog(runtime.get());
        desktopDebugDaemonStartIfReady(runtime.get());
        // Desktop and Agent updates are supplied only by verified local packages in this preview.
        app.on("activate", () => {
            windowDeferred = false;
            if (!windowLifecycle.get()) windowSynchronize(runtime.get());
        });
    })
    .catch((error: unknown) => {
        dialog.showErrorBox(
            t("WorPar could not start"),
            error instanceof Error ? error.message : t("The desktop runtime failed to initialize."),
        );
        app.quit();
    });

app.on("second-instance", () => {
    // Somebody opened the app again: whatever this run was holding back, they
    // want the window.
    windowShow();
});

/*
 * Closing the window is not quitting.
 *
 * macOS already behaves this way; elsewhere Electron would end the process
 * with its last window. The app stays for the same reason it is a login item:
 * scheduled tasks on this computer need it here, and the menu bar item is
 * where Quit lives.
 */
app.on("window-all-closed", () => {});

app.on("before-quit", (event) => {
    if (quitting || !runtime) return;
    event.preventDefault();
    if (quitCleanup) return;
    // One failed cleanup must not leave a visible window with a disposed Agent
    // connection. Defer each call so synchronous throws are contained too.
    quitCleanup = (async () => {
        const cleanups: readonly { name: string; close: () => void | Promise<void> }[] = [
            { name: "browser automation", close: () => browserAutomation.closeAll() },
            ...Array.from(browserProxies.values(), (proxy) => ({
                name: "browser proxy",
                close: () => proxy.close(),
            })),
            { name: "Agent connection", close: () => runtime.close() },
            { name: "window state", close: () => desktopWindowStateStore?.flush() },
            { name: "profiler", close: () => desktopProfilerController?.close() },
            { name: "HTML preview", close: () => htmlPreviewProxy?.close() },
            { name: "renderer session", close: () => kissopenAgentRendererSession?.close() },
            { name: "onboarding", close: () => onboarding?.[Symbol.dispose]() },
            { name: "quick bar", close: () => quickBarClose() },
            {
                name: "media preview",
                close: () => {
                    if (mediaPreviewWindow && !mediaPreviewWindow.isDestroyed())
                        mediaPreviewWindow.destroy();
                },
            },
        ];
        const results = await Promise.allSettled(
            cleanups.map(({ close }) => Promise.resolve().then(close)),
        );
        for (const [index, result] of results.entries())
            if (result.status === "rejected")
                console.error(
                    `KissOpen quit cleanup failed (${cleanups[index]!.name}).`,
                    result.reason,
                );
    })().finally(() => {
        browserProxies.clear();
        htmlPreviewProxy = undefined;
        kissopenAgentRendererSession = undefined;
        mediaPreviewWindow = undefined;
        mediaPreviewSubject = undefined;
        quitting = true;
        app.quit();
    });
});

/** The renderer's answers as the relay takes them: strings by question id, nothing else. */
function questionAnswers(value: unknown): Record<string, readonly string[]> {
    const answers: Record<string, readonly string[]> = {};
    if (typeof value !== "object" || value === null) return answers;
    for (const [id, chosen] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(chosen))
            answers[id] = chosen.filter((entry) => typeof entry === "string");
    }
    return answers;
}
