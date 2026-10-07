import { describe, expect, it } from 'vitest';
import { cacheAccountKey, cacheDigest, cacheFileName, projectFileCacheKey } from './cacheKeys';

describe('cacheAccountKey', () => {
    it('is stable for one account on one server, ignoring a trailing slash', () => {
        expect(cacheAccountKey('https://api.example.test/', 'user-1')).toBe(cacheAccountKey('https://api.example.test', 'user-1'));
        expect(cacheAccountKey('https://api.example.test', 'user-1')).toMatch(/^[0-9a-f]{16}$/);
    });

    it('separates accounts and servers', () => {
        const key = cacheAccountKey('https://a.example.test', 'user-1');
        expect(cacheAccountKey('https://a.example.test', 'user-2')).not.toBe(key);
        expect(cacheAccountKey('https://b.example.test', 'user-1')).not.toBe(key);
    });

    it('does not contain the account id', () => {
        expect(cacheAccountKey('https://a.example.test', 'account-abc')).not.toContain('account');
    });
});

describe('cacheFileName', () => {
    it('keeps a plain id and digests anything that could leave the folder', () => {
        expect(cacheFileName('cmabc123-XYZ_9')).toBe('cmabc123-XYZ_9');
        expect(cacheFileName('../../etc')).toBe(`h${cacheDigest('../../etc')}`);
        expect(cacheFileName('a/b')).toMatch(/^h[0-9a-f]{16}$/);
    });
});

describe('projectFileCacheKey', () => {
    it('names one file of one folder on one machine', () => {
        const key = projectFileCacheKey('machine-1', '/work/site', '.kissopen/board.json');
        expect(key).toBe(projectFileCacheKey('machine-1', '/work/site', '.kissopen/board.json'));
        expect(projectFileCacheKey('machine-2', '/work/site', '.kissopen/board.json')).not.toBe(key);
        expect(projectFileCacheKey('machine-1', '/work/other', '.kissopen/board.json')).not.toBe(key);
        expect(projectFileCacheKey('machine-1', '/work/site', '.kissopen/project.json')).not.toBe(key);
    });
});
