import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type CompactActivityRowProps = {
    readonly icon: IconName;
    readonly verb: string;
    readonly arguments: readonly ReactNode[];
    readonly meta: readonly ReactNode[];
    readonly accessibleLabel: string;
    readonly preparing?: boolean;
    readonly preparingLabel?: string;
    /** Freezes the preparing spinner for deterministic fixtures. */
    readonly spinnerFrame?: number;
    readonly trailing?: ReactNode;
    readonly onClick?: () => void;
    readonly placement?: "transcript" | "panel";
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
};

/**
 * The compact two-line activity grammar shared by Agent rows and the activity
 * monitor. Product-specific rows provide only their verb, arguments, and facts.
 */
export function CompactActivityRow(props: CompactActivityRowProps) {
    const className = ["kissopen-delegated-agent", props.className].filter(Boolean).join(" ");
    const rowContent = (
        <>
            <span
                aria-hidden="true"
                className="kissopen-delegated-agent__glyph"
                data-kissopen-desktop-ui="compact-activity-glyph"
            >
                {props.preparing ? (
                    <Spinner
                        frame={props.spinnerFrame}
                        label={props.preparingLabel ?? `${props.verb} is preparing`}
                        size={12}
                        tone="muted"
                        variant="circle"
                    />
                ) : (
                    <Icon name={props.icon} size={12} />
                )}
            </span>
            <span className="kissopen-delegated-agent__content">
                <span className="kissopen-delegated-agent__primary">
                    <span className="kissopen-delegated-agent__verb">{props.verb}</span>
                    <span className="kissopen-delegated-agent__arguments">
                        {props.arguments.map((argument, index) => (
                            <Fragment key={index}>
                                {index > 0 ? <span aria-hidden="true">·</span> : null}
                                <span className="kissopen-delegated-agent__argument">
                                    {argument}
                                </span>
                            </Fragment>
                        ))}
                    </span>
                </span>
                <span className="kissopen-delegated-agent__meta">
                    {props.meta.map((fact, index) => (
                        <Fragment key={index}>
                            {index > 0 ? <span aria-hidden="true">·</span> : null}
                            <span>{fact}</span>
                        </Fragment>
                    ))}
                </span>
            </span>
        </>
    );
    return (
        <div
            className={className}
            data-kissopen-desktop-ui="compact-activity-row"
            data-placement={props.placement ?? "transcript"}
            data-testid={props["data-testid"]}
            style={props.style}
        >
            {props.onClick ? (
                <button
                    aria-label={props.accessibleLabel}
                    className="kissopen-delegated-agent__row"
                    data-interactive=""
                    onClick={props.onClick}
                    type="button"
                >
                    {rowContent}
                </button>
            ) : (
                <div
                    aria-label={props.accessibleLabel}
                    className="kissopen-delegated-agent__row"
                    role="group"
                >
                    {rowContent}
                </div>
            )}
            {props.trailing ? (
                <span className="kissopen-delegated-agent__trailing">{props.trailing}</span>
            ) : null}
        </div>
    );
}
