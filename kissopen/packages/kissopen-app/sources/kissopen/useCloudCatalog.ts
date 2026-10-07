import * as React from 'react';
import { api } from './api/client';

/** One package this deployment publishes, ready to install into a workspace. */
export interface CatalogPlugin {
    readonly id: string;
    readonly version: string;
    /** What its author calls it, which is rarely the identifier. */
    readonly title?: string;
    readonly description: string;
    readonly skills: number;
    readonly servers: number;
    readonly bytes: number;
    readonly sha256: string;
    /**
     * The plugin's own mark, absolute and public. Absent for a package whose
     * author shipped none, and the row falls back to the generic piece.
     */
    readonly icon?: string;
    /** One of its MCP servers is behind an account connection. */
    readonly needs_connection?: boolean;
    /** And it has nothing else, so it cannot usefully be installed yet. */
    readonly connection_only?: boolean;
    readonly file: string;
    /** Parts of the original package this build left out, if any. */
    readonly partial?: readonly string[];
}

export interface CloudCatalogState {
    readonly plugins: readonly CatalogPlugin[];
    readonly loading: boolean;
    readonly error: string;
    /** The id currently being installed, so one row can say so. */
    readonly installing: string;
    reload(): Promise<void>;
    /** Installs one package; resolves once the workspace has it. */
    install(id: string): Promise<void>;
}

/**
 * The plugins this deployment publishes.
 *
 * Distinct from the workspace's own list: that one is what is installed, this
 * one is what can be. Nothing is downloaded by the phone — it asks by name and
 * the server reads the package from its own disk, checks it against the digest
 * it published, and hands it to the workspace. So a package cannot be
 * substituted by anything the phone sends, and a two-megabyte upload never
 * crosses a mobile connection.
 */
export function useCloudCatalog(enabled: boolean): CloudCatalogState {
    const [plugins, setPlugins] = React.useState<readonly CatalogPlugin[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [installing, setInstalling] = React.useState('');
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const reload = React.useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        try {
            const data = await api<{ plugins?: CatalogPlugin[] }>('/cloud/catalog');
            if (!alive.current) return;
            setPlugins(data.plugins ?? []);
            setError('');
        } catch (e) {
            if (alive.current) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [enabled]);

    React.useEffect(() => { void reload(); }, [reload]);

    const install = React.useCallback(async (id: string) => {
        setInstalling(id);
        try {
            await api(`/cloud/catalog/${encodeURIComponent(id)}`, 'POST', {});
        } finally {
            if (alive.current) setInstalling('');
        }
    }, []);

    return { plugins, loading, error, installing, reload, install };
}
