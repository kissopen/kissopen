import { t } from "kissopen-desktop-state";
import { SetupPage } from "./SetupPage";
import { SplashScreen } from "./SplashScreen";

export type DesktopStartupPhase = "choosing" | "starting" | "error";
export interface DesktopStartupValues {
    mode: "local";
}
export interface DesktopStartupUpdate {
    availableVersion?: string;
    message?: string;
    status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
}
export interface DesktopStartupScreenProps {
    error?: string;
    message?: string;
    onChange(values: DesktopStartupValues): void;
    onInstallUpdate?(): void;
    onRetry?(): void;
    onSubmit(): void;
    phase: DesktopStartupPhase;
    update?: DesktopStartupUpdate;
    values: DesktopStartupValues;
}

/**
 * The window before anything is running: a wait, a start button, or a failure.
 *
 * Waiting is the mark and nothing else. It is the shortest-lived screen in the
 * product — a few frames on a machine whose Kissopen Agent is already up — and a headline
 * on it announces itself for exactly long enough to be read as a flash. It is
 * also the same mark the boot gate holds afterwards and then dissolves, so a
 * normal start is one continuous mark from the first frame to the mounted app
 * rather than a headline appearing between two other screens.
 *
 * A choice and a failure are screens someone reads and acts on, so those stay
 * the same centred page as the rest of setup.
 */
export function DesktopStartupScreen(props: DesktopStartupScreenProps) {
    if (props.phase === "error")
        return (
            <SetupPage
                {...(props.onRetry
                    ? { action: { label: t("Try again"), onSelect: props.onRetry } }
                    : {})}
                copy={props.error ?? t("KissOpen could not start.")}
                data-testid="desktop-startup-screen"
                figure="secretary"
                title={t("KissOpen couldn't start")}
            />
        );

    if (props.phase === "starting")
        return (
            // No note: `message` narrates a step that normally passes in a few
            // frames, and a line appearing under a mark that is about to leave
            // is the flicker this screen exists to avoid.
            <SplashScreen data-testid="desktop-startup-screen" />
        );

    return (
        <SetupPage
            action={{ label: t("Start locally"), onSelect: props.onSubmit }}
            copy="KissOpen runs on this machine, and can connect to others you own."
            data-testid="desktop-startup-screen"
            scene="sparkles"
            title={t("KissOpen runs on this machine")}
        />
    );
}
