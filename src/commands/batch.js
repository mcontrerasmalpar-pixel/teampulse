// ── batch command ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { analyzeFile } from './analyze.js';

export async function batchCommand(dir, options) {
  const { since, filter, title, provider = 'gemini', model } = options;

  // Resolve directory
  const dirPath = path.resolve(dir || '.');
  if (!fs.existsSync(dirPath)) {
    console.error(chalk.red(`✗ Directory not found: ${dirPath}`));
    process.exit(1);
  }

  // Get .txt files
  let files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.txt'))
    .map(f => path.join(dirPath, f));

  // Filter by --since date
  if (since) {
    const sinceDate = new Date(since);
    if (isNaN(sinceDate)) {
      console.error(chalk.red(`✗ Invalid date format for --since: ${since}. Use YYYY-MM-DD`));
      process.exit(1);
    }
    files = files.filter(f => {
      const stat = fs.statSync(f);
      return stat.mtime >= sinceDate;
    });
  }

  if (files.length === 0) {
    console.log(chalk.yellow('⚠ No transcript files found matching criteria.'));
    return;
  }

  const label = title ? chalk.bold(`[${title}] `) : '';
  console.log(chalk.dim(`\n📦 ${label}Batch processing ${files.length} file(s)…\n`));

  let totalDecisions = 0, totalTasks = 0, totalRisks = 0;
  const results = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    process.stdout.write(chalk.dim(`  → ${fileName} … `));
    try {
      const result = await analyzeFile(filePath, { provider, model, filter, silent: true });
      totalDecisions += result.decisions?.length || 0;
      totalTasks     += result.tasks?.length     || 0;
      totalRisks     += result.risks?.length      || 0;
      results.push({ file: fileName, ...result });
      console.log(chalk.green('✓'));
    } catch (err) {
      console.log(chalk.red(`✗ ${err.message}`));
    }
  }

  // Summary
  console.log();
  console.log(chalk.bold('─'.repeat(48)));
  if (title) console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.bold(`  ${files.length} meetings processed`));
  console.log();

  if (!filter || filter === 'decision') {
    console.log(chalk.blue.bold(`  DECISIONS  (${totalDecisions})`));
    results.forEach(r => r.decisions?.forEach(d =>
      console.log(`    › ${d.text}  ${chalk.dim(`[${d.owner || '?'}]`)}`))
    );
    console.log();
  }
  if (!filter || filter === 'task') {
    console.log(chalk.yellow.bold(`  TASKS  (${totalTasks})`));
    results.forEach(r => r.tasks?.forEach(t =>
      console.log(`    › ${t.text}  ${chalk.dim(`[${t.owner || '?'}] [${t.due || 'no due'}]`)}`))
    );
    console.log();
  }
  if (!filter || filter === 'risk') {
    console.log(chalk.red.bold(`  RISKS  (${totalRisks})`));
    results.forEach(r => r.risks?.forEach(risk =>
      console.log(`    › ${risk.text}  ${chalk.dim(`[${risk.status || 'open'}]`)}`))
    );
    console.log();
  }

  console.log(chalk.bold('─'.repeat(48)));
}
