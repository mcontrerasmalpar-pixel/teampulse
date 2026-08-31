#!/usr/bin/env node
// @ts-check
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, dispatchTool } from './mcp/handlers.js';

const server = new Server(
  {
    name: 'teampulse',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return dispatchTool(name, args || {});
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TeamPulse MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error running MCP server:', error);
  process.exit(1);
});

export { server, main };
export default server;
