import { kissopenAgentBoardStateOf, type KissopenAgentBoardState } from "./kissopenAgentBoard.js";
import { kissopenAgentProjectParse } from "./kissopenAgentProjectState.js";

/** The caller scopes this store to one signed-in account. */
export interface ProjectBoardAddress {
    readonly machineId: string;
    readonly projectId: string;
    readonly path: string;
    readonly sessionId: string;
}

export type ProjectBoardFile = "board.json" | "project.json";
export type ProjectBoardFileResult =
    | { readonly status: "found"; readonly content: string }
    | { readonly status: "uncached" }
    | { readonly status: "unavailable"; readonly error: string };

export interface ProjectBoardSnapshot {
    readonly board: KissopenAgentBoardState;
    readonly sync: "cached" | "refreshing" | "current" | "unavailable";
    readonly error?: string;
}

export const projectBoardAddressKey = (
    address: Pick<ProjectBoardAddress, "machineId" | "projectId" | "path">,
): string => JSON.stringify([address.machineId, address.projectId, address.path]);

export const PROJECT_BOARD_INITIAL: ProjectBoardSnapshot = {
    board: { status: "loading" },
    sync: "refreshing",
};

export interface ProjectBoardsStore {
    get(): ReadonlyMap<string, ProjectBoardSnapshot>;
    subscribe(listener: () => void): () => void;
    boardRead(address: ProjectBoardAddress): Promise<void>;
    dispose(): void;
}

/** Memory only. Disk and authenticated transport are supplied by the host. */
export function projectBoardsStoreCreate(deps: {
    read(
        address: ProjectBoardAddress,
        file: ProjectBoardFile,
        source: "cache" | "remote",
    ): Promise<ProjectBoardFileResult>;
}): ProjectBoardsStore {
    let snapshot: ReadonlyMap<string, ProjectBoardSnapshot> = new Map();
    const listeners = new Set<() => void>();
    const contents = new Map<string, { board?: string; project?: string }>();
    const pending = new Map<string, Promise<void>>();
    let disposed = false;

    const publish = (key: string, next: ProjectBoardSnapshot): void => {
        if (disposed) return;
        const previous = snapshot.get(key);
        if (
            previous?.board === next.board &&
            previous.sync === next.sync &&
            previous.error === next.error
        )
            return;
        snapshot = new Map(snapshot).set(key, next);
        for (const listener of listeners) listener();
    };
    const apply = (
        key: string,
        file: ProjectBoardFile,
        content: string,
        source: "cache" | "remote",
    ): boolean => {
        if (disposed) return false;
        if (file === "project.json" && !kissopenAgentProjectParse(content)) return false;
        const held = contents.get(key) ?? {};
        const next = { ...held, [file === "board.json" ? "board" : "project"]: content };
        const previous = snapshot.get(key) ?? PROJECT_BOARD_INITIAL;
        // Project metadata never delays rendering a board that has already arrived.
        const parsed =
            next.board === undefined
                ? previous.board
                : kissopenAgentBoardStateOf(next.board, next.project);
        if (parsed.status === "invalid" && previous.board.status === "ready") {
            if (file === "board.json" && source === "remote")
                publish(key, { ...previous, sync: "unavailable", error: parsed.reason });
            return false;
        }
        contents.set(key, next);
        const board =
            JSON.stringify(parsed) === JSON.stringify(previous.board) ? previous.board : parsed;
        publish(key, {
            ...previous,
            board,
            ...(file === "board.json" && source === "remote"
                ? { sync: "current" as const, error: undefined }
                : file === "board.json" && previous.sync !== "unavailable"
                  ? { sync: "cached" as const }
                  : {}),
        });
        return true;
    };

    return {
        get: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        boardRead(address) {
            if (disposed) return Promise.resolve();
            const key = projectBoardAddressKey(address);
            const read = async (
                file: ProjectBoardFile,
                source: "cache" | "remote",
            ): Promise<ProjectBoardFileResult> => {
                try {
                    return await deps.read(address, file, source);
                } catch (error) {
                    return {
                        status: "unavailable",
                        error: error instanceof Error ? error.message : String(error),
                    };
                }
            };
            const load = async (file: ProjectBoardFile): Promise<void> => {
                let freshApplied = false;
                const field = file === "board.json" ? "board" : "project";
                // Disk and network proceed independently. A late disk reply
                // can fill an empty screen, but can never replace fresh data.
                const cached =
                    contents.get(key)?.[field] === undefined
                        ? read(file, "cache").then((result) => {
                              if (!freshApplied && result.status === "found")
                                  apply(key, file, result.content, "cache");
                          })
                        : Promise.resolve();
                const fresh = read(file, "remote").then((result) => {
                    if (disposed) return;
                    if (result.status === "found") {
                        freshApplied = apply(key, file, result.content, "remote");
                    } else if (file === "board.json") {
                        publish(key, {
                            ...(snapshot.get(key) ?? PROJECT_BOARD_INITIAL),
                            sync: "unavailable",
                            ...(result.status === "unavailable" ? { error: result.error } : {}),
                        });
                    }
                });
                await Promise.all([cached, fresh]);
            };
            const tasks = (["board.json", "project.json"] as const).map((file) => {
                const requestKey = `${key}:${file}`;
                const active = pending.get(requestKey);
                if (active) return active;
                if (file === "board.json") {
                    const previous = snapshot.get(key) ?? PROJECT_BOARD_INITIAL;
                    // Keep the offline warning until a fresh read actually succeeds.
                    publish(key, {
                        ...previous,
                        sync: previous.sync === "unavailable" ? "unavailable" : "refreshing",
                    });
                }
                const task = load(file).finally(() => pending.delete(requestKey));
                pending.set(requestKey, task);
                return task;
            });
            return Promise.all(tasks).then(() => undefined);
        },
        dispose() {
            disposed = true;
            contents.clear();
            pending.clear();
            snapshot = new Map();
            for (const listener of listeners) listener();
            listeners.clear();
        },
    };
}
