import { t } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { FormRow } from "../../FormRow";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface KissopenAgentAccountSettingsProps {
    readonly status: "loading" | "disconnected" | "authorizing" | "connected" | "unavailable";
    readonly authorizationCompleting?: boolean;
    readonly authorizationStarting?: boolean;
    readonly disconnecting?: boolean;
    readonly email?: string;
    readonly error?: string;
    readonly unavailable?: string;
    onConnect(): void;
    onDisconnect(): void;
}

/** The WorkOS account has only two actions: connect and disconnect. */
export function KissopenAgentAccountSettings(props: KissopenAgentAccountSettingsProps) {
    const connected = props.status === "connected";
    return (
        <KissopenAgentSettingsSection>
            {props.unavailable ? (
                <Banner tone="warning" title={t("KissOpen Agent unavailable")}>
                    {props.unavailable}
                </Banner>
            ) : null}
            {props.error ? (
                <Banner tone="danger" title={t("Account connection failed")}>
                    {props.error}
                </Banner>
            ) : null}
            <FormRow
                label={t("KissOpen account")}
                description={accountDescription(props)}
                control={
                    <Button
                        disabled={props.unavailable !== undefined || props.status === "unavailable"}
                        icon={connected ? "unlink" : undefined}
                        loading={
                            props.status === "loading" ||
                            props.authorizationStarting ||
                            props.authorizationCompleting ||
                            props.disconnecting
                        }
                        onClick={connected ? props.onDisconnect : props.onConnect}
                        size="small"
                        variant={connected ? "secondary" : "primary"}
                    >
                        {connected ? "Disconnect" : "Connect account"}
                    </Button>
                }
            />
        </KissopenAgentSettingsSection>
    );
}

function accountDescription(props: KissopenAgentAccountSettingsProps): string {
    switch (props.status) {
        case "loading":
            return "Checking account connection…";
        case "disconnected":
            return "Sign in through WorkOS in your browser";
        case "authorizing":
            return props.authorizationCompleting
                ? "Completing sign-in…"
                : "Finish signing in through your browser";
        case "connected":
            return props.email ?? t("Account connected");
        case "unavailable":
            return "Account authentication is unavailable on this KissOpen Agent";
    }
}
