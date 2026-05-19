import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { getAllMeetings, initDB } from '../utils/memory.js';
import { watchdogScan } from '../services/gemini.js';
import { printError, printInfo, printSection, printWarn } from '../utils/ui.js';

export async function watchdogCommand(options) {
  await initDB();

  const allMeetings = await getAllMeetings();
  // Cap at 20 most recent to stay within Gemini token limits
  const meetings = allMeetings.slice(0, 20);

  if (meetings.length === 0) {
    printWarn('No meetings in memory yet.');
    printInfo(`Run ${chalk.cyan('teampulse analyze <file>')} first.\n`);
    process.exit(0);
  }

  const teamFilter = options.team || null;

  console.log('\n' + chalk.bold.cyan('  Watchdog — Recurring Risk Monitor') + '\n');
  const total = allMeetings.length;
  const capped = total > 20 ? chalk.dim(` (showing 20 most recent of ${total})`) : '';
  printInfo(`Scanning ${meetings.length} meeting(s)${capped}${teamFilter ? ` for team: ${chalk.cyan(teamFilter)}` : ''}...`);

  const spinner = ora({ text: chalk.dim('Running watchdog scan with Gemini...'), color: 'cyan', indent: 2 }).start();

  let report;
  try {
    report = await watchdogScan(meetings, teamFilter);
    spinner.succeed(chalk.green('Watchdog scan complete'));
  } catch (err) {
    spinner.fail(chalk.red('Watchdog scan failed'));
    printError(err.message);
    process.exit(1);
  }

  // ── Health score ──────────────────────────────────────────────────────────
  const score = report.healthScore ?? 0;
  const scoreColor = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  console.log(
    `\n  ${chalk.bold('Team Health Score:')} ${chalk[scoreColor].bold(`${score}/100`)} ` +
    chalk.dim(score >= 70 ? '(healthy)' : score >= 40 ? '(needs attention)' : '(critical issues found)')
  );

  printSection('Assessment', report.summary || 'No summary generated.', 'white');

  // ── Top priorities ─────────────────────────────────────────────────────────
  if (report.topPriorities?.length) {
    console.log('\n' + chalk.bold.yellow('  ── Top Priorities ──'));
    report.topPriorities.forEach((p, i) => {
      console.log(`  ${chalk.yellow(`${i + 1}.`)} ${p}`);
    });
  }

  // ── Unresolved risks ──────────────────────────────────────────────────────
  if (report.unresolvedRisks?.length) {
    printSection(`Unresolved Risks (${report.unresolvedRisks.length})`, '', 'red');
    const table = new Table({
      head: ['Risk', 'Severity', 'Owner', 'Seen In', 'Recommendation'].map(h => chalk.cyan(h)),
      colWidths: [30, 10, 16, 20, 30],
      wordWrap: true
    });

    report.unresolvedRisks.forEach(r => {
      const sevColor = r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'yellow' : 'dim';
      table.push([
        r.description,
        chalk[sevColor](r.severity),
        r.owner || chalk.red('⚠ none'),
        (r.appearsInMeetings || []).join(', '),
        chalk.dim(r.recommendation || '')
      ]);
    });

    console.log(table.toString());
  }

  // ── Ownerless task patterns ───────────────────────────────────────────────
  if (report.ownerlessTaskPatterns?.length) {
    printSection(`Recurring Ownerless Tasks (${report.ownerlessTaskPatterns.length})`, '', 'yellow');
    report.ownerlessTaskPatterns.forEach(p => {
      console.log(`\n  ${chalk.yellow('⚠')} ${chalk.bold(p.topic)}`);
      p.examples?.slice(0, 3).forEach(ex => console.log(`     ${chalk.dim('•')} ${ex}`));
      if (p.recommendation) {
        console.log(`     ${chalk.dim('→')} ${p.recommendation}`);
      }
    });
  }

  // ── Overloaded participants ────────────────────────────────────────────────
  if (report.overloadedParticipants?.length) {
    printSection('Workload Distribution', '', 'magenta');
    const table = new Table({
      head: ['Person', 'Tasks Assigned', 'Meetings', 'Risk'].map(h => chalk.cyan(h)),
      colWidths: [20, 16, 10, 10]
    });

    report.overloadedParticipants.forEach(p => {
      const riskColor = p.riskLevel === 'high' ? 'red' : p.riskLevel === 'medium' ? 'yellow' : 'green';
      table.push([
        p.name,
        String(p.assignedTaskCount),
        String(p.meetingCount),
        chalk[riskColor](p.riskLevel)
      ]);
    });

    console.log(table.toString());
  }

  // ── Recurring topics ──────────────────────────────────────────────────────
  if (report.recurringTopics?.length) {
    printSection('Topics That Keep Coming Back', '', 'blue');
    report.recurringTopics.forEach(t => {
      const unresolved = t.neverResolved ? chalk.red(' [never resolved]') : '';
      console.log(
        `  ${chalk.dim('•')} ${chalk.bold(t.topic)}${unresolved} — ` +
        chalk.dim(`${t.meetingCount} meeting(s)`)
      );
      if (t.note) console.log(`     ${chalk.dim(t.note)}`);
    });
  }

  if (
    !report.unresolvedRisks?.length &&
    !report.ownerlessTaskPatterns?.length &&
    !report.recurringTopics?.length
  ) {
    console.log(`\n  ${chalk.green('✓')} No systemic issues detected across your meetings.`);
  }

  console.log();
}
