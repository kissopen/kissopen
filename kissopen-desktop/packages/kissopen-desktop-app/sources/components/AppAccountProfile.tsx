import { useSyncExternalStore } from "react";
import { KissopenAgentProfilePage, type KissopenAgentProfilePageProps } from "kissopen-desktop-ui";
import type { CommunityAccount } from "../auth/communityAccount";
import { useCommunityAccount } from "./AppCommunityAccountBoundary";

export function AppAccountProfile(props: KissopenAgentProfilePageProps) {
    const account = useCommunityAccount();
    return account ? (
        <AuthenticatedProfile profile={props} account={account} />
    ) : (
        <KissopenAgentProfilePage {...props} />
    );
}

function AuthenticatedProfile(props: {
    profile: KissopenAgentProfilePageProps;
    account: CommunityAccount;
}) {
    const security = props.account.security;
    const snapshot = useSyncExternalStore(security.subscribe, security.get, security.get);
    const profile = props.profile;
    return (
        <KissopenAgentProfilePage
            {...profile}
            onProfileSave={
                profile.onProfileSave
                    ? async (values) => {
                          await profile.onProfileSave?.(values);
                          await security.refresh();
                      }
                    : undefined
            }
            password={{
                enabled: snapshot.data?.passwordEnabled ?? null,
                factorRequired: snapshot.data?.totpEnabled ?? false,
                usernameReady: !!snapshot.data?.username,
                busy: snapshot.busy,
                error: snapshot.error,
                onSave: (values) =>
                    security.passwordSave(values.password, values.currentPassword, values.code),
                onCancel: security.cancel,
            }}
        />
    );
}
