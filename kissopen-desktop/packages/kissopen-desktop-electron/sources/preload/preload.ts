import type {
    KissopenAgentGitFile,
    RelayCommandResult,
    RelayFileRead,
    RelayProjectFileReadOptions,
    RelayDirectory,
    RelayFileUploaded,
    RelayConversation,
    RelayGitFile,
    RelayGitState,
    RelayState,
    RelayTerminalAttached,
    RelayTerminalResult,
    RelayTerminalsResult,
} from "../shared/relayContract";
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopBrowserAutomationEvent } from "../shared/browserAutomation";
import {
    buildIdentityArgument,
    debugMetricsArgument,
    desktopIpc,
    mediaPreviewArgument,
    quickBarArgument,
    type DesktopBrowserStatus,
    type DesktopNavigationStep,
    type DesktopPreviewNavigation,
    type DesktopBuildIdentity,
    type DesktopDebugSnapshot,
    type DesktopDaemonSnapshot,
    type DesktopGuestKeyEvent,
    type DesktopMediaPreview,
    type DesktopRuntimeSnapshot,
    type DesktopStartRequest,
    type DesktopWindowState,
    type KissopenDesktopBridge,
    type KissopenMediaPreviewBridge,
    type KissopenQuickBarBridge,
    type LocalOnboardingSnapshot,
    type RelayAttachment,
} from "../shared/desktopContract";
import type {
    DesktopProfilerRequest,
    DesktopProfilerSnapshot,
    DesktopReactDevtoolsCommand,
    DesktopReactDevtoolsMessage,
} from "../shared/desktopProfiler";

/**
 * The development identity main launched this window with. A packaged build
 * passes none, and anything unparseable is treated as none: an identity is a
 * label on a window, never something the renderer should fail over.
 */
function buildIdentityRead(): DesktopBuildIdentity | undefined {
    const argument = process.argv.find((value) => value.startsWith(buildIdentityArgument));
    if (!argument) return undefined;
    try {
        return JSON.parse(argument.slice(buildIdentityArgument.length)) as DesktopBuildIdentity;
    } catch {
        return undefined;
    }
}

const identity = buildIdentityRead();
const debugMetricsEnabled = process.argv.includes(debugMetricsArgument);
// Retained task pages share a single native event subscription. Each consumer
// still owns its callback and can unsubscribe independently of other pages.
const browserListeners = new Set<(event: DesktopBrowserAutomationEvent) => void>();
const browserReceive = (_event: Electron.IpcRendererEvent, event: DesktopBrowserAutomationEvent) =>
    [...browserListeners].forEach((listener) => listener(event));

const bridge: KissopenDesktopBridge = {
    kissopenRequest: (request) => ipcRenderer.invoke(desktopIpc.kissopenRequest, request),
    kissopenFileOpen: (url: string, name: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.kissopenFileOpen, url, name),
    ...(identity ? { buildIdentity: identity } : {}),
    debugMetricsEnabled,
    appearanceSet: (mode) => ipcRenderer.send(desktopIpc.appearanceSet, mode),
    attachmentSourcePath(file: File) {
        // Chromium hands the renderer a `File` that hides where it came from,
        // and asking is the only way back to the path. A file that never had
        // one answers with an empty string rather than failing.
        try {
            return webUtils.getPathForFile(file) || undefined;
        } catch {
            return undefined;
        }
    },
    browserProxyApply: (target) => ipcRenderer.invoke(desktopIpc.browserProxyApply, target),
    browserPasswordGenerate: () => ipcRenderer.invoke(desktopIpc.browserPasswordGenerate),
    browserAutomationStart: (id, scope) =>
        ipcRenderer.invoke(desktopIpc.browserAutomationStart, id, scope),
    browserAutomationStop: (id) => ipcRenderer.invoke(desktopIpc.browserAutomationStop, id),
    browserAutomationBind: (tabId, guestId, target) =>
        ipcRenderer.invoke(desktopIpc.browserAutomationBind, tabId, guestId, target),
    browserAutomationAction: (tabId, action) =>
        ipcRenderer.invoke(desktopIpc.browserAutomationAction, tabId, action),
    browserAutomationSubscribe(listener) {
        const receive = (event: DesktopBrowserAutomationEvent) => listener(event);
        if (!browserListeners.size)
            ipcRenderer.on(desktopIpc.browserAutomationEvent, browserReceive);
        browserListeners.add(receive);
        return () => {
            if (browserListeners.delete(receive) && !browserListeners.size)
                ipcRenderer.removeListener(desktopIpc.browserAutomationEvent, browserReceive);
        };
    },
    browserCommand: (target, guestId, command) =>
        ipcRenderer.invoke(desktopIpc.browserCommand, target, guestId, command),
    browserOpenSubscribe(listener: (url: string) => void) {
        const receive = (_event: Electron.IpcRendererEvent, url: string) => listener(url);
        ipcRenderer.on(desktopIpc.browserOpenRequested, receive);
        return () => ipcRenderer.removeListener(desktopIpc.browserOpenRequested, receive);
    },
    browserStatusSubscribe(listener: (status: DesktopBrowserStatus) => void) {
        const receive = (_event: Electron.IpcRendererEvent, status: DesktopBrowserStatus) =>
            listener(status);
        ipcRenderer.on(desktopIpc.browserStatusChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.browserStatusChanged, receive);
    },
    cloudAuthCallbackSubscribe(listener: () => void) {
        const receive = () => listener();
        ipcRenderer.on(desktopIpc.cloudAuthCallbackReceived, receive);
        return () => ipcRenderer.removeListener(desktopIpc.cloudAuthCallbackReceived, receive);
    },
    cloudAuthCallbackPending: () => ipcRenderer.invoke(desktopIpc.cloudAuthCallbackPending),
    cloudAuthCallbackTake: () => ipcRenderer.invoke(desktopIpc.cloudAuthCallbackTake),
    cloudAuthConfigurationGet: () => ipcRenderer.invoke(desktopIpc.cloudAuthConfigurationGet),
    cloudAuthOpen: (url) => ipcRenderer.invoke(desktopIpc.cloudAuthOpen, url),
    linkOpen: (url: string): Promise<boolean> => ipcRenderer.invoke(desktopIpc.linkOpen, url),
    guestKeySubscribe(listener: (event: DesktopGuestKeyEvent) => void) {
        const receive = (_event: Electron.IpcRendererEvent, input: DesktopGuestKeyEvent) =>
            listener(input);
        ipcRenderer.on(desktopIpc.guestKey, receive);
        return () => ipcRenderer.removeListener(desktopIpc.guestKey, receive);
    },
    previewNavigationSubscribe(listener: (step: DesktopPreviewNavigation) => void) {
        const receive = (_event: Electron.IpcRendererEvent, step: DesktopPreviewNavigation) =>
            listener(step);
        ipcRenderer.on(desktopIpc.previewNavigationChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.previewNavigationChanged, receive);
    },
    navigationStepSubscribe(listener: (step: DesktopNavigationStep) => void) {
        const receive = (_event: Electron.IpcRendererEvent, step: DesktopNavigationStep) =>
            listener(step);
        ipcRenderer.on(desktopIpc.navigationStep, receive);
        return () => ipcRenderer.removeListener(desktopIpc.navigationStep, receive);
    },
    // `send`, not `invoke`: the shell has nothing to answer, and a badge that
    // made the window await the operating system would be a worse badge.
    dockUnreadSet: (count: number) => ipcRenderer.send(desktopIpc.dockUnreadSet, count),
    /* The View menu does the zooming and says so; this side only relays. Reading
       it back from `webFrame` on a viewport change cannot see ⌘0 at 100% or a
       ⌘− that the floor refused, which are the two answers worth showing. */
    zoomSubscribe: (listener: (percent: number) => void) => {
        const relay = (_event: unknown, percent: number) => listener(percent);
        ipcRenderer.on(desktopIpc.zoomChanged, relay);
        return () => {
            ipcRenderer.off(desktopIpc.zoomChanged, relay);
        };
    },
    mediaPreviewOpen: (url: string) => ipcRenderer.invoke(desktopIpc.mediaPreviewOpen, url),
    directoryPick: () => ipcRenderer.invoke(desktopIpc.directoryPick),
    desktopConfigGet: () => ipcRenderer.invoke(desktopIpc.desktopConfigGet),
    desktopConfigWrite: (config) => ipcRenderer.invoke(desktopIpc.desktopConfigWrite, config),
    daemonCheck: () => ipcRenderer.invoke(desktopIpc.daemonCheck),
    daemonDownload: () => ipcRenderer.invoke(desktopIpc.daemonDownload),
    daemonInstall: () => ipcRenderer.invoke(desktopIpc.daemonInstall),
    daemonInstallDismiss: () => ipcRenderer.invoke(desktopIpc.daemonInstallDismiss),
    daemonInstallKill: () => ipcRenderer.invoke(desktopIpc.daemonInstallKill),
    daemonRestart: () => ipcRenderer.invoke(desktopIpc.daemonRestart),
    legacyCliConnect: () => ipcRenderer.invoke(desktopIpc.legacyCliConnect),
    legacyCliPrepare: () => ipcRenderer.invoke(desktopIpc.legacyCliPrepare),
    daemonGet: () => ipcRenderer.invoke(desktopIpc.daemonGet),
    daemonStart: () => ipcRenderer.invoke(desktopIpc.daemonStart),
    daemonSubscribe(listener: (snapshot: DesktopDaemonSnapshot) => void) {
        const receive = (_event: Electron.IpcRendererEvent, snapshot: DesktopDaemonSnapshot) =>
            listener(snapshot);
        ipcRenderer.on(desktopIpc.daemonChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.daemonChanged, receive);
    },
    /** The account's relay as it stands. Null when nobody is reading it. */
    relayGet: (): Promise<RelayState> => ipcRenderer.invoke(desktopIpc.relayGet),
    relayConversation: (sessionId: string): Promise<RelayConversation> =>
        ipcRenderer.invoke(desktopIpc.relayConversation, sessionId),
    relaySay: (
        sessionId: string,
        text: string,
        mode?: { model?: string; modelProviderId?: string; effort?: string },
        files?: readonly RelayAttachment[],
        displayText?: string,
    ): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relaySay, sessionId, text, mode, files, displayText),
    relayDecide: (
        sessionId: string,
        requestId: string,
        approved: boolean,
    ): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayDecide, sessionId, requestId, approved),
    relayAnswerQuestion: (
        sessionId: string,
        requestId: string,
        answers: Readonly<Record<string, readonly string[]>>,
    ): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayAnswerQuestion, sessionId, requestId, answers),
    relayCancelQuestion: (sessionId: string, requestId: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayCancelQuestion, sessionId, requestId),
    relayAbort: (sessionId: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayAbort, sessionId),
    relayClear: (sessionId: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayClear, sessionId),
    relayArchive: (sessionId: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayArchive, sessionId),
    relayDelete: (sessionId: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayDelete, sessionId),
    relayGitState: (sessionId: string): Promise<RelayGitState> =>
        ipcRenderer.invoke(desktopIpc.relayGitState, sessionId),
    relayTerminalList: (sessionId: string): Promise<RelayTerminalsResult> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalList, sessionId),
    relayTerminalCreate: (
        sessionId: string,
        request: { cols?: number; rows?: number; colorScheme?: "light" | "dark" },
    ): Promise<RelayTerminalResult> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalCreate, sessionId, request),
    relayTerminalResize: (
        sessionId: string,
        terminalId: string,
        cols: number,
        rows: number,
    ): Promise<RelayTerminalResult> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalResize, sessionId, terminalId, cols, rows),
    relayTerminalStop: (sessionId: string, terminalId: string): Promise<RelayTerminalResult> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalStop, sessionId, terminalId),
    relayTerminalAttach: (sessionId: string, terminalId: string): Promise<RelayTerminalAttached> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalAttach, sessionId, terminalId),
    relayTerminalWrite: (handle: number, chunk: Uint8Array): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayTerminalWrite, handle, chunk),
    // Sent rather than invoked: letting go has nothing to answer, and a
    // terminal being closed must not wait on the main process to say so.
    relayTerminalDetach: (handle: number): void => {
        ipcRenderer.send(desktopIpc.relayTerminalDetach, handle);
    },
    relayTerminalDataSubscribe(listener: (handle: number, chunk: Uint8Array) => void) {
        const receive = (_event: Electron.IpcRendererEvent, handle: number, chunk: Uint8Array) =>
            listener(handle, chunk);
        ipcRenderer.on(desktopIpc.relayTerminalData, receive);
        return () => ipcRenderer.removeListener(desktopIpc.relayTerminalData, receive);
    },
    relayTerminalClosedSubscribe(listener: (handle: number, error?: string) => void) {
        const receive = (_event: Electron.IpcRendererEvent, handle: number, error?: string) =>
            listener(handle, error);
        ipcRenderer.on(desktopIpc.relayTerminalClosed, receive);
        return () => ipcRenderer.removeListener(desktopIpc.relayTerminalClosed, receive);
    },
    relayFileOpen: (sessionId: string, path: string): Promise<RelayCommandResult> =>
        ipcRenderer.invoke(desktopIpc.relayFileOpen, sessionId, path),
    relayFileRead: (
        sessionId: string,
        path: string,
        project?: RelayProjectFileReadOptions,
    ): Promise<RelayFileRead> =>
        ipcRenderer.invoke(desktopIpc.relayFileRead, sessionId, path, project),
    relayDirectoryList: (sessionId: string, path: string): Promise<RelayDirectory> =>
        ipcRenderer.invoke(desktopIpc.relayDirectoryList, sessionId, path),
    relayFileUpload: (
        sessionId: string,
        path: string,
        bytes: Uint8Array,
    ): Promise<RelayFileUploaded> =>
        ipcRenderer.invoke(desktopIpc.relayFileUpload, sessionId, path, bytes),
    relayGitFile: (
        sessionId: string,
        gitBase: string,
        file: KissopenAgentGitFile,
    ): Promise<RelayGitFile> =>
        ipcRenderer.invoke(desktopIpc.relayGitFile, sessionId, gitBase, file),
    relayActivitySubscribe(listener: (sessionId: string, running: boolean) => void) {
        const receive = (_e: Electron.IpcRendererEvent, sessionId: string, running: boolean) =>
            listener(sessionId, running);
        ipcRenderer.on(desktopIpc.relayActivity, receive);
        return () => ipcRenderer.removeListener(desktopIpc.relayActivity, receive);
    },
    relayArrivalSubscribe(listener: (sessionId: string) => void) {
        const receive = (_event: Electron.IpcRendererEvent, sessionId: string) =>
            listener(sessionId);
        ipcRenderer.on(desktopIpc.relayArrival, receive);
        return () => ipcRenderer.removeListener(desktopIpc.relayArrival, receive);
    },
    relaySubscribe(listener: (state: RelayState) => void) {
        const receive = (_event: Electron.IpcRendererEvent, state: RelayState) => listener(state);
        ipcRenderer.on(desktopIpc.relayChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.relayChanged, receive);
    },
    daemonUpgrade: () => ipcRenderer.invoke(desktopIpc.daemonUpgrade),
    daemonVersionSelect: (version: string) =>
        ipcRenderer.invoke(desktopIpc.daemonVersionSelect, version),
    debugGet: () => ipcRenderer.invoke(desktopIpc.debugGet),
    debugAllStart: () => ipcRenderer.invoke(desktopIpc.debugAllStart),
    debugAllStop: () => ipcRenderer.invoke(desktopIpc.debugAllStop),
    debugMainInspectorStart: () => ipcRenderer.invoke(desktopIpc.debugMainInspectorStart),
    debugMainInspectorStop: () => ipcRenderer.invoke(desktopIpc.debugMainInspectorStop),
    debugRendererInspectorStart: () => ipcRenderer.invoke(desktopIpc.debugRendererInspectorStart),
    debugRendererInspectorStop: () => ipcRenderer.invoke(desktopIpc.debugRendererInspectorStop),
    debugDaemonInspectorStart: () => ipcRenderer.invoke(desktopIpc.debugDaemonInspectorStart),
    debugDaemonInspectorStop: () => ipcRenderer.invoke(desktopIpc.debugDaemonInspectorStop),
    debugSubscribe(listener: (snapshot: DesktopDebugSnapshot) => void) {
        const receive = (_event: Electron.IpcRendererEvent, snapshot: DesktopDebugSnapshot) =>
            listener(snapshot);
        ipcRenderer.on(desktopIpc.debugChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.debugChanged, receive);
    },
    profilerGet: () => ipcRenderer.invoke(desktopIpc.profilerGet),
    profilerStart: (request?: DesktopProfilerRequest) =>
        ipcRenderer.invoke(desktopIpc.profilerStart, request),
    profilerStop: () => ipcRenderer.invoke(desktopIpc.profilerStop),
    profilerSubscribe(listener: (snapshot: DesktopProfilerSnapshot) => void) {
        const receive = (_event: Electron.IpcRendererEvent, snapshot: DesktopProfilerSnapshot) =>
            listener(snapshot);
        ipcRenderer.on(desktopIpc.profilerChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.profilerChanged, receive);
    },
    profilerReactMessage(message: DesktopReactDevtoolsMessage) {
        ipcRenderer.send(desktopIpc.profilerReactMessage, message);
    },
    profilerReactSubscribe(listener: (command: DesktopReactDevtoolsCommand) => void) {
        const receive = (_event: Electron.IpcRendererEvent, command: DesktopReactDevtoolsCommand) =>
            listener(command);
        ipcRenderer.on(desktopIpc.profilerReactCommand, receive);
        return () => ipcRenderer.removeListener(desktopIpc.profilerReactCommand, receive);
    },
    applicationMenuOpen: () => ipcRenderer.invoke(desktopIpc.applicationMenuOpen),
    onboardingGet: () => ipcRenderer.invoke(desktopIpc.onboardingGet),
    onboardingSubscribe(listener: (snapshot: LocalOnboardingSnapshot) => void) {
        const receive = (_event: Electron.IpcRendererEvent, snapshot: LocalOnboardingSnapshot) =>
            listener(snapshot);
        ipcRenderer.on(desktopIpc.onboardingChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.onboardingChanged, receive);
    },
    onboardingProfileCreate: (input) =>
        ipcRenderer.invoke(desktopIpc.onboardingProfileCreate, input),
    onboardingProjectChoose: () => ipcRenderer.invoke(desktopIpc.onboardingProjectChoose),
    onboardingChiefOfStaffComplete: () =>
        ipcRenderer.invoke(desktopIpc.onboardingChiefOfStaffComplete),
    onboardingAssistantsContinue: () => ipcRenderer.invoke(desktopIpc.onboardingAssistantsContinue),
    runtimeGet: () => ipcRenderer.invoke(desktopIpc.runtimeGet),
    runtimeReset: () => ipcRenderer.invoke(desktopIpc.runtimeReset),
    runtimeRetry: () => ipcRenderer.invoke(desktopIpc.runtimeRetry),
    runtimeStart: (request: DesktopStartRequest) =>
        ipcRenderer.invoke(desktopIpc.runtimeStart, request),
    topologySelect: (topologyId) => ipcRenderer.invoke(desktopIpc.topologySelect, topologyId),
    updateInstall: () => ipcRenderer.invoke(desktopIpc.updateInstall),
    windowStateGet: () => ipcRenderer.invoke(desktopIpc.windowStateGet),
    windowStateSubscribe(listener: (state: DesktopWindowState) => void) {
        const receive = (_event: Electron.IpcRendererEvent, state: DesktopWindowState) =>
            listener(state);
        ipcRenderer.on(desktopIpc.windowStateChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.windowStateChanged, receive);
    },
    subscribe(listener: (snapshot: DesktopRuntimeSnapshot) => void) {
        const receive = (_event: Electron.IpcRendererEvent, snapshot: DesktopRuntimeSnapshot) =>
            listener(snapshot);
        ipcRenderer.on(desktopIpc.runtimeChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.runtimeChanged, receive);
    },
};

const mediaPreview: KissopenMediaPreviewBridge = {
    mediaPreviewGet: () => ipcRenderer.invoke(desktopIpc.mediaPreviewGet),
    mediaPreviewClose: () => ipcRenderer.invoke(desktopIpc.mediaPreviewClose),
    mediaPreviewSubscribe(listener: (preview: DesktopMediaPreview | undefined) => void) {
        const receive = (
            _event: Electron.IpcRendererEvent,
            preview: DesktopMediaPreview | undefined,
        ) => listener(preview);
        ipcRenderer.on(desktopIpc.mediaPreviewChanged, receive);
        return () => ipcRenderer.removeListener(desktopIpc.mediaPreviewChanged, receive);
    },
};

const quickBar: KissopenQuickBarBridge = {
    quickBarSend: (text: string) => ipcRenderer.invoke(desktopIpc.quickBarSend, text),
    quickBarClose: () => ipcRenderer.invoke(desktopIpc.quickBarClose),
    quickBarOpenConversation: () => ipcRenderer.invoke(desktopIpc.quickBarOpenConversation),
    quickBarHeight: (height: number) => ipcRenderer.send(desktopIpc.quickBarHeight, height),
};

/*
 * A window gets one bridge, never two, and which one is settled by how the
 * window was launched rather than by what the page it loads says about itself.
 * The preview window and the bar therefore have no route to the application's
 * capabilities at all, instead of having them and being asked not to use them.
 */
if (process.argv.includes(mediaPreviewArgument))
    contextBridge.exposeInMainWorld("kissopenMediaPreview", mediaPreview);
else if (process.argv.includes(quickBarArgument))
    contextBridge.exposeInMainWorld("kissopenQuickBar", quickBar);
else contextBridge.exposeInMainWorld("kissopenDesktop", bridge);
