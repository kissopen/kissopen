import type { CommunityProfile, CommunityProvider } from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { FormRow } from "../../FormRow";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface CommunityAccountSettingsProps {
    readonly providers: readonly CommunityProvider[];
    readonly profile: CommunityProfile | null;
    readonly status: "loading" | "ready" | "authorizing";
    readonly error?: string;
    onSignIn(provider: CommunityProvider): void;
    onCancel(): void;
    onSignOut(): void;
}
export function CommunityAccountSettings(props: CommunityAccountSettingsProps) {
    return (
        <KissopenAgentSettingsSection>
            {props.error ? (
                <Banner tone="warning" title="KissOpen account">
                    {props.error}
                </Banner>
            ) : null}
            {props.profile ? (
                <FormRow
                    label="KissOpen account"
                    description={`${props.profile.name} · ${props.profile.provider}`}
                    control={
                        <Button size="small" variant="secondary" onClick={props.onSignOut}>
                            Sign out
                        </Button>
                    }
                />
            ) : (
                <>
                    <FormRow
                        label="KissOpen account"
                        description={
                            props.status === "authorizing"
                                ? "Complete authorization in your browser, then return here."
                                : "Sign in to enter your workspace. This window remembers your session only."
                        }
                        control={
                            props.status === "authorizing" ? (
                                <Button size="small" variant="secondary" onClick={props.onCancel}>
                                    Cancel
                                </Button>
                            ) : undefined
                        }
                    />
                    {(["github", "google", "nodeloc"] as const).map((provider) => (
                        <FormRow
                            key={provider}
                            label={
                                { github: "GitHub", google: "Google", nodeloc: "NodeLoc" }[provider]
                            }
                            description={
                                props.status === "loading"
                                    ? "Checking sign-in availability…"
                                    : props.providers.includes(provider)
                                      ? "Authorize securely in your browser"
                                      : "Not configured on this server"
                            }
                            control={
                                <Button
                                    size="small"
                                    variant="secondary"
                                    disabled={
                                        props.status !== "ready" ||
                                        !props.providers.includes(provider)
                                    }
                                    onClick={() => props.onSignIn(provider)}
                                >
                                    Sign in
                                </Button>
                            }
                        />
                    ))}
                </>
            )}
        </KissopenAgentSettingsSection>
    );
}
