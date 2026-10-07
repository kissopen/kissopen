import { t } from "../i18n/locale.js";
import type { BillingHistory, BillingHistoryRequest } from "./api.gen.js";

export type BillingHistoryKind = "all" | "plan" | "points";
export interface BillingHistorySnapshot {
    readonly kind: BillingHistoryKind;
    readonly page: number;
    readonly history: BillingHistory | null;
    readonly loading: boolean;
    readonly error: string;
}

/** Purchases only; memory is discarded at the owning account boundary. */
export function billingHistoryStoreCreate(
    read: (request: BillingHistoryRequest) => Promise<BillingHistory>,
) {
    const initial: BillingHistorySnapshot = {
        kind: "all",
        page: 1,
        history: null,
        loading: false,
        error: "",
    };
    let snapshot = initial;
    let cursors = [""];
    let revision = 0;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listeners = new Set<() => void>();
    const publish = (patch: Partial<BillingHistorySnapshot>) => {
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners) listener();
    };
    const load = async () => {
        if (pending || !listeners.size) return;
        pending = true;
        const current = revision;
        publish({ loading: true });
        try {
            const history = await read({
                kind: snapshot.kind,
                cursor: cursors[snapshot.page - 1] ?? "",
            });
            if (current === revision) publish({ history, error: "" });
        } catch (error) {
            if (current === revision)
                publish({
                    error:
                        error instanceof Error ? error.message : t("账单暂时无法加载，请稍后再试"),
                });
        } finally {
            if (current === revision) {
                pending = false;
                publish({ loading: false });
                clearTimeout(timer);
                if (listeners.size) timer = setTimeout(() => void load(), 5_000);
            }
        }
    };
    const navigate = (patch: Partial<BillingHistorySnapshot>) => {
        revision++;
        pending = false;
        clearTimeout(timer);
        publish({ ...patch, history: null, error: "", loading: true });
        void load();
    };
    return {
        get: () => snapshot,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            if (listeners.size === 1) void load();
            return () => {
                listeners.delete(listener);
                if (!listeners.size) {
                    revision++;
                    pending = false;
                    clearTimeout(timer);
                }
            };
        },
        reset: () => {
            revision++;
            pending = false;
            cursors = [""];
            clearTimeout(timer);
            publish(initial);
        },
        select: (kind: BillingHistoryKind) => {
            if (kind === snapshot.kind) return;
            cursors = [""];
            navigate({ kind, page: 1 });
        },
        next: () => {
            const cursor = snapshot.history?.next_cursor;
            if (!cursor || snapshot.loading) return;
            cursors = [...cursors.slice(0, snapshot.page), cursor];
            navigate({ page: snapshot.page + 1 });
        },
        previous: () => {
            if (snapshot.page <= 1 || snapshot.loading) return;
            navigate({ page: snapshot.page - 1 });
        },
    };
}
export type BillingHistoryStore = ReturnType<typeof billingHistoryStoreCreate>;
