import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Box } from "../../Box";
import { Button } from "../../Button";
import { CopyButton } from "../../CopyButton";
import { FormRow } from "../../FormRow";
import { Spinner } from "../../Spinner";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface KissopenAgentDebugTarget {
    readonly error?: string;
    readonly status: "stopped" | "starting" | "running" | "stopping" | "unavailable" | "error";
    readonly url?: string;
}

export type KissopenAgentDebugSettingsProps = {
    readonly daemon: KissopenAgentDebugTarget;
    readonly daemonConnected: boolean;
    readonly error?: string;
    readonly loading?: boolean;
    readonly main: KissopenAgentDebugTarget;
    readonly onAllStart: () => void;
    readonly onAllStop: () => void;
    readonly onDaemonStart: () => void;
    readonly onDaemonStop: () => void;
    readonly onMainStart: () => void;
    readonly onMainStop: () => void;
    readonly onRendererStart: () => void;
    readonly onRendererStop: () => void;
    readonly renderer: KissopenAgentDebugTarget;
    readonly supported: boolean;
};

/**
 * Live native debugger controls. Every target binds to loopback on demand, and
 * every copied address is the raw WebSocket endpoint an external CDP client uses.
 */
export function KissopenAgentDebugSettings(props: KissopenAgentDebugSettingsProps) {
    if (!props.supported && !props.loading)
        return (
            <Banner tone="neutral" title={t("Electron desktop only")}>
                {t("Live debugger attachment is available in KissOpen’s Electron desktop window.")}
            </Banner>
        );

    const targets = [props.main, props.renderer, props.daemon];
    const anyPending = targets.some((target) => pending(target));
    const allRunning = targets.every((target) => target.status === "running");
    const allStopped = targets.every(
        (target) =>
            target.status === "stopped" || (target.status === "error" && target.url === undefined),
    );

    return (
        <>
            {props.error ? (
                <Banner tone="danger" title={t("Dev Tools unavailable")}>
                    {props.error}
                </Banner>
            ) : null}
            {props.loading ? (
                <Box className="kissopen-agent-settings__pending">
                    <Spinner size={16} />
                    <span>{t("Reading debugger status…")}</span>
                </Box>
            ) : null}
            <KissopenAgentSettingsSection
                description={t(
                    "Starts and stops every debugger live. KissOpen stays open and the renderer is not reloaded.",
                )}
                title={t("Control")}
            >
                <FormRow
                    control={
                        <Box style={{ alignItems: "center", display: "flex", gap: 8 }}>
                            <Button
                                disabled={
                                    !props.supported || props.loading || anyPending || allRunning
                                }
                                loading={targets.some((target) => target.status === "starting")}
                                onClick={props.onAllStart}
                                size="small"
                                variant="secondary"
                            >
                                {t("Start all")}
                            </Button>
                            <Button
                                disabled={
                                    !props.supported || props.loading || anyPending || allStopped
                                }
                                loading={targets.some((target) => target.status === "stopping")}
                                onClick={props.onAllStop}
                                size="small"
                                variant="secondary"
                            >
                                {t("Stop all")}
                            </Button>
                        </Box>
                    }
                    description={t(
                        "Electron main, the current KissOpen renderer, and the local KissOpen Agent daemon",
                    )}
                    label={t("All debuggers")}
                />
            </KissopenAgentSettingsSection>
            <KissopenAgentSettingsSection
                description={t(
                    "Each endpoint listens only on 127.0.0.1. Copy its WebSocket URL into a raw CDP client.",
                )}
                title={t("Attachment points")}
            >
                <DebuggerRow
                    copyLabel="Copy Electron main debugger URL"
                    label={t("Electron main")}
                    onStart={props.onMainStart}
                    onStop={props.onMainStop}
                    target={props.main}
                />
                <DebuggerRow
                    copyLabel="Copy KissOpen renderer CDP URL"
                    label={t("KissOpen renderer")}
                    onStart={props.onRendererStart}
                    onStop={props.onRendererStop}
                    target={props.renderer}
                />
                <DebuggerRow
                    copyLabel="Copy KissOpen Agent daemon debugger URL"
                    disabled={!props.daemonConnected}
                    label={t("KissOpen Agent daemon")}
                    onStart={props.onDaemonStart}
                    onStop={props.onDaemonStop}
                    target={props.daemon}
                    unavailable="KissOpen Agent is not connected"
                />
            </KissopenAgentSettingsSection>
        </>
    );
}

function DebuggerRow(props: {
    readonly copyLabel: string;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onStart: () => void;
    readonly onStop: () => void;
    readonly target: KissopenAgentDebugTarget;
    readonly unavailable?: string;
}) {
    const url = props.target.url;
    const running = props.target.status === "running" && url !== undefined;
    const stopping = props.target.status === "stopping";
    const unavailable = props.target.status === "unavailable";
    const stopFailed = props.target.status === "error" && url !== undefined;
    return (
        <FormRow
            control={
                running || stopping || unavailable || stopFailed ? (
                    <Box style={{ alignItems: "center", display: "flex", gap: 6 }}>
                        {url ? <CopyButton label={props.copyLabel} text={url} /> : null}
                        <Button
                            disabled={props.disabled}
                            loading={stopping}
                            onClick={props.onStop}
                            size="small"
                            variant="secondary"
                        >
                            {t("Stop")}
                        </Button>
                    </Box>
                ) : (
                    <Button
                        disabled={props.disabled}
                        loading={props.target.status === "starting"}
                        onClick={props.onStart}
                        size="small"
                        variant="secondary"
                    >
                        {t("Start")}
                    </Button>
                )
            }
            description={targetDescription(props.target, props.disabled, props.unavailable)}
            label={props.label}
        />
    );
}

function targetDescription(
    target: KissopenAgentDebugTarget,
    unavailable: boolean | undefined,
    unavailableMessage: string | undefined,
): string {
    if (target.status === "running" && target.url) return target.url;
    if (target.status === "starting") return "Starting…";
    if (target.status === "stopping") return "Stopping…";
    if (target.error) return target.error;
    if (unavailable) return unavailableMessage ?? "Unavailable";
    return "Not listening";
}

function pending(target: KissopenAgentDebugTarget): boolean {
    return target.status === "starting" || target.status === "stopping";
}
