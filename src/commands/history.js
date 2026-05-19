import chalk from 'chalk';
import Table from 'cli-table3';
import { getMeetings, initDB } from '../utils/memory.js';
import { printError, printInfo } from '../utils/ui.js';

export async function historyCommand(options) {
  await initDB();

  const limit = parseInt(options.limit, 10) || 10;
  const meetings = await getMeetings(limit);

  if (meetings.length === 0) {
    console.log(chalk.yellow('\n  No meetings in memory yet.'));
    printInfo(`Run ${chalk.cyan('teampulse analyze <file>')} to analyze your first meeting.\n`);
    return;
  }

  console.log('\n' + chalk.bold.cyan('  Meeting History') + '\n');

  const table = new Table({
    head: ['ID', 'Title', 'Date', 'Skill', 'Decisions', 'Tasks', 'Risks'].map(h => chalk.cyan(h)),
    style: { compact: false },
    colWidths: [18, 30, 12, 18, 10, 6, 6]
  });

  meetings.forEach(m => {
    const date = new Date(m.analyzedAt).toLocaleDateString();
    const decisions = m.analysis?.decisions?.length ?? 0;
    const tasks = m.analysis?.tasks?.length ?? 0;
    const risks = m.analysis?.risks?.length ?? 0;
    const unowned = m.analysis?.tasks?.filter(t => !t.owner).length ?? 0;

    table.push([
      chalk.dim(m.id),
      m.title.length > 28 ? m.title.slice(0, 27) + '…' : m.title,
      chalk.dim(date),
      chalk.dim(m.skill),
      String(decisions),
      unowned > 0 ? chalk.yellow(String(tasks)) : String(tasks),
      risks > 0 ? chalk.red(String(risks)) : String(risks)
    ]);
  });

  console.log(table.toString());

  const totalTasks = meetings.reduce((n, m) => n + (m.analysis?.tasks?.length ?? 0), 0);
  const totalUnowned = meetings.reduce(
    (n, m) => n + (m.analysis?.tasks?.filter(t => !t.owner).length ?? 0),
    0
  );

  console.log(
    `\n  ${chalk.dim(`${meetings.length} meeting(s) · ${totalTasks} total tasks · `)}` +
    (totalUnowned > 0
      ? chalk.yellow(`${totalUnowned} unassigned`)
      : chalk.green('all assigned')) +
    '\n'
  );

  printInfo(`Run ${chalk.cyan('teampulse drift --last 2')} to compare your two most recent meetings.`);
  printInfo(`Run ${chalk.cyan('teampulse watchdog')} to scan for recurring risks.\n`);
}
