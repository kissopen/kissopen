import { useSyncExternalStore } from "react";
import { AccountSecuritySettings } from "kissopen-desktop-ui";
import type { CommunityAccount } from "../auth/communityAccount";

export function AppAccountSecuritySettings(props: { readonly account: CommunityAccount }) {
    const security = props.account.security;
    const snapshot = useSyncExternalStore(security.subscribe, security.get, security.get);
    return (
        <AccountSecuritySettings
            {...snapshot}
            onConfirmChange={(password, code) => void security.confirmChange(password, code)}
            onBegin={() => void security.totpBegin()}
            onConfirm={(code) => void security.totpConfirm(code)}
            onDisable={() => void security.totpDisable()}
            onRecovery={() => void security.recovery()}
            onHideSecrets={security.hideSecrets}
            onLink={(provider) => void security.oauth(provider)}
            onUnlink={(provider) => void security.unlink(provider)}
            onFactor={(code) => void security.factor(code)}
            onCancel={security.cancel}
        />
    );
}
