// @ts-check
import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import { program } from 'commander';
import { analyze } from '../services/provider.js';
import { hashFile, getCache, saveCache } from '../utils/cache.js';
import { addMeeting } from '../utils/memory.js';
import { normalizeTranscript, detectTranscriptFormat } from '../utils/transcript.js';
import ora from 'ora';

/**
 * @param {string} file
 * @param {object} options
 * @param {string} [options.provider='gemini']
 * @param {string} [options.fallbackProvider]
 * @param {string} [options.fallbackModel]
 */
export async function analyzeCommand(file, options = {}) {
  const providerName = options.provider || 'gemini';
  const fallbackProvider = options.fallbackProvider;
  const fallbackModel = options.fallbackModel;

  const spinner = ora('Leyendo transcripcion').start();

  const content = await fs.readFile(file, 'utf-8');
  const format = detectTranscriptFormat(file);
  const normalized = normalizeTranscript(content, format);

  spinner.text = 'Calculando hash';
  const hash = await hashFile(Buffer.from(normalized, 'utf-8'));

  spinner.text = 'Buscando en cache local';
  const cached = await getCache(hash);

  if (cached) {
    spinner.succeed('Resultado recuperado de cache local');
    await addMeeting(file, hash, cached.summary);
    console.log('\nResumen:', cached.summary);
    return;
  }

  spinner.text = `Llamando a ${providerName}`;

  const abortController = new AbortController();
  process.once('SIGINT', () => abortController.abort());
  process.once('SIGTERM', () => abortController.abort());

  let result;
  try {
    result = await analyze(normalized, providerName, abortController.signal, {
      fallbackProvider,
      fallbackModel,
    });
  } catch (err) {
    spinner.fail(`Error del proveedor: ${err.message}`);
    throw err;
  }

  spinner.text = 'Guardando resultado';

  await saveCache(hash, result);
  await addMeeting(file, hash, result.summary);

  spinner.succeed('Analisis completado');

  console.log('\nResumen:', result.summary);

  if (result.tasks && result.tasks.length > 0) {
    console.log('\nTareas:');
    for (const t of result.tasks) {
      const prio = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${prio} ${t.title}${t.owner ? ` (@${t.owner})` : ''}`);
    }
  }

  if (result.risks && result.risks.length > 0) {
    console.log('\nRiesgos:');
    for (const r of result.risks) {
      console.log(`⚠️ ${r.title}`);
    }
  }

  if (result.decisions && result.decisions.length > 0) {
    console.log('\nDecisiones:');
    for (const d of result.decisions) {
      console.log(`✅ ${d.title}`);
    }
  }
}

export function registerAnalyzeCommand(cli) {
  cli
    .command('analyze <file>')
    .description('Analiza una transcripcion de reunion')
    .option('-p, --provider <name>', 'Proveedor de IA (gemini, ollama, anthropic, openai, mistral)', 'gemini')
    .option('--fallback-provider <name>', 'Proveedor secundario si el principal falla')
    .option('--fallback-model <model>', 'Modelo del proveedor secundario')
    .action((file, options) => analyzeCommand(file, options));
}

export default { analyzeCommand, registerAnalyzeCommand };
