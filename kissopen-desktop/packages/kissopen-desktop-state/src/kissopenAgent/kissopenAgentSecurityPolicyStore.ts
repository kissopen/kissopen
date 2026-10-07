import type { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import {
    kissopenAgentGlobalDocumentStoreCreate,
    type KissopenAgentGlobalDocumentSnapshot,
    type KissopenAgentGlobalDocumentStore,
} from "./kissopenAgentInstructionsStore.js";

/** How much security policy text one Kissopen Agent will keep in its global `SECURITY.md`. */
export const KISSOPEN_AGENT_SECURITY_POLICY_MAX_BYTES = 32 * 1024;

export type KissopenAgentSecurityPolicySnapshot = KissopenAgentGlobalDocumentSnapshot;
export type KissopenAgentSecurityPolicyStore = KissopenAgentGlobalDocumentStore;

export interface KissopenAgentSecurityPolicyStoreDeps {
    readonly client: Pick<KissopenAgentClient, "getSecurityPolicy" | "putSecurityPolicy">;
}

/** Creates the editor store for the policy used when this Kissopen Agent reviews permission requests. */
export function kissopenAgentSecurityPolicyStoreCreate(
    deps: KissopenAgentSecurityPolicyStoreDeps,
): KissopenAgentSecurityPolicyStore {
    return kissopenAgentGlobalDocumentStoreCreate({
        read: async (signal) => (await deps.client.getSecurityPolicy({ signal })).policy,
        write: async (value) => (await deps.client.putSecurityPolicy(value)).policy,
    });
}
