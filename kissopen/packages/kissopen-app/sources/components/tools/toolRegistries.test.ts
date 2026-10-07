import { describe, expect, it, vi } from 'vitest';

// Test the real registry; only native rendering leaves are replaced.
vi.mock('./views/EditView', () => ({ EditView: 'Edit' }));
vi.mock('./views/BashView', () => ({ BashView: 'Bash' }));
vi.mock('./views/WriteView', () => ({ WriteView: 'Write' }));
vi.mock('./views/TodoView', () => ({ TodoView: 'Todo' }));
vi.mock('./views/ExitPlanToolView', () => ({ ExitPlanToolView: 'Plan' }));
vi.mock('./views/MultiEditView', () => ({ MultiEditView: 'MultiEdit' }));
vi.mock('./views/TaskView', () => ({ TaskView: 'Task' }));
vi.mock('./views/BashViewFull', () => ({ BashViewFull: 'TerminalFull' }));
vi.mock('./views/EditViewFull', () => ({ EditViewFull: 'EditFull' }));
vi.mock('./views/MultiEditViewFull', () => ({ MultiEditViewFull: 'MultiEditFull' }));
vi.mock('./views/CodexBashView', () => ({ CodexBashView: 'CodexBash' }));
vi.mock('./views/CodexPatchView', () => ({ CodexPatchView: 'Patch', CodexPatchViewFull: 'PatchFull' }));
vi.mock('./views/CodexDiffView', () => ({ CodexDiffView: 'Diff', CodexDiffViewFull: 'DiffFull' }));
vi.mock('./views/AskUserQuestionView', () => ({ AskUserQuestionView: 'Question' }));
vi.mock('./views/RequestUserInputView', () => ({ RequestUserInputView: 'Request' }));
vi.mock('./views/GeminiEditView', () => ({ GeminiEditView: 'GeminiEdit' }));
vi.mock('./views/GeminiExecuteView', () => ({ GeminiExecuteView: 'GeminiExecute' }));
vi.mock('./views/FileView', () => ({ FileView: 'File' }));
vi.mock('./views/ScheduleProposalView', () => ({ ScheduleProposalView: 'ScheduleProposal' }));
vi.mock('./views/ScheduleCreatedView', () => ({ ScheduleCreatedView: 'ScheduleCreated' }));
vi.mock('./views/ImageGenerationView', () => ({ ImageGenerationView: 'ImageGeneration' }));
vi.mock('@/text', () => ({ t: (key: string) => key }));

import { getToolViewComponent, getToolFullViewComponent } from './views/_all';

describe('tool registries', () => {
    it.each(['apply_patch', 'CodexPatch', 'GeminiPatch'])('wires %s on both surfaces', name => {
        expect(getToolViewComponent(name)).toBe('Patch');
        expect(getToolFullViewComponent(name)).toBe('PatchFull');
    });
    it.each(['Bash', 'CodexBash', 'GeminiBash', 'exec_command', 'run_terminal_command', 'write_stdin', 'kill_session', 'BashInput', 'BashOutput', 'BashStop', 'send_command_input', 'get_command_or_subagent_output', 'kill_command_or_subagent'])('gives %s output-capable terminal details', name => {
        expect(getToolFullViewComponent(name)).toBe('TerminalFull');
    });
    it('keeps legacy raw file-edit names wired to existing renderers', () => {
        expect(getToolViewComponent('search_replace')).toBe('Edit');
        expect(getToolFullViewComponent('search_replace')).toBe('EditFull');
        expect(getToolViewComponent('write')).toBe('Write');
        expect(getToolFullViewComponent('Write')).toBe('Write');
    });
    it('does not falsely map platform tools to terminal or task payloads', () => {
        expect(getToolViewComponent('create_agent')).toBeNull();
        expect(getToolFullViewComponent('future_tool')).toBeNull();
        expect(getToolViewComponent('request_user_input')).toBe('Request');
    });
    it('draws a proposed scheduled task as its own card', () => {
        expect(getToolViewComponent('propose_scheduled_task')).toBe('ScheduleProposal');
    });
    it('draws a scheduled task the assistant created as its confirmation', () => {
        expect(getToolViewComponent('create_scheduled_task')).toBe('ScheduleCreated');
    });
    it('draws a picture being generated, from either provider, as its own card', () => {
        expect(getToolViewComponent('codex_imagegen')).toBe('ImageGeneration');
        expect(getToolViewComponent('gemini_imagegen')).toBe('ImageGeneration');
    });
});