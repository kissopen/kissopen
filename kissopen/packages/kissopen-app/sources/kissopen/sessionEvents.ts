import type { Persona } from './api/types';
let sessionVersion = 0;
// Notify the app gate the moment a sign-in succeeds, so the whole app opens
// without each screen having to ask the server again.
const startListeners = new Set<() => void>();
export function onConsumerSessionStarted(listener: () => void) {
    startListeners.add(listener);
    return () => { startListeners.delete(listener); };
}
export function consumerSessionStarted() {
    for (const listener of startListeners) listener();
}
// What the person said about their work was saved: the gate opens and the
// home page asks for the page written from it.
const personaListeners = new Set<(persona: Persona) => void>();
export function onPersonaSaved(listener: (persona: Persona) => void) {
    personaListeners.add(listener);
    return () => { personaListeners.delete(listener); };
}
export function personaSaved(persona: Persona) {
    for (const listener of personaListeners) listener(persona);
}
export const consumerSessionVersion = () => sessionVersion;
// Notify mounted screens after consumer sign-out, including screens underneath
// the settings stack, and revoke the mounted account workspace session.
const listeners = new Set<() => void | Promise<void>>();
export function onConsumerSessionEnded(listener: () => void | Promise<void>) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export async function consumerSessionEnded() {
    sessionVersion++;
    selectedFiles = [];
    await Promise.all([...listeners].map(listener => listener()));
}

// File selection belongs to the current cloud draft even when edited from a
// settings detail screen. Keep only IDs in memory and clear them at sign-out.
let selectedFiles: string[] = [];
const fileListeners = new Set<(ids: string[]) => void>();
export function getSelectedCloudFiles() { return [...selectedFiles]; }
export function rememberSelectedCloudFiles(ids: string[]) { selectedFiles = [...ids]; }
export function selectCloudFiles(ids: string[]) {
    rememberSelectedCloudFiles(ids);
    for (const listener of fileListeners) listener([...ids]);
}
export function onCloudFilesSelected(listener: (ids: string[]) => void) {
    fileListeners.add(listener);
    return () => { fileListeners.delete(listener); };
}
