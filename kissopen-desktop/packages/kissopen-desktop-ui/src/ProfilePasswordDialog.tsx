import { useId, useState } from "react";
import { t } from "kissopen-desktop-state";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { TextField } from "./TextField";

export type ProfilePasswordValues = { password: string; currentPassword?: string; code?: string };
export interface ProfilePasswordDialogProps {
    readonly hasPassword: boolean;
    readonly factorRequired: boolean;
    readonly usernameReady: boolean;
    onSave(values: ProfilePasswordValues): Promise<void>;
    onCancel(): void;
}

/** C-705: profile password editor. Passwords stay inside the local form and
 * the ephemeral auth boundary; rejected submissions keep the dialog open. */
export function ProfilePasswordDialog(props: ProfilePasswordDialogProps) {
    const formId = useId();
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [repeat, setRepeat] = useState("");
    const [code, setCode] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();
    const currentError =
        props.hasPassword && !currentPassword ? t("Enter your current password.") : undefined;
    const passwordError = !password
        ? t("Enter a new password.")
        : password.length < 12 || password.length > 128
          ? t("Your password must be 12–128 characters long.")
          : undefined;
    const repeatError = !repeat
        ? t("Repeat your new password to continue.")
        : password !== repeat
          ? t("The two passwords do not match.")
          : undefined;
    const factorError =
        props.factorRequired && !code.trim()
            ? t("Enter an authenticator or recovery code.")
            : undefined;
    const title = props.hasPassword ? t("Change password") : t("Set password");
    return (
        <Modal
            className="kissopen-profile-password"
            title={title}
            size="medium"
            closeLabel={t("Cancel")}
            onClose={props.onCancel}
            footer={
                <>
                    <Button variant="ghost" onClick={props.onCancel}>
                        {t("Cancel")}
                    </Button>
                    <Button type="submit" form={formId} loading={saving} disabled={saving}>
                        {t("Save")}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                className="kissopen-account-security__form"
                noValidate
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (saving) return;
                    setSubmitted(true);
                    setError(undefined);
                    if (
                        !props.usernameReady ||
                        currentError ||
                        passwordError ||
                        repeatError ||
                        factorError
                    )
                        return;
                    setSaving(true);
                    try {
                        await props.onSave({
                            password,
                            ...(props.hasPassword ? { currentPassword } : {}),
                            ...(props.factorRequired ? { code: code.trim() } : {}),
                        });
                        setCurrentPassword("");
                        setPassword("");
                        setRepeat("");
                        setCode("");
                    } catch (failure) {
                        setError(
                            failure instanceof Error
                                ? t(failure.message)
                                : t("This change could not be saved. Please try again."),
                        );
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                {!props.usernameReady ? (
                    <Banner tone="warning">
                        {t("Set your sign-in username in Profile before adding a password.")}
                    </Banner>
                ) : null}
                {error ? <Banner tone="warning">{error}</Banner> : null}
                {props.hasPassword ? (
                    <TextField
                        fullWidth
                        label={t("Current password")}
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onValueChange={setCurrentPassword}
                        error={submitted ? currentError : undefined}
                        required
                        disabled={saving}
                    />
                ) : null}
                <TextField
                    fullWidth
                    label={t("New password")}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onValueChange={setPassword}
                    hint={t("12–128 characters. Use a unique password.")}
                    error={submitted ? passwordError : undefined}
                    required
                    disabled={saving}
                />
                <TextField
                    fullWidth
                    label={t("Repeat new password")}
                    type="password"
                    autoComplete="new-password"
                    value={repeat}
                    onValueChange={setRepeat}
                    error={submitted ? repeatError : undefined}
                    required
                    disabled={saving}
                />
                {props.factorRequired ? (
                    <TextField
                        fullWidth
                        label={t("Authenticator or recovery code")}
                        autoComplete="one-time-code"
                        value={code}
                        onValueChange={setCode}
                        error={submitted ? factorError : undefined}
                        required
                        disabled={saving}
                    />
                ) : null}
                <p className="kissopen-account-security__note">
                    {props.hasPassword
                        ? t(
                              "Password sign-in is enabled. Changing it signs out your other account sessions.",
                          )
                        : t(
                              "Complete authorization with your linked provider to set your first password.",
                          )}
                </p>
            </form>
        </Modal>
    );
}
