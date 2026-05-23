#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import { analyzeCommand } from './commands/analyze.js';
import { batchCommand } from './commands/batch.js';
import { watchCommand } from './commands/watch.js';
import { chatCommand } from './commands/chat.js';
import { initCommand } from './commands/init.js';
import { historyCommand } from './commands/history.js';
import { driftCommand } from './commands/drift.js';
import { watchdogCommand } from './commands/watchdog.js';
import { printBanner } from './utils/ui.js';

printBanner();

program
  .name('teampulse')
  .description('Terminal-first meeting intelligence — Gemini · Claude · GPT-4 · Mistral · Ollama')
  .version('0.2.0');

// ── analyze ───────────────────────────────────────────────────────────────────
program
  .command('analyze [file]')
  .description('Analyze a transcript file (or watch a folder with --watch)')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name (e.g. mistral-large, llama3, gpt-4o-mini)')
  .option('-s, --skill <skill>',   'Role skill: product-manager | developer | founder | marketing', 'product-manager')
  .option('-f, --format <format>', 'Output format: plain | json | markdown', 'plain')
  .option('-o, --output <file>',   'Save output to file')
  .option('--filter <type>',       'Show only: decision | task | risk')
  .option('--title <label>',       'Label this analysis run')
  .option('--watch [dir]',         'Watch a folder for new transcripts')
  .action((file, opts) => {
    if (opts.watch) {
      const dir = typeof opts.watch === 'string' ? opts.watch : (file || '.');
      return watchCommand(dir, opts);
    }
    if (!file) {
      console.error(chalk.red('✗ Provide a file path or use --watch <dir>'));
      process.exit(1);
    }
    return analyzeCommand(file, opts);
  });

// ── batch ─────────────────────────────────────────────────────────────────────
program
  .command('batch [dir]')
  .description('Analyze all transcripts in a directory')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('-s, --skill <skill>',   'Role skill: product-manager | developer | founder | marketing', 'product-manager')
  .option('--since <date>',        'Only files modified after this date (YYYY-MM-DD)')
  .option('--filter <type>',       'Show only: decision | task | risk')
  .option('--title <label>',       'Label this batch run')
  .action(batchCommand);

// ── watch ─────────────────────────────────────────────────────────────────────
program
  .command('watch [dir]')
  .description('Monitor a folder and auto-analyze new .txt transcripts')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('-s, --skill <skill>',   'Role skill', 'product-manager')
  .action(watchCommand);

// ── chat ──────────────────────────────────────────────────────────────────────
program
  .command('chat')
  .description('Interactive REPL over your meeting history')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('--meeting <id>',        'Focus on a specific meeting ID')
  .action(chatCommand);

// ── drift ─────────────────────────────────────────────────────────────────────
program
  .command('drift [idA] [idB]')
  .description('Compare two meetings and surface decision drift')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('-l, --last <n>',        'Auto-compare the N most recent meetings')
  .action(driftCommand);

// ── watchdog ──────────────────────────────────────────────────────────────────
program
  .command('watchdog')
  .description('Scan all meetings for recurring risks and ownerless tasks')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai | mistral | ollama', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('-t, --team <name>',     'Filter by team name or keyword')
  .action(watchdogCommand);

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Setup wizard — configure API keys, default provider and skill')
  .action(initCommand);

// ── history ───────────────────────────────────────────────────────────────────
program
  .command('history')
  .description('List analyzed meetings stored in memory')
  .option('-n, --limit <n>', 'Number of meetings to show', '10')
  .action(historyCommand);

program.addHelpText('after', `
${chalk.bold('Providers:')}
  ${chalk.cyan('gemini')}   free tier  · aistudio.google.com/app/apikey       → GEMINI_API_KEY
  ${chalk.cyan('claude')}   paid       · console.anthropic.com                → ANTHROPIC_API_KEY
  ${chalk.cyan('openai')}   paid       · platform.openai.com/api-keys         → OPENAI_API_KEY
  ${chalk.cyan('mistral')}  paid       · console.mistral.ai                   → MISTRAL_API_KEY
  ${chalk.cyan('ollama')}   local/free · ollama.com — no API key required

${chalk.bold('Local setup (Ollama):')}
  ${chalk.dim('ollama serve')}                              start the local server
  ${chalk.dim('ollama pull mistral')}                       download mistral model
  ${chalk.dim('ollama pull llama3')}                        download llama3 model

${chalk.bold('Examples:')}
  ${chalk.cyan('teampulse analyze sprint-review.txt')}
  ${chalk.cyan('teampulse analyze meeting.txt --provider claude --skill developer')}
  ${chalk.cyan('teampulse analyze meeting.txt --provider openai --model gpt-4o-mini')}
  ${chalk.cyan('teampulse analyze meeting.txt --provider mistral --model mistral-large')}
  ${chalk.cyan('teampulse analyze meeting.txt --provider ollama --model mistral')}
  ${chalk.cyan('teampulse batch ./meetings/ --provider claude --since 2026-05-01')}
  ${chalk.cyan('teampulse watch ./transcripts/ --provider ollama --model llama3')}
  ${chalk.cyan('teampulse drift --last 2 --provider mistral')}
  ${chalk.cyan('teampulse watchdog --provider gemini --team growth')}
  ${chalk.cyan('teampulse chat --provider ollama --model mistral')}
  ${chalk.cyan('teampulse init')}
`);

program.parse();
