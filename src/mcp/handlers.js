// @ts-check
import { analyze } from '../services/provider.js';
import { hashFile, getCache, saveCache } from '../utils/cache.js';
import { loadMemory, addMeeting } from '../utils/memory.js';
import { normalizeTranscript, detectTranscriptFormat } from '../utils/transcript.js';
import { AnalysisSchema } from '../utils/schema.js';
import { structuredError, withTimeout } from './errors.js';

export const ANALYZE_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transcript: {
      type: 'string',
      minLength: 1,
      description: 'Meeting transcript text (supports .txt, .srt, .vtt formats)',
    },
    format: {
      type: 'string',
      enum: ['txt', 'srt', 'vtt'],
      description: 'Transcript format (auto-detected if not specified)',
    },
    provider: {
      type: 'string',
      enum: ['gemini', 'ollama', 'anthropic', 'openai', 'mistral', 'fixture'],
      description: 'AI provider to use (default: gemini)',
    },
    fallbackProvider: {
      type: 'string',
      enum: ['gemini', 'ollama', 'anthropic', 'openai', 'mistral', 'fixture'],
      description: 'Fallback provider if primary fails',
    },
    useCache: {
      type: 'boolean',
      description: 'Use local cache if available (default: true)',
    },
    timeoutMs: {
      type: 'number',
      minimum: 1000,
      maximum: 180000,
      description: 'Tool timeout in milliseconds (default: 90000)',
    },
  },
  required: ['transcript'],
};

export const HISTORY_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      description: 'Maximum number of meetings to return (default: 10)',
    },
  },
};

export const TOOL_DEFINITIONS = [
  {
    name: 'analyze_meeting',
    description: 'Analyze a meeting transcript and extract summary, tasks, risks, and decisions',
    inputSchema: ANALYZE_INPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: 'get_meeting_history',
    description: 'Retrieve history of analyzed meetings from local memory (read only)',
    inputSchema: HISTORY_INPUT_SCHEMA,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export async function handleAnalyzeMeeting(args = {}) {
  const {
    transcript,
    format,
    provider = 'gemini',
    fallbackProvider,
    useCache = true,
    timeoutMs = 90000,
  } = args;

  if (!transcript || typeof transcript !== 'string') {
    return structuredError('EINVALID', 'transcript is required and must be a string');
  }

  try {
    const result = await withTimeout(async () => {
      const normalizedFormat = format || detectTranscriptFormat('meeting.txt');
      const normalized = normalizeTranscript(transcript, normalizedFormat);
      const hash = await hashFile(Buffer.from(normalized, 'utf-8'));

      if (useCache) {
        const cached = await getCache(hash);
        if (cached) {
          await addMeeting('mcp-session', hash, cached.summary);
          return cached;
        }
      }

      const analysis = await analyze(normalized, provider, undefined, { fallbackProvider });
      const validated = AnalysisSchema.parse(analysis);
      await saveCache(hash, validated);
      await addMeeting('mcp-session', hash, validated.summary);
      return validated;
    }, timeoutMs);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (error) {
    const code = error.code || (String(error.message || '').includes('Timeout') ? 'ETIMEDOUT' : 'EANALYZE');
    return structuredError(code, error.message || 'Failed to analyze meeting');
  }
}

export async function handleGetMeetingHistory(args = {}) {
  const limit = Number(args.limit ?? 10);
  if (!Number.isFinite(limit) || limit < 1) {
    return structuredError('EINVALID', 'limit must be a positive number');
  }

  try {
    const memory = await loadMemory();
    const meetings = Array.isArray(memory.meetings) ? memory.meetings : [];
    const recent = meetings.slice(-limit).reverse();
    const payload = { count: recent.length, meetings: recent };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } catch (error) {
    return structuredError('EHISTORY', error.message || 'Failed to read meeting history');
  }
}

export async function dispatchTool(name, args = {}) {
  if (name === 'analyze_meeting') return handleAnalyzeMeeting(args);
  if (name === 'get_meeting_history') return handleGetMeetingHistory(args);
  return structuredError('EUNKNOWN', `Unknown tool: ${name}`);
}

export default {
  TOOL_DEFINITIONS,
  handleAnalyzeMeeting,
  handleGetMeetingHistory,
  dispatchTool,
};
