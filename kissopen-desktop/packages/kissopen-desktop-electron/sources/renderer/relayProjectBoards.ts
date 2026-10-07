import {
    projectBoardsStoreCreate,
    type ProjectBoardsStore,
    type KissopenStore,
} from "kissopen-desktop-state";
import type { KissopenDesktopBridge } from "../shared/desktopContract";

// Retained across project-page and shell remounts, never across sign-out.
const accounts = new WeakMap<
    KissopenStore,
    {
        readonly accountId: string | undefined;
        readonly store: ProjectBoardsStore;
        readonly dispose: () => void;
    }
>();

export function relayProjectBoardsFor(
    bridge: KissopenDesktopBridge,
    account: KissopenStore,
): ProjectBoardsStore {
    const existing = accounts.get(account);
    const accountId = account.get().user?.id;
    if (existing?.accountId === accountId && existing) return existing.store;
    existing?.dispose();
    const store = projectBoardsStoreCreate({
        async read(address, file, source) {
            if (!accountId || account.get().user?.id !== accountId)
                return { status: "unavailable", error: "Account changed" };
            const result = await bridge.relayFileRead(address.sessionId, `.kissopen/${file}`, {
                accountId,
                source,
                machineId: address.machineId,
                projectId: address.projectId,
                projectPath: address.path,
            });
            if (!result.ok)
                return result.reason === "uncached"
                    ? { status: "uncached" }
                    : { status: "unavailable", error: result.error };
            const bytes = Uint8Array.from(atob(result.base64), (character) =>
                character.charCodeAt(0),
            );
            return { status: "found", content: new TextDecoder().decode(bytes) };
        },
    });
    const dispose = (): void => {
        if (accounts.get(account)?.store === store) accounts.delete(account);
        store.dispose();
        unsubscribe();
    };
    const unsubscribe = account.subscribe(() => {
        if (account.get().user?.id === accountId) return;
        dispose();
    });
    accounts.set(account, { accountId, store, dispose });
    return store;
}
