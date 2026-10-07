import { t } from "kissopen-desktop-state";
import { Badge, type BadgeVariant } from "./Badge";
import { Icon, type IconName } from "./Icon";
export type SetupOptionStatus = {
    readonly label: string;
    readonly variant: BadgeVariant;
    readonly icon?: IconName;
};
export type SetupOptionHintTone = "muted" | "warning" | "danger";
export type SetupOptionCardProps = {
    className?: string;
    "data-testid"?: string;
    icon?: IconName;
    title: string;
    description?: string;
    status?: SetupOptionStatus;
    meta?: string;
    hint?: string;
    hintTone?: SetupOptionHintTone;
    selected?: boolean;
    recommended?: boolean;
    disabled?: boolean;
    pending?: boolean;
    onSelect?: () => void;
};
/*
 * Full-width selectable onboarding option. The whole card is a real
 * <button type="button">, so selection is entirely props-driven; the component
 * holds no internal state. Disabled and pending both block the native control.
 */
export function SetupOptionCard(props: SetupOptionCardProps) {
    const hintTone = () => props.hintTone ?? "muted";
    const isDisabled = () => props.disabled === true;
    const isPending = () => props.pending === true;
    // A title-only card is a single-line body: the icon chip and the title row
    // share one horizontal line, so it centers instead of top-aligning. Any
    // secondary body line (description, meta, or hint) makes the body taller
    // than the icon, so the card keeps the icon pinned to the title at the top.
    const isCompact = () => !props.description && !props.meta && !props.hint;
    return (
        <button
            className={["kissopen-setup-option", props.className].filter(Boolean).join(" ")}
            data-compact={isCompact() ? "" : undefined}
            data-disabled={isDisabled() ? "" : undefined}
            data-kissopen-desktop-ui="setup-option"
            data-pending={isPending() ? "" : undefined}
            data-recommended={props.recommended ? "" : undefined}
            data-selected={props.selected ? "" : undefined}
            data-testid={props["data-testid"]}
            disabled={isDisabled() || isPending()}
            onClick={() => props.onSelect?.()}
            type="button"
        >
            {props.icon
                ? ((name) => (
                      <span
                          className="kissopen-setup-option__icon"
                          data-kissopen-desktop-ui="setup-option-icon"
                      >
                          <Icon name={name} size={18} />
                      </span>
                  ))(props.icon)
                : null}
            <span
                className="kissopen-setup-option__body"
                data-kissopen-desktop-ui="setup-option-body"
            >
                <span
                    className="kissopen-setup-option__title-row"
                    data-kissopen-desktop-ui="setup-option-title-row"
                >
                    <span
                        className="kissopen-setup-option__title"
                        data-kissopen-desktop-ui="setup-option-title"
                    >
                        {props.title}
                    </span>
                    {props.recommended ? (
                        <span
                            className="kissopen-setup-option__recommended"
                            data-kissopen-desktop-ui="setup-option-recommended"
                        >
                            {t("Recommended")}
                        </span>
                    ) : null}
                    {props.status
                        ? ((status) => (
                              <span
                                  className="kissopen-setup-option__status"
                                  data-kissopen-desktop-ui="setup-option-status"
                              >
                                  <Badge
                                      icon={status.icon}
                                      label={status.label}
                                      variant={status.variant}
                                  />
                              </span>
                          ))(props.status)
                        : null}
                </span>
                {props.description
                    ? ((description) => (
                          <span
                              className="kissopen-setup-option__description"
                              data-kissopen-desktop-ui="setup-option-description"
                          >
                              {description}
                          </span>
                      ))(props.description)
                    : null}
                {props.meta
                    ? ((meta) => (
                          <span
                              className="kissopen-setup-option__meta"
                              data-kissopen-desktop-ui="setup-option-meta"
                          >
                              {meta}
                          </span>
                      ))(props.meta)
                    : null}
                {props.hint
                    ? ((hint) => (
                          <span
                              className="kissopen-setup-option__hint"
                              data-kissopen-desktop-ui="setup-option-hint"
                              data-tone={hintTone()}
                          >
                              {hint}
                          </span>
                      ))(props.hint)
                    : null}
            </span>
            <span
                className="kissopen-setup-option__trailing"
                data-kissopen-desktop-ui="setup-option-trailing"
            >
                {isPending() ? (
                    <span
                        className="kissopen-setup-option__spinner"
                        data-kissopen-desktop-ui="setup-option-spinner"
                    />
                ) : props.selected ? (
                    <span
                        className="kissopen-setup-option__check"
                        data-kissopen-desktop-ui="setup-option-check"
                    >
                        <Icon name="check-circle" size={20} />
                    </span>
                ) : null}
            </span>
        </button>
    );
}
