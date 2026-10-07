import { SetupChoice } from "../../src/SetupChoice";
import { DesktopMobileSetup, type DesktopMobileSetupStep } from "../../src/DesktopMobileSetup";
import { LocalOnboardingScreen, type LocalOnboardingView } from "../../src/LocalOnboardingScreen";
import { SetupHandoff, SetupPage } from "../../src/SetupPage";
import { ThemeScope } from "../../src/ThemeScope";
import { ComponentPage, DimensionRule, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-252";

const noop = () => undefined;

const desktopSteps: readonly { label: string; view: LocalOnboardingView }[] = [
    { label: "Progress · setup", view: { kind: "agent-setup", phase: { kind: "preparing" } } },
    { label: "Progress · assistants", view: { kind: "examining" } },
    {
        label: "Progress · profile",
        view: { kind: "profile-required", name: "", email: "", busy: false },
    },
    {
        label: "Progress · retry",
        view: {
            kind: "connect-failed",
            message: "KISSOPEN Agent could not connect. Try again.",
            retrying: false,
        },
    },
];

const firstProjectSteps: readonly { label: string; view: LocalOnboardingView }[] = [
    {
        label: "First project · opening the conversation",
        view: { kind: "finishing", busy: true },
    },
    {
        label: "First project · setup retry",
        view: {
            kind: "finishing",
            busy: false,
            message: "The conversation could not be opened. Try again.",
        },
    },
    { label: "First project · manual folder", view: { kind: "project", busy: false } },
    {
        label: "First project · manual retry",
        view: {
            kind: "project",
            busy: false,
            message:
                "That folder is not in a Git repository. Choose a folder with a Git repository in it, or run git init there first.",
        },
    },
];

const mobileSteps: readonly { label: string; step: DesktopMobileSetupStep }[] = [
    { label: "Mobile · opt-in", step: { kind: "intro" } },
    { label: "Mobile · existing connection", step: { kind: "intro", alreadyLinked: true } },
    {
        label: "Mobile · get app and install CLI",
        step: { kind: "get-app", platform: "ios", preparation: "preparing" },
    },
    {
        label: "Mobile · app ready",
        step: { kind: "get-app", platform: "ios", preparation: "ready" },
    },
    {
        label: "Mobile · Android",
        step: { kind: "get-app", platform: "android", preparation: "ready" },
    },
    {
        label: "Mobile · CLI installation error",
        step: {
            kind: "get-app",
            platform: "ios",
            preparation: "failed",
            message:
                "KISSOPEN could not update the terminal CLI. Check your npm installation and permissions, then try again.",
        },
    },
    {
        label: "Mobile · checking saved connection",
        step: { kind: "link", appReady: true, phase: { kind: "checking" } },
    },
    {
        label: "Mobile · initial connection check",
        step: { kind: "link", appReady: false, phase: { kind: "checking" } },
    },
    {
        label: "Mobile · already paired",
        step: { kind: "link", appReady: true, phase: { kind: "preparing" } },
    },
    {
        label: "Mobile · device QR",
        step: {
            kind: "link",
            appReady: true,
            phase: {
                kind: "pairing",
                data: "kissopen://terminal?AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                expiresAt: 1924992000000,
            },
        },
    },
    {
        label: "Mobile · finishing inline",
        step: { kind: "link", appReady: true, phase: { kind: "finishing" } },
    },
    {
        label: "Mobile · link retry",
        step: {
            kind: "link",
            appReady: true,
            phase: {
                kind: "failed",
                message:
                    "KISSOPEN CLI is linked but spawn and resume are not online yet. Retry when your connection is available.",
            },
        },
    },
    { label: "Mobile · connected", step: { kind: "connected", online: true } },
    { label: "Mobile · linked and offline", step: { kind: "connected", online: false } },
];

/** Setup fills the window, so every specimen gets a window-shaped frame. */
const frame = {
    border: "1px solid var(--border)",
    borderRadius: "10px",
    height: "460px",
    overflow: "hidden",
    position: "relative" as const,
    width: "100%",
};

export function SetupPagePage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="One step of setup as one centred page: a picture of what is happening, a sentence naming it, a line explaining it, and at most one thing to do. Every first-run state is this component with different fields filled in."
            title="Setup page"
        >
            <Specimen
                detail="Waiting on the machine · scene, title, copy, no action"
                label="Waiting"
                number="01"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            copy="Reading what this machine already has."
                            scene="snail"
                            title="Checking this machine…"
                        />
                    </div>
                    <DimensionRule label="560 body · 40 padding · 120 stage · 24 gap" />
                </div>
            </Specimen>

            <Specimen
                detail="A failure that can be named: the error verbatim, the command to run, one retry"
                label="Failed"
                number="02"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{ label: "Try again", onSelect: noop }}
                            command="kissopen-agent start"
                            copy="connect ENOENT /Users/you/.kissopen/agent/server.sock"
                            figure="secretary"
                            figureMotion="still"
                            title="KISSOPEN could not reach KISSOPEN Agent"
                        />
                    </div>
                    <DimensionRule label="Command is selectable · monospace on surface-high" />
                </div>
            </Specimen>

            <Specimen
                detail="A body of its own replaces the scene: the fork is already a picture"
                label="With a body"
                number="03"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage title="How should KISSOPEN run?">
                            <SetupChoice
                                onSelect={noop}
                                options={[
                                    {
                                        actionLabel: "Stay in the app",
                                        description:
                                            "Everything happens in this window. Nothing is added to your machine.",
                                        id: "app",
                                        scene: "sparkles",
                                        title: "Just the app",
                                    },
                                    {
                                        actionLabel: "Install the CLI",
                                        actionVariant: "primary",
                                        description:
                                            "KISSOPEN Agent is a coding agent you run from a terminal, always in sync with this app.",
                                        id: "kissopen-agent",
                                        scene: "robot",
                                        title: "Install CLI tools",
                                    },
                                ]}
                            />
                        </SetupPage>
                    </div>
                    <DimensionRule label="Slot is full width inside the body measure" />
                </div>
            </Specimen>

            <Specimen
                detail="A step, not a fault: no error, no command, and the wait sits on the button"
                label="Waiting on you"
                number="04"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{ busy: true, label: "Check again", onSelect: noop }}
                            copy="KISSOPEN Agent runs the coding assistants you have already signed in to, and none are signed in yet. Sign in to Codex, Claude Code or Grok in a terminal, and KISSOPEN picks it up from there."
                            figure="secretary"
                            figureMotion="still"
                            title="No coding assistant yet"
                        />
                    </div>
                    <DimensionRule label="Busy action spins in place · the page does not change" />
                </div>
            </Specimen>

            <Specimen
                detail="Title alone, when there is nothing truthful to add under it"
                label="Bare"
                number="05"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{ label: "Choose a folder…", onSelect: noop }}
                            scene="wand"
                            title="Open your first project"
                        />
                    </div>
                    <DimensionRule label="Missing fields collapse; the column stays centred" />
                </div>
            </Specimen>

            <Specimen
                detail="Managed first install · one verified download action, with no terminal prerequisite"
                label="Download KISSOPEN Agent"
                number="06"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{ label: "Download and start", onSelect: noop }}
                            copy="KISSOPEN downloads the published release for this Mac, verifies its checksum, and keeps each version isolated before starting it."
                            figure="secretary"
                            figureMotion="still"
                            title="Download KISSOPEN Agent"
                        />
                    </div>
                    <DimensionRule label="One native action · 36px button, sized to its label" />
                </div>
            </Specimen>

            <Specimen
                detail="Bytes arriving · the bar stands where the button stood, at the same height"
                label="Measured progress"
                number="07"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{
                                busy: true,
                                label: "Downloading…",
                                onSelect: noop,
                                progress: {
                                    detail: "12.4 MB of 38.2 MB",
                                    fraction: 0.32,
                                    kind: "measured",
                                },
                            }}
                            copy="Downloading KISSOPEN Agent 0.0.11…"
                            figure="secretary"
                            figureMotion="still"
                            title="Download KISSOPEN Agent"
                        />
                    </div>
                    <DimensionRule label="280 track · 4 tall · width eased over the reported count" />
                </div>
            </Specimen>

            <Specimen
                detail="Running with nothing measured yet · a sweep, because a bar at zero reads as stuck"
                label="Unmeasured progress"
                number="08"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <SetupPage
                            action={{
                                busy: true,
                                label: "Downloading…",
                                onSelect: noop,
                                progress: { kind: "waiting" },
                            }}
                            copy="Checking what arrived and unpacking it."
                            figure="secretary"
                            figureMotion="still"
                            title="Download KISSOPEN Agent"
                        />
                    </div>
                    <DimensionRule label="Same box · no fraction claimed, no position asserted" />
                </div>
            </Specimen>

            <Specimen
                detail="First-run setup · one shared sky, white content, appearance-paired paintings"
                label="Onboarding sky"
                number="09"
                stage="surface"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={frame}>
                        <ThemeScope mode="light">
                            <SetupPage
                                action={{ label: "Continue", onSelect: noop }}
                                backdrop={{ appearance: "light", kind: "sky" }}
                                copy="KISSOPEN Agent is running and ready for the next step."
                                scene="sparkles"
                                title="KISSOPEN Agent is ready"
                                transitionKey="ready"
                            />
                        </ThemeScope>
                    </div>
                    <div style={frame}>
                        <ThemeScope mode="dark">
                            <SetupPage
                                action={{ label: "Continue", onSelect: noop }}
                                backdrop={{ appearance: "dark", kind: "sky" }}
                                copy="KISSOPEN Agent is running and ready for the next step."
                                scene="sparkles"
                                title="KISSOPEN Agent is ready"
                                transitionKey="ready"
                            />
                        </ThemeScope>
                    </div>
                    <DimensionRule label="Same crop and contrast treatment as Welcome · 320ms stage dissolve" />
                </div>
            </Specimen>

            <Specimen
                detail="second onboarding screen · automatic verified download · no action required and no machine progress on the welcome deck"
                label="Preparing the first agent"
                number="10"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                kind: "agent-setup",
                                phase: {
                                    download: {
                                        receivedBytes: 12.4 * 1024 * 1024,
                                        totalBytes: 38.2 * 1024 * 1024,
                                    },
                                    kind: "downloading",
                                },
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="subscription search begins with all three vendor columns already mounted and a reserved empty action slot"
                label="Subscription discovery"
                number="11"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{ kind: "examining" }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="same retained vendor columns · daemon checks update their labels in place without moving the owl, title, copy, or action slot"
                label="Authentication checking"
                number="12"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                assistants: [
                                    {
                                        authentication: "checking",
                                        command: "/opt/homebrew/bin/claude",
                                        id: "claude",
                                        status: "found",
                                    },
                                    {
                                        authentication: "checking",
                                        command: "/opt/homebrew/bin/codex",
                                        id: "codex",
                                        status: "found",
                                    },
                                    {
                                        authentication: "unavailable",
                                        id: "grok",
                                        status: "missing",
                                    },
                                ],
                                complete: false,
                                kind: "provider-authentication",
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="authentication-level daemon results only · no quota inference · Continue appears after every check settles"
                label="Authentication verified"
                number="13"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                assistants: [
                                    {
                                        authentication: "valid",
                                        command: "/opt/homebrew/bin/claude",
                                        id: "claude",
                                        status: "found",
                                    },
                                    {
                                        authentication: "invalid",
                                        command: "/opt/homebrew/bin/codex",
                                        id: "codex",
                                        status: "found",
                                    },
                                    {
                                        authentication: "unavailable",
                                        id: "grok",
                                        status: "missing",
                                    },
                                ],
                                complete: true,
                                kind: "provider-authentication",
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="no valid local sign-in · Continue stays absent · Skip becomes the sole primary action"
                label="Authentication unavailable"
                number="14"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                assistants: [
                                    {
                                        authentication: "invalid",
                                        command: "/opt/homebrew/bin/claude",
                                        id: "claude",
                                        status: "found",
                                    },
                                    {
                                        authentication: "invalid",
                                        command: "/opt/homebrew/bin/codex",
                                        id: "codex",
                                        status: "found",
                                    },
                                    {
                                        authentication: "invalid",
                                        command: "/opt/homebrew/bin/grok",
                                        id: "grok",
                                        status: "found",
                                    },
                                ],
                                complete: true,
                                kind: "provider-authentication",
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="optional final onboarding decision · one clear connection action and a permanent Skip"
                label="KISSOPEN Mobile offer"
                number="15"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{ busy: false, kind: "kissopen-mobile-offer" }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="daemon-supplied opaque data only · crisp QR · realtime approval wait · no manual refresh"
                label="KISSOPEN Mobile pairing"
                number="16"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                data: "kissopen://terminal?eyJ2IjoxLCJwYWlyaW5nSWQiOiJibHVlcHJpbnQtcGFpcmluZyIsIm5vbmNlIjoiaGFwcHktbW9iaWxlIn0",
                                expiresAt: 1_900_000_000_000,
                                kind: "kissopen-mobile-pairing",
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>

            <Specimen
                detail="pairing failure remains optional · retry is local to this step · Skip is still available"
                label="KISSOPEN Mobile failure"
                number="17"
                stage="surface"
            >
                <div style={frame}>
                    <ThemeScope mode="dark">
                        <LocalOnboardingScreen
                            appearance="dark"
                            onAssistantsContinue={noop}
                            onConnectRetry={noop}
                            onKissopenMobileConnect={noop}
                            onKissopenMobileSkip={noop}
                            onProfileCreate={noop}
                            onProfileEmailChange={noop}
                            onProfileNameChange={noop}
                            onProjectChoose={noop}
                            view={{
                                busy: false,
                                kind: "kissopen-mobile-failed",
                                message:
                                    "The pairing code expired before KISSOPEN Mobile approved it.",
                            }}
                        />
                    </ThemeScope>
                </div>
            </Specimen>
            {desktopSteps.map(({ label, view }, index) => (
                <Specimen
                    key={label}
                    detail="Stable overall stages · completed and remaining counts · current step is not a loading animation"
                    label={label}
                    number={String(index + 18)}
                    stage="surface"
                >
                    <div style={{ ...frame, height: "800px" }} data-progress-specimen={label}>
                        <ThemeScope mode="dark">
                            <LocalOnboardingScreen
                                appearance="dark"
                                showSteps
                                view={view}
                                onAssistantsContinue={noop}
                                onConnectRetry={noop}
                                onKissopenMobileConnect={noop}
                                onKissopenMobileSkip={noop}
                                onProfileCreate={noop}
                                onProfileEmailChange={noop}
                                onProfileNameChange={noop}
                                onProjectChoose={noop}
                            />
                        </ThemeScope>
                    </div>
                </Specimen>
            ))}
            {mobileSteps.map(({ label, step }, index) => (
                <Specimen
                    key={label}
                    detail="Optional mobile setup · bundled animated sticker · no runtime or account required"
                    label={label}
                    number={String(index + 18 + desktopSteps.length)}
                    stage="surface"
                >
                    <div style={{ ...frame, height: "800px" }} data-mobile-specimen={label}>
                        <ThemeScope mode="dark">
                            <DesktopMobileSetup
                                appearance="dark"
                                onboarding
                                step={step}
                                onContinue={noop}
                                onSkip={noop}
                                onPlatformSelect={noop}
                            />
                        </ThemeScope>
                    </div>
                </Specimen>
            ))}
            {firstProjectSteps.map(({ label, view }, index) => (
                <Specimen
                    key={label}
                    detail="Automatic handoff to an unsent editable secretary draft · manual projects use the sidebar + button"
                    label={label}
                    number={String(index + 18 + desktopSteps.length + mobileSteps.length)}
                    stage="surface"
                >
                    <div style={{ ...frame, height: "800px" }} data-first-project-specimen={label}>
                        <ThemeScope mode="dark">
                            {view.kind === "finishing" ? (
                                <SetupHandoff error={view.message} busy={view.busy} onRetry={noop}>
                                    <SetupPage
                                        title="Workspace stays open"
                                        copy="The conversation and sidebar remain usable while the draft is prepared."
                                    />
                                </SetupHandoff>
                            ) : (
                                <LocalOnboardingScreen
                                    appearance="dark"
                                    onAssistantsContinue={noop}
                                    onConnectRetry={noop}
                                    onKissopenMobileConnect={noop}
                                    onKissopenMobileSkip={noop}
                                    onProfileCreate={noop}
                                    onProfileEmailChange={noop}
                                    onProfileNameChange={noop}
                                    onProjectChoose={noop}
                                    onProjectSetupBack={noop}
                                    view={view}
                                />
                            )}
                        </ThemeScope>
                    </div>
                </Specimen>
            ))}
        </ComponentPage>
    );
}
