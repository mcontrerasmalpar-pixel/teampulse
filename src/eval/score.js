// @ts-check

export function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function labelsMatch(a, b) {
  const left = normalizeLabel(a);
  const right = normalizeLabel(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function scoreTitles(predicted, expected) {
  const pred = Array.isArray(predicted) ? predicted : [];
  const gold = Array.isArray(expected) ? expected : [];
  let hits = 0;
  const used = new Set();
  for (const item of pred) {
    const idx = gold.findIndex((g, i) => !used.has(i) && labelsMatch(item.title, g.title));
    if (idx !== -1) {
      used.add(idx);
      hits += 1;
    }
  }
  const precision = pred.length === 0 ? (gold.length === 0 ? 1 : 0) : hits / pred.length;
  const recall = gold.length === 0 ? (pred.length === 0 ? 1 : 0) : hits / gold.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { hits, predicted: pred.length, expected: gold.length, precision, recall, f1 };
}

export function scoreOwners(predicted, expected) {
  const gold = (Array.isArray(expected) ? expected : []).filter((t) => t.owner);
  const pred = (Array.isArray(predicted) ? predicted : []).filter((t) => t.owner);
  let hits = 0;
  const used = new Set();
  for (const item of pred) {
    const idx = gold.findIndex(
      (g, i) => !used.has(i) && labelsMatch(item.title, g.title) && labelsMatch(item.owner, g.owner)
    );
    if (idx !== -1) {
      used.add(idx);
      hits += 1;
    }
  }
  const precision = pred.length === 0 ? (gold.length === 0 ? 1 : 0) : hits / pred.length;
  const recall = gold.length === 0 ? (pred.length === 0 ? 1 : 0) : hits / gold.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { hits, predicted: pred.length, expected: gold.length, precision, recall, f1 };
}

export function scoreCase(predicted, expected) {
  const tasks = scoreTitles(predicted.tasks, expected.tasks);
  const owners = scoreOwners(predicted.tasks, expected.tasks);
  const decisions = scoreTitles(predicted.decisions, expected.decisions);
  const risks = scoreTitles(predicted.risks, expected.risks);
  const precision = (tasks.precision + owners.precision + decisions.precision) / 3;
  return { tasks, owners, decisions, risks, precision };
}

export function aggregateScores(rows) {
  const n = rows.length || 1;
  const avg = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / n;
  return {
    cases: rows.length,
    precision: avg((r) => r.precision),
    tasks: {
      precision: avg((r) => r.tasks.precision),
      recall: avg((r) => r.tasks.recall),
      f1: avg((r) => r.tasks.f1),
    },
    owners: {
      precision: avg((r) => r.owners.precision),
      recall: avg((r) => r.owners.recall),
      f1: avg((r) => r.owners.f1),
    },
    decisions: {
      precision: avg((r) => r.decisions.precision),
      recall: avg((r) => r.decisions.recall),
      f1: avg((r) => r.decisions.f1),
    },
  };
}

export default { normalizeLabel, labelsMatch, scoreTitles, scoreOwners, scoreCase, aggregateScores };
