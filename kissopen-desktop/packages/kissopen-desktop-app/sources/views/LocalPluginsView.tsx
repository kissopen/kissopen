import { useSyncExternalStore } from "react";
import { t, type LocalPluginsStore } from "kissopen-desktop-state";
import { Banner, PluginLibrary, type LibraryPlugin } from "kissopen-desktop-ui";

export function LocalPluginsView(props: { store: LocalPluginsStore }) {
    const state = useSyncExternalStore(props.store.subscribe, props.store.get, props.store.get);
    const disabled = state.busy !== null || state.applying;
    const pending = state.installed.some(
        (plugin) => plugin.enabled !== plugin.active || plugin.removed,
    );
    const entries: LibraryPlugin[] = state.installed.map((plugin) => ({
        id: plugin.id,
        name: state.catalog.find((item) => item.id === plugin.id)?.title || plugin.name,
        description: plugin.description,
        icon: state.catalog.find((item) => item.id === plugin.id)?.icon,
        version: plugin.version,
        skills: plugin.skills,
        servers: plugin.servers,
        executionLocation: t("本机 Agent"),
        connectionsManagedElsewhere: true,
        installed: true,
        enabled: plugin.enabled && !plugin.removed,
        status: plugin.removed
            ? t("Removed")
            : plugin.active !== plugin.enabled
              ? t("Pending restart")
              : plugin.active
                ? t("已启用")
                : t("未启用"),
        notice: plugin.unsupported.length
            ? t("Not supported here: {parts}", { parts: plugin.unsupported.join(", ") })
            : undefined,
        disabled: disabled || plugin.removed,
        busy: state.busy === plugin.id,
        onToggle: (enabled) => props.store.pluginEnable(plugin.id, enabled),
        onRemove: () => props.store.pluginRemove(plugin.id),
        connections: [],
    }));
    for (const item of state.catalog) {
        if (state.installed.some((plugin) => plugin.id === item.id)) continue;
        entries.push({
            id: item.id,
            name: item.title || item.id,
            description: item.description,
            icon: item.icon,
            version: item.version,
            skills: item.skills,
            servers: item.servers,
            executionLocation: t("本机 Agent"),
            connectionsManagedElsewhere: true,
            installed: false,
            enabled: false,
            status: item.needs_connection
                ? t("Needs an account")
                : t("{count} skills", { count: item.skills }),
            notice: item.needs_connection
                ? t("需要账号授权的 MCP 请在本机 Agent 的 MCP 设置中配置。")
                : undefined,
            disabled,
            busy: state.busy === item.id,
            onInstall: () => props.store.pluginInstall(item.id),
            connections: [],
        });
    }
    return (
        <PluginLibrary
            plugins={entries}
            loading={state.loading}
            importDisabled={disabled}
            connectionsVisible={false}
            description={t(
                "管理本机 Agent 的插件。安装后启用并应用；不会修改你已有的技能或 MCP 配置。",
            )}
            onImport={props.store.archiveImport}
            notices={
                <>
                    {state.error ? (
                        <Banner tone="danger" title={t("插件")}>
                            {state.error}
                        </Banner>
                    ) : null}
                    {state.activation ? (
                        <Banner tone="danger" title={t("A plugin did not activate")}>
                            {state.activation}
                        </Banner>
                    ) : null}
                    {state.applying ? (
                        <Banner tone="neutral" title={t("Restarting the assistant")}>
                            {t("Your selection is being applied.")}
                        </Banner>
                    ) : pending ? (
                        <Banner
                            tone="neutral"
                            title={t("Not running yet")}
                            action={{
                                label: t("Restart and apply"),
                                onClick: props.store.selectionApply,
                            }}
                        >
                            {t("Your selection takes effect when the assistant restarts.")}
                        </Banner>
                    ) : null}
                </>
            }
        />
    );
}
