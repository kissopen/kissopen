/*
 * The library, as plain data.
 *
 * Every project keeps what the person attached in its `uploads/` folder and
 * what the assistant made — deliverables, copies of generated pictures — in
 * `outputs/`. The library lists both, one level of subfolders deep, beside the
 * files kept with the cloud chat, and shows them the way the desktop's 资料库
 * does: grouped by project (the default) or by day, filtered by type and by a
 * search.
 *
 * Pure: reading the folders is the hook's (useProjectLibraryFiles), so the
 * rules here can be tested on their own.
 */

/** The project folders the library lists, each with what it holds. */
export const LIBRARY_FOLDERS = ['uploads', 'outputs'] as const;

/** Subfolders read inside each of them, newest first; older ones are left out. */
export const LIBRARY_SUBFOLDERS_MAX = 12;

/** Attached by the person, or made by the assistant. */
export type LibraryFileKind = 'upload' | 'output';

export type LibraryFile = {
    name: string;
    /** Relative to the project's folder, the way the file screen opens it. */
    path: string;
    kind: LibraryFileKind;
    size?: number;
    /** Last changed, in milliseconds. */
    modified?: number;
};

/** One entry of a folder as the agent's `listDirectory` answers it. */
export type LibraryListingEntry = {
    name: string;
    type: 'file' | 'directory' | 'other';
    size?: number;
    modified?: number;
};

/** What the library shows a file as. */
export type LibraryKind = 'document' | 'data' | 'image';

/** One file in the library: a project's, or one kept with the cloud chat. */
export type LibraryEntry = {
    id: string;
    name: string;
    kind: LibraryKind;
    /** Attached or made, for a project's file; absent for one kept with the chat. */
    source?: LibraryFileKind;
    size?: number;
    /** Last changed, or when it was uploaded, in milliseconds. */
    at?: number;
    /** The project whose folder holds it; absent for a file kept with the chat. */
    project?: LibraryEntryProject;
};

export type LibraryEntryProject = {
    id: string;
    name: string;
    /** The cloud, or the computer's name. */
    place: string;
};

export type LibraryGrouping = 'project' | 'time';
export type LibraryFilter = 'all' | LibraryKind;
export type LibraryDay = 'today' | 'yesterday' | 'week' | 'month' | 'earlier';

export type LibrarySection =
    | { id: string; by: 'project'; project: LibraryEntryProject; entries: LibraryEntry[] }
    | { id: 'unassigned'; by: 'unassigned'; entries: LibraryEntry[] }
    | { id: string; by: 'day'; day: LibraryDay; entries: LibraryEntry[] };

function hidden(name: string): boolean {
    return name.startsWith('.');
}

function kindOf(folder: string): LibraryFileKind {
    return folder === 'uploads' || folder.startsWith('uploads/') ? 'upload' : 'output';
}

/** The files of one listed folder (`uploads`, `outputs/2026-09`, …); hidden ones are left out. */
export function libraryFilesOf(folder: string, entries: readonly LibraryListingEntry[]): LibraryFile[] {
    const kind = kindOf(folder);
    return entries
        .filter(entry => entry.type === 'file' && !hidden(entry.name))
        .map(entry => ({
            name: entry.name,
            path: `${folder}/${entry.name}`,
            kind,
            ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
            ...(typeof entry.modified === 'number' ? { modified: entry.modified } : {}),
        }));
}

/** The subfolders of a listed folder worth reading, newest first, at most `max`. */
export function librarySubfolders(folder: string, entries: readonly LibraryListingEntry[], max = LIBRARY_SUBFOLDERS_MAX): string[] {
    return entries
        .filter(entry => entry.type === 'directory' && !hidden(entry.name))
        .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0) || a.name.localeCompare(b.name))
        .slice(0, max)
        .map(entry => `${folder}/${entry.name}`);
}

function newer(a: LibraryFile, b: LibraryFile): number {
    return (b.modified ?? 0) - (a.modified ?? 0) || a.path.localeCompare(b.path);
}

/** Newest first; files that say nothing of when last, by path. */
export function libraryNewestFirst(files: readonly LibraryFile[]): LibraryFile[] {
    return [...files].sort(newer);
}

/** A listing kept on the phone, read back; anything malformed is dropped. */
export function libraryFilesParse(text: string | undefined): LibraryFile[] | undefined {
    if (text === undefined) return undefined;
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (!Array.isArray(value)) return undefined;
    const files: LibraryFile[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const { name, path, kind, size, modified } = item as Record<string, unknown>;
        if (typeof name !== 'string' || typeof path !== 'string' || (kind !== 'upload' && kind !== 'output')) continue;
        files.push({
            name,
            path,
            kind,
            ...(typeof size === 'number' ? { size } : {}),
            ...(typeof modified === 'number' ? { modified } : {}),
        });
    }
    return files;
}

const IMAGE = /\.(?:png|jpe?g|gif|webp|svg|bmp|heic|heif|avif)$/i;
const DATA = /\.(?:csv|tsv|json|jsonl|xlsx?|xlsm|numbers|parquet|sqlite|db|xml|ya?ml)$/i;

/** Read off the name: the one boundary where a file's type is guessed. */
export function libraryKindOf(name: string): LibraryKind {
    if (IMAGE.test(name)) return 'image';
    if (DATA.test(name)) return 'data';
    return 'document';
}

/** Whether an entry passes the type filter and the search, which also looks at its project. */
export function libraryMatches(entry: LibraryEntry, filter: LibraryFilter, query: string): boolean {
    if (filter !== 'all' && entry.kind !== filter) return false;
    const wanted = query.trim().toLowerCase();
    if (!wanted) return true;
    return entry.name.toLowerCase().includes(wanted) || !!entry.project?.name.toLowerCase().includes(wanted);
}

const DAY_MS = 86_400_000;

function midnight(at: number): number {
    const date = new Date(at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function dayOf(at: number | undefined, now: number): LibraryDay {
    if (at === undefined) return 'earlier';
    const today = midnight(now);
    if (at >= today) return 'today';
    if (at >= today - DAY_MS) return 'yesterday';
    if (at >= today - 7 * DAY_MS) return 'week';
    if (at >= today - 30 * DAY_MS) return 'month';
    return 'earlier';
}

function newestFirst(a: LibraryEntry, b: LibraryEntry): number {
    return (b.at ?? 0) - (a.at ?? 0) || a.name.localeCompare(b.name);
}

/**
 * The entries as the library shows them, every section newest first.
 *
 * By project, one section per project, the one with the newest file first,
 * and the files kept with the chat last, under 未关联项目 — the way the
 * desktop groups both its files and its scheduled tasks. By time, the same
 * day buckets the desktop uses. A section with nothing in it is left out.
 */
export function librarySections(entries: readonly LibraryEntry[], grouping: LibraryGrouping, now: number): LibrarySection[] {
    const sorted = [...entries].sort(newestFirst);
    if (grouping === 'time') {
        const sections: LibrarySection[] = [];
        for (const entry of sorted) {
            const day = dayOf(entry.at, now);
            const last = sections.at(-1);
            if (last?.by === 'day' && last.day === day) last.entries.push(entry);
            else sections.push({ id: `day:${day}`, by: 'day', day, entries: [entry] });
        }
        return sections;
    }
    const projects = new Map<string, Extract<LibrarySection, { by: 'project' }>>();
    const unassigned: LibraryEntry[] = [];
    for (const entry of sorted) {
        if (!entry.project) {
            unassigned.push(entry);
            continue;
        }
        const section = projects.get(entry.project.id);
        if (section) section.entries.push(entry);
        else projects.set(entry.project.id, { id: `project:${entry.project.id}`, by: 'project', project: entry.project, entries: [entry] });
    }
    // Filled from newest to oldest, so a project enters the map at its newest file: the map's order is the order wanted.
    const unassignedSection: LibrarySection[] = unassigned.length ? [{ id: 'unassigned', by: 'unassigned', entries: unassigned }] : [];
    return [...projects.values(), ...unassignedSection];
}

/** A file's size the way a person reads it. */
export function librarySizeText(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
