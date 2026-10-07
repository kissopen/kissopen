import { useState } from "react";
import { t } from "kissopen-desktop-state";
import type {
    CommunitySecurity,
    CommunityTotpSetup,
    CommunityProvider,
} from "kissopen-desktop-state";
import { Banner } from "../../Banner";
import { Button } from "../../Button";
import { TextField } from "../../TextField";
import { FormRow } from "../../FormRow";
import { QRCode } from "../../QRCode";
import { AccountSecurityChangeDialog } from "../../AccountSecurityChangeDialog";
import { ModalOverlay } from "../../ModalOverlay";
import { KissopenAgentSettingsSection } from "./KissopenAgentSettingsShell";

export interface AccountSecuritySettingsProps {
    readonly data: CommunitySecurity | null;
    readonly busy: boolean;
    readonly confirmation?: { readonly title: string; readonly factorRequired: boolean };
    readonly confirming: boolean;
    readonly needsFactor: boolean;
    readonly error?: string;
    readonly message?: string;
    readonly setup?: CommunityTotpSetup;
    readonly codes?: readonly string[];
    onConfirmChange(password: string, code: string): void;
    onBegin(): void;
    onConfirm(code: string): void;
    onDisable(): void;
    onRecovery(): void;
    onHideSecrets(): void;
    onLink(provider: CommunityProvider): void;
    onUnlink(provider: CommunityProvider): void;
    onFactor(code: string): void;
    onCancel(): void;
}

export function AccountSecuritySettings(props: AccountSecuritySettingsProps) {
    const [code, setCode] = useState("");
    const [factor, setFactor] = useState("");
    const data = props.data;
    return (
        <KissopenAgentSettingsSection>
            <div className="kissopen-account-security">
                {props.error && !props.confirmation ? (
                    <Banner tone="warning" title={t("Security")}>
                        {t(props.error)}
                    </Banner>
                ) : null}
                {props.message ? (
                    <div role="status" className="kissopen-account-security__note">
                        {t(props.message)}
                    </div>
                ) : null}
                {!data ? (
                    <div role="status">{t("Loading account security…")}</div>
                ) : (
                    <>
                        <FormRow
                            label={t("Two-factor authentication")}
                            description={
                                data.totpEnabled
                                    ? t(
                                          "Enabled for all sign-in methods. {count} recovery codes remain.",
                                          { count: data.recoveryCodesRemaining },
                                      )
                                    : t(
                                          "Use an authenticator app for both password and provider sign-in.",
                                      )
                            }
                            control={
                                data.totpEnabled ? (
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={props.busy}
                                        onClick={props.onDisable}
                                    >
                                        {t("Disable 2FA")}
                                    </Button>
                                ) : (
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={props.busy}
                                        onClick={props.onBegin}
                                    >
                                        {t("Set up 2FA")}
                                    </Button>
                                )
                            }
                        />
                        {props.setup ? (
                            <div className="kissopen-account-security__secret">
                                <p>
                                    {t(
                                        "Add this key to your authenticator app (KissOpen, six digits, 30 seconds). Setup expires in ten minutes.",
                                    )}
                                </p>
                                <QRCode
                                    data={props.setup.uri}
                                    label={t("Scan with your authenticator app")}
                                    size={192}
                                />
                                <code aria-label={t("Authenticator setup key")}>
                                    {props.setup.secret}
                                </code>
                                <form
                                    className="kissopen-account-security__form"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        props.onConfirm(code);
                                        setCode("");
                                    }}
                                >
                                    <TextField
                                        fullWidth
                                        label={t("Six-digit code")}
                                        autoComplete="one-time-code"
                                        value={code}
                                        onValueChange={setCode}
                                        required
                                    />
                                    <Button
                                        type="submit"
                                        disabled={props.busy || !/^\d{6}$/.test(code)}
                                    >
                                        {t("Enable 2FA")}
                                    </Button>
                                    <Button variant="ghost" onClick={props.onHideSecrets}>
                                        {t("Cancel setup")}
                                    </Button>
                                </form>
                            </div>
                        ) : null}
                        {data.totpEnabled ? (
                            <FormRow
                                label={t("Recovery codes")}
                                description={t(
                                    "Each code works once. Replacing codes immediately invalidates the previous set.",
                                )}
                                control={
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={props.busy}
                                        onClick={props.onRecovery}
                                    >
                                        {t("Replace recovery codes")}
                                    </Button>
                                }
                            />
                        ) : null}
                        {props.codes ? (
                            <div className="kissopen-account-security__secret">
                                <p>
                                    {t(
                                        "Save these codes privately. They are shown only once. Do not share them.",
                                    )}
                                </p>
                                <pre aria-label={t("Single-use recovery codes")}>
                                    {props.codes.join("\n")}
                                </pre>
                                <Button variant="secondary" onClick={props.onHideSecrets}>
                                    {t("I saved these codes")}
                                </Button>
                            </div>
                        ) : null}
                        <FormRow
                            control={undefined}
                            label={t("Third-party sign-in")}
                            description={t(
                                "Link providers to this same account. Accounts are never merged by email.",
                            )}
                        />
                        {data.providers.map((item) => (
                            <FormRow
                                key={item.provider}
                                label={
                                    { github: "GitHub", google: "Google", nodeloc: "NodeLoc" }[
                                        item.provider
                                    ]
                                }
                                description={
                                    item.linked
                                        ? t("Linked to this account")
                                        : item.configured
                                          ? t("Not linked")
                                          : t("Not configured by the server administrator")
                                }
                                control={
                                    <div className="kissopen-account-security__actions">
                                        {item.linked ? (
                                            <>
                                                <Button
                                                    size="small"
                                                    variant="ghost"
                                                    disabled={
                                                        props.busy ||
                                                        (!data.providers.some(
                                                            (p) =>
                                                                p.linked &&
                                                                p.configured &&
                                                                p.provider !== item.provider,
                                                        ) &&
                                                            !data.passwordEnabled)
                                                    }
                                                    onClick={() => props.onUnlink(item.provider)}
                                                >
                                                    {t("Unlink")}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="secondary"
                                                disabled={props.busy || !item.configured}
                                                onClick={() => props.onLink(item.provider)}
                                            >
                                                {t("Link")}
                                            </Button>
                                        )}
                                    </div>
                                }
                            />
                        ))}
                    </>
                )}
                {props.needsFactor ? (
                    <form
                        className="kissopen-account-security__form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            props.onFactor(factor);
                            setFactor("");
                        }}
                    >
                        <TextField
                            fullWidth
                            label={t("Authenticator or recovery code")}
                            autoComplete="one-time-code"
                            value={factor}
                            onValueChange={setFactor}
                            required
                        />
                        <Button type="submit" disabled={!factor.trim()}>
                            {t("Verify code")}
                        </Button>
                    </form>
                ) : null}
                {props.busy && !props.confirmation ? (
                    <Button variant="ghost" onClick={props.onCancel}>
                        {t("Cancel browser verification")}
                    </Button>
                ) : null}
            </div>
            {props.confirmation ? (
                <ModalOverlay onDismiss={props.confirming ? undefined : props.onCancel}>
                    <AccountSecurityChangeDialog
                        {...props.confirmation}
                        confirming={props.confirming}
                        error={props.error}
                        onConfirm={props.onConfirmChange}
                        onCancel={props.onCancel}
                    />
                </ModalOverlay>
            ) : null}
        </KissopenAgentSettingsSection>
    );
}
