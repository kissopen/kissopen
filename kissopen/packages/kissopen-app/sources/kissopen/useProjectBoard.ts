import * as React from 'react';
import { AppState } from 'react-native';
import { machineBash, machineReadProjectFile, sessionReadFile } from '@/sync/ops';
import { storage } from '@/sync/storage';
import { relayCache } from '@/sync/offlineCache/relayCache';
import { api } from './api/client';
import type { Schedule, ScheduleBody, ScheduleRunStarted } from './api/types';
import { cloudCache } from './cloudCache';
import { boardStateOf, PROJECT_BOARD_PATH, type BoardFilesState } from './projectBoard';
import { PROJECT_STATE_PATH, projectStateParse } from './projectState';
import { schedulesFetch } from './useSchedules';
import { projectFileReadVia, type ProjectFileRead, type ProjectFileReaders } from './projectFileRead';

export type ProjectBoardState =
    | { readonly status: 'loading' }
    /**
     * `missing`: no board has been built for the project yet. `ready`: the
     * board, with project.json's card states laid over it. `invalid`: the file
     * is there but is not a board the phone can draw.
     */
    | BoardFilesState
    /** The computer could not be asked: it is off, asleep or offline. */
    | { readonly status: 'offline' };

export type ProjectBoardBuild = {
    /** The schedule that builds this project's board, when the account has one. */
    readonly schedule?: Schedule;
    readonly running: boolean;
    readonly error: string;
};

const POLL_MS = 20_000;
/** The part of GET /schedules a board reads. */
type BoardSchedules = { schedules?: Schedule[] };
/** A run in one of these has not finished; the board it writes is still coming. */
const IN_FLIGHT = new Set(['queued', 'waiting_device', 'accepted', 'running', 'needs_user']);

/**
 * One project's board while its page is on screen.
 *
 * The board is a file in the project's folder on the person's computer, so it
 * is read through that computer: `cat` in the folder, over the relay. It is
 * read when the page opens and every little while after, because the desktop
 * rebuilds it on a schedule and nothing tells the phone when. The schedule
 * that builds it is the account's and lives on the server, so "update now"
 * asks the server to run it — the computer does the building either way.
 *
 * The board last read is kept on the phone (see boardRead), so the page opens
 * on it and keeps showing it while the computer or the cloud cannot be
 * reached; each read that lands replaces it.
 */
export function useProjectBoard(machineId: string, path: string, active: boolean, sessionId?: string, cloud = false) {
    const [board, setBoard] = React.useState<ProjectBoardState>(() => boardCached(machineId, path) ?? { status: 'loading' });
    const [schedule, setSchedule] = React.useState<Schedule>();
    const [running, setRunning] = React.useState(false);
    const [error, setError] = React.useState('');
    const readRef = React.useRef<() => Promise<void>>(async () => {});

    React.useEffect(() => {
        setBoard(boardCached(machineId, path) ?? { status: 'loading' });
        setError('');
        // A cloud project's board is built by the cloud; a computer's, by that computer.
        const target = cloud ? 'cloud' : `machine:${machineId}`;
        const scheduleOf = (data: BoardSchedules | undefined) =>
            (data?.schedules ?? []).find(one => one.kind === 'board' && one.target === target && one.project_path === path);
        const known = scheduleOf(cloudCache.schedules<BoardSchedules>());
        setSchedule(known);
        setRunning(IN_FLIGHT.has(known?.last_run?.status ?? ''));
        if (!active) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const read = async () => {
            const result = await boardRead(machineId, path, sessionId);
            if (!alive) return;
            if (result.kind === 'read') {
                // The computer answered: the board, or that there is none yet.
                setBoard(result.state);
            } else if (result.kind === 'cached' || result.kind === 'unsure') {
                // The computer never answered, or could not say for sure that
                // there is no board: a board already on screen stays, else the
                // one this phone last read (or, with none kept, "no board").
                setBoard(current => current.status === 'ready' ? current : result.state);
            } else {
                // The computer never answered; keep a board already on screen.
                // The cloud is never switched off: a board it cannot give yet is one it has not built.
                setBoard(current => current.status === 'ready' ? current : { status: cloud ? 'missing' : 'offline' });
            }
            try {
                const own = scheduleOf(await schedulesFetch<BoardSchedules>());
                if (!alive) return;
                setSchedule(own);
                setRunning(IN_FLIGHT.has(own?.last_run?.status ?? ''));
            } catch {
                // Schedules only add "update now"; the board stands without them.
            }
        };
        readRef.current = read;
        const loop = async () => {
            if (!alive) return;
            if (AppState.currentState !== 'background') await read();
            if (alive) timer = setTimeout(() => void loop(), POLL_MS);
        };
        void loop();
        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [machineId, path, active, sessionId, cloud]);

    const build = React.useCallback(async () => {
        if (running || (!schedule && !cloud)) return;
        setRunning(true);
        setError('');
        try {
            let own = schedule;
            // A cloud project made before the cloud built boards has no schedule yet:
            // it gets the one a new cloud project is made with, every morning at nine.
            if (!own) {
                const name = path.split('/').filter(Boolean).at(-1) ?? path;
                own = (await api<ScheduleBody>('/schedules', 'POST', {
                    target: 'cloud',
                    kind: 'board',
                    project_path: path,
                    project_name: name,
                    name: `构建项目看板：${name}`,
                    instruction: '构建项目看板',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
                    recurrence: 'daily',
                    at_minute: 9 * 60,
                })).schedule;
                setSchedule(own);
            }
            await api<ScheduleRunStarted>(`/schedules/${encodeURIComponent(own.id)}/run`, 'POST', {});
        } catch (e) {
            setRunning(false);
            setError(e instanceof Error ? e.message : '');
        }
    }, [schedule, running, cloud, path]);

    return { board, build: { schedule, running, error } satisfies ProjectBoardBuild, buildNow: build, reload: () => void readRef.current() };
}

/**
 * The project's board as its two files say: the board, and the project.json
 * its card conversations keep, which has the last word on each card's state.
 *
 * Each file's text is kept on the phone when it is read, per computer and
 * folder, and forgotten only when the computer itself says it is gone
 * (`definite` missing). When the computer does not answer for the board, or
 * answers only that it could not find it (not definite — e.g. a conversation
 * that could not read it), the kept copy stands in (`cached`). Without one:
 * `unreachable` when nothing answered, `unsure` (showing "no board", but never
 * over a board already on screen) when the answer was an uncertain "missing".
 */
export async function boardRead(machineId: string, path: string, sessionId: string | undefined): Promise<
    | { kind: 'read'; state: BoardFilesState }
    | { kind: 'cached'; state: BoardFilesState }
    | { kind: 'unsure'; state: BoardFilesState }
    | { kind: 'unreachable' }
> {
    const [board, project] = await Promise.all([
        projectFileRead(machineId, path, sessionId, PROJECT_BOARD_PATH),
        projectFileRead(machineId, path, sessionId, PROJECT_STATE_PATH),
    ]);
    projectFileRemember(machineId, path, PROJECT_STATE_PATH, project);
    const boardUncertain = board.kind === 'unreachable' || (board.kind === 'missing' && !board.definite);
    if (boardUncertain) {
        const cached = boardCached(machineId, path);
        if (cached) return { kind: 'cached', state: cached };
        if (board.kind === 'unreachable') return { kind: 'unreachable' };
    } else {
        projectFileRemember(machineId, path, PROJECT_BOARD_PATH, board);
    }
    // project.json as read, else as kept — unless the computer said it is gone.
    const projectText = project.kind === 'read'
        ? project.text
        : project.kind === 'missing' && project.definite ? undefined : relayCache.projectFileRead(machineId, path, PROJECT_STATE_PATH);
    const document = projectText !== undefined ? projectStateParse(projectText) : undefined;
    const state = boardStateOf(board.kind === 'read' ? board.text : undefined, document);
    return boardUncertain ? { kind: 'unsure', state } : { kind: 'read', state };
}

/**
 * The board as this phone last read it, with project.json's card states over
 * it; undefined when no board has been read here for this computer and folder.
 */
export function boardCached(machineId: string, path: string): BoardFilesState | undefined {
    const board = relayCache.projectFileRead(machineId, path, PROJECT_BOARD_PATH);
    if (board === undefined) return undefined;
    const project = relayCache.projectFileRead(machineId, path, PROJECT_STATE_PATH);
    return boardStateOf(board, project !== undefined ? projectStateParse(project) : undefined);
}

/**
 * Keeps what a read found. A file the computer says is not there is
 * forgotten; a conversation that could not read it may only have been unable
 * to ask, so the kept copy stays for when the computer is out of reach.
 */
function projectFileRemember(machineId: string, path: string, file: string, read: ProjectFileRead) {
    if (read.kind === 'read') relayCache.projectFileWrite(machineId, path, file, read.text);
    else if (read.kind === 'missing' && read.definite) relayCache.projectFileWrite(machineId, path, file, null);
}

/** The ways a project file is asked for, over the relay (see projectFileRead.ts). */
const readers: ProjectFileReaders = {
    connected: () => storage.getState().socketStatus === 'connected',
    machineRead: machineReadProjectFile,
    sessionRead: sessionReadFile,
    machineBash,
};

/** One file of the project's, by its path in the project's folder. */
function projectFileRead(machineId: string, path: string, sessionId: string | undefined, file: string): Promise<ProjectFileRead> {
    return projectFileReadVia(readers, machineId, path, sessionId, file);
}
