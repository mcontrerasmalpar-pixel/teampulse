import { readdirSync, statSync } from 'fs';
import { resolve, basename, extname } from 'path';
import chalk from 'chalk';
import { analyzeFile } from './analyze.js';
import { resolveProvider, getProviderLabel } from '../services/provider.js';
import {
  printError, printInfo, printSection, printSuccess, printWarn,
  printProviderTag, printTiming, printProviderError, createSpinner
} from '../utils/ui.js';

export async function batchCommand(dir, options) {
  const { provider = 'gemini', model: modelOverride, skill = 'product-manager', since, filter, title } = options;
  const { name: provName, model } = resolveProvider(provider, modelOverride);
  const provLabel = getProviderLabel(provName, model);

  const fullDir = resolve(dir);

  let files;
  try {
    files = readdirSync(fullDir)
      .filter(f => extname(f) === '.txt')
      .map(f => resolve(fullDir, f));
  } catch (err) {
    printError(`Cannot read directory: ${err.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    printWarn(`No .txt files found in ${fullDir}`);
    process.exit(0);
  }

  if (since) {
    const sinceDate = new Date(since);
    if (isNaN(sinceDate)) {
      printError(`Invalid date for --since: ${since}. Use YYYY-MM-DD.`);
      process.exit(1);
    }
    files = files.filter(f => statSync(f).mtime >= sinceDate);
    if (files.length === 0) {
      printWarn(`No .txt files found modified after ${since}`);
      process.exit(0);
    }
  }

  const label = title ? chalk.bold.white(` — ${title}`) : '';
  console.log(`\n${chalk.bold.cyan('  Batch Analysis')}${label}`);
  printProviderTag(provName, model);
  printInfo(`Found ${files.length} transcript(s) in ${chalk.dim(fullDir)}`);
  printInfo(`Skill: ${chalk.cyan(skill)}`);
  if (since) printInfo(`Since: ${since}`);
  console.log();

  const results = [];
  let passed = 0;
  let failed = 0;
  const startMs = Date.now();

  for (const filePath of files) {
    const name = basename(filePath);
    const spinner = createSpinner(`Analyzing ${chalk.cyan(name)}…`);
    try {
      const analysis = await analyzeFile(filePath, { provider: provName, model, skill });
      spinner.succeed(chalk.green(`✓ ${name}`));
      results.push({ file: name, ...analysis });
      passed++;
    } catch (err) {
      spinner.fail(chalk.red(`✗ ${name}: ${err.message}`));
      printProviderError(provName);
      failed++;
    }
  }

  // ── Consolidated output ─────────────────────────────────────────────────────────
  console.log(`\n${chalk.bold.cyan('  ── Batch Summary ──')}`);
  printInfo(`${chalk.green(`${passed} succeeded`)}  ${failed > 0 ? chalk.red(`${failed} failed`) : ''}`);
  printTiming(startMs);

  const allDecisions = results.flatMap(r => (r.decisions || []).map(d => ({ ...d, _file: r.file })));
  const allTasks     = results.flatMap(r => (r.tasks     || []).map(t => ({ ...t, _file: r.file })));
  const allRisks     = results.flatMap(r => (r.risks     || []).map(k => ({ ...k, _file: r.file })));

  const show = f => !filter || filter === f;

  if (show('decision') && allDecisions.length) {
    printSection(`Decisions (${allDecisions.length} total)`, '', 'cyan');
    allDecisions.forEach(d => {
      console.log(
        `  ${chalk.bold(d.title)}` +
        chalk.dim(` [${d._file}]`) +
        `  ${chalk.dim('owner:')} ${d.owner || chalk.red('⚠ none')}` +
        `  ${chalk.dim('status:')} ${d.status || '—'}`
      );
    });
  }

  if (show('task') && allTasks.length) {
    printSection(`Tasks (${allTasks.length} total)`, '', 'yellow');
    const unassigned = allTasks.filter(t => !t.owner);
    allTasks.forEach(t => {
      const pColor = t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'yellow' : 'dim';
      console.log(
        `  ${chalk.dim('○')} ${t.description}` +
        chalk.dim(` [${t._file}]`) +
        `  ${chalk.dim('owner:')} ${t.owner || chalk.red('⚠ none')}` +
        `  ${chalk[pColor](`[${t.priority}]`)}`
      );
    });
    if (unassigned.length)
      console.log(`\n  ${chalk.red('⚠')} ${chalk.yellow(`${unassigned.length} unassigned task(s) across all meetings`)}`);
  }

  if (show('risk') && allRisks.length) {
    printSection(`Risks (${allRisks.length} total)`, '', 'red');
    allRisks.forEach(r => {
      const lColor = r.level === 'high' ? 'red' : r.level === 'medium' ? 'yellow' : 'dim';
      console.log(
        `  ${chalk[lColor](`[${r.level?.toUpperCase()}]`)} ${r.description}` +
        chalk.dim(` [${r._file}]`)
      );
    });
  }

  if (results.length > 0)
    printInfo(`Run ${chalk.cyan('teampulse chat')} to explore all analyzed meetings interactively.`);

  console.log();
}
