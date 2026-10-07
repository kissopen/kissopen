/*
What a person is told when a request to their KISSOPEN account does not come back.

The request crosses into the main process, and a failure there reaches the
window as Electron's own wording — "Error invoking remote method
'KISSOPEN:consumer-request': TimeoutError: The operation was aborted due to
timeout" — which then showed, word for word, in the page. A person needs to know
what happened and what to do, not which method threw. The main process's own
sentences (a body too large, a keyring to turn on) are already written for
people and are kept; everything else becomes one of three plain sentences.
*/
import { t } from "kissopen-desktop-state";

/** Electron's wrapper around an error thrown by an `ipcMain.handle` handler. */
const ELECTRON_WRAPPER = /^Error invoking remote method '[^']*':\s*/u;
/** Error class names a thrown message starts with once the wrapper is gone. */
const ERROR_NAME = /^[A-Za-z]*Error:\s*/u;
/** A sentence written for people here is Chinese; engine errors are not. */
const WRITTEN_FOR_PEOPLE = /[一-鿿]/u;

export function kissopenRequestFailure(error: unknown): Error {
    const raw = error instanceof Error ? error.message : String(error);
    // Electron's wrapper, then the class name the thrown error carried inside it.
    const unwrapped = raw.replace(ERROR_NAME, "").replace(ELECTRON_WRAPPER, "");
    if (/timeout|timed out|aborted/iu.test(unwrapped))
        return new Error(t("网络较慢，这次请求超时了，请稍后再试。"));
    if (
        /fetch failed|failed to fetch|network|ENOTFOUND|ECONN|EAI_AGAIN|ETIMEDOUT/iu.test(unwrapped)
    )
        return new Error(t("暂时连不上KissOpen，请检查网络后再试。"));
    const sentence = unwrapped.replace(ERROR_NAME, "").trim();
    if (sentence && WRITTEN_FOR_PEOPLE.test(sentence)) return new Error(sentence);
    return new Error(t("操作没有完成，请稍后再试。"));
}
