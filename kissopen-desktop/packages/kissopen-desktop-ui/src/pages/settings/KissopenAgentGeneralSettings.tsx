import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { Button } from "../../Button";
import { FormRow } from "../../FormRow";
import { SegmentedControl } from "../../SegmentedControl";
import { Select, type SelectOption } from "../../Select";
import { Spinner } from "../../Spinner";
import { Switch } from "../../Switch";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export type KissopenAgentAppearanceChoice = "system" | "light" | "dark";
export type KissopenAgentScrollbarVisibilityChoice = "always" | "automatic";

export type KissopenAgentGeneralSettingsProps = {
    appearance: KissopenAgentAppearanceChoice;
    scrollbarVisibility: KissopenAgentScrollbarVisibilityChoice;
    /** The default a new session starts on, keyed `${providerId}:${modelId}`. */
    defaultModelKey?: string;
    /** Every model the enabled providers offer, already labelled for display. */
    modelOptions: readonly SelectOption[];
    effort?: string;
    /** The chosen model's own reasoning levels; empty when it exposes none. */
    effortOptions: readonly SelectOption[];
    permissionMode: string;
    permissionModeOptions: readonly SelectOption[];
    /** Set while the catalog is still being read, so the pickers say so. */
    loading?: boolean;
    error?: string;
    /** Why daemon-backed defaults cannot currently be changed. Appearance remains local. */
    unavailable?: string;
    /** Whether active session, project, and workspace titles shimmer. */
    titleShimmerEnabled: boolean;
    /**
     * The desktop application itself, absent outside the native shell. It has
     * no "check now": the app checks on its own every quarter hour, so this
     * says what it currently knows rather than offering a button that would
     * mostly repeat an answer already on screen.
     */
    application?: {
        version: string;
        updateStatus: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
        availableVersion?: string;
        message?: string;
    };
    /** The managed KISSOPEN Agent installation, absent outside the native desktop shell. */
    agent?: {
        availableVersion?: string;
        error?: string;
        installedVersion?: string;
        managed: boolean;
        message?: string;
        operation: "idle" | "checking" | "downloading" | "upgrading";
        runningVersion?: string;
        runtime: "stopped" | "starting" | "ready";
        updateAvailable: boolean;
        /**
         * A newer version already downloaded and waiting on the person. Its
         * presence turns the offer from "fetch this" into "stop the agent and
         * run it", which is the only half of an update anyone has to decide.
         */
        readyVersion?: string;
        /** Every version that can be run, newest first; empty before the first check. */
        versions: readonly {
            downloaded: boolean;
            prerelease: boolean;
            version: string;
        }[];
    };
    onAppearanceChange: (appearance: KissopenAgentAppearanceChoice) => void;
    /** The interface language; omitted where it cannot be changed. */
    language?: "system" | "zh" | "en";
    onLanguageChange?: (language: "system" | "zh" | "en") => void;
    onScrollbarVisibilityChange: (visibility: KissopenAgentScrollbarVisibilityChoice) => void;
    onTitleShimmerChange: (enabled: boolean) => void;
    onDefaultModelChange: (key: string) => void;
    onEffortChange: (effort: string) => void;
    onPermissionModeChange: (mode: string) => void;
    /** Restarts into an update that has already been downloaded. */
    onApplicationInstall?: () => void;
    onAgentCheck?: () => void;
    onAgentUpgrade?: () => void;
    onAgentVersionSelect?: (version: string) => void;
    /** Drains and restarts the agent on the version it is already running. */
    onAgentRestart?: () => void;
};

const appearanceSegments = [
    { value: "system", label: t("System") },
    { value: "light", label: t("Light") },
    { value: "dark", label: t("Dark") },
];

// Each language is named in itself, so a reader who cannot read the current
// interface can still find their own.
const languageSegments = () => [
    { value: "system", label: t("System") },
    { value: "zh", label: t("中文") },
    { value: "en", label: t("English") },
];

const scrollbarSegments = [
    { value: "automatic", label: t("Automatic") },
    { value: "always", label: t("Always visible") },
];

/**
 * The General category: how the window looks, and what a new session on this
 * machine starts with. The model list is the daemon's catalog, so the picker
 * names one model rather than a per-provider matrix of defaults — the providers
 * already decide which models exist.
 */
export function KissopenAgentGeneralSettings(props: KissopenAgentGeneralSettingsProps) {
    return (
        <>
            {props.error ? (
                <Banner tone="danger" title={t("Models unavailable")}>
                    {props.error}
                </Banner>
            ) : null}
            {props.unavailable ? (
                <Banner tone="neutral" title={t("KissOpen Agent reconnecting")}>
                    {props.unavailable}
                </Banner>
            ) : null}
            <KissopenAgentSettingsSection
                description={t("How KissOpen looks and moves in this window.")}
                title={t("Appearance")}
            >
                <FormRow
                    control={
                        <SegmentedControl
                            onChange={(value) =>
                                props.onAppearanceChange(value as KissopenAgentAppearanceChoice)
                            }
                            segments={appearanceSegments}
                            size="small"
                            value={props.appearance}
                        />
                    }
                    description={t("Applies to this window immediately")}
                    label={t("Theme")}
                />
                {props.language && props.onLanguageChange ? (
                    <FormRow
                        control={
                            <SegmentedControl
                                onChange={(value) =>
                                    props.onLanguageChange?.(value as "system" | "zh" | "en")
                                }
                                segments={languageSegments()}
                                size="small"
                                value={props.language}
                            />
                        }
                        description={t("Reloads the window in the chosen language")}
                        label={t("Language")}
                    />
                ) : null}
                <FormRow
                    control={
                        <SegmentedControl
                            onChange={(value) =>
                                props.onScrollbarVisibilityChange(
                                    value as KissopenAgentScrollbarVisibilityChoice,
                                )
                            }
                            segments={scrollbarSegments}
                            size="small"
                            value={props.scrollbarVisibility}
                        />
                    }
                    description={t("Automatic hides two seconds after user scrolling stops")}
                    label={t("Scrollbars")}
                />
                <FormRow
                    control={
                        <Switch
                            aria-label={t("Shimmer active titles")}
                            checked={props.titleShimmerEnabled}
                            id="kissopen-agent-settings-title-shimmer"
                            onChange={props.onTitleShimmerChange}
                            size="small"
                        />
                    }
                    description={t("Animates running session, project, and workspace names")}
                    htmlFor="kissopen-agent-settings-title-shimmer"
                    label={t("Shimmer active titles")}
                />
            </KissopenAgentSettingsSection>
            <KissopenAgentSettingsSection
                description={t(
                    "What a session started on this machine begins with. Each session can still be changed from its composer.",
                )}
                title={t("New sessions")}
            >
                <FormRow
                    control={
                        props.loading ? (
                            <Box className="kissopen-agent-settings__pending">
                                <Spinner size={16} />
                                <span>{t("Reading the model catalog…")}</span>
                            </Box>
                        ) : (
                            <Box width={280}>
                                <Select
                                    aria-label={t("Default model")}
                                    disabled={props.unavailable !== undefined}
                                    fullWidth
                                    id="kissopen-agent-settings-default-model"
                                    onValueChange={props.onDefaultModelChange}
                                    options={[...props.modelOptions]}
                                    placeholder={t("Choose a model")}
                                    size="small"
                                    value={props.defaultModelKey}
                                />
                            </Box>
                        )
                    }
                    description={t("Chosen from the models the enabled providers offer")}
                    htmlFor="kissopen-agent-settings-default-model"
                    label={t("Default model")}
                />
                <FormRow
                    control={
                        <Box width={280}>
                            <Select
                                aria-label={t("Reasoning effort")}
                                disabled={
                                    props.unavailable !== undefined ||
                                    props.effortOptions.length === 0
                                }
                                fullWidth
                                id="kissopen-agent-settings-effort"
                                onValueChange={props.onEffortChange}
                                options={[...props.effortOptions]}
                                placeholder={
                                    props.effortOptions.length === 0
                                        ? "Not offered by this model"
                                        : "Model default"
                                }
                                size="small"
                                value={props.effort}
                            />
                        </Box>
                    }
                    description={t("How much the model is asked to think before it answers")}
                    htmlFor="kissopen-agent-settings-effort"
                    label={t("Reasoning effort")}
                />
                <FormRow
                    control={
                        <Box width={280}>
                            <Select
                                aria-label={t("Default access mode")}
                                disabled={props.unavailable !== undefined}
                                fullWidth
                                id="kissopen-agent-settings-permission-mode"
                                onValueChange={props.onPermissionModeChange}
                                options={[...props.permissionModeOptions]}
                                size="small"
                                value={props.permissionMode}
                            />
                        </Box>
                    }
                    description={t(
                        "How much of the machine a new session may touch without asking",
                    )}
                    htmlFor="kissopen-agent-settings-permission-mode"
                    label={t("Default access mode")}
                />
            </KissopenAgentSettingsSection>
            {props.application ? (
                <KissopenAgentSettingsSection title={t("KissOpen")}>
                    <FormRow
                        control={
                            <Box className="kissopen-agent-settings__agent-control">
                                <span className="kissopen-agent-settings__agent-version">
                                    v{props.application.version}
                                </span>
                                {props.application.updateStatus === "downloaded" &&
                                props.onApplicationInstall ? (
                                    <Button
                                        onClick={props.onApplicationInstall}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {props.application.availableVersion
                                            ? t("Restart into v{availableVersion}", {
                                                  availableVersion:
                                                      props.application.availableVersion,
                                              })
                                            : t("Restart to update")}
                                    </Button>
                                ) : null}
                            </Box>
                        }
                        description={applicationDescription(props.application)}
                        label={t("Installed version")}
                    />
                </KissopenAgentSettingsSection>
            ) : null}
            {props.agent ? (
                <KissopenAgentSettingsSection
                    description={t(
                        "The verified local runtime KissOpen uses for coding sessions. Updates are found and downloaded on their own, quietly and without interrupting anything. Running one is the part you decide, because it stops the agent.",
                    )}
                    title={t("Agent")}
                >
                    <FormRow
                        control={
                            <Box className="kissopen-agent-settings__agent-control">
                                <span className="kissopen-agent-settings__agent-version">
                                    {!props.agent.managed
                                        ? t("External")
                                        : props.agent.installedVersion
                                          ? `v${props.agent.installedVersion}`
                                          : t("Not installed")}
                                </span>
                                {/* Downloading says so right here and nowhere else.
                                    It interrupts nobody, so it gets a line in the
                                    row it belongs to rather than the window. */}
                                {props.agent.managed &&
                                (props.agent.operation === "checking" ||
                                    props.agent.operation === "downloading") ? (
                                    <Box className="kissopen-agent-settings__pending">
                                        <Spinner size={16} />
                                        <span>
                                            {props.agent.operation === "checking"
                                                ? t("Checking…")
                                                : t("Downloading…")}
                                        </span>
                                    </Box>
                                ) : null}
                                {props.agent.managed &&
                                props.agent.updateAvailable &&
                                props.onAgentUpgrade ? (
                                    <Button
                                        loading={props.agent.operation === "upgrading"}
                                        onClick={props.onAgentUpgrade}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {/* "Install" once the bytes are already here,
                                            which is the ordinary case: the fetch
                                            happened on its own, and what is left to
                                            agree to is the interruption. */}
                                        {props.agent.readyVersion
                                            ? t("Install v{readyVersion}", {
                                                  readyVersion: props.agent.readyVersion,
                                              })
                                            : props.agent.availableVersion
                                              ? t("Update to {availableVersion}", {
                                                    availableVersion: props.agent.availableVersion,
                                                })
                                              : t("Update")}
                                    </Button>
                                ) : null}
                                {props.agent.managed && props.onAgentCheck ? (
                                    <Button
                                        disabled={props.agent.operation !== "idle"}
                                        onClick={props.onAgentCheck}
                                        size="small"
                                        variant={
                                            props.agent.updateAvailable ? "ghost" : "secondary"
                                        }
                                    >
                                        {t("Check for updates")}
                                    </Button>
                                ) : null}
                            </Box>
                        }
                        description={agentDescription(props.agent)}
                        label={t("Installed version")}
                    />
                    {props.agent.managed && props.onAgentVersionSelect ? (
                        <FormRow
                            control={
                                <Box width={280}>
                                    <Select
                                        aria-label={t("Agent version")}
                                        disabled={
                                            props.agent.operation !== "idle" ||
                                            props.agent.versions.length === 0
                                        }
                                        fullWidth
                                        id="kissopen-agent-settings-agent-version"
                                        onValueChange={props.onAgentVersionSelect}
                                        options={agentVersionOptions(
                                            props.agent.versions,
                                            props.agent.availableVersion,
                                        )}
                                        placeholder={
                                            props.agent.versions.length === 0
                                                ? t("No versions read yet")
                                                : t("Choose a version")
                                        }
                                        size="small"
                                        value={props.agent.installedVersion}
                                    />
                                </Box>
                            }
                            description={t(
                                "Runs an exact release, forwards or back. One not held on this machine is downloaded first; then the agent is drained and restarted onto it.",
                            )}
                            htmlFor="kissopen-agent-settings-agent-version"
                            label={t("Version")}
                        />
                    ) : null}
                    <FormRow
                        control={
                            <Box className="kissopen-agent-settings__agent-control">
                                <span className="kissopen-agent-settings__agent-runtime">
                                    {agentRuntimeLabel(
                                        props.agent.runtime,
                                        props.agent.runningVersion,
                                    )}
                                </span>
                                {props.agent.managed && props.onAgentRestart ? (
                                    <Button
                                        disabled={props.agent.operation !== "idle"}
                                        onClick={props.onAgentRestart}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {t("Restart")}
                                    </Button>
                                ) : null}
                            </Box>
                        }
                        description={t(
                            "Follows the daemon KissOpen is connected to. Restarting lets its work finish first.",
                        )}
                        label={t("Daemon")}
                    />
                </KissopenAgentSettingsSection>
            ) : null}
        </>
    );
}

/**
 * The picker's rows. Each says what choosing it would cost — a version already
 * on this machine starts immediately, anything else is a download — and which
 * one the automatic check considers current.
 */
function agentVersionOptions(
    versions: NonNullable<KissopenAgentGeneralSettingsProps["agent"]>["versions"],
    latestVersion: string | undefined,
): SelectOption[] {
    return versions.map((entry) => {
        const notes = [
            entry.version === latestVersion ? t("Latest") : undefined,
            entry.prerelease ? t("Pre-release") : undefined,
            entry.downloaded ? t("Downloaded") : undefined,
        ].filter((note) => note !== undefined);
        return {
            label:
                notes.length > 0 ? `v${entry.version} · ${notes.join(" · ")}` : `v${entry.version}`,
            value: entry.version,
        };
    });
}

function applicationDescription(
    application: NonNullable<KissopenAgentGeneralSettingsProps["application"]>,
): string {
    switch (application.updateStatus) {
        case "checking":
            return t("Looking for a newer version…");
        case "available":
            return application.availableVersion
                ? t("v{availableVersion} found; downloading it now.", {
                      availableVersion: application.availableVersion,
                  })
                : t("A newer version was found; downloading it now.");
        case "downloading":
            return application.message ?? t("Downloading the newer version…");
        case "downloaded":
            return t("Downloaded. It installs when KissOpen next quits, or restart now.");
        case "error":
            // The updater's own sentence says more than "something failed", and
            // an update that cannot be found is not a broken application.
            return application.message
                ? t("Update check failed: {application}", { application: application.message })
                : t("The last update check did not finish. Checks continue automatically.");
        default:
            return t("Up to date as of the last check.");
    }
}

/**
 * What the agent's update state amounts to, told from its fields rather than
 * from the sentence the host process wrote, so it reads in the window's
 * language and names the agent the way this page does.
 */
function agentDescription(agent: NonNullable<KissopenAgentGeneralSettingsProps["agent"]>): string {
    if (!agent.managed) return t("This daemon is supplied by an external development environment.");
    if (agent.error)
        return t("Agent reported: {error} Update checks continue automatically.", {
            error: agent.error,
        });
    switch (agent.operation) {
        case "checking":
            return t("Checking for Agent updates…");
        case "downloading":
            return agent.availableVersion
                ? t("Downloading Agent {version}…", { version: agent.availableVersion })
                : t("Downloading the Agent update…");
        case "upgrading":
            return t("Starting the new Agent…");
        case "idle":
            break;
    }
    if (agent.readyVersion)
        return t("Agent {version} is downloaded and ready to install.", {
            version: agent.readyVersion,
        });
    if (agent.updateAvailable)
        return agent.availableVersion
            ? t("Agent {version} is available.", { version: agent.availableVersion })
            : t("A newer verified release is ready.");
    return t("Agent is up to date.");
}

function agentRuntimeLabel(
    runtime: NonNullable<KissopenAgentGeneralSettingsProps["agent"]>["runtime"],
    runningVersion: string | undefined,
): string {
    switch (runtime) {
        case "ready":
            return runningVersion
                ? t("Running · v{runningVersion}", { runningVersion })
                : t("Running");
        case "starting":
            return t("Starting");
        case "stopped":
            return t("Stopped");
    }
}
