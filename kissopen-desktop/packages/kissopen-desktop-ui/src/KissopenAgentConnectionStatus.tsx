import { t } from "kissopen-desktop-state";
import { type CSSProperties } from "react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { WindowDragRegion } from "./TitleBar";

export type KissopenAgentConnectionState = "connecting" | "connected" | "disconnected";
export type KissopenAgentDaemonState = "unknown" | "starting" | "ready" | "error";

export interface KissopenAgentConnectionStatusProps {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** Transport reachability, independent of daemon health. */
    connection: KissopenAgentConnectionState;
    /** Daemon liveness reported by the last successful probe. */
    daemon: KissopenAgentDaemonState;
    /** Daemon version, when a probe has succeeded. */
    version?: string;
    /** Error detail for a daemon error or a probe failure. */
    message?: string;
    /** Consecutive failed reconnect attempts; zero while connected. */
    attempt: number;
    onRetry(): void;
}

interface StatusModel {
    readonly loading: boolean;
    readonly status: string;
    readonly progress: string;
}

function statusModel(props: KissopenAgentConnectionStatusProps): StatusModel {
    if (props.connection === "connecting")
        return {
            loading: true,
            status: t("Connecting to KissOpen Agent"),
            progress: "Checking the local service…",
        };
    if (props.connection === "disconnected")
        return {
            loading: true,
            status: t("Reconnecting to KissOpen Agent"),
            progress:
                props.attempt > 1
                    ? t("Waiting for the local service · attempt {attempt}", {
                          attempt: props.attempt,
                      })
                    : "Waiting for the local service…",
        };
    // connection === "connected": the transport is live; the daemon reports health.
    if (props.daemon === "starting")
        return {
            loading: true,
            status: t("Starting KissOpen Agent"),
            progress: "Waiting for the daemon to become ready…",
        };
    if (props.daemon === "error")
        return {
            loading: false,
            status: t("KissOpen Agent needs attention"),
            progress: props.message ?? t("The local daemon reported an error."),
        };
    return {
        loading: false,
        status: t("KissOpen Agent is ready"),
        progress: props.version
            ? t("Local daemon {version}", { version: props.version })
            : "Local daemon connected",
    };
}

/**
 * C-147 KissopenAgentConnectionStatus — the desktop status surface for the HTTP connection
 * to a local Kissopen Agent daemon. One centered, muted ASCII loader and two neutral lines
 * report connection reachability and daemon progress without presenting startup
 * as an onboarding or warning flow. A quiet retry action appears only when the
 * owner can intervene. Props-only and desktop-only.
 */
export function KissopenAgentConnectionStatus(props: KissopenAgentConnectionStatusProps) {
    const model = statusModel(props);
    const canRetry =
        props.connection === "disconnected" ||
        (props.connection === "connected" && props.daemon === "error");
    return (
        <>
            <WindowDragRegion />
            <section
                className={["kissopen-agent-connection-status", props.className]
                    .filter(Boolean)
                    .join(" ")}
                data-testid={props["data-testid"] ?? "kissopen-agent-connection-status"}
                data-kissopen-desktop-ui="kissopen-agent-connection-status"
                data-state={props.connection === "connected" ? props.daemon : props.connection}
                style={props.style}
            >
                <div
                    aria-live="polite"
                    className="kissopen-agent-connection-status__content"
                    data-kissopen-desktop-ui="kissopen-agent-connection-status-body"
                >
                    <span
                        className="kissopen-agent-connection-status__loader"
                        data-kissopen-desktop-ui="kissopen-agent-connection-status-loader"
                    >
                        {model.loading ? (
                            <Spinner label={model.status} size={20} tone="muted" variant="line" />
                        ) : (
                            <span aria-hidden className="kissopen-agent-connection-status__marker">
                                ·
                            </span>
                        )}
                    </span>
                    <strong
                        className="kissopen-agent-connection-status__status"
                        data-kissopen-desktop-ui="kissopen-agent-connection-status-label"
                    >
                        {model.status}
                    </strong>
                    <span
                        className="kissopen-agent-connection-status__progress"
                        data-kissopen-desktop-ui="kissopen-agent-connection-status-progress"
                    >
                        {model.progress}
                    </span>
                    {canRetry ? (
                        <Button onClick={props.onRetry} size="small" type="button" variant="ghost">
                            {t("Retry now")}
                        </Button>
                    ) : null}
                </div>
            </section>
        </>
    );
}
