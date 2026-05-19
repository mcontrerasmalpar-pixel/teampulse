#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import { analyzeCommand } from './commands/analyze.js';
import { chatCommand } from './commands/chat.js';
import { initCommand } from './commands/init.js';
import { historyCommand } from './commands/history.js';
import { driftCommand } from './commands/drift.js';
import { watchdogCommand } from './commands/watchdog.js';
import { printBanner } from './utils/ui.js';

printBanner();

program
  .name('teampulse')
  .description('Terminal-first meeting intelligence agent powered by Gemini')
  .version('0.1.0');

// ── Command mode (deterministic, scriptable) ─────────────────────────────────
program
  .command('analyze <file>')
  .description('Analyze a Google Meet transcript or .txt meeting file')
  .option('-s, --skill <skill>', 'Role skill: product-manager | developer | founder | marketing', 'product-manager')
  .option('-f, --format <format>', 'Output format: plain | json | markdown', 'plain')
  .option('-o, --output <file>', 'Save output to file')
  .action(analyzeCommand);

// ── Chat / REPL mode (interactive, conversational) ───────────────────────────
program
  .command('chat')
  .description('Start interactive REPL over your meeting history')
  .option('-m, --meeting <id>', 'Focus on a specific meeting ID')
  .action(chatCommand);

// ── Setup wizard ─────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Configure TeamPulse for your team')
  .action(initCommand);

// ── History browser ──────────────────────────────────────────────────────────
program
  .command('history')
  .description('List analyzed meetings stored in memory')
  .option('-n, --limit <n>', 'Number of meetings to show', '10')
  .action(historyCommand);

// ── Decision drift detection ──────────────────────────────────────────────────
program
  .command('drift [idA] [idB]')
  .description('Compare two meetings and surface decision drift')
  .option('-l, --last <n>', 'Auto-compare the N most recent meetings (e.g. --last 2)')
  .action(driftCommand);

// ── Recurring risk watchdog ───────────────────────────────────────────────────
program
  .command('watchdog')
  .description('Scan all stored meetings for recurring risks and ownerless tasks')
  .option('-t, --team <name>', 'Filter by team name or keyword')
  .action(watchdogCommand);

program.addHelpText('after', `
${chalk.dim('Examples:')}
  ${chalk.cyan('teampulse analyze sprint-review.txt --skill product-manager')}
  ${chalk.cyan('teampulse analyze meeting.txt --format json --output report.json')}
  ${chalk.cyan('teampulse drift --last 2')}
  ${chalk.cyan('teampulse watchdog --team growth')}
  ${chalk.cyan('teampulse chat')}
  ${chalk.cyan('teampulse init')}
`);

program.parse();
