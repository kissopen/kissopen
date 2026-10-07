import { createStore } from "zustand/vanilla";
import { t } from "../i18n/locale.js";
import {
    deepEqual,
    referencesPreserve,
    kissopenAgentPermissionLabel,
    kissopenAgentServiceTierLabel,
    kissopenAgentThinkingLabel,
} from "./kissopenAgentSupport.js";
import type {
    KissopenAgentEffortOption,
    KissopenAgentMenusSnapshot,
    KissopenAgentModelCatalog,
    KissopenAgentModelOption,
    KissopenAgentPermissionMode,
    KissopenAgentPermissionModeOption,
    KissopenAgentSelection,
    KissopenAgentServiceTierOption,
    KissopenAgentThinkingLevel,
} from "./kissopenAgentTypes.js";

const PERMISSION_MODES: readonly KissopenAgentPermissionMode[] = [
    "auto",
    "workspace_write",
    "read_only",
    "full_access",
];

/**
 * Pure derivation of picker options from the model catalog and the current
 * session selection. Kept side-effect free so both the standalone menus store
 * and the chat store can compute the same option lists from their own inputs.
 */
export function kissopenAgentMenusDerive(
    catalog: KissopenAgentModelCatalog,
    selection: KissopenAgentSelection,
): KissopenAgentMenusSnapshot {
    const modelOptions: KissopenAgentModelOption[] = [];
    let selectedProvider = catalog.providers.find(
        (provider) => provider.id === selection.providerId,
    );
    for (const provider of catalog.providers) {
        // The provider's default model leads its own list: a picker that shows a provider as
        // one choice (the KISSOPEN cloud) starts a conversation on it.
        const models =
            provider.id === catalog.defaultProviderId
                ? [
                      ...provider.models.filter((model) => model.id === catalog.defaultModelId),
                      ...provider.models.filter((model) => model.id !== catalog.defaultModelId),
                  ]
                : provider.models;
        for (const model of models) {
            modelOptions.push({
                providerId: provider.id,
                ...(provider.name === undefined ? {} : { providerName: provider.name }),
                modelId: model.id,
                name: model.name,
                disabled: provider.disabledReason !== undefined,
                current: provider.id === selection.providerId && model.id === selection.modelId,
            });
        }
    }

    const currentModel = selectedProvider?.models.find((model) => model.id === selection.modelId);
    const effortOptions: KissopenAgentEffortOption[] = (currentModel?.thinkingLevels ?? []).map(
        (level: KissopenAgentThinkingLevel): KissopenAgentEffortOption => ({
            level,
            label:
                currentModel?.customReasoning === null
                    ? t("Service default")
                    : kissopenAgentThinkingLabel(level),
            current: level === selection.effort,
            isDefault: level === currentModel?.defaultThinkingLevel,
        }),
    );

    const permissionModeOptions: KissopenAgentPermissionModeOption[] = PERMISSION_MODES.map(
        (mode) => ({
            mode,
            label: kissopenAgentPermissionLabel(mode),
            current: mode === selection.permissionMode,
        }),
    );

    const supportsFast = selectedProvider?.serviceTiers.includes("fast") ?? false;
    const serviceTierOptions: KissopenAgentServiceTierOption[] = [
        {
            tier: null,
            label: kissopenAgentServiceTierLabel(null),
            current: selection.serviceTier === undefined,
        },
        ...(supportsFast
            ? [
                  {
                      tier: "fast" as const,
                      label: kissopenAgentServiceTierLabel("fast"),
                      current: selection.serviceTier === "fast",
                  },
              ]
            : []),
    ];

    return {
        ...(currentModel?.customReasoning === undefined
            ? {}
            : { currentCustomReasoning: currentModel.customReasoning }),
        modelOptions,
        effortOptions,
        permissionModeOptions,
        serviceTierOptions,
        currentProviderId: selection.providerId,
        currentModelId: selection.modelId,
        currentEffort: selection.effort,
        currentPermissionMode: selection.permissionMode,
        currentServiceTier: selection.serviceTier,
    };
}

/** Keeps every unchanged picker collection and row stable across a fresh derivation. */
export function kissopenAgentMenusReferencesPreserve(
    previous: KissopenAgentMenusSnapshot,
    next: KissopenAgentMenusSnapshot,
): KissopenAgentMenusSnapshot {
    const modelOptions = referencesPreserve(previous.modelOptions, next.modelOptions);
    const effortOptions = referencesPreserve(previous.effortOptions, next.effortOptions);
    const permissionModeOptions = referencesPreserve(
        previous.permissionModeOptions,
        next.permissionModeOptions,
    );
    const serviceTierOptions = referencesPreserve(
        previous.serviceTierOptions,
        next.serviceTierOptions,
    );
    if (
        modelOptions === previous.modelOptions &&
        effortOptions === previous.effortOptions &&
        permissionModeOptions === previous.permissionModeOptions &&
        serviceTierOptions === previous.serviceTierOptions &&
        next.currentProviderId === previous.currentProviderId &&
        next.currentModelId === previous.currentModelId &&
        deepEqual(next.currentCustomReasoning, previous.currentCustomReasoning) &&
        next.currentEffort === previous.currentEffort &&
        next.currentPermissionMode === previous.currentPermissionMode &&
        next.currentServiceTier === previous.currentServiceTier
    )
        return previous;
    return {
        ...next,
        modelOptions,
        effortOptions,
        permissionModeOptions,
        serviceTierOptions,
    };
}

function currentOptionsUpdate<T extends { readonly current: boolean }>(
    options: readonly T[],
    current: (option: T) => boolean,
): readonly T[] {
    let changed = false;
    const next = options.map((option) => {
        const selected = current(option);
        if (option.current === selected) return option;
        changed = true;
        return { ...option, current: selected };
    });
    return changed ? next : options;
}

/** Reprojects one selection while touching only the option family whose current row changed. */
export function kissopenAgentMenusSelectionProject(
    catalog: KissopenAgentModelCatalog,
    previous: KissopenAgentMenusSnapshot,
    selection: KissopenAgentSelection,
): KissopenAgentMenusSnapshot {
    if (
        previous.currentProviderId === selection.providerId &&
        previous.currentModelId === selection.modelId &&
        previous.currentEffort === selection.effort &&
        previous.currentPermissionMode === selection.permissionMode &&
        previous.currentServiceTier === selection.serviceTier
    )
        return previous;

    if (
        previous.currentProviderId !== selection.providerId ||
        previous.currentModelId !== selection.modelId
    )
        return kissopenAgentMenusReferencesPreserve(
            previous,
            kissopenAgentMenusDerive(catalog, selection),
        );

    return {
        ...previous,
        effortOptions:
            previous.currentEffort === selection.effort
                ? previous.effortOptions
                : currentOptionsUpdate(
                      previous.effortOptions,
                      (option) => option.level === selection.effort,
                  ),
        permissionModeOptions:
            previous.currentPermissionMode === selection.permissionMode
                ? previous.permissionModeOptions
                : currentOptionsUpdate(
                      previous.permissionModeOptions,
                      (option) => option.mode === selection.permissionMode,
                  ),
        serviceTierOptions:
            previous.currentServiceTier === selection.serviceTier
                ? previous.serviceTierOptions
                : currentOptionsUpdate(
                      previous.serviceTierOptions,
                      (option) => option.tier === (selection.serviceTier ?? null),
                  ),
        currentEffort: selection.effort,
        currentPermissionMode: selection.permissionMode,
        currentServiceTier: selection.serviceTier,
    };
}

export interface KissopenAgentMenusStore {
    get(): KissopenAgentMenusSnapshot;
    subscribe(listener: () => void): () => void;
    /** Private authoritative input: feed a fresh selection (e.g. from the chat snapshot). */
    menusSelectionUpdate(selection: KissopenAgentSelection): void;
}

export interface KissopenAgentMenusStoreOptions {
    readonly catalog: KissopenAgentModelCatalog;
    readonly selection: KissopenAgentSelection;
}

/**
 * A standalone picker-options store for a session's model/effort/permission/tier
 * choices. It is a pure derivation of catalog + selection: the owner feeds the
 * current selection through `menusSelectionUpdate`, so nothing is mirrored or
 * fetched here.
 */
export function kissopenAgentMenusStoreCreate(
    options: KissopenAgentMenusStoreOptions,
): KissopenAgentMenusStore {
    const catalog = options.catalog;
    const store = createStore<KissopenAgentMenusSnapshot>()(() =>
        kissopenAgentMenusDerive(catalog, options.selection),
    );
    return {
        get: () => store.getState(),
        subscribe: (listener) => store.subscribe(listener),
        menusSelectionUpdate(selection) {
            const previous = store.getState();
            store.setState(kissopenAgentMenusSelectionProject(catalog, previous, selection), true);
        },
    };
}
