import { partitionComponentProps } from "./componentProps";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Icon } from "./Icon";
export type CheckboxProps = {
    "aria-describedby"?: string;
    "aria-label"?: string;
    checked: boolean;
    className?: string;
    "data-testid"?: string;
    disabled?: boolean;
    id?: string;
    indeterminate?: boolean;
    label?: string;
    name?: string;
    onChange?: (checked: boolean) => void;
    style?: CSSProperties;
};
/**
 * C-021 Checkbox — an 18px control box with a reused Icon check glyph (checked)
 * or a symmetric bar (indeterminate). The real state lives on a visually hidden
 * native <input type="checkbox"> so keyboard, focus, and screen-reader semantics
 * come for free; the painted box and glyph are prop-driven. Compose it inside
 * FormRow/DataTable/Menu wherever a boolean toggle is needed.
 */
export function Checkbox(props: CheckboxProps) {
    const [local] = partitionComponentProps(props, [
        "aria-describedby",
        "aria-label",
        "checked",
        "className",
        "data-testid",
        "disabled",
        "id",
        "indeterminate",
        "label",
        "name",
        "onChange",
        "style",
    ]);
    const control = useRef<HTMLInputElement>(null);
    // indeterminate is a DOM property, not an attribute — mirror the prop onto
    // the live input so assistive tech announces the mixed state.
    // eslint-disable-next-line kissopen-react/no-layout-effect -- HTML exposes the mixed checkbox state only through the live input.indeterminate DOM property, so it must be synchronized after commit
    useLayoutEffect(() => {
        if (control.current) control.current.indeterminate = local.indeterminate ?? false;
    }, [local.indeterminate]);
    const state = () =>
        local.indeterminate ? "indeterminate" : local.checked ? "checked" : "unchecked";
    return (
        <label
            className={["kissopen-checkbox", local.className].filter(Boolean).join(" ")}
            data-checked={local.checked ? "" : undefined}
            data-disabled={local.disabled ? "" : undefined}
            data-indeterminate={local.indeterminate ? "" : undefined}
            data-kissopen-desktop-ui="checkbox"
            data-state={state()}
            data-testid={local["data-testid"]}
            style={local.style}
        >
            <input
                aria-describedby={local["aria-describedby"]}
                aria-label={local["aria-label"]}
                checked={local.checked}
                className="kissopen-checkbox__control"
                data-kissopen-desktop-ui="checkbox-control"
                disabled={local.disabled}
                id={local.id}
                name={local.name}
                onChange={(event) => local.onChange?.(event.currentTarget.checked)}
                ref={control}
                type="checkbox"
            />
            <span className="kissopen-checkbox__box" data-kissopen-desktop-ui="checkbox-box">
                {local.indeterminate ? (
                    <span
                        className="kissopen-checkbox__dash"
                        data-kissopen-desktop-ui="checkbox-mark"
                    />
                ) : local.checked ? (
                    <Icon name="check" size={14} />
                ) : null}
            </span>
            {local.label !== undefined ? (
                <span
                    className="kissopen-checkbox__label"
                    data-kissopen-desktop-ui="checkbox-label"
                >
                    {local.label}
                </span>
            ) : null}
        </label>
    );
}
