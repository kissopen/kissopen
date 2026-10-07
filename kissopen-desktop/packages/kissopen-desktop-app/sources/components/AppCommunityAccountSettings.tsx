import { useSyncExternalStore } from "react";
import { CommunityAccountSettings } from "kissopen-desktop-ui";
import type { CommunityAccount } from "../auth/communityAccount";

export function AppCommunityAccountSettings({ account }: { account: CommunityAccount }) {
    const snapshot = useSyncExternalStore(account.subscribe, account.get, account.get);
    return (
        <CommunityAccountSettings
            {...snapshot}
            onSignIn={(provider) => void account.signIn(provider)}
            onCancel={account.signInCancel}
            onSignOut={() => void account.signOut()}
        />
    );
}
