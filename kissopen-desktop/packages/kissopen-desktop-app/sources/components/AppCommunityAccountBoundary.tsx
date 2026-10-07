import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { CommunityLoginScreen } from "kissopen-desktop-ui";
import type { CommunityAccount } from "../auth/communityAccount";

const CommunityAccountContext = createContext<CommunityAccount | undefined>(undefined);
export function useCommunityAccount() {
    return useContext(CommunityAccountContext);
}

/** Retains the account subscription across login, workspace and sign-out. */
export function AppCommunityAccountBoundary(props: {
    readonly account: CommunityAccount;
    readonly children: ReactNode;
}) {
    const snapshot = useSyncExternalStore(
        props.account.subscribe,
        props.account.get,
        props.account.get,
    );
    return snapshot.profile ? (
        <AccountLifetime key={snapshot.profile.id}>
            <CommunityAccountContext.Provider value={props.account}>
                {props.children}
            </CommunityAccountContext.Provider>
        </AccountLifetime>
    ) : (
        <CommunityLoginScreen
            providers={snapshot.providers}
            status={snapshot.status}
            error={snapshot.error}
            onSignIn={(provider) => void props.account.signIn(provider)}
            onCancel={props.account.signInCancel}
            needsFactor={snapshot.needsFactor}
            onPasswordSignIn={(username, password) =>
                void props.account.signInPassword(username, password)
            }
            onFactor={(code) => void props.account.signInFactor(code)}
        />
    );
}

function AccountLifetime(props: { readonly children: ReactNode }) {
    return props.children;
}
