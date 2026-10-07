import { useId, useState } from "react";
import { t } from "kissopen-desktop-state";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { TextField } from "./TextField";

export interface AccountSecurityChangeDialogProps {
    readonly title: string;
    readonly factorRequired: boolean;
    readonly confirming: boolean;
    readonly error?: string;
    onConfirm(password: string, code: string): void;
    onCancel(): void;
}

/** C-704: confirmation belongs to the specific change, never a prerequisite
 * settings mode. Credentials are local form state, cleared on submit/unmount. */
export function AccountSecurityChangeDialog(props: AccountSecurityChangeDialogProps) {
    const formId = useId();
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    return (
        <Modal
            title={props.title}
            size="medium"
            closeLabel={t("Cancel")}
            onClose={props.confirming ? undefined : props.onCancel}
            footer={
                <>
                    <Button variant="ghost" disabled={props.confirming} onClick={props.onCancel}>
                        {t("Cancel")}
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        loading={props.confirming}
                        disabled={props.confirming}
                    >
                        {t("Confirm")}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                className="kissopen-account-security__form"
                onSubmit={(event) => {
                    event.preventDefault();
                    props.onConfirm(password, code);
                    setPassword("");
                    setCode("");
                }}
            >
                <p className="kissopen-account-security__note">
                    {t("Enter your current password to complete this security change.")}
                </p>
                {props.error ? <Banner tone="warning">{t(props.error)}</Banner> : null}
                <TextField
                    fullWidth
                    label={t("Current password")}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onValueChange={setPassword}
                    required
                    disabled={props.confirming}
                />
                {props.factorRequired ? (
                    <TextField
                        fullWidth
                        label={t("Authenticator or recovery code")}
                        autoComplete="one-time-code"
                        value={code}
                        onValueChange={setCode}
                        required
                        disabled={props.confirming}
                    />
                ) : null}
            </form>
        </Modal>
    );
}
