/** The service-tier vocabulary Kissopen exposes to product state and UI. */
export type KissopenAgentServiceTier = "fast";

/** The OpenAI/Codex tier name published by Kissopen Agent's wire contract. */
const KISSOPEN_AGENT_FAST_SERVICE_TIER = "priority";

/** Projects one daemon service tier into KISSOPEN's closed product vocabulary. */
export function kissopenAgentServiceTierFromWire(
    value: string | null | undefined,
): KissopenAgentServiceTier | undefined {
    return value === KISSOPEN_AGENT_FAST_SERVICE_TIER ? "fast" : undefined;
}

/** Projects a daemon capability list without leaking unknown wire tiers. */
export function kissopenAgentServiceTiersFromWire(values: readonly string[]): KissopenAgentServiceTier[] {
    return values.includes(KISSOPEN_AGENT_FAST_SERVICE_TIER) ? ["fast"] : [];
}

/** Projects Kissopen's service-tier selection into the daemon's wire vocabulary. */
export function kissopenAgentServiceTierToWire(
    value: KissopenAgentServiceTier | undefined,
): "priority" | null {
    return value === "fast" ? KISSOPEN_AGENT_FAST_SERVICE_TIER : null;
}
