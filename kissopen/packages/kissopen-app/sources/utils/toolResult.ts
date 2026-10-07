import type { ToolCall } from '@/sync/typesMessage';

export function toolResultText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/** Kissopen's wire result is text; CLI providers may still send stdout/stderr objects. */
export function getTerminalToolResult(tool: Pick<ToolCall, 'state' | 'result'>): {
    stdout: string | null; stderr: string | null; error: string | null;
} {
    const { result, state } = tool;
    const record = result && typeof result === 'object' && !Array.isArray(result) ? result : null;
    const structured = record && ['stdout', 'stderr', 'output'].some(key => typeof record[key] === 'string');
    return {
        stdout: structured ? (typeof record.stdout === 'string' ? record.stdout : typeof record.output === 'string' ? record.output : null)
            : state === 'completed' ? toolResultText(result) : null,
        stderr: structured && typeof record.stderr === 'string' ? record.stderr : null,
        error: state === 'error' ? toolResultText(record?.error ?? result) : null,
    };
}