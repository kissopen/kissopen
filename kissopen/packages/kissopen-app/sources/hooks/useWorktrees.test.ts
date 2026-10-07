import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { machineBash } = vi.hoisted(() => ({ machineBash: vi.fn() }));
vi.mock('@/sync/ops', () => ({ machineBash }));

// Use the real listWorktrees utility: there is no cache hiding extra effect runs.
import { useWorktrees } from './useWorktrees';

function response(branch = 'quiet-ocean') {
    return {
        success: true,
        stdout: `worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.dev/worktree/${branch}\nHEAD def\nbranch refs/heads/${branch}\n\n`,
        stderr: '',
        exitCode: 0,
    };
}

function pendingResponse() {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const promise = new Promise<ReturnType<typeof response>>((done) => { resolve = done; });
    return { promise, resolve };
}

type Props = {
    machine: { id: string; active: boolean } | null;
    path: string | null;
    supportsWorktree: boolean;
    picksWorkspaces: boolean;
    sessions: object[];
};

// Both screens reduce their machine/workspace objects to these primitive inputs.
let current: ReturnType<typeof useWorktrees>;
function Harness(props: Props) {
    current = useWorktrees(
        props.machine?.id ?? null,
        props.path,
        !props.picksWorkspaces && props.supportsWorktree && (props.machine?.active ?? false),
    );
    return null;
}

let renderer: ReturnType<typeof create> | undefined;
function props(overrides: Partial<Props> = {}): Props {
    return {
        machine: { id: 'machine-1', active: true },
        path: '/repo',
        supportsWorktree: true,
        picksWorkspaces: false,
        sessions: [{}],
        ...overrides,
    };
}
async function render(overrides: Partial<Props> = {}) {
    await act(async () => { renderer = create(React.createElement(Harness, props(overrides))); });
}
async function update(overrides: Partial<Props> = {}) {
    await act(async () => { renderer.update(React.createElement(Harness, props(overrides))); });
}

beforeEach(() => {
    machineBash.mockReset().mockResolvedValue(response());
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
    await act(async () => { renderer?.unmount(); });
    renderer = undefined;
});

describe('Git worktree discovery lifecycle', () => {
    it('does not refetch for rebuilt machine/session objects before or after the RPC finishes', async () => {
        const pending = pendingResponse();
        machineBash.mockReturnValue(pending.promise);
        await render();
        const refresh = current.refresh;

        for (let i = 0; i < 100; i++) await update();
        expect(machineBash).toHaveBeenCalledExactlyOnceWith(
            'machine-1', 'git worktree list --porcelain', '/repo',
        );

        await act(async () => { pending.resolve(response()); });
        for (let i = 0; i < 100; i++) await update();
        expect(machineBash).toHaveBeenCalledTimes(1);
        expect(current.refresh).toBe(refresh);
        expect(current.worktrees[0].branch).toBe('quiet-ocean');
    });

    it('fetches again when the path or machine ID changes', async () => {
        await render();
        await update({ path: '/other' });
        await update({ path: '/other', machine: { id: 'machine-2', active: true } });
        expect(machineBash.mock.calls.map(([machine, , path]) => [machine, path])).toEqual([
            ['machine-1', '/repo'], ['machine-1', '/other'], ['machine-2', '/other'],
        ]);
    });

    it.each([
        ['missing machine', { machine: null }],
        ['missing path', { path: null }],
        ['empty path', { path: '' }],
        ['offline machine', { machine: { id: 'machine-1', active: false } }],
        ['unsupported harness', { supportsWorktree: false }],
        ['native workspace mode', { picksWorkspaces: true }],
    ] satisfies [string, Partial<Props>][])('does not query an ineligible target: %s', async (_name, overrides) => {
        await render(overrides);
        await act(async () => { current.refresh(); });
        expect(machineBash).not.toHaveBeenCalled();
        expect(current.worktrees).toEqual([]);
    });

    it('clears the list while offline and refetches on reconnect', async () => {
        await render();
        await update({ machine: { id: 'machine-1', active: false } });
        expect(current.worktrees).toEqual([]);
        expect(machineBash).toHaveBeenCalledTimes(1);
        await update();
        expect(machineBash).toHaveBeenCalledTimes(2);
        expect(current.worktrees[0].branch).toBe('quiet-ocean');
    });

    it('does not let an old target overwrite the new target', async () => {
        const old = pendingResponse();
        machineBash.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('new'));
        await render();
        await update({ path: '/other' });
        await act(async () => { old.resolve(response('old')); });
        expect(current.worktrees[0].branch).toBe('new');
    });

    it('ignores an in-flight Git reply after switching to native workspaces', async () => {
        const pending = pendingResponse();
        machineBash.mockReturnValueOnce(pending.promise);
        await render();
        await update({ picksWorkspaces: true });
        await act(async () => { pending.resolve(response()); });
        expect(current.worktrees).toEqual([]);
        for (let i = 0; i < 20; i++) await update({ picksWorkspaces: true });
        expect(machineBash).toHaveBeenCalledTimes(1);
        await update();
        expect(machineBash).toHaveBeenCalledTimes(2);
    });

    it('refreshes on each picker open even when the machine and path are unchanged', async () => {
        await render();
        const pending = pendingResponse();
        machineBash.mockReturnValueOnce(pending.promise);
        await act(async () => { current.refresh(); });
        // Keep the current options visible while a same-target refresh is pending.
        expect(current.worktrees[0].branch).toBe('quiet-ocean');
        await act(async () => { pending.resolve(response('created-elsewhere')); });
        expect(current.worktrees[0].branch).toBe('created-elsewhere');

        machineBash.mockResolvedValueOnce({ ...response(), stdout: 'worktree /repo\n\n' });
        await act(async () => { current.refresh(); });
        expect(current.worktrees).toEqual([]);
        expect(machineBash).toHaveBeenCalledTimes(3);
    });

    it('ignores a superseded reply when a picker refresh starts during discovery', async () => {
        const old = pendingResponse();
        machineBash.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('fresh'));
        await render();
        await act(async () => { current.refresh(); });
        await act(async () => { old.resolve(response('stale')); });
        expect(current.worktrees[0].branch).toBe('fresh');
    });

    it('retries a failed RPC on the next picker open, not every session update', async () => {
        machineBash.mockResolvedValueOnce({ success: false, stdout: '', stderr: 'offline', exitCode: -1 });
        await render();
        expect(current.worktrees).toEqual([]);
        await update();
        expect(machineBash).toHaveBeenCalledTimes(1);
        await act(async () => { current.refresh(); });
        expect(machineBash).toHaveBeenCalledTimes(2);
        expect(current.worktrees[0].branch).toBe('quiet-ocean');
    });

    it('does not apply a reply after unmount', async () => {
        const pending = pendingResponse();
        machineBash.mockReturnValueOnce(pending.promise);
        await render();
        const before = current;
        await act(async () => { renderer.unmount(); });
        renderer = undefined;
        await act(async () => { pending.resolve(response()); });
        expect(current).toBe(before);
        expect(current.worktrees).toEqual([]);
    });
});