// @ts-check
import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
import { analyze } from '../services/provider.js';
import { hashFile, getCache, saveCache } from '../utils/cache.js';
import { addMeeting } from '../utils/memory.js';
import { normalizeTranscript, detectTranscriptFormat } from '../utils/transcript.js';
import ora from 'ora';

/**
 * @param {string} dir
 * @param {object} options
 * @param {number} [options.concurrency=2]
 * @param {string} [options.provider='gemini']
 * @param {string} [options.fallbackProvider]
 * @param {string} [options.fallbackModel]
 */
export async function batchCommand(dir, options = {}) {
  const concurrency = options.concurrency ?? 2;
  const providerName = options.provider || 'gemini';
  const fallbackProvider = options.fallbackProvider;
  const fallbackModel = options.fallbackModel;

  const spinner = ora('Escaneando archivos').start();

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile())
    .map(e => join(dir, e.name))
    .filter(f => /\.(txt|srt|vtt)$/i.test(f));

  if (files.length === 0) {
    spinner.fail('No se encontraron archivos .txt, .srt o .vtt');
    return;
  }

  spinner.text = `${files.length} archivos encontrados`;

  const queue = [...files];
  const running = [];
  const results = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrency && queue.length > 0) {
      const file = queue.shift();
      const promise = processFile(file, providerName, fallbackProvider, fallbackModel)
        .then(res => {
          results.push({ file, ...res });
        })
        .catch(err => {
          results.push({ file, error: err.message });
        })
        .finally(() => {
          const idx = running.indexOf(promise);
          if (idx !== -1) running.splice(idx, 1);
        });
      running.push(promise);
    }

    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  spinner.stop();

  console.log('\nResultados:');
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${basename(r.file)}: ${r.error}`);
    } else {
      console.log(`✅ ${basename(r.file)}: ${r.summary ? r.summary.slice(0, 60) : 'OK'}`);
    }
  }
}

/**
 * @param {string} file
 * @param {string} providerName
 * @param {string} [fallbackProvider]
 * @param {string} [fallbackModel]
 * @returns {Promise<{summary: string}>}
 */
async function processFile(file, providerName, fallbackProvider, fallbackModel) {
  const content = await fs.readFile(file, 'utf-8');
  const format = detectTranscriptFormat(file);
  const normalized = normalizeTranscript(content, format);

  const hash = await hashFile(Buffer.from(normalized, 'utf-8'));
  const cached = await getCache(hash);

  if (cached) {
    await addMeeting(file, hash, cached.summary);
    return { summary: cached.summary };
  }

  const result = await analyze(normalized, providerName, undefined, { fallbackProvider, fallbackModel });
  await saveCache(hash, result);
  await addMeeting(file, hash, result.summary);

  return { summary: result.summary };
}

export function registerBatchCommand(cli) {
  cli
    .command('batch <dir>')
    .description('Analiza múltiples transcripciones en un directorio')
    .option('-c, --concurrency <n>', 'Archivos procesados en paralelo', '2')
    .option('-p, --provider <name>', 'Proveedor de IA', 'gemini')
    .option('--fallback-provider <name>', 'Proveedor secundario')
    .option('--fallback-model <model>', 'Modelo del proveedor secundario')
    .action((dir, options) => {
      const concurrency = parseInt(options.concurrency, 10);
      batchCommand(dir, { ...options, concurrency });
    });
}

export default { batchCommand, registerBatchCommand };
