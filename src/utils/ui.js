import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import ora from 'ora';

// ── TTY guard — silence decorative output in pipes / --format json ────────────
export const isTTY = process.stdout.isTTY ?? false;

export function printBanner() {
  if (!isTTY) return;
  console.log(
    boxen(
      chalk.bold.cyan('TeamPulse') +
      chalk.dim(' v0.2.0\n') +
      chalk.dim('Meeting intelligence · Gemini · Claude · GPT-4 · Mistral · Ollama'),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        margin: { top: 1, bottom: 0 }
      }
    )
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function createSpinner(text) {
  if (!isTTY) {
    // In non-TTY just print a plain line so piped output stays clean
    process.stderr.write(`› ${text}\n`);
    return {
      succeed: (msg) => process.stderr.write(`✓ ${msg}\n`),
      fail:    (msg) => process.stderr.write(`✗ ${msg}\n`),
      text:    text,
      stop:    () => {}
    };
  }
  return ora({ text, color: 'cyan', spinner: 'dots' }).start();
}

// ── Provider tag ──────────────────────────────────────────────────────────────
export function printProviderTag(provider, model) {
  if (!isTTY) return;
  const isLocal = provider === 'ollama';
  const tag = isLocal
    ? chalk.bgCyan.black(` ${provider} `) + chalk.dim(` / ${model || 'default'} `) + chalk.cyan('· offline')
    : chalk.bgCyan.black(` ${provider} `) + (model ? chalk.dim(` / ${model}`) : '');
  console.log(`\n  ${tag}\n`);
}

// ── Timing ────────────────────────────────────────────────────────────────────
export function printTiming(startMs) {
  if (!isTTY) return;
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n  ${chalk.dim(`Done in ${elapsed}s`)}`);
}

// ── Section header ────────────────────────────────────────────────────────────
export function printSection(title, content, color = 'white') {
  const colorFn = chalk[color] || chalk.white;
  console.log('\n' + colorFn(`  ── ${title} ──`));
  if (Array.isArray(content)) {
    content.forEach(item => console.log(chalk.dim('  • ') + item));
  } else if (content) {
    console.log('  ' + content);
  }
}

// ── Insight printers ──────────────────────────────────────────────────────────
export function printDecision(d, index) {
  const statusColor = d.status === 'blocked' ? 'red' : d.status === 'pending' ? 'yellow' : 'green';
  console.log(
    `\n  ${chalk.bold(`${index + 1}. ${d.title}`)}\n` +
    `     ${chalk.dim('Owner:')} ${d.owner ? chalk.white(d.owner) : chalk.red('⚠ unassigned')}\n` +
    `     ${chalk.dim('Status:')} ${chalk[statusColor](d.status)}\n` +
    `     ${chalk.dim(d.context)}`
  );
}

export function printTask(t) {
  const priorityColor = t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'yellow' : 'dim';
  const checkbox = t.done ? chalk.green('✓') : chalk.dim('○');
  console.log(
    `  ${checkbox} ${t.description}\n` +
    `    ${chalk.dim('Owner:')} ${t.owner ? chalk.white(t.owner) : chalk.red('⚠ unassigned')}` +
    (t.deadline ? `  ${chalk.dim('Due:')} ${t.deadline}` : '') +
    `  ${chalk[priorityColor](`[${t.priority}]`)}`
  );
}

export function printRisk(r) {
  const levelColor = r.level === 'high' ? 'red' : r.level === 'medium' ? 'yellow' : 'dim';
  console.log(
    `\n  ${chalk[levelColor](`[${r.level.toUpperCase()}]`)} ${r.description}` +
    (r.mitigation ? `\n     ${chalk.dim('Mitigation:')} ${r.mitigation}` : '')
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function printTable(headers, rows) {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { compact: true, border: ['dim'] }
  });
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

// ── Status helpers ────────────────────────────────────────────────────────────
export function printSuccess(msg) {
  console.log(`\n  ${chalk.green('✓')} ${msg}`);
}

export function printError(msg) {
  console.error(`\n  ${chalk.red('✗')} ${msg}`);
}

export function printInfo(msg) {
  console.log(`  ${chalk.dim('›')} ${msg}`);
}

export function printWarn(msg) {
  console.log(`\n  ${chalk.yellow('⚠')} ${msg}`);
}

export function printAssistantResponse(text) {
  const lines = text.split('\n');
  lines.forEach(line => console.log('  ' + line));
}

// ── Provider-specific error hints ─────────────────────────────────────────────
export function printProviderError(provider) {
  const hints = {
    gemini:  'GEMINI_API_KEY not found — get one at aistudio.google.com/app/apikey',
    claude:  'ANTHROPIC_API_KEY not found — get one at console.anthropic.com',
    openai:  'OPENAI_API_KEY not found — get one at platform.openai.com/api-keys',
    mistral: 'MISTRAL_API_KEY not found — get one at console.mistral.ai',
    ollama:  'Ollama not running — start it with: ollama serve\n  Then pull a model: ollama pull mistral'
  };
  const hint = hints[provider] || `Unknown provider "${provider}" — use: gemini | claude | openai | mistral | ollama`;
  printError(hint);
  console.log(`\n  ${chalk.dim('Run')} ${chalk.cyan('teampulse init')} ${chalk.dim('to configure providers interactively.')}\n`);
}
