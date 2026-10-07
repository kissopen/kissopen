import {
    KissopenAgentAccountSettings,
    type KissopenAgentAccountSettingsProps,
} from "../../src/pages/settings/KissopenAgentAccountSettings";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-275";
const noop = () => undefined;
const cases: readonly (KissopenAgentAccountSettingsProps & { readonly label: string })[] = [
    { label: "Signed out", status: "disconnected", onConnect: noop, onDisconnect: noop },
    { label: "Loading", status: "loading", onConnect: noop, onDisconnect: noop },
    {
        label: "Opening browser",
        status: "disconnected",
        authorizationStarting: true,
        onConnect: noop,
        onDisconnect: noop,
    },
    { label: "Awaiting browser", status: "authorizing", onConnect: noop, onDisconnect: noop },
    {
        label: "Completing sign-in",
        status: "authorizing",
        authorizationCompleting: true,
        onConnect: noop,
        onDisconnect: noop,
    },
    {
        label: "Connected",
        status: "connected",
        email: "steve@example.com",
        onConnect: noop,
        onDisconnect: noop,
    },
    {
        label: "Disconnecting",
        status: "connected",
        disconnecting: true,
        onConnect: noop,
        onDisconnect: noop,
    },
    {
        label: "Sign-in failed",
        status: "disconnected",
        error: "Sign-in could not be completed. Please try again.",
        onConnect: noop,
        onDisconnect: noop,
    },
    { label: "Unsupported", status: "unavailable", onConnect: noop, onDisconnect: noop },
    {
        label: "Offline",
        status: "connected",
        unavailable: "This KISSOPEN Agent is reconnecting.",
        onConnect: noop,
        onDisconnect: noop,
    },
];

export function KissopenAgentAccountSettingsPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="KISSOPEN account"
            summary="WorkOS authentication with one connect or disconnect control. No additional setup steps."
        >
            {cases.map(({ label, ...props }, index) => (
                <Specimen
                    key={label}
                    label={label}
                    detail="One account row with status and its available action"
                    number={String(index + 1).padStart(2, "0")}
                    stage="surface"
                >
                    <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
                        <KissopenAgentAccountSettings {...props} />
                    </div>
                </Specimen>
            ))}
        </ComponentPage>
    );
}
