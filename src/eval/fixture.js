// @ts-check
import { AnalysisSchema } from '../utils/schema.js';

export function fixtureAnalyze(transcript) {
  const tasks = [];
  const risks = [];
  const decisions = [];
  let summary = '';

  const lines = String(transcript || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    const task = line.match(/^TASK:\s*(.+)$/i);
    if (task) {
      const parts = task[1].split('|').map((p) => p.trim());
      const title = parts[0];
      let owner = null;
      let priority = 'medium';
      for (const part of parts.slice(1)) {
        const [k, v] = part.split('=').map((s) => s.trim());
        if (/^owner$/i.test(k) && v) owner = v;
        if (/^priority$/i.test(k) && /^(high|medium|low)$/i.test(v)) priority = v.toLowerCase();
      }
      if (title) tasks.push({ title, description: '', priority, owner, dueDate: null });
      continue;
    }
    const risk = line.match(/^RISK:\s*(.+)$/i);
    if (risk) {
      risks.push({ title: risk[1].trim(), description: '' });
      continue;
    }
    const decision = line.match(/^DECISION:\s*(.+)$/i);
    if (decision) {
      decisions.push({ title: decision[1].trim(), description: '' });
      continue;
    }
    const sum = line.match(/^SUMMARY:\s*(.+)$/i);
    if (sum) summary = sum[1].trim();
  }

  if (!summary) {
    summary = tasks[0]?.title ? `Meeting covering ${tasks[0].title}` : 'Meeting notes';
  }

  return AnalysisSchema.parse({
    summary,
    tasks,
    risks,
    decisions,
    action_items: tasks.map((t) => ({ title: t.title, description: t.description })),
  });
}

export default { fixtureAnalyze };
