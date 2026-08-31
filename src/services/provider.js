// @ts-check

import { parseJSON } from '../utils/parseJSON.js';
import { AnalysisSchema } from '../utils/schema.js';

/**
 * @typedef {Object} AnalysisResult
 * @property {string} summary
 * @property {Array<{title: string, description: string, priority: 'high'|'medium'|'low', owner?: string|null, dueDate?: string|null}>} tasks
 * @property {Array<{title: string, description: string}>} risks
 * @property {Array<{title: string, description: string}>} decisions
 * @property {Array<{title: string, description: string}>} action_items
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} name
 * @property {string} apiKeyEnv
 * @property {(apiKey: string) => string} buildUrl
 * @property {(apiKey: string) => Record<string, string>} buildHeaders
 * @property {(input: string) => object} buildPayload
 * @property {(data: object) => string} extractText
 */

/**
 * @param {string} input
 * @param {string} providerName
 * @param {AbortSignal} [externalSignal]
 * @param {{fallbackProvider?: string, fallbackModel?: string}} [options]
 * @returns {Promise<AnalysisResult>}
 */
export async function analyze(input, providerName = 'gemini', externalSignal, options = {}) {
  if (providerName === 'fixture') {
    const { fixtureAnalyze } = await import('../eval/fixture.js');
    return fixtureAnalyze(input);
  }

  const providers = getProviders();
  let currentProviderName = providers[providerName] ? providerName : 'gemini';
  let currentProvider = providers[currentProviderName];

  const maxRetries = currentProviderName === 'ollama' ? 0 : 3;
  const baseDelay = 1000;

  let lastError = null;
  let attempts = 0;
  let usedFallback = false;

  while (true) {
    attempts++;

    const apiKey = process.env[currentProvider.apiKeyEnv];
    if (!apiKey && currentProvider.apiKeyEnv) {
      lastError = new Error(`Falta variable de entorno: ${currentProvider.apiKeyEnv}`);
      lastError.isRetryable = false;
    } else {
      try {
        const result = await callProviderOnce(currentProvider, apiKey, input, externalSignal);
        return result;
      } catch (err) {
        lastError = err;
      }
    }

    const isRetryable = classifyHttpError(lastError);

    if (!isRetryable) {
      if (!usedFallback && options.fallbackProvider && options.fallbackProvider !== currentProviderName) {
        const fallback = providers[options.fallbackProvider];
        if (fallback) {
          currentProvider = fallback;
          currentProviderName = options.fallbackProvider;
          usedFallback = true;
          attempts = 0;
          continue;
        }
      }
      throw lastError;
    }

    if (attempts > maxRetries) {
      if (!usedFallback && options.fallbackProvider && options.fallbackProvider !== currentProviderName) {
        const fallback = providers[options.fallbackProvider];
        if (fallback) {
          currentProvider = fallback;
          currentProviderName = options.fallbackProvider;
          usedFallback = true;
          attempts = 0;
          continue;
        }
      }
      throw lastError;
    }

    const retryAfterMs = lastError && lastError.retryAfterMs;
    const backoff = Math.min(baseDelay * Math.pow(2, attempts - 1), 8000);
    const delay = typeof retryAfterMs === 'number' && retryAfterMs > 0 ? retryAfterMs : backoff;

    await sleep(delay, externalSignal);
  }
}
