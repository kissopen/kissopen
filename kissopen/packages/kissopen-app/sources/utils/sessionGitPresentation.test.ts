import { describe, expect, it } from 'vitest';
import type { GitFileStatus, GitStatusFiles } from '@/sync/gitStatusFiles';
import type { GitStatus, Metadata } from '@/sync/storageTypes';
import { resolveSessionGitPresentation } from './sessionGitPresentation';

const metadata: Metadata = { path: '/repo/folder-is-not-the-branch', host: 'machine' };
const status: GitStatus = {
    branch: 'feature/header',
    isDirty: true,
    modifiedCount: 1,
    untrackedCount: 0,
    stagedCount: 1,
    lastUpdatedAt: 1,
    stagedLinesAdded: 20,
    stagedLinesRemoved: 4,
    unstagedLinesAdded: 100,
    unstagedLinesRemoved: 30,
    linesAdded: 120,
    linesRemoved: 34,
    linesChanged: 154,
};
const file: GitFileStatus = {
    fileName: 'app.ts', filePath: '', fullPath: 'app.ts', status: 'modified',
    isStaged: false, linesAdded: 100, linesRemoved: 30,
};
const files: GitStatusFiles = {
    branch: 'feature/header',
    stagedFiles: [{ ...file, isStaged: true, linesAdded: 20, linesRemoved: 4 }],
    unstagedFiles: [file],
    totalStaged: 1,
    totalUnstaged: 1,
};
const rig: Metadata = {
    ...metadata,
    client: { id: 'rig', name: 'KISSOPEN Agent', version: '1' },
    git: { changedFiles: 5, insertions: 150, deletions: 40, countsExact: false },
};

describe('session git presentation', () => {
    it('prefers the workspace name over branch and path', () => {
        expect(resolveSessionGitPresentation({
            ...metadata, workspace: { id: 'w', kind: 'git', name: ' nice ' },
        }, status).subtitle).toBe('nice');
    });

    it('falls back to the live branch, then the metadata branch', () => {
        const session = { ...metadata, gitBranch: ' metadata-branch ' };
        expect(resolveSessionGitPresentation(session, status).subtitle).toBe('feature/header');
        expect(resolveSessionGitPresentation(session, null).subtitle).toBe('metadata-branch');
        expect(resolveSessionGitPresentation({
            ...session, workspace: { id: 'w', kind: 'git', name: ' ' },
        }, null).subtitle).toBe('metadata-branch');
    });

    it('does not invent main or use the folder name when git information is unknown', () => {
        expect(resolveSessionGitPresentation(metadata, null)).toEqual({
            subtitle: undefined, changedFileCount: null, changes: null,
        });
        expect(resolveSessionGitPresentation(null, null).subtitle).toBeUndefined();
    });

    it('uses KISSOPEN Agent statistics without a file cache and preserves approximation', () => {
        expect(resolveSessionGitPresentation(rig, null)).toMatchObject({
            changedFileCount: 5,
            changes: { insertions: 150, deletions: 40, approximate: true },
        });
    });

    it('does not replace workspace-comparison counts with a working-tree-only cache', () => {
        expect(resolveSessionGitPresentation(rig, status, files)).toMatchObject({
            changedFileCount: 5,
            changes: { insertions: 150, deletions: 40, approximate: true },
        });
    });

    it('clears stale cached counts when KISSOPEN Agent reports a clean workspace', () => {
        expect(resolveSessionGitPresentation({
            ...rig, git: { changedFiles: 0, insertions: 0, deletions: 0, countsExact: true },
        }, status, files)).toMatchObject({ changedFileCount: 0, changes: null });
    });

    it('counts both staged and unstaged lines, without counting the same file twice', () => {
        expect(resolveSessionGitPresentation(metadata, status, files)).toMatchObject({
            changedFileCount: 1,
            changes: { insertions: 120, deletions: 34, approximate: false },
        });
    });

    it('falls back to file statistics and branch when live status is unavailable', () => {
        expect(resolveSessionGitPresentation(metadata, null, files)).toEqual({
            subtitle: 'feature/header', changedFileCount: 1,
            changes: { insertions: 120, deletions: 34, approximate: false },
        });
    });

    it('does not show line counts for binary-only changes', () => {
        expect(resolveSessionGitPresentation({
            ...rig, git: { changedFiles: 1, insertions: 0, deletions: 0, countsExact: true },
        }, null)).toMatchObject({ changedFileCount: 1, changes: null });
    });

    it('does not use KISSOPEN Agent summaries for legacy sessions', () => {
        expect(resolveSessionGitPresentation({ ...metadata, git: rig.git }, status).changes).toEqual({
            insertions: 120, deletions: 34, approximate: false,
        });
    });
});