import { describe, expect, it } from 'vitest';
import {
    getPatchChanges,
    getPatchInput,
    getPatchKindLabel,
    looksLikeUnifiedDiff,
    parseApplyPatchEnvelope,
} from './codexPatchEntry';

describe('looksLikeUnifiedDiff', () => {
    it('recognises a hunk header anywhere in the text', () => {
        expect(looksLikeUnifiedDiff('@@ -1 +1,45 @@\n-old\n+new')).toBe(true);
        expect(looksLikeUnifiedDiff('--- a/x\n+++ b/x\n@@ -1 +1 @@')).toBe(true);
        expect(looksLikeUnifiedDiff('diff --git a/x b/x')).toBe(true);
    });

    it('rejects plain file bodies, even ones that start with punctuation', () => {
        // The payload that made new files render as "no changes".
        expect(looksLikeUnifiedDiff('.DS_Store\n\n# Environment files\n.env\n')).toBe(false);
        expect(looksLikeUnifiedDiff('# Tests\n\nPlace automated tests here.\n')).toBe(false);
        // A body that merely mentions @@ mid-line is still not a diff.
        expect(looksLikeUnifiedDiff('const email = "a@@b";\n')).toBe(false);
    });
});

describe('getPatchInput', () => {
    it('treats an update diff as a patch', () => {
        const change = {
            kind: { type: 'update', move_path: null },
            diff: '@@ -13,3 +13,3 @@\n context\n-was\n+is\n',
        };
        expect(getPatchInput(change)).toEqual({ kind: 'patch', patch: change.diff });
    });

    it('treats an added file body as new content, not as a patch', () => {
        // Codex puts the whole file in `diff` when the kind is `add`.
        const body = '.DS_Store\n\n# Environment files\n.env\n';
        expect(getPatchInput({ kind: { type: 'add' }, diff: body })).toEqual({
            kind: 'pair',
            oldText: '',
            newText: body,
        });
    });

    it('treats a deleted file body as removed content', () => {
        const body = 'export const OLD = 1;\n';
        expect(getPatchInput({ kind: { type: 'delete' }, diff: body })).toEqual({
            kind: 'pair',
            oldText: body,
            newText: '',
        });
    });

    it('still honours a real unified diff on an add', () => {
        // Some providers do send a proper diff for new files; keep parsing it.
        const diff = '@@ -0,0 +1,2 @@\n+first\n+second\n';
        expect(getPatchInput({ kind: { type: 'add' }, diff })).toEqual({ kind: 'patch', patch: diff });
    });

    it('reads the explicit add/modify/delete shapes', () => {
        expect(getPatchInput({ add: { content: 'x\n' } })).toEqual({ kind: 'pair', oldText: '', newText: 'x\n' });
        expect(getPatchInput({ modify: { old_content: 'a', new_content: 'b' } })).toEqual({
            kind: 'pair', oldText: 'a', newText: 'b',
        });
        expect(getPatchInput({ delete: { content: 'gone\n' } })).toEqual({
            kind: 'pair', oldText: 'gone\n', newText: '',
        });
    });

    it('returns null when there is nothing to show', () => {
        expect(getPatchInput({ kind: { type: 'update' } })).toBeNull();
    });
});

describe('getPatchKindLabel', () => {
    it('names each kind, and calls a moved file a move', () => {
        expect(getPatchKindLabel({ kind: { type: 'add' } })).toBe('new');
        expect(getPatchKindLabel({ kind: { type: 'delete' } })).toBe('delete');
        expect(getPatchKindLabel({ kind: { type: 'update' } })).toBe('edit');
        expect(getPatchKindLabel({ kind: { type: 'update', move_path: 'b.ts' } })).toBe('move');
    });
});

describe('getPatchChanges', () => {
    it('accepts the map shape', () => {
        const changes = getPatchChanges({ changes: { 'a.ts': { kind: { type: 'add' }, diff: 'x' } } });
        expect(Object.keys(changes ?? {})).toEqual(['a.ts']);
    });

    it('accepts the list shape and keys it by path', () => {
        const changes = getPatchChanges({
            changes: [{ path: 'a.ts', type: 'add', content: 'x\n' }],
        });
        expect(changes?.['a.ts']?.add).toEqual({ content: 'x\n' });
    });

    it('returns null when there is no change map at all', () => {
        expect(getPatchChanges({})).toBeNull();
        expect(getPatchChanges({ changes: [] })).toBeNull();
    });

    it('parses the raw envelope from the Rig `patch` and codex `input` arguments', () => {
        const envelope = '*** Begin Patch\n*** Update File: a.ts\n@@\n-was\n+is\n*** End Patch\n';
        for (const input of [{ patch: envelope }, { input: envelope }]) {
            const changes = getPatchChanges(input);
            expect(changes?.['a.ts']?.modify).toEqual({ old_content: 'was', new_content: 'is' });
        }
    });

    it('ignores strings that are not a patch envelope', () => {
        expect(getPatchChanges({ patch: 'just some text' })).toBeNull();
        expect(getPatchChanges({ input: '-was\n+is\n' })).toBeNull();
    });

    it('honors an explicit workdir for both file and move paths', () => {
        const changes = getPatchChanges({
            workdir: '/repo/packages/app',
            patch: '*** Begin Patch\n*** Update File: ../a.ts\n*** Move to: src/b.ts\n@@\n-old\n+new\n*** End Patch',
        });
        expect(Object.keys(changes ?? {})).toEqual(['/repo/packages/a.ts']);
        expect(changes?.['/repo/packages/a.ts'].kind?.move_path).toBe('/repo/packages/app/src/b.ts');
    });

    it('returns invalid maps to the raw fallback rather than crashing the renderer', () => {
        expect(getPatchChanges({ changes: { 'a.ts': null } })).toBeNull();
        expect(getPatchChanges({ fileChanges: { 'a.ts': 5 } })).toBeNull();
    });
});

describe('parseApplyPatchEnvelope', () => {
    it('parses add, update, and delete sections into a change map', () => {
        const changes = parseApplyPatchEnvelope([
            '*** Begin Patch',
            '*** Add File: docs/new.md',
            '+# Title',
            '+',
            '+Body',
            '*** Update File: src/a.ts',
            '@@ export function main() {',
            '     before',
            '-    return 1;',
            '+    return 2;',
            '     after',
            '*** Delete File: src/gone.ts',
            '*** End Patch',
            '',
        ].join('\n'));

        expect(Object.keys(changes ?? {})).toEqual(['docs/new.md', 'src/a.ts', 'src/gone.ts']);
        expect(changes?.['docs/new.md']).toEqual({
            kind: { type: 'add', move_path: null },
            add: { content: '# Title\n\nBody' },
        });
        expect(getPatchKindLabel(changes!['src/gone.ts'])).toBe('delete');

        // The anchor and context lines land on both sides so the diff view
        // recomputes exactly the +/- lines.
        expect(changes?.['src/a.ts']?.modify).toEqual({
            old_content: 'export function main() {\n    before\n    return 1;\n    after',
            new_content: 'export function main() {\n    before\n    return 2;\n    after',
        });
    });

    it('records a move and keeps the update keyed by the original path', () => {
        const changes = parseApplyPatchEnvelope([
            '*** Begin Patch',
            '*** Update File: src/old.ts',
            '*** Move to: src/new.ts',
            '@@',
            '-a',
            '+b',
            '*** End Patch',
        ].join('\n'));

        expect(changes?.['src/old.ts']?.kind).toEqual({ type: 'update', move_path: 'src/new.ts' });
        expect(getPatchKindLabel(changes!['src/old.ts'])).toBe('move');
    });

    it('tolerates unprefixed context and skips End of File markers', () => {
        const changes = parseApplyPatchEnvelope([
            '*** Begin Patch',
            '*** Update File: a.txt',
            'context without prefix',
            '-old',
            '+new',
            '*** End of File',
            '*** End Patch',
        ].join('\n'));

        expect(changes?.['a.txt']?.modify).toEqual({
            old_content: 'context without prefix\nold',
            new_content: 'context without prefix\nnew',
        });
    });

    it('returns null for an envelope with no file sections', () => {
        expect(parseApplyPatchEnvelope('*** Begin Patch\n*** End Patch\n')).toBeNull();
    });

    it('refuses incomplete, unknown, or repeated operations so the raw fallback remains visible', () => {
        expect(parseApplyPatchEnvelope('*** Begin Patch\n*** Add File: a\n+x')).toBeNull();
        expect(parseApplyPatchEnvelope('*** Begin Patch\n*** Add File: a\n+x\n*** End Patch\ntrailing')).toBeNull();
        expect(parseApplyPatchEnvelope('*** Begin Patch\n*** Add File: a\n+x\n*** Unknown\n*** End Patch')).toBeNull();
        expect(parseApplyPatchEnvelope('*** Begin Patch\n*** Add File: a\n+x\n*** Add File: a\n+y\n*** End Patch')).toBeNull();
    });

    it('preserves anchor whitespace and prototype-looking file names', () => {
        const changes = parseApplyPatchEnvelope('*** Begin Patch\n*** Update File: __proto__\n@@     function f() {\n-old\n+new\n*** End Patch');
        expect(Object.keys(changes ?? {})).toEqual(['__proto__']);
        expect(changes?.['__proto__'].modify?.old_content).toBe('    function f() {\nold');
    });
});
