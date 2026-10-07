import { type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface KissopenPageHeadingProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly title: string;
    readonly icon?: IconName;
    /**
     * The short line above the title — "KISSOPEN · 让工作按时发生". Given, the
     * heading is a destination's own, drawn like 计划任务's: tagline, title and
     * description, no mark, on the library's width.
     */
    readonly eyebrow?: string;
    readonly description?: ReactNode;
    readonly actions?: ReactNode;
}

/** Shared page heading: generous title and supporting copy, with actions to the right. */
export function KissopenPageHeading(props: KissopenPageHeadingProps) {
    return (
        <header
            className={["kissopen-page-heading", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="page-heading"
            data-variant={props.eyebrow === undefined ? undefined : "library"}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            <div className="kissopen-page-heading__band">
                {props.icon === undefined ? null : (
                    <span className="kissopen-page-heading__icon">
                        <Icon name={props.icon} size={24} />
                    </span>
                )}
                <div className="kissopen-page-heading__copy">
                    {props.eyebrow === undefined ? null : (
                        <span className="kissopen-page-heading__eyebrow">{props.eyebrow}</span>
                    )}
                    <h1 className="kissopen-page-heading__title">{props.title}</h1>
                    {props.description === undefined ? null : (
                        <span className="kissopen-page-heading__description">
                            {props.description}
                        </span>
                    )}
                </div>
            </div>
            {props.actions}
        </header>
    );
}
