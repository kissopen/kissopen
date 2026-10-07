import { t } from "kissopen-desktop-state";
import { AccountSecurityChangeDialog } from "../../src/AccountSecurityChangeDialog";
import { ComponentPage, Specimen } from "../kit";

export const componentNumber = "C-704";
const noop = () => undefined;

export function AccountSecurityChangeDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Security change confirmation"
            summary="An operation-scoped password confirmation, not a separate verification setting."
        >
            {(
                [
                    {
                        id: "password",
                        label: "Password change",
                        factorRequired: false,
                        confirming: false,
                    },
                    {
                        id: "factor",
                        label: "Password and authenticator",
                        factorRequired: true,
                        confirming: false,
                    },
                    {
                        id: "error",
                        label: "Retry after an incorrect password",
                        factorRequired: true,
                        confirming: false,
                        error: "Current password is incorrect. / 当前密码不正确。",
                    },
                    { id: "pending", label: "Submitting", factorRequired: true, confirming: true },
                ] as const
            ).map((item) => (
                <Specimen
                    key={item.id}
                    number={item.id}
                    label={item.label}
                    stage="surface"
                    detail="480px modal · credentials remain in the form"
                >
                    <AccountSecurityChangeDialog
                        {...item}
                        title={t("Confirm password change")}
                        onConfirm={noop}
                        onCancel={noop}
                    />
                </Specimen>
            ))}
        </ComponentPage>
    );
}
