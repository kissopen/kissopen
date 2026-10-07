import {
    KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL,
    type KissopenAgentPermissionMode,
    type KissopenAgentThinkingLevel,
} from "./kissopenAgentTypes.js";

declare const kissopenAgentModelKeyBrand: unique symbol;

/**
 * One model inside one provider, as `${providerId}:${modelId}`. The catalog
 * reuses a model id across providers, so neither half identifies a row on its
 * own and a plain string would silently address the wrong provider's copy.
 */
export type KissopenAgentModelKey = string & { readonly [kissopenAgentModelKeyBrand]: true };

export function kissopenAgentModelKey(providerId: string, modelId: string): KissopenAgentModelKey {
    return `${providerId}:${modelId}` as KissopenAgentModelKey;
}

export interface KissopenAgentSettingsSnapshot {
    /** Unset until the reader picks a model; the catalog's own default stands in. */
    readonly defaultProviderId?: string;
    readonly defaultModelId?: string;
    readonly defaultEffort: KissopenAgentThinkingLevel;
    /** Access granted to a new session before its composer overrides the choice. */
    readonly defaultPermissionMode: KissopenAgentPermissionMode;
    /** Models switched off for this workspace. Absent from the set means enabled. */
    readonly disabledModels: ReadonlySet<KissopenAgentModelKey>;
}

/**
 * The local workspace's own preferences: which model a new session starts on and
 * which of the catalog's models the pickers are allowed to offer. It is the
 * reader's selection, not the daemon's. The concrete store stays memory-only;
 * its desktop host may seed it from local configuration and persist notifications
 * without turning those choices into server-confirmed state.
 */
export interface KissopenAgentSettingsStore {
    get(): KissopenAgentSettingsSnapshot;
    subscribe(listener: () => void): () => void;
    /** Chooses the model a new session starts on, together with its provider. */
    defaultModelUpdate(providerId: string, modelId: string): void;
    defaultEffortUpdate(effort: KissopenAgentThinkingLevel): void;
    defaultPermissionModeUpdate(mode: KissopenAgentPermissionMode): void;
    /** Offers or withholds one model in the session pickers. */
    modelEnabledUpdate(key: KissopenAgentModelKey, enabled: boolean): void;
}

const EMPTY_DISABLED: ReadonlySet<KissopenAgentModelKey> = new Set<KissopenAgentModelKey>();

export interface KissopenAgentSettingsInitial {
    readonly defaultProviderId?: string;
    readonly defaultModelId?: string;
    readonly defaultEffort?: KissopenAgentThinkingLevel;
    readonly defaultPermissionMode?: KissopenAgentPermissionMode;
}

/** Creates the workspace-lifetime preference store; it opens no transport or timers. */
export function kissopenAgentSettingsStoreCreate(
    initial: KissopenAgentSettingsInitial = {},
): KissopenAgentSettingsStore {
    const listeners = new Set<() => void>();
    let snapshot: KissopenAgentSettingsSnapshot = {
        ...initial,
        defaultEffort: initial.defaultEffort ?? KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL,
        defaultPermissionMode: initial.defaultPermissionMode ?? "auto",
        disabledModels: EMPTY_DISABLED,
    };

    const publish = (next: KissopenAgentSettingsSnapshot): void => {
        snapshot = next;
        for (const listener of listeners) listener();
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        defaultModelUpdate(providerId, modelId) {
            if (snapshot.defaultProviderId === providerId && snapshot.defaultModelId === modelId)
                return;
            publish({ ...snapshot, defaultProviderId: providerId, defaultModelId: modelId });
        },
        defaultEffortUpdate(effort) {
            if (snapshot.defaultEffort === effort) return;
            publish({ ...snapshot, defaultEffort: effort });
        },
        defaultPermissionModeUpdate(mode) {
            if (snapshot.defaultPermissionMode === mode) return;
            publish({ ...snapshot, defaultPermissionMode: mode });
        },
        modelEnabledUpdate(key, enabled) {
            if (snapshot.disabledModels.has(key) === !enabled) return;
            const disabledModels = new Set(snapshot.disabledModels);
            if (enabled) disabledModels.delete(key);
            else disabledModels.add(key);
            publish({ ...snapshot, disabledModels });
        },
    };
}
