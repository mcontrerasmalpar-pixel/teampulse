import { watch } from 'fs';
import { resolve, extname, basename } from 'path';
import chalk from 'chalk';
import { analyzeFile } from './analyze.js';
import { resolveProvider, getProviderLabel } from '../services/provider.js';
import { printError, printInfo, printSuccess, printWarn, printProviderTag } from '../utils/ui.js';

export async function watchCommand(dir, options) {
  const { provider = 'gemini', model: modelOverride, skill = 'product-manager' } = options;
  const { name: provName, model } = resolveProvider(provider, modelOverride);

  const fullDir = resolve(dir || '.');

  console.log(`\n${chalk.bold.cyan('  ● Watch mode')} ${chalk.dim(`── monitoring ${fullDir}`)}`);
  printProviderTag(provName, model);
  printInfo(`Skill: ${chalk.cyan(skill)}`);
  printInfo('Watching for new .txt files — press Ctrl+C to stop\n');

  const processing = new Set();

  const watcher = watch(fullDir, { persistent: true }, async (event, filename) => {
    if (!filename || extname(filename) !== '.txt') return;
    if (processing.has(filename)) return;

    const filePath = resolve(fullDir, filename);
    processing.add(filename);

    await new Promise(r => setTimeout(r, 500));

    console.log(`\n  ${chalk.cyan('▶')} Detected: ${chalk.white(filename)}`);

    try {
      const analysis = await analyzeFile(filePath, { provider: provName, model, skill, silent: true });
      printSuccess(`Analyzed: ${basename(filename)}  ·  ${chalk.dim(analysis.title || '')}`);
      if (analysis.tasks?.length)     printInfo(`  ${analysis.tasks.length} task(s) extracted`);
      if (analysis.decisions?.length) printInfo(`  ${analysis.decisions.length} decision(s) extracted`);
      if (analysis.risks?.length)     printInfo(`  ${analysis.risks.length} risk(s) detected`);
      console.log(chalk.dim(`  Run ${chalk.cyan('teampulse chat')} to explore.`));
    } catch (err) {
      printError(`Failed to analyze ${filename}: ${err.message}`);
    } finally {
      processing.delete(filename);
    }
  });

  watcher.on('error', err => printError(`Watcher error: ${err.message}`));

  process.on('SIGINT', () => {
    watcher.close();
    console.log(chalk.dim('\n\n  Watch mode stopped.\n'));
    process.exit(0);
  });
}
