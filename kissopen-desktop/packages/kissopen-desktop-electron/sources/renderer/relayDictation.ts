/*
Dictation for this window.

There is one microphone, so there is one dictation store, made once the
account's store exists — transcription is the account's — and handed to every
composer in the window: the local agent's, through the router's context, and a
remote conversation's, directly. A composer that gets no store draws no mic.
*/
import {
    dictationStoreCreate,
    type DictationStore,
    type KissopenStore,
} from "kissopen-desktop-state";

let store: DictationStore | undefined;

/** Makes the window's dictation store from the account's store; once. */
export function dictationBind(kissopen: KissopenStore): DictationStore {
    store ??= dictationStoreCreate({ transcribe: kissopen.transcribe });
    return store;
}

/** The window's dictation store, or nothing before the account's store exists. */
export function dictationCurrent(): DictationStore | undefined {
    return store;
}
