import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

export function printBanner() {
  console.log(
    boxen(
      chalk.bold.cyan('TeamPulse') +
      chalk.dim(' v0.2.0\n') +
      chalk.dim('Meeting intelligence · Gemini · Claude · GPT-4'),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        margin: { top: 1, bottom: 0 }
      }
    )
  );
}

export function printSection(title, content, color = 'white') {
  const colorFn = chalk[color] || chalk.white;
  console.log('\n' + colorFn(`  ── ${title} ──`));
  if (Array.isArray(content)) {
    content.forEach(item => console.log(chalk.dim('  • ') + item));
  } else if (content) {
    console.log('  ' + content);
  }
}

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

export function printTable(headers, rows) {
  const table = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { compact: true, border: ['dim'] }
  });
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

export function printSuccess(msg) {
  console.log(`\n  ${chalk.green('✓')} ${msg}`);
}

export function printError(msg) {
  console.error(`\n  ${chalk.red('✗')} ${msg}`);
}

export function printInfo(msg) {
  console.log(`  ${chalk.dim('›')} ${msg}`);
}

export function printAssistantResponse(text) {
  const lines = text.split('\n');
  lines.forEach(line => console.log('  ' + line));
}

export function printWarn(msg) {
  console.log(`\n  ${chalk.yellow('⚠')} ${msg}`);
}
