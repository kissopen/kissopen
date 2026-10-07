/*
 * How the phone reads one file of a project's `.kissopen` folder — board.json
 * or project.json — from the computer (or cloud) the project lives on.
 *
 * Three ways to ask, in order, each tried only when the one before could not
 * be asked at all:
 *
 * 1. The Kissopen agent's machine connection (`read-kissopen-project-file`).
 *    Its answer is final either way: the file, or the machine saying there is
 *    none (`definite` missing — the phone forgets its kept copy).
 * 2. A conversation in the project's folder (`readFile`), which is how an
 *    older agent's files are reached. A refusal there may only mean the
 *    conversation could not ask, so it is not definite.
 * 3. `cat` over the machine's `bash`, for a daemon that serves one. A
 *    non-zero exit is the machine saying the file is not there.
 *
 * When nothing could be asked the file is `unreachable` and the kept copy
 * stays on screen. The ways are passed in, so the order can be tested alone.
 */

export type ProjectFileName = 'board.json' | 'project.json';

export type ProjectFileRead =
    | { readonly kind: 'read'; readonly text: string }
    /** `definite`: the computer itself said there is no such file. */
    | { readonly kind: 'missing'; readonly definite: boolean }
    | { readonly kind: 'unreachable' };

export interface ProjectFileReaders {
    /** Whether the relay is connected at all; nothing can be asked without it. */
    connected(): boolean;
    machineRead(machineId: string, directory: string, name: ProjectFileName): Promise<
        | { readonly answered: true; readonly success: true; readonly content: string }
        | { readonly answered: true; readonly success: false }
        | { readonly answered: false }
    >;
    sessionRead(sessionId: string, file: string): Promise<{ readonly success: boolean; readonly content?: string }>;
    machineBash(machineId: string, command: string, cwd: string): Promise<{ readonly success: boolean; readonly stdout: string; readonly exitCode: number }>;
}

/** Base64 file bytes as UTF-8 text, the way every project file is read. */
export function base64Utf8(content: string): string {
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
}

/** `.kissopen/board.json` → `board.json`: the name the agent's method takes. */
function projectFileName(file: string): ProjectFileName | undefined {
    const name = file.split('/').at(-1);
    return name === 'board.json' || name === 'project.json' ? name : undefined;
}

/**
 * One file of the project's, by its path in the project's folder (e.g.
 * `.kissopen/board.json`), asked for in the order above.
 */
export async function projectFileReadVia(
    readers: ProjectFileReaders,
    machineId: string,
    path: string,
    sessionId: string | undefined,
    file: string,
): Promise<ProjectFileRead> {
    if (!readers.connected()) return { kind: 'unreachable' };

    const name = projectFileName(file);
    if (machineId && path && name) {
        const answer = await readers.machineRead(machineId, path, name);
        if (answer.answered) {
            return answer.success ? { kind: 'read', text: base64Utf8(answer.content) } : { kind: 'missing', definite: true };
        }
    }

    let sessionRefused = false;
    if (sessionId) {
        const read = await readers.sessionRead(sessionId, file);
        if (read.success && typeof read.content === 'string') return { kind: 'read', text: base64Utf8(read.content) };
        sessionRefused = true;
    }

    const result = await readers.machineBash(machineId, `cat ${file}`, path);
    if (result.success && result.exitCode === 0) return { kind: 'read', text: result.stdout };
    if (result.exitCode > 0) return { kind: 'missing', definite: true };
    // The conversation answered without the file, and nothing else could be asked.
    return sessionRefused ? { kind: 'missing', definite: false } : { kind: 'unreachable' };
}
