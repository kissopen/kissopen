import { t } from "kissopen-desktop-state";
import { type AssistantMarkName } from "./AssistantMark";
import { Button } from "./Button";
import { DesktopMobileSetup, type DesktopMobileSetupStep } from "./DesktopMobileSetup";
import { OnboardingSteps, type OnboardingStage } from "./OnboardingSteps";
import { QRCode } from "./QRCode";
import { SetupAssistants, type SetupAssistantEntry } from "./SetupAssistants";
import { SetupPage, SetupProgress, type SetupPageProgress } from "./SetupPage";
import { Spinner } from "./Spinner";
import { TextField } from "./TextField";
import type { ThemeMode } from "./ThemeScope";

/** The coding assistants Kissopen looks for, and nothing beyond them. */
export type LocalOnboardingAssistantId = "claude" | "codex" | "grok";

/**
 * One of them as the machine answered for it: the command is here, or it is
 * not. Whether a command that is here can actually run is the connected Kissopen Agent's
 * answer rather than the shell's, and the screen showing this carries it.
 */
export interface LocalOnboardingAssistant {
    readonly id: LocalOnboardingAssistantId;
    /** What the daemon proved about the currently configured local credential. */
    readonly authentication: "checking" | "valid" | "invalid" | "error" | "unavailable";
    readonly status: "found" | "missing";
    /** Where the machine keeps it, when it has it. */
    readonly command?: string;
}

/**
 * The Kissopen Agent archive arriving, while it is arriving. Counted by the
 * process fetching it; absent before the first byte and after the last.
 */
export interface LocalOnboardingDownload {
    readonly receivedBytes: number;
    readonly totalBytes: number;
}

export type LocalOnboardingAgentSetupPhase =
    | { readonly kind: "preparing" }
    | { readonly download?: LocalOnboardingDownload; readonly kind: "downloading" }
    | { readonly kind: "retrying"; readonly message: string }
    | { readonly kind: "ready"; readonly version: string }
    | { readonly kind: "starting" };

export type LocalOnboardingView =
    | { readonly kind: "kissopen-mobile-desktop"; readonly step: DesktopMobileSetupStep }
    | { readonly kind: "checking"; readonly message?: string }
    | { readonly kind: "node-missing" }
    | {
          readonly kind: "agent-setup";
          readonly message?: string;
          readonly phase: LocalOnboardingAgentSetupPhase;
      }
    | { readonly kind: "connecting" }
    | { readonly kind: "connect-failed"; readonly message: string; readonly retrying: boolean }
    | {
          /** Binary discovery followed by daemon-owned authentication checks. */
          readonly kind: "provider-authentication";
          readonly assistants: readonly LocalOnboardingAssistant[];
          readonly complete: boolean;
      }
    | { readonly kind: "examining" }
    | {
          readonly busy: boolean;
          readonly email: string;
          readonly kind: "profile-required";
          readonly message?: string;
          readonly name: string;
      }
    | { readonly kind: "kissopen-mobile-checking" }
    | {
          readonly busy: boolean;
          readonly kind: "kissopen-mobile-offer";
          readonly message?: string;
      }
    | {
          readonly data: string;
          readonly expiresAt: number;
          readonly kind: "kissopen-mobile-pairing";
      }
    | {
          readonly busy: boolean;
          readonly kind: "kissopen-mobile-failed";
          readonly message: string;
      }
    | {
          readonly kind: "finishing";
          readonly busy: boolean;
          readonly message?: string;
      }
    | { readonly kind: "project"; readonly busy: boolean; readonly message?: string };

export interface LocalOnboardingScreenProps {
    readonly showSteps?: boolean;
    readonly appearance: ThemeMode;
    readonly view: LocalOnboardingView;
    onAssistantsContinue(): void;
    onConnectRetry(): void;
    onKissopenMobileConnect(): void;
    onKissopenMobileSkip(): void;
    onKissopenMobilePlatformSelect?(platform: "ios" | "android"): void;
    onProjectChoose(): void;
    onProjectSetupBack?(): void;
    onProfileNameChange(value: string): void;
    onProfileEmailChange(value: string): void;
    onProfileCreate(): void;
}

/** What a reader is told to run when Kissopen cannot start their Kissopen Agent itself. */
const DAEMON_START_COMMAND = "kissopen-agent start";

/**
 * The download as the button reports it: the counted share and both sizes while
 * an archive is on the way, and an unmeasured wait otherwise.
 *
 * The two ends of a download are genuinely unmeasured rather than zero and one
 * hundred — the release is being looked up, then what arrived is being checked
 * and unpacked — so neither is dressed up as a fraction.
 */
function downloadProgress(download: LocalOnboardingDownload | undefined): SetupPageProgress {
    if (!download || download.totalBytes <= 0) return { kind: "waiting" };
    return {
        detail: `${byteSize(download.receivedBytes)} of ${byteSize(download.totalBytes)}`,
        fraction: download.receivedBytes / download.totalBytes,
        kind: "measured",
    };
}

function agentSetupProgress(phase: LocalOnboardingAgentSetupPhase): SetupPageProgress {
    if (phase.kind === "ready") return { detail: phase.version, fraction: 1, kind: "measured" };
    return phase.kind === "downloading" ? downloadProgress(phase.download) : { kind: "waiting" };
}

function agentSetupProgressLabel(phase: LocalOnboardingAgentSetupPhase): string {
    switch (phase.kind) {
        case "preparing":
            return "Preparing download…";
        case "downloading":
            return "Downloading KissOpen Agent…";
        case "retrying":
            return "Retrying automatically…";
        case "ready":
            return "Starting KissOpen Agent…";
        case "starting":
            return "Waiting for KissOpen Agent…";
    }
}

function agentSetupCopy(
    phase: LocalOnboardingAgentSetupPhase,
    message: string | undefined,
): string {
    switch (phase.kind) {
        case "retrying":
            return t("{phase} KissOpen will retry the download automatically.", {
                phase: phase.message,
            });
        case "ready":
            return message ?? t("KissOpen Agent is downloaded and starting automatically.");
        case "starting":
            return message ?? t("KissOpen Agent is starting automatically.");
        case "preparing":
        case "downloading":
            return "KissOpen is downloading and verifying KissOpen Agent for this machine.";
    }
}

/** A size as someone would say it, at the one decimal a release is worth. */
function byteSize(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pairingExpiration(expiresAt: number): string {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
        expiresAt,
    );
}

/**
 * Each assistant as its column says it: whose mark it carries, the product's
 * name, and the command that name is on this machine.
 *
 * The id is the command, which is why nothing here is looked up twice — but all
 * three are written out separately anyway. What a person is told to install and
 * what they are told to type are not always the same word, and the mark belongs
 * to the company rather than to the command: Codex is OpenAI's, so that is what
 * its mark is called here. Putting the wrong name on somebody else's trademark
 * is not a shortcut worth taking.
 */
const ASSISTANTS: Record<
    LocalOnboardingAssistantId,
    { command: string; mark: AssistantMarkName; name: string }
> = {
    claude: { command: "claude", mark: "claude", name: "Claude Code" },
    codex: { command: "codex", mark: "openai", name: "Codex" },
    grok: { command: "grok", mark: "grok", name: "Grok" },
};

/**
 * One card on the report that follows an install: what is on the machine, and
 * where.
 *
 * A found assistant shows the path the shell gave, because the one question
 * somebody has about a machine that "has" a command is which one it found —
 * two versions on a PATH is the ordinary case, not the exotic one.
 */
function assistantAuthenticationEntry(assistant: LocalOnboardingAssistant): SetupAssistantEntry {
    const { mark, name } = ASSISTANTS[assistant.id];
    const detail = (() => {
        switch (assistant.authentication) {
            case "checking":
                return "Checking credentials…";
            case "valid":
                return "Credentials valid";
            case "invalid":
                return "Credentials invalid";
            case "error":
                return "Could not verify";
            case "unavailable":
                return "Not installed";
        }
    })();
    return {
        detail,
        id: assistant.id,
        mark,
        name,
        status:
            assistant.authentication === "valid"
                ? "found"
                : assistant.authentication === "checking"
                  ? "checking"
                  : "missing",
    };
}

/** The stable, dimmed three-vendor row shown before authentication resolves. */
const CHECKING_ASSISTANTS: readonly SetupAssistantEntry[] = Object.entries(ASSISTANTS).map(
    ([id, assistant]) => ({
        detail: t("Checking credentials…"),
        id,
        mark: assistant.mark,
        name: assistant.name,
        status: "checking",
    }),
);

interface MachineSetupProjection {
    readonly assistants?: readonly SetupAssistantEntry[];
    readonly copy: string;
    readonly hasValidAuthentication: boolean;
    readonly label: string;
    readonly progress: SetupPageProgress;
    readonly ready: boolean;
    readonly title: string;
}

function machineSetupProject(view: LocalOnboardingView): MachineSetupProjection | undefined {
    if (view.kind === "agent-setup")
        return {
            copy: agentSetupCopy(view.phase, view.message),
            hasValidAuthentication: false,
            label: agentSetupProgressLabel(view.phase),
            progress: agentSetupProgress(view.phase),
            ready: false,
            title: t("Launching KissOpen Agent"),
        };
    if (view.kind === "connecting")
        return {
            copy: "KissOpen Agent is starting and connecting to KissOpen.",
            hasValidAuthentication: false,
            label: t("Waiting for KissOpen Agent…"),
            progress: { kind: "waiting" },
            ready: false,
            title: t("Launching KissOpen Agent"),
        };
    if (view.kind === "examining")
        return {
            assistants: CHECKING_ASSISTANTS,
            copy: "KissOpen is looking for existing Claude, Codex, and Grok subscriptions on this machine.",
            hasValidAuthentication: false,
            label: t("Preparing authentication checks…"),
            progress: { kind: "waiting" },
            ready: false,
            title: t("Searching for existing subscriptions"),
        };
    if (view.kind === "provider-authentication")
        return {
            assistants: view.assistants.map(assistantAuthenticationEntry),
            copy: view.complete
                ? view.assistants.some((assistant) => assistant.authentication === "valid")
                    ? "KissOpen will use these subscriptions for its work."
                    : "KissOpen couldn't find a valid subscription on this machine. Install and sign in to Claude, Codex, or Grok later; KissOpen will detect it automatically, or you can rescan from Settings."
                : "KissOpen is checking the existing authentication for your Claude, Codex, and Grok subscriptions.",
            hasValidAuthentication: view.assistants.some(
                (assistant) => assistant.authentication === "valid",
            ),
            label: t("Checking subscription authentication…"),
            progress: { fraction: 1, kind: "measured" },
            ready: view.complete,
            title: view.complete
                ? view.assistants.some((assistant) => assistant.authentication === "valid")
                    ? "Found valid subscriptions"
                    : "Unable to find valid subscriptions"
                : "Searching for existing subscriptions",
        };
    return undefined;
}

function MachineSetupStatus(props: {
    readonly projection: MachineSetupProjection;
    onContinue(): void;
    onSkip(): void;
}) {
    const showAssistants = props.projection.assistants !== undefined;
    return (
        <div
            className="kissopen-local-onboarding__machine-status"
            data-kissopen-desktop-ui="local-onboarding-machine-status"
            data-view={showAssistants ? "assistants" : "progress"}
        >
            <div
                aria-hidden={showAssistants}
                className="kissopen-local-onboarding__machine-progress"
                data-kissopen-desktop-ui="local-onboarding-machine-progress"
            >
                <SetupProgress
                    label={props.projection.label}
                    progress={props.projection.progress}
                />
            </div>
            <div
                aria-hidden={!showAssistants}
                className="kissopen-local-onboarding__machine-assistants"
                data-kissopen-desktop-ui="local-onboarding-machine-assistants"
            >
                <SetupAssistants
                    assistants={props.projection.assistants ?? CHECKING_ASSISTANTS}
                    data-testid={showAssistants ? "local-onboarding-assistants" : undefined}
                />
                <div
                    aria-hidden={!props.projection.ready}
                    className="kissopen-local-onboarding__machine-actions"
                >
                    {props.projection.ready ? (
                        props.projection.hasValidAuthentication ? (
                            <Button onClick={props.onContinue} size="large" width={240}>
                                {t("Continue")}
                            </Button>
                        ) : (
                            <Button onClick={props.onSkip} size="large" width={240}>
                                {t("Skip")}
                            </Button>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/**
 * First-run setup for this machine, as one machine-setup surface followed by
 * the profile, optional mobile connection, and project decisions it discovers
 * are still owed.
 *
 * Every state is one `SetupPage`: a picture of what is happening, a sentence
 * naming it, a line explaining it, and at most one thing to do. Download,
 * launch, subscription discovery, and automatic verification retain one transition
 * identity so their live progress changes in place instead of becoming a tour
 * of setup pages.
 *
 * Which stage is showing is entirely the caller's, derived from what is true of
 * the machine rather than from a position someone remembered, so an interrupted
 * install or a restart resumes at the truthful stage. This component only draws
 * it.
 */
export function LocalOnboardingScreen(props: LocalOnboardingScreenProps) {
    const { view } = props;
    if (view.kind === "kissopen-mobile-desktop")
        return (
            <DesktopMobileSetup
                appearance={props.appearance}
                step={view.step}
                onboarding={props.showSteps}
                onContinue={props.onKissopenMobileConnect}
                onSkip={props.onKissopenMobileSkip}
                onPlatformSelect={props.onKissopenMobilePlatformSelect}
            />
        );
    // Download, start, discovery, and verification are one machine-setup
    // surface. Profile, mobile pairing, and project decisions begin their own
    // pages after that machine work.
    const transitionKey = (() => {
        switch (view.kind) {
            case "profile-required":
            case "project":
            case "finishing":
            case "kissopen-mobile-checking":
            case "kissopen-mobile-offer":
            case "kissopen-mobile-pairing":
            case "kissopen-mobile-failed":
                return view.kind;
            default:
                return "local-agent-setup";
        }
    })();
    const frame = {
        backdrop: { appearance: props.appearance, kind: "sky" },
        transitionKey,
        steps: props.showSteps ? (
            <OnboardingSteps
                scope="desktop"
                stage={onboardingStage(view)}
                failed={
                    view.kind === "node-missing" ||
                    view.kind === "connect-failed" ||
                    view.kind === "kissopen-mobile-failed"
                }
            />
        ) : undefined,
    } as const;
    const machineSetup = machineSetupProject(view);

    if (machineSetup)
        return (
            <SetupPage
                {...frame}
                className="kissopen-local-onboarding__machine-setup"
                copy={machineSetup.copy}
                data-testid="local-onboarding-screen"
                figure="secretary"
                title={machineSetup.title}
            >
                <MachineSetupStatus
                    onContinue={props.onAssistantsContinue}
                    onSkip={props.onAssistantsContinue}
                    projection={machineSetup}
                />
            </SetupPage>
        );

    if (view.kind === "checking")
        return (
            <SetupPage
                {...frame}
                copy={view.message ?? t("Reading what this machine already has.")}
                data-testid="local-onboarding-screen"
                // A probe with nothing to report yet, so the mark breathes:
                // one undivided wait rather than the relay's sequence of steps.
                loader="breathe"
                title={t("Checking this machine…")}
            />
        );

    if (view.kind === "node-missing")
        return (
            <SetupPage
                {...frame}
                copy="KissOpen Agent runs on Node, and KissOpen will not put a runtime on your machine by itself. Install Node and setup continues on its own."
                data-testid="local-onboarding-screen"
                scene="wand"
                title={t("Node.js is required")}
            />
        );

    if (view.kind === "kissopen-mobile-checking")
        return (
            <SetupPage
                {...frame}
                copy="Reading this KissOpen Agent's mobile connection."
                data-testid="local-onboarding-screen"
                loader="breathe"
                title={t("Checking KissOpen Mobile…")}
            />
        );

    if (view.kind === "kissopen-mobile-offer")
        return (
            <SetupPage
                {...frame}
                className="kissopen-local-onboarding__mobile"
                copy={
                    view.message ??
                    t(
                        "Connect KissOpen, Claude Code, and Codex to KissOpen Mobile. Follow sessions, reply, and approve requests when you're away from your desk.",
                    )
                }
                data-testid="local-onboarding-screen"
                scene="alien-monster"
                title={t("Take KissOpen with you")}
            >
                <div className="kissopen-local-onboarding__mobile-actions">
                    <Button
                        loading={view.busy}
                        onClick={props.onKissopenMobileConnect}
                        size="large"
                        width={240}
                    >
                        {t("Connect KissOpen Mobile")}
                    </Button>
                    <Button onClick={props.onKissopenMobileSkip} size="medium" variant="ghost">
                        {t("Skip")}
                    </Button>
                </div>
            </SetupPage>
        );

    if (view.kind === "kissopen-mobile-pairing")
        return (
            <SetupPage
                {...frame}
                className="kissopen-local-onboarding__mobile kissopen-local-onboarding__mobile-pairing"
                copy="Open KissOpen Mobile, choose Pair Desktop, then scan this code. KissOpen continues automatically when your phone approves."
                data-testid="local-onboarding-screen"
                title={t("Scan with KissOpen Mobile")}
            >
                <div className="kissopen-local-onboarding__mobile-pairing-body">
                    <QRCode
                        data={view.data}
                        data-testid="kissopen-mobile-pairing-qr"
                        label={t("QR code to pair KissOpen Mobile")}
                        size={240}
                    />
                    <div className="kissopen-local-onboarding__mobile-waiting">
                        <Spinner label={t("Pairing in progress")} size={16} tone="inverse" />
                        <span>
                            {t("Waiting for your phone · expires {expiration}", {
                                expiration: pairingExpiration(view.expiresAt),
                            })}
                        </span>
                    </div>
                    <Button onClick={props.onKissopenMobileSkip} size="medium" variant="ghost">
                        {t("Skip")}
                    </Button>
                </div>
            </SetupPage>
        );

    if (view.kind === "kissopen-mobile-failed")
        return (
            <SetupPage
                {...frame}
                className="kissopen-local-onboarding__mobile"
                copy={view.message}
                data-testid="local-onboarding-screen"
                figure="secretary"
                title={t("KissOpen Mobile didn't connect")}
            >
                <div className="kissopen-local-onboarding__mobile-actions">
                    <Button
                        loading={view.busy}
                        onClick={props.onKissopenMobileConnect}
                        size="large"
                        width={240}
                    >
                        {t("Try again")}
                    </Button>
                    <Button onClick={props.onKissopenMobileSkip} size="medium" variant="ghost">
                        {t("Skip")}
                    </Button>
                </div>
            </SetupPage>
        );

    if (view.kind === "profile-required")
        return (
            <SetupPage
                {...frame}
                action={{
                    busy: view.busy,
                    disabled: !view.name.trim() || !view.email.trim(),
                    label: t("Create profile"),
                    onSelect: props.onProfileCreate,
                    width: 240,
                }}
                copy={
                    view.message ??
                    t(
                        "KissOpen Agent uses this identity for your work and for messages shared with other KissOpen Agents.",
                    )
                }
                data-testid="local-onboarding-screen"
                scene="disguised-face"
                title={t("Create your profile")}
            >
                <div className="kissopen-local-onboarding__profile-form">
                    <TextField
                        autoFocus
                        fullWidth
                        label={t("Name")}
                        onSubmit={props.onProfileCreate}
                        onValueChange={props.onProfileNameChange}
                        placeholder={t("Your name")}
                        required
                        value={view.name}
                    />
                    <TextField
                        fullWidth
                        label={t("Git email")}
                        onSubmit={props.onProfileCreate}
                        onValueChange={props.onProfileEmailChange}
                        placeholder="you@example.com"
                        required
                        type="email"
                        value={view.email}
                    />
                </div>
            </SetupPage>
        );

    if (view.kind === "connect-failed")
        return (
            <SetupPage
                {...frame}
                action={{
                    busy: view.retrying,
                    label: t("Try again"),
                    onSelect: props.onConnectRetry,
                }}
                command={DAEMON_START_COMMAND}
                // Whatever actually refused, verbatim. This screen used to say
                // nothing at all above a bare retry, which left a daemon failing
                // for a nameable reason looking like a button that did nothing.
                copy={view.message}
                data-testid="local-onboarding-screen"
                figure="secretary"
                title={t("KissOpen could not reach KissOpen Agent")}
            />
        );

    if (view.kind === "project")
        return (
            <SetupPage
                {...frame}
                action={{
                    disabled: view.busy,
                    label: view.busy ? "Opening…" : "Choose a folder…",
                    onSelect: props.onProjectChoose,
                    width: 240,
                }}
                copy={
                    view.message ??
                    t(
                        "Point KissOpen at a folder you work in. It becomes your first project, and you can add more later.",
                    )
                }
                data-testid="local-onboarding-screen"
                scene="wand"
                title={t("Open your first project")}
            >
                {props.onProjectSetupBack ? (
                    <Button disabled={view.busy} onClick={props.onProjectSetupBack} variant="ghost">
                        {t("Back to setup options")}
                    </Button>
                ) : null}
            </SetupPage>
        );

    return null;
}

function onboardingStage(view: LocalOnboardingView): OnboardingStage {
    switch (view.kind) {
        case "examining":
        case "provider-authentication":
            return "assistants";
        case "profile-required":
            return "profile";
        case "kissopen-mobile-desktop":
        case "kissopen-mobile-checking":
        case "kissopen-mobile-offer":
        case "kissopen-mobile-pairing":
        case "kissopen-mobile-failed":
        case "finishing":
        case "project":
            return "mobile";
        default:
            return "setup";
    }
}
