import type { KissopenAgentClient } from "@kissopen/kissopen-agent-client";
import { kissopenAgentSyncRead, type KissopenAgentSync } from "../kissopenAgentConnection/index.js";
import { kissopenAgentModelCatalogProject } from "./kissopenAgentProject.js";
import type { KissopenAgentModelStore } from "./kissopenAgentModelStore.js";

/** Keeps the model picker aligned with configuration replaced by a daemon restart or update. */
export function kissopenAgentModelCatalogFollow(
    client: KissopenAgentClient,
    sync: KissopenAgentSync,
    models: KissopenAgentModelStore,
): () => void {
    const active = new AbortController();
    let pending: AbortController | undefined;
    const reconcile = (): void => {
        pending?.abort();
        const own = new AbortController();
        pending = own;
        const signal = AbortSignal.any([active.signal, own.signal]);
        void kissopenAgentSyncRead(
            signal,
            () => client.getConfig({ signal }),
            () => undefined,
        )
            .then((response) => {
                if (!signal.aborted)
                    models.catalogChanged(kissopenAgentModelCatalogProject(response.config));
            })
            .catch(() => undefined)
            .finally(() => {
                if (pending === own) pending = undefined;
            });
    };
    void (async () => {
        for await (const input of sync.follow({
            signal: active.signal,
            events: ["config.updated"],
        })) {
            if (input.kind === "bootstrap") {
                pending?.abort();
                pending = undefined;
                models.catalogChanged(kissopenAgentModelCatalogProject(input.bootstrap.config));
            } else if (
                input.kind === "reconcile" ||
                (input.kind === "update" &&
                    input.update.kind === "event" &&
                    input.update.event.type === "config.updated")
            ) {
                reconcile();
            }
        }
    })().catch(() => undefined);
    return () => {
        pending?.abort();
        pending = undefined;
        active.abort();
    };
}
