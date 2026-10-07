import { t } from "../i18n/locale.js";
import { fileThumbnailStoreCreate } from "./fileThumbnailStore.js";
import type { KissopenAgentWorkspaceFileTreeEntry } from "../kissopenAgent/kissopenAgentTypes.js";

export type LocalLibraryKind = "document" | "data" | "image";
export interface LocalLibraryFile {
    readonly id: string;
    readonly name: string;
    readonly path: string;
    readonly kind: LocalLibraryKind;
    readonly size?: number;
    readonly created: number;
    readonly project: { readonly id: string; readonly name: string };
    readonly previewUrl?: string;
}
export interface LocalLibraryProject {
    readonly id: string;
    readonly name: string;
    readonly read: (folder: string) => Promise<readonly KissopenAgentWorkspaceFileTreeEntry[]>;
    readonly open: (path: string) => void;
    readonly thumbnail: (path: string) => Promise<string | undefined>;
}
export interface LocalLibrarySource {
    readonly visible: boolean;
    readonly ready: boolean;
    readonly error?: string;
    readonly projects: readonly LocalLibraryProject[];
}
export interface LocalLibrarySnapshot {
    readonly files: readonly LocalLibraryFile[];
    readonly loading: boolean;
    readonly error: string;
    readonly loadedAt: number;
}
export interface LocalLibraryStore {
    get(): LocalLibrarySnapshot;
    subscribe(listener: () => void): () => void;
    fileOpen(id: string): void;
    filePreviewRequest(id: string): void;
}

/** External file names are the only type-detection boundary. */
function kindOf(name: string): LocalLibraryKind {
    if (/\.(?:png|jpe?g|gif|webp|svg|bmp|heic|avif)$/iu.test(name)) return "image";
    if (/\.(?:csv|tsv|jsonl?|xlsx?|xlsm|numbers|parquet|sqlite|db|xml|ya?ml)$/iu.test(name))
        return "data";
    return "document";
}

/** Local project roots plus uploaded/generated material; never crawls repositories. */
async function readProject(project: LocalLibraryProject): Promise<readonly LocalLibraryFile[]> {
    const files: LocalLibraryFile[] = [];
    const take = (entries: readonly KissopenAgentWorkspaceFileTreeEntry[]) => {
        for (const entry of entries) {
            if (entry.kind !== "file" || entry.name.startsWith(".")) continue;
            files.push({
                id: JSON.stringify([project.id, entry.path]),
                name: entry.name,
                path: entry.path,
                kind: kindOf(entry.name),
                size: entry.size,
                created: entry.modified ?? 0,
                project: { id: project.id, name: project.name },
            });
        }
    };
    const root = await project.read("");
    take(root);
    const folders = root
        .filter(
            (entry) =>
                entry.kind === "directory" &&
                (entry.name === "uploads" || entry.name === "outputs"),
        )
        .map((entry) => entry.path);
    // Bound nested material, avoiding node_modules/.git and unbounded traversal.
    for (let index = 0; index < folders.length && index < 64; index++) {
        const entries = await project.read(folders[index]!);
        take(entries);
        for (const entry of entries)
            if (entry.kind === "directory" && !entry.name.startsWith(".")) folders.push(entry.path);
    }
    return files;
}

/** Resources exist only while the library is materialized. Files remain on the Agent. */
export function localLibraryStoreCreate(source: {
    readonly get: () => LocalLibrarySource;
    readonly subscribe: (listener: () => void) => () => void;
}): LocalLibraryStore {
    const listeners = new Set<() => void>();
    const thumbnails = fileThumbnailStoreCreate();
    let snapshot: LocalLibrarySnapshot = { files: [], loading: true, error: "", loadedAt: 0 };
    let known: readonly LocalLibraryProject[] = [];
    const files = new Map<string, readonly LocalLibraryFile[]>();
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopSource: (() => void) | undefined;
    let running = false;
    let queued = false;
    const thumbnailKey = (file: LocalLibraryFile) =>
        `${file.id}:${file.created}:${file.size ?? ""}`;
    const publish = (patch: Partial<LocalLibrarySnapshot>) => {
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners) listener();
    };
    const projectFiles = () =>
        known
            .flatMap((project) => files.get(project.id) ?? [])
            .map((file) => {
                const previewUrl = thumbnails.get(thumbnailKey(file));
                return previewUrl ? { ...file, previewUrl } : file;
            });
    thumbnails.subscribe(() => publish({ files: projectFiles() }));
    const tick = async () => {
        if (!listeners.size) return;
        if (running) {
            queued = true;
            return;
        }
        running = true;
        clearTimeout(timer);
        const turn = generation;
        try {
            const current = source.get();
            if (!current.visible) return;
            if (current.ready) {
                known = current.projects;
                const ids = new Set(known.map((project) => project.id));
                for (const id of files.keys()) if (!ids.has(id)) files.delete(id);
            }
            publish({ files: projectFiles(), loading: !current.ready, error: current.error ?? "" });
            if (!current.ready) return;
            const errors: string[] = [];
            await Promise.all(
                known.map(async (project) => {
                    try {
                        const next = await readProject(project);
                        if (turn === generation) files.set(project.id, next);
                    } catch {
                        errors.push(
                            t("{project} 的本地文件暂时读取不到，已保留上次内容。", {
                                project: project.name,
                            }),
                        );
                    }
                }),
            );
            if (turn === generation)
                publish({
                    files: projectFiles(),
                    loading: false,
                    error: errors.join(" "),
                    loadedAt: Date.now(),
                });
        } finally {
            running = false;
            if (listeners.size) {
                timer = setTimeout(() => void tick(), queued ? 500 : 5_000);
                queued = false;
            }
        }
    };
    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            if (listeners.size === 1) {
                stopSource = source.subscribe(() => void tick());
                void tick();
            }
            return () => {
                listeners.delete(listener);
                if (!listeners.size) {
                    generation++;
                    stopSource?.();
                    stopSource = undefined;
                    clearTimeout(timer);
                    thumbnails.cancelPending();
                    known = [];
                    files.clear();
                    snapshot = { files: [], loading: true, error: "", loadedAt: 0 };
                }
            };
        },
        fileOpen(id) {
            const file = snapshot.files.find((entry) => entry.id === id);
            if (file) known.find((project) => project.id === file.project.id)?.open(file.path);
        },
        filePreviewRequest(id) {
            const file = snapshot.files.find((entry) => entry.id === id);
            const project = known.find((entry) => entry.id === file?.project.id);
            if (!file || !project || file.kind !== "image" || (file.size ?? 0) > 20 * 1024 * 1024)
                return;
            thumbnails.request(thumbnailKey(file), () => project.thumbnail(file.path));
        },
    };
}
