import * as React from "react";
import { Text, View, Platform } from "react-native";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet } from "react-native-unistyles";
import {
    CommunityAuthClient,
    communityAuthorizationWait,
    type CommunitySecurity,
    type CommunityTotpSetup,
    type CommunityProvider,
} from "@kissopen/kissopen-sync/communityAuth";
import { getServerUrl } from "@/sync/serverConfig";
import { request } from "./platform/transport";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { RoundButton } from "@/components/RoundButton";
import { QRCode } from "@/components/qr";
import { Modal } from "@/modal";

export function AccountSecurityScreen() {
    const auth = React.useMemo(() => new CommunityAuthClient(getServerUrl()), []);
    const client = React.useMemo(
        () =>
            auth.security(async (path, body) => {
                const result = await request(path, body ? "POST" : "GET", body);
                const value = JSON.parse(result.text);
                if (result.status !== 200)
                    throw new Error(value.error || "Security service is unavailable.");
                return value;
            }),
        [auth],
    );
    const [data, setData] = React.useState<CommunitySecurity | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [setup, setSetup] = React.useState<CommunityTotpSetup>();
    const [codes, setCodes] = React.useState<readonly string[]>();
    const alive = React.useRef(true);
    const generation = React.useRef(0);
    const running = React.useRef(false);
    const proof = React.useRef<{ value: string; expires: number } | undefined>(undefined);
    const flow = React.useRef<AbortController | undefined>(undefined);
    useFocusEffect(
        React.useCallback(() => {
            alive.current = true;
            const epoch = ++generation.current;
            void client
                .read()
                .then((value) => {
                    if (alive.current && generation.current === epoch) setData(value);
                })
                .catch((e) => {
                    if (alive.current && generation.current === epoch) setError(e.message);
                });
            return () => {
                alive.current = false;
                ++generation.current;
                proof.current = undefined;
                flow.current?.abort();
                setSetup(undefined);
                setCodes(undefined);
            };
        }, [client]),
    );
    const run = async (action: (current: () => boolean) => Promise<void | false>, success = "") => {
        if (running.current) return;
        const epoch = generation.current;
        const current = () => alive.current && generation.current === epoch;
        running.current = true;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            if ((await action(current)) === false) return;
            if (!current()) return;
            const next = await client.read();
            if (current()) {
                setData(next);
                setMessage(success);
            }
        } catch (e) {
            if (current())
                setError(e instanceof Error ? e.message : "This change could not be saved.");
        } finally {
            running.current = false;
            if (alive.current) setBusy(false);
        }
    };
    const verified = async () => {
        const epoch = generation.current;
        const cached = proof.current;
        proof.current = undefined;
        if (cached && cached.expires > Date.now()) return cached.value;
        const password = data?.passwordEnabled
            ? await Modal.prompt("Verify identity", "Enter your current password.", {
                  inputType: "secure-text",
              })
            : undefined;
        if (password === null || !alive.current || generation.current !== epoch)
            throw new Error("Verification cancelled.");
        const code = data?.totpEnabled
            ? await Modal.prompt(
                  "Two-factor authentication",
                  "Enter a fresh authenticator or unused recovery code.",
                  { inputType: "secure-text" },
              )
            : undefined;
        if (code === null || !alive.current || generation.current !== epoch)
            throw new Error("Verification cancelled.");
        return client.verify(password, code);
    };
    const prompt = async (title: string, note: string, secure = false) => {
        const epoch = generation.current;
        const value = await Modal.prompt(title, note, {
            inputType: secure ? "secure-text" : "default",
        });
        return alive.current && generation.current === epoch ? value : null;
    };
    const oauth = async (provider: CommunityProvider, intent: "link" | "reauthenticate") => {
        if (running.current) return;
        const popup = Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
        if (Platform.OS === "web" && !popup) {
            setError("Allow pop-ups for KissOpen, then try again.");
            return;
        }
        if (popup) popup.opener = null;
        await run(
            async (current) => {
                const active = (flow.current = new AbortController());
                const login = await client.oauthStart(
                    provider,
                    intent,
                    intent === "link" ? await verified() : undefined,
                );
                let nativeOpened = false;
                try {
                    if (!current()) return false;
                    if (popup) popup.location.href = login.authorizationUrl;
                    else {
                        nativeOpened = true;
                        void WebBrowser.openBrowserAsync(login.authorizationUrl).catch(() =>
                            active.abort(),
                        );
                    }
                    while (!active.signal.aborted && Date.now() < Date.parse(login.expiresAt)) {
                        const status = await auth.status(login, active.signal);
                        if (!current()) return false;
                        if (status.status === "failed") throw new Error(status.message);
                        if (status.status === "linked") return;
                        if (status.status === "second_factor") {
                            if (nativeOpened && Platform.OS === "ios") {
                                WebBrowser.dismissBrowser();
                                nativeOpened = false;
                            }
                            const code = await prompt(
                                "Two-factor authentication",
                                "Enter a fresh authenticator or recovery code.",
                                true,
                            );
                            if (code === null) return false;
                            try {
                                await auth.factor(login, code, active.signal);
                            } catch (e) {
                                await Modal.alert(
                                    "Code not accepted",
                                    e instanceof Error ? e.message : "Try another code.",
                                );
                            }
                        } else if (status.status === "authorized") {
                            const value = await client.oauthComplete(login);
                            if (current())
                                proof.current = { value, expires: Date.now() + 5 * 60000 };
                            return;
                        }
                        await communityAuthorizationWait(1500, active.signal);
                    }
                    throw new Error("Authorization expired or cancelled. Please start again.");
                } finally {
                    void auth.cancel(login).catch(() => undefined);
                    if (nativeOpened && Platform.OS === "ios") WebBrowser.dismissBrowser();
                    popup?.close();
                    flow.current = undefined;
                }
            },
            intent === "link"
                ? "Provider linked to this account."
                : "Identity verified for one security change.",
        );
        popup?.close();
    };
    return (
        <>
            <Stack.Screen options={{ title: "Security" }} />
            <ItemList keyboardShouldPersistTaps="handled">
                {!!error && (
                    <ItemGroup>
                        <Item title="Security" subtitle={error} showChevron={false} />
                    </ItemGroup>
                )}
                {!!message && (
                    <ItemGroup>
                        <Item title={message} showChevron={false} />
                    </ItemGroup>
                )}
                {!data ? (
                    <ItemGroup>
                        <Item
                            title="Load account security"
                            loading={busy}
                            onPress={() => void run(async () => undefined)}
                        />
                    </ItemGroup>
                ) : (
                    <>
                        <ItemGroup title="Sign-in">
                            <Item
                                title="Username"
                                subtitle={
                                    data.username
                                        ? "@" + data.username
                                        : "Set a username before adding a password"
                                }
                                disabled={busy}
                                onPress={() =>
                                    void run(async () => {
                                        const username = await prompt(
                                            "Username",
                                            "3–20 letters, digits or underscores.",
                                        );
                                        if (username === null) return false;
                                        await client.username(
                                            await verified(),
                                            username.trim().toLowerCase(),
                                        );
                                    }, "Username saved.")
                                }
                            />
                            <Item
                                title={data.passwordEnabled ? "Change password" : "Set password"}
                                subtitle="12–128 characters. Other account sessions will be signed out."
                                disabled={busy || !data.username}
                                onPress={() =>
                                    void run(async () => {
                                        const password = await prompt(
                                            "New password",
                                            "Use a unique password of 12–128 characters.",
                                            true,
                                        );
                                        if (password === null) return false;
                                        const repeat = await prompt(
                                            "Repeat password",
                                            "Enter the same new password again.",
                                            true,
                                        );
                                        if (repeat === null) return false;
                                        if (
                                            password !== repeat ||
                                            password.length < 12 ||
                                            password.length > 128
                                        )
                                            throw new Error(
                                                "Passwords must match and contain 12–128 characters.",
                                            );
                                        await client.password(await verified(), password);
                                    }, "Password saved. Other account sessions signed out.")
                                }
                            />
                        </ItemGroup>
                        <ItemGroup
                            title="Two-factor authentication"
                            footer="Applies to password and all provider sign-ins. Keep recovery codes somewhere safe."
                        >
                            <Item
                                title={
                                    data.totpEnabled
                                        ? "Disable two-factor authentication"
                                        : "Set up authenticator"
                                }
                                subtitle={
                                    data.totpEnabled
                                        ? `${data.recoveryCodesRemaining} recovery codes remain`
                                        : "Six-digit authenticator codes"
                                }
                                disabled={busy}
                                onPress={() =>
                                    void run(async (current) => {
                                        if (data.totpEnabled) {
                                            await client.totpDisable(await verified());
                                            if (current()) {
                                                setSetup(undefined);
                                                setCodes(undefined);
                                            }
                                        } else {
                                            const next = await client.totpBegin(await verified());
                                            if (current()) setSetup(next);
                                        }
                                    })
                                }
                            />
                            {data.totpEnabled && (
                                <Item
                                    title="Replace recovery codes"
                                    subtitle="Your old codes will stop working"
                                    disabled={busy}
                                    onPress={() =>
                                        void run(async (current) => {
                                            const next = await client.recovery(await verified());
                                            if (current()) setCodes(next);
                                        })
                                    }
                                />
                            )}
                        </ItemGroup>
                        {setup && (
                            <ItemGroup title="Add to your authenticator">
                                <View style={styles.secret}>
                                    <QRCode data={setup.uri} size={192} />
                                </View>
                                <View style={styles.secret}>
                                    <Text selectable style={styles.text}>
                                        KissOpen · 6 digits · 30 seconds{"\n" + setup.secret}
                                    </Text>
                                </View>
                                <Item
                                    title="Verify and enable 2FA"
                                    disabled={busy}
                                    onPress={() =>
                                        void run(async (current) => {
                                            const code = await prompt(
                                                "Authenticator code",
                                                "Enter the six-digit code from your authenticator.",
                                            );
                                            if (code === null) return false;
                                            const next = await client.totpConfirm(
                                                setup.setupToken,
                                                code.trim(),
                                            );
                                            if (current()) {
                                                setSetup(undefined);
                                                setCodes(next);
                                            }
                                        }, "2FA enabled. Save your recovery codes.")
                                    }
                                />
                                <Item title="Cancel setup" onPress={() => setSetup(undefined)} />
                            </ItemGroup>
                        )}
                        {codes && (
                            <ItemGroup
                                title="Save recovery codes privately"
                                footer="Shown only once. Each works once. Do not share them."
                            >
                                <View style={styles.secret}>
                                    <Text selectable style={styles.text}>
                                        {codes.join("\n")}
                                    </Text>
                                </View>
                                <Item
                                    title="I saved these codes"
                                    onPress={() => setCodes(undefined)}
                                />
                            </ItemGroup>
                        )}
                        <ItemGroup
                            title="Third-party sign-in"
                            footer="Providers link to this same account. Email addresses never merge accounts."
                        >
                            {data.providers.map((item) => (
                                <React.Fragment key={item.provider}>
                                    <Item
                                        title={
                                            {
                                                github: "GitHub",
                                                google: "Google",
                                                nodeloc: "NodeLoc",
                                            }[item.provider]
                                        }
                                        subtitle={
                                            item.linked
                                                ? "Linked · tap to verify your identity"
                                                : item.configured
                                                  ? "Not linked · tap to link"
                                                  : "Not configured"
                                        }
                                        disabled={busy || !item.configured}
                                        onPress={() =>
                                            void oauth(
                                                item.provider,
                                                item.linked ? "reauthenticate" : "link",
                                            )
                                        }
                                    />
                                    {item.linked && (
                                        <Item
                                            title={`Unlink ${item.provider}`}
                                            disabled={
                                                busy ||
                                                (!data.providers.some(
                                                    (p) =>
                                                        p.linked &&
                                                        p.configured &&
                                                        p.provider !== item.provider,
                                                ) &&
                                                    !data.passwordEnabled)
                                            }
                                            onPress={() =>
                                                void run(async () => {
                                                    await client.oauthUnlink(
                                                        await verified(),
                                                        item.provider,
                                                    );
                                                }, "Provider unlinked.")
                                            }
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </ItemGroup>
                    </>
                )}
                {busy && (
                    <RoundButton
                        title="Cancel browser verification"
                        onPress={() => flow.current?.abort()}
                    />
                )}
            </ItemList>
        </>
    );
}
const styles = StyleSheet.create((theme) => ({
    secret: { padding: 16 },
    text: { color: theme.colors.text, fontSize: 16, lineHeight: 24 },
}));
