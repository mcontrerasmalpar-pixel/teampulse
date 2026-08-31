// @ts-check
import { describe, it, expect } from 'vitest';
import { runEval } from '../src/commands/eval.js';
import { fixtureAnalyze } from '../src/eval/fixture.js';
import { scoreCase } from '../src/eval/score.js';

describe('evals', () => {
  it('fixture provider scores the gold dataset without paid APIs', async () => {
    const result = await runEval(undefined, { provider: 'fixture' });
    expect(result.summary.cases).toBe(24);
    expect(result.summary.precision).toBeGreaterThanOrEqual(0.99);
    expect(result.summary.tasks.f1).toBeGreaterThanOrEqual(0.99);
    expect(result.summary.owners.f1).toBeGreaterThanOrEqual(0.99);
    expect(result.summary.decisions.f1).toBeGreaterThanOrEqual(0.99);
  });

  it('scores partial owner misses', () => {
    const predicted = fixtureAnalyze('TASK: Fix login | owner=wrong | priority=high\nDECISION: Ship it\n');
    const scores = scoreCase(predicted, {
      tasks: [{ title: 'Fix login', owner: 'alice' }],
      decisions: [{ title: 'Ship it' }],
      risks: [],
    });
    expect(scores.tasks.precision).toBe(1);
    expect(scores.owners.precision).toBe(0);
    expect(scores.decisions.precision).toBe(1);
  });
});
