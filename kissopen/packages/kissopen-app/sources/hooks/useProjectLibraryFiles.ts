import * as React from 'react';
import { AppState } from 'react-native';
import { sessionListDirectory } from '@/sync/ops';
import { relayCache } from '@/sync/offlineCache/relayCache';
import type { WorkProject } from '@/kissopen/ProjectPage';
import {
    LIBRARY_FOLDERS,
    libraryFilesOf,
    libraryFilesParse,
    libraryNewestFirst,
    librarySubfolders,
    type LibraryFile,
    type LibraryListingEntry,
} from '@/kissopen/libraryFiles';

/** How often the listing is read again while the library is on screen. */
const POLL_MS = 30_000;

/** Where the last listing of a project is kept on the phone: a name, never a real file. */
const CACHE_NAME = '.kissopen/library-files.json';

/**
 * Every project's uploaded and generated files, for the library tab.
 *
 * Each project is read where it lives — the cloud or one of the computers —
 * through the conversation running in the project's own folder (the same one
 * the project page's files tab uses), with `listDirectory`: the project's
 * folder first, to see which of `uploads/` and `outputs/` it has, then those,
 * then one level of their subfolders (LIBRARY_SUBFOLDERS_MAX, newest first).
 *
 * While `active` the listing is read at once, again every thirty seconds and
 * whenever the app comes back to the foreground. A project whose computer
 * does not answer, or answers only part of it, keeps what it showed before:
 * the listing this phone last read for it (kept in the relay cache), or
 * nothing. There is never an error, only the next try.
 *
 * Returns each project's files, newest first, by WorkProject id.
 */
export function useProjectLibraryFiles(projects: readonly WorkProject[], active: boolean): ReadonlyMap<string, readonly LibraryFile[]> {
    const [files, setFiles] = React.useState<ReadonlyMap<string, readonly LibraryFile[]>>(new Map());
    // Which projects to read, as a value that changes only when a project comes or goes.
    const key = projects.map(project => `${project.id}\t${project.rootSessionId ?? ''}`).join('\n');
    const latest = React.useRef(projects);
    latest.current = projects;

    // Kept listings fill in only what nothing has been read for yet.
    React.useEffect(() => {
        if (key === '') return;
        setFiles(current => {
            let next: Map<string, readonly LibraryFile[]> | undefined;
            for (const project of latest.current) {
                if (current.has(project.id)) continue;
                const kept = libraryFilesParse(relayCache.projectFileRead(project.machineId, project.path, CACHE_NAME));
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
        let running = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            if (!alive || running) return;
            running = true;
            if (timer) clearTimeout(timer);
            if (AppState.currentState !== 'background') {
                const read = await Promise.all(latest.current.map(async project => {
                    const listed = project.rootSessionId ? await projectLibraryRead(project.rootSessionId) : undefined;
                    if (listed) relayCache.projectFileWrite(project.machineId, project.path, CACHE_NAME, JSON.stringify(listed));
                    return [project.id, listed] as const;
                }));
                if (alive) {
                    setFiles(current => {
                        let next: Map<string, readonly LibraryFile[]> | undefined;
                        for (const [id, listed] of read) {
                            if (!listed) continue;
                            const shown = current.get(id);
                            if (shown && JSON.stringify(shown) === JSON.stringify(listed)) continue;
                            next ??= new Map(current);
                            next.set(id, listed);
                        }
                        return next ?? current;
                    });
                }
            }
            running = false;
            if (alive) timer = setTimeout(() => void tick(), POLL_MS);
        };
        void tick();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void tick();
        });
        return () => {
            alive = false;
            subscription.remove();
            if (timer) clearTimeout(timer);
        };
    }, [active, key]);

    return files;
}

async function listFolder(sessionId: string, path: string): Promise<readonly LibraryListingEntry[] | undefined> {
    const response = await sessionListDirectory(sessionId, path);
    return response.success && response.entries ? response.entries : undefined;
}

/** One project's library files, newest first; undefined when any folder of it could not be read. */
async function projectLibraryRead(sessionId: string): Promise<LibraryFile[] | undefined> {
    const root = await listFolder(sessionId, '');
    if (!root) return undefined;
    const folders = LIBRARY_FOLDERS.filter(name => root.some(entry => entry.name === name && entry.type === 'directory'));
    const found: LibraryFile[] = [];
    let complete = true;
    await Promise.all(folders.map(async folder => {
        const entries = await listFolder(sessionId, folder);
        if (!entries) {
            complete = false;
            return;
        }
        found.push(...libraryFilesOf(folder, entries));
        await Promise.all(librarySubfolders(folder, entries).map(async inner => {
            const innerEntries = await listFolder(sessionId, inner);
            if (!innerEntries) {
                complete = false;
                return;
            }
            found.push(...libraryFilesOf(inner, innerEntries));
        }));
    }));
    return complete ? libraryNewestFirst(found) : undefined;
}
