import { createStore } from "zustand/vanilla";

import { t } from "../i18n/locale.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";

/** Where a batch of files handed to a project stands. */
export interface KissopenAgentFileUploadSnapshot {
    readonly phase: "idle" | "uploading" | "uploaded" | "failed";
    /** Files in the batch, and how many have landed. */
    readonly total: number;
    readonly done: number;
    /** Where the landed files are, relative to the project folder. */
    readonly paths: readonly string[];
    /** Why the batch stopped, when it did. */
    readonly error?: string;
}

/**
 * Files a person hands to a project, uploaded into its `uploads/` folder.
 *
 * One batch at a time, one file after another: a project's files arrive in the
 * order they were dropped, and a failure stops the batch where it is rather
 * than leaving a scatter of files the reader cannot account for. What the batch
 * did stays on show until the next one, or until the reader dismisses it.
 */
export interface KissopenAgentFileUploadStore {
    get(): KissopenAgentFileUploadSnapshot;
    subscribe(listener: () => void): () => void;
    /** Uploads the files; resolves with where each landed, or with none when refused. */
    filesUpload(files: readonly File[]): Promise<readonly string[]>;
    noticeDismiss(): void;
}

export interface KissopenAgentFileUploadDeps {
    /** Puts one file into the project's `uploads/`, answering where it landed. */
    readonly upload: (file: { readonly name: string; readonly bytes: Uint8Array }) => Promise<string>;
}

/** The largest file uploaded, as every place a project can live takes it. */
export const KISSOPEN_AGENT_UPLOAD_MAX_BYTES = 32 * 1024 * 1024;

const IDLE: KissopenAgentFileUploadSnapshot = { phase: "idle", total: 0, done: 0, paths: [] };

export function kissopenAgentFileUploadStoreCreate(
    deps: KissopenAgentFileUploadDeps,
): KissopenAgentFileUploadStore {
    const store = createStore<KissopenAgentFileUploadSnapshot>()(() => IDLE);
    return {
        get: () => store.getState(),
        subscribe: (listener) => store.subscribe(listener),
        async filesUpload(files) {
            if (files.length === 0 || store.getState().phase === "uploading") return [];
            const tooLarge = files.find((file) => file.size > KISSOPEN_AGENT_UPLOAD_MAX_BYTES);
            if (tooLarge) {
                store.setState(
                    {
                        ...IDLE,
                        phase: "failed",
                        total: files.length,
                        error: t("{name} is larger than 32 MB and cannot be uploaded.", {
                            name: tooLarge.name,
                        }),
                    },
                    true,
                );
                return [];
            }
            const paths: string[] = [];
            store.setState({ phase: "uploading", total: files.length, done: 0, paths }, true);
            for (const file of files) {
                try {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    paths.push(await deps.upload({ name: file.name, bytes }));
                } catch (error) {
                    store.setState(
                        {
                            phase: "failed",
                            total: files.length,
                            done: paths.length,
                            paths: [...paths],
                            error: kissopenAgentUserError(error).message,
                        },
                        true,
                    );
                    return [...paths];
                }
                store.setState(
                    { phase: "uploading", total: files.length, done: paths.length, paths: [...paths] },
                    true,
                );
            }
            store.setState(
                { phase: "uploaded", total: files.length, done: paths.length, paths: [...paths] },
                true,
            );
            return [...paths];
        },
        noticeDismiss() {
            if (store.getState().phase !== "uploading") store.setState(IDLE, true);
        },
    };
}

/** Bytes as base64, for the routes that carry a file as text. */
export function kissopenAgentBytesBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
}
