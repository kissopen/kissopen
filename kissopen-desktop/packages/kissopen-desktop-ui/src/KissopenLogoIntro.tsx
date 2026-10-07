import { useState, type CSSProperties } from "react";
import { KissopenMark } from "./KissopenMark";
export interface KissopenLogoIntroProps {
    readonly className?: string;
    readonly "data-kissopen-desktop-ui"?: string;
    readonly "data-testid"?: string;
    readonly style?: CSSProperties;
    readonly size: number;
    readonly label?: string;
    readonly motion?: "auto" | "still";
    readonly clock?: "page" | "mount";
}
let pageIntroStartedAt: number | undefined;
function pageIntroElapsedMs() {
    const now = performance.now();
    pageIntroStartedAt ??= now;
    return now - pageIntroStartedAt;
}
/** One relay cycle, then the unchanged mark. No glow or completion flash. */
export function KissopenLogoIntro(props: KissopenLogoIntroProps) {
    const [elapsedMs] = useState(() => (props.clock === "mount" ? 0 : pageIntroElapsedMs()));
    return (
        <KissopenMark
            size={props.size}
            label={props.label}
            className={["kissopen-logo-intro", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui={props["data-kissopen-desktop-ui"] ?? "kissopen-logo-intro"}
            data-testid={props["data-testid"]}
            style={
                {
                    ...props.style,
                    "--kissopen-intro-delay": `-${Math.round(elapsedMs)}ms`,
                    "--kissopen-intro-play": props.motion === "still" ? "none" : undefined,
                } as CSSProperties
            }
        />
    );
}
