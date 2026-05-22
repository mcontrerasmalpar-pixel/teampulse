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
  .description('Terminal-first meeting intelligence — Gemini · Claude · GPT-4')
  .version('0.2.0');

// ── analyze ───────────────────────────────────────────────────────────────────
program
  .command('analyze [file]')
  .description('Analyze a transcript file (or watch a folder with --watch)')
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai', 'gemini')
  .option('-m, --model <name>',    'Override model name (e.g. gpt-4o-mini)')
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
  .option('-p, --provider <name>', 'AI provider: gemini | claude | openai', 'gemini')
  .option('-m, --model <name>',    'Override model name')
  .option('--since <date>',        'Only files modified after this date (YYYY-MM-DD)')
  .option('--filter <type>',       'Show only: decision | task | risk')
  .option('--title <label>',       'Label this batch run')
  .action(batchCommand);

// ── chat ──────────────────────────────────────────────────────────────────────
program
  .command('chat')
  .description('Interactive REPL over your meeting history')
  .option('-m, --meeting <id>', 'Focus on a specific meeting ID')
  .option('-p, --provider <name>', 'AI provider', 'gemini')
  .action(chatCommand);

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Configure TeamPulse for your team')
  .action(initCommand);

// ── history ───────────────────────────────────────────────────────────────────
program
  .command('history')
  .description('List analyzed meetings stored in memory')
  .option('-n, --limit <n>', 'Number of meetings to show', '10')
  .action(historyCommand);

// ── drift ─────────────────────────────────────────────────────────────────────
program
  .command('drift [idA] [idB]')
  .description('Compare two meetings and surface decision drift')
  .option('-l, --last <n>', 'Auto-compare the N most recent meetings', '2')
  .action(driftCommand);

// ── watchdog ──────────────────────────────────────────────────────────────────
program
  .command('watchdog')
  .description('Scan all meetings for recurring risks and ownerless tasks')
  .option('-t, --team <name>', 'Filter by team name or keyword')
  .action(watchdogCommand);

program.addHelpText('after', `
${chalk.dim('Examples:')}
  ${chalk.cyan('teampulse analyze sprint-review.txt --provider claude')}
  ${chalk.cyan('teampulse analyze meeting.txt --filter risk --title "Sprint 12"')}
  ${chalk.cyan('teampulse analyze --watch ./transcripts/')}
  ${chalk.cyan('teampulse batch ./meetings/ --since 2026-05-01 --filter task')}
  ${chalk.cyan('teampulse batch ./meetings/ --provider openai --title "Q2 Review"')}
  ${chalk.cyan('teampulse drift --last 2')}
  ${chalk.cyan('teampulse watchdog --team growth')}
  ${chalk.cyan('teampulse chat')}
`);

program.parse();
