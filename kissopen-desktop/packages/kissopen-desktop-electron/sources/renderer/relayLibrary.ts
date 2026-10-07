/*
The files in the reader's projects, for 资料库.

A project keeps what was handed to it in `uploads/` and what its assistant
made in `outputs/` — documents, spreadsheets, and a copy of every picture drawn
there. None of that is on the server, so 资料库 used to show only the files
kept with chats, and a project's own material was nowhere in it. This lists
those two folders of every project — this computer's through its agent, the
cloud's and the other computers' through a conversation there — and keeps the
last answer, so a project whose machine is asleep still shows what it had.

Read only while 资料库 is on screen, and again every half minute: nothing
tells this window when an assistant somewhere writes a file.
*/
import type { FileLibraryItem, FileLibraryKind } from "kissopen-desktop-ui";
import { fileThumbnailStoreCreate } from "kissopen-desktop-state";
import { libraryThumbnail } from "./libraryThumbnail";

/** One entry of a project folder, as whichever machine holds it listed it. */
export interface RelayLibraryEntry {
    readonly name: string;
    readonly kind: "file" | "directory";
    readonly size?: number;
    readonly modified?: number;
}

/** A project whose folders can be listed, and how. */
export interface RelayLibraryProject {
    /** Stable across reads; the same folder on two machines is two projects. */
    readonly key: string;
    readonly name: string;
    /** Undefined when the folder could not be listed this time. */
    readonly list: (path: string) => Promise<readonly RelayLibraryEntry[] | undefined>;
    readonly open: (path: string) => void;
    readonly picture?: (path: string) => Promise<string | undefined>;
}

export interface RelayLibraryFile extends FileLibraryItem {
    readonly projectKey: string;
    /** Relative to the project's folder. */
    readonly path: string;
}

export interface RelayLibraryStore {
    get(): readonly RelayLibraryFile[];
    subscribe(listener: () => void): () => void;
    /** Reads now and every half minute until the returned stop is called. */
    watch(projects: () => readonly RelayLibraryProject[]): () => void;
    open(id: string): void;
    previewRequest(id: string): void;
}

const FOLDERS = ["uploads", "outputs"] as const;
const POLL_MS = 30_000;
/** Folders inside `uploads/` or `outputs/` looked into, per folder. */
const SUBFOLDERS_MAX = 12;

const IMAGE = /\.(?:png|jpe?g|gif|webp|svg|bmp|heic|avif)$/iu;
const DATA = /\.(?:csv|tsv|json|jsonl|xlsx?|xlsm|numbers|parquet|sqlite|db|xml|ya?ml)$/iu;

/** The kind is read off the name: the one boundary where a file's type is guessed. */
export function relayLibraryKind(name: string): FileLibraryKind {
    if (IMAGE.test(name)) return "image";
    if (DATA.test(name)) return "data";
    return "document";
}

async function projectFiles(project: RelayLibraryProject): Promise<RelayLibraryFile[] | undefined> {
    const files: RelayLibraryFile[] = [];
    let answered = false;
    const take = (folder: string, entries: readonly RelayLibraryEntry[]): string[] => {
        const subfolders: string[] = [];
        for (const entry of entries) {
            if (entry.name.startsWith(".")) continue;
            const path = `${folder}/${entry.name}`;
            if (entry.kind === "directory") {
                subfolders.push(path);
                continue;
            }
            files.push({
                id: `${project.key}\0${path}`,
                projectKey: project.key,
                path,
                name: entry.name,
                kind: relayLibraryKind(entry.name),
                // It is in a project's folder already; the conversations there reach it.
                attachable: false,
                created: entry.modified ?? 0,
                ...(entry.size === undefined ? {} : { size: entry.size }),
                project: { id: project.key, name: project.name },
            });
        }
        return subfolders;
    };
    for (const folder of FOLDERS) {
        const entries = await project.list(folder);
        if (entries === undefined) continue;
        answered = true;
        const subfolders = take(folder, entries).slice(0, SUBFOLDERS_MAX);
        const nested = await Promise.all(subfolders.map((path) => project.list(path)));
        nested.forEach((inner, index) => {
            if (inner) take(subfolders[index]!, inner);
        });
    }
    return answered ? files : undefined;
}

export function relayLibraryStoreCreate(cache: {
    readonly read: () => Record<string, readonly RelayLibraryFile[]>;
    readonly write: (files: Record<string, readonly RelayLibraryFile[]>) => void;
}): RelayLibraryStore {
    const listeners = new Set<() => void>();
    const thumbnails = fileThumbnailStoreCreate();
    const thumbnailKey = (file: RelayLibraryFile) =>
        `${file.id}\0${file.created}\0${file.size ?? ""}`;
    let byProject: Record<string, readonly RelayLibraryFile[]> = {};
    try {
        byProject = cache.read();
    } catch {
        // A cache that will not read is an empty one.
    }
    let known: readonly RelayLibraryProject[] = [];
    let snapshot: readonly RelayLibraryFile[] = [];
    const publish = (): void => {
        const keys = new Set(known.map((project) => project.key));
        snapshot = Object.entries(byProject)
            .filter(([key]) => keys.has(key))
            .flatMap(([, files]) => files)
            .map((file) => {
                const previewUrl = thumbnails.get(thumbnailKey(file));
                return previewUrl ? { ...file, previewUrl } : file;
            });
        for (const listener of listeners) listener();
    };
    thumbnails.subscribe(publish);
    const read = async (projects: readonly RelayLibraryProject[]): Promise<void> => {
        known = projects;
        publish();
        await Promise.all(
            projects.map(async (project) => {
                const files = await projectFiles(project).catch(() => undefined);
                // A machine that did not answer keeps what it showed last.
                if (files === undefined) return;
                byProject = { ...byProject, [project.key]: files };
                publish();
            }),
        );
        try {
            cache.write(byProject);
        } catch {
            // Only the next start is poorer for it.
        }
    };
    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        watch(projects) {
            let alive = true;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const tick = async (): Promise<void> => {
                await read(projects());
                if (alive) timer = setTimeout(() => void tick(), POLL_MS);
            };
            void tick();
            return () => {
                alive = false;
                thumbnails.cancelPending();
                if (timer !== undefined) clearTimeout(timer);
            };
        },
        open(id) {
            const file = snapshot.find((candidate) => candidate.id === id);
            if (!file) return;
            known.find((project) => project.key === file.projectKey)?.open(file.path);
        },
        previewRequest(id) {
            const file = snapshot.find((candidate) => candidate.id === id);
            if (!file || file.kind !== "image" || (file.size ?? 0) > 20 * 1024 * 1024) return;
            const project = known.find((candidate) => candidate.key === file.projectKey);
            if (!project?.picture) return;
            thumbnails.request(thumbnailKey(file), async () => {
                const url = await project.picture!(file.path);
                return url ? libraryThumbnail(url) : undefined;
            });
        },
    };
}
