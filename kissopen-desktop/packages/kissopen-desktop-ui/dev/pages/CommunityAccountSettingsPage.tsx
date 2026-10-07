import { CommunityAccountSettings } from "../../src/pages/settings/CommunityAccountSettings";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "C-701";
const noop = () => undefined;
export function CommunityAccountSettingsPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="KissOpen sign-in"
            summary="Independent GitHub, Google and NodeLoc account authorization. Signing out returns to the login screen."
        >
            {(["ready", "authorizing", "loading"] as const).map((status) => (
                <Specimen
                    key={status}
                    label={status}
                    number={status}
                    stage="surface"
                    detail="Provider availability and cancellation"
                >
                    <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
                        <CommunityAccountSettings
                            status={status}
                            providers={["github", "google", "nodeloc"]}
                            profile={null}
                            onSignIn={noop}
                            onCancel={noop}
                            onSignOut={noop}
                        />
                    </div>
                </Specimen>
            ))}
            <Specimen
                label="Not configured"
                number="04"
                stage="surface"
                detail="No placeholder sign-in"
            >
                <CommunityAccountSettings
                    status="ready"
                    providers={[]}
                    profile={null}
                    onSignIn={noop}
                    onCancel={noop}
                    onSignOut={noop}
                />
            </Specimen>
            <Specimen
                label="Signed in"
                number="05"
                stage="surface"
                detail="Provider identity, not the local Git author"
            >
                <CommunityAccountSettings
                    status="ready"
                    providers={["github"]}
                    profile={{ id: "fixture", provider: "github", name: "KissOpen user" }}
                    onSignIn={noop}
                    onCancel={noop}
                    onSignOut={noop}
                />
            </Specimen>
            <Specimen
                label="Offline"
                number="06"
                stage="surface"
                detail="Account failure is reported without losing the signed-in workspace"
            >
                <CommunityAccountSettings
                    status="ready"
                    providers={[]}
                    profile={null}
                    error="Cannot reach the account service. Please check your connection."
                    onSignIn={noop}
                    onCancel={noop}
                    onSignOut={noop}
                />
            </Specimen>
        </ComponentPage>
    );
}
