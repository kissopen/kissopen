import type { CSSProperties } from "react";
import { KissopenMark } from "./KissopenMark";
export interface KissopenThinkingMarkProps {
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly size: number;
    readonly motion?: "auto" | "still";
    readonly phase?: number;
}
export function KissopenThinkingMark(props: KissopenThinkingMarkProps) {
    return (
        <span
            aria-hidden="true"
            className={["kissopen-thinking-mark", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"] ?? "kissopen-thinking-mark"}
            data-testid={props["data-testid"]}
            data-motion={props.motion ?? "auto"}
            style={props.style}
        >
            <KissopenMark size={props.size} />
        </span>
    );
}
