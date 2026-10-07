import {
    kissopenAgentDocumentConversionStoreCreate,
    t,
    type KissopenAgentDocumentConversionOpener,
    type KissopenAgentDocumentConversionStore,
} from "kissopen-desktop-state";

import type { CloudRequest } from "./relayCloudApi";

/** How many converted documents stay ready to show again; the oldest is released. */
const KEPT = 12;

/**
 * The window's way to documents shown as PDFs the account's server converts.
 *
 * One store per file content, kept for a while so going back to a tab shows
 * the PDF at once instead of converting again; the oldest is released, and its
 * PDF with it, when more than a dozen have been opened.
 */
export function documentConversionOpenerCreate(
    request: CloudRequest,
): KissopenAgentDocumentConversionOpener {
    const stores = new Map<string, KissopenAgentDocumentConversionStore>();
    const convert = async (name: string, data: string): Promise<string> => {
        // A window whose host does not yet let it reach the converter refuses
        // before anything is sent; that is the service being unavailable here.
        const response = await request("/documents/pdf", "POST", { name, data }).catch(() => {
            throw new Error(
                t("This file needs the document preview service, which is not available on this computer yet. Open it in the default app for now."),
            );
        });
        let parsed: unknown;
        try {
            parsed = JSON.parse(response.text);
        } catch {
            throw new Error(t("The preview service did not answer ({status}).", { status: response.status }));
        }
        const body = parsed as { pdf?: unknown; error?: unknown } | null;
        if (response.status >= 400 || typeof body?.pdf !== "string")
            throw new Error(
                typeof body?.error === "string" && body.error !== ""
                    ? body.error
                    : t("The preview service did not answer ({status}).", { status: response.status }),
            );
        return body.pdf;
    };
    return (file) => {
        const held = stores.get(file.key);
        if (held !== undefined) {
            stores.delete(file.key);
            stores.set(file.key, held);
            return held;
        }
        const store = kissopenAgentDocumentConversionStoreCreate({
            name: file.name,
            url: file.url,
            automatic: file.automatic,
            convert,
        });
        stores.set(file.key, store);
        while (stores.size > KEPT) {
            const [oldest, evicted] = stores.entries().next().value as [
                string,
                KissopenAgentDocumentConversionStore,
            ];
            stores.delete(oldest);
            evicted[Symbol.dispose]();
        }
        return store;
    };
}
