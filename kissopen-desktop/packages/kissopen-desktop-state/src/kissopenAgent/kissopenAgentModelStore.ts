import { t } from "../i18n/locale.js";
import { UserError } from "../types.js";
import { kissopenAgentMenusDerive } from "./kissopenAgentMenusStore.js";
import {
    kissopenAgentSelectionModelUpdate,
    kissopenAgentSessionSelectionDefault,
} from "./kissopenAgentSessionDraftStore.js";
import type {
    KissopenAgentMenusSnapshot,
    KissopenAgentModelCatalog,
    KissopenAgentSelection,
} from "./kissopenAgentTypes.js";
import type {
    KissopenAgentModelSelection,
    KissopenAgentPermissionMode,
    KissopenAgentServiceTier,
    KissopenAgentThinkingLevel,
} from "./kissopenAgentTypes.js";

export interface KissopenAgentModelPreference {
    readonly effort?: KissopenAgentThinkingLevel | null;
    readonly serviceTier?: KissopenAgentServiceTier | null;
}

export interface KissopenAgentModelPreferences {
    readonly [providerId: string]:
        | {
              readonly [modelId: string]: KissopenAgentModelPreference | undefined;
          }
        | undefined;
}

export interface KissopenAgentModelPreferenceIdentity {
    readonly providerId: string;
    readonly modelId: string;
}

export interface KissopenAgentModelPreferenceDefault extends KissopenAgentModelPreferenceIdentity {
    readonly effort?: KissopenAgentThinkingLevel;
}

/** Complete machine-local model choices supplied by the desktop host. */
export interface KissopenAgentModelPreferenceDocument {
    readonly defaultSelection?: KissopenAgentModelPreferenceDefault;
    /** Reasoning level configured for new sessions before a model-specific fallback. */
    readonly defaultEffort?: KissopenAgentThinkingLevel;
    /** Access mode configured for a new session, independent of its model. */
    readonly defaultPermissionMode?: KissopenAgentPermissionMode;
    readonly lastPickedModel?: KissopenAgentModelPreferenceIdentity;
    readonly preferences: KissopenAgentModelPreferences;
}

export interface KissopenAgentModelPreferencePersistence {
    read(): KissopenAgentModelPreferenceDocument | undefined;
    write(document: KissopenAgentModelPreferenceDocument): void;
    /** Reports a replacement written through another store sharing this host document. */
    subscribe?(listener: () => void): () => void;
}

export type KissopenAgentModelStoreSnapshot =
    | { readonly type: "loading" }
    | { readonly type: "error"; readonly error: UserError }
    | {
          readonly type: "ready";
          readonly catalog: KissopenAgentModelCatalog;
          readonly defaultSelection: KissopenAgentSelection;
          readonly lastUsedSelection: KissopenAgentSelection;
          readonly menus: KissopenAgentMenusSnapshot;
      };

export type KissopenAgentModelStoreReadySnapshot = Extract<
    KissopenAgentModelStoreSnapshot,
    { type: "ready" }
>;

/**
 * One daemon connection's model authority. It loads the immutable catalog once,
 * exposes model capabilities/defaults, and retains the complete selection most
 * recently chosen anywhere in that connection.
 */
export interface KissopenAgentModelStore {
    get(): KissopenAgentModelStoreSnapshot;
    subscribe(listener: () => void): () => void;
    /** Loads or joins the one in-flight catalog request. A failed explicit retry starts anew. */
    load(): Promise<KissopenAgentModelStoreReadySnapshot>;
    /**
     * Replaces the catalog with one the daemon has just confirmed elsewhere.
     *
     * Enabling or disabling a provider changes what this machine offers, and the
     * daemon answers that change with its whole configuration. This is that
     * answer arriving, not a selection anyone made, so it replaces the catalog
     * and re-derives the defaults from it without touching what was last used.
     */
    catalogChanged(catalog: KissopenAgentModelCatalog): void;
    /** Records a user-selected model/effort/access/tier as the next-session default. */
    selectionUsed(selection: KissopenAgentSelection): void;
    /** Selects a model with that model's last locally remembered effort and speed. */
    modelSelect(
        current: KissopenAgentSelection,
        input: KissopenAgentModelSelection,
    ): KissopenAgentSelection;
    [Symbol.dispose](): void;
}

export interface KissopenAgentModelStoreOptions {
    readonly catalogRead: () => Promise<KissopenAgentModelCatalog>;
    readonly preferencePersistence?: KissopenAgentModelPreferencePersistence;
}

/**
 * The catalog read's failure as something a surface can show, without losing
 * what actually refused.
 *
 * The cause travels because a refusal carries meaning its sentence does not: a
 * daemon answering "this route is not shared" is a machine deliberately keeping
 * its work to itself, and a caller telling that apart from a broken one reads
 * the original rather than parsing this wording.
 */
function modelError(error: unknown): UserError {
    if (error instanceof UserError) return error;
    return new UserError(
        error instanceof Error ? error.message : t("Could not load KissOpen Agent models."),
        undefined,
        error,
    );
}

/** Creates the daemon-lifetime model store without opening transport work. */
export function kissopenAgentModelStoreCreate(
    options: KissopenAgentModelStoreOptions,
): KissopenAgentModelStore {
    const listeners = new Set<() => void>();
    let snapshot: KissopenAgentModelStoreSnapshot = { type: "loading" };
    let loadPromise: Promise<KissopenAgentModelStoreReadySnapshot> | undefined;
    let document: KissopenAgentModelPreferenceDocument = { preferences: {} };
    let preferences = document.preferences;
    let preferenceUnsubscribe: (() => void) | undefined;
    let writingPreferences = false;

    const publish = (next: KissopenAgentModelStoreSnapshot): void => {
        snapshot = next;
        for (const listener of listeners) listener();
    };

    const preferencesReconcile = (): void => {
        if (writingPreferences) return;
        document = options.preferencePersistence?.read() ?? { preferences: {} };
        preferences = document.preferences;
        if (snapshot.type !== "ready") return;
        const selections = selectionsFromDocument(snapshot.catalog, document, snapshot);
        publish({
            ...snapshot,
            ...selections,
            menus: kissopenAgentMenusDerive(snapshot.catalog, selections.lastUsedSelection),
        });
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        load() {
            document = options.preferencePersistence?.read() ?? document;
            preferences = document.preferences;
            preferenceUnsubscribe ??=
                options.preferencePersistence?.subscribe?.(preferencesReconcile);
            if (snapshot.type === "ready") return Promise.resolve(snapshot);
            if (loadPromise) return loadPromise;
            if (snapshot.type === "error") publish({ type: "loading" });
            loadPromise = options.catalogRead().then(
                (catalog) => {
                    document = options.preferencePersistence?.read() ?? document;
                    preferences = document.preferences;
                    const selections = selectionsFromDocument(catalog, document);
                    const ready: KissopenAgentModelStoreReadySnapshot = {
                        type: "ready",
                        catalog,
                        ...selections,
                        menus: kissopenAgentMenusDerive(catalog, selections.lastUsedSelection),
                    };
                    publish(ready);
                    loadPromise = undefined;
                    return ready;
                },
                (error: unknown) => {
                    const failure = modelError(error);
                    publish({ type: "error", error: failure });
                    loadPromise = undefined;
                    throw failure;
                },
            );
            return loadPromise;
        },
        catalogChanged(catalog) {
            const selections = selectionsFromDocument(
                catalog,
                document,
                snapshot.type === "ready" ? snapshot : undefined,
            );
            publish({
                type: "ready",
                catalog,
                ...selections,
                menus: kissopenAgentMenusDerive(catalog, selections.lastUsedSelection),
            });
        },
        selectionUsed(selection) {
            if (snapshot.type !== "ready") return;
            const provider = preferences[selection.providerId] ?? {};
            preferences = {
                ...preferences,
                [selection.providerId]: {
                    ...provider,
                    [selection.modelId]: {
                        effort: selection.effort ?? null,
                        serviceTier: selection.serviceTier ?? null,
                    },
                },
            };
            document = {
                ...document,
                lastPickedModel: {
                    providerId: selection.providerId,
                    modelId: selection.modelId,
                },
                preferences,
            };
            writingPreferences = true;
            try {
                options.preferencePersistence?.write(document);
            } finally {
                writingPreferences = false;
            }
            publish({
                ...snapshot,
                lastUsedSelection: selection,
                menus: kissopenAgentMenusDerive(snapshot.catalog, selection),
            });
        },
        modelSelect(current, input) {
            if (snapshot.type !== "ready")
                return kissopenAgentSelectionModelUpdateWithoutPreferences(
                    snapshot,
                    current,
                    input,
                );
            const selected = kissopenAgentSelectionModelUpdateWithoutPreferences(
                snapshot,
                current,
                input,
            );
            const preference = preferences[selected.providerId]?.[selected.modelId];
            const provider = snapshot.catalog.providers.find(
                (candidate) => candidate.id === selected.providerId,
            );
            const model = provider?.models.find((candidate) => candidate.id === selected.modelId);
            const effort =
                preference?.effort && model?.thinkingLevels.includes(preference.effort)
                    ? preference.effort
                    : selected.effort;
            const serviceTier =
                preference?.serviceTier === null
                    ? undefined
                    : preference?.serviceTier &&
                        provider?.serviceTiers.includes(preference.serviceTier)
                      ? preference.serviceTier
                      : selected.serviceTier;
            return {
                providerId: selected.providerId,
                modelId: selected.modelId,
                ...(effort !== undefined ? { effort } : {}),
                permissionMode: selected.permissionMode,
                ...(serviceTier !== undefined ? { serviceTier } : {}),
            };
        },
        [Symbol.dispose]() {
            preferenceUnsubscribe?.();
            listeners.clear();
        },
    };
}

function selectionsFromDocument(
    catalog: KissopenAgentModelCatalog,
    document: KissopenAgentModelPreferenceDocument,
    current?: KissopenAgentModelStoreReadySnapshot,
): Pick<KissopenAgentModelStoreReadySnapshot, "defaultSelection" | "lastUsedSelection"> {
    const catalogDefault = kissopenAgentSessionSelectionDefault(catalog);
    const catalogDefaultModel = catalog.providers
        .find((provider) => provider.id === catalogDefault.providerId)
        ?.models.find((model) => model.id === catalogDefault.modelId);
    const catalogDefaultEffort =
        document.defaultEffort &&
        catalogDefaultModel?.thinkingLevels.includes(document.defaultEffort)
            ? document.defaultEffort
            : catalogDefault.effort;
    const defaultPermissionMode =
        document.defaultPermissionMode ??
        current?.defaultSelection.permissionMode ??
        catalogDefault.permissionMode;
    const catalogSelection = {
        ...catalogDefault,
        ...(catalogDefaultEffort !== undefined ? { effort: catalogDefaultEffort } : {}),
        permissionMode: defaultPermissionMode,
    };
    const defaultSelection =
        preferenceSelection(
            catalog,
            document.defaultSelection,
            document.preferences,
            defaultPermissionMode,
            document.defaultEffort,
        ) ?? catalogSelection;
    const lastUsedSelection =
        preferenceSelection(
            catalog,
            document.lastPickedModel,
            document.preferences,
            document.defaultPermissionMode ??
                current?.lastUsedSelection.permissionMode ??
                defaultSelection.permissionMode,
        ) ?? defaultSelection;
    return { defaultSelection, lastUsedSelection };
}

function preferenceSelection(
    catalog: KissopenAgentModelCatalog,
    identity: KissopenAgentModelPreferenceIdentity | undefined,
    preferences: KissopenAgentModelPreferences,
    permissionMode: KissopenAgentSelection["permissionMode"],
    defaultEffort?: KissopenAgentThinkingLevel,
): KissopenAgentSelection | undefined {
    if (!identity) return undefined;
    const provider = catalog.providers.find((candidate) => candidate.id === identity.providerId);
    const model = provider?.models.find((candidate) => candidate.id === identity.modelId);
    if (!provider || provider.disabledReason !== undefined || !model) return undefined;
    const candidateEffort =
        "effort" in identity ? (identity as KissopenAgentModelPreferenceDefault).effort : undefined;
    const explicitEffort =
        candidateEffort && model.thinkingLevels.includes(candidateEffort)
            ? candidateEffort
            : undefined;
    const preference = preferences[identity.providerId]?.[identity.modelId];
    const rememberedEffort =
        preference?.effort && model.thinkingLevels.includes(preference.effort)
            ? preference.effort
            : undefined;
    const supportedDefaultEffort =
        defaultEffort && model.thinkingLevels.includes(defaultEffort) ? defaultEffort : undefined;
    const serviceTier =
        preference?.serviceTier && provider.serviceTiers.includes(preference.serviceTier)
            ? preference.serviceTier
            : undefined;
    return {
        providerId: identity.providerId,
        modelId: identity.modelId,
        effort:
            explicitEffort ??
            supportedDefaultEffort ??
            rememberedEffort ??
            model.defaultThinkingLevel,
        permissionMode,
        ...(serviceTier !== undefined ? { serviceTier } : {}),
    };
}

function kissopenAgentSelectionModelUpdateWithoutPreferences(
    snapshot: KissopenAgentModelStoreSnapshot,
    current: KissopenAgentSelection,
    input: KissopenAgentModelSelection,
): KissopenAgentSelection {
    if (snapshot.type !== "ready") return current;
    return kissopenAgentSelectionModelUpdate(snapshot.catalog, current, input);
}
