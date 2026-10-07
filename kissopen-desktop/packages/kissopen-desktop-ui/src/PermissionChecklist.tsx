import { partitionComponentProps } from "./componentProps";
import { useId, type CSSProperties } from "react";
import { Checkbox } from "./Checkbox";
export type PermissionChecklistOption = {
    id: string;
    /** Short human name of the capability, e.g. "Write files". */
    label: string;
    /** One-line explanation of what the capability allows. */
    description?: string;
};
export type PermissionChecklistProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    options: readonly PermissionChecklistOption[];
    /** Ids of the currently allowed options. */
    selected: readonly string[];
    onToggle?: (id: string, checked: boolean) => void;
    disabled?: boolean;
};
/**
 * C-067 PermissionChecklist — a closed allow-list editor: one 18px Checkbox per
 * capability with its name and a muted one-line description. Fully controlled —
 * the selection and every toggle flow through props, so the same checklist edits
 * a role's grants, a member's direct grants, or renders read-only when disabled.
 * Rows keep stable DOM identity per option id so focus survives store updates.
 */
export function PermissionChecklist(props: PermissionChecklistProps) {
    const [local, rest] = partitionComponentProps(props, [
        "className",
        "style",
        "options",
        "selected",
        "onToggle",
        "disabled",
    ]);
    const prefix = useId();
    const checked = (id: string) => local.selected.includes(id);
    return (
        <div
            {...rest}
            className={["kissopen-permission-checklist", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="permission-checklist"
            style={local.style}
        >
            {local.options.map((option) => (
                <div
                    className="kissopen-permission-checklist__row"
                    data-checked={checked(option.id) ? "" : undefined}
                    data-kissopen-desktop-ui="permission-row"
                    data-permission-id={option.id}
                    key={option.id}
                >
                    <Checkbox
                        aria-label={option.label}
                        checked={checked(option.id)}
                        className="kissopen-permission-checklist__checkbox"
                        disabled={local.disabled}
                        id={`${prefix}-${option.id}`}
                        onChange={(value) => local.onToggle?.(option.id, value)}
                    />
                    <label
                        className="kissopen-permission-checklist__text"
                        data-kissopen-desktop-ui="permission-text"
                        htmlFor={`${prefix}-${option.id}`}
                    >
                        <span
                            className="kissopen-permission-checklist__label"
                            data-kissopen-desktop-ui="permission-label"
                        >
                            {option.label}
                        </span>
                        {option.description ? (
                            <span
                                className="kissopen-permission-checklist__description"
                                data-kissopen-desktop-ui="permission-description"
                            >
                                {option.description}
                            </span>
                        ) : null}
                    </label>
                </div>
            ))}
        </div>
    );
}
