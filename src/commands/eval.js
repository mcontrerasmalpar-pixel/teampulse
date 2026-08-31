// @ts-check
import { readFile } from 'node:fs/promises';
import { analyze } from '../services/provider.js';
import { scoreCase, aggregateScores } from '../eval/score.js';
import { buildDataset } from '../../evals/cases.js';

export async function loadDataset(datasetPath) {
  if (!datasetPath) return buildDataset();
  const raw = await readFile(datasetPath, 'utf-8');
  const dataset = JSON.parse(raw);
  return { cases: Array.isArray(dataset.cases) ? dataset.cases : dataset };
}

export async function runEval(datasetPath, options = {}) {
  const provider = options.provider || 'fixture';
  const dataset = await loadDataset(datasetPath);
  const cases = Array.isArray(dataset.cases) ? dataset.cases : dataset;

  const rows = [];
  for (const item of cases) {
    const predicted = await analyze(item.transcript, provider);
    const scores = scoreCase(predicted, item.expected);
    rows.push({ id: item.id, scores, predicted });
  }

  return { summary: aggregateScores(rows.map((r) => r.scores)), rows };
}

export async function evalCommand(options = {}) {
  const minPrecision = options.minPrecision != null ? Number(options.minPrecision) : 0.7;
  const result = await runEval(options.dataset, options);

  console.log(`Eval cases: ${result.summary.cases}`);
  console.log(`Precision (tasks+owners+decisions): ${result.summary.precision.toFixed(3)}`);
  console.log(`Tasks P/R/F1: ${fmt(result.summary.tasks)}`);
  console.log(`Owners P/R/F1: ${fmt(result.summary.owners)}`);
  console.log(`Decisions P/R/F1: ${fmt(result.summary.decisions)}`);

  if (result.summary.precision < minPrecision) {
    console.error(`Precision ${result.summary.precision.toFixed(3)} < min ${minPrecision}`);
    process.exitCode = 1;
  }
  return result;
}

function fmt(metric) {
  return `${metric.precision.toFixed(3)}/${metric.recall.toFixed(3)}/${metric.f1.toFixed(3)}`;
}

export function registerEvalCommand(cli) {
  cli
    .command('eval')
    .description('Measure extraction precision against a gold transcript dataset')
    .option('--dataset <path>', 'Optional JSON dataset (defaults to bundled gold set)')
    .option('-p, --provider <name>', 'Provider (use fixture in CI)', 'fixture')
    .option('--min-precision <n>', 'Fail below this overall precision', '0.7')
    .action(async (options) => {
      await evalCommand({
        dataset: options.dataset,
        provider: options.provider,
        minPrecision: options.minPrecision,
      });
    });
}

export default { runEval, evalCommand, registerEvalCommand };
