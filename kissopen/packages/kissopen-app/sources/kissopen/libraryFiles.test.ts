import { describe, expect, it } from 'vitest';
import {
    libraryFilesOf,
    libraryFilesParse,
    libraryKindOf,
    libraryMatches,
    libraryNewestFirst,
    librarySections,
    librarySizeText,
    librarySubfolders,
    type LibraryEntry,
    type LibraryFile,
} from './libraryFiles';

const file = (path: string, modified?: number): LibraryFile => ({
    name: path.split('/').at(-1)!,
    path,
    kind: path.startsWith('uploads') ? 'upload' : 'output',
    ...(modified === undefined ? {} : { modified }),
});

describe('listed folders', () => {
    it('keeps the files of a folder, relative to the project, with their kind', () => {
        const files = libraryFilesOf('outputs/2026-09', [
            { name: 'report.pdf', type: 'file', size: 2048, modified: 5 },
            { name: 'drafts', type: 'directory', modified: 9 },
            { name: '.DS_Store', type: 'file', size: 1 },
            { name: 'socket', type: 'other' },
        ]);
        expect(files).toEqual([{ name: 'report.pdf', path: 'outputs/2026-09/report.pdf', kind: 'output', size: 2048, modified: 5 }]);
        expect(libraryFilesOf('uploads', [{ name: 'photo.jpg', type: 'file' }])).toEqual([
            { name: 'photo.jpg', path: 'uploads/photo.jpg', kind: 'upload' },
        ]);
    });

    it('reads the newest subfolders only, hidden ones never', () => {
        const entries = [
            { name: 'old', type: 'directory' as const, modified: 1 },
            { name: 'new', type: 'directory' as const, modified: 3 },
            { name: 'mid', type: 'directory' as const, modified: 2 },
            { name: '.cache', type: 'directory' as const, modified: 9 },
            { name: 'a.txt', type: 'file' as const, modified: 9 },
        ];
        expect(librarySubfolders('outputs', entries)).toEqual(['outputs/new', 'outputs/mid', 'outputs/old']);
        expect(librarySubfolders('outputs', entries, 2)).toEqual(['outputs/new', 'outputs/mid']);
    });

    it('orders files newest first, undated ones last by path', () => {
        const sorted = libraryNewestFirst([file('uploads/b.txt'), file('outputs/x.md', 10), file('uploads/a.txt'), file('outputs/y.md', 20)]);
        expect(sorted.map(one => one.path)).toEqual(['outputs/y.md', 'outputs/x.md', 'uploads/a.txt', 'uploads/b.txt']);
    });
});

describe('sections', () => {
    const alpha = { id: 'alpha', name: 'Alpha', place: 'Cloud' };
    const beta = { id: 'beta', name: 'Beta', place: 'MacBook' };
    const entry = (id: string, at: number | undefined, project?: typeof alpha): LibraryEntry => ({
        id,
        name: `${id}.md`,
        kind: 'document',
        ...(at === undefined ? {} : { at }),
        ...(project ? { project } : {}),
    });
    const now = new Date(2026, 8, 29, 15, 0).getTime();
    const hour = 3_600_000;

    it('groups by project, the one with the newest file first, chat files last', () => {
        const sections = librarySections([
            entry('a1', now - 5 * hour, alpha),
            entry('chat', now),
            entry('b1', now - hour, beta),
            entry('a2', now - 2 * hour, alpha),
        ], 'project', now);
        expect(sections.map(section => section.id)).toEqual(['project:beta', 'project:alpha', 'unassigned']);
        expect(sections[1].entries.map(one => one.id)).toEqual(['a2', 'a1']);
    });

    it('groups by day, undated files with the earliest', () => {
        const sections = librarySections([
            entry('today', now - hour, alpha),
            entry('yesterday', now - 20 * hour),
            entry('week', now - 3 * 24 * hour, beta),
            entry('old', now - 90 * 24 * hour),
            entry('undated', undefined),
        ], 'time', now);
        expect(sections.map(section => section.id)).toEqual(['day:today', 'day:yesterday', 'day:week', 'day:earlier']);
        expect(sections[3].entries.map(one => one.id)).toEqual(['old', 'undated']);
    });

    it('has no sections without files', () => {
        expect(librarySections([], 'project', now)).toEqual([]);
        expect(librarySections([], 'time', now)).toEqual([]);
    });

    it('filters by type and searches names and projects', () => {
        const picture: LibraryEntry = { id: 'p', name: 'Poster.PNG', kind: libraryKindOf('Poster.PNG'), project: alpha };
        expect(picture.kind).toBe('image');
        expect(libraryKindOf('orders.xlsx')).toBe('data');
        expect(libraryKindOf('menu.docx')).toBe('document');
        expect(libraryMatches(picture, 'image', '')).toBe(true);
        expect(libraryMatches(picture, 'document', '')).toBe(false);
        expect(libraryMatches(picture, 'all', 'poster')).toBe(true);
        expect(libraryMatches(picture, 'all', 'alph')).toBe(true);
        expect(libraryMatches(picture, 'all', 'beta')).toBe(false);
    });
});

describe('kept listings', () => {
    it('reads back what was kept and drops what is malformed', () => {
        const kept = [file('outputs/a.md', 3), { name: 1, path: 'x', kind: 'output' }, { name: 'b', path: 'b', kind: 'other' }, null];
        expect(libraryFilesParse(JSON.stringify(kept))).toEqual([file('outputs/a.md', 3)]);
    });

    it('has nothing for nothing kept or text that is not a list', () => {
        expect(libraryFilesParse(undefined)).toBeUndefined();
        expect(libraryFilesParse('{')).toBeUndefined();
        expect(libraryFilesParse('{}')).toBeUndefined();
    });
});

describe('sizes', () => {
    it('reads as bytes, kilobytes or megabytes', () => {
        expect(librarySizeText(512)).toBe('512 B');
        expect(librarySizeText(2048)).toBe('2.0 KB');
        expect(librarySizeText(20 * 1024)).toBe('20 KB');
        expect(librarySizeText(3 * 1024 * 1024)).toBe('3.0 MB');
    });
});
