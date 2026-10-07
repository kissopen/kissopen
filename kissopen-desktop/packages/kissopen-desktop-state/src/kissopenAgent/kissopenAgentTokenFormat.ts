/**
 * Token counts as a reader scans them. Compaction figures run to six digits,
 * where the exact number is noise and the magnitude is the whole point.
 */
export function kissopenAgentTokenCountFormat(tokens: number): string {
    if (tokens < 1000) return String(Math.max(0, Math.round(tokens)));
    const thousands = tokens / 1000;
    return `${thousands < 100 ? thousands.toFixed(1).replace(/\.0$/, "") : String(Math.round(thousands))}k`;
}

/** The token range shown beside a running or settled compaction row. */
export function kissopenAgentCompactionSubject(
    estimatedTokensBefore: number,
    estimatedTokensAfter?: number,
): string {
    const before = kissopenAgentTokenCountFormat(estimatedTokensBefore);
    return estimatedTokensAfter === undefined
        ? `from ${before} tokens`
        : `${before} → ${kissopenAgentTokenCountFormat(estimatedTokensAfter)} tokens`;
}
