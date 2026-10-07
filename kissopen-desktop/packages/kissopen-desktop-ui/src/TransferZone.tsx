import { partitionComponentProps } from "./componentProps";
import { type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { TRANSFER_ZONE_ATTRIBUTE, type TransferZoneState } from "./tabTransfer";

export type TransferZoneProps = {
    className?: string;
    "data-testid"?: string;
    style?: CSSProperties;
    /** The region's own content, which the zone never interferes with. */
    children: ReactNode;
    /** The id a tab strip names to send a tab here. */
    id: string;
    /** What dropping here does: "Open in the main content". */
    label: string;
    /** The glyph on the invitation. */
    icon?: IconName;
    /**
     * Forces the zone's appearance. A live drag draws these same two
     * appearances through an attribute of its own; the prop exists so a
     * blueprint or a test can show them without a pointer.
     */
    state?: TransferZoneState;
};

/**
 * C-171 TransferZone — a region a tab can be dragged into from another strip.
 *
 * It is a plain flex column around whatever it wraps, and does nothing at all
 * until a drag begins: then it draws an inset outline and says what dropping
 * here would do. The invitation covers the region rather than displacing it, so
 * arming a zone never moves the content underneath and a drag cannot reflow the
 * window it is crossing.
 */
export function TransferZone(props: TransferZoneProps) {
    const [local, rest] = partitionComponentProps(props, [
        "children",
        "className",
        "icon",
        "id",
        "label",
        "state",
        "style",
    ]);
    return (
        <div
            {...rest}
            {...{ [TRANSFER_ZONE_ATTRIBUTE]: local.id }}
            className={["kissopen-transfer-zone", local.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="transfer-zone"
            data-transfer-state={local.state}
            style={local.style}
        >
            {local.children}
            {/* Not in the flow: the region keeps every pixel it had, and the
                invitation is painted over it for as long as the drag lasts. */}
            <div
                aria-hidden="true"
                className="kissopen-transfer-zone__invite"
                data-kissopen-desktop-ui="transfer-zone-invite"
            >
                <span
                    className="kissopen-transfer-zone__badge"
                    data-kissopen-desktop-ui="transfer-zone-badge"
                >
                    <Icon name={local.icon ?? "panel-expand"} size={16} />
                    {local.label}
                </span>
            </div>
        </div>
    );
}
