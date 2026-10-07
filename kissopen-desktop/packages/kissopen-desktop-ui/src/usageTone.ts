/**
 * How a rate-limit window is spoken about, shared by every surface that shows
 * one. The provider-usage page and the session usage panel report the same
 * limits from the same daemon, so the point at which a window starts saying so
 * in colour has to be one decision rather than two constants that drift.
 */
export type UsageWindowTone = "ample" | "warning" | "critical";

/** Above this share spent, a window says so in colour; above the second, it insists. */
export const USAGE_WARNING_PERCENT = 75;
export const USAGE_CRITICAL_PERCENT = 90;

/** Holds a reported share inside the 0–100 a window can actually mean. */
export function usagePercentClamp(value: number): number {
    return Math.min(100, Math.max(0, value));
}

export function usageWindowTone(percent: number): UsageWindowTone {
    if (percent >= USAGE_CRITICAL_PERCENT) return "critical";
    if (percent >= USAGE_WARNING_PERCENT) return "warning";
    return "ample";
}
