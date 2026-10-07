import * as React from 'react';
import { AppState } from 'react-native';
import type { WorkProject } from './ProjectPage';
import { boardCached, boardRead, type ProjectBoardState } from './useProjectBoard';

const POLL_MS = 60_000;

/**
 * Every project's board while the home page is on screen, for the summary
 * it is made of. Each board is read where its project is — the cloud, or a
 * computer — and read again every minute, because the boards are rebuilt by
 * schedules and nothing tells the phone when. A computer that does not
 * answer keeps the board it showed a minute ago; a project with no board
 * yet simply has none.
 *
 * Before any computer answers, each project shows the board this phone last
 * read for it (boardCached), so the summary is there at once and offline.
 */
export function useProjectBoards(projects: readonly WorkProject[], active: boolean): ReadonlyMap<string, ProjectBoardState> {
    const [boards, setBoards] = React.useState<ReadonlyMap<string, ProjectBoardState>>(new Map());
    // Which projects to read, as a value that changes only when a project comes or goes.
    const key = projects.map(project => `${project.id}\t${project.rootSessionId ?? ''}`).join('\n');
    const latest = React.useRef(projects);
    latest.current = projects;
    React.useEffect(() => {
        if (key === '') return;
        // Kept boards fill in only what nothing has been read for yet.
        setBoards(current => {
            let next: Map<string, ProjectBoardState> | undefined;
            for (const project of latest.current) {
                if (current.has(project.id)) continue;
                const kept = boardCached(project.machineId, project.path);
                if (!kept) continue;
                next ??= new Map(current);
                next.set(project.id, kept);
            }
            return next ?? current;
        });
    }, [key]);
    React.useEffect(() => {
        if (!active || key === '') return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            if (!alive) return;
            if (AppState.currentState !== 'background') {
                const read = await Promise.all(latest.current.map(async project => {
                    const result = await boardRead(project.machineId, project.path, project.rootSessionId);
                    // The board with project.json's card states over it; nothing when the computer did not answer.
                    const state: ProjectBoardState | undefined = result.kind === 'read' ? result.state : undefined;
                    // A kept board stands in for a computer that did not answer (or could
                    // not say for sure there is none), but never over one already shown.
                    const kept: ProjectBoardState | undefined = result.kind === 'cached' || result.kind === 'unsure' ? result.state : undefined;
                    return [project.id, state, kept] as const;
                }));
                if (!alive) return;
                setBoards(current => {
                    let next: Map<string, ProjectBoardState> | undefined;
                    for (const [id, fresh, kept] of read) {
                        const shown = current.get(id);
                        const state = fresh ?? (shown ? undefined : kept);
                        if (!state) continue;
                        if (shown && JSON.stringify(shown) === JSON.stringify(state)) continue;
                        next ??= new Map(current);
                        next.set(id, state);
                    }
                    return next ?? current;
                });
            }
            if (alive) timer = setTimeout(() => void tick(), POLL_MS);
        };
        void tick();
        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [active, key]);
    return boards;
}
