import { AccountSecuritySettings } from "../../src/pages/settings/AccountSecuritySettings";
import { ComponentPage, Specimen } from "../kit";
export const componentNumber = "C-703";
const noop = () => undefined;
export function AccountSecuritySettingsPage() {
    return (
        <ComponentPage
            number={componentNumber}
            title="Account security"
            summary="Authenticator and linked providers share the same immutable account. Passwords and usernames are edited in Profile."
        >
            {([false, true] as const).map((enabled) => (
                <Specimen
                    key={String(enabled)}
                    number={enabled ? "02" : "01"}
                    label={enabled ? "Password and MFA enabled" : "Provider-only account"}
                    stage="surface"
                    detail="Fresh verification, protected mutations, last-method protection"
                >
                    <div style={{ display: "flex", flexDirection: "column", width: 720 }}>
                        <AccountSecuritySettings
                            data={{
                                username: enabled ? "kissopen_user" : null,
                                passwordEnabled: enabled,
                                totpEnabled: enabled,
                                recoveryCodesRemaining: enabled ? 10 : 0,
                                providers: [
                                    { provider: "nodeloc", configured: true, linked: true },
                                    { provider: "github", configured: true, linked: false },
                                    { provider: "google", configured: false, linked: false },
                                ],
                            }}
                            busy={false}
                            confirming={false}
                            needsFactor={false}
                            onConfirmChange={noop}
                            onBegin={noop}
                            onConfirm={noop}
                            onDisable={noop}
                            onRecovery={noop}
                            onHideSecrets={noop}
                            onLink={noop}
                            onUnlink={noop}
                            onFactor={noop}
                            onCancel={noop}
                        />
                    </div>
                </Specimen>
            ))}
        </ComponentPage>
    );
}
