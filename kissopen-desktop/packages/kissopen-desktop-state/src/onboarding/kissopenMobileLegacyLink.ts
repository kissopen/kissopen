import type { KissopenAgentClient, KissopenIntegration } from "@kissopen/kissopen-agent-client";

/** Refresh the existing native pairing only after the CLI confirms account and RPC readiness. */
export async function kissopenMobileLegacyLink(
    client: Pick<KissopenAgentClient, "getKissopenIntegration" | "startKissopenIntegration">,
    connectLegacyCli: () => Promise<void>,
    current: () => boolean,
): Promise<KissopenIntegration | undefined> {
    await connectLegacyCli();
    if (!current()) return undefined;
    const saved = await client.getKissopenIntegration();
    if (!current()) return undefined;
    if (!saved.integration.configured)
        throw new Error(
            "KissOpen Mobile was disconnected during setup. Reconnect it from Mobile Access settings.",
        );
    const refreshed = await client.startKissopenIntegration();
    if (!current()) return undefined;
    if (!refreshed.integration.configured)
        throw new Error("KissOpen Mobile could not confirm the terminal connection. Try again.");
    return refreshed.integration;
}
