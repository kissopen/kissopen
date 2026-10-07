import { t } from "kissopen-desktop-state";
import { useSyncExternalStore, type ReactNode } from "react";
import type {
    AppearanceStore,
    KissopenAgentOnboardingStore,
    KissopenAgentProfileStore,
    WelcomeStore,
} from "kissopen-desktop-state";
import {
    LocalOnboardingScreen,
    WelcomeScreen,
    type LocalOnboardingView,
} from "kissopen-desktop-ui";
import { kissopenAgentWelcomeSlides } from "../onboarding/kissopenAgentWelcomeSlides";

export function KissopenAgentOnboardingBoundary(props: {
    readonly store: KissopenAgentOnboardingStore;
    readonly welcome: WelcomeStore;
    readonly appearance: AppearanceStore;
    readonly profile: KissopenAgentProfileStore;
    readonly online: boolean;
    readonly onRetry: () => void;
    readonly children: ReactNode;
}) {
    const snapshot = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const welcome = useSyncExternalStore(
        props.welcome.subscribe,
        props.welcome.get,
        props.welcome.get,
    );
    const appearance = useSyncExternalStore(
        props.appearance.subscribe,
        props.appearance.get,
        props.appearance.get,
    );
    const profile = useSyncExternalStore(
        props.profile.subscribe,
        props.profile.get,
        props.profile.get,
    );
    const mobile = useSyncExternalStore(
        props.store.mobile.subscribe,
        props.store.mobile.get,
        props.store.mobile.get,
    );
    const profileAvailable = props.online || snapshot.available === true;
    // A provider that can answer is the only thing this window truly needs. The
    // steps behind it — a git identity, a first project, a paired phone — each
    // have a home in settings, and holding the first screen for them turns a
    // signed-in account into a four-page form. The marker the agent keeps is
    // still written once it settles, so `completed` remains the durable record;
    // this only decides what the reader is made to look at first.
    if (!snapshot.state || snapshot.state.completed || snapshot.state.steps.providers.done)
        return props.children;
    if (!welcome.welcomeAcknowledged)
        return (
            <WelcomeScreen
                appearance={appearance.mode}
                backdrop={{ kind: "sky" }}
                onAction={() => {
                    props.welcome.welcomeAcknowledge();
                    props.store.onboardingBegin();
                }}
                onAppearanceChange={props.appearance.appearanceSelect}
                slides={kissopenAgentWelcomeSlides}
            />
        );
    const view = ((): LocalOnboardingView => {
        if (!snapshot.state.steps.profile.done)
            return {
                kind: "profile-required",
                busy: profile.loading || profile.saving || !profileAvailable,
                name: profile.name,
                email: profile.email,
                ...(profile.saveError || snapshot.error
                    ? { message: profile.saveError ?? snapshot.error }
                    : {}),
            };
        switch (mobile.status) {
            case "desktop":
                return { kind: "kissopen-mobile-desktop", step: mobile.step };
            case "checking":
                return { kind: "kissopen-mobile-checking" };
            case "offer":
                return {
                    kind: "kissopen-mobile-offer",
                    busy: mobile.pending || !props.online,
                    ...(mobile.message ? { message: mobile.message } : {}),
                };
            case "pairing":
                return {
                    kind: "kissopen-mobile-pairing",
                    data: mobile.data,
                    expiresAt: mobile.expiresAt,
                };
            case "failed":
                return {
                    kind: "kissopen-mobile-failed",
                    busy: mobile.pending || !props.online,
                    message: mobile.message,
                };
            case "configured":
            case "disabled":
            case "skipped":
                return { kind: "checking", message: snapshot.error ?? t("Finishing setup…") };
        }
    })();
    return (
        <LocalOnboardingScreen
            appearance={appearance.mode}
            view={view}
            onAssistantsContinue={() => undefined}
            onConnectRetry={props.onRetry}
            onKissopenMobileConnect={props.store.mobile.kissopenMobileConnect}
            onKissopenMobileSkip={props.store.mobile.kissopenMobileSkip}
            onKissopenMobilePlatformSelect={props.store.mobile.kissopenMobilePlatformSelect}
            onProfileNameChange={props.profile.displayNameUpdate}
            onProfileEmailChange={props.profile.emailUpdate}
            onProfileCreate={() => {
                if (
                    profileAvailable &&
                    !profile.loading &&
                    profile.name.trim() &&
                    profile.email.trim()
                )
                    void props.profile.profileSave().catch(() => undefined);
            }}
            onProjectChoose={() => undefined}
        />
    );
}
