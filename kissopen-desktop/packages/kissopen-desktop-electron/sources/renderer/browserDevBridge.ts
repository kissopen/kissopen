import { t } from "kissopen-desktop-state";
import { communityBrowserRequestCreate } from "./communityAccountBridge";
import type {
    DesktopConfig,
    DesktopDebugSnapshot,
    DesktopRuntimeSnapshot,
    DesktopStartRequest,
    KissopenDesktopBridge,
} from "../shared/desktopContract";
import type {
    DesktopProfilerRequest,
    DesktopProfilerSnapshot,
    DesktopReactDevtoolsCommand,
    DesktopReactDevtoolsMessage,
} from "../shared/desktopProfiler";

const endpoint = "/__kissopen_local_kissopen_agent";
const cloudAuthCallbackPath = "/cloud-auth/callback";
let cloudAuthCallback =
    window.location.pathname === cloudAuthCallbackPath ? window.location.href : undefined;
if (cloudAuthCallback)
    window.history.replaceState(null, "", `${window.location.origin}/#/settings/account`);

const unsupportedDebugSnapshot: DesktopDebugSnapshot = {
    daemon: { status: "stopped" },
    daemonConnected: false,
    main: { status: "stopped" },
    renderer: { status: "stopped" },
    supported: false,
};

const unsupportedProfilerSnapshot: DesktopProfilerSnapshot = {
    capabilities: {
        liveDebuggerAttach: false,
        nativeTrace: false,
        processMetrics: false,
        reactAttribution: false,
        reactDevtoolsProfiling: false,
        rendererMetrics: false,
    },
    status: "unavailable",
};

function nativeDebugUnavailable(): never {
    throw new Error("Debugger attachment is available in the Electron desktop window.");
}

function nativeProfilerUnavailable(): never {
    throw new Error("Profiler capture is available in the Electron desktop window.");
}

interface DevResponse<Value> {
    error?: string;
    value?: Value;
}

async function request<Value>(action: string, input?: unknown): Promise<Value> {
    const response = await fetch(endpoint, {
        body: JSON.stringify({ action, input }),
        headers: { "content-type": "application/json" },
        method: "POST",
    });
    const result = (await response.json()) as DevResponse<Value>;
    if (!response.ok || result.error)
        throw new Error(result.error ?? t("Local KissOpen Agent request failed."));
    return result.value as Value;
}

/**
 * Creates the same renderer capability as the preload bridge, backed by the local
 * Vite server. The renderer reaches the daemon's health over the dev server's
 * `${endpoint}/health` route (advertised as `kissopenAgentHttpUrl` in the runtime snapshot),
 * while machine-local file operations use the exact endpoint and the remaining
 * native-only operations degrade explicitly.
 */
export function browserDevBridgeCreate(): KissopenDesktopBridge {
    return {
        kissopenRequest: communityBrowserRequestCreate(),
        // Browser-local development has no explicit Electron debug launch, so
        // it must not start the desktop-only live metrics sampler.
        debugMetricsEnabled: false,
        // A normal browser exposes no native preferred-color-scheme override;
        // the application tree itself is already controlled by ThemeScope.
        appearanceSet: () => undefined,
        // A browser tab is told nothing about where a dropped file came from,
        // so every attachment here travels by value.
        attachmentSourcePath: () => undefined,
        browserProxyApply: async () => {
            throw new Error("The browser content renderer is not connected.");
        },
        browserOpenSubscribe: () => () => undefined,
        browserStatusSubscribe: () => () => undefined,
        cloudAuthCallbackSubscribe: () => () => undefined,
        cloudAuthCallbackPending: async () => cloudAuthCallback !== undefined,
        cloudAuthCallbackTake: async () => {
            const callback = cloudAuthCallback;
            cloudAuthCallback = undefined;
            return callback;
        },
        cloudAuthConfigurationGet: async () => ({
            environment: "production",
            redirectUri: new URL(cloudAuthCallbackPath, window.location.origin).href,
        }),
        cloudAuthOpen: async (candidate) => {
            const url = new URL(candidate);
            if (url.protocol !== "https:")
                throw new Error("KissOpen Agent returned an invalid Cloud authorization URL.");
            window.location.assign(url.href);
        },
        // Browser-local mode has no isolated Electron guest to relay from.
        guestKeySubscribe: () => () => undefined,
        // A browser tab hosts no preview guest, so no navigation is ever
        // reported and the subscription is a well-behaved no-op.
        previewNavigationSubscribe: () => () => undefined,
        // A browser tab already has the real thing — its own Back and Forward
        // buttons, and the trackpad gesture the browser drives from them — which
        // the window's own stack listens for directly. Nothing has to be relayed
        // through here, so the subscription is a well-behaved no-op.
        navigationStepSubscribe: () => () => undefined,
        // A browser tab has no Dock icon to mark, so the count goes nowhere
        // rather than the window branching on where it is running.
        dockUnreadSet: () => undefined,
        // The browser zooms the tab itself and draws its own read-out for it,
        // so there is nothing here to announce and no second bubble to add.
        zoomSubscribe: () => () => undefined,
        // A browser tab has no window of its own to open a file in, so it
        // offers none and the control is absent rather than present and broken.
        mediaPreviewOpen: async () => {
            throw new Error("This window cannot open a separate preview window.");
        },
        directoryPick: async () => undefined,
        desktopConfigGet: () => request<DesktopConfig>("desktopConfigGet"),
        desktopConfigWrite: (config) => request<void>("desktopConfigWrite", config),
        daemonCheck: async () => {
            throw new Error("KissOpen Agent updates are available in the Electron desktop window.");
        },
        daemonDownload: async () => {
            throw new Error(
                "KissOpen Agent downloads are available in the Electron desktop window.",
            );
        },
        daemonGet: async () => ({
            install: { phase: "idle" },
            installation: "installed",
            managed: false,
            operation: "idle",
            runtime: "ready",
            updateAvailable: false,
            versions: [],
        }),
        daemonInstall: async () => {
            throw new Error("KissOpen Agent updates are installed in the Electron desktop window.");
        },
        daemonInstallDismiss: async () => undefined,
        daemonInstallKill: async () => undefined,
        daemonRestart: async () => {
            throw new Error("KissOpen Agent is restarted from the Electron desktop window.");
        },
        legacyCliConnect: async () => {
            throw new Error("Connect the terminal CLI from the Electron desktop window.");
        },
        legacyCliPrepare: async () => {
            throw new Error("Install the terminal CLI from the Electron desktop window.");
        },
        daemonStart: async () => {
            throw new Error("KissOpen Agent is started from the Electron desktop window.");
        },
        daemonSubscribe: () => () => undefined,
        // The browser build has no main process, so no account relay either.
        // Null rather than an empty snapshot: nothing is reading it.
        relayGet: async () => null,
        relaySubscribe: () => () => undefined,
        relayConversation: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，读不到 relay",
        }),
        relaySay: async () => ({ ok: false as const, error: "浏览器构建没有主进程，发不出去" }),
        linkOpen: async (url: string) => {
            // A browser build already has a browser: the anchor's own target
            // does what this bridge exists to do everywhere else.
            window.open(url, "_blank", "noopener,noreferrer");
            return true;
        },
        relayDecide: async () => ({ ok: false as const, error: "浏览器构建没有主进程，批不了" }),
        relayAnswerQuestion: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，答不了",
        }),
        relayCancelQuestion: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，答不了",
        }),
        relayAbort: async () => ({ ok: false as const, error: "浏览器构建没有主进程，停不了" }),
        relayArchive: async () => ({ ok: false as const, error: "浏览器构建没有主进程，归档不了" }),
        relayClear: async () => ({ ok: false as const, error: "浏览器构建没有主进程，清空不了" }),
        relayDelete: async () => ({ ok: false as const, error: "浏览器构建没有主进程，删除不了" }),
        relayGitState: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，读不到改动",
        }),
        relayTerminalList: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalCreate: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalResize: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalStop: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalAttach: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalWrite: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，开不了终端",
        }),
        relayTerminalDetach: () => undefined,
        relayTerminalDataSubscribe: () => () => undefined,
        relayTerminalClosedSubscribe: () => () => undefined,
        relayFileOpen: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，打不开文件",
        }),
        kissopenFileOpen: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，打不开文件",
        }),
        relayFileRead: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，读不到文件",
        }),
        relayFileUpload: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，传不了文件",
        }),
        relayDirectoryList: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，列不出文件夹",
        }),
        relayGitFile: async () => ({
            ok: false as const,
            error: "浏览器构建没有主进程，读不到改动",
        }),
        relayArrivalSubscribe: () => () => undefined,
        relayActivitySubscribe: () => () => undefined,
        daemonUpgrade: async () => {
            throw new Error("KissOpen Agent updates are available in the Electron desktop window.");
        },
        daemonVersionSelect: async () => {
            throw new Error("KissOpen Agent versions are chosen in the Electron desktop window.");
        },
        debugGet: async () => unsupportedDebugSnapshot,
        debugAllStart: async () => nativeDebugUnavailable(),
        debugAllStop: async () => nativeDebugUnavailable(),
        debugMainInspectorStart: async () => nativeDebugUnavailable(),
        debugMainInspectorStop: async () => nativeDebugUnavailable(),
        debugRendererInspectorStart: async () => nativeDebugUnavailable(),
        debugRendererInspectorStop: async () => nativeDebugUnavailable(),
        debugDaemonInspectorStart: async () => nativeDebugUnavailable(),
        debugDaemonInspectorStop: async () => nativeDebugUnavailable(),
        debugSubscribe: () => () => undefined,
        profilerGet: async () => unsupportedProfilerSnapshot,
        profilerStart: async (_request?: DesktopProfilerRequest) => nativeProfilerUnavailable(),
        profilerStop: async () => nativeProfilerUnavailable(),
        profilerSubscribe: () => () => undefined,
        profilerReactMessage: (_message: DesktopReactDevtoolsMessage) => undefined,
        profilerReactSubscribe: (_listener: (command: DesktopReactDevtoolsCommand) => void) => () =>
            undefined,
        applicationMenuOpen: async () => undefined,
        // Browser-local development runs against a machine that already has Kissopen Agent
        // and a daemon, and it has no native picker or PTY to run setup with, so
        // it reports setup as finished rather than presenting steps it cannot
        // truthfully perform.
        onboardingGet: async () => ({ busy: false, freshness: "used", stage: "complete" }) as const,
        onboardingSubscribe: () => () => undefined,
        onboardingAssistantsContinue: async () => undefined,
        onboardingProfileCreate: async () => undefined,
        onboardingProjectChoose: async () => undefined,
        onboardingChiefOfStaffComplete: async () => undefined,
        runtimeGet: async () => {
            const snapshot = await request<DesktopRuntimeSnapshot>("runtimeGet");
            if (snapshot.phase !== "ready" || snapshot.activeTarget.mode !== "local")
                return snapshot;
            return {
                ...snapshot,
                activeTarget: {
                    ...snapshot.activeTarget,
                    kissopenAgentHttpUrl: new URL(
                        snapshot.activeTarget.kissopenAgentHttpUrl,
                        window.location.origin,
                    ).toString(),
                },
            };
        },
        runtimeReset: async () => undefined,
        runtimeRetry: async () => undefined,
        runtimeStart: async (_request: DesktopStartRequest) => undefined,
        topologySelect: async () => undefined,
        updateInstall: async () => undefined,
        // A browser tab has no native window chrome to reserve a lane for, so it
        // is permanently the windowed arrangement.
        windowStateGet: async () => ({ fullScreen: false }),
        windowStateSubscribe: () => () => undefined,
        subscribe(_listener: (snapshot: DesktopRuntimeSnapshot) => void) {
            return () => undefined;
        },
    };
}
