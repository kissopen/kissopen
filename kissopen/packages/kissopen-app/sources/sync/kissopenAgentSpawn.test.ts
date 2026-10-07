import { describe, expect, it } from 'vitest';

import { resolveKissopenAgentSpawnTarget } from './kissopenAgentSpawn';

const workspaces = [{ id: 'workspace-1', path: '/project/workspace-1' }];

describe('KISSOPEN Agent catalog spawn targets', () => {
    it('creates a child through the project catalog', () => {
        expect(resolveKissopenAgentSpawnTarget({
            projectId: 'project-1',
            workspaceSelection: '__new__',
            workspaces,
        })).toEqual({ kind: 'newWorkspace', projectId: 'project-1' });
    });

    it('starts inside an existing workspace by durable identity', () => {
        expect(resolveKissopenAgentSpawnTarget({
            projectId: 'project-1',
            workspaceSelection: '/project/workspace-1',
            workspaces,
        })).toEqual({ kind: 'workspace', id: 'workspace-1' });
    });

    it('refuses to import a stale workspace path as another project', () => {
        expect(() => resolveKissopenAgentSpawnTarget({
            projectId: 'project-1',
            workspaceSelection: '/project/missing',
            workspaces,
        })).toThrow('workspace is no longer available');
    });
});