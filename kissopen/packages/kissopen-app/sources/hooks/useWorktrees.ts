import * as React from 'react';
import { listWorktrees, type WorktreeInfo } from '@/utils/worktree';

/** Git discovery follows its target and explicit picker opens, not session-store updates. */
export function useWorktrees(machineId: string | null, basePath: string | null, enabled: boolean) {
    const [worktrees, setWorktrees] = React.useState<WorktreeInfo[]>([]);
    const [refreshVersion, refresh] = React.useReducer((version: number) => version + 1, 0);

    React.useEffect(() => {
        if (!enabled || !machineId || !basePath) {
            setWorktrees([]);
            return;
        }

        let cancelled = false;
        listWorktrees(machineId, basePath).then((result) => {
            if (!cancelled) setWorktrees(result);
        });
        // RPCs cannot be aborted; only the current target's reply may update the picker.
        return () => { cancelled = true; };
    }, [machineId, basePath, enabled, refreshVersion]);

    return { worktrees, refresh };
}