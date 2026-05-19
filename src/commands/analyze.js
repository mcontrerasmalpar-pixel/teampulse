import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { analyzeMeeting } from '../services/gemini.js';
import { saveMeeting, generateMeetingId, initDB } from '../utils/memory.js';
import {
  printSection, printDecision, printTask, printRisk,
  printSuccess, printError, printInfo
} from '../utils/ui.js';

export async function analyzeCommand(filePath, options) {
  const { skill, format, output } = options;

  // ── 1. Read transcript file ────────────────────────────────────────────────
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    printError(`File not found: ${fullPath}`);
    printInfo('Tip: Export your Google Meet transcript from Google Drive as a .txt or .md file');
    process.exit(1);
  }

  let transcript;
  try {
    transcript = readFileSync(fullPath, 'utf-8');
  } catch (err) {
    printError(`Cannot read file: ${err.message}`);
    process.exit(1);
  }

  if (transcript.length < 50) {
    printError('Transcript too short. Make sure the file has meeting content.');
    process.exit(1);
  }

  // ── 2. Init DB + spinner ───────────────────────────────────────────────────
  await initDB();
  const filename = basename(filePath);
  const spinner = ora({
    text: chalk.dim(`Analyzing ${chalk.cyan(filename)} with skill: ${chalk.cyan(skill)}...`),
    color: 'cyan'
  }).start();

  // ── 3. Call Gemini ─────────────────────────────────────────────────────────
  let analysis;
  try {
    analysis = await analyzeMeeting(transcript, skill);
    spinner.succeed(chalk.green('Analysis complete'));
  } catch (err) {
    spinner.fail(chalk.red('Analysis failed'));
    printError(err.message);
    process.exit(1);
  }

  // ── 4. Persist to memory ───────────────────────────────────────────────────
  const meetingId = generateMeetingId(filename);
  const meetingRecord = {
    id: meetingId,
    filename,
    skill,
    analyzedAt: new Date().toISOString(),
    title: analysis.title || filename,
    analysis
  };
  await saveMeeting(meetingRecord);
  printInfo(`Saved as meeting ID: ${meetingId}`);

  // ── 5. Render output ───────────────────────────────────────────────────────
  if (format === 'json') {
    const jsonOut = JSON.stringify({ meetingId, ...analysis }, null, 2);
    if (output) {
      writeFileSync(output, jsonOut);
      printSuccess(`JSON saved to ${output}`);
    } else {
      console.log(jsonOut);
    }
    return;
  }

  if (format === 'markdown') {
    const md = toMarkdown(meetingId, analysis, skill);
    if (output) {
      writeFileSync(output, md);
      printSuccess(`Markdown saved to ${output}`);
    } else {
      console.log(md);
    }
    return;
  }

  // ── Plain (default) ────────────────────────────────────────────────────────
  console.log();
  console.log(chalk.bold.white(`  ${analysis.title || filename}`));
  console.log(chalk.dim(`  ${new Date().toLocaleDateString()}  ·  skill: ${skill}  ·  id: ${meetingId}`));
  console.log(chalk.dim(`  sentiment: ${sentimentBadge(analysis.sentiment)}`));

  printSection('Summary', analysis.summary || 'No summary generated.');

  if (analysis.decisions?.length) {
    printSection(`Decisions (${analysis.decisions.length})`, '', 'cyan');
    analysis.decisions.forEach((d, i) => printDecision(d, i));
  }

  if (analysis.tasks?.length) {
    printSection(`Tasks (${analysis.tasks.length})`, '', 'yellow');
    analysis.tasks.forEach(t => printTask(t));

    const unassigned = analysis.tasks.filter(t => !t.owner).length;
    if (unassigned > 0) {
      console.log(`\n  ${chalk.red('⚠')} ${chalk.yellow(`${unassigned} task(s) have no owner assigned`)}`);
    }
  }

  if (analysis.risks?.length) {
    printSection(`Risks (${analysis.risks.length})`, '', 'red');
    analysis.risks.forEach(r => printRisk(r));
  }

  if (analysis.openQuestions?.length) {
    printSection('Open Questions', analysis.openQuestions, 'blue');
  }

  if (analysis.participants?.length) {
    printInfo(`Participants: ${analysis.participants.join(', ')}`);
  }

  if (analysis.followUpSuggested) {
    console.log(`\n  ${chalk.cyan('→')} ${chalk.bold('Follow-up meeting suggested')}`);
  }

  console.log(`\n  ${chalk.dim('Run')} ${chalk.cyan('teampulse chat')} ${chalk.dim('to explore this meeting interactively.')}\n`);

  if (output) {
    writeFileSync(output, JSON.stringify({ meetingId, ...analysis }, null, 2));
    printSuccess(`Output also saved to ${output}`);
  }
}

function sentimentBadge(sentiment) {
  const map = {
    positive: chalk.green('● positive'),
    negative: chalk.red('● negative'),
    neutral: chalk.dim('● neutral'),
    mixed: chalk.yellow('● mixed')
  };
  return map[sentiment] || chalk.dim('● unknown');
}

function toMarkdown(id, a, skill) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const unassigned = (a.tasks || []).filter(t => !t.owner);

  const lines = [
    '---',
    `title: "${(a.title || 'Meeting Notes').replace(/"/g, "'")}"`,
    `date: ${dateStr}`,
    `skill: ${skill || 'product-manager'}`,
    `meeting_id: ${id}`,
    `sentiment: ${a.sentiment || 'unknown'}`,
    `analyzed_at: ${now.toISOString()}`,
    '---',
    '',
    `# ${a.title || 'Meeting Notes'}`,
    '',
    `> **Meeting ID:** \`${id}\` · **Date:** ${dateStr} · **Skill:** ${skill || 'product-manager'}`,
    '',
  ];

  if (unassigned.length > 0) {
    lines.push('> [!WARNING]');
    lines.push(`> **⚠ ${unassigned.length} unassigned task(s)** — these need an owner before next sprint.`);
    unassigned.forEach(t => lines.push(`> - ${t.description}`));
    lines.push('');
  }

  lines.push('## Summary', '', a.summary || '', '');

  if (a.decisions?.length) {
    lines.push('## Decisions', '');
    a.decisions.forEach(d => {
      lines.push(
        `### ${d.title}`,
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| **Owner** | ${d.owner || '⚠ unassigned'} |`,
        `| **Status** | ${d.status} |`,
        '',
        d.context,
        ''
      );
    });
  }

  if (a.tasks?.length) {
    lines.push('## Tasks', '');
    const byPriority = { high: [], medium: [], low: [] };
    a.tasks.forEach(t => (byPriority[t.priority] || byPriority.low).push(t));

    ['high', 'medium', 'low'].forEach(p => {
      if (!byPriority[p].length) return;
      lines.push(`### ${p.charAt(0).toUpperCase() + p.slice(1)} Priority`, '');
      byPriority[p].forEach(t => {
        const owner = t.owner ? `@${t.owner.split(' ')[0].toLowerCase()}` : '⚠ unassigned';
        const deadline = t.deadline ? ` · due ${t.deadline}` : '';
        lines.push(`- [${t.done ? 'x' : ' '}] ${t.description} — **${owner}**${deadline}`);
      });
      lines.push('');
    });
  }

  if (a.risks?.length) {
    lines.push('## Risks', '');
    a.risks.forEach(r => {
      const emoji = r.level === 'high' ? '🔴' : r.level === 'medium' ? '🟡' : '🟢';
      lines.push(`- ${emoji} **[${r.level.toUpperCase()}]** ${r.description}`);
      if (r.mitigation) lines.push(`  - *Mitigation:* ${r.mitigation}`);
    });
    lines.push('');
  }

  if (a.openQuestions?.length) {
    lines.push('## Open Questions', '');
    a.openQuestions.forEach(q => lines.push(`- [ ] ${q}`));
    lines.push('');
  }

  if (a.participants?.length) {
    lines.push('## Participants', '', a.participants.join(', '), '');
  }

  if (a.keyTopics?.length) {
    lines.push('## Key Topics', '', a.keyTopics.map(t => `\`${t}\``).join(' · '), '');
  }

  lines.push(
    '---',
    `*Generated by TeamPulse · ${now.toUTCString()}*`
  );

  return lines.join('\n');
}
