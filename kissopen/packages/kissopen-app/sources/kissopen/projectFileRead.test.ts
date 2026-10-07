import { describe, expect, it, vi } from 'vitest';
import { base64Utf8, projectFileReadVia, type ProjectFileReaders } from './projectFileRead';

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

function readers(overrides: Partial<ProjectFileReaders> = {}) {
    return {
        connected: vi.fn(() => true),
        machineRead: vi.fn(async () => ({ answered: false as const })),
        sessionRead: vi.fn(async () => ({ success: false })),
        machineBash: vi.fn(async () => ({ success: false, stdout: '', exitCode: -1 })),
        ...overrides,
    } satisfies ProjectFileReaders;
}

const BOARD = '.kissopen/board.json';

describe('projectFileReadVia', () => {
    it('reads through the agent\'s machine method first, by the file\'s name in the folder', async () => {
        const ways = readers({ machineRead: vi.fn(async () => ({ answered: true as const, success: true as const, content: b64('{"看板":1}') })) });
        await expect(projectFileReadVia(ways, 'm1', '/work/site', 's1', BOARD)).resolves.toEqual({ kind: 'read', text: '{"看板":1}' });
        expect(ways.machineRead).toHaveBeenCalledWith('m1', '/work/site', 'board.json');
        expect(ways.sessionRead).not.toHaveBeenCalled();
        expect(ways.machineBash).not.toHaveBeenCalled();
    });

    it('takes the machine saying there is no file as final', async () => {
        const ways = readers({ machineRead: vi.fn(async () => ({ answered: true as const, success: false as const })) });
        await expect(projectFileReadVia(ways, 'm1', '/work/site', 's1', '.kissopen/project.json')).resolves.toEqual({ kind: 'missing', definite: true });
        expect(ways.machineRead).toHaveBeenCalledWith('m1', '/work/site', 'project.json');
        expect(ways.sessionRead).not.toHaveBeenCalled();
    });

    it('falls back to the conversation when the machine method cannot be asked', async () => {
        const ways = readers({ sessionRead: vi.fn(async () => ({ success: true, content: b64('board') })) });
        await expect(projectFileReadVia(ways, 'm1', '/work/site', 's1', BOARD)).resolves.toEqual({ kind: 'read', text: 'board' });
        expect(ways.sessionRead).toHaveBeenCalledWith('s1', BOARD);
        expect(ways.machineBash).not.toHaveBeenCalled();
    });

    it('then to cat over bash, whose exit code is the machine\'s own answer', async () => {
        const read = readers({ machineBash: vi.fn(async () => ({ success: true, stdout: 'board', exitCode: 0 })) });
        await expect(projectFileReadVia(read, 'm1', '/work/site', undefined, BOARD)).resolves.toEqual({ kind: 'read', text: 'board' });
        expect(read.machineBash).toHaveBeenCalledWith('m1', `cat ${BOARD}`, '/work/site');
        const missing = readers({ machineBash: vi.fn(async () => ({ success: false, stdout: '', exitCode: 1 })) });
        await expect(projectFileReadVia(missing, 'm1', '/work/site', 's1', BOARD)).resolves.toEqual({ kind: 'missing', definite: true });
    });

    it('keeps the kept copy when nothing could be asked', async () => {
        await expect(projectFileReadVia(readers(), 'm1', '/work/site', undefined, BOARD)).resolves.toEqual({ kind: 'unreachable' });
        const offline = readers({ connected: vi.fn(() => false) });
        await expect(projectFileReadVia(offline, 'm1', '/work/site', 's1', BOARD)).resolves.toEqual({ kind: 'unreachable' });
        expect(offline.machineRead).not.toHaveBeenCalled();
    });

    it('reports a conversation refusal with nothing else to ask as missing, but not definitely', async () => {
        await expect(projectFileReadVia(readers(), 'm1', '/work/site', 's1', BOARD)).resolves.toEqual({ kind: 'missing', definite: false });
    });

    it('never sends the machine method a file outside the two it serves', async () => {
        const ways = readers();
        await projectFileReadVia(ways, 'm1', '/work/site', undefined, '.kissopen/other.json');
        expect(ways.machineRead).not.toHaveBeenCalled();
    });
});

describe('base64Utf8', () => {
    it('decodes UTF-8 bytes, not Latin-1', () => {
        expect(base64Utf8(b64('项目看板 ✓'))).toBe('项目看板 ✓');
    });
});
