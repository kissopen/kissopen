import { t } from "kissopen-desktop-state";
import { Badge, type BadgeVariant } from "../../Badge";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { Box } from "../../Box";
import { FormRow } from "../../FormRow";
import { QRCode } from "../../QRCode";
import { Spinner } from "../../Spinner";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export type KissopenAgentMobileStatus =
    | "loading"
    | "disabled"
    | "disconnected"
    | "pairing"
    | "connecting"
    | "connected"
    | "failed"
    | "unavailable";

export interface KissopenAgentMobileSettingsProps {
    /** Undefined until Kissopen Agent has reported its durable configuration. */
    readonly configured?: boolean;
    readonly status: KissopenAgentMobileStatus;
    readonly disconnecting?: boolean;
    readonly pairingStarting?: boolean;
    readonly pairingCanceling?: boolean;
    readonly pairingData?: string;
    readonly pairingExpiresAt?: number;
    /** Why the live integration state could not be read. */
    readonly error?: string;
    /** Why the last disconnect attempt was refused. */
    readonly disconnectError?: string;
    /** Why the last pairing action was refused. */
    readonly pairingError?: string;
    /** Detail Kissopen Agent reported for a failed or disconnected integration. */
    readonly message?: string;
    /** Why actions cannot currently reach this Kissopen Agent. */
    readonly unavailable?: string;
    /** Opens the shared Desktop mobile setup; absent for remote Agent-only pairing. */
    readonly onSetup?: () => void;
    onDisconnect(): void;
    onPair(): void;
    onPairingCancel(): void;
}

const STATUS_LABELS: Record<KissopenAgentMobileStatus, string> = {
    loading: "Reading…",
    disabled: "Unavailable",
    disconnected: "Disconnected",
    pairing: "Pairing",
    connecting: "Connecting",
    connected: "Connected",
    failed: "Connection failed",
    unavailable: "Unavailable",
};

const STATUS_VARIANTS: Record<KissopenAgentMobileStatus, BadgeVariant> = {
    loading: "neutral",
    disabled: "neutral",
    disconnected: "warning",
    pairing: "info",
    connecting: "info",
    connected: "success",
    failed: "danger",
    unavailable: "neutral",
};

/** The Mobile Access category: configuration and live Kissopen Mobile connection state. */
export function KissopenAgentMobileSettings(props: KissopenAgentMobileSettingsProps) {
    return (
        <KissopenAgentSettingsSection
            description={t(
                "Pairing lets KissOpen Mobile follow and continue the work running through this KissOpen Agent.",
            )}
            title={t("Mobile Access")}
        >
            {props.unavailable ? (
                <Banner tone="warning" title={t("KissOpen Agent unavailable")}>
                    {props.unavailable}
                </Banner>
            ) : null}
            {props.error ? (
                <Banner tone="danger" title={t("KissOpen Mobile status unavailable")}>
                    {props.error}
                </Banner>
            ) : null}
            {props.disconnectError ? (
                <Banner tone="danger" title={t("Still connected")}>
                    {props.disconnectError}
                </Banner>
            ) : null}
            {props.pairingError ? (
                <Banner tone="danger" title={t("Pairing unavailable")}>
                    {props.pairingError}
                </Banner>
            ) : null}
            {props.message ? (
                <Banner
                    tone={props.status === "failed" ? "danger" : "warning"}
                    title={props.status === "failed" ? "Connection failed" : "Disconnected"}
                >
                    {props.message}
                </Banner>
            ) : null}
            <FormRow
                control={
                    <Badge
                        label={configurationLabel(props.configured)}
                        variant={props.configured ? "success" : "neutral"}
                    />
                }
                description={t("Whether this KissOpen Agent has a saved KissOpen Mobile pairing.")}
                label={t("Configuration")}
            />
            <FormRow
                control={
                    <Badge
                        label={STATUS_LABELS[props.status]}
                        variant={STATUS_VARIANTS[props.status]}
                    />
                }
                description={statusDescription(props.status)}
                label={t("Connection")}
            />
            {!props.onSetup && props.status === "pairing" && props.pairingData ? (
                <Box className="kissopen-agent-mobile-settings__pairing">
                    <QRCode
                        data={props.pairingData}
                        data-testid="kissopen-mobile-settings-pairing-qr"
                        label={t("QR code to pair KissOpen Mobile")}
                        size={240}
                    />
                    <Box className="kissopen-agent-mobile-settings__waiting">
                        <Spinner label={t("Pairing in progress")} size={16} />
                        <span>{pairingWaitingLabel(props.pairingExpiresAt)}</span>
                    </Box>
                    <Button
                        loading={props.pairingCanceling}
                        onClick={props.onPairingCancel}
                        size="small"
                        variant="ghost"
                    >
                        {t("Cancel pairing")}
                    </Button>
                </Box>
            ) : null}
            {!props.onSetup &&
            props.configured === false &&
            (props.status === "disconnected" || props.status === "failed") ? (
                <FormRow
                    align="start"
                    control={
                        <Button
                            disabled={props.unavailable !== undefined}
                            icon="link"
                            loading={props.pairingStarting}
                            onClick={props.onPair}
                            size="small"
                            variant="primary"
                        >
                            {t("Connect")}
                        </Button>
                    }
                    description={t(
                        "Start a secure pairing and scan the QR code with KissOpen Mobile.",
                    )}
                    label={t("Pair KissOpen Mobile")}
                />
            ) : null}
            {props.onSetup ? (
                <FormRow
                    align="start"
                    label={t("Set up mobile access")}
                    description={
                        props.configured
                            ? "Use your saved pairing to finish mobile access for KissOpen Desktop and terminal Claude Code and Codex sessions."
                            : "Get KissOpen Coder, prepare the KissOpen CLI, and link this computer with one device-pairing code."
                    }
                    control={
                        <Button
                            disabled={props.unavailable !== undefined || props.disconnecting}
                            onClick={props.onSetup}
                            size="small"
                            variant="primary"
                        >
                            {props.configured ? "Finish mobile setup" : "Set up mobile access"}
                        </Button>
                    }
                />
            ) : null}
            {props.configured === true ? (
                <FormRow
                    align="start"
                    control={
                        <Button
                            disabled={props.unavailable !== undefined}
                            icon="unlink"
                            loading={props.disconnecting}
                            onClick={props.onDisconnect}
                            size="small"
                            variant="danger"
                        >
                            {t("Disconnect")}
                        </Button>
                    }
                    description={t(
                        "Remove this pairing from KissOpen Agent. KissOpen Mobile will no longer be able to follow its work.",
                    )}
                    label={t("Disconnect KissOpen Mobile")}
                />
            ) : null}
        </KissopenAgentSettingsSection>
    );
}

function pairingWaitingLabel(expiresAt: number | undefined): string {
    if (expiresAt === undefined) return "Waiting for your phone…";
    const expiration = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(expiresAt);
    return t("Waiting for your phone · expires {expiration}", { expiration });
}

function configurationLabel(configured: boolean | undefined): string {
    if (configured === undefined) return "Unknown";
    return configured ? "Configured" : "Not configured";
}

function statusDescription(status: KissopenAgentMobileStatus): string {
    switch (status) {
        case "loading":
            return "Reading the current KissOpen Mobile connection from KissOpen Agent.";
        case "disabled":
            return "KissOpen Mobile integration is disabled in this KissOpen Agent installation.";
        case "disconnected":
            return "KissOpen Agent is not currently connected to KissOpen Mobile.";
        case "pairing":
            return "KissOpen Agent is waiting for KissOpen Mobile to finish pairing.";
        case "connecting":
            return "The saved pairing is connecting to KissOpen Mobile.";
        case "connected":
            return "KissOpen Agent has a live connection to KissOpen Mobile.";
        case "failed":
            return "KissOpen Agent could not establish its KissOpen Mobile connection.";
        case "unavailable":
            return "This KissOpen Agent does not report KissOpen Mobile integration state.";
    }
}
