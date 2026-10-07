import { type ReactNode, type CSSProperties } from "react";
import { Spinner, type SpinnerTone, type SpinnerVariant } from "./Spinner";

export type LoadingSwapProps = {
    /** Rendered in place of the spinner when `loading` is false — usually an icon. */
    children?: ReactNode;
    className?: string;
    /** Accessible name for the spinner while it is showing. */
    label?: string;
    loading: boolean;
    /** Edge of the square both states are laid out in. */
    size?: number;
    tone?: SpinnerTone;
    variant?: SpinnerVariant;
};

/**
 * LoadingSwap — one fixed square that cross-fades between a Spinner and its
 * resting content. Both layers stay mounted and stacked, so the swap is a CSS
 * opacity transition in each direction with no layout shift.
 *
 * A component that mounts already loading shows the spinner immediately: a CSS
 * transition has no previous computed value to run from on the first render, so
 * the instant-on-mount behaviour falls out of the transition itself rather than
 * needing a mounted flag. Every later change of `loading` fades.
 */
export function LoadingSwap(props: LoadingSwapProps) {
    const size = props.size ?? 20;
    return (
        <span
            className={["kissopen-loading-swap", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="loading-swap"
            data-loading={props.loading ? "" : undefined}
            style={{ "--kissopen-loading-swap-size": `${size}px` } as CSSProperties}
        >
            <span
                aria-hidden={props.loading ? undefined : "true"}
                className="kissopen-loading-swap__layer"
                data-kissopen-desktop-ui="loading-swap-spinner"
                data-layer="spinner"
            >
                <Spinner
                    label={props.label}
                    size={size}
                    tone={props.tone}
                    variant={props.variant}
                />
            </span>
            <span
                aria-hidden={props.loading ? "true" : undefined}
                className="kissopen-loading-swap__layer"
                data-kissopen-desktop-ui="loading-swap-content"
                data-layer="content"
            >
                {props.children}
            </span>
        </span>
    );
}
