import { type CSSProperties } from "react";
import { KissopenAgentConnectionStatus } from "../../src/KissopenAgentConnectionStatus";
import { ComponentPage, Specimen } from "../kit";

/** The component plan this page documents. The selector and the page header read the same value. */
export const componentNumber = "C-147";

const frame: CSSProperties = { width: "720px", height: "480px" };

export function KissopenAgentConnectionStatusPage() {
    return (
        <ComponentPage
            number={componentNumber}
            summary="Minimal desktop status surface for the local KISSOPEN Agent daemon: one muted ASCII loader, a neutral status, and concise progress."
            title="KISSOPEN Agent connection status"
        >
            <Specimen
                detail="Centered muted ASCII loader · neutral status and progress"
                label="Connecting"
                number="01"
                stage="app"
            >
                <div style={frame}>
                    <KissopenAgentConnectionStatus
                        attempt={0}
                        connection="connecting"
                        daemon="unknown"
                        onRetry={() => undefined}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Transport live, daemon booting"
                label="Daemon starting"
                number="02"
                stage="app"
            >
                <div style={frame}>
                    <KissopenAgentConnectionStatus
                        attempt={0}
                        connection="connected"
                        daemon="starting"
                        onRetry={() => undefined}
                        version="1.4.2"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Connected and ready — status only; content arrives later"
                label="Ready"
                number="03"
                stage="app"
            >
                <div style={frame}>
                    <KissopenAgentConnectionStatus
                        attempt={0}
                        connection="connected"
                        daemon="ready"
                        onRetry={() => undefined}
                        version="1.4.2"
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Dropped connection with automatic backoff and manual retry"
                label="Disconnected"
                number="04"
                stage="app"
            >
                <div style={frame}>
                    <KissopenAgentConnectionStatus
                        attempt={3}
                        connection="disconnected"
                        daemon="unknown"
                        message="connect ECONNREFUSED"
                        onRetry={() => undefined}
                    />
                </div>
            </Specimen>
            <Specimen
                detail="Daemon reachable but reporting an error"
                label="Daemon error"
                number="05"
                stage="app"
            >
                <div style={frame}>
                    <KissopenAgentConnectionStatus
                        attempt={0}
                        connection="connected"
                        daemon="error"
                        message="No provider is authenticated."
                        onRetry={() => undefined}
                        version="1.4.2"
                    />
                </div>
            </Specimen>
        </ComponentPage>
    );
}
