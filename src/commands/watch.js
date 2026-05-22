// ── watch command ─────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { analyzeFile } from './analyze.js';

export async function watchCommand(dir, options) {
  const { provider = 'gemini', model, filter } = options;
  const dirPath = path.resolve(dir || '.');

  if (!fs.existsSync(dirPath)) {
    console.error(chalk.red(`✗ Directory not found: ${dirPath}`));
    process.exit(1);
  }

  console.log(chalk.dim(`\n👁  Watching for new transcripts in ${chalk.cyan(dirPath)} … (Ctrl+C to stop)\n`));

  const seen = new Set(
    fs.readdirSync(dirPath).filter(f => f.endsWith('.txt'))
  );

  fs.watch(dirPath, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.txt') || seen.has(filename)) return;
    seen.add(filename);

    const filePath = path.join(dirPath, filename);
    // Small delay to ensure file is fully written
    await new Promise(r => setTimeout(r, 600));

    if (!fs.existsSync(filePath)) return;

    console.log(chalk.dim(`\n▶ New file detected: ${chalk.cyan(filename)}`));
    try {
      const result = await analyzeFile(filePath, { provider, model, filter, silent: false });
      const d = result.decisions?.length || 0;
      const t = result.tasks?.length     || 0;
      const r = result.risks?.length      || 0;
      console.log(chalk.green(`  ✓ ${filename}`) + chalk.dim(` → ${d}d · ${t}t · ${r}r`));
    } catch (err) {
      console.error(chalk.red(`  ✗ Failed: ${err.message}`));
    }
  });

  // Keep alive
  process.stdin.resume();
}
