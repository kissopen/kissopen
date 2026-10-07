import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
export type FormRowLayout = "inline" | "stacked";
export type FormRowAlign = "start" | "center";
export type FormRowProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    label: string;
    description?: string;
    htmlFor?: string;
    control: ReactNode;
    layout?: FormRowLayout;
    align?: FormRowAlign;
};
/**
 * C-029 FormRow — a settings row. A left-aligned label + optional muted
 * description on the leading side and a trailing control slot (a TextField,
 * Select, Switch, Button, …). `inline` places the control to the right of the
 * text; `stacked` places it on its own line below the text. A hairline bottom
 * divider lets rows stack into a settings list without extra chrome.
 */
export function FormRow(props: FormRowProps) {
    const [local, rest] = partitionComponentProps(props, [
        "align",
        "className",
        "control",
        "description",
        "htmlFor",
        "label",
        "layout",
        "style",
    ]);
    const layout = () => local.layout ?? "inline";
    const align = () => local.align ?? "center";
    return (
        <div
            {...rest}
            className={["kissopen-form-row", local.className].filter(Boolean).join(" ")}
            data-align={align()}
            data-layout={layout()}
            data-kissopen-desktop-ui="form-row"
            style={local.style}
        >
            <div className="kissopen-form-row__text" data-kissopen-desktop-ui="form-row-text">
                <label
                    className="kissopen-form-row__label"
                    data-kissopen-desktop-ui="form-row-label"
                    htmlFor={local.htmlFor}
                >
                    {local.label}
                </label>
                {local.description ? (
                    <span
                        className="kissopen-form-row__description"
                        data-kissopen-desktop-ui="form-row-description"
                    >
                        {local.description}
                    </span>
                ) : null}
            </div>
            <div className="kissopen-form-row__control" data-kissopen-desktop-ui="form-row-control">
                {local.control}
            </div>
        </div>
    );
}
