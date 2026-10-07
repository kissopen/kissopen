import type { CSSProperties } from "react";
import { KissopenMark } from "./KissopenMark";
import { kissopenMarkTier } from "./kissopenMarkGeometry";
export type KissopenLoaderVariant = "breathe" | "relay";
export interface KissopenLoaderProps {
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly size?: number;
    readonly variant?: KissopenLoaderVariant;
    readonly framed?: boolean;
    readonly motion?: "auto" | "still";
    readonly label: string;
}
/** VI loop: ±2 units at 1.6s; compact/startup marks alternate opacity. */
export function KissopenLoader(props: KissopenLoaderProps) {
    const size = props.size ?? 56;
    return (
        <span
            aria-label={props.label}
            role="status"
            className={["kissopen-loader", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="kissopen-loader"
            data-testid={props["data-testid"]}
            data-tier={kissopenMarkTier(size)}
            data-motion={props.motion ?? "auto"}
            data-variant={props.variant ?? "breathe"}
            style={props.style}
        >
            <KissopenMark size={size} framed={props.framed} />
        </span>
    );
}
