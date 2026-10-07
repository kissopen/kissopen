import { t } from "kissopen-desktop-state";
import { useState, type CSSProperties } from "react";
import type {
    KissopenAgentMenusSnapshot,
    KissopenAgentModelSelection,
    KissopenAgentPermissionMode,
    KissopenAgentServiceTier,
    KissopenAgentThinkingLevel,
} from "kissopen-desktop-state";
import { Icon } from "./Icon";
import { Menu, type MenuItem } from "./Menu";

/**
 * Separator between provider and model in a menu option id. A space is safe: it is
 * a valid DOM attribute/CSS-selector character (unlike U+0000, which browsers
 * mangle) and neither provider nor model identifiers contain spaces.
 */
const MODEL_ID_SEP = " ";
const SERVICE_TIER_OFF = "__kissopen_agent_service_tier_off__";

export type KissopenAgentControlMenuProps = {
    /**
     * Short field caption (e.g. "Model"). Omitted where the value already names
     * its own field — "Read only" needs no word in front of it — so the caption
     * is not spent repeating what the reader can see.
     */
    label?: string;
    /**
     * An image shown before the label — an installed application's own icon,
     * where the control stands for something that brings its own artwork.
     */
    leadingIconUrl?: string;
    /**
     * Current value shown on the trigger. A control with no value is an action
     * rather than a picker — its label alone names what the menu does — and the
     * trigger renders as one.
     */
    value?: string;
    items: MenuItem[];
    onSelect: (id: string) => void;
    /**
     * Splits the trigger in two: the labelled side performs this action outright
     * and only the chevron opens the menu. A control whose current value is the
     * answer nearly every time — "Open in", wearing the application it was last
     * handed to — should not charge a menu for repeating it.
     */
    onPrimary?: () => void;
    /**
     * Accessible name for the action side of a split trigger, which otherwise
     * reads only as its field caption ("Open in Zed", not "Open in").
     */
    primaryLabel?: string;
    menuWidth?: number;
    /** Direction the popover opens from its trigger. Defaults to below. */
    menuPlacement?: "above" | "below";
    /** Edge of the trigger the popover aligns to. Defaults to its start edge. */
    menuAlign?: "start" | "end";
    /**
     * How loudly the trigger sits on the surface. `outlined` is the chrome
     * control with a hairline and a fill. `ghost` is the quiet composer-footer
     * form: dimmed text with no box at all, which also opens on hover, because
     * a setting that faint has to be reachable without a deliberate click.
     */
    variant?: "outlined" | "ghost";
    disabled?: boolean;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

/**
 * KissopenAgentControlMenu — a labeled trigger that opens a `Menu` popover beneath it. The
 * open flag is the only local state; the popover closes on selection, outside
 * pointer-down, or Escape. Built directly on the shared `Menu` primitive so its
 * geometry, rows, and current-item check marks stay consistent with the system.
 */
export function KissopenAgentControlMenu(props: KissopenAgentControlMenuProps) {
    const [open, setOpen] = useState(false);
    const expanded = open && !props.disabled;
    const ghost = props.variant === "ghost";
    const split = props.onPrimary !== undefined;

    return (
        <div
            className={["kissopen-agent-control", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-control"
            data-open={expanded ? "" : undefined}
            data-split={split ? "" : undefined}
            data-testid={props["data-testid"]}
            data-variant={ghost ? "ghost" : undefined}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open) {
                    event.stopPropagation();
                    setOpen(false);
                }
            }}
            // A ghost control is quiet enough that pointing at it is the whole
            // gesture: the popover follows the pointer in and leaves with it.
            // The popover's own hover bridge keeps the 4px gap from closing it.
            onPointerEnter={ghost ? () => setOpen(true) : undefined}
            onPointerLeave={ghost ? () => setOpen(false) : undefined}
            style={props.style}
        >
            <button
                {...(split
                    ? {
                          ...(props.primaryLabel === undefined
                              ? {}
                              : { "aria-label": props.primaryLabel }),
                          onClick: props.onPrimary,
                      }
                    : {
                          "aria-expanded": expanded ? ("true" as const) : ("false" as const),
                          "aria-haspopup": "menu" as const,
                          onClick: () => setOpen((value) => !value),
                      })}
                className="kissopen-agent-control__trigger"
                data-kissopen-desktop-ui="kissopen-agent-control-trigger"
                disabled={props.disabled}
                type="button"
            >
                {props.leadingIconUrl === undefined ? null : (
                    <img
                        alt=""
                        className="kissopen-agent-control__leading"
                        data-kissopen-desktop-ui="kissopen-agent-control-leading"
                        src={props.leadingIconUrl}
                    />
                )}
                {props.label === undefined ? null : (
                    <span
                        className="kissopen-agent-control__label"
                        data-kissopen-desktop-ui="kissopen-agent-control-label"
                    >
                        {props.label}
                    </span>
                )}
                {props.value === undefined ? null : (
                    <span
                        className="kissopen-agent-control__value"
                        data-kissopen-desktop-ui="kissopen-agent-control-value"
                    >
                        {props.value}
                    </span>
                )}
                {split ? null : (
                    <span aria-hidden="true" className="kissopen-agent-control__chevron">
                        <Icon name="chevron-down" size={12} />
                    </span>
                )}
            </button>
            {/* The menu half of a split control: the same trigger box reduced to
                its chevron, sharing an edge with the action beside it so the two
                still read as one control. */}
            {split ? (
                <button
                    aria-expanded={expanded ? "true" : "false"}
                    aria-haspopup="menu"
                    aria-label={props.label === undefined ? "More options" : `${props.label}…`}
                    className="kissopen-agent-control__trigger kissopen-agent-control__trigger--menu"
                    data-kissopen-desktop-ui="kissopen-agent-control-menu-trigger"
                    disabled={props.disabled}
                    onClick={() => setOpen((value) => !value)}
                    type="button"
                >
                    <span aria-hidden="true" className="kissopen-agent-control__chevron">
                        <Icon name="chevron-down" size={12} />
                    </span>
                </button>
            ) : null}
            {expanded ? (
                <>
                    {/* Transparent full-window backdrop closes the popover on an
                        outside pointer-down without an imperative document listener. */}
                    <button
                        aria-hidden="true"
                        className="kissopen-agent-control__backdrop"
                        data-kissopen-desktop-ui="kissopen-agent-control-backdrop"
                        onClick={() => setOpen(false)}
                        tabIndex={-1}
                        type="button"
                    />
                    <div
                        className="kissopen-agent-control__popover"
                        data-kissopen-desktop-ui="kissopen-agent-control-popover"
                        data-align={props.menuAlign === "end" ? "end" : undefined}
                        data-placement={props.menuPlacement === "above" ? "above" : undefined}
                    >
                        <Menu
                            items={props.items}
                            onSelect={(id) => {
                                setOpen(false);
                                props.onSelect(id);
                            }}
                            width={props.menuWidth}
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}

/** One control in the session bar; `fields` selects which of them render. */
export type KissopenAgentSessionControlField = "model" | "effort" | "permission" | "tier";

const ALL_FIELDS: readonly KissopenAgentSessionControlField[] = [
    "model",
    "effort",
    "permission",
    "tier",
];

export type KissopenAgentSessionControlsProps = {
    /** Absent while a session is loading; controls remain mounted but inert. */
    menus?: KissopenAgentMenusSnapshot;
    /** Shows the current session configuration without allowing it to change. */
    disabled?: boolean;
    /**
     * Which controls to render, in this order. Defaults to all four. A surface
     * that has already placed the model picker elsewhere (the composer toolbar)
     * asks for only the controls it still owns, instead of rendering a second
     * copy of one it already shows.
     */
    fields?: readonly KissopenAgentSessionControlField[];
    /** Direction each selected control's menu opens. Defaults to below. */
    menuPlacement?: "above" | "below";
    /**
     * How loudly the controls sit on the surface. The composer footer asks for
     * `ghost`: these are settings you glance at, not chrome that competes with
     * the message you are writing.
     */
    variant?: "outlined" | "ghost";
    onModelChange: (selection: KissopenAgentModelSelection) => void;
    onEffortChange: (effort?: KissopenAgentThinkingLevel) => void;
    onPermissionModeChange: (mode: KissopenAgentPermissionMode) => void;
    onServiceTierChange: (tier?: KissopenAgentServiceTier) => void;
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
};

const PERMISSION_LABELS: Record<KissopenAgentPermissionMode, string> = {
    auto: "Auto",
    workspace_write: "Workspace write",
    read_only: "Read only",
    full_access: "Full access",
};

function currentModelName(menus: KissopenAgentMenusSnapshot): string {
    const current = menus.modelOptions.find((option) => option.current);
    return current?.name ?? menus.currentModelId;
}

function currentEffortLabel(menus: KissopenAgentMenusSnapshot): string {
    const current = menus.effortOptions.find((option) => option.current);
    return current?.label ?? menus.currentEffort ?? t("Default");
}

/**
 * KissopenAgentSessionControls — the model / effort / permission / service-tier control bar
 * for a Kissopen Agent session, driven entirely by a `KissopenAgentMenusSnapshot`. Each control is a
 * `KissopenAgentControlMenu` whose current option carries a check mark; selecting an option
 * calls the matching handler. Pure props + handlers, so the app layer supplies one
 * derived snapshot and the store mutation callbacks.
 */
export function KissopenAgentSessionControls(props: KissopenAgentSessionControlsProps) {
    const { menus } = props;

    const modelItems: MenuItem[] = (menus?.modelOptions ?? []).map((option) => ({
        kind: "item",
        id: `${option.providerId}${MODEL_ID_SEP}${option.modelId}`,
        label: option.name,
        disabled: option.disabled,
        icon: option.current ? "check" : undefined,
    }));

    const effortItems: MenuItem[] = (menus?.effortOptions ?? []).map((option) => ({
        kind: "item",
        id: option.level,
        label: option.isDefault ? t("{label} (default)", { label: option.label }) : option.label,
        icon: option.current ? "check" : undefined,
    }));

    const permissionItems: MenuItem[] = (menus?.permissionModeOptions ?? []).map((option) => ({
        kind: "item",
        id: option.mode,
        label: option.label,
        icon: option.current ? "check" : undefined,
    }));

    const serviceTierItems: MenuItem[] = (menus?.serviceTierOptions ?? []).map((option) => ({
        kind: "item",
        id: option.tier ?? SERVICE_TIER_OFF,
        label: option.label,
        icon: option.current ? "check" : undefined,
    }));

    const currentTierLabel =
        menus?.serviceTierOptions.find((option) => option.current)?.label ??
        (menus ? (menus.currentServiceTier ? t("Fast") : t("Regular")) : "…");

    const control = (field: KissopenAgentSessionControlField) => {
        if (field === "model")
            return (
                <KissopenAgentControlMenu
                    data-testid="kissopen-agent-control-model"
                    disabled={props.disabled || !menus}
                    items={modelItems}
                    key={field}
                    label={t("Model")}
                    menuPlacement={props.menuPlacement}
                    variant={props.variant}
                    menuWidth={240}
                    onSelect={(id) => {
                        const [providerId, modelId] = id.split(MODEL_ID_SEP);
                        if (modelId) props.onModelChange({ providerId, modelId });
                    }}
                    value={menus ? currentModelName(menus) : "…"}
                />
            );
        if (field === "effort")
            return (
                <KissopenAgentControlMenu
                    data-testid="kissopen-agent-control-effort"
                    disabled={props.disabled || !menus}
                    items={effortItems}
                    key={field}
                    label={t("Effort")}
                    menuPlacement={props.menuPlacement}
                    variant={props.variant}
                    onSelect={(id) => props.onEffortChange(id as KissopenAgentThinkingLevel)}
                    value={menus ? currentEffortLabel(menus) : "…"}
                />
            );
        if (field === "permission")
            return (
                <KissopenAgentControlMenu
                    data-testid="kissopen-agent-control-permission"
                    disabled={props.disabled || !menus}
                    items={permissionItems}
                    key={field}
                    menuPlacement={props.menuPlacement}
                    variant={props.variant}
                    menuWidth={200}
                    onSelect={(id) =>
                        props.onPermissionModeChange(id as KissopenAgentPermissionMode)
                    }
                    value={menus ? t(PERMISSION_LABELS[menus.currentPermissionMode]) : "…"}
                />
            );
        // Speed is a choice only where the provider actually offers a fast tier.
        // On a regular-only model the menu would hold one unchangeable row, so
        // the control is absent rather than shown as a decision nobody can make.
        if (serviceTierItems.length < 2) return null;
        return (
            <KissopenAgentControlMenu
                data-testid="kissopen-agent-control-tier"
                disabled={props.disabled || !menus}
                items={serviceTierItems}
                key={field}
                label={props.variant === "ghost" ? undefined : "Speed"}
                menuPlacement={props.menuPlacement}
                variant={props.variant}
                onSelect={(id) =>
                    props.onServiceTierChange(
                        id === SERVICE_TIER_OFF ? undefined : (id as KissopenAgentServiceTier),
                    )
                }
                value={currentTierLabel}
            />
        );
    };

    return (
        <div
            className={["kissopen-agent-controls", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-agent-session-controls"
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {(props.fields ?? ALL_FIELDS).map(control)}
        </div>
    );
}
