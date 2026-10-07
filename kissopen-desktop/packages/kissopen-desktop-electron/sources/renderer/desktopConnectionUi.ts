import {
    kissopenAgentHistoryCreate,
    kissopenAgentRouterCreate,
    type KissopenAgentRouter,
} from "kissopen-desktop-app";
import {
    commandPaletteStoreCreate,
    kissopenAgentNavigationOrderStoreCreate,
    kissopenAgentSidebarCollapseStoreCreate,
    kissopenAgentSettingsStoreCreate,
    type CommandPaletteStore,
    type KissopenAgentNavigationOrderStore,
    type KissopenAgentSidebarCollapseStore,
    type KissopenAgentSidebarVisibilityStore,
    type KissopenAgentSettingsStore,
    type KissopenAgentModelPreferencePersistence,
} from "kissopen-desktop-state";
import type {
    KissopenAgentDirectoryStore,
    KissopenAgentDirectorySnapshot,
} from "./kissopenAgentDirectoryStore";

export interface DesktopConnectionUi {
    readonly router: KissopenAgentRouter;
    readonly commandPalette: CommandPaletteStore;
    readonly navigationOrder: KissopenAgentNavigationOrderStore;
    readonly sidebarCollapse: KissopenAgentSidebarCollapseStore;
    readonly sidebarVisibility: KissopenAgentSidebarVisibilityStore;
    readonly settings: KissopenAgentSettingsStore;
    readonly directory: KissopenAgentDirectoryStore;
    dispose(): void;
}

/** A stable renderer composition lifetime, with an ordinary router and isolated stores. */
export function desktopConnectionUiCreate(input: {
    readonly id: string;
    readonly directory: KissopenAgentDirectoryStore;
    readonly preferences: KissopenAgentModelPreferencePersistence;
    /** The window's own fold of its left side, shared by every connection. */
    readonly sidebarVisibility: KissopenAgentSidebarVisibilityStore;
    readonly main?: Omit<DesktopConnectionUi, "directory" | "dispose" | "sidebarVisibility">;
}): DesktopConnectionUi {
    const { id } = input;
    const key = `kissopen.connection-history.v1:${id}`;
    const history =
        input.main?.router.history ??
        kissopenAgentHistoryCreate({
            browser: false,
            persistence: {
                read() {
                    try {
                        const value = localStorage.getItem(key);
                        return value ? (JSON.parse(value) as unknown) : undefined;
                    } catch {
                        return undefined;
                    }
                },
                write(document) {
                    try {
                        localStorage.setItem(key, JSON.stringify(document));
                    } catch {
                        /* In-memory navigation still works. */
                    }
                },
            },
        });
    const router = input.main?.router ?? kissopenAgentRouterCreate(history);
    let entry = input.directory.get().kissopenAgents.find((item) => item.id === id);
    let snapshot: KissopenAgentDirectorySnapshot = {
        activeKissopenAgentId: id,
        kissopenAgents: entry ? [entry] : [],
    };
    const listeners = new Set<() => void>();
    const unsubscribe = input.directory.subscribe(() => {
        const next = input.directory.get().kissopenAgents.find((item) => item.id === id);
        if (next === entry) return;
        const materialized = next?.session !== entry?.session;
        entry = next;
        snapshot = { activeKissopenAgentId: id, kissopenAgents: next ? [next] : [] };
        for (const listener of listeners) listener();
        if (materialized) void router.invalidate();
    });
    const stored = input.preferences.read();
    const settings =
        input.main?.settings ??
        kissopenAgentSettingsStoreCreate({
            ...(stored?.defaultSelection
                ? {
                      defaultProviderId: stored.defaultSelection.providerId,
                      defaultModelId: stored.defaultSelection.modelId,
                  }
                : {}),
            ...(stored?.defaultEffort ? { defaultEffort: stored.defaultEffort } : {}),
            ...(stored?.defaultPermissionMode
                ? { defaultPermissionMode: stored.defaultPermissionMode }
                : {}),
        });
    const unsubscribeSettings = input.main
        ? undefined
        : settings.subscribe(() => {
              const value = settings.get();
              const current = input.preferences.read();
              input.preferences.write({
                  ...current,
                  preferences: current?.preferences ?? {},
                  defaultEffort: value.defaultEffort,
                  defaultPermissionMode: value.defaultPermissionMode,
                  ...(value.defaultProviderId && value.defaultModelId
                      ? {
                            defaultSelection: {
                                providerId: value.defaultProviderId,
                                modelId: value.defaultModelId,
                            },
                        }
                      : {}),
              });
          });
    return {
        router,
        settings,
        commandPalette: input.main?.commandPalette ?? commandPaletteStoreCreate(),
        navigationOrder: input.main?.navigationOrder ?? kissopenAgentNavigationOrderStoreCreate(),
        sidebarCollapse: input.main?.sidebarCollapse ?? kissopenAgentSidebarCollapseStoreCreate(),
        sidebarVisibility: input.sidebarVisibility,
        directory: {
            get: () => snapshot,
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            // Routing within an inactive connection must not select it globally.
            kissopenAgentActivate: () => undefined,
            kissopenAgentReorder: input.directory.kissopenAgentReorder,
        },
        dispose() {
            unsubscribe();
            unsubscribeSettings?.();
            listeners.clear();
            if (!input.main) history.destroy();
        },
    };
}
