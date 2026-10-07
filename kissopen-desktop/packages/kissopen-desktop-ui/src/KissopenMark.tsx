import type { CSSProperties } from "react";
import {
    KISSOPEN_MARK_ASPECT,
    KISSOPEN_MARK_FRAME_RADIUS,
    KISSOPEN_MARK_FRAMED_VIEWBOX,
    KISSOPEN_MARK_VIEWBOX,
    KISSOPEN_MARK_LEFT,
    KISSOPEN_MARK_RIGHT,
    KISSOPEN_MARK_TILE_TRANSFORM,
    kissopenMarkTier,
} from "./kissopenMarkGeometry";
export interface KissopenMarkProps {
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly size: number;
    readonly framed?: boolean;
    readonly tone?: "default" | "sky";
    readonly label?: string;
}
/** Brand artwork is exempt from the UI icon-font rule. */
export function KissopenMark(props: KissopenMarkProps) {
    const framed = props.framed ?? false;
    return (
        <svg
            aria-hidden={props.label === undefined ? "true" : undefined}
            aria-label={props.label}
            className={["kissopen-mark", props.className].filter(Boolean).join(" ")}
            data-framed={framed ? "" : undefined}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"] ?? "kissopen-mark"}
            data-testid={props["data-testid"]}
            data-tier={kissopenMarkTier(props.size)}
            data-tone={props.tone ?? "default"}
            focusable="false"
            height={framed ? props.size : props.size * KISSOPEN_MARK_ASPECT}
            role={props.label === undefined ? undefined : "img"}
            style={props.style}
            viewBox={framed ? KISSOPEN_MARK_FRAMED_VIEWBOX : KISSOPEN_MARK_VIEWBOX}
            width={props.size}
        >
            {framed ? <KissopenMarkTile /> : null}
            <g
                transform={framed ? KISSOPEN_MARK_TILE_TRANSFORM : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
            >
                <path className="kissopen-mark__left" d={KISSOPEN_MARK_LEFT} />
                <path className="kissopen-mark__right" d={KISSOPEN_MARK_RIGHT} />
            </g>
        </svg>
    );
}
export function KissopenMarkTile(_props: { readonly id?: string } = {}) {
    return (
        <rect
            className="kissopen-mark__tile"
            width="512"
            height="512"
            rx={KISSOPEN_MARK_FRAME_RADIUS}
        />
    );
}
