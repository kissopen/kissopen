/*
The plugins of the account's cloud workspace.

What it has, then what it could have. Two lists rather than one, because the
questions are different: the first is "what is my assistant running", the
second is "what else is there".

These are the cloud workspace's plugins and nothing else. The local Agent's MCP
configuration is a separate thing with a separate backend, and putting both on
one page would invite a person to switch something here and wonder why the
machine in front of them did not change.
*/
import { useCallback, useEffect, useState } from "react";
import { Banner, PluginLibrary, type LibraryPlugin } from "kissopen-desktop-ui";
import { t } from "kissopen-desktop-state";
import type { CatalogPlugin, CloudPlugin } from "kissopen-desktop-state";
import {
    catalogInstall,
    catalogRead,
    pluginConnectionDisconnect,
    pluginConnectionStart,
    pluginSet,
    pluginsApply,
    pluginsRead,
    type CloudRequest,
} from "./relayCloudApi";

/*
How often to look again while a restart is in flight.

Only then: applying is the one thing here that finishes on its own, and a page
that polled at rest would ask a container a question nobody had raised.
*/
const APPLYING_INTERVAL_MS = 4_000;
/*
How long to keep looking after sending somebody off to approve an account.

The approval happens in their browser and lands on the server, not here; the
only way this window learns of it is by asking again. Ten minutes is the life
of the link they were sent, so there is nothing to see after it.
*/
const CONNECTING_WINDOW_MS = 10 * 60 * 1000;

export function RelayPluginsView(props: {
    readonly request: CloudRequest;
    /** Opens a page in the system browser, where the person's accounts are signed in. */
    readonly openLink: (url: string) => Promise<boolean>;
}) {
    const [installed, setInstalled] = useState<readonly CloudPlugin[]>([]);
    const [catalog, setCatalog] = useState<readonly CatalogPlugin[]>([]);
    const [applying, setApplying] = useState(false);
    /** Why the last selection did not activate, as the workspace reports it. */
    const [activation, setActivation] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    /** The plugin a request is in flight for, so its row stops accepting more. */
    const [busy, setBusy] = useState<string | null>(null);
    /** Until when to keep asking whether an account has been connected. */
    const [connectingUntil, setConnectingUntil] = useState(0);

    const reload = useCallback(
        async (signal: { cancelled: boolean }) => {
            try {
                const answer = await pluginsRead(props.request);
                if (signal.cancelled) return;
                setInstalled(answer.plugins);
                setApplying(answer.applying);
                setActivation(answer.error ?? "");
                setError("");
            } catch (thrown) {
                if (!signal.cancelled) setError((thrown as Error).message);
            } finally {
                if (!signal.cancelled) setLoading(false);
            }
        },
        [props.request],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        void reload(signal);
        /*
         * The catalog is read once. It changes when somebody publishes, which
         * is rare and never because of anything happening in this window.
         */
        catalogRead(props.request)
            .then((read) => {
                if (!signal.cancelled) setCatalog(read);
            })
            .catch(() => {
                // A deployment with no catalog is an ordinary state, not a
                // failure of the page: the installed list is still the answer
                // to what this workspace is running.
                if (!signal.cancelled) setCatalog([]);
            });
        return () => {
            signal.cancelled = true;
        };
    }, [reload, props.request]);

    const connecting = connectingUntil > Date.now();
    useEffect(() => {
        if (!applying && !connecting) return;
        const signal = { cancelled: false };
        const timer = setInterval(() => {
            if (connectingUntil && connectingUntil <= Date.now()) setConnectingUntil(0);
            void reload(signal);
        }, APPLYING_INTERVAL_MS);
        return () => {
            signal.cancelled = true;
            clearInterval(timer);
        };
    }, [applying, connecting, connectingUntil, reload]);

    const act = useCallback(
        async (id: string, work: () => Promise<void>) => {
            setBusy(id);
            try {
                await work();
                await reload({ cancelled: false });
            } catch (thrown) {
                setError((thrown as Error).message);
            } finally {
                setBusy(null);
            }
        },
        [reload],
    );

    /*
     * A selection differs from what is running. That is what the restart is
     * for, and the reason the control is offered rather than pressed
     * automatically: a person switching three plugins should restart once.
     */
    const pending = installed.some((plugin) => plugin.enabled !== plugin.active || plugin.removed);

    const entries: LibraryPlugin[] = installed.map((plugin) => ({
        id: plugin.id,
        name: plugin.name || plugin.id,
        description: plugin.description,
        icon: catalog.find((item) => item.id === plugin.id)?.icon,
        version: plugin.version,
        skills: plugin.skills,
        installed: true,
        enabled: plugin.enabled && !plugin.removed,
        status: plugin.removed
            ? t("Removed")
            : plugin.enabled !== plugin.active
              ? t("Pending restart")
              : plugin.connections?.some(
                      (connection) => connection.required && !connection.connected,
                  )
                ? t("Needs an account")
                : plugin.active
                  ? t("已启用")
                  : t("未启用"),
        notice:
            plugin.unsupported.length > 0
                ? t("Not supported here: {parts}", { parts: plugin.unsupported.join(", ") })
                : undefined,
        disabled: busy !== null || applying || plugin.removed,
        busy: busy === plugin.id,
        onToggle: (enabled) =>
            void act(plugin.id, () => pluginSet(props.request, plugin.id, { enabled })),
        onRemove: () =>
            void act(plugin.id, () =>
                pluginSet(props.request, plugin.id, { enabled: false, remove: true }),
            ),
        connections: (plugin.connections ?? []).map((connection) => ({
            id: connection.server,
            name: connection.server,
            connected: connection.connected,
            error: connection.error,
            onConnect: () =>
                void act(plugin.id, async () => {
                    if (connection.connected) {
                        await pluginConnectionDisconnect(
                            props.request,
                            plugin.id,
                            connection.server,
                        );
                        return;
                    }
                    const url = await pluginConnectionStart(
                        props.request,
                        plugin.id,
                        connection.server,
                    );
                    if (!(await props.openLink(url)))
                        throw new Error(t("The authorization page could not be opened."));
                    setConnectingUntil(Date.now() + CONNECTING_WINDOW_MS);
                }),
        })),
    }));
    for (const entry of catalog) {
        if (installed.some((plugin) => plugin.id === entry.id)) continue;
        entries.push({
            id: entry.id,
            name: entry.id,
            description: entry.description,
            icon: entry.icon,
            version: entry.version,
            skills: entry.skills,
            installed: false,
            enabled: false,
            status: entry.needs_connection
                ? t("Needs an account")
                : t("{count} skills", { count: entry.skills }),
            notice: entry.partial?.length
                ? t("Not supported here: {parts}", { parts: entry.partial.join(", ") })
                : undefined,
            disabled: busy !== null || applying,
            busy: busy === entry.id,
            onInstall: () => void act(entry.id, () => catalogInstall(props.request, entry.id)),
            connections: [],
        });
    }
    return (
        <PluginLibrary
            plugins={entries}
            loading={loading}
            notices={
                <>
                    {error ? (
                        <Banner tone="danger" title={t("Plugins")}>
                            {error}
                        </Banner>
                    ) : null}
                    {activation ? (
                        // It travels with the list because the list is the page the
                        // person is looking at when it matters.
                        <Banner tone="danger" title={t("A plugin did not activate")}>
                            {activation}
                        </Banner>
                    ) : null}
                    {connecting && !applying ? (
                        <Banner tone="neutral" title={t("Finish in your browser")}>
                            {t("Approve the connection there; this page updates when it lands.")}
                        </Banner>
                    ) : null}
                    {applying ? (
                        <Banner tone="neutral" title={t("Restarting the assistant")}>
                            {t("Your selection is being applied.")}
                        </Banner>
                    ) : pending ? (
                        <Banner
                            tone="neutral"
                            title={t("Not running yet")}
                            action={{
                                label: t("Restart and apply"),
                                onClick: () => void act("", () => pluginsApply(props.request)),
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
