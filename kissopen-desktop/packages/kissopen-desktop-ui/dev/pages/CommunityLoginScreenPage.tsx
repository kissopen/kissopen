import { CommunityLoginScreen } from "../../src/CommunityLoginScreen";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-702";
const noop = () => undefined;
export function CommunityLoginScreenPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Desktop sign-in entry"
            summary="Authentication precedes the local workspace. Browser authorization returns to the same window."
        >
            {(
                [
                    { label: "Loading", status: "loading", providers: [] },
                    { label: "Ready", status: "ready", providers: ["github", "google", "nodeloc"] },
                    { label: "NodeLoc only", status: "ready", providers: ["nodeloc"] },
                    { label: "Authorizing", status: "authorizing", providers: ["nodeloc"] },
                    {
                        label: "Two-factor authentication",
                        status: "authorizing",
                        providers: ["nodeloc"],
                        needsFactor: true,
                    },
                    { label: "Not configured", status: "ready", providers: [] },
                    {
                        label: "Offline",
                        status: "ready",
                        providers: [],
                        error: "Cannot reach the KissOpen account service. Check your connection. Sign-in availability is checked automatically.",
                    },
                ] as const
            ).map((fixture, index) => (
                <Specimen
                    key={fixture.label}
                    label={fixture.label}
                    number={String(index + 1)}
                    stage="surface"
                    detail="720 × 480 minimum desktop window · retained sign-in controls"
                >
                    <div style={{ display: "flex", width: 720, height: 480 }}>
                        <CommunityLoginScreen
                            status={fixture.status}
                            providers={fixture.providers}
                            error={"error" in fixture ? fixture.error : undefined}
                            needsFactor={"needsFactor" in fixture ? fixture.needsFactor : false}
                            onSignIn={noop}
                            onCancel={noop}
                            onPasswordSignIn={noop}
                            onFactor={noop}
                        />
                    </div>
                </Specimen>
            ))}
        </ComponentPage>
    );
}
