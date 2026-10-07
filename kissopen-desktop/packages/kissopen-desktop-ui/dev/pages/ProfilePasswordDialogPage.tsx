import { ProfilePasswordDialog } from "../../src/ProfilePasswordDialog";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "C-705";
export function ProfilePasswordDialogPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Profile password dialog"
            summary="Set a first password or change it with the current password, without leaving Profile."
        >
            {[
                {
                    label: "Set password",
                    hasPassword: false,
                    factorRequired: false,
                    usernameReady: true,
                },
                {
                    label: "Change password",
                    hasPassword: true,
                    factorRequired: false,
                    usernameReady: true,
                },
                {
                    label: "Password and MFA",
                    hasPassword: true,
                    factorRequired: true,
                    usernameReady: true,
                },
                {
                    label: "Username required",
                    hasPassword: false,
                    factorRequired: false,
                    usernameReady: false,
                },
            ].map((item) => (
                <Specimen
                    key={item.label}
                    number={item.label}
                    label={item.label}
                    stage="surface"
                    detail="480px form · current password required only for changes"
                >
                    <ProfilePasswordDialog {...item} onSave={async () => {}} onCancel={() => {}} />
                </Specimen>
            ))}
        </ComponentPage>
    );
}
