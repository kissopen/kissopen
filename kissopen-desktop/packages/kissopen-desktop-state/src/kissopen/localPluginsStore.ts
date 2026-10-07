import type { CatalogList, CatalogPlugin, CloudPlugin, CloudPluginsList } from "./api.gen.js";
import type { KissopenTransport } from "./kissopenStore.js";
import { t } from "../i18n/locale.js";

export interface LocalPluginsSnapshot {
    readonly installed: readonly CloudPlugin[];
    readonly catalog: readonly CatalogPlugin[];
    readonly loading: boolean;
    readonly applying: boolean;
    readonly activation: string;
    readonly error: string;
    readonly busy: string | null;
}
const empty: LocalPluginsSnapshot = {
    installed: [],
    catalog: [],
    loading: true,
    applying: false,
    activation: "",
    error: "",
    busy: null,
};

/** On-demand local-plugin surface. No transport or timers exist until subscribed. */
export class LocalPluginsStore {
    private state = empty;
    private readonly listeners = new Set<() => void>();
    private generation = 0;
    private revision = 0;
    private timer: ReturnType<typeof setInterval> | undefined;
    private readingGeneration: number | undefined;
    constructor(private readonly request: KissopenTransport["request"]) {}
    get = (): LocalPluginsSnapshot => this.state;
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            void this.load();
            void this.catalogLoad();
            this.timer = setInterval(() => {
                void this.load();
            }, 4000);
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size) return;
            clearInterval(this.timer);
            this.timer = undefined;
            ++this.generation;
            ++this.revision;
            this.state = empty; // Never retain one account's plugins after unmount/sign-out.
        };
    };
    private set(change: Partial<LocalPluginsSnapshot>): void {
        this.state = { ...this.state, ...change };
        for (const listener of this.listeners) listener();
    }
    private async call<T>(
        path: string,
        method: "GET" | "POST" = "GET",
        body?: Readonly<Record<string, unknown>>,
    ): Promise<T> {
        const response = await this.request(path, method, body);
        const value = JSON.parse(response.text) as T & { error?: string };
        if (response.status < 200 || response.status >= 300)
            throw new Error(value.error || t("请求未完成"));
        return value;
    }
    private async catalogLoad(): Promise<void> {
        const generation = this.generation;
        try {
            const answer = await this.call<CatalogList>("/cloud/catalog");
            if (generation === this.generation) this.set({ catalog: answer.plugins });
        } catch {
            /* Installing a local archive does not depend on catalog availability. */
        }
    }
    private async load(): Promise<void> {
        if (this.readingGeneration === this.generation) return;
        const generation = this.generation;
        this.readingGeneration = generation;
        const revision = this.revision;
        try {
            const answer = await this.call<CloudPluginsList>("/cloud/plugins");
            if (generation === this.generation && revision === this.revision)
                this.set({
                    installed: answer.plugins,
                    applying: answer.applying,
                    activation: answer.error ?? "",
                    loading: false,
                });
        } catch (error) {
            if (generation === this.generation && revision === this.revision)
                this.set({
                    error: error instanceof Error ? error.message : t("请求未完成"),
                    loading: false,
                });
        } finally {
            if (this.readingGeneration === generation) this.readingGeneration = undefined;
        }
    }
    private async act(
        id: string,
        path: string,
        body: Readonly<Record<string, unknown>>,
    ): Promise<void> {
        if (this.state.busy !== null || this.state.applying) return;
        const generation = this.generation;
        ++this.revision;
        this.set({ busy: id, error: "" });
        try {
            await this.call(path, "POST", body);
            if (generation === this.generation) await this.load();
        } catch (error) {
            if (generation === this.generation)
                this.set({ error: error instanceof Error ? error.message : t("请求未完成") });
        } finally {
            if (generation === this.generation) this.set({ busy: null });
        }
    }
    pluginEnable = (id: string, enabled: boolean): void => {
        void this.act(id, `/cloud/plugins/${encodeURIComponent(id)}`, { enabled });
    };
    pluginRemove = (id: string): void => {
        void this.act(id, `/cloud/plugins/${encodeURIComponent(id)}`, {
            enabled: false,
            remove: true,
        });
    };
    pluginInstall = (id: string): void => {
        void this.act(id, `/cloud/catalog/${encodeURIComponent(id)}`, {});
    };
    selectionApply = (): void => {
        void this.act("apply", "/cloud/plugins/apply", {});
    };
    archiveImport = async (file: File): Promise<void> => {
        const generation = this.generation;
        try {
            if (!file.name.toLowerCase().endsWith(".zip") || file.size > 8 * 1024 * 1024)
                throw new Error(t("请选择不超过 8 MB 的插件 ZIP 文件。"));
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (generation !== this.generation || !this.listeners.size) return;
            let text = "";
            for (let at = 0; at < bytes.length; at += 8192)
                text += String.fromCharCode(...bytes.subarray(at, at + 8192));
            await this.act("import", "/cloud/plugins", { archive: btoa(text) });
        } catch (error) {
            if (generation !== this.generation || !this.listeners.size) return;
            this.set({
                error: error instanceof Error ? error.message : t("插件安装失败，请检查文件格式。"),
            });
        }
    };
}
