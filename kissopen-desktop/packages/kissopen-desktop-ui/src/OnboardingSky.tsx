import type { ThemeMode } from "./ThemeScope";

interface OnboardingSkyProps {
    readonly appearance: ThemeMode;
    readonly className?: string;
}

/**
 * The shared backdrop behind first-run onboarding and the product's own status
 * pages: a colour gradient, deeper in the dark appearance.
 *
 * It is one decorative object — every screen that carries it gets the same
 * treatment, while the words in front of it remain the screen's own concern,
 * drawn in the light ink this backdrop is chosen to carry.
 */
export function OnboardingSky(props: OnboardingSkyProps) {
    return (
        <div
            aria-hidden="true"
            className={["kissopen-onboarding-sky", props.className].filter(Boolean).join(" ")}
            data-appearance={props.appearance}
            data-kissopen-desktop-ui="onboarding-sky"
        >
            <span className="kissopen-onboarding-sky__glow" />
        </div>
    );
}
