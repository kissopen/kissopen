import * as React from 'react';
import { api } from './api/client';
import { t } from '@/text';

/** One installed plugin, as the tenant container's catalog reports it. */
export interface CloudPlugin {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly digest: string;
    readonly enabled: boolean;
    /** Live in the running Agent. False until the next apply picks it up. */
    readonly active: boolean;
    readonly removed: boolean;
    readonly skills: number;
    readonly skill_root: string;
    readonly servers: number;
    /** Parts of the package this host does not run, named so the reader knows. */
    readonly unsupported: readonly string[];
    readonly format: string;
}

export interface CloudPluginsState {
    readonly plugins: readonly CloudPlugin[];
    /** The Agent is restarting to take the current selection up. */
    readonly applying: boolean;
    readonly loading: boolean;
    /** The list itself could not be read. */
    readonly error: string;
    /**
     * The selection was recorded but the Agent is not running it.
     *
     * Separate from `error` because the two ask for different things: a list
     * that will not load is nothing the reader can act on, while a selection
     * that will not activate names the plugin to turn off, and can be retried.
     */
    readonly applyError: string;
    reload(): Promise<void>;
    /** Asks the Agent to take the recorded selection up, again. */
    retryApply(): Promise<void>;
    /** Enables or disables one plugin, then asks the Agent to take it up. */
    setEnabled(id: string, enabled: boolean): Promise<void>;
    remove(id: string): Promise<void>;
    /**
     * Begins connecting an account to one of a plugin's servers, and says
     * where the person has to go to approve it.
     *
     * The approval happens in their browser, against that service, and comes
     * back to this server: nothing in this app sees their password, and the
     * token it issues is held by the workspace rather than the phone.
     */
    connect(id: string, server: string): Promise<string>;
    disconnect(id: string, server: string): Promise<void>;
}

/** What the gateway says when a request carried no readable reason. */
function reason(e: unknown): string {
    const message = e instanceof Error ? e.message : String(e);
    return message.trim() || t('kissopen.plugins.applyFailedUnknown');
}

/**
 * The plugins installed in this account's cloud workspace.
 *
 * A plugin is installed into the workspace's own container and only reaches the
 * Agent when it is applied, which restarts it. So `enabled` is what the reader
 * asked for and `active` is what the Agent is actually running — the two differ
 * for as long as an apply is in flight, and the list says so rather than
 * pretending the change already landed.
 *
 * They differ for longer than that when an apply fails, which is the case this
 * has to be honest about: the switch moved, the Agent did not, and a list that
 * quietly showed the switch would be describing something that is not running.
 *
 * Polls only while an apply is running. There is nothing else that changes this
 * list without the reader doing it.
 */
export function useCloudPlugins(enabled: boolean): CloudPluginsState {
    const [plugins, setPlugins] = React.useState<readonly CloudPlugin[]>([]);
    const [applying, setApplying] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [applyError, setApplyError] = React.useState('');
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const reload = React.useCallback(async () => {
        if (!enabled) { setLoading(false); return; }
        try {
            const data = await api<{ plugins?: CloudPlugin[]; applying?: boolean; error?: string }>('/cloud/plugins');
            if (!alive.current) return;
            setPlugins(data.plugins ?? []);
            setApplying(!!data.applying);
            setError('');
            // The gateway reports an activation it could not complete even when
            // nobody is mid-request — a container that came back to a selection
            // it cannot run says so here, and the reader needs to see it on
            // arrival rather than only after pressing something.
            if (data.error) setApplyError(data.error);
            else if (!data.applying) setApplyError('');
        } catch (e) {
            if (alive.current) setError(reason(e));
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [enabled]);

    React.useEffect(() => { void reload(); }, [reload]);

    // An apply restarts the Agent, so the only thing that moves without the
    // reader is the moment it finishes. Stop asking as soon as it has.
    React.useEffect(() => {
        if (!applying) return;
        const timer = setInterval(() => { void reload(); }, 3000);
        return () => clearInterval(timer);
    }, [applying, reload]);

    // Taking the selection up restarts the Agent; recording it alone would
    // leave the choice saved but not running. Reported separately for exactly
    // that reason: the first half can succeed while the second fails.
    const apply = React.useCallback(async () => {
        try {
            await api('/cloud/plugins/apply', 'POST', {});
            if (alive.current) setApplyError('');
        } catch (e) {
            if (alive.current) setApplyError(reason(e));
        }
        await reload();
    }, [reload]);

    const mutate = React.useCallback(async (id: string, body: { enabled?: boolean; remove?: boolean }) => {
        // Recording the choice is the reader's request; if this fails nothing
        // changed and the caller should hear about it.
        await api(`/cloud/plugins/${encodeURIComponent(id)}`, 'POST', body);
        await apply();
    }, [apply]);

    /*
     * Connecting an account to one of a plugin's servers.
     *
     * The approval happens in the person's browser, against that service, and
     * returns to this server: nothing in this app sees their password, and the
     * token it issues is held by the workspace rather than the phone. All this
     * does is ask where to send them.
     */
    const connect = React.useCallback(async (id: string, server: string) => {
        const answer = await api<{ authorization_url?: string }>(
            `/cloud/plugins/${encodeURIComponent(id)}/connections/${encodeURIComponent(server)}`,
            'POST',
            {},
        );
        if (!answer.authorization_url) throw new Error(t('kissopen.errors.serverError'));
        return answer.authorization_url;
    }, []);

    const disconnect = React.useCallback(async (id: string, server: string) => {
        await api(
            `/cloud/plugins/${encodeURIComponent(id)}/connections/${encodeURIComponent(server)}/disconnect`,
            'POST',
            {},
        );
        await reload();
    }, [reload]);

    return {
        plugins,
        applying,
        loading,
        error,
        applyError,
        reload,
        retryApply: apply,
        setEnabled: React.useCallback((id: string, value: boolean) => mutate(id, { enabled: value }), [mutate]),
        remove: React.useCallback((id: string) => mutate(id, { remove: true }), [mutate]),
        connect,
        disconnect,
    };
}
