/** Formats an active elapsed clock in the smallest useful human-readable units. */
export function elapsedTimeFormat(elapsedMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
