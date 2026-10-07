/** Presentation only: real Kissopen Agent names stay intact for call IDs and RPCs. */
type KissopenToolCategory = 'terminal' | 'edit' | 'read' | 'search' | 'web' | 'task';
type Presentation = { category: KissopenToolCategory; title: string };

export const kissopenToolDisplay: Record<string, Presentation> = {
    BashInput: { category: 'terminal', title: 'Send shell input' },
    BashOutput: { category: 'terminal', title: 'Read shell output' },
    BashStop: { category: 'terminal', title: 'Stop shell' },
    write_stdin: { category: 'terminal', title: 'Shell session' },
    kill_session: { category: 'terminal', title: 'Stop shell' },
    get_command_or_subagent_output: { category: 'terminal', title: 'Read shell output' },
    send_command_input: { category: 'terminal', title: 'Send shell input' },
    kill_command_or_subagent: { category: 'terminal', title: 'Stop shell' },
    create_agent: { category: 'task', title: 'Start collaborator' },
    send_agent_message: { category: 'task', title: 'Send agent message' },
    interrupt_agent: { category: 'task', title: 'Interrupt agent' },
    create_task: { category: 'task', title: 'Create task' },
    list_tasks: { category: 'search', title: 'List tasks' },
    get_task: { category: 'read', title: 'Read task' },
    update_task: { category: 'task', title: 'Update task' },
    complete_task: { category: 'task', title: 'Complete task' },
    remove_task: { category: 'task', title: 'Remove task' },
    create_goal: { category: 'task', title: 'Create goal' },
    get_goal: { category: 'read', title: 'Read goal' },
    update_goal: { category: 'task', title: 'Update goal' },
    clear_goal: { category: 'task', title: 'Clear goal' },
    create_workspace: { category: 'task', title: 'Create workspace' },
    create_child_workspace: { category: 'task', title: 'Create workspace' },
    list_workspaces: { category: 'search', title: 'List workspaces' },
    get_workspace: { category: 'read', title: 'Read workspace' },
    rename_workspace: { category: 'task', title: 'Rename workspace' },
    archive_workspace: { category: 'task', title: 'Archive workspace' },
    get_workspace_branch_metadata: { category: 'read', title: 'Read branch metadata' },
    list_projects: { category: 'search', title: 'List projects' },
    set_project_avatar: { category: 'task', title: 'Set project avatar' },
    run_workflow: { category: 'task', title: 'Run workflow' },
    list_workflows: { category: 'search', title: 'List workflows' },
    workflow_status: { category: 'read', title: 'Check workflow' },
    workflow_logs: { category: 'read', title: 'Read workflow logs' },
    wait_workflow: { category: 'task', title: 'Wait for workflow' },
    cancel_workflow: { category: 'task', title: 'Cancel workflow' },
    resume_workflow: { category: 'task', title: 'Resume workflow' },
    wait: { category: 'task', title: 'Wait' },
    wait_until: { category: 'task', title: 'Wait until' },
    propose_scheduled_task: { category: 'task', title: 'Propose scheduled task' },
    create_scheduled_task: { category: 'task', title: 'Create scheduled task' },
    read_user_input: { category: 'read', title: 'Read answer' },
    cancel_ask: { category: 'task', title: 'Cancel question' },
    get_presence: { category: 'read', title: 'Check presence' },
    list_presences: { category: 'search', title: 'List presence states' },
    set_presence: { category: 'task', title: 'Set presence' },
    list_secrets: { category: 'search', title: 'List secret references' },
    reference_secret: { category: 'read', title: 'Read secret reference' },
    create_secret: { category: 'task', title: 'Create secret' },
    update_secret: { category: 'task', title: 'Update secret' },
    attach_secret: { category: 'task', title: 'Attach secret' },
    detach_secret: { category: 'task', title: 'Detach secret' },
    list_mcp_servers: { category: 'search', title: 'List MCP servers' },
    list_mcp_tools: { category: 'search', title: 'List MCP tools' },
    list_mcp_resources: { category: 'search', title: 'List MCP resources' },
    list_mcp_resource_templates: { category: 'search', title: 'List MCP resource templates' },
    list_mcp_prompts: { category: 'search', title: 'List MCP prompts' },
    read_mcp_resource: { category: 'read', title: 'Read MCP resource' },
    get_mcp_prompt: { category: 'read', title: 'Read MCP prompt' },
    call_mcp_tool: { category: 'task', title: 'Call MCP tool' },
    configure_mcp_server: { category: 'task', title: 'Configure MCP server' },
    reload_mcp_servers: { category: 'task', title: 'Reload MCP servers' },
    list_skills: { category: 'search', title: 'List skills' },
    read_skill: { category: 'read', title: 'Read skill' },
    get_usage: { category: 'read', title: 'Read token usage' },
    get_agent_tree_usage: { category: 'read', title: 'Read agent-tree usage' },
    read_agent_history: { category: 'read', title: 'Read agent history' },
    create_bot: { category: 'task', title: 'Create bot' },
    list_bots: { category: 'search', title: 'List bots' },
    send_bot_message: { category: 'task', title: 'Send bot message' },
    set_bot_avatar: { category: 'task', title: 'Set bot avatar' },
    codex_imagegen: { category: 'task', title: 'Generate image' },
    gemini_imagegen: { category: 'task', title: 'Generate image' },
    gemini_generate_music: { category: 'task', title: 'Generate music' },
    gemini_analyze_media: { category: 'read', title: 'Analyze media' },
    javascript: { category: 'task', title: 'Run JavaScript' },
    python: { category: 'task', title: 'Run Python' },
    write: { category: 'edit', title: 'Write file' },
    web_fetch: { category: 'web', title: 'Fetch URL' },
    bedrock_web_search: { category: 'search', title: 'Search the web' },
    claude_web_search: { category: 'search', title: 'Search the web' },
    codex_web_search: { category: 'search', title: 'Search the web' },
    gemini_web_search: { category: 'search', title: 'Search the web' },
    grok_web_search: { category: 'search', title: 'Search the web' },
    grok_x_search: { category: 'search', title: 'Search X' },
};

/** Controls have no command argument. Never pretend session IDs are commands. */
export function getShellControl(input: { name: string; input: any }): { label: string; chars?: string } | null {
    const args = input.input;
    const name = input.name;
    const id = args?.session_id ?? args?.bash_id ?? args?.task_id;
    const ids = Array.isArray(args?.task_ids) ? args.task_ids.filter((id: unknown) => typeof id === 'string') : [];
    const target = typeof id === 'string' || typeof id === 'number' ? ` (${id})` : ids.length ? ` (${ids.join(', ')})` : '';
    if (['kill_session', 'BashStop', 'kill_command_or_subagent'].includes(name)) {
        return { label: `Stopping shell${target}` };
    }
    if (['BashOutput', 'get_command_or_subagent_output'].includes(name)) {
        return { label: `Reading shell output${target}` };
    }
    if (['write_stdin', 'BashInput', 'send_command_input'].includes(name)) {
        const chars = name === 'write_stdin' ? args?.chars : args?.input;
        return typeof chars === 'string' && chars.length > 0
            ? { label: `Sending input to shell${target}`, chars }
            : { label: `Waiting for shell output${target}` };
    }
    return null;
}