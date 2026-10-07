import type { CSSProperties } from "react";

/**
 * How long is left, in the two largest units that still say something. A wait
 * measured in days does not need its seconds, and a wait of forty seconds does
 * not need a leading "0m", so a trailing zero unit is dropped rather than
 * padded.
 */
export function waitRemainingLabel(remainingMs: number): string {
    const total = Math.max(0, Math.ceil(remainingMs / 1000));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    return `${seconds}s`;
}

/** The calendar day a wait ends on, with no clock time — the hover answer. */
export function waitFinishDateLabel(finishAt: number): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(finishAt);
}

export type WaitRingProps = {
    /** Epoch milliseconds the wait began at; the empty end of the ring. */
    startedAt: number;
    /** Epoch milliseconds the wait ends at; the full end of the ring. */
    finishAt: number;
    /**
     * The reference time to render against, from the owning surface's clock.
     * This component owns no timer: the surface that shows a countdown already
     * ticks, and a second clock here would drift against it.
     */
    now: number;
    /** Box size in CSS pixels, matching the line height of the row it sits in. */
    size?: number;
    className?: string;
    style?: CSSProperties;
};

/** Ring stroke width in CSS pixels; the track and the fill share it. */
const RING_STROKE = 2;

/**
 * WaitRing — the share of a scheduled wait already spent, as a filling arc. It
 * stands exactly where a spinner would and takes the same box, but it is a
 * measurement rather than a loader: an indeterminate spinner says "something is
 * happening" when the one thing worth knowing is how much of a known interval
 * is gone.
 *
 * The ring carries no text. The row it sits in already has a place for the
 * countdown, and the two must share that row's type rather than bring their
 * own.
 */
export function WaitRing(props: WaitRingProps) {
    const size = props.size ?? 14;
    const span = props.finishAt - props.startedAt;
    const elapsed = props.now - props.startedAt;
    const progress = span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 1;
    const radius = (size - RING_STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;
    return (
        <svg
            aria-hidden="true"
            className={["kissopen-wait-ring", props.className].filter(Boolean).join(" ")}
            data-kissopen-desktop-ui="wait-ring"
            data-progress={Math.round(progress * 100)}
            height={size}
            style={props.style}
            viewBox={`0 0 ${size} ${size}`}
            width={size}
        >
            <circle
                className="kissopen-wait-ring__track"
                cx={center}
                cy={center}
                fill="none"
                r={radius}
                strokeWidth={RING_STROKE}
            />
            <circle
                className="kissopen-wait-ring__fill"
                cx={center}
                cy={center}
                fill="none"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                strokeWidth={RING_STROKE}
                transform={`rotate(-90 ${center} ${center})`}
            />
        </svg>
    );
}
