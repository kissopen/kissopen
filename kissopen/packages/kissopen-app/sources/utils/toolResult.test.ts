import { describe, expect, it } from 'vitest';
import { getTerminalToolResult } from './toolResult';

describe('terminal results', () => {
    it('renders KISSOPEN wire summaries as output', () => {
        expect(getTerminalToolResult({ state: 'completed', result: 'hello\nworld' })).toEqual({ stdout: 'hello\nworld', stderr: null, error: null });
    });
    it('keeps CLI stdout and stderr separate', () => {
        expect(getTerminalToolResult({ state: 'completed', result: { stdout: 'hello', stderr: 'warning' } })).toEqual({ stdout: 'hello', stderr: 'warning', error: null });
    });
    it('renders failures rather than a successful empty output', () => {
        expect(getTerminalToolResult({ state: 'error', result: 'permission denied' }).error).toBe('permission denied');
        expect(getTerminalToolResult({ state: 'error', result: { error: 'exit 1', stdout: 'partial' } })).toEqual({ stdout: 'partial', stderr: null, error: 'exit 1' });
    });
    it('does not swallow an unrecognized structured result', () => {
        expect(getTerminalToolResult({ state: 'completed', result: { display: 'fallback' } }).stdout).toContain('fallback');
    });
});