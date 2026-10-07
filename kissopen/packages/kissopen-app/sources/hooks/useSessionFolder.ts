import * as React from 'react';
import { sessionListDirectory } from '@/sync/ops';

export type SessionFolderEntry = {
    name: string;
    /** Relative to the session's folder, the way the file screen opens it. */
    path: string;
    directory: boolean;
    size?: number;
};

export type SessionFolderState =
    | { status: 'loading' }
    | { status: 'ready'; entries: readonly SessionFolderEntry[] }
    | { status: 'unavailable' };

/** How long to wait before asking a computer that did not answer again. */
const RETRY_MS = 5000;

/**
 * One folder of a session's workspace, read through the session's daemon.
 *
 * Folders come first, then files, each by name. A daemon that does not answer
 * (the computer asleep, the connection dropping) is asked again every few
 * seconds for as long as the folder is on screen; the folder shows as
 * unavailable meanwhile. `path` is relative to the session's folder, `''` for
 * the folder itself.
 */
export function useSessionFolder(sessionId: string, path: string): SessionFolderState {
    const [state, setState] = React.useState<SessionFolderState>({ status: 'loading' });
    React.useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        setState({ status: 'loading' });
        const read = async () => {
            const response = await sessionListDirectory(sessionId, path);
            if (!alive) return;
            if (!response.success || !response.entries) {
                setState({ status: 'unavailable' });
                timer = setTimeout(() => void read(), RETRY_MS);
                return;
            }
            const entries = response.entries
                .filter(entry => entry.type !== 'other')
                .map(entry => ({
                    name: entry.name,
                    path: path === '' ? entry.name : `${path}/${entry.name}`,
                    directory: entry.type === 'directory',
                    size: entry.size,
                }))
                .sort((a, b) => a.directory === b.directory
                    ? a.name.localeCompare(b.name)
                    : a.directory ? -1 : 1);
            setState({ status: 'ready', entries });
        };
        void read();
        return () => {
            alive = false;
            if (timer !== undefined) clearTimeout(timer);
        };
    }, [sessionId, path]);
    return state;
}
