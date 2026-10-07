import { describe, expect, it } from 'vitest';
import { sessionListToCache, sessionsLeftOut } from './sessionListRetention';

function sessions(count: number, newest: number): { id: string; updatedAt: number }[] {
    return Array.from({ length: count }, (_, index) => ({ id: `s${newest - index}`, updatedAt: newest - index }));
}

describe('sessionsLeftOut', () => {
    it('prunes anything missing from a list shorter than the limit', () => {
        const listed = sessions(3, 100);
        const known = [...listed, { id: 'old', updatedAt: 1 }];
        expect(sessionsLeftOut(listed, known, new Set(), 150)).toEqual({ gone: [{ id: 'old', updatedAt: 1 }], pagedOut: [] });
    });

    it('keeps sessions a full list paged out, and prunes those it should have had', () => {
        const listed = sessions(150, 1000); // updatedAt 851..1000
        const deleted = { id: 'deleted', updatedAt: 900 };
        const pagedOut = { id: 'paged', updatedAt: 850 };
        const tie = { id: 'tie', updatedAt: 851 };
        const result = sessionsLeftOut(listed, [deleted, pagedOut, tie, listed[0]], new Set(), 150);
        expect(result.gone).toEqual([deleted]);
        expect(result.pagedOut).toEqual([pagedOut, tie]);
    });

    it('never prunes a session touched live while the list was fetched', () => {
        const listed = sessions(2, 10);
        const result = sessionsLeftOut(listed, [{ id: 'new', updatedAt: 11 }], new Set(['new']), 150);
        expect(result).toEqual({ gone: [], pagedOut: [{ id: 'new', updatedAt: 11 }] });
    });
});

describe('sessionListToCache', () => {
    it('keeps every listed record and the newest paged-out ones up to the cap', () => {
        const listed = sessions(2, 100);
        const paged = [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 3 }, { id: 'c', updatedAt: 2 }];
        expect(sessionListToCache(listed, paged, 4).map((session) => session.id)).toEqual(['s100', 's99', 'b', 'c']);
        expect(sessionListToCache(listed, paged, 1).map((session) => session.id)).toEqual(['s100', 's99']);
    });
});
