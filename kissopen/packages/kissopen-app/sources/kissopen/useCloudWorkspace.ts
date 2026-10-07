import * as React from 'react';
import { useAllSessions } from '@/sync/storage';
import { api } from './api/client';

/** Where a new cloud conversation runs. The image puts the account's work here. */
const CLOUD_WORKING_DIRECTORY = '/home/agent';

/** How often to ask again while the server is still bringing a workspace up. */
const PROVISIONING_POLL_MS = 3000;

export interface CloudWorkspaceLocation {
    /** The relay machine the account's cloud workspace registered as. */
    readonly machineId: string;
    /** The directory every cloud conversation runs in. */
    readonly directory: string;
}

export interface CloudWorkspace {
    /**
     * The server has a workspace for this account.
     *
     * True as soon as the server says so, which is well before any of the
     * workspace's sessions have synced. Anything that talks to the workspace
     * through this server — its plugins, for one — can go ahead on this alone,
     * and must, because waiting for a chat session to arrive first is how the
     * plugin list came to report "no plugins" without ever having asked.
     */
    readonly exists: boolean;
    /**
     * Where a new conversation runs. Absent until the workspace's own bot
     * session has synced, because that session is what names the machine.
     */
    readonly location?: CloudWorkspaceLocation;
}

interface CloudWorkspaceResponse {
    readonly bot_id?: string;
    readonly state?: string;
}

/**
 * Where this account's cloud conversations live.
 *
 * Chat on the home is a conversation with the account's cloud workspace, and a
 * conversation is a session: each one starts fresh, earns its own name, and
 * sits in the list beside every other. So what the home needs is not a
 * transcript to write into but the machine to start the next session on.
 *
 * The workspace is ensured rather than merely read. An account that has never
 * had one would otherwise never get one — nothing else asks — and the home
 * would quietly keep the older, separate chat instead, which is how the same
 * build came to show two different composers depending on the account. The
 * call is idempotent: it creates the workspace once and afterwards only
 * reconnects it.
 *
 * The machine is found through the workspace's own bot rather than guessed
 * from the machine list. The server names that bot — an account may run
 * several, and only the server knows which one it provisioned — and the bot's
 * session says which machine it is running on. That is the cloud container,
 * and it is the only machine this account did not set up itself.
 *
 * Absent is still an ordinary answer: while the container is starting, while
 * its first session is still syncing, or on a deployment without cloud
 * workspaces at all. Callers keep their previous behaviour when it is.
 */
export function useCloudWorkspace(enabled = true): CloudWorkspace {
    const [botId, setBotId] = React.useState<string>();
    const sessions = useAllSessions();

    React.useEffect(() => {
        if (!enabled) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const adopt = (space: CloudWorkspaceResponse | undefined) => {
            const id = space?.bot_id || undefined;
            if (id) setBotId(id);
            return id;
        };

        // Provisioning outlives this request: the server answers 202 once its
        // own bounded wait is up and keeps going, so a first run asks once and
        // then watches, rather than starting the work over.
        const watch = () => {
            timer = setTimeout(() => {
                void api<CloudWorkspaceResponse>('/cloud/workspace')
                    .then(space => { if (alive && !adopt(space)) watch(); })
                    .catch(() => { if (alive) watch(); });
            }, PROVISIONING_POLL_MS);
        };

        void api<CloudWorkspaceResponse>('/cloud/workspace', 'POST', {})
            .then(space => { if (alive && !adopt(space)) watch(); })
            // A deployment with no cloud workspaces, a revoked credential or a
            // server that is simply busy all land here. None of them is worth
            // saying anything about on the welcome page: the home keeps
            // working and the next launch asks again.
            .catch(() => undefined);

        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [enabled]);

    return React.useMemo(() => {
        if (!botId) return { exists: false };
        const machineId = sessions.find(session => session.metadata?.bot?.id === botId)?.metadata?.machineId;
        return machineId === undefined
            ? { exists: true }
            : { exists: true, location: { machineId, directory: CLOUD_WORKING_DIRECTORY } };
    }, [botId, sessions]);
}
