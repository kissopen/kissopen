import { t } from "kissopen-desktop-state";
import { SegmentedProgress, type SegmentedProgressSegment } from "./SegmentedProgress";

export type OnboardingStage = "setup" | "assistants" | "profile" | "mobile";
export type MobileOnboardingStage = "get-app" | "connect" | "complete";

export type OnboardingStepsProps =
    | {
          readonly scope: "desktop";
          readonly stage: OnboardingStage;
          /** Present only after the user opts into mobile setup. */
          readonly mobile?: MobileOnboardingStage;
          readonly failed?: boolean;
      }
    | {
          readonly scope: "mobile";
          readonly stage: MobileOnboardingStage;
          readonly failed?: boolean;
      };

const desktopStages = [
    { id: "setup", label: t("Setup") },
    { id: "assistants", label: t("Assistants") },
    { id: "profile", label: t("Profile") },
    { id: "mobile", label: t("Mobile · optional") },
] as const;
const mobileStages = [
    { id: "get-app", label: t("Get app") },
    { id: "connect", label: t("Connect phone") },
] as const;

function segments(
    stages: readonly { readonly id: string; readonly label: string }[],
    current: string,
    complete: boolean,
    failed: boolean,
): readonly SegmentedProgressSegment[] {
    const currentIndex = stages.findIndex((stage) => stage.id === current);
    return stages.map((stage, index) => ({
        ...stage,
        state:
            complete || index < currentIndex
                ? "done"
                : index > currentIndex
                  ? "pending"
                  : failed
                    ? "failed"
                    : "running",
    }));
}

/** Stable overall stages; optional detail appears only inside an opted-in branch. */
export function OnboardingSteps(props: OnboardingStepsProps) {
    const mobile = props.scope === "desktop" ? props.mobile : props.stage;
    const complete = mobile === "complete";
    const primary =
        props.scope === "desktop"
            ? segments(desktopStages, props.stage, complete, props.failed === true)
            : segments(mobileStages, props.stage, complete, props.failed === true);
    const done = primary.filter((stage) => stage.state === "done").length;
    return (
        <div className="kissopen-onboarding-steps" data-kissopen-desktop-ui="onboarding-steps">
            <div
                className="kissopen-onboarding-steps__summary"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <span>{t("{done} of {total} complete", { done, total: primary.length })}</span>
                <span>{t("{count} remaining", { count: primary.length - done })}</span>
            </div>
            <SegmentedProgress
                label={props.scope === "desktop" ? t("Onboarding stages") : t("Mobile setup steps")}
                mode="steps"
                tone="inverse"
                segments={primary}
            />
            {props.scope === "desktop" && mobile ? (
                <div className="kissopen-onboarding-steps__branch">
                    <span
                        className="kissopen-onboarding-steps__branch-label"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {t("Mobile · {status}", {
                            status: complete
                                ? t("Complete")
                                : t("Step {step} of {total}", {
                                      step: mobile === "get-app" ? 1 : 2,
                                      total: 2,
                                  }),
                        })}
                    </span>
                    <SegmentedProgress
                        label={t("Mobile setup steps")}
                        mode="steps"
                        tone="inverse"
                        segments={segments(mobileStages, mobile, complete, props.failed === true)}
                    />
                </div>
            ) : null}
        </div>
    );
}
