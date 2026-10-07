import type { CommunityProvider } from "kissopen-desktop-state";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { KissopenMark } from "./KissopenMark";
import { SetupPage } from "./SetupPage";
import { TextField } from "./TextField";
import { useState } from "react";

export interface CommunityLoginScreenProps {
    readonly providers: readonly CommunityProvider[];
    readonly status: "loading" | "ready" | "authorizing";
    readonly error?: string;
    onSignIn(provider: CommunityProvider): void;
    onCancel(): void;
    readonly needsFactor?: boolean;
    onPasswordSignIn?(username: string, password: string): void;
    onFactor?(code: string): void;
}

/** Account entry is independent of the local Agent and its startup state. */
export function CommunityLoginScreen(props: CommunityLoginScreenProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    return (
        <SetupPage
            title="Welcome to KissOpen"
            copy="Sign in to enter your workspace."
            className="kissopen-community-login"
        >
            <div className="kissopen-community-login__content">
                <KissopenMark size={72} label="KissOpen" />
                {props.error ? (
                    <Banner tone="warning" title="Could not sign in">
                        {props.error}
                    </Banner>
                ) : null}
                {props.needsFactor ? (
                    <form
                        className="kissopen-community-login__providers"
                        onSubmit={(event) => {
                            event.preventDefault();
                            props.onFactor?.(code);
                            setCode("");
                        }}
                    >
                        <TextField
                            fullWidth
                            label="Authenticator or recovery code"
                            value={code}
                            autoComplete="one-time-code"
                            onValueChange={setCode}
                            required
                        />
                        <Button fullWidth type="submit" disabled={!code.trim()}>
                            Verify code
                        </Button>
                    </form>
                ) : props.onPasswordSignIn ? (
                    <form
                        className="kissopen-community-login__providers"
                        onSubmit={(event) => {
                            event.preventDefault();
                            props.onPasswordSignIn?.(username, password);
                            setPassword("");
                        }}
                    >
                        <TextField
                            fullWidth
                            label="Username"
                            autoComplete="username"
                            value={username}
                            onValueChange={setUsername}
                            disabled={props.status !== "ready"}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onValueChange={setPassword}
                            disabled={props.status !== "ready"}
                            required
                        />
                        <Button
                            fullWidth
                            type="submit"
                            disabled={props.status !== "ready" || !username.trim() || !password}
                        >
                            Sign in
                        </Button>
                        <span className="kissopen-community-login__status">
                            First time? Use a provider below, then set a password in Security.
                        </span>
                    </form>
                ) : null}
                {!props.needsFactor ? (
                    <div className="kissopen-community-login__providers">
                        {(["github", "google", "nodeloc"] as const).map((provider) => (
                            <Button
                                key={provider}
                                size="large"
                                fullWidth
                                variant="secondary"
                                disabled={
                                    props.status !== "ready" || !props.providers.includes(provider)
                                }
                                title={
                                    props.status === "ready" && !props.providers.includes(provider)
                                        ? "This sign-in method is not configured yet."
                                        : undefined
                                }
                                onClick={() => props.onSignIn(provider)}
                            >
                                Continue with{" "}
                                {
                                    { github: "GitHub", google: "Google", nodeloc: "NodeLoc" }[
                                        provider
                                    ]
                                }
                            </Button>
                        ))}
                    </div>
                ) : null}
                <div className="kissopen-community-login__status" role="status">
                    {props.status === "loading"
                        ? "Checking sign-in availability…"
                        : props.needsFactor
                          ? "Two-factor authentication protects this account. Enter a code to continue."
                          : props.status === "authorizing"
                            ? "Signing in… If a browser opened, finish authorization there."
                            : props.error
                              ? "Check your details or try another available sign-in method."
                              : props.providers.length
                                ? "Sign in securely in your browser."
                                : props.onPasswordSignIn
                                  ? "Sign in with your existing username and password. Provider sign-in is not configured."
                                  : "No sign-in methods are available. Check the account service configuration."}
                </div>
                {props.status === "authorizing" ? (
                    <Button variant="ghost" onClick={props.onCancel}>
                        Cancel sign-in
                    </Button>
                ) : null}
            </div>
        </SetupPage>
    );
}
