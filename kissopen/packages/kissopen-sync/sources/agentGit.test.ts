import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rigMetadataFixture } from './testing/rigMetadata';
import {
    getKissopenAgentGitState,
    readKissopenAgentGitFile,
    supportsKissopenAgentGit,
    type AgentGitSession,
    type KissopenAgentGitFile,
    type KissopenAgentGitState,
} from './agentGit';
import type { Metadata } from './storageTypes';

/*
The session, handed in rather than mocked into place.

What this module needs is two things — something to ask, and what that session
says it can answer — so a test supplies both directly instead of replacing the
socket and the store underneath it.
*/
const rpc = vi.fn();
const session: { rpc: typeof rpc; metadata: Metadata | null } = { rpc, metadata: null };
const asSession = () => session as unknown as AgentGitSession;
const BASE = 'a'.repeat(40);
const HASH = 'b'.repeat(64);

const nativeMetadata: Metadata = {
    ...rigMetadataFixture,
    capabilities: {
        ...rigMetadataFixture.capabilities!,
        files: { ...rigMetadataFixture.capabilities!.files, read: true },
        rpcMethods: [
            ...rigMetadataFixture.capabilities!.rpcMethods,
            'gitState',
            'readFileAtRevision',
        ],
    },
};

function file(overrides: Partial<KissopenAgentGitFile> = {}): KissopenAgentGitFile {
    return {
        path: 'src/file.ts',
        status: 'modified',
        staged: false,
        unstaged: true,
        binary: false,
        ...overrides,
    };
}

function gitState(files: KissopenAgentGitFile[] = []): KissopenAgentGitState {
    return {
        facts: {
            branch: 'feature/mobile-changes',
            detached: false,
            head: BASE,
            upstream: 'origin/feature/mobile-changes',
            ahead: 1,
            behind: 2,
        },
        comparison: 'ready',
        base: BASE,
        changedFiles: files.length,
        insertions: 3,
        deletions: 1,
        countsExact: true,
        conflicted: false,
        files,
        filesTruncated: false,
        scannedAt: 123,
    };
}

function useNativeSession(metadata: Metadata | null = nativeMetadata): void {
    session.metadata = metadata;
}

function textResponse(content: string) {
    return { success: true, content, hash: HASH };
}

function revisionResponse(content: string) {
    return { success: true, content };
}

beforeEach(() => {
    rpc.mockReset();
    session.metadata = null;
});

describe('KISSOPEN Agent Git capability gating', () => {
    it('requires native V1, readable files, and every Git RPC method', () => {
        expect(supportsKissopenAgentGit(nativeMetadata)).toBe(true);
        expect(supportsKissopenAgentGit({
            ...nativeMetadata,
            rigMetadataVersion: 0,
        } as Metadata)).toBe(false);
        expect(supportsKissopenAgentGit({
            ...nativeMetadata,
            rigMetadataVersion: undefined,
        })).toBe(false);
        expect(supportsKissopenAgentGit({
            ...nativeMetadata,
            capabilities: {
                ...nativeMetadata.capabilities!,
                files: { ...nativeMetadata.capabilities!.files, read: false },
            },
        })).toBe(false);
        expect(supportsKissopenAgentGit({
            ...nativeMetadata,
            capabilities: {
                ...nativeMetadata.capabilities!,
                rpcMethods: ['readFile', 'gitState'],
            },
        })).toBe(false);
    });

    it('does not call RPC for unsupported, V0, or legacy sessions', async () => {
        for (const metadata of [
            null,
            { ...nativeMetadata, rigMetadataVersion: 0 } as Metadata,
            { ...nativeMetadata, rigMetadataVersion: undefined },
        ]) {
            useNativeSession(metadata);
            await expect(getKissopenAgentGitState(asSession())).rejects.toThrow(/not available/);
        }
        expect(rpc).not.toHaveBeenCalled();
    });
});

describe('KISSOPEN Agent Git state', () => {
    it('uses an exact session-scoped empty gitState request and preserves committed files', async () => {
        const committed = file({ path: 'committed.ts', staged: false, unstaged: false });
        const staged = file({ path: 'staged.ts', staged: true, unstaged: false });
        useNativeSession();
        rpc.mockResolvedValue({ success: true, git: gitState([committed, staged]) });

        await expect(getKissopenAgentGitState(asSession())).resolves.toEqual(gitState([committed, staged]));
        expect(rpc).toHaveBeenCalledExactlyOnceWith('gitState', {});
    });

    it('throws the native failure message and rejects malformed or unknown responses', async () => {
        useNativeSession();
        rpc.mockResolvedValueOnce({
            success: false,
            code: 'unavailable',
            error: 'Git is unavailable for this workspace.',
        });
        await expect(getKissopenAgentGitState(asSession())).rejects.toThrow('Git is unavailable for this workspace.');

        rpc.mockResolvedValueOnce({ success: true, git: { comparison: 'unknown' } });
        await expect(getKissopenAgentGitState(asSession())).rejects.toThrow('invalid Git state');
    });
});

describe('KISSOPEN Agent Git file reads', () => {
    it('reads a modified file from the exact base and working-tree paths in parallel', async () => {
        useNativeSession();
        rpc
            .mockResolvedValueOnce(revisionResponse(btoa('old text\n')))
            .mockResolvedValueOnce(textResponse(btoa('new text\n')));

        await expect(readKissopenAgentGitFile(asSession(), BASE, file())).resolves.toEqual({
            kind: 'text',
            oldText: 'old text\n',
            newText: 'new text\n',
        });
        expect(rpc).toHaveBeenCalledTimes(2);
        expect(rpc).toHaveBeenCalledWith('readFileAtRevision', {
            path: 'src/file.ts',
            revision: BASE,
        });
        expect(rpc).toHaveBeenCalledWith('readFile', { path: 'src/file.ts' });
    });

    it('uses previousPath for renames and skips the absent side for add/delete', async () => {
        useNativeSession();
        rpc
            .mockResolvedValueOnce(revisionResponse(btoa('before\n')))
            .mockResolvedValueOnce(textResponse(btoa('after\n')));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({
            path: 'new/name.ts',
            previousPath: 'old/name.ts',
            status: 'renamed',
        }))).resolves.toEqual({ kind: 'text', oldText: 'before\n', newText: 'after\n' });
        expect(rpc).toHaveBeenNthCalledWith(1, 'readFileAtRevision', {
            path: 'old/name.ts', revision: BASE,
        });
        expect(rpc).toHaveBeenNthCalledWith(2, 'readFile', { path: 'new/name.ts' });

        rpc.mockReset();
        rpc.mockResolvedValueOnce(textResponse(btoa('added\n')));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).resolves.toEqual({
            kind: 'text', oldText: '', newText: 'added\n',
        });
        expect(rpc).toHaveBeenCalledExactlyOnceWith('readFile', { path: 'src/file.ts' });

        rpc.mockReset();
        rpc.mockResolvedValueOnce(revisionResponse(btoa('deleted\n')));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'deleted' }))).resolves.toEqual({
            kind: 'text', oldText: 'deleted\n', newText: '',
        });
        expect(rpc).toHaveBeenCalledExactlyOnceWith('readFileAtRevision', {
            path: 'src/file.ts', revision: BASE,
        });
    });

    it('keeps empty and equal content as text instead of treating it as missing', async () => {
        useNativeSession();
        rpc
            .mockResolvedValueOnce(revisionResponse(''))
            .mockResolvedValueOnce(textResponse(''));

        await expect(readKissopenAgentGitFile(asSession(), BASE, file())).resolves.toEqual({
            kind: 'text', oldText: '', newText: '',
        });
    });

    it('preserves a UTF-8 byte order mark so adding or removing one is a visible change', async () => {
        const bomBytes = String.fromCharCode(0xef, 0xbb, 0xbf);
        useNativeSession();
        rpc
            .mockResolvedValueOnce(revisionResponse(btoa('hello\n')))
            .mockResolvedValueOnce(textResponse(btoa(`${bomBytes}hello\n`)));

        const result = await readKissopenAgentGitFile(asSession(), BASE, file());
        expect(result.kind).toBe('text');
        if (result.kind !== 'text') return;
        expect(result.oldText).toBe('hello\n');
        expect(result.newText).toBe('\ufeffhello\n');
        expect(result.oldText).not.toBe(result.newText);

        rpc.mockReset();
        rpc.mockResolvedValueOnce(textResponse(btoa(bomBytes)));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).resolves.toEqual({
            kind: 'text', oldText: '', newText: '\ufeff',
        });
    });

    it('returns explicit messages for unsupported and non-image binary files without reading', async () => {
        useNativeSession();
        for (const status of ['conflicted', 'submodule', 'type_changed'] as const) {
            await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status }))).resolves.toMatchObject({
                kind: 'message',
            });
        }
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ path: 'archive.dat', binary: true }))).resolves.toEqual({
            kind: 'message', message: 'Binary file changes cannot be previewed.',
        });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('returns image data with the path-specific MIME type for a binary rename', async () => {
        useNativeSession();
        rpc
            .mockResolvedValueOnce(revisionResponse(btoa('\x89PNG\r\n')))
            .mockResolvedValueOnce(textResponse(btoa('GIF89a')));

        await expect(readKissopenAgentGitFile(asSession(), BASE, file({
            path: 'new/photo.jpg',
            previousPath: 'old/photo.png',
            status: 'renamed',
            binary: true,
        }))).resolves.toEqual({
            kind: 'image',
            before: 'data:image/png;base64,iVBORw0K',
            after: 'data:image/jpeg;base64,R0lGODlh',
        });
    });

    it('surfaces native missing and local oversize failures as human errors', async () => {
        useNativeSession();
        rpc
            .mockResolvedValueOnce({ success: false, code: 'missing', error: 'The file does not exist at this revision.' })
            .mockResolvedValueOnce(textResponse(btoa('new\n')));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file())).rejects.toThrow(
            'The file does not exist at this revision.',
        );

        rpc.mockReset();
        const tooLarge = btoa('x'.repeat(512 * 1024 + 1));
        rpc.mockResolvedValueOnce(textResponse(tooLarge));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).rejects.toThrow(
            'This file is too large to preview on the phone.',
        );

        rpc.mockReset();
        const exactlyAtLimit = 'x'.repeat(512 * 1024);
        rpc.mockResolvedValueOnce(textResponse(btoa(exactlyAtLimit)));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).resolves.toEqual({
            kind: 'text', oldText: '', newText: exactlyAtLimit,
        });
    });

    it('rejects malformed read responses and preserves transport errors', async () => {
        useNativeSession();
        rpc.mockResolvedValueOnce({ success: true, content: 7, hash: HASH });
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).rejects.toThrow('invalid file response');

        const transportError = new Error('The computer did not respond');
        rpc.mockReset();
        rpc.mockRejectedValueOnce(transportError);
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).rejects.toBe(transportError);
    });

    it('waits for the other started side after one RPC rejects', async () => {
        useNativeSession();
        const beforeError = new Error('base read failed');
        let resolveAfter!: (response: unknown) => void;
        const afterPending = new Promise<unknown>((resolve) => { resolveAfter = resolve; });
        // The session id is gone from the call: the session itself is the
        // first argument now, so the method is.
        rpc.mockImplementation((method: string) =>
            method === 'readFileAtRevision' ? Promise.reject(beforeError) : afterPending,
        );

        let settled = false;
        const reading = readKissopenAgentGitFile(asSession(), BASE, file());
        void reading.then(() => { settled = true; }, () => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);

        resolveAfter(textResponse(btoa('after\n')));
        await expect(reading).rejects.toBe(beforeError);
    });

    it('reports binary-looking text and empty images without fabricating text', async () => {
        useNativeSession();
        rpc.mockResolvedValueOnce(textResponse(btoa('a\u0000b')));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).resolves.toEqual({
            kind: 'message', message: 'This file contains binary data and cannot be shown as text.',
        });

        rpc.mockReset();
        rpc.mockResolvedValueOnce(textResponse(''));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ path: 'empty.png', status: 'added', binary: true }))).resolves.toEqual({
            kind: 'message', message: 'Image content is empty.',
        });
    });

    it('allows 20,000 combined lines, ignores a trailing newline, and caps larger text', async () => {
        useNativeSession();
        const tenThousandLines = 'x\n'.repeat(10_000);
        rpc
            .mockResolvedValueOnce(revisionResponse(btoa(tenThousandLines)))
            .mockResolvedValueOnce(textResponse(btoa(tenThousandLines)));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file())).resolves.toMatchObject({
            kind: 'text', oldText: tenThousandLines, newText: tenThousandLines,
        });

        rpc.mockReset();
        const tooManyLines = 'x\n'.repeat(20_001);
        rpc.mockResolvedValueOnce(textResponse(btoa(tooManyLines)));
        await expect(readKissopenAgentGitFile(asSession(), BASE, file({ status: 'added' }))).resolves.toEqual({
            kind: 'message', message: 'This file has too many lines to preview here.',
        });
    });
});