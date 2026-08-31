// @ts-check
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../services/provider.js';
import { scoreCase, aggregateScores } from '../eval/score.js';

const DEFAULT_DATASET = join(dirname(fileURLToPath(import.meta.url)), '../../evals/dataset.json');

export async function runEval(datasetPath = DEFAULT_DATASET, options = {}) {
  const provider = options.provider || 'fixture';
  const raw = await readFile(datasetPath, 'utf-8');
  const dataset = JSON.parse(raw);
  const cases = Array.isArray(dataset.cases) ? dataset.cases : dataset;

  const rows = [];
  for (const item of cases) {
    const predicted = await analyze(item.transcript, provider);
    const scores = scoreCase(predicted, item.expected);
    rows.push({ id: item.id, scores, predicted });
  }

  const summary = aggregateScores(rows.map((r) => r.scores));
  return { summary, rows };
}

export async function evalCommand(options = {}) {
  const dataset = options.dataset || DEFAULT_DATASET;
  const minPrecision = options.minPrecision != null ? Number(options.minPrecision) : 0.7;
  const result = await runEval(dataset, options);

  console.log(`Eval cases: ${result.summary.cases}`);
  console.log(`Precision (tasks+owners+decisions): ${result.summary.precision.toFixed(3)}`);
  console.log(`Tasks P/R/F1: ${fmt(result.summary.tasks)}`);
  console.log(`Owners P/R/F1: ${fmt(result.summary.owners)}`);
  console.log(`Decisions P/R/F1: ${fmt(result.summary.decisions)}`);

  if (result.summary.precision < minPrecision) {
    console.error(`Precision ${result.summary.precision.toFixed(3)} < min ${minPrecision}`);
    process.exitCode = 1;
    return result;
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
    .option('--dataset <path>', 'Path to eval dataset JSON')
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
