#!/usr/bin/env node
// @ts-check
import { program } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerBatchCommand } from './commands/batch.js';

program
  .name('teampulse')
  .description('CLI de analisis de reuniones con IA')
  .version('1.0.1');

registerAnalyzeCommand(program);
registerBatchCommand(program);

program
  .command('mcp')
  .description('Start the TeamPulse MCP server on stdio')
  .action(async () => {
    await import('./mcp-server.js');
  });

program.parse();

export default program;
