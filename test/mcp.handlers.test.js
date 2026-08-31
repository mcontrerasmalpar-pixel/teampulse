// @ts-check
import { describe, it, expect } from 'vitest';
import { dispatchTool, TOOL_DEFINITIONS } from '../src/mcp/handlers.js';

describe('MCP handlers', () => {
  it('lists strict tool schemas and read_only history', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual(['analyze_meeting', 'get_meeting_history']);
    const history = TOOL_DEFINITIONS.find((t) => t.name === 'get_meeting_history');
    expect(history.annotations.readOnlyHint).toBe(true);
    expect(history.inputSchema.additionalProperties).toBe(false);
    const analyze = TOOL_DEFINITIONS.find((t) => t.name === 'analyze_meeting');
    expect(analyze.inputSchema.required).toContain('transcript');
    expect(analyze.inputSchema.additionalProperties).toBe(false);
  });

  it('analyze_meeting returns structured error without transcript', async () => {
    const res = await dispatchTool('analyze_meeting', {});
    expect(res.isError).toBe(true);
    expect(res.structuredContent.error.code).toBe('EINVALID');
  });

  it('analyze_meeting works with fixture provider', async () => {
    const res = await dispatchTool('analyze_meeting', {
      transcript: 'SUMMARY: Sync\nTASK: Write tests | owner=maria | priority=high\nDECISION: Use vitest\n',
      provider: 'fixture',
      useCache: false,
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.tasks[0].owner).toBe('maria');
    expect(res.structuredContent.decisions[0].title).toBe('Use vitest');
  });

  it('get_meeting_history is read-only and returns a list payload', async () => {
    const res = await dispatchTool('get_meeting_history', { limit: 2 });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toHaveProperty('meetings');
    expect(res.structuredContent).toHaveProperty('count');
  });

  it('unknown tool is structured error', async () => {
    const res = await dispatchTool('not_a_tool', {});
    expect(res.isError).toBe(true);
    expect(res.structuredContent.error.code).toBe('EUNKNOWN');
  });
});
