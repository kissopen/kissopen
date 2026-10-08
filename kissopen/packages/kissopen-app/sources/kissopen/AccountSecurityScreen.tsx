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
import { t } from "@/text";

const PROVIDER_NAMES: Record<CommunityProvider, string> = {
    github: "GitHub",
    google: "Google",
    nodeloc: "NodeLoc",
};

export function AccountSecurityScreen() {
    const auth = React.useMemo(() => new CommunityAuthClient(getServerUrl()), []);
    const client = React.useMemo(
        () =>
            auth.security(async (path, body) => {
                const result = await request(path, body ? "POST" : "GET", body);
                const value = JSON.parse(result.text);
                if (result.status !== 200)
                    throw new Error(value.error || t('kissopen.security.serviceUnavailable'));
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
                setError(e instanceof Error ? e.message : t('kissopen.security.saveFailed'));
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
            ? await Modal.prompt(t('kissopen.security.verifyIdentityTitle'), t('kissopen.security.verifyIdentityMessage'), {
                  inputType: "secure-text",
              })
            : undefined;
        if (password === null || !alive.current || generation.current !== epoch)
            throw new Error(t('kissopen.security.verificationCancelled'));
        const code = data?.totpEnabled
            ? await Modal.prompt(
                  t('kissopen.security.twoFactorTitle'),
                  t('kissopen.security.twoFactorFreshCode'),
                  { inputType: "secure-text" },
              )
            : undefined;
        if (code === null || !alive.current || generation.current !== epoch)
            throw new Error(t('kissopen.security.verificationCancelled'));
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
            setError(t('kissopen.security.allowPopups'));
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
                                t('kissopen.security.twoFactorTitle'),
                                t('kissopen.security.twoFactorFreshOrRecovery'),
                                true,
                            );
                            if (code === null) return false;
                            try {
                                await auth.factor(login, code, active.signal);
                            } catch (e) {
                                await Modal.alert(
                                    t('kissopen.security.codeNotAccepted'),
                                    e instanceof Error ? e.message : t('kissopen.security.tryAnotherCode'),
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
                    throw new Error(t('kissopen.security.authorizationExpired'));
                } finally {
                    void auth.cancel(login).catch(() => undefined);
                    if (nativeOpened && Platform.OS === "ios") WebBrowser.dismissBrowser();
                    popup?.close();
                    flow.current = undefined;
                }
            },
            intent === "link"
                ? t('kissopen.security.providerLinked')
                : t('kissopen.security.identityVerified'),
        );
        popup?.close();
    };
    return (
        <>
            <Stack.Screen options={{ title: t('kissopen.security.title') }} />
            <ItemList keyboardShouldPersistTaps="handled">
                {!!error && (
                    <ItemGroup>
                        <Item title={t('kissopen.security.title')} subtitle={error} showChevron={false} />
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
                            title={t('kissopen.security.loadSecurity')}
                            loading={busy}
                            onPress={() => void run(async () => undefined)}
                        />
                    </ItemGroup>
                ) : (
                    <>
                        <ItemGroup title={t('kissopen.security.signInGroup')}>
                            <Item
                                title={t('kissopen.security.username')}
                                subtitle={
                                    data.username
                                        ? "@" + data.username
                                        : t('kissopen.security.usernameMissing')
                                }
                                disabled={busy}
                                onPress={() =>
                                    void run(async () => {
                                        const username = await prompt(
                                            t('kissopen.security.username'),
                                            t('kissopen.security.usernameRule'),
                                        );
                                        if (username === null) return false;
                                        await client.username(
                                            await verified(),
                                            username.trim().toLowerCase(),
                                        );
                                    }, t('kissopen.security.usernameSaved'))
                                }
                            />
                            <Item
                                title={data.passwordEnabled ? t('kissopen.security.changePassword') : t('kissopen.security.setPassword')}
                                subtitle={t('kissopen.security.passwordSubtitle')}
                                disabled={busy || !data.username}
                                onPress={() =>
                                    void run(async () => {
                                        const password = await prompt(
                                            t('kissopen.security.newPassword'),
                                            t('kissopen.security.newPasswordHint'),
                                            true,
                                        );
                                        if (password === null) return false;
                                        const repeat = await prompt(
                                            t('kissopen.security.repeatPassword'),
                                            t('kissopen.security.repeatPasswordHint'),
                                            true,
                                        );
                                        if (repeat === null) return false;
                                        if (
                                            password !== repeat ||
                                            password.length < 12 ||
                                            password.length > 128
                                        )
                                            throw new Error(
                                                t('kissopen.security.passwordInvalid'),
                                            );
                                        await client.password(await verified(), password);
                                    }, t('kissopen.security.passwordSaved'))
                                }
                            />
                        </ItemGroup>
                        <ItemGroup
                            title={t('kissopen.security.twoFactorTitle')}
                            footer={t('kissopen.security.twoFactorFooter')}
                        >
                            <Item
                                title={
                                    data.totpEnabled
                                        ? t('kissopen.security.disableTwoFactor')
                                        : t('kissopen.security.setUpAuthenticator')
                                }
                                subtitle={
                                    data.totpEnabled
                                        ? t('kissopen.security.recoveryCodesRemaining', { count: data.recoveryCodesRemaining })
                                        : t('kissopen.security.sixDigitCodes')
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
                                    title={t('kissopen.security.replaceRecoveryCodes')}
                                    subtitle={t('kissopen.security.oldCodesStopWorking')}
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
                            <ItemGroup title={t('kissopen.security.addToAuthenticator')}>
                                <View style={styles.secret}>
                                    <QRCode data={setup.uri} size={192} />
                                </View>
                                <View style={styles.secret}>
                                    <Text selectable style={styles.text}>
                                        {t('kissopen.security.authenticatorDetails') + "\n" + setup.secret}
                                    </Text>
                                </View>
                                <Item
                                    title={t('kissopen.security.verifyAndEnable')}
                                    disabled={busy}
                                    onPress={() =>
                                        void run(async (current) => {
                                            const code = await prompt(
                                                t('kissopen.security.authenticatorCode'),
                                                t('kissopen.security.authenticatorCodeHint'),
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
                                        }, t('kissopen.security.twoFactorEnabled'))
                                    }
                                />
                                <Item title={t('kissopen.security.cancelSetup')} onPress={() => setSetup(undefined)} />
                            </ItemGroup>
                        )}
                        {codes && (
                            <ItemGroup
                                title={t('kissopen.security.saveRecoveryCodes')}
                                footer={t('kissopen.security.recoveryCodesFooter')}
                            >
                                <View style={styles.secret}>
                                    <Text selectable style={styles.text}>
                                        {codes.join("\n")}
                                    </Text>
                                </View>
                                <Item
                                    title={t('kissopen.security.savedCodes')}
                                    onPress={() => setCodes(undefined)}
                                />
                            </ItemGroup>
                        )}
                        <ItemGroup
                            title={t('kissopen.security.thirdPartyTitle')}
                            footer={t('kissopen.security.thirdPartyFooter')}
                        >
                            {data.providers.map((item) => (
                                <React.Fragment key={item.provider}>
                                    <Item
                                        title={PROVIDER_NAMES[item.provider]}
                                        subtitle={
                                            item.linked
                                                ? t('kissopen.security.providerLinkedStatus')
                                                : item.configured
                                                  ? t('kissopen.security.providerNotLinked')
                                                  : t('kissopen.security.providerNotConfigured')
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
                                            title={t('kissopen.security.unlinkProvider', { provider: PROVIDER_NAMES[item.provider] })}
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
                                                }, t('kissopen.security.providerUnlinked'))
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
                        title={t('kissopen.security.cancelBrowserVerification')}
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
