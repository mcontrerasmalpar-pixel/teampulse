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

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(makeAbortError());
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function makeAbortError() {
  const e = new Error('Operacion cancelada');
  e.code = 'EABORTED';
  e.isRetryable = false;
  return e;
}

/**
 * @param {ProviderConfig} provider
 * @param {string} apiKey
 * @param {string} input
 * @param {AbortSignal} [externalSignal]
 * @returns {Promise<AnalysisResult>}
 */
async function callProviderOnce(provider, apiKey, input, externalSignal) {
  const url = provider.buildUrl(apiKey);
  const headers = {
    'Content-Type': 'application/json',
    ...provider.buildHeaders(apiKey),
  };
  const payload = provider.buildPayload(input);

  const timeoutMs = provider.name === 'ollama' ? 120000 : 90000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = combineSignals(externalSignal, timeoutSignal);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      const e = new Error(`Timeout: el proveedor no respondio en ${timeoutMs / 1000}s`);
      e.code = 'ETIMEDOUT';
      e.isRetryable = true;
      throw e;
    }
    if (err.name === 'AbortError') {
      throw makeAbortError();
    }
    const e = new Error(`Error de red: ${err.message}`);
    e.code = 'ENETWORK';
    e.isRetryable = true;
    throw e;
  }

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    error.status = response.status;

    if (response.status === 401 || response.status === 403) {
      error.isRetryable = false;
      error.message = `API key invalida, expirada o sin permisos (${provider.apiKeyEnv}). Verifica la variable de entorno.`;
    } else if (response.status === 429) {
      error.isRetryable = true;
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        error.retryAfterMs = parseRetryAfter(retryAfter);
      }
    } else if (response.status >= 500 && response.status < 600) {
      error.isRetryable = true;
    } else {
      error.isRetryable = false;
    }

    throw error;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const e = new Error(`Respuesta no es JSON valido: ${text.slice(0, 200)}`);
    e.code = 'EINVALIDJSON';
    e.isRetryable = false;
    throw e;
  }

  const rawText = provider.extractText(data);
  return parseAnalysisFromText(rawText);
}

/**
 * @param {string} retryAfter
 * @returns {number}
 */
function parseRetryAfter(retryAfter) {
  const n = parseInt(retryAfter, 10);
  if (!Number.isNaN(n)) {
    return n * 1000;
  }
  const retryDate = new Date(retryAfter);
  if (!isNaN(retryDate.getTime())) {
    return Math.max(0, retryDate.getTime() - Date.now());
  }
  return 5000;
}

/**
 * @param {any} err
 * @returns {boolean}
 */
function classifyHttpError(err) {
  if (!err) return false;
  if (typeof err.isRetryable === 'boolean') {
    return err.isRetryable;
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ENETWORK') {
    return true;
  }
  if (err.status === 429 || (err.status >= 500 && err.status < 600)) {
    return true;
  }
  return false;
}

/**
 * @param {AbortSignal} [signal1]
 * @param {AbortSignal} [signal2]
 * @returns {AbortSignal}
 */
function combineSignals(signal1, signal2) {
  if (!signal1) return signal2;
  if (!signal2) return signal1;

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal1.aborted || signal2.aborted) {
    controller.abort();
  } else {
    signal1.addEventListener('abort', abort, { once: true });
    signal2.addEventListener('abort', abort, { once: true });
  }

  return controller.signal;
}

/**
 * @param {string} text
 * @returns {AnalysisResult}
 */
function parseAnalysisFromText(text) {
  const parsed = parseJSON(text);
  const normalized = normalizeAnalysis(parsed);

  const result = AnalysisSchema.safeParse(normalized);
  if (!result.success) {
    const e = new Error(`Esquema invalido: ${result.error.message}`);
    e.code = 'ESCHEMA';
    e.isRetryable = false;
    throw e;
  }

  return result.data;
}

/**
 * @param {any} raw
 * @returns {object}
 */
function normalizeAnalysis(raw) {
  const hasTasks = Array.isArray(raw.tasks);
  const hasActionItems = Array.isArray(raw.action_items);

  const tasks = hasTasks
    ? raw.tasks.map(t => ({
        title: String(t.title || ''),
        description: String(t.description || ''),
        priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
        owner: t.owner ? String(t.owner) : null,
        dueDate: t.dueDate ? String(t.dueDate) : null,
      }))
    : hasActionItems
    ? raw.action_items.map(t => ({
        title: String(t.title || ''),
        description: String(t.description || ''),
        priority: 'medium',
        owner: null,
        dueDate: null,
      }))
    : [];

  const risks = Array.isArray(raw.risks)
    ? raw.risks.map(r => ({
        title: String(r.title || ''),
        description: String(r.description || ''),
      }))
    : [];

  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions.map(d => ({
        title: String(d.title || ''),
        description: String(d.description || ''),
      }))
    : [];

  const action_items = hasActionItems
    ? raw.action_items.map(a => ({
        title: String(a.title || ''),
        description: String(a.description || ''),
      }))
    : hasTasks
    ? raw.tasks.map(t => ({ title: String(t.title || ''), description: String(t.description || '') }))
    : [];

  return {
    summary: String(raw.summary || ''),
    tasks,
    risks,
    decisions,
    action_items,
  };
}

/**
 * @returns {Record<string, ProviderConfig>}
 */
function getProviders() {
  return {
    gemini: {
      name: 'gemini',
      apiKeyEnv: 'GEMINI_API_KEY',
      buildUrl: apiKey =>
        `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
      buildHeaders: () => ({}),
      buildPayload: input => ({
        contents: [{ parts: [{ text: buildSystemPrompt() + '\n\n' + input }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
      extractText: data => data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
    },
    ollama: {
      name: 'ollama',
      apiKeyEnv: '',
      buildUrl: () => (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') + '/api/chat',
      buildHeaders: () => ({}),
      buildPayload: input => ({
        model: process.env.OLLAMA_MODEL || 'mistral',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: input },
        ],
        stream: false,
        format: 'json',
      }),
      extractText: data => data?.message?.content || data?.response || '',
    },
    anthropic: {
      name: 'anthropic',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      buildUrl: () => 'https://api.anthropic.com/v1/messages',
      buildHeaders: apiKey => ({
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }),
      buildPayload: input => ({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: input }],
      }),
      extractText: data => data?.content?.[0]?.text || '',
    },
    openai: {
      name: 'openai',
      apiKeyEnv: 'OPENAI_API_KEY',
      buildUrl: () => 'https://api.openai.com/v1/chat/completions',
      buildHeaders: apiKey => ({ Authorization: `Bearer ${apiKey}` }),
      buildPayload: input => ({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: input },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      extractText: data => data?.choices?.[0]?.message?.content || '',
    },
    mistral: {
      name: 'mistral',
      apiKeyEnv: 'MISTRAL_API_KEY',
      buildUrl: () => 'https://api.mistral.ai/v1/chat/completions',
      buildHeaders: apiKey => ({ Authorization: `Bearer ${apiKey}` }),
      buildPayload: input => ({
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: input },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      extractText: data => data?.choices?.[0]?.message?.content || '',
    },
  };
}

function buildSystemPrompt() {
  return `Eres un asistente de analisis de reuniones. Extrae: summary, tasks (action_items), risks, decisions.
Responde SOLO con JSON valido con esta estructura:
{
  "summary": "...",
  "tasks": [{"title":"...","description":"...","priority":"high|medium|low","owner":"...","dueDate":"YYYY-MM-DD"}],
  "risks": [{"title":"...","description":"..."}],
  "decisions": [{"title":"...","description":"..."}],
  "action_items": [{"title":"...","description":"..."}]
}`;
}

export default { analyze };
