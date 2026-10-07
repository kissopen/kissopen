import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rigMetadataFixture } from '@/sync/__testdata__/rigMetadata';
import type { Session } from '@/sync/storageTypes';

const state = vi.hoisted(() => ({ session: null as Session | null, setModes: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@/components/AgentInput', async () => {
    const R = await import('react');
    return { AgentInput: R.forwardRef((props: any, _ref) => R.createElement('AgentInput', props)) };
});
vi.mock('@/components/autocomplete/suggestions', () => ({ getSuggestions: vi.fn() }));
vi.mock('@/hooks/useDraft', () => ({ useDraft: () => ({ clearDraft: vi.fn() }) }));
vi.mock('@/hooks/useImagePicker', () => ({ useImagePicker: () => ({ selectedImages: [], clearImages: vi.fn(), removeImage: vi.fn(), pickImages: vi.fn(), addImages: vi.fn() }) }));
vi.mock('@/modal', () => ({ Modal: {} }));
vi.mock('@/sync/ops', () => ({ sessionSetAgentModes: state.setModes, sessionAbort: vi.fn(), sessionCancelCommunication: vi.fn() }));
vi.mock('@/sync/storage', () => ({
    storage: { getState: () => ({ sessions: {} }) },
    useSession: () => state.session,
    useSessionPendingCommunications: () => [],
    useSessionUsage: () => undefined,
    useSetting: (key: string) => key === 'agentDefaultOverrides' ? {} : false,
    useLocalSetting: () => false,
}));
vi.mock('@/sync/sync', () => ({ sync: { sendMessage: vi.fn() } }));
vi.mock('@/text', () => ({ t: (key: string) => key }));
vi.mock('@/kissopen/useCloudDictation', () => ({ useCloudDictation: () => ({ state: 'idle', levels: [], toggle: vi.fn() }) }));
vi.mock('@/utils/sessionUtils', () => ({ useSessionStatus: () => ({ isConnected: true, state: 'idle' }) }));

import { SessionComposer } from './SessionComposer';

beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });

describe('open-source mobile composer model controls', () => {
    it('offers the connected Agent catalog and persists model and effort choices for this session', async () => {
        state.setModes.mockClear();
        state.session = { id: 'local-session', metadata: rigMetadataFixture, effortLevel: 'medium' } as Session;
        let tree: any;
        await act(async () => { tree = create(React.createElement(SessionComposer, { sessionId: 'local-session' })); });
        try {
            let props = tree.root.findByType('AgentInput').props;
            expect(props.showModelSelector).toBe(true);
            expect(props.modelMode.key).toBe('codex:shared-model');
            const claude = props.availableModels.find((model: any) => model.providerId === 'claude');
            expect(claude).toBeDefined();
            await act(async () => props.onModelModeChange(claude));
            expect(state.setModes).toHaveBeenCalledWith('local-session', { modelMode: 'claude:shared-model', effortLevel: 'max' });
            state.session = { ...state.session!, modelMode: claude.key, effortLevel: 'max' };
            await act(async () => { tree.update(React.createElement(SessionComposer, { sessionId: 'local-session' })); });
            props = tree.root.findByType('AgentInput').props;
            expect(props.modelMode.key).toBe('claude:shared-model');
            expect(props.availableEffortLevels.map((level: any) => level.key)).toEqual(['low', 'high', 'max']);
            await act(async () => props.onEffortLevelChange({ key: 'high' }));
            expect(state.setModes).toHaveBeenLastCalledWith('local-session', { effortLevel: 'high' });
        } finally {
            await act(async () => tree.unmount());
        }
    });

    it('still respects a session whose Agent disallows model selection', async () => {
        state.session = { id: 'locked-session', metadata: { ...rigMetadataFixture, session: { ...rigMetadataFixture.session!, modelLocked: true } } } as Session;
        let tree: any;
        await act(async () => { tree = create(React.createElement(SessionComposer, { sessionId: 'locked-session' })); });
        try {
            expect(tree.root.findByType('AgentInput').props.onModelModeChange).toBeUndefined();
        } finally {
            await act(async () => tree.unmount());
        }
    });
});
