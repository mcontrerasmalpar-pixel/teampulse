#!/usr/bin/env node
// @ts-check
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { analyze } from './services/provider.js';
import { hashFile, getCache, saveCache } from './utils/cache.js';
import { loadMemory, addMeeting } from './utils/memory.js';
import { normalizeTranscript, detectTranscriptFormat } from './utils/transcript.js';
import { AnalysisSchema } from './utils/schema.js';

/**
 * TeamPulse MCP Server
 *
 * Exposes meeting analysis capabilities via Model Context Protocol.
 * Reuses existing modules: provider, schema, memory, cache, transcript.
 */

const server = new Server(
  {
    name: 'teampulse',
    version: '1.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_meeting',
        description: 'Analyze a meeting transcript and extract summary, tasks, risks, and decisions',
        inputSchema: {
          type: 'object',
          properties: {
            transcript: {
              type: 'string',
              description: 'Meeting transcript text (supports .txt, .srt, .vtt formats)',
            },
            format: {
              type: 'string',
              enum: ['txt', 'srt', 'vtt'],
              description: 'Transcript format (auto-detected if not specified)',
            },
            provider: {
              type: 'string',
              enum: ['gemini', 'ollama', 'anthropic', 'openai', 'mistral'],
              description: 'AI provider to use (default: gemini)',
            },
            fallbackProvider: {
              type: 'string',
              enum: ['gemini', 'ollama', 'anthropic', 'openai', 'mistral'],
              description: 'Fallback provider if primary fails',
            },
            useCache: {
              type: 'boolean',
              description: 'Use local cache if available (default: true)',
            },
          },
          required: ['transcript'],
        },
      },
      {
        name: 'get_meeting_history',
        description: 'Retrieve history of analyzed meetings from local memory',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of meetings to return (default: 10)',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_meeting') {
    return await handleAnalyzeMeeting(args);
  } else if (name === 'get_meeting_history') {
    return await handleGetMeetingHistory(args);
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

/**
 * @param {object} args
 * @param {string} args.transcript
 * @param {string} [args.format]
 * @param {string} [args.provider]
 * @param {string} [args.fallbackProvider]
 * @param {boolean} [args.useCache]
 */
async function handleAnalyzeMeeting(args) {
  const { transcript, format, provider = 'gemini', fallbackProvider, useCache = true } = args;

  if (!transcript || typeof transcript !== 'string') {
    return {
      content: [{ type: 'text', text: 'Error: transcript is required and must be a string' }],
      isError: true,
    };
  }

  try {
    // Detect or validate format
    const detectedFormat = format || detectTranscriptFormat('dummy.txt');
    const normalizedFormat = format || detectTranscriptFormat('meeting.srt');

    // Normalize transcript (strip SRT/VTT timestamps)
    const normalized = normalizeTranscript(transcript, normalizedFormat);

    // Compute hash for caching
    const hash = await hashFile(Buffer.from(normalized, 'utf-8'));

    // Check cache
    if (useCache) {
      const cached = await getCache(hash);
      if (cached) {
        await addMeeting('mcp-session', hash, cached.summary);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cached, null, 2),
            },
          ],
        };
      }
    }

    // Call AI provider
    const result = await analyze(normalized, provider, undefined, {
      fallbackProvider,
    });

    // Validate with Zod
    const validated = AnalysisSchema.parse(result);

    // Save to cache and memory
    await saveCache(hash, validated);
    await addMeeting('mcp-session', hash, validated.summary);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(validated, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error analyzing meeting: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * @param {object} args
 * @param {number} [args.limit]
 */
async function handleGetMeetingHistory(args) {
  const { limit = 10 } = args || {};

  try {
    const memory = await loadMemory();
    const recent = memory.meetings.slice(-limit).reverse();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: recent.length,
              meetings: recent,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error retrieving meeting history: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TeamPulse MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error running MCP server:', error);
  process.exit(1);
});

export default server;
