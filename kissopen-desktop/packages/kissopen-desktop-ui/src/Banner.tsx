import { t } from "kissopen-desktop-state";
import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
export type BannerTone = "info" | "success" | "warning" | "danger" | "neutral";
export type BannerAction = {
    label: string;
    onClick: () => void;
};
export type BannerProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    tone: BannerTone;
    title?: string;
    children: ReactNode;
    icon?: IconName;
    action?: BannerAction;
    onDismiss?: () => void;
};
/**
 * C-023 Banner — inline alert. A soft tone-tinted fill, a matching hairline
 * border, and a tone-colored leading icon carry the semantic (info / success /
 * warning / danger / neutral). Icon, text block, optional action Button, and a
 * dismiss control share one vertically centered row (MUI-style: the icon rides
 * the center of the whole text block, so a two-line title+message stays
 * balanced). Props-only, desktop-only.
 */
export function Banner(props: BannerProps) {
    const [local] = partitionComponentProps(props, [
        "className",
        "data-testid",
        "style",
        "tone",
        "title",
        "children",
        "icon",
        "action",
        "onDismiss",
    ]);
    const hasActions = () => Boolean(local.action || local.onDismiss);
    // Danger interrupts assistive tech; the softer tones announce politely.
    const role = () => (local.tone === "danger" ? "alert" : "status");
    return (
        <div
            className={["kissopen-banner", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="banner"
            data-testid={local["data-testid"]}
            data-tone={local.tone}
            role={role()}
            style={local.style}
        >
            {local.icon
                ? ((name) => (
                      <span
                          className="kissopen-banner__icon"
                          data-kissopen-desktop-ui="banner-icon"
                      >
                          <Icon name={name} size={16} />
                      </span>
                  ))(local.icon)
                : null}
            <div className="kissopen-banner__content" data-kissopen-desktop-ui="banner-content">
                {local.title ? (
                    <span
                        className="kissopen-banner__title"
                        data-kissopen-desktop-ui="banner-title"
                    >
                        {local.title}
                    </span>
                ) : null}
                <span
                    className="kissopen-banner__message"
                    data-kissopen-desktop-ui="banner-message"
                >
                    {local.children}
                </span>
            </div>
            {hasActions() ? (
                <div className="kissopen-banner__actions" data-kissopen-desktop-ui="banner-actions">
                    {local.action
                        ? ((action) => (
                              <Button
                                  className="kissopen-banner__action"
                                  onClick={() => action.onClick()}
                                  size="small"
                                  variant="secondary"
                              >
                                  {action.label}
                              </Button>
                          ))(local.action)
                        : null}
                    {local.onDismiss ? (
                        <button
                            aria-label={t("Dismiss")}
                            className="kissopen-banner__dismiss"
                            data-kissopen-desktop-ui="banner-dismiss"
                            onClick={() => local.onDismiss?.()}
                            type="button"
                        >
                            <Icon name="close" size={14} />
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
