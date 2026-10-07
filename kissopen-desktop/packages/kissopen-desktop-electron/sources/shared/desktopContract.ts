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
} from "./relayContract";
import type { KissopenCloudRequest, KissopenCloudResponse } from "./kissopenCloud";
import type {
    DesktopProfilerRequest,
    DesktopProfilerSnapshot,
    DesktopReactDevtoolsCommand,
    DesktopReactDevtoolsMessage,
} from "./desktopProfiler";

export type DesktopMode = "local";

/** Appearance source the Electron shell applies to every local renderer and guest. */
export type DesktopAppearanceMode = "dark" | "light" | "system";
export type DesktopScrollbarVisibility = "always" | "automatic";

export interface DesktopCloudAuthConfiguration {
    readonly environment: "production" | "staging";
    readonly redirectUri: string;
}

/** Access granted to a newly created local Kissopen Agent session. */
export type DesktopPermissionMode = "auto" | "workspace_write" | "read_only" | "full_access";

/** One provider-qualified model identity in desktop preferences. */
export interface DesktopModelIdentity {
    readonly providerId: string;
    readonly modelId: string;
}

/** The explicit model and effort a new desktop session starts with. */
export interface DesktopDefaultModel extends DesktopModelIdentity {
    readonly effort?: string;
}

/** The choices most recently made while using one provider-qualified model. */
export interface DesktopModelPreference extends DesktopModelIdentity {
    readonly lastEffort?: string;
    /** `standard` names the provider's ordinary tier; every other value is a catalog tier. */
    readonly lastSpeed: string;
}

/**
 * Machine-local desktop preferences. Theme, scrollbar behavior, and explicit
 * title motion belong here because they must survive every window and KISSOPEN
 * Agent lifetime. Model ids are provider-qualified because the same model can
 * be offered through more than one account/provider.
 */
export interface DesktopConfig {
    readonly appearance: DesktopAppearanceMode;
    readonly defaultModel?: DesktopDefaultModel;
    readonly defaultEffort: string;
    readonly defaultPermissionMode: DesktopPermissionMode;
    readonly lastPickedModel?: DesktopModelIdentity;
    readonly modelPreferences: readonly DesktopModelPreference[];
    readonly scrollbarVisibility: DesktopScrollbarVisibility;
    readonly titleShimmerEnabled?: boolean;
    /** The interface language; absent means follow the system. */
    readonly language?: "system" | "zh" | "en";
    readonly version: 1;
}

export type DesktopStartRequest = { mode: "local" };

export type DesktopTopology = {
    id: string;
    mode: "local";
};

export interface DesktopTopologyTarget {
    detail: string;
    id: string;
    kind: "local" | "remote";
    label: string;
    mode: DesktopMode;
}

export type DesktopActiveTarget = DesktopTopologyTarget & {
    authentication: "kissopenAgent";
    mode: "local";
    kissopenAgentVersion: string;
    /**
     * Renderer-facing base URL (`http://kissopen-agent` in Electron). The renderer's
     * connection loader probes `${kissopenAgentHttpUrl}/health` directly; this is the
     * only channel the renderer uses to reach the local daemon.
     */
    kissopenAgentHttpUrl: string;
};

export interface DesktopUpdateSnapshot {
    availableVersion?: string;
    /** Share of the update downloaded so far, 0 to 1, while `downloading`. */
    downloadedFraction?: number;
    message?: string;
    status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
}

/**
 * One Kissopen Agent version this machine can run: either published for this
 * platform, already downloaded here, or both. `downloaded` is what decides
 * whether choosing it needs the network.
 */
export interface DesktopDaemonVersion {
    readonly downloaded: boolean;
    readonly prerelease: boolean;
    readonly version: string;
}

/**
 * One agent the daemon is still waiting on, and the stage it is finishing.
 * Reported by the daemon itself; Kissopen never infers what an agent is doing.
 */
export interface DesktopDrainAgent {
    readonly id: string;
    readonly stage: "inference" | "tools" | "compaction" | "settlement";
}

/**
 * Why the daemon is being taken down and brought back.
 *
 * Both are the same sequence and the same screen; only the words differ,
 * because arriving on a newer version and arriving back on the one you were
 * already running are different things to be told.
 */
export type DesktopDaemonRestartReason = "install" | "restart";

/** One runtime component whose admitted work has not drained yet. */
export interface DesktopDrainComponent {
    readonly name: string;
    /** Exact number of operations still holding this component open. */
    readonly count: number;
    /** Bounded, ID-sorted agent detail, present only for an agent component. */
    readonly agents?: readonly DesktopDrainAgent[];
    /** More agents are waiting than the daemon listed. */
    readonly truncated?: boolean;
}

/** The steps a restart runs through, in the order it runs them. */
export type DesktopDaemonRestartStep = "draining" | "stopping" | "starting" | "reconnecting";

/**
 * Where a deliberate agent restart has got to.
 *
 * The daemon owns every one of these facts: it publishes its own drain mode and
 * what is still finishing, so the screen reports rather than estimates. The one
 * quantity here is the drain's, and it is a count of open work rather than a
 * prediction — the daemon knows what it is still holding and how much it was
 * holding at the worst, and nothing beyond that is claimed.
 */
export type DesktopDaemonInstall =
    /**
     * No restart is running, which is also how a finished one ends. There is no
     * "done": the window comes back the moment the agent is serving again, and
     * a phase whose only content is that it worked would only be something to
     * click through.
     */
    | { readonly phase: "idle" }
    /** Asking the daemon to stop admitting new work. */
    | {
          readonly phase: "draining";
          readonly reason: DesktopDaemonRestartReason;
          readonly version: string;
          readonly waitingFor: readonly DesktopDrainComponent[];
          /**
           * The most open work this drain has been holding at once.
           *
           * The screen shows how far the drain has got as the share of this that
           * has since finished, so it is counted here — by the one place that
           * has watched the drain from its first report — rather than guessed
           * from whatever the window happened to see first.
           */
          readonly waitingPeak: number;
          /**
           * The wait has run long enough to be worth offering a way out of.
           *
           * It is published rather than timed in the window, so the offer appears
           * because the drain really has been going that long — not because a
           * component happened to mount ten seconds ago.
           */
          readonly killable: boolean;
      }
    /** Everything drained; the daemon is being asked to exit. */
    | {
          readonly phase: "stopping";
          readonly reason: DesktopDaemonRestartReason;
          readonly version: string;
          /** The drain was cut short, so work was interrupted rather than finished. */
          readonly killed: boolean;
      }
    /** The binary is starting. */
    | {
          readonly phase: "starting";
          readonly reason: DesktopDaemonRestartReason;
          readonly version: string;
      }
    /** The daemon answered and KISSOPEN is reconnecting to it. */
    | {
          readonly phase: "reconnecting";
          readonly reason: DesktopDaemonRestartReason;
          readonly version: string;
      }
    | {
          readonly phase: "error";
          readonly reason: DesktopDaemonRestartReason;
          readonly version: string;
          readonly message: string;
          /**
           * The step that was running when it failed. The sequence knows this;
           * the message alone would leave the screen guessing where it stopped.
           */
          readonly failedAt: DesktopDaemonRestartStep;
      };

/**
 * A KISSOPEN Agent release archive, while its bytes are arriving.
 *
 * Both numbers are counted rather than estimated. The release manifest declares
 * the archive's exact size — the download already refuses anything that does not
 * match it — and the same pass that hashes each chunk on its way to disk tallies
 * it, so this is a report of what has happened rather than a prediction.
 *
 * It exists only while an archive is genuinely being fetched. Before the first
 * byte the size is not yet known, and after the last one the work that remains
 * is verifying and unpacking, which take no measurable time and have no honest
 * fraction; a bar that idled at either end would be inventing one.
 */
export interface DesktopDaemonDownload {
    readonly receivedBytes: number;
    readonly totalBytes: number;
}

/** The machine-local Kissopen Agent installation and the daemon currently serving it. */
export interface DesktopDaemonSnapshot {
    readonly availableVersion?: string;
    /** The archive on its way here, while `operation` is `downloading`. */
    readonly download?: DesktopDaemonDownload;
    readonly error?: string;
    readonly installation: "missing" | "installed";
    readonly installedVersion?: string;
    readonly managed: boolean;
    readonly message?: string;
    /**
     * What the controller is doing. `installing` is the first start alone —
     * selecting a verified release on a machine that has none and launching it.
     * It is kept apart from `downloading` because fetching bytes is harmless and
     * automatic, while selecting and running them follows the person's action.
     */
    readonly operation: "idle" | "checking" | "downloading" | "installing" | "upgrading";
    readonly runtime: "stopped" | "starting" | "ready";
    readonly updateAvailable: boolean;
    /**
     * Every version that can be chosen, newest first. Empty until the first
     * catalog read answers; a version downloaded here always appears, even when
     * GitHub no longer lists it.
     */
    readonly versions: readonly DesktopDaemonVersion[];
    /**
     * The downloaded version waiting to be selected: the first version on a
     * machine with no agent, or one newer than the running daemon. Its presence
     * is the whole condition for offering start/install: the verified bytes are
     * already on this machine.
     */
    readonly readyVersion?: string;
    /** A restart the person asked for, while it is happening. */
    readonly install: DesktopDaemonInstall;
}

export type DesktopRuntimeSnapshot =
    | {
          phase: "choosing";
          targets: readonly DesktopTopologyTarget[];
          update: DesktopUpdateSnapshot;
      }
    | {
          phase: "starting";
          message: string;
          request: DesktopStartRequest;
          targets: readonly DesktopTopologyTarget[];
          update: DesktopUpdateSnapshot;
      }
    | {
          phase: "ready";
          activeTarget: DesktopActiveTarget;
          activeTargetId: string;
          connectionId: number;
          mode: DesktopMode;
          targets: readonly DesktopTopologyTarget[];
          update: DesktopUpdateSnapshot;
      }
    | {
          phase: "error";
          message: string;
          request: DesktopStartRequest;
          retryable: boolean;
          /**
           * Another attempt is running right now, started from this failure. The
           * failure stays published so the window can keep the screen the person
           * is reading and put the waiting on its retry control instead.
           */
          retrying?: boolean;
          targets: readonly DesktopTopologyTarget[];
          update: DesktopUpdateSnapshot;
      };

/**
 * The window chrome the renderer cannot observe for itself. macOS full screen
 * hides the traffic lights without changing any CSS display mode, so the shell
 * would otherwise keep reserving the lane they left behind.
 */
export interface DesktopWindowState {
    readonly fullScreen: boolean;
}

/*
One file on its way into a conversation on another machine.

Bytes rather than a File: a File does not survive the process boundary, and the
encryption that has to happen before this leaves the computer lives in the main
process with the account's keys. The window reads the file and hands over what
it read.
*/
export interface RelayAttachment {
    readonly name: string;
    readonly mediaType: string;
    readonly bytes: Uint8Array;
    /** Present for an image, so the transcript can size it before it loads. */
    readonly width?: number;
    readonly height?: number;
}

/*
What became of a browser command.

A page that will not load is an ordinary outcome of asking a browser to go
somewhere — the site is down, the name does not resolve, a redirect was
refused — so it comes back as an answer rather than a thrown error. It used to
be thrown, and Electron logs every rejecting IPC handler, so an unreachable
site filled the log with "Error occurred in handler for
'kissopen:browser:command'" while the panel was already drawing the failure
page correctly.

A command that could not be carried out at all — no such tab, not this
window's — still throws. That is a fault, not a page.
*/
export type DesktopBrowserCommandResult =
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly url: string;
          /** Chromium's own error number, e.g. -105 for a name that will not resolve. */
          readonly code?: number;
          /** Chromium's own name for it, e.g. ERR_NAME_NOT_RESOLVED. */
          readonly description?: string;
      };

/**
 * Recovers the engine failure from a rejected `loadURL`.
 *
 * Electron formats these as `ERR_NAME_NOT_RESOLVED (-105) loading 'https://…'`.
 * Taking the name and the number out of it lets the panel show the page it
 * shows for any other reported failure, instead of a raw string.
 */
export function browserErrorDescribe(error: unknown): { code?: number; description?: string } {
    const message = error instanceof Error ? error.message : String(error);
    const parsed = /^(ERR_[A-Z0-9_]+)\s+\((-?\d+)\)/u.exec(message);
    if (!parsed) return { description: message };
    return { code: Number(parsed[2]), description: parsed[1] };
}

/** One native keyboard event relayed from an embedded browser/preview guest. */
export interface DesktopGuestKeyEvent {
    readonly altKey: boolean;
    readonly code: string;
    readonly ctrlKey: boolean;
    readonly isComposing: boolean;
    readonly key: string;
    readonly location: number;
    readonly metaKey: boolean;
    readonly repeat: boolean;
    readonly shiftKey: boolean;
    readonly type: "keydown" | "keyup";
}

export type DesktopDebugTargetStatus =
    | "stopped"
    | "starting"
    | "running"
    | "stopping"
    | "unavailable"
    | "error";

/** One live debugger attachment point owned by the native shell. */
export interface DesktopDebugTargetSnapshot {
    readonly error?: string;
    readonly status: DesktopDebugTargetStatus;
    readonly url?: string;
}

/** The three runtimes an external CDP client can attach to from Dev Tools. */
export interface DesktopDebugSnapshot {
    readonly daemonConnected: boolean;
    readonly daemon: DesktopDebugTargetSnapshot;
    readonly main: DesktopDebugTargetSnapshot;
    readonly renderer: DesktopDebugTargetSnapshot;
    readonly supported: boolean;
}

/** Native renderer profiling is separate from debugger endpoint lifetimes. */
export type DesktopProfilerStartRequest = DesktopProfilerRequest;

/**
 * What a development build calls itself. A packaged KISSOPEN reports none: only a
 * build run from a checkout has to be told apart from the other one beside it.
 */
export interface DesktopBuildIdentity {
    readonly branch: string;
    /** Short name for this checkout: its worktree directory, its branch, or "dev". */
    readonly label: string;
    /** Absolute path of the checkout, which is the detail worth copying. */
    readonly path: string;
}

/** Launch argument prefix carrying `DesktopBuildIdentity` JSON into the preload. */
export const buildIdentityArgument = "--kissopen-build-identity=";

/** Launch argument enabling renderer-local diagnostics in an explicit debug window. */
export const debugMetricsArgument = "--kissopen-debug-metrics";

/**
 * Where local first-run setup currently stands. The stage is always derived from
 * what this machine actually has — a Node runtime, an installed agent, a
 * connected daemon — plus the choices already recorded durably, so a restart, a
 * reinstall that keeps user data, or an interrupted install resumes at the same
 * stage or at the nearest truthful earlier one rather than at a remembered step
 * that may no longer be true.
 */
export type LocalOnboardingStage =
    /** The local runtime is not active yet, so setup has nothing to inspect. */
    | "inactive"
    /** The login-shell probe has not answered yet. */
    | "checking"
    /** No Node runtime; KISSOPEN cannot install one, so the person is asked to. */
    | "nodeMissing"
    /** KISSOPEN Agent is not installed yet; the renderer downloads and starts it automatically. */
    | "daemonDownload"
    /**
     * The agent that was just fetched is being started, and KISSOPEN is reaching it
     * for the first time.
     *
     * It is the tail of `daemonDownload` rather than a step of its own: nobody
     * asked for it, there is nothing to decide, and it is shown on the same
     * screen. It exists because the alternative was reporting the connection
     * KISSOPEN had not made yet as a connection that had failed — with the reason
     * the machine gave before the agent was installed, which by then was untrue.
     */
    | "daemonStarting"
    /** The agent exists; the normal user daemon is being started or connected to. */
    | "connecting"
    /** The daemon could not be reached; the desktop runtime carries the reason. */
    | "connectFailed"
    /**
     * KISSOPEN Agent is installed and working, but no coding assistant on this machine is
     * signed in, so it has nothing to run a session with. Kept apart from
     * `connectFailed` because nothing is broken: this is the last ordinary step
     * of setting the machine up, and it clears itself the moment an assistant is
     * signed in.
     */
    | "providersMissing"
    /**
     * KISSOPEN has just installed and started the agent, and reports which coding
     * assistants this machine turned out to have.
     *
     * Shown once per install, whether or not anything is missing, and passed by
     * the one button on it. It is a report rather than a question: the machine
     * was read while the agent was being fetched, and this is the only moment
     * that answer is worth anybody's attention.
     */
    | "assistantsFound"
    /** Kissopen Agent requires a human identity before it can finish setup. */
    | "profileRequired"
    /** Kissopen Agent Connect is resolving the daemon-owned onboarding status. */
    | "examining"
    /** Everything else is settled and this Kissopen Agent is demonstrably unused. */
    | "project"
    | "complete";

/**
 * How much is known about whether the connected Kissopen Agent has been used before.
 *
 * It is deliberately not a boolean with an absent third case: "not read yet"
 * and "could not be read" are different from "this KISSOPEN Agent is new", and only the
 * last of them may ever lead to Kissopen registering anything in someone's KISSOPEN Agent.
 */
export type LocalOnboardingFreshness =
    /** No authoritative answer yet for the KISSOPEN Agent currently connected. */
    | "checking"
    /** This KISSOPEN Agent holds no project of its own: it has never been used.  */
    | "fresh"
    /** This KISSOPEN Agent already holds projects, archived or not. */
    | "used"
    /** Its catalog could not be read, so nothing may be concluded from it. */
    | "error";

/** The Node runtime the user's login shell resolves, when it resolves one. */
export interface LocalOnboardingNode {
    readonly path: string;
    /** As `node --version` reported it, for example `v22.11.0`. */
    readonly version: string;
}

/**
 * The command-line assistants Kissopen sets a machine up with.
 *
 * Three, named here once. Kissopen Agent can be taught to run others and says so in its own
 * settings; setup deliberately asks about these and stops, because a first run
 * is not the place to survey a field — it is the place to get one assistant
 * working.
 */
export type LocalAssistantId = "claude" | "codex" | "grok";

/** What the login-shell probe found out about one assistant. */
export interface LocalAssistantState {
    readonly id: LocalAssistantId;
    /** Where the machine keeps the command, when the machine has it at all. */
    readonly command?: string;
    /**
     * Only what the machine can actually answer: the command is here, or it is
     * not. Whether a present command is signed in is Kissopen Agent's question rather than
     * the shell's, so it is not claimed here — the stage supplies that, because
     * `providersMissing` is itself Kissopen Agent's answer that none of them works.
     */
    readonly status: "found" | "missing";
}

export interface LocalOnboardingSnapshot {
    readonly stage: LocalOnboardingStage;
    readonly node?: LocalOnboardingNode;
    /**
     * Whether the KISSOPEN Agent connected right now has ever been used. KISSOPEN Agent publishes no
     * first-run flag, so this is read from its catalog and is re-read for every
     * connection: a replaced KISSOPEN Agent data directory is a different answer, and a
     * remembered one would let setup skip or repeat itself untruthfully.
     */
    readonly freshness: LocalOnboardingFreshness;
    /** The Git folder most recently opened as a project, for display only. */
    readonly projectPath?: string;
    /** True while this process is doing the current stage's work. */
    readonly busy: boolean;
    /**
     * The Kissopen Agent archive arriving right now, at `daemonDownload` and only
     * there. Setup is the one place a first download is worth watching — it is
     * the whole reason the window is being held — so the counted bytes are
     * carried here rather than left for the screen to guess at from a sentence.
     */
    readonly download?: DesktopDaemonDownload;
    /** Displayable detail for the current stage: why it failed, or what to do. */
    readonly message?: string;
    /**
     * The three assistants setup looks for, each with what this machine holds
     * and what Kissopen Agent can do with it. Present only at `providersMissing`.
     */
    readonly assistants?: readonly LocalAssistantState[];
    /** An attempt to reach Kissopen Agent is running, started from a failed stage. */
    readonly retrying?: boolean;
}

/**
 * One file a window of its own is showing, as that window is allowed to see it:
 * an address on one of this process's own KISSOPEN Agent proxies, and the workspace path
 * read back out of it. Never a daemon endpoint, a token, or a path on disk the
 * window could read for itself.
 *
 * Whether it is a picture or a recording is not carried here either. The window
 * decides that from the path it was given, which came out of the address this
 * process already validated — a separately supplied kind would be a second claim
 * about one file, and the only thing a second claim can do is disagree.
 */
export interface DesktopMediaPreview {
    readonly url: string;
    readonly path: string;
}

/**
 * HTTP result of one committed browser-guest navigation. Only the main process
 * sees a guest's response code, so it forwards it to the renderer keyed by the
 * guest's `webContents` id; a renderer tab claims the events for its own guest.
 */
export interface DesktopBrowserStatus {
    readonly guestId: number;
    readonly url: string;
    readonly status: number;
    readonly statusText: string;
}

/** The owning KISSOPEN Agent route and workspace whose network the guest uses. */
export interface DesktopBrowserProxyTarget {
    /** Null names the host; otherwise the host-published connection identity. */
    readonly connectionId: string | null;
    readonly workspaceId: string;
}

/** User-initiated navigation; guest pages never receive this bridge. */
export type DesktopBrowserCommand =
    | { readonly action: "load"; readonly url: string }
    | { readonly action: "back" | "forward" | "reload" | "stop" };

/**
 * One step in the life of one main-frame document inside an HTML preview guest.
 *
 * A preview reloads in place whenever the file behind it changes, so one guest
 * shows many documents and its `webContents` id identifies the guest, never the
 * page. `navigationId` is what identifies the page: it is monotonic per guest,
 * counts up once for every new document the main frame starts loading, and is
 * stamped on every step of that document's life.
 *
 * The steps are published by the main process on one channel, in the order that
 * process observed them, so a view never has to guess whether a response code
 * belongs to the document it is showing or to the one before it.
 */
export type DesktopPreviewNavigationStep =
    | {
          /** A new document has begun loading in the main frame. */
          readonly phase: "started";
          readonly url: string;
      }
    | {
          /** The document committed, with the response the server gave for it. */
          readonly phase: "responded";
          readonly url: string;
          /** `-1` for a navigation that is not HTTP. */
          readonly status: number;
          readonly statusText: string;
      }
    | {
          /** The document and everything it pulled in finished loading. */
          readonly phase: "loaded";
          readonly url: string;
      }
    | {
          /** The main frame's load failed outright; nothing committed. */
          readonly phase: "failed";
          readonly url: string;
          readonly code: number;
          readonly description: string;
      }
    | {
          /** The process drawing the page ended. */
          readonly phase: "gone";
          readonly url: string;
          readonly reason: string;
      };

/**
 * A request to move through this window's navigation stack, from the inputs an
 * OS offers: the mouse's side buttons, the trackpad swipe, the menu items. Only
 * the main process sees them, and none says *where* to go — only which
 * direction. The window holds the stack and decides what that lands on.
 */
export type DesktopNavigationStep = {
    readonly direction: "back" | "forward";
};

export type DesktopPreviewNavigation = DesktopPreviewNavigationStep & {
    readonly guestId: number;
    readonly navigationId: number;
};

export interface KissopenDesktopBridge {
    kissopenRequest?(request: KissopenCloudRequest): Promise<KissopenCloudResponse>;
    /**
     * Opens a library file — fetched from the account's server by the signed
     * address the server gave it — with whatever this machine opens such files
     * with. Refused, not thrown, like a relay file.
     */
    kissopenFileOpen(url: string, name: string): Promise<RelayCommandResult>;
    /**
     * This window's development identity, absent in a packaged build. It is a
     * plain value rather than a call because the window is one build for its
     * whole life: the shell has it before the first frame and it never changes.
     */
    readonly buildIdentity?: DesktopBuildIdentity;
    /**
     * Whether this window was explicitly launched with desktop debug tooling.
     * This is fixed for the window's life and is separate from `buildIdentity`:
     * every development checkout has an identity, but only `--debug` windows
     * should run the live metrics sampler.
     */
    readonly debugMetricsEnabled: boolean;
    /**
     * Makes Chromium's preferred color scheme follow Kissopen's selection, so
     * previews, browser guests, and auxiliary windows agree with
     * the application tree instead of independently following macOS.
     */
    appearanceSet(mode: DesktopAppearanceMode): void;
    /**
     * Where a file the reader dropped, picked, or pasted actually lives on this
     * machine, when it lives anywhere. A file the browser only holds in memory —
     * a pasted screenshot — has no path and answers undefined.
     *
     * It is what lets an attachment be copied where it is going instead of read
     * into the renderer, expanded to base64, and pushed back out through a JSON
     * body every hop holds whole. A video is the case that makes that plain.
     */
    attachmentSourcePath(file: File): string | undefined;
    /** Points this window's browser guests at one local Kissopen Agent session's network boundary. */
    /** Returns the guest partition only after its workspace proxy is configured. */
    browserProxyApply(target: DesktopBrowserProxyTarget): Promise<string>;
    /** Absent on older native hosts, which cannot safely open private service pages. */
    browserCommand?(
        target: DesktopBrowserProxyTarget,
        guestId: number,
        command: DesktopBrowserCommand,
    ): Promise<DesktopBrowserCommandResult>;
    browserOpenSubscribe(listener: (url: string) => void): () => void;
    browserPasswordGenerate?(): Promise<void>;
    browserAutomationStart?(bindingId: string, scope: import("./browserAutomation").DesktopBrowserScope): Promise<void>;
    browserAutomationStop?(bindingId: string): Promise<void>;
    browserAutomationBind?(tabId: string, guestId: number, target: DesktopBrowserProxyTarget): Promise<void>;
    browserAutomationAction?(tabId: string, action: import("./browserAutomation").DesktopBrowserAutomationAction): Promise<void>;
    browserAutomationSubscribe?(listener: (event: import("./browserAutomation").DesktopBrowserAutomationEvent) => void): () => void;
    browserStatusSubscribe(listener: (status: DesktopBrowserStatus) => void): () => void;
    /** Announces that the shell received a WorkOS OAuth callback. */
    cloudAuthCallbackSubscribe(listener: () => void): () => void;
    /** Whether a callback is waiting, without consuming its one-shot URL. */
    cloudAuthCallbackPending(): Promise<boolean>;
    /** Takes the most recent unforwarded callback URL, if one has arrived. */
    cloudAuthCallbackTake(): Promise<string | undefined>;
    /** Selects the daemon's matching Cloud deployment and callback address. */
    cloudAuthConfigurationGet(): Promise<DesktopCloudAuthConfiguration>;
    /** Opens only the HTTPS authorization URL returned by Kissopen Agent. */
    cloudAuthOpen(url: string): Promise<void>;
    /**
     * Opens a link from a conversation in the reader's own browser.
     *
     * Not `window.open`: that is caught by this window and turned into a
     * browser tab inside a local workspace's panel. A conversation on the
     * relay has no workspace behind it, so such a tab opens either somewhere
     * the reader is not looking or nowhere at all. Answers whether the link
     * was one that could be opened, rather than failing silently.
     */
    linkOpen(url: string): Promise<boolean>;
    /**
     * Relays Command keyboard input while an isolated browser or HTML preview
     * guest owns focus. The renderer dispatches it through the same window
     * shortcut path as native host input.
     */
    guestKeySubscribe(listener: (event: DesktopGuestKeyEvent) => void): () => void;
    /**
     * The ordered life of every HTML preview guest in this window. A view claims
     * the steps carrying its own guest id and follows one navigation at a time.
     */
    previewNavigationSubscribe(listener: (step: DesktopPreviewNavigation) => void): () => void;
    /** Back and Forward, as asked for by the mouse, the trackpad, or the menu. */
    navigationStepSubscribe(listener: (step: DesktopNavigationStep) => void): () => void;
    /**
     * Reports how many conversations are waiting for the person, for the mark on
     * the Dock icon. One-way and fire-and-forget: the window states what it is
     * showing and the shell paints it, so nothing above this line has to wait on
     * or reconcile with the operating system.
     */
    dockUnreadSet(count: number): void;
    /**
     * Fires every time zoom is asked for, with the whole-number percentage the
     * window is now at — including when the answer is the one it was already
     * showing, because ⌘0 at 100% and ⌘− against the floor are exactly the
     * moments the reader needs telling that the command landed.
     *
     * The View menu owns zooming, not the page, so the value is pushed from the
     * main process rather than inferred here. There is nothing to ask for before
     * the first one arrives: a window nobody has zoomed has nothing to report.
     */
    zoomSubscribe(listener: (percent: number) => void): () => void;
    /**
     * Shows the file at one address in a window outside this one, reusing the
     * preview window if it is already open. Rejected unless the address is the
     * media route of a Kissopen Agent proxy this process is currently running.
     */
    mediaPreviewOpen(url: string): Promise<void>;
    directoryPick(): Promise<string | undefined>;
    desktopConfigGet(): Promise<DesktopConfig>;
    desktopConfigWrite(config: DesktopConfig): Promise<void>;
    /** Asks now for what the background check would otherwise find later. */
    daemonCheck(): Promise<void>;
    /**
     * Drains and restarts the local daemon onto the version already downloaded
     * here. Only the local host is ever restarted this way; a remote Kissopen Agent updates
     * itself and never takes this window.
     */
    daemonInstall(): Promise<void>;
    /** Hands the window back once a finished or failed install has been read. */
    daemonInstallDismiss(): Promise<void>;
    /**
     * Stops waiting for the drain and takes the daemon down now, interrupting
     * whatever it was still finishing.
     */
    daemonInstallKill(): Promise<void>;
    /** Drains and restarts the local daemon on the version it is already running. */
    daemonRestart(): Promise<void>;
    /** Installs/checks the compatible CLI before any phone authorization. */
    legacyCliPrepare(): Promise<void>;
    /** Links the prepared terminal CLI to this machine's existing Mobile pairing. */
    legacyCliConnect(): Promise<void>;
    /** Downloads and verifies the first KISSOPEN Agent release without running it. */
    daemonDownload(): Promise<void>;
    daemonGet(): Promise<DesktopDaemonSnapshot>;
    /** Starts the verified first KISSOPEN Agent release already downloaded here. */
    daemonStart(): Promise<void>;
    daemonSubscribe(listener: (snapshot: DesktopDaemonSnapshot) => void): () => void;
    /** The account's relay as it stands. Null when nobody is reading it. */
    relayGet(): Promise<RelayState>;
    /** Follows the account's relay. Returns the unsubscribe. */
    relaySubscribe(listener: (state: RelayState) => void): () => void;
    /** Reads one conversation the relay holds. Failures come back, not thrown. */
    relayConversation(sessionId: string): Promise<RelayConversation>;
    /** Says something in a conversation on another machine. */
    relaySay(
        sessionId: string,
        text: string,
        mode?: { model?: string; modelProviderId?: string; effort?: string },
        files?: readonly RelayAttachment[],
        /**
         * The short label a person sees in place of `text`, for a message the
         * product composed — a board button's ask — so its prompt is never shown.
         */
        displayText?: string,
    ): Promise<RelayCommandResult>;
    /**
     * Answers a tool call that is waiting on a person.
     *
     * The request id is the request's own key in the agent state, not the tool
     * call's id: a subagent publishes its request under a scoped key, and only
     * an answer under that same key unblocks it.
     */
    relayDecide(
        sessionId: string,
        requestId: string,
        approved: boolean,
    ): Promise<RelayCommandResult>;
    /**
     * Answers a question a session on another machine put to the person, or
     * dismisses it unanswered. Answers are each question's chosen words by
     * question id, the way the local transcript's prompt collects them.
     */
    relayAnswerQuestion(
        sessionId: string,
        requestId: string,
        answers: Readonly<Record<string, readonly string[]>>,
    ): Promise<RelayCommandResult>;
    relayCancelQuestion(sessionId: string, requestId: string): Promise<RelayCommandResult>;
    /** Stops the run in progress on another machine. */
    relayAbort(sessionId: string): Promise<RelayCommandResult>;
    /** Clears an assistant's conversation through its agent; the assistant stays. */
    relayClear(sessionId: string): Promise<RelayCommandResult>;
    /** Archives a conversation through its agent; it leaves every list. */
    relayArchive(sessionId: string): Promise<RelayCommandResult>;
    /** Deletes a conversation for good, after its agent archives it. */
    relayDelete(sessionId: string): Promise<RelayCommandResult>;
    /*
    The terminals standing in one session's folder on another machine.

    Refused with a reason rather than answered empty when that machine offers
    none: a reader told there are no terminals would start one, and a machine
    that cannot start one has to say so in those words.
    */
    relayTerminalList(sessionId: string): Promise<RelayTerminalsResult>;
    relayTerminalCreate(
        sessionId: string,
        request: { cols?: number; rows?: number; colorScheme?: "light" | "dark" },
    ): Promise<RelayTerminalResult>;
    relayTerminalResize(
        sessionId: string,
        terminalId: string,
        cols: number,
        rows: number,
    ): Promise<RelayTerminalResult>;
    relayTerminalStop(sessionId: string, terminalId: string): Promise<RelayTerminalResult>;
    /**
     * Attaches to one terminal, answering the handle to address it by.
     *
     * A handle rather than the stream itself: the stream lives on the relay
     * connection, which is the main process's, along with the credential that
     * opened it.
     */
    relayTerminalAttach(sessionId: string, terminalId: string): Promise<RelayTerminalAttached>;
    /** Sends what the reader typed, resolving once the machine has taken it. */
    relayTerminalWrite(handle: number, chunk: Uint8Array): Promise<RelayCommandResult>;
    /** Lets go of one attachment. The terminal itself lives on without it. */
    relayTerminalDetach(handle: number): void;
    /** Follows the bytes of every attachment this window holds. */
    relayTerminalDataSubscribe(listener: (handle: number, chunk: Uint8Array) => void): () => void;
    /** Follows the ending of every attachment this window holds. */
    relayTerminalClosedSubscribe(listener: (handle: number, error?: string) => void): () => void;
    /**
     * What the checkout on another machine looks like right now.
     *
     * Refused, not thrown, when that session does not offer its files: a
     * machine running an older agent is an ordinary thing to meet, and the
     * panel says so rather than showing an empty tree.
     */
    relayGitState(sessionId: string): Promise<RelayGitState>;
    /**
     * Opens a file that is on another machine, in an application on this one.
     *
     * The path is the one the conversation wrote, relative to the folder it
     * works in or absolute on that machine. Refused, not thrown, when the file
     * cannot be read or is not something worth opening.
     */
    relayFileOpen(sessionId: string, path: string): Promise<RelayCommandResult>;
    /**
     * The bytes of one file on another machine, base64, by the path a
     * conversation there wrote — a picture the agent made, to show it larger
     * and save it. Refused, not thrown, like the open.
     */
    relayFileRead(
        sessionId: string,
        path: string,
        project?: RelayProjectFileReadOptions,
    ): Promise<RelayFileRead>;
    /**
     * One folder of the workspace a conversation on another machine works in,
     * for the panel's All Files. Refused, not thrown, like the read.
     */
    relayDirectoryList(sessionId: string, path: string): Promise<RelayDirectory>;
    /**
     * Sends one file into the workspace a conversation on another machine works
     * in, at `path` there (normally `uploads/<name>`); it lands under a free
     * name, which the answer gives. Refused, not thrown.
     */
    relayFileUpload(sessionId: string, path: string, bytes: Uint8Array): Promise<RelayFileUploaded>;
    /** The two sides of one changed file there, ready to be drawn as a diff. */
    relayGitFile(
        sessionId: string,
        gitBase: string,
        file: KissopenAgentGitFile,
    ): Promise<RelayGitFile>;
    /** Follows arrivals in conversations on other machines. */
    relayArrivalSubscribe(listener: (sessionId: string) => void): () => void;
    /** Follows which conversations are working. */
    relayActivitySubscribe(listener: (sessionId: string, running: boolean) => void): () => void;
    daemonUpgrade(): Promise<void>;
    /** Installs one exact version if needed, then runs the daemon on it. */
    daemonVersionSelect(version: string): Promise<void>;
    debugGet(): Promise<DesktopDebugSnapshot>;
    debugAllStart(): Promise<DesktopDebugSnapshot>;
    debugAllStop(): Promise<DesktopDebugSnapshot>;
    debugMainInspectorStart(): Promise<DesktopDebugSnapshot>;
    debugMainInspectorStop(): Promise<DesktopDebugSnapshot>;
    debugRendererInspectorStart(): Promise<DesktopDebugSnapshot>;
    debugRendererInspectorStop(): Promise<DesktopDebugSnapshot>;
    debugDaemonInspectorStart(): Promise<DesktopDebugSnapshot>;
    debugDaemonInspectorStop(): Promise<DesktopDebugSnapshot>;
    debugSubscribe(listener: (snapshot: DesktopDebugSnapshot) => void): () => void;
    profilerGet(): Promise<DesktopProfilerSnapshot>;
    profilerStart(request?: DesktopProfilerStartRequest): Promise<DesktopProfilerSnapshot>;
    profilerStop(): Promise<DesktopProfilerSnapshot>;
    profilerSubscribe(listener: (snapshot: DesktopProfilerSnapshot) => void): () => void;
    /** Private typed Wall transport used by the profile renderer bootstrap. */
    profilerReactMessage(message: DesktopReactDevtoolsMessage): void;
    profilerReactSubscribe(listener: (command: DesktopReactDevtoolsCommand) => void): () => void;
    applicationMenuOpen(): Promise<void>;
    /** Where local first-run setup stands, without waiting for its next change. */
    onboardingGet(): Promise<LocalOnboardingSnapshot>;
    onboardingSubscribe(listener: (snapshot: LocalOnboardingSnapshot) => void): () => void;
    onboardingProfileCreate(input: {
        readonly email: string;
        readonly name: string;
    }): Promise<void>;
    /**
     * Opens the native folder picker, requires a Git repository root, and opens
     * it as this KISSOPEN Agent's first project. Picking, validating, and registering all
     * happen in the main process; the window never learns a path it did not
     * already receive in a snapshot.
     */
    onboardingProjectChoose(): Promise<void>;
    /** Remembers the explicit handoff to the secretary without importing a project. */
    onboardingChiefOfStaffComplete(): Promise<void>;
    /** Leaves provider authentication setup after its report, or skips it while it runs. */
    onboardingAssistantsContinue(): Promise<void>;
    runtimeGet(): Promise<DesktopRuntimeSnapshot>;
    runtimeReset(): Promise<void>;
    runtimeRetry(): Promise<void>;
    runtimeStart(request: DesktopStartRequest): Promise<void>;
    topologySelect(topologyId: string): Promise<void>;
    updateInstall(): Promise<void>;
    windowStateGet(): Promise<DesktopWindowState>;
    windowStateSubscribe(listener: (state: DesktopWindowState) => void): () => void;
    subscribe(listener: (snapshot: DesktopRuntimeSnapshot) => void): () => void;
}

/**
 * The whole capability of the window that shows one file.
 *
 * It is deliberately not `KissopenDesktopBridge`: a window whose only job is to
 * show one picture or play one recording has no business writing preferences or
 * choosing a topology, so it is handed a bridge that cannot do either rather
 * than the application's and a promise not to use it.
 */
/**
 * What the bar at the bottom of the screen can do.
 *
 * Deliberately three things. It is one text field standing over whatever the
 * person was looking at: it says something, it goes away, and it reports
 * whether the first worked. Everything else about a conversation belongs in
 * the window, which is what `sent` lets the bar hand it over to.
 */
export interface KissopenQuickBarBridge {
    /** Sends to the account's cloud bot. Answers what went wrong, if anything. */
    quickBarSend(text: string): Promise<{ ok: boolean; error?: string }>;
    /** Closes the bar, leaving what it was standing over untouched. */
    quickBarClose(): Promise<void>;
    /** Opens the window on the conversation this went to, then closes the bar. */
    quickBarOpenConversation(): Promise<void>;
    /**
     * Says how tall the bar turned out, so the window is sized to it.
     *
     * The window is transparent and the bar carries its own shadow, so any
     * height the window has beyond the bar is a rectangle of that shadow
     * floating under it — which is the detached block a fixed guess left
     * behind. The bar measures itself instead.
     */
    quickBarHeight(height: number): void;
}

export interface KissopenMediaPreviewBridge {
    /** What this window was opened for; it has not been sent anything yet. */
    mediaPreviewGet(): Promise<DesktopMediaPreview | undefined>;
    /** Fires when the window is pointed at a different file. */
    mediaPreviewSubscribe(listener: (preview: DesktopMediaPreview | undefined) => void): () => void;
    /** Closes this window from inside it. */
    mediaPreviewClose(): Promise<void>;
}

export const desktopIpc = {
    kissopenRequest: "KISSOPEN:consumer-request",
    /** Renderer → main: open a library file by its address. */
    kissopenFileOpen: "kissopen:file-open",
    /** Renderer → main only: the appearance source inherited by local web contents. */
    appearanceSet: "kissopen:appearance:set",
    browserProxyApply: "kissopen:browser:proxy-apply",
    browserCommand: "kissopen:browser:command",
    browserPasswordGenerate: "kissopen:browser:password-generate",
    browserAutomationStart: "kissopen:browser:automation-start",
    browserAutomationStop: "kissopen:browser:automation-stop",
    browserAutomationBind: "kissopen:browser:automation-bind",
    browserAutomationAction: "kissopen:browser:automation-action",
    browserAutomationEvent: "kissopen:browser:automation-event",
    browserOpenRequested: "kissopen:browser:open-requested",
    browserStatusChanged: "kissopen:browser:status-changed",
    cloudAuthCallbackReceived: "kissopen:cloud-auth:callback-received",
    cloudAuthCallbackPending: "kissopen:cloud-auth:callback-pending",
    cloudAuthCallbackTake: "kissopen:cloud-auth:callback-take",
    cloudAuthConfigurationGet: "kissopen:cloud-auth:configuration-get",
    cloudAuthOpen: "kissopen:cloud-auth:open",
    /** Renderer → main: open a conversation's link in the reader's browser. */
    linkOpen: "kissopen:link:open",
    guestKey: "kissopen:guest:key",
    previewNavigationChanged: "kissopen:html-preview:navigation-changed",
    /** Main → renderer: the reader asked to go back or forward. */
    navigationStep: "kissopen:navigation:step",
    directoryPick: "kissopen:directory:pick",
    quickBarHeight: "kissopen:quick-bar:height",
    quickBarSend: "kissopen:quick-bar:send",
    quickBarClose: "kissopen:quick-bar:close",
    quickBarOpenConversation: "kissopen:quick-bar:open-conversation",
    mediaPreviewChanged: "kissopen:media-preview:changed",
    mediaPreviewClose: "kissopen:media-preview:close",
    mediaPreviewGet: "kissopen:media-preview:get",
    mediaPreviewOpen: "kissopen:media-preview:open",
    /** Renderer → main only: the number of conversations waiting for the person. */
    dockUnreadSet: "kissopen:dock:unread-set",
    /** Main → renderer only: the window's zoom, every time the View menu is used. */
    zoomChanged: "kissopen:zoom:changed",
    desktopConfigGet: "kissopen:desktop-config:get",
    desktopConfigWrite: "kissopen:desktop-config:write",
    /** Main → renderer: the account's relay, every time it moves. */
    relayChanged: "kissopen:relay:changed",
    /** Renderer → main: the relay as it stands, for a window that just opened. */
    relayGet: "kissopen:relay:get",
    /** Renderer → main: answer a tool call waiting on a person. */
    relayDecide: "kissopen:relay:decide",
    relayAnswerQuestion: "kissopen:relay:answer-question",
    relayCancelQuestion: "kissopen:relay:cancel-question",
    /** Renderer → main: stop the run on another machine. */
    relayAbort: "kissopen:relay:abort",
    relayArchive: "kissopen:relay:archive",
    relayClear: "kissopen:relay:clear",
    relayDelete: "kissopen:relay:delete",
    /** Renderer → main: read another machine's checkout. */
    relayGitState: "kissopen:relay:git-state",
    /** Renderer → main: read one changed file there. */
    relayGitFile: "kissopen:relay:git-file",
    /** Renderer → main: open a file from another machine in an app on this one. */
    relayFileOpen: "kissopen:relay:file-open",
    /** Renderer → main: read one file on another machine, base64. */
    relayFileRead: "kissopen:relay:file-read",
    /** Renderer → main: list one folder on another machine. */
    relayDirectoryList: "kissopen:relay:directory-list",
    /** Renderer → main: send one file to another machine. */
    relayFileUpload: "kissopen:relay:file-upload",
    /** Renderer → main: the terminals of a session on another machine. */
    relayTerminalList: "kissopen:relay:terminal-list",
    relayTerminalCreate: "kissopen:relay:terminal-create",
    relayTerminalResize: "kissopen:relay:terminal-resize",
    relayTerminalStop: "kissopen:relay:terminal-stop",
    relayTerminalAttach: "kissopen:relay:terminal-attach",
    relayTerminalWrite: "kissopen:relay:terminal-write",
    relayTerminalDetach: "kissopen:relay:terminal-detach",
    /** Main → renderer: bytes from one attachment, as the terminal makes them. */
    relayTerminalData: "kissopen:relay:terminal-data",
    /** Main → renderer: one attachment ended. */
    relayTerminalClosed: "kissopen:relay:terminal-closed",
    /** Renderer → main: one conversation from another machine, read-only. */
    relayConversation: "kissopen:relay:conversation",
    /** Renderer → main: say something in a conversation on another machine. */
    relaySay: "kissopen:relay:say",
    /** Main → renderer: that conversation gained a message. */
    relayArrival: "kissopen:relay:arrival",
    /** Main → renderer: a conversation started or stopped working. */
    relayActivity: "kissopen:relay:activity",
    daemonChanged: "kissopen:daemon:changed",
    daemonCheck: "kissopen:daemon:check",
    daemonDownload: "kissopen:daemon:download",
    daemonInstall: "kissopen:daemon:install",
    daemonInstallDismiss: "kissopen:daemon:install-dismiss",
    daemonInstallKill: "kissopen:daemon:install-kill",
    daemonRestart: "kissopen:daemon:restart",
    legacyCliConnect: "kissopen:legacy-cli:connect",
    legacyCliPrepare: "kissopen:legacy-cli:prepare",
    daemonGet: "kissopen:daemon:get",
    daemonStart: "kissopen:daemon:start",
    daemonUpgrade: "kissopen:daemon:upgrade",
    daemonVersionSelect: "kissopen:daemon:version-select",
    debugAllStart: "kissopen:debug:all-start",
    debugAllStop: "kissopen:debug:all-stop",
    debugChanged: "kissopen:debug:changed",
    debugDaemonInspectorStart: "kissopen:debug:daemon-inspector-start",
    debugDaemonInspectorStop: "kissopen:debug:daemon-inspector-stop",
    debugGet: "kissopen:debug:get",
    debugMainInspectorStart: "kissopen:debug:main-inspector-start",
    debugMainInspectorStop: "kissopen:debug:main-inspector-stop",
    debugRendererInspectorStart: "kissopen:debug:renderer-inspector-start",
    debugRendererInspectorStop: "kissopen:debug:renderer-inspector-stop",
    profilerGet: "kissopen:profiler:get",
    profilerStart: "kissopen:profiler:start",
    profilerStop: "kissopen:profiler:stop",
    profilerChanged: "kissopen:profiler:changed",
    profilerReactCommand: "kissopen:profiler:react-command",
    profilerReactMessage: "kissopen:profiler:react-message",
    applicationMenuOpen: "kissopen:application-menu:open",
    onboardingAssistantsContinue: "kissopen:onboarding:assistants-continue",
    onboardingChanged: "kissopen:onboarding:changed",
    onboardingGet: "kissopen:onboarding:get",
    onboardingProfileCreate: "kissopen:onboarding:profile-create",
    onboardingProjectChoose: "kissopen:onboarding:project-choose",
    onboardingChiefOfStaffComplete: "kissopen:onboarding:chief-of-staff-complete",
    runtimeChanged: "kissopen:runtime:changed",
    runtimeGet: "kissopen:runtime:get",
    runtimeReset: "kissopen:runtime:reset",
    runtimeRetry: "kissopen:runtime:retry",
    runtimeStart: "kissopen:runtime:start",
    topologySelect: "kissopen:topology:select",
    updateInstall: "kissopen:update:install",
    windowStateChanged: "kissopen:window-state:changed",
    windowStateGet: "kissopen:window-state:get",
} as const;

/**
 * In-memory Chromium profile used only by rendered HTML file previews. It is
 * deliberately not persistent and not the browser's: a previewed page keeps no
 * cookies or storage between sessions, and can reach nothing the browser tabs
 * are logged into.
 */
export const kissopenHtmlPreviewPartition = "kissopen-html-preview";

/**
 * Query the preview window is loaded with, so the renderer entry mounts only the
 * file instead of the whole application. It is a property of the window's own
 * address rather than something asked for over the bridge, so the first frame is
 * already the right one.
 */
export const mediaPreviewView = { key: "view", value: "media-preview" } as const;

/**
 * Launch argument that tells the preload it is loading the preview window, so
 * the reduced bridge is chosen before the page exists rather than inferred from
 * an address the page could later change.
 */
export const mediaPreviewArgument = "--kissopen-media-preview";

/**
 * Query the bar is loaded with, so the renderer entry mounts one text field
 * instead of the whole application. A property of the address, like the
 * preview's, so the first frame is already the bar.
 */
export const quickBarView = { key: "view", value: "quick-bar" } as const;

/**
 * Launch argument that tells the preload it is loading the bar, so the reduced
 * bridge is chosen before the page exists. The bar floats over other people's
 * screens; it gets three calls, not the application's capabilities.
 */
export const quickBarArgument = "--kissopen-quick-bar";
