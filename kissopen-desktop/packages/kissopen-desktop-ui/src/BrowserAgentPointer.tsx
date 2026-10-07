import { t } from "kissopen-desktop-state";
import { Ionicon } from "./vectorIcons/VectorIcon";

/** Transient feedback from an actual guest action; no page content or input values. */
export interface BrowserPointerActivity {
    readonly operationId: string;
    readonly action: "click" | "fill" | "scroll";
    readonly phase: "start" | "end";
    /** Coordinates normalized to the browser guest's viewport, independent of DPI. */
    readonly x: number;
    readonly y: number;
}

/** A visual pointer over the guest. It never receives input or modifies the page. */
export function BrowserAgentPointer({
    activity,
    animated = true,
}: {
    activity: BrowserPointerActivity;
    animated?: boolean;
}) {
    if (!Number.isFinite(activity.x) || !Number.isFinite(activity.y)) return null;
    return (
        <div
            className="kissopen-browser-agent-pointer"
            data-kissopen-desktop-ui="browser-agent-pointer"
            data-static={animated ? undefined : ""}
            data-edge-x={activity.x > 0.7 ? "left" : undefined}
            data-edge-y={activity.y > 0.8 ? "above" : undefined}
            style={{
                left: `${Math.max(0, Math.min(1, activity.x)) * 100}%`,
                top: `${Math.max(0, Math.min(1, activity.y)) * 100}%`,
            }}
        >
            <div
                key={activity.operationId}
                className="kissopen-browser-agent-pointer__activity"
                data-phase={activity.phase}
            >
                <span className="kissopen-browser-agent-pointer__ring" aria-hidden="true" />
                <Ionicon
                    className="kissopen-browser-agent-pointer__arrow"
                    name="navigate"
                    size={24}
                />
                <span className="kissopen-browser-agent-pointer__label" role="status">
                    {activity.phase === "end"
                        ? t("AI")
                        : activity.action === "click"
                          ? t("AI · Click")
                          : activity.action === "fill"
                            ? t("AI · Type")
                            : t("AI · Scroll")}
                </span>
            </div>
        </div>
    );
}
