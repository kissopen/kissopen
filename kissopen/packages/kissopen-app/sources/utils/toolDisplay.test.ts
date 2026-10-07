import { describe, expect, it, vi } from 'vitest';
import { ToolCall } from '@/sync/typesMessage';
import {
    getToolActivityLabel,
    getToolDisplayTitle,
    getTerminalToolCommand,
    getToolSummaryCategory,
    getToolSummaryDetail,
    isTerminalToolName,
    shouldRenderToolCardHeader,
    shouldUseCompactToolRow,
} from './toolDisplay';

vi.mock('@/text', () => ({
    t: (key: string) => key,
}));

function tool(name: string, input: unknown): ToolCall {
    return {
        name,
        state: 'completed',
        input,
        createdAt: 1,
        startedAt: 1,
        completedAt: 2,
        description: null,
    };
}

describe('terminal tool display helpers', () => {
    it('detects command-like terminal tools', () => {
        expect(isTerminalToolName('Bash')).toBe(true);
        expect(isTerminalToolName('CodexBash')).toBe(true);
        expect(isTerminalToolName('GeminiBash')).toBe(true);
        expect(isTerminalToolName('execute')).toBe(true);
        expect(isTerminalToolName('Read')).toBe(false);
    });

    it('extracts one-line command summaries from shell tools', () => {
        expect(getTerminalToolCommand(tool('Bash', { command: 'pnpm test' }))).toBe('pnpm test');

        expect(getTerminalToolCommand(tool(
            'CodexBash',
            {
                command: ['/usr/bin/zsh', '-lc', 'git status --short'],
                parsed_cmd: [{ type: 'bash', cmd: 'git status --short' }],
            },
        ))).toBe('git status --short');
    });

    it('extracts Gemini execute titles without cwd metadata', () => {
        expect(getTerminalToolCommand(tool(
            'execute',
            { toolCall: { title: 'rm tmp.txt [current working directory /repo] (cleanup)' } },
        ))).toBe('rm tmp.txt');
    });

    it('hides card headers for tools that already name each changed file', () => {
        for (const platform of ['web', 'ios', 'android']) {
            expect(shouldRenderToolCardHeader('CodexPatch', platform)).toBe(false);
            expect(shouldRenderToolCardHeader('GeminiPatch', platform)).toBe(false);
            expect(shouldRenderToolCardHeader('apply_patch', platform)).toBe(false);
        }
        // Everything else still needs a header to say what it was.
        expect(shouldRenderToolCardHeader('CodexBash', 'web')).toBe(true);
        expect(shouldRenderToolCardHeader('CodexDiff', 'ios')).toBe(true);
    });

    it('classifies tools for compact transcript rows', () => {
        expect(getToolSummaryCategory('CodexBash')).toBe('terminal');
        expect(getToolSummaryCategory('exec_command')).toBe('terminal');
        expect(getToolSummaryCategory('CodexPatch')).toBe('edit');
        expect(getToolSummaryCategory('apply_patch')).toBe('edit');
        expect(getToolSummaryCategory('Read')).toBe('read');
        expect(getToolSummaryCategory('read_agent_history')).toBe('read');
        expect(getToolSummaryCategory('Grep')).toBe('search');
        expect(getToolSummaryCategory('list_workspaces')).toBe('search');
        expect(getToolSummaryCategory('WebFetch')).toBe('web');
        expect(getToolSummaryCategory('spawn_agent')).toBe('task');
    });

    it('extracts compact transcript row details', () => {
        expect(getToolSummaryDetail(tool('CodexBash', {
            command: ['/usr/bin/zsh', '-lc', 'git status --short'],
            parsed_cmd: [{ type: 'bash', cmd: 'git status --short' }],
        }))).toBe('git status --short');

        expect(getToolSummaryDetail(tool('CodexPatch', {
            changes: {
                'README-RU.md': { kind: { type: 'update' } },
            },
        }))).toBe('README-RU.md');

        expect(getToolSummaryDetail(tool('apply_patch', {
            patch: '*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch\n',
        }))).toBe('src/a.ts');

        expect(getToolSummaryDetail(tool('MultiEdit', {
            file_path: '/repo/src/app.tsx',
        }))).toBe('/repo/src/app.tsx');

        expect(getToolSummaryDetail(tool('exec_command', {
            cmd: 'pnpm test',
        }))).toBe('pnpm test');

        expect(getToolSummaryDetail(tool('read_file', {
            target_file: '/repo/src/app.tsx',
        }))).toBe('/repo/src/app.tsx');
    });

    it('builds one human-readable label for compact activity rows', () => {
        expect(getToolActivityLabel(tool('CodexBash', {
            command: ['/usr/bin/zsh', '-lc', 'git status --short'],
            parsed_cmd: [{ type: 'bash', cmd: 'git status --short' }],
        }))).toBe('git status --short');

        expect(getToolActivityLabel(tool('Read', {
            file_path: '/repo/src/app.tsx',
        }))).toBe('toolGroup.read: /repo/src/app.tsx');

        const describedTool = tool('CodexPatch', {
            changes: { 'README.md': { kind: { type: 'update' } } },
        });
        describedTool.description = 'Updated the README';
        expect(getToolActivityLabel(describedTool)).toBe('Updated the README');

        expect(getToolActivityLabel(tool('mcp__linear__create_issue', {})))
            .toBe('MCP: Linear Create Issue');

        const rigCommand = tool('exec_command', { cmd: 'git status --short' });
        rigCommand.description = 'Running Exec Command';
        expect(getToolActivityLabel(rigCommand))
            .toBe('git status --short');

        const rigCoordination = tool('spawn_agent', {});
        rigCoordination.description = 'Running Spawn Agent';
        expect(getToolActivityLabel(rigCoordination)).toBe('Spawn Agent');

        const futureTool = tool('brand_new_rig_tool', {});
        futureTool.description = 'Running Brand New Rig Tool';
        expect(getToolActivityLabel(futureTool)).toBe('Brand New Rig Tool');
    });

    it('uses compact rows for current and future non-interactive tools', () => {
        expect(shouldUseCompactToolRow(tool('exec_command', {}), true)).toBe(true);
        expect(shouldUseCompactToolRow(tool('brand_new_rig_tool', {}), true)).toBe(true);
        expect(shouldUseCompactToolRow(tool('brand_new_rig_tool', {}), false)).toBe(false);
        expect(shouldUseCompactToolRow(tool('brand_new_rig_tool', {}), false, false)).toBe(true);
        expect(shouldUseCompactToolRow(tool('file', {}), true)).toBe(false);
        expect(shouldUseCompactToolRow(tool('AskUserQuestion', {}), true)).toBe(false);
        expect(shouldUseCompactToolRow(tool('request_user_input', {}), true)).toBe(false);

        const pendingPlan = tool('ExitPlanMode', {});
        pendingPlan.permission = {
            id: 'permission-1',
            status: 'pending',
        };
        expect(shouldUseCompactToolRow(pendingPlan, true)).toBe(false);
        pendingPlan.permission.status = 'approved';
        expect(shouldUseCompactToolRow(pendingPlan, true)).toBe(true);
    });

    it.each(['Running CodexBash', 'Running Codex Bash', 'Checking the git status'])('prefers the actual command over %s', description => {
        expect(getToolActivityLabel({ ...tool('CodexBash', { command: 'git status' }), description })).toBe('git status');
    });

    it.each([
        ['write_stdin', { session_id: 42 }, 'Waiting for shell output (42)'],
        ['write_stdin', { session_id: 42, chars: '' }, 'Waiting for shell output (42)'],
        ['write_stdin', { session_id: 42, chars: '\n' }, 'Sending input to shell (42)'],
        ['BashInput', { bash_id: 'abc', input: 'yes\n' }, 'Sending input to shell (abc)'],
        ['BashOutput', { bash_id: 'abc' }, 'Reading shell output (abc)'],
        ['BashStop', { bash_id: 'abc' }, 'Stopping shell (abc)'],
        ['kill_session', { session_id: 42 }, 'Stopping shell (42)'],
        ['send_command_input', { task_id: 'bg-1', input: 'hi\n' }, 'Sending input to shell (bg-1)'],
        ['get_command_or_subagent_output', { task_ids: ['bg-1', 'bg-2'] }, 'Reading shell output (bg-1, bg-2)'],
        ['kill_command_or_subagent', { task_id: 'bg-1' }, 'Stopping shell (bg-1)'],
    ])('presents %s as a shell control, never a command', (name, input, label) => {
        const call = tool(name as string, input);
        call.description = `Running ${name}`;
        expect(isTerminalToolName(call.name)).toBe(true);
        expect(getTerminalToolCommand(call)).toBeNull();
        expect(getToolActivityLabel(call)).toBe(label);
        expect(shouldUseCompactToolRow(call, false, false)).toBe(true);
    });

    it('preserves wire titles and detailed descriptions for unfamiliar tools', () => {
        const call = { ...tool('new_operation', {}), title: 'Inspect release' };
        expect(getToolActivityLabel(call)).toBe('Inspect release');
        expect(getToolActivityLabel({ ...call, description: 'Checking release 1.2.3' })).toBe('Checking release 1.2.3');
        expect(getToolActivityLabel({ ...call, description: 'Running new_operation' })).toBe('Inspect release');
    });

    it('uses a neutral shell-control title for expanded approval headers', () => {
        expect(getToolDisplayTitle(tool('write_stdin', { session_id: 42, chars: 'yes\n' }))).toBe('Shell session');
    });

    it('uses current platform names without breaking older recorded names', () => {
        for (const name of ['create_agent', 'send_agent_message', 'wait_workflow', 'create_task', 'clear_goal', 'create_secret']) {
            expect(getToolSummaryCategory(name)).toBe('task');
        }
        for (const name of ['read_user_input', 'get_task', 'get_workspace', 'workflow_logs', 'read_skill', 'get_usage']) {
            expect(getToolSummaryCategory(name)).toBe('read');
        }
        expect(getToolSummaryCategory('spawn_agent')).toBe('task');
        expect(getToolActivityLabel(tool('cancel_ask', { input: { requestId: 'q1' } }))).toBe('Cancel question: q1');
        expect(getToolActivityLabel(tool('create_agent', { title: 'Review auth' }))).toBe('Start collaborator: Review auth');
        expect(getToolActivityLabel(tool('run_workflow', { input: { name: 'Check build', script: 'secret code' } }))).toBe('Run workflow: Check build');
    });

    it('keeps unknown pending approval inputs visible and preserves inline controls', () => {
        const call = tool('unknown_operation', {});
        call.permission = { id: 'p1', status: 'pending' };
        expect(shouldUseCompactToolRow(call, false, false)).toBe(false);
        expect(shouldUseCompactToolRow(call, true, false)).toBe(false);
        for (const name of ['file', 'request_user_input', 'AskUserQuestion']) {
            expect(shouldUseCompactToolRow(tool(name, {}), true, false)).toBe(false);
        }
        expect(shouldUseCompactToolRow(tool('apply_patch', {}), false, true)).toBe(false);
    });
});

describe('scheduled tasks the assistant creates', () => {
    it('keeps a created task as its card and lets other answers fold', () => {
        const created = { ...tool('create_scheduled_task', { request: 'every day at 9' }), result: { status: 'created', schedule: { id: 's1', name: 'Digest' } } };
        const failed = { ...tool('create_scheduled_task', { request: 'x' }), result: { status: 'failed', error: 'nope' } };
        expect(shouldUseCompactToolRow(created, true)).toBe(false);
        expect(shouldUseCompactToolRow(failed, true)).toBe(true);
    });
    it('never shows the tool identifier as its title', () => {
        expect(getToolDisplayTitle({ name: 'create_scheduled_task', title: 'create_scheduled_task' })).toBe('tools.names.scheduleCreate');
        expect(getToolDisplayTitle({ name: 'propose_scheduled_task' })).toBe('tools.names.scheduleProposal');
        expect(getToolSummaryCategory('create_scheduled_task')).toBe('task');
    });
});
