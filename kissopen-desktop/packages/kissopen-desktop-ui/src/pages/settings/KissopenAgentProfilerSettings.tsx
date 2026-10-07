import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { Button } from "../../Button";
import { CopyButton } from "../../CopyButton";
import { FormRow } from "../../FormRow";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export type KissopenAgentProfilerStatus =
    | "stopped"
    | "starting"
    | "running"
    | "stopping"
    | "partial"
    | "error"
    | "unavailable";

export interface KissopenAgentProfilerCapabilities {
    readonly liveDebuggerAttach: boolean;
    readonly nativeTrace: boolean;
    readonly processMetrics: boolean;
    readonly reactAttribution: boolean;
    readonly reactDevtoolsProfiling: boolean;
    readonly rendererMetrics: boolean;
}

export interface KissopenAgentProfilerSettingsProps {
    readonly artifactPath?: string;
    readonly capabilities: KissopenAgentProfilerCapabilities;
    readonly error?: string;
    readonly onStart: () => void;
    readonly onStop: () => void;
    readonly partialReason?: string;
    readonly status: KissopenAgentProfilerStatus;
    readonly supported: boolean;
}

/**
 * The profile control stays beside the live debugger controls in Dev Tools.
 * It describes the build capability explicitly: a normal renderer can still
 * capture native CDP timings, but cannot acquire React attribution after boot.
 */
export function KissopenAgentProfilerSettings(props: KissopenAgentProfilerSettingsProps) {
    const running = props.status === "running";
    const pending = props.status === "starting" || props.status === "stopping";
    const unavailable =
        !props.supported || (!props.capabilities.nativeTrace && props.status === "unavailable");
    return (
        <>
            {props.error ? (
                <Banner tone="danger" title={t("Profiler unavailable")}>
                    {props.error}
                </Banner>
            ) : null}
            {unavailable ? (
                <Banner tone="neutral" title={t("Electron desktop only")}>
                    {t(
                        "Native tracing and process metrics are available in KissOpen’s Electron desktop window.",
                    )}
                </Banner>
            ) : null}
            <KissopenAgentSettingsSection
                description={t(
                    "Capture a bounded renderer trace, React commits, changed hook indices, and native process metrics.",
                )}
                title={t("React renderer profile")}
            >
                <FormRow
                    control={
                        <Box style={{ alignItems: "center", display: "flex", gap: 8 }}>
                            <Button
                                disabled={unavailable || pending || running}
                                loading={props.status === "starting"}
                                onClick={props.onStart}
                                size="small"
                                variant="secondary"
                            >
                                Start profile
                            </Button>
                            <Button
                                disabled={unavailable || pending || !running}
                                loading={props.status === "stopping"}
                                onClick={props.onStop}
                                size="small"
                                variant="secondary"
                            >
                                Stop and save
                            </Button>
                        </Box>
                    }
                    description={statusDescription(props.status, props.partialReason)}
                    label={t("Capture")}
                />
                <FormRow
                    control={
                        <span>
                            {props.capabilities.reactAttribution ? "Available" : "Unavailable"}
                        </span>
                    }
                    description={t(
                        "Requires a profile build with the hook installed before React starts. Standard builds remain native-only.",
                    )}
                    label={t("React attribution")}
                />
                <FormRow
                    control={
                        <span>
                            {props.capabilities.liveDebuggerAttach
                                ? "Available during capture"
                                : "Unavailable"}
                        </span>
                    }
                    description={t(
                        "The external renderer debugger stays attached during capture; exclusive trace commands are rejected rather than stealing it.",
                    )}
                    label={t("Live debugger")}
                />
                <FormRow
                    control={
                        <span>
                            {props.capabilities.reactDevtoolsProfiling
                                ? "Available"
                                : "Unavailable"}
                        </span>
                    }
                    description={t(
                        "The profile renderer installed the official React DevTools backend before React started.",
                    )}
                    label={t("React DevTools profiling")}
                />
                {props.artifactPath ? (
                    <FormRow
                        control={
                            <CopyButton
                                label={t("Copy profiler artifact path")}
                                text={props.artifactPath}
                            />
                        }
                        description={props.artifactPath}
                        label={t("Last artifact")}
                    />
                ) : null}
            </KissopenAgentSettingsSection>
        </>
    );
}

function statusDescription(status: KissopenAgentProfilerStatus, partialReason?: string): string {
    if (status === "starting") return "Starting the native trace…";
    if (status === "running") return "Capturing until Stop or the one-minute safety limit.";
    if (status === "stopping") return "Stopping React and writing the artifact…";
    if (status === "partial")
        return partialReason
            ? t("Saved a partial artifact: {partialReason}", { partialReason })
            : "Saved a partial artifact.";
    if (status === "error") return "The last capture failed.";
    return "No profile is currently running.";
}
