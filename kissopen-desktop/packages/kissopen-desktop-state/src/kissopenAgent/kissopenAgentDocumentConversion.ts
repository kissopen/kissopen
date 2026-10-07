import { createStore } from "zustand/vanilla";

import type { Loadable } from "../conversation/loadable.js";
import { t } from "../i18n/locale.js";
import { UserError } from "../types.js";
import { kissopenAgentUserError } from "./kissopenAgentSupport.js";

/** One document's PDF, as the file preview shows it. */
export interface KissopenAgentDocumentConversionSnapshot {
    /** The converted PDF as an object URL, once asked for. */
    readonly pdf: Loadable<string>;
}

/**
 * One document shown as the PDF the account's server converts it to.
 *
 * A format no viewer here reads — doc, ppt, WPS — converts as soon as it is
 * watched. A deck the slide viewer could not draw converts when the viewer
 * says so, through `conversionRequest`. The PDF is held as an object URL for as
 * long as the store lives and released with it.
 */
export interface KissopenAgentDocumentConversionStore {
    get(): KissopenAgentDocumentConversionSnapshot;
    subscribe(listener: () => void): () => void;
    conversionRequest(): void;
    [Symbol.dispose](): void;
}

/** What a host needs to convert one file: where its bytes are, and the server's converter. */
export interface KissopenAgentDocumentConversionDeps {
    /** The file's name, whose extension tells the converter what it is. */
    readonly name: string;
    /** An address the file's bytes can be fetched from. */
    readonly url: string;
    /** Converts on the account's server; the argument and answer are base64. */
    readonly convert: (name: string, data: string) => Promise<string>;
    /** Whether watching the store is enough to start converting. */
    readonly automatic: boolean;
}

/**
 * The host's way to the conversion of one open file. The same file at the
 * same content gets the same store, so switching tabs does not convert again.
 */
export type KissopenAgentDocumentConversionOpener = (file: {
    readonly key: string;
    readonly name: string;
    readonly url: string;
    readonly automatic: boolean;
}) => KissopenAgentDocumentConversionStore;

/** The largest file converted, as the server takes it. */
const CONVERSION_MAX_BYTES = 16 * 1024 * 1024;

export function kissopenAgentDocumentConversionStoreCreate(
    deps: KissopenAgentDocumentConversionDeps,
): KissopenAgentDocumentConversionStore {
    const store = createStore<KissopenAgentDocumentConversionSnapshot>()(() => ({
        pdf: { type: "unloaded" },
    }));
    let disposed = false;
    let objectUrl: string | undefined;

    const convert = (): void => {
        if (disposed || store.getState().pdf.type !== "unloaded") return;
        store.setState({ pdf: { type: "loading" } }, true);
        void (async () => {
            const response = await fetch(deps.url);
            if (!response.ok) throw new UserError(t("The file could not be read ({status}).", { status: response.status }));
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength > CONVERSION_MAX_BYTES)
                throw new UserError(t("Files larger than 16 MB cannot be previewed here."));
            const pdf = await deps.convert(deps.name, base64Encode(bytes));
            return URL.createObjectURL(
                new Blob([base64Decode(pdf)], { type: "application/pdf" }),
            );
        })().then(
            (url) => {
                if (disposed) {
                    URL.revokeObjectURL(url);
                    return;
                }
                objectUrl = url;
                store.setState({ pdf: { type: "ready", value: url } }, true);
            },
            (error: unknown) => {
                if (disposed) return;
                store.setState({ pdf: { type: "error", error: kissopenAgentUserError(error) } }, true);
            },
        );
    };

    return {
        get: () => store.getState(),
        subscribe(listener) {
            if (disposed) return () => undefined;
            const unsubscribe = store.subscribe(listener);
            if (deps.automatic) convert();
            return unsubscribe;
        },
        conversionRequest: convert,
        [Symbol.dispose]() {
            disposed = true;
            if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
            objectUrl = undefined;
        },
    };
}

function base64Encode(bytes: Uint8Array): string {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
}

function base64Decode(text: string): Uint8Array<ArrayBuffer> {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}
