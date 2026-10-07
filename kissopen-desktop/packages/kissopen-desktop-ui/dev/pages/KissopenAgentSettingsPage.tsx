import type { KissopenAgentProviderUsageEntry } from "kissopen-desktop-state";
import {
    DesktopMobileSetup,
    KissopenAgentAccountSettings,
    KissopenAgentDebugLogPanel,
    KissopenAgentDebugSettings,
    KissopenAgentGeneralSettings,
    KissopenAgentInstructionsSettings,
    KissopenAgentMobileSettings,
    KissopenAgentProviderSettings,
    KissopenAgentProfilerSettings,
    KissopenAgentProfileSettings,
    KissopenAgentSecretSettings,
    KissopenAgentSettingsShell,
    KissopenAgentUsageSettings,
    type KissopenAgentProviderRow,
    type KissopenAgentSecretRow,
    type KissopenAgentSettingsCategory,
} from "../../src";
import { ComponentPage, FullScreenSpecimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "P-012";

const categories: readonly KissopenAgentSettingsCategory[] = [
    { icon: "settings", id: "general", label: "General" },
    { icon: "users", id: "account", label: "Account" },
    { icon: "doc", id: "instructions", label: "Instructions" },
    { icon: "lock", id: "secrets", label: "Secrets" },
    { icon: "globe", id: "providers", label: "Providers" },
    { icon: "zap", id: "usage", label: "Usage" },
    { icon: "mobile", id: "mobile-access", label: "Mobile Access" },
    { icon: "code", id: "debug", label: "Dev Tools" },
];

const usageDescription = "How much of each provider account's plan this machine has spent";

const accountDescription = "Local author identity and KISSOPEN account connection";

const mobileDescription = "This KISSOPEN Agent's connection to KISSOPEN Mobile";

const usageAccounts: readonly KissopenAgentProviderUsageEntry[] = [
    {
        providerId: "claude",
        checkedAt: 1_700_000_000_000,
        usage: {
            capturedAt: 1_700_000_000_000,
            planName: "Max 20×",
            exhausted: false,
            fiveHour: { usedPercent: 42, resetsAt: 1_700_007_200_000 },
            weekly: { usedPercent: 81, resetsAt: 1_700_400_000_000 },
            monthly: { usedPercent: 34, resetsAt: 1_702_000_000_000 },
            models: [
                {
                    modelId: "anthropic/opus-5",
                    hour: {
                        inputTokens: 18_400,
                        outputTokens: 6_200,
                        cacheReadTokens: 412_000,
                        cacheWriteTokens: 24_000,
                    },
                    day: {
                        inputTokens: 214_000,
                        outputTokens: 71_500,
                        cacheReadTokens: 5_120_000,
                        cacheWriteTokens: 268_000,
                    },
                    week: {
                        inputTokens: 1_420_000,
                        outputTokens: 486_000,
                        cacheReadTokens: 33_800_000,
                        cacheWriteTokens: 1_740_000,
                    },
                    month: {
                        inputTokens: 5_180_000,
                        outputTokens: 1_760_000,
                        cacheReadTokens: 121_400_000,
                        cacheWriteTokens: 6_320_000,
                    },
                },
                {
                    modelId: "anthropic/sonnet-5",
                    day: {
                        inputTokens: 9_800,
                        outputTokens: 3_100,
                        cacheReadTokens: 142_000,
                        cacheWriteTokens: 7_400,
                    },
                    week: {
                        inputTokens: 86_000,
                        outputTokens: 29_400,
                        cacheReadTokens: 1_180_000,
                        cacheWriteTokens: 62_000,
                    },
                    month: {
                        inputTokens: 402_000,
                        outputTokens: 138_000,
                        cacheReadTokens: 5_640_000,
                        cacheWriteTokens: 291_000,
                    },
                },
            ],
        },
    },
    {
        providerId: "work_codex",
        checkedAt: 1_700_000_000_000,
        usage: {
            capturedAt: 1_699_999_400_000,
            planName: "Pro",
            exhausted: true,
            fiveHour: { usedPercent: 100, resetsAt: 1_700_003_000_000 },
            weekly: { usedPercent: 96 },
            credits: { available: true, unlimited: false, remainingCents: 1_450 },
            models: [
                {
                    modelId: "openai/gpt-5.6-sol",
                    month: {
                        inputTokens: 2_940_000,
                        outputTokens: 812_000,
                        cacheReadTokens: 44_100_000,
                        cacheWriteTokens: 0,
                    },
                    week: {
                        inputTokens: 740_000,
                        outputTokens: 203_000,
                        cacheReadTokens: 11_200_000,
                        cacheWriteTokens: 0,
                    },
                },
            ],
        },
    },
    {
        providerId: "grok",
        checkedAt: 1_700_000_000_000,
        error: "The Grok account could not be read: the assistant is signed out.",
    },
];

/**
 * What the daemon actually reports today: absolute token counts by model, with
 * no plan share behind them. Two of these accounts are the same vendor with
 * different credentials, so each account retains its own identity. Custom
 * connections use their configured display name without changing accounting.
 */
const usageTokensOnly: readonly KissopenAgentProviderUsageEntry[] = [
    {
        providerId: "kirill_claude",
        checkedAt: 1_700_000_000_000,
        usage: {
            capturedAt: 1_700_000_000_000,
            models: [
                {
                    modelId: "anthropic/opus-5",
                    hour: {
                        inputTokens: 12_300,
                        outputTokens: 4_100,
                        cacheReadTokens: 286_000,
                        cacheWriteTokens: 15_800,
                    },
                    day: {
                        inputTokens: 188_000,
                        outputTokens: 62_400,
                        cacheReadTokens: 4_310_000,
                        cacheWriteTokens: 221_000,
                    },
                    week: {
                        inputTokens: 1_090_000,
                        outputTokens: 361_000,
                        cacheReadTokens: 26_700_000,
                        cacheWriteTokens: 1_380_000,
                    },
                    month: {
                        inputTokens: 4_260_000,
                        outputTokens: 1_410_000,
                        cacheReadTokens: 98_200_000,
                        cacheWriteTokens: 5_070_000,
                    },
                },
                {
                    modelId: "anthropic/fable-5",
                    week: {
                        inputTokens: 42_000,
                        outputTokens: 14_300,
                        cacheReadTokens: 611_000,
                        cacheWriteTokens: 31_200,
                    },
                    month: {
                        inputTokens: 151_000,
                        outputTokens: 52_800,
                        cacheReadTokens: 2_240_000,
                        cacheWriteTokens: 114_000,
                    },
                },
            ],
        },
    },
    {
        providerId: "bulka_codex",
        checkedAt: 1_700_000_000_000,
        usage: {
            capturedAt: 1_700_000_000_000,
            models: [
                {
                    modelId: "openai/gpt-5.6-sol",
                    day: {
                        inputTokens: 61_000,
                        outputTokens: 22_800,
                        cacheReadTokens: 1_940_000,
                        cacheWriteTokens: 88_000,
                    },
                    week: {
                        inputTokens: 604_000,
                        outputTokens: 214_000,
                        cacheReadTokens: 18_300_000,
                        cacheWriteTokens: 903_000,
                    },
                    month: {
                        inputTokens: 2_310_000,
                        outputTokens: 806_000,
                        cacheReadTokens: 71_500_000,
                        cacheWriteTokens: 3_420_000,
                    },
                },
            ],
        },
    },
    {
        providerId: "bulka_kissopen_codex",
        checkedAt: 1_700_000_000_000,
        usage: { capturedAt: 1_700_000_000_000, models: [] },
    },
    {
        providerId: "custom-e0284f916a6a2b2338ac9f46",
        name: "My model service",
        usage: {
            capturedAt: 1_700_000_000_000,
            models: [{ modelId: "custom-e0284f916a6a2b2338ac9f46/example-fast" }],
        },
    },
];

/** A configured account the daemon has not reached yet: neither read nor failed. */
const usageUnread: readonly KissopenAgentProviderUsageEntry[] = [
    {
        providerId: "claude",
        checkedAt: 1_700_000_000_000,
        usage: {
            capturedAt: 1_700_000_000_000,
            planName: "Pro",
            exhausted: false,
            fiveHour: { usedPercent: 8, resetsAt: 1_700_012_000_000 },
        },
    },
    { providerId: "work_codex" },
];

const usageReadingTime = (capturedAt: number) =>
    capturedAt >= 1_700_000_000_000 ? "just now" : "10 minutes ago";

const instructions = `# House rules

Ask before touching anything outside the working directory.

- Small commits, present tense, no ceremony.
- \`pnpm typecheck\` before you say a thing is done.
- Never force-push \`main\`.
`;

const modelOptions = [
    { label: "Codex · GPT-5.6 Sol", value: "codex:openai/gpt-5.6-sol" },
    { label: "Codex · GPT-5.6 Terra", value: "codex:openai/gpt-5.6-terra" },
    { label: "Claude · Opus 5 1M", value: "claude:anthropic/opus-5" },
    { label: "Claude · Sonnet 5", value: "claude:anthropic/sonnet-5" },
];

const effortOptions = [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
];

const permissionModeOptions = [
    { label: "Auto", value: "auto" },
    { label: "Workspace write", value: "workspace_write" },
    { label: "Read only", value: "read_only" },
    { label: "Full access", value: "full_access" },
];

const providers: readonly KissopenAgentProviderRow[] = [
    {
        enabled: true,
        id: "codex",
        models: [
            {
                contextWindow: 400_000,
                efforts: ["Low", "Medium", "High"],
                enabled: true,
                id: "codex:openai/gpt-5.6-sol",
                isDefault: true,
                modelId: "openai/gpt-5.6-sol",
                name: "GPT-5.6 Sol",
            },
            {
                contextWindow: 400_000,
                efforts: ["Medium", "High", "Max"],
                enabled: true,
                id: "codex:openai/gpt-5.6-terra",
                isDefault: false,
                modelId: "openai/gpt-5.6-terra",
                name: "GPT-5.6 Terra",
            },
            {
                efforts: ["Medium", "High"],
                enabled: false,
                id: "codex:openai/gpt-5.6-luna",
                isDefault: false,
                modelId: "openai/gpt-5.6-luna",
                name: "GPT-5.6 Luna",
            },
        ],
        name: "Codex",
        serviceTiers: ["Fast"],
        status: "ready",
    },
    {
        enabled: true,
        id: "claude",
        models: [
            {
                contextWindow: 1_000_000,
                efforts: ["Low", "Medium", "High", "Ultra"],
                enabled: true,
                id: "claude:anthropic/opus-5",
                isDefault: false,
                modelId: "anthropic/opus-5",
                name: "Opus 5 1M",
            },
            {
                contextWindow: 200_000,
                efforts: ["Low", "Medium", "High"],
                enabled: true,
                id: "claude:anthropic/sonnet-5",
                isDefault: false,
                modelId: "anthropic/sonnet-5",
                name: "Sonnet 5",
            },
        ],
        name: "Claude",
        serviceTiers: [],
        status: "ready",
    },
    {
        enabled: true,
        id: "bedrock",
        models: [
            {
                contextWindow: 200_000,
                efforts: ["Medium", "High"],
                enabled: true,
                id: "bedrock:anthropic/sonnet-5",
                isDefault: false,
                modelId: "anthropic/sonnet-5",
                name: "Sonnet 5",
            },
        ],
        name: "Bedrock",
        saving: true,
        serviceTiers: [],
        status: "not_authenticated",
    },
    {
        enabled: false,
        id: "vertex",
        models: [],
        name: "Vertex",
        serviceTiers: [],
        status: "not_enabled",
    },
];

const secrets: readonly KissopenAgentSecretRow[] = [
    {
        availableToAgents: true,
        description: "Production deploy credentials",
        environmentVariables: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
        id: "secret-production",
        managed: false,
        updatedAt: "29 Aug 2026, 01:42",
    },
    {
        availableToAgents: false,
        description: "Linear integration",
        environmentVariables: ["LINEAR_API_KEY"],
        id: "secret-linear",
        managed: true,
        updatedAt: "27 Aug 2026, 18:10",
    },
];

const noop = () => undefined;

export function KissopenAgentSettingsBlueprintPage() {
    return (
        <ComponentPage
            contract="Props only"
            number={componentNumber}
            summary="The local workspace's settings window: a permanent category column whose heading is the way back out, and one category body beside it. Server-backed state is prop-driven, while transient write-only form values stay inside shared UI."
            title="Kissopen Agent settings"
        >
            {([false, true] as const).map((fullScreen) => (
                <FullScreenSpecimen
                    key={String(fullScreen)}
                    detail={
                        fullScreen
                            ? "Full screen removes the native control reservation"
                            : "The back control sits below the 40px macOS traffic-light lane"
                    }
                    label={
                        fullScreen ? "macOS settings — full screen" : "macOS settings — windowed"
                    }
                    number={fullScreen ? "00b" : "00a"}
                >
                    <KissopenAgentSettingsShell
                        activeCategoryId="general"
                        categories={categories}
                        onCategorySelect={noop}
                        onClose={noop}
                        title="General"
                        windowControls
                        windowFullScreen={fullScreen}
                    >
                        <p>The window controls and navigation have separate space.</p>
                    </KissopenAgentSettingsShell>
                </FullScreenSpecimen>
            ))}
            <FullScreenSpecimen
                detail="Local Git author identity and a connected WorkOS account"
                label="Kissopen Agent settings — account"
                number="01a"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="account"
                    categories={categories}
                    description={accountDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Account"
                >
                    <KissopenAgentProfileSettings
                        email="alex@example.com"
                        name="Steve Korshakov"
                        onEmailChange={noop}
                        onNameChange={noop}
                        onRevert={noop}
                        onSave={noop}
                    />
                    <KissopenAgentAccountSettings
                        email="steve@example.com"
                        onConnect={noop}
                        onDisconnect={noop}
                        status="connected"
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="General category: appearance and the defaults a new local session starts with"
                label="Kissopen Agent settings — general"
                number="01"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="general"
                    categories={categories}
                    description="How this window looks and what a new session starts with"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="General"
                >
                    <KissopenAgentGeneralSettings
                        application={{
                            availableVersion: "0.2.0-preview.11",
                            updateStatus: "downloaded",
                            version: "0.2.0-preview.10",
                        }}
                        onApplicationInstall={() => {}}
                        // The ordinary resting state of a machine with an update:
                        // the check found it and fetched it without asking, so
                        // the version is already on disk and the only thing left
                        // is the interruption nobody has agreed to yet.
                        agent={{
                            availableVersion: "0.3.1",
                            installedVersion: "0.3.0",
                            managed: true,
                            message: "Kissopen Agent 0.3.1 is ready to install.",
                            operation: "idle",
                            readyVersion: "0.3.1",
                            runningVersion: "0.3.0",
                            runtime: "ready",
                            updateAvailable: true,
                            versions: [
                                { downloaded: true, prerelease: false, version: "0.3.1" },
                                { downloaded: false, prerelease: true, version: "0.3.1-rc.2" },
                                { downloaded: true, prerelease: false, version: "0.3.0" },
                                { downloaded: true, prerelease: false, version: "0.2.9" },
                            ],
                        }}
                        appearance="system"
                        defaultModelKey="codex:openai/gpt-5.6-sol"
                        effort="medium"
                        effortOptions={effortOptions}
                        modelOptions={modelOptions}
                        onAppearanceChange={noop}
                        onAgentCheck={noop}
                        onAgentRestart={noop}
                        onAgentUpgrade={noop}
                        onAgentVersionSelect={noop}
                        onDefaultModelChange={noop}
                        onEffortChange={noop}
                        onPermissionModeChange={noop}
                        onScrollbarVisibilityChange={noop}
                        onTitleShimmerChange={noop}
                        permissionMode="auto"
                        permissionModeOptions={permissionModeOptions}
                        scrollbarVisibility="automatic"
                        titleShimmerEnabled={false}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Mobile Access category: configured and connected, with the installation-wide unlink action"
                label="Kissopen Agent settings — Mobile Access"
                number="01e"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="mobile-access"
                    categories={categories}
                    description={mobileDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Mobile Access"
                >
                    <KissopenAgentMobileSettings
                        configured
                        onDisconnect={noop}
                        onSetup={noop}
                        onPair={noop}
                        onPairingCancel={noop}
                        status="connected"
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Remote Agent-only pairing remains unchanged; local Desktop opens the shared mobile setup instead."
                label="Kissopen Agent settings — Remote Mobile Access pairing"
                number="01f"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="mobile-access"
                    categories={categories}
                    description={mobileDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Mobile Access"
                >
                    <KissopenAgentMobileSettings
                        configured={false}
                        onDisconnect={noop}
                        onPair={noop}
                        onPairingCancel={noop}
                        pairingData="kissopen://pair?authorization=blueprint-kissopen-mobile"
                        pairingExpiresAt={1_700_003_600_000}
                        status="pairing"
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            {([false, undefined] as const).map((configured) => (
                <FullScreenSpecimen
                    key={String(configured)}
                    detail="One local setup entry opens the same consent and linking flow as first-run. Unknown configuration is not shown as unlinked."
                    label={`KISSOPEN Mobile — local ${configured === false ? "unlinked" : "unknown"}`}
                    number={`01f-${String(configured)}`}
                >
                    <KissopenAgentSettingsShell
                        activeCategoryId="mobile-access"
                        categories={categories}
                        description={mobileDescription}
                        onCategorySelect={noop}
                        onClose={noop}
                        title="Mobile Access"
                    >
                        <KissopenAgentMobileSettings
                            configured={configured}
                            onDisconnect={noop}
                            onSetup={noop}
                            onPair={noop}
                            onPairingCancel={noop}
                            status={configured === false ? "disconnected" : "loading"}
                        />
                    </KissopenAgentSettingsShell>
                </FullScreenSpecimen>
            ))}
            <FullScreenSpecimen
                detail="Settings opens the exact first-run component and store. Not now or completion Continue returns to Mobile Access status."
                label="Kissopen Mobile — shared local setup"
                number="01f-setup"
            >
                <DesktopMobileSetup
                    appearance="light"
                    step={{ kind: "intro", alreadyLinked: true }}
                    onContinue={noop}
                    onSkip={noop}
                    onPlatformSelect={noop}
                />
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="A failed native status read stays unknown and shows its reason, even after the CLI is ready."
                label="Kissopen Mobile — native status unavailable"
                number="01f-read-failed"
            >
                <DesktopMobileSetup
                    appearance="light"
                    step={{
                        kind: "link",
                        appReady: true,
                        phase: {
                            kind: "failed",
                            message:
                                "Kissopen cannot reach the local Kissopen Agent. Reconnect and try again.",
                        },
                    }}
                    onContinue={noop}
                    onSkip={noop}
                    onPlatformSelect={noop}
                />
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Live debugger controls and a bounded raw renderer profile with React attribution"
                label="Kissopen Agent settings — Dev Tools"
                number="01g"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="debug"
                    categories={categories}
                    description="Inspect live runtimes or capture raw renderer performance evidence"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Dev Tools"
                >
                    <KissopenAgentDebugLogPanel
                        discardedEntries={7}
                        entries={[
                            {
                                detail: JSON.stringify(
                                    {
                                        previous: "reconnecting",
                                        next: "live",
                                    },
                                    null,
                                    2,
                                ),
                                id: 1,
                                level: "info",
                                message: "Connection state changed: reconnecting → live",
                                occurredAt: 1_700_000_000_000,
                                source: "connection",
                            },
                            {
                                detail: JSON.stringify(
                                    {
                                        cursor: "01HF7YAT00SQJZ6QH1Z2WQY7Q2",
                                        type: "message.delta",
                                        payload: {
                                            agentId: "agent_01HF7Y9P3M",
                                            delta: "Inspecting the workspace now.",
                                        },
                                    },
                                    null,
                                    2,
                                ),
                                id: 2,
                                level: "info",
                                message: "SSE event arrived: message.delta",
                                occurredAt: 1_700_000_001_250,
                                source: "sse",
                            },
                            {
                                detail: "TypeError: fetch failed\n    at healthProbe (kissopenAgentConnection.ts:112:18)",
                                id: 3,
                                level: "warning",
                                message: "Health probe failed (attempt 1)",
                                occurredAt: 1_700_000_003_500,
                                source: "health",
                            },
                        ]}
                    />
                    <KissopenAgentDebugSettings
                        daemon={{
                            status: "running",
                            url: "ws://127.0.0.1:62701/kissopen-agent",
                        }}
                        daemonConnected
                        main={{
                            status: "running",
                            url: "ws://127.0.0.1:62702/main",
                        }}
                        onAllStart={noop}
                        onAllStop={noop}
                        onDaemonStart={noop}
                        onDaemonStop={noop}
                        onMainStart={noop}
                        onMainStop={noop}
                        onRendererStart={noop}
                        onRendererStop={noop}
                        renderer={{
                            status: "running",
                            url: "ws://127.0.0.1:62703/cdp/8a84291d",
                        }}
                        supported
                    />
                    <KissopenAgentProfilerSettings
                        artifactPath="~/Library/Application Support/Kissopen/desktop/profiler/session-preview.json"
                        capabilities={{
                            liveDebuggerAttach: true,
                            nativeTrace: true,
                            processMetrics: true,
                            reactAttribution: true,
                            reactDevtoolsProfiling: true,
                            rendererMetrics: true,
                        }}
                        onStart={noop}
                        onStop={noop}
                        status="stopped"
                        supported
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Instructions category: the machine's AGENTS.md and SECURITY.md as peer editable files"
                label="KISSOPEN Agent settings — instructions"
                number="02"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="instructions"
                    categories={categories}
                    description="Machine-wide agent guidance and permission-review policy"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Instructions"
                >
                    <KissopenAgentInstructionsSettings
                        documents={[
                            {
                                bytes: instructions.length,
                                description:
                                    "Given to every agent this machine starts, on top of the project's own AGENTS.md.",
                                id: "agents",
                                label: "AGENTS.md",
                                maximumBytes: 32 * 1024,
                                onRevert: noop,
                                onSave: noop,
                                onValueChange: noop,
                                path: "~/Kissopen/Config/AGENTS.md",
                                placeholder: "Anything every agent on this machine should know…",
                                value: instructions,
                            },
                            {
                                bytes: 0,
                                description:
                                    "Applied when this machine reviews whether an agent action is allowed.",
                                id: "security",
                                label: "SECURITY.md",
                                maximumBytes: 32 * 1024,
                                onRevert: noop,
                                onSave: noop,
                                onValueChange: noop,
                                path: "~/Kissopen/Config/SECURITY.md",
                                placeholder: "Rules for deciding which agent actions are allowed…",
                                value: "",
                            },
                        ]}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Edited in place: the fields differ from what is stored, and the last save was refused"
                label="Kissopen Agent settings — profile edited"
                number="02b"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="account"
                    categories={categories}
                    description={accountDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Account"
                >
                    <KissopenAgentProfileSettings
                        dirty
                        email="steve@"
                        name="Steve Korshakov"
                        onEmailChange={noop}
                        onNameChange={noop}
                        onRevert={noop}
                        onSave={noop}
                        saveError="Enter the email used for Git commits."
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Secrets category: safe metadata lists write-only environment bundles without exposing values"
                label="Kissopen Agent settings — secrets"
                number="02s"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="secrets"
                    categories={categories}
                    description="Write-only environment bundles this Kissopen Agent can provide to agents"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Secrets"
                >
                    <KissopenAgentSecretSettings
                        onSecretCreate={() => Promise.resolve()}
                        secrets={secrets}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Create flow: one write-only value row, explicit global availability, and the standard modal form placement"
                label="Kissopen Agent settings — create secret"
                number="02t"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="secrets"
                    categories={categories}
                    description="Write-only environment bundles this Kissopen Agent can provide to agents"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Secrets"
                >
                    <KissopenAgentSecretSettings
                        initialCreateOpen
                        onSecretCreate={() => Promise.resolve()}
                        secrets={secrets}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Providers category: connected, unauthenticated, disabled, and model-less providers together"
                label="Kissopen Agent settings — providers"
                number="03"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="providers"
                    categories={categories}
                    description="Every model provider this Kissopen Agent daemon knows about"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Providers"
                >
                    <KissopenAgentProviderSettings
                        onModelEnabledChange={noop}
                        onProviderEnabledChange={noop}
                        providers={providers}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="A refused provider change: the list still shows what the daemon holds, with the refusal above it"
                label="Kissopen Agent settings — providers refused"
                number="03a"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="providers"
                    categories={categories}
                    description="Every model provider this Kissopen Agent daemon knows about"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Providers"
                >
                    <KissopenAgentProviderSettings
                        onModelEnabledChange={noop}
                        onProviderEnabledChange={noop}
                        providers={providers}
                        saveError="This Kissopen Agent cannot change its providers while it is running."
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="The catalog has not arrived yet, so both the picker and the provider list say so"
                label="Kissopen Agent settings — loading"
                number="04"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="providers"
                    categories={categories}
                    description="Every model provider this Kissopen Agent daemon knows about"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Providers"
                >
                    <KissopenAgentProviderSettings
                        loading
                        onModelEnabledChange={noop}
                        onProviderEnabledChange={noop}
                        providers={[]}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="A failed catalog read is a loud alert rather than an empty provider list"
                label="Kissopen Agent settings — error"
                number="05"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="providers"
                    categories={categories}
                    description="Every model provider this Kissopen Agent daemon knows about"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Providers"
                >
                    <KissopenAgentProviderSettings
                        error="The Kissopen Agent daemon could not read its model catalog."
                        onModelEnabledChange={noop}
                        onProviderEnabledChange={noop}
                        providers={[]}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Known Kissopen Agent offline: appearance remains local, retained defaults stay visible, and daemon-backed changes wait for reconnect"
                label="Kissopen Agent settings — offline"
                number="06"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="general"
                    categories={categories}
                    description="How this window looks and what a new session starts with"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="General"
                >
                    <KissopenAgentGeneralSettings
                        appearance="system"
                        defaultModelKey="codex:openai/gpt-5.6-sol"
                        effort="medium"
                        effortOptions={effortOptions}
                        modelOptions={modelOptions}
                        onAppearanceChange={noop}
                        onDefaultModelChange={noop}
                        onEffortChange={noop}
                        onPermissionModeChange={noop}
                        onScrollbarVisibilityChange={noop}
                        onTitleShimmerChange={noop}
                        permissionMode="auto"
                        permissionModeOptions={permissionModeOptions}
                        scrollbarVisibility="automatic"
                        titleShimmerEnabled={false}
                        unavailable="Kissopen Agent is offline. Showing the last synced defaults."
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Known Kissopen Agent offline: instruction drafts remain editable and visible; Save waits for reconnect"
                label="Kissopen Agent settings — instructions offline"
                number="07"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="instructions"
                    categories={categories}
                    description="Machine-wide agent guidance and permission-review policy"
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Instructions"
                >
                    <KissopenAgentInstructionsSettings
                        documents={[
                            {
                                bytes: instructions.length,
                                description:
                                    "Given to every agent this machine starts, on top of the project's own AGENTS.md.",
                                dirty: true,
                                id: "agents",
                                label: "AGENTS.md",
                                maximumBytes: 32 * 1024,
                                onRevert: noop,
                                onSave: noop,
                                onValueChange: noop,
                                path: "~/Kissopen/Config/AGENTS.md",
                                placeholder: "Anything every agent on this machine should know…",
                                saveDisabled: true,
                                saveDisabledReason:
                                    "Kissopen Agent is offline. Draft preserved until reconnect.",
                                value: instructions,
                            },
                        ]}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Usage category: three accounts separated by a rule rather than boxed — one with room across three windows, one spent with credits behind it, one that could not be read"
                label="Kissopen Agent settings — usage"
                number="08"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings
                        currentTime={1_700_000_000_000}
                        kissopen={{
                            providerId: "kissopen",
                            checkedAt: 1_700_000_000_000,
                            usage: {
                                capturedAt: 1_700_000_000_000,
                                planName: "Plus",
                                fiveHour: {
                                    usedPercent: 1,
                                    resetsAt: 1_700_000_000_000 + 4 * 3_600_000,
                                },
                                weekly: {
                                    usedPercent: 96,
                                    resetsAt: 1_700_000_000_000 + 2 * 86_400_000,
                                },
                            },
                        }}
                        onViewPlans={() => {}}
                        providers={usageAccounts}
                        readingTime={usageReadingTime}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Token counts with no plan share behind them: what each model spent per rolling window, two accounts of the same vendor kept apart by their own names, and one that has spent nothing"
                label="Kissopen Agent settings — usage tokens only"
                number="08a"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings
                        currentTime={1_700_000_000_000}
                        providers={usageTokensOnly}
                        readingTime={usageReadingTime}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="Before the first reading arrives, so an empty account list is not claimed early"
                label="Kissopen Agent settings — usage loading"
                number="08b"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings loading providers={[]} />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="No assistant is signed in on this machine, so the category sends the reader where accounts are actually made"
                label="Kissopen Agent settings — usage empty"
                number="08c"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings providers={[]} />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="The reading failed; what was already read stays legible beneath the banner, and an account never read says so rather than reading as unspent"
                label="Kissopen Agent settings — usage error and unread"
                number="08d"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings
                        currentTime={1_700_000_000_000}
                        error={{
                            name: "UserError",
                            message: "The Kissopen Agent stopped reporting usage.",
                        }}
                        providers={usageUnread}
                        readingTime={usageReadingTime}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
            <FullScreenSpecimen
                detail="No third-party providers enabled: keep the KissOpen plan without an empty provider section"
                label="Usage — KissOpen only"
                number="08e"
            >
                <KissopenAgentSettingsShell
                    activeCategoryId="usage"
                    categories={categories}
                    description={usageDescription}
                    onCategorySelect={noop}
                    onClose={noop}
                    title="Usage"
                >
                    <KissopenAgentUsageSettings
                        kissopen={{
                            providerId: "kissopen",
                            usage: {
                                capturedAt: 1_700_000_000_000,
                                planName: "Plus",
                                weekly: { usedPercent: 18 },
                            },
                        }}
                        providers={[]}
                    />
                </KissopenAgentSettingsShell>
            </FullScreenSpecimen>
        </ComponentPage>
    );
}
