/**
 * Reading Codex / Gemini `apply_patch` payloads.
 *
 * The shape varies by provider version — a map or a list, a unified diff or a
 * pair of blobs — so everything that decides "what changed in this file" lives
 * here, away from the rendering, where it can be tested against real payloads.
 */

export type CodexPatchEntry = {
    diff?: string;
    unified_diff?: string;
    type?: string;
    content?: string;
    move_path?: string | null;
    oldContent?: string;
    newContent?: string;
    old_content?: string;
    new_content?: string;
    kind?: {
        type?: string;
        move_path?: string | null;
    };
    add?: {
        content?: string;
    };
    modify?: {
        old_content?: string;
        new_content?: string;
    };
    delete?: {
        content?: string;
    };
};

export type PatchInput =
    | { kind: 'patch'; patch: string }
    | { kind: 'pair'; oldText: string; newText: string };

export function getPatchChanges(input: any): Record<string, CodexPatchEntry> | null {
    if (Array.isArray(input?.changes)) {
        return normalizePatchChangeList(input.changes);
    }
    if (input?.changes && typeof input.changes === 'object') {
        return normalizePatchChangeMap(input.changes);
    }
    if (Array.isArray(input?.fileChanges)) {
        return normalizePatchChangeList(input.fileChanges);
    }
    if (input?.fileChanges && typeof input.fileChanges === 'object') {
        return normalizePatchChangeMap(input.fileChanges);
    }
    // Rig sessions forward the model-native `apply_patch` call, whose argument
    // is the raw patch envelope rather than a pre-parsed change map. Codex
    // names the argument `input`, the Rig names it `patch`.
    const envelope = typeof input?.patch === 'string'
        ? input.patch
        : typeof input?.input === 'string' ? input.input : null;
    if (envelope !== null && envelope.includes('*** Begin Patch')) {
        const changes = parseApplyPatchEnvelope(envelope);
        const workdir = typeof input.workdir === 'string' ? input.workdir : undefined;
        if (!changes || !workdir) return changes;
        return Object.fromEntries(Object.entries(changes).map(([path, change]) => [
            patchPathWithWorkdir(path, workdir),
            { ...change, kind: { ...change.kind, move_path: change.kind?.move_path ? patchPathWithWorkdir(change.kind.move_path, workdir) : null } },
        ]));
    }
    return null;
}

function normalizePatchChangeMap(changes: Record<string, unknown>): Record<string, CodexPatchEntry> | null {
    const entries = Object.entries(changes);
    // Incomplete/future payloads use the raw fallback, never crash a diff view.
    if (!entries.length || entries.some(([, entry]) => !entry || typeof entry !== 'object' || Array.isArray(entry))) return null;
    return changes as Record<string, CodexPatchEntry>;
}

function patchPathWithWorkdir(path: string, workdir: string): string {
    if (path.startsWith('/') || /^[A-Za-z]:[/\\]/.test(path)) return path;
    const combined = `${workdir}/${path}`;
    const parts: string[] = [];
    for (const part of combined.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..' && parts.length && parts[parts.length - 1] !== '..') parts.pop();
        else if (part !== '..' || !combined.startsWith('/')) parts.push(part);
    }
    return `${combined.startsWith('/') ? '/' : ''}${parts.join('/')}`;
}

/**
 * Parse the `*** Begin Patch` envelope that the `apply_patch` tool takes as
 * its argument into the same change map the pre-parsed shapes use. Updates are
 * materialized as old/new excerpts: hunk anchors (`@@ text`) and context lines
 * land on both sides. The envelope does not include full contents or positions.
 */
export function parseApplyPatchEnvelope(patch: string): Record<string, CodexPatchEntry> | null {
    const lines = patch.replace(/\r\n/g, '\n').split('\n');
    const end = lines.indexOf('*** End Patch');
    if (lines[0] !== '*** Begin Patch' || end < 0 || lines.slice(end + 1).some(line => line.trim())) return null;
    const changes: Record<string, CodexPatchEntry> = Object.create(null);
    const seenPaths = new Set<string>();

    let path: string | null = null;
    let action: 'add' | 'update' | 'delete' | null = null;
    let movePath: string | null = null;
    let addLines: string[] = [];
    let oldLines: string[] = [];
    let newLines: string[] = [];

    const flush = () => {
        if (path && action === 'add') {
            changes[path] = { kind: { type: 'add', move_path: null }, add: { content: addLines.join('\n') } };
        } else if (path && action === 'delete') {
            changes[path] = { kind: { type: 'delete', move_path: null } };
        } else if (path && action === 'update') {
            changes[path] = {
                kind: { type: 'update', move_path: movePath },
                modify: { old_content: oldLines.join('\n'), new_content: newLines.join('\n') },
            };
        }
        path = null;
        action = null;
        movePath = null;
        addLines = [];
        oldLines = [];
        newLines = [];
    };

    for (const line of lines.slice(1, end + 1)) {

        if (line.startsWith('*** ') || line === '***') {
            const fileMarker = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);
            if (fileMarker) {
                flush();
                action = fileMarker[1].toLowerCase() as 'add' | 'update' | 'delete';
                path = fileMarker[2].trim();
                // A map cannot faithfully represent sequential edits to the
                // same file. Keep the raw envelope visible instead of losing one.
                if (!path || seenPaths.has(path)) return null;
                seenPaths.add(path);
                continue;
            }
            const moveMarker = line.match(/^\*\*\* Move to: (.+)$/);
            if (moveMarker && action === 'update') {
                movePath = moveMarker[1].trim();
                continue;
            }
            if (line === '*** End Patch') {
                flush();
                continue;
            }
            if (line === '*** End of File' && action === 'update') continue;
            return null;
        }

        if (!action || !path) {
            continue;
        }

        if (action === 'add') {
            if (!line.startsWith('+')) return null;
            addLines.push(line.slice(1));
            continue;
        }
        if (action === 'delete') {
            return null;
        }

        if (line.startsWith('@@')) {
            const anchor = line.startsWith('@@ ') ? line.slice(3) : '';
            if (anchor.length > 0) {
                oldLines.push(anchor);
                newLines.push(anchor);
            }
            continue;
        }
        if (line.startsWith('+')) {
            newLines.push(line.slice(1));
        } else if (line.startsWith('-')) {
            oldLines.push(line.slice(1));
        } else {
            // Context. The strict format prefixes it with a space, but codex's
            // own parser tolerates a missing prefix, so tolerate it here too.
            const content = line.startsWith(' ') ? line.slice(1) : line;
            oldLines.push(content);
            newLines.push(content);
        }
    }
    flush();

    return Object.keys(changes).length > 0 ? changes : null;
}

export function normalizePatchChangeList(changes: unknown[]): Record<string, CodexPatchEntry> | null {
    const normalized: Record<string, CodexPatchEntry> = Object.create(null);

    for (const change of changes) {
        if (!change || typeof change !== 'object' || Array.isArray(change)) {
            continue;
        }

        const changeRecord = change as Record<string, unknown>;
        const path = typeof changeRecord.path === 'string' ? changeRecord.path : null;
        if (!path) {
            continue;
        }

        const kind = changeRecord.kind && typeof changeRecord.kind === 'object' && !Array.isArray(changeRecord.kind)
            ? changeRecord.kind as { type?: string; move_path?: string | null }
            : null;
        const type = typeof changeRecord.type === 'string' ? changeRecord.type : (kind?.type ?? null);
        const entry: CodexPatchEntry = {
            ...(kind ? { kind } : type ? { kind: { type, move_path: null } } : {}),
        };

        if (typeof changeRecord.diff === 'string') {
            entry.diff = changeRecord.diff;
        } else if (typeof changeRecord.unified_diff === 'string') {
            entry.unified_diff = changeRecord.unified_diff;
        }

        if (changeRecord.add && typeof changeRecord.add === 'object' && !Array.isArray(changeRecord.add)) {
            entry.add = changeRecord.add as { content?: string };
        }
        if (changeRecord.modify && typeof changeRecord.modify === 'object' && !Array.isArray(changeRecord.modify)) {
            entry.modify = changeRecord.modify as { old_content?: string; new_content?: string };
        }
        if (changeRecord.delete && typeof changeRecord.delete === 'object' && !Array.isArray(changeRecord.delete)) {
            entry.delete = changeRecord.delete as { content?: string };
        }

        if (type === 'add' && typeof changeRecord.content === 'string') {
            entry.add = { content: changeRecord.content };
        }
        if (type === 'delete' && typeof changeRecord.content === 'string') {
            entry.delete = { content: changeRecord.content };
        }

        normalized[path] = entry;
    }

    return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Codex reuses the `diff` field for two different things: an `update` carries a
 * real unified diff, while `add` and `delete` carry the file body verbatim — no
 * `@@` header, no `+`/`-` prefixes. Handing that body to a patch parser finds no
 * hunks and renders as "no changes", so the cases are told apart by looking at
 * the payload rather than by trusting the field name.
 */
export function looksLikeUnifiedDiff(text: string): boolean {
    return /^@@+ -/m.test(text) || text.startsWith('--- ') || text.startsWith('diff --git ');
}

function wholeFileInput(kind: string | null, content: string): PatchInput {
    return kind === 'delete'
        ? { kind: 'pair', oldText: content, newText: '' }
        : { kind: 'pair', oldText: '', newText: content };
}

export function getPatchInput(change: CodexPatchEntry): PatchInput | null {
    const kindType = getPatchKindType(change);

    if (typeof change.diff === 'string') {
        return looksLikeUnifiedDiff(change.diff)
            ? { kind: 'patch', patch: change.diff }
            : wholeFileInput(kindType, change.diff);
    }
    if (typeof change.unified_diff === 'string') {
        return looksLikeUnifiedDiff(change.unified_diff)
            ? { kind: 'patch', patch: change.unified_diff }
            : wholeFileInput(kindType, change.unified_diff);
    }
    if (change.modify) {
        return { kind: 'pair', oldText: change.modify.old_content || '', newText: change.modify.new_content || '' };
    }
    if (typeof change.oldContent === 'string' || typeof change.newContent === 'string') {
        return { kind: 'pair', oldText: change.oldContent || '', newText: change.newContent || '' };
    }
    if (typeof change.old_content === 'string' || typeof change.new_content === 'string') {
        return { kind: 'pair', oldText: change.old_content || '', newText: change.new_content || '' };
    }
    if (change.add) {
        return { kind: 'pair', oldText: '', newText: change.add.content || '' };
    }
    if (kindType === 'add' && typeof change.content === 'string') {
        return { kind: 'pair', oldText: '', newText: change.content };
    }
    if (change.delete) {
        return { kind: 'pair', oldText: change.delete.content || '', newText: '' };
    }
    if (kindType === 'delete' && typeof change.content === 'string') {
        return { kind: 'pair', oldText: change.content, newText: '' };
    }
    return null;
}

export function getPatchKindType(change: CodexPatchEntry): string | null {
    return change.kind?.type ?? change.type ?? null;
}

export function getPatchKindLabel(change: CodexPatchEntry): string | null {
    switch (getPatchKindType(change)) {
        case 'add':
            return 'new';
        case 'delete':
            return 'delete';
        case 'update':
            return getPatchMovePath(change) ? 'move' : 'edit';
        default:
            return null;
    }
}

export function getPatchMovePath(change: CodexPatchEntry): string | null {
    return change.kind?.move_path ?? change.move_path ?? null;
}
