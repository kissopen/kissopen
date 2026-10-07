import type {
    KissopenAgentModelPreferenceDocument,
    KissopenAgentModelPreferencePersistence,
    KissopenAgentPermissionMode,
    KissopenAgentServiceTier,
    KissopenAgentSettingsInitial,
    KissopenAgentSettingsSnapshot,
    KissopenAgentThinkingLevel,
    TitleShimmerPersistence,
} from "kissopen-desktop-state";
import { KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL } from "kissopen-desktop-state";
import type {
    DesktopAppearanceMode,
    DesktopConfig,
    DesktopDefaultModel,
    DesktopModelPreference,
    DesktopScrollbarVisibility,
    KissopenDesktopBridge,
} from "../shared/desktopContract";

import { LOCALE_STORAGE_KEY } from "./localeBoot";

const STANDARD_SPEED = "standard";
const THINKING_LEVELS: ReadonlySet<string> = new Set([
    "off",
    "on",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
    "ultra",
]);

export interface DesktopPreferences {
    readonly initialAppearance: DesktopAppearanceMode;
    readonly initialScrollbarVisibility: DesktopScrollbarVisibility;
    readonly initialSettings: KissopenAgentSettingsInitial;
    readonly preferencePersistence: KissopenAgentModelPreferencePersistence;
    readonly titleShimmerPersistence: TitleShimmerPersistence;
    appearanceChanged(
        mode: DesktopAppearanceMode,
        scrollbarVisibility: DesktopScrollbarVisibility,
    ): void;
    settingsChanged(snapshot: KissopenAgentSettingsSnapshot): void;
    /** The saved language, so the main process can follow the same choice. */
    readonly language: "system" | "zh" | "en";
    /**
     * Saves a new language and reloads the window in it. The main process reads
     * the same document for its menus; the renderer keeps a copy it can read
     * synchronously before anything else loads.
     */
    languageChanged(language: "system" | "zh" | "en"): Promise<void>;
}

/**
 * Adapts the desktop's one JSON document to the framework-independent product
 * stores that consume it: appearance, title motion, explicit defaults, and
 * per-model picker memory. One adapter owns the current document so concurrent
 * store changes preserve each other's fields before the main process serializes
 * their writes.
 */
export function desktopPreferencesCreate(
    bridge: KissopenDesktopBridge,
    initial: DesktopConfig,
): DesktopPreferences {
    let config = initial;
    const preferenceListeners = new Set<() => void>();

    const commit = (next: DesktopConfig): void => {
        config = next;
        for (const listener of preferenceListeners) listener();
        // Invoke immediately; the privileged store is the single serialization
        // authority, so every quick selection enters its ordered write queue.
        void bridge.desktopConfigWrite(next).catch((error: unknown) => {
            console.error("Could not save desktop preferences.", error);
        });
    };

    const preferencePersistence: KissopenAgentModelPreferencePersistence = {
        read: () => preferenceDocument(config),
        write(document) {
            commit(configFromPreferenceDocument(config, document));
        },
        subscribe(listener) {
            preferenceListeners.add(listener);
            return () => preferenceListeners.delete(listener);
        },
    };

    const titleShimmerPersistence: TitleShimmerPersistence = {
        read: () =>
            config.titleShimmerEnabled === undefined
                ? undefined
                : { titleShimmerEnabled: config.titleShimmerEnabled },
        write(document) {
            const enabled = document.titleShimmerEnabled;
            if (enabled === undefined || config.titleShimmerEnabled === enabled) return;
            commit({ ...config, titleShimmerEnabled: enabled });
        },
    };

    return {
        language: config.language ?? "system",
        async languageChanged(language) {
            const next: DesktopConfig = { ...config, language };
            config = next;
            try {
                await bridge.desktopConfigWrite(next);
            } catch (error) {
                console.error("Could not save the language.", error);
            }
            try {
                window.localStorage.setItem(LOCALE_STORAGE_KEY, language);
            } catch {
                // A window that cannot remember it still switches now.
            }
            window.location.reload();
        },
        initialAppearance: config.appearance,
        initialScrollbarVisibility: config.scrollbarVisibility,
        initialSettings: settingsInitial(config),
        preferencePersistence,
        titleShimmerPersistence,
        appearanceChanged(mode, scrollbarVisibility) {
            if (config.appearance === mode && config.scrollbarVisibility === scrollbarVisibility)
                return;
            commit({ ...config, appearance: mode, scrollbarVisibility });
        },
        settingsChanged(snapshot) {
            const nextEffort = snapshot.defaultEffort;
            const nextPermissionMode = snapshot.defaultPermissionMode;
            const nextDefault =
                snapshot.defaultProviderId && snapshot.defaultModelId
                    ? {
                          providerId: snapshot.defaultProviderId,
                          modelId: snapshot.defaultModelId,
                          ...(snapshot.defaultEffort ? { effort: snapshot.defaultEffort } : {}),
                      }
                    : undefined;
            if (
                defaultEqual(config.defaultModel, nextDefault) &&
                config.defaultEffort === nextEffort &&
                config.defaultPermissionMode === nextPermissionMode
            )
                return;

            let modelPreferences = config.modelPreferences;
            if (nextDefault?.effort) {
                const preference = modelPreferences.find(
                    (candidate) =>
                        candidate.providerId === nextDefault.providerId &&
                        candidate.modelId === nextDefault.modelId,
                );
                const updated: DesktopModelPreference = {
                    providerId: nextDefault.providerId,
                    modelId: nextDefault.modelId,
                    lastEffort: nextDefault.effort,
                    lastSpeed: preference?.lastSpeed ?? STANDARD_SPEED,
                };
                modelPreferences = [
                    ...modelPreferences.filter(
                        (candidate) =>
                            candidate.providerId !== nextDefault.providerId ||
                            candidate.modelId !== nextDefault.modelId,
                    ),
                    updated,
                ];
            }
            commit({
                appearance: config.appearance,
                defaultEffort: nextEffort,
                ...(nextDefault ? { defaultModel: nextDefault } : {}),
                defaultPermissionMode: nextPermissionMode,
                ...(nextDefault
                    ? {
                          lastPickedModel: {
                              providerId: nextDefault.providerId,
                              modelId: nextDefault.modelId,
                          },
                      }
                    : config.lastPickedModel
                      ? { lastPickedModel: config.lastPickedModel }
                      : {}),
                modelPreferences,
                scrollbarVisibility: config.scrollbarVisibility,
                ...(config.titleShimmerEnabled === undefined
                    ? {}
                    : { titleShimmerEnabled: config.titleShimmerEnabled }),
                version: 1,
            });
        },
    };
}

function settingsInitial(config: DesktopConfig): KissopenAgentSettingsInitial {
    const effort =
        thinkingLevel(config.defaultEffort) ??
        thinkingLevel(config.defaultModel?.effort) ??
        KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL;
    return {
        ...(config.defaultModel
            ? {
                  defaultProviderId: config.defaultModel.providerId,
                  defaultModelId: config.defaultModel.modelId,
              }
            : {}),
        defaultEffort: effort,
        defaultPermissionMode: permissionMode(config.defaultPermissionMode),
    };
}

function preferenceDocument(config: DesktopConfig): KissopenAgentModelPreferenceDocument {
    const preferences: {
        [providerId: string]: {
            [modelId: string]: {
                effort: KissopenAgentThinkingLevel | null;
                serviceTier: KissopenAgentServiceTier | null;
            };
        };
    } = {};
    for (const preference of config.modelPreferences) {
        const provider = preferences[preference.providerId] ?? {};
        provider[preference.modelId] = {
            effort: thinkingLevel(preference.lastEffort) ?? null,
            serviceTier: preference.lastSpeed === "fast" ? "fast" : null,
        };
        preferences[preference.providerId] = provider;
    }
    const defaultEffort = thinkingLevel(config.defaultModel?.effort);
    return {
        defaultEffort: thinkingLevel(config.defaultEffort) ?? KISSOPEN_AGENT_DEFAULT_THINKING_LEVEL,
        ...(config.defaultModel
            ? {
                  defaultSelection: {
                      providerId: config.defaultModel.providerId,
                      modelId: config.defaultModel.modelId,
                      ...(defaultEffort ? { effort: defaultEffort } : {}),
                  },
              }
            : {}),
        ...(config.lastPickedModel ? { lastPickedModel: config.lastPickedModel } : {}),
        defaultPermissionMode: permissionMode(config.defaultPermissionMode),
        preferences,
    };
}

function configFromPreferenceDocument(
    current: DesktopConfig,
    document: KissopenAgentModelPreferenceDocument,
): DesktopConfig {
    const modelPreferences: DesktopModelPreference[] = [];
    for (const [providerId, models] of Object.entries(document.preferences)) {
        if (!models) continue;
        for (const [modelId, preference] of Object.entries(models)) {
            if (!preference) continue;
            modelPreferences.push({
                providerId,
                modelId,
                ...(preference.effort ? { lastEffort: preference.effort } : {}),
                lastSpeed: preference.serviceTier ?? STANDARD_SPEED,
            });
        }
    }
    modelPreferences.sort(
        (left, right) =>
            left.providerId.localeCompare(right.providerId) ||
            left.modelId.localeCompare(right.modelId),
    );
    return {
        appearance: current.appearance,
        defaultEffort: document.defaultEffort ?? current.defaultEffort,
        ...(document.defaultSelection
            ? {
                  defaultModel: {
                      providerId: document.defaultSelection.providerId,
                      modelId: document.defaultSelection.modelId,
                      ...(document.defaultSelection.effort
                          ? { effort: document.defaultSelection.effort }
                          : {}),
                  },
              }
            : current.defaultModel
              ? { defaultModel: current.defaultModel }
              : {}),
        ...(document.lastPickedModel ? { lastPickedModel: document.lastPickedModel } : {}),
        defaultPermissionMode: current.defaultPermissionMode,
        modelPreferences,
        scrollbarVisibility: current.scrollbarVisibility,
        ...(current.titleShimmerEnabled === undefined
            ? {}
            : { titleShimmerEnabled: current.titleShimmerEnabled }),
        version: 1,
    };
}

function thinkingLevel(value: string | undefined): KissopenAgentThinkingLevel | undefined {
    return value && THINKING_LEVELS.has(value) ? (value as KissopenAgentThinkingLevel) : undefined;
}

function permissionMode(value: string | undefined): KissopenAgentPermissionMode {
    switch (value) {
        case "workspace_write":
        case "read_only":
        case "full_access":
            return value;
        default:
            return "auto";
    }
}

function defaultEqual(
    left: DesktopDefaultModel | undefined,
    right: DesktopDefaultModel | undefined,
): boolean {
    return (
        left?.providerId === right?.providerId &&
        left?.modelId === right?.modelId &&
        left?.effort === right?.effort
    );
}
