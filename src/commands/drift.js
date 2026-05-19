import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { getMeetingById, getMeetings, initDB } from '../utils/memory.js';
import { compareMeetings } from '../services/gemini.js';
import { printError, printInfo, printSection, printWarn } from '../utils/ui.js';

export async function driftCommand(idA, idB, options) {
  await initDB();

  let meetingA, meetingB;

  if (options.last) {
    const n = parseInt(options.last, 10);
    if (isNaN(n) || n < 2) {
      printError('--last requires a number >= 2 (e.g. --last 2)');
      process.exit(1);
    }
    const recent = await getMeetings(n);
    if (recent.length < 2) {
      printError(`Need at least 2 meetings in memory. Found ${recent.length}.`);
      printInfo(`Run ${chalk.cyan('teampulse analyze <file>')} to add meetings first.`);
      process.exit(1);
    }
    // getMeetings returns newest-first; for drift we want older → newer
    meetingB = recent[0];
    meetingA = recent[n - 1] || recent[recent.length - 1];
  } else {
    if (!idA || !idB) {
      printError('Usage: teampulse drift <meeting-id-A> <meeting-id-B>');
      printInfo('Or use: teampulse drift --last 2');
      process.exit(1);
    }
    [meetingA, meetingB] = await Promise.all([
      getMeetingById(idA),
      getMeetingById(idB)
    ]);
    if (!meetingA) { printError(`Meeting not found: ${idA}`); process.exit(1); }
    if (!meetingB) { printError(`Meeting not found: ${idB}`); process.exit(1); }
  }

  console.log('\n' + chalk.bold.cyan('  Decision Drift Analysis') + '\n');
  printInfo(`Comparing: ${chalk.white(meetingA.title)} → ${chalk.white(meetingB.title)}`);

  const spinner = ora({ text: chalk.dim('Analyzing drift with Gemini...'), color: 'cyan', indent: 2 }).start();

  let drift;
  try {
    drift = await compareMeetings(meetingA, meetingB);
    spinner.succeed(chalk.green('Drift analysis complete'));
  } catch (err) {
    spinner.fail(chalk.red('Drift analysis failed'));
    printError(err.message);
    process.exit(1);
  }

  // ── Overall score ──────────────────────────────────────────────────────────
  const score = drift.overallDriftScore ?? 0;
  const scoreColor = score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green';
  console.log(
    `\n  ${chalk.bold('Overall Drift Score:')} ${chalk[scoreColor].bold(`${score}/100`)} ` +
    chalk.dim(score >= 70 ? '(high drift — needs attention)' : score >= 40 ? '(moderate drift)' : '(healthy)')
  );

  printSection('Summary', drift.summary || 'No summary generated.', 'white');

  // ── Drift items table ──────────────────────────────────────────────────────
  if (drift.driftItems?.length) {
    console.log('\n' + chalk.cyan('  ── Decision & Task Drift ──'));
    const table = new Table({
      head: ['Topic', meetingA.title.slice(0, 20), meetingB.title.slice(0, 20), 'Type', 'Score'].map(h => chalk.cyan(h)),
      colWidths: [28, 24, 24, 12, 7],
      wordWrap: true
    });

    drift.driftItems.forEach(item => {
      const typeColor = {
        resolved: 'green',
        regressed: 'red',
        recurring: 'yellow',
        abandoned: 'red',
        new: 'dim'
      }[item.driftType] || 'white';

      const scoreVal = item.driftScore ?? 0;
      const scoreStr = scoreVal >= 70
        ? chalk.red(String(scoreVal))
        : scoreVal >= 40
          ? chalk.yellow(String(scoreVal))
          : chalk.green(String(scoreVal));

      table.push([
        item.topic,
        chalk.dim(item.meetingA || '—'),
        chalk.dim(item.meetingB || '—'),
        chalk[typeColor](item.driftType),
        scoreStr
      ]);
    });

    console.log(table.toString());

    drift.driftItems.forEach(item => {
      if (item.observation) {
        console.log(`  ${chalk.dim('›')} ${chalk.bold(item.topic)}: ${item.observation}`);
      }
    });
  }

  // ── Recurring blockers ─────────────────────────────────────────────────────
  if (drift.recurringBlockers?.length) {
    printSection(`Recurring Blockers (${drift.recurringBlockers.length})`, '', 'red');
    drift.recurringBlockers.forEach(b => {
      const sevColor = b.severity === 'high' ? 'red' : b.severity === 'medium' ? 'yellow' : 'dim';
      console.log(
        `\n  ${chalk[sevColor](`[${b.severity.toUpperCase()}]`)} ${b.description}\n` +
        `     ${chalk.dim('Owner:')} ${b.owner || chalk.red('unassigned')}\n` +
        `     ${chalk.dim('Seen in:')} ${b.appearsIn?.join(', ')}`
      );
    });
  }

  // ── Uncommitted owners ────────────────────────────────────────────────────
  if (drift.uncommittedOwners?.length) {
    printSection('Ownership Follow-Through', '', 'yellow');
    drift.uncommittedOwners.forEach(o => {
      if (o.missedItems?.length) {
        console.log(`\n  ${chalk.bold(o.name)} — ${chalk.red(`${o.missedItems.length} missed commitment(s)`)}`);
        o.missedItems.forEach(item => console.log(`     ${chalk.dim('✗')} ${item}`));
        if (o.followedUp?.length) {
          o.followedUp.forEach(item => console.log(`     ${chalk.green('✓')} ${item}`));
        }
      }
    });
  }

  if (!drift.driftItems?.length && !drift.recurringBlockers?.length) {
    printInfo('No significant drift detected between these meetings.');
  }

  console.log();
}
