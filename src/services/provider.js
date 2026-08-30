// @ts-check
import { config } from '../config/index.js';

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
 * @property {string} url
 * @property {Record<string, string>} [headers]
 * @property {(input: string) => object} buildPayload
 */

/**
 * @param {string} input
 * @param {string} providerName
 * @param {AbortSignal} [abortSignal]
 * @param {{fallbackProvider?: string, fallbackModel?: string}} [options]
 * @returns {Promise<AnalysisResult>}
 */
export async function analyze(input, providerName = 'gemini', abortSignal, options = {}) {
  const providers = getProviders();
  const primary = providers[providerName] || providers.gemini;

  if (!primary) {
    throw new Error(`Proveedor "${providerName}" no existe. Usa: ${Object.keys(providers).join(', ')}`);
  }

  const apiKey = process.env[primary.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Falta variable de entorno: ${primary.apiKeyEnv}`);
  }

  const maxRetries = providerName === 'ollama' ? 0 : 3;
  const baseDelay = 1000;

  let lastError = null;
  let currentProvider = primary;
  let currentProviderName = providerName;
  let attempts = 0;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const result = await callProviderOnce(currentProvider, apiKey, input, abortSignal);
      return result;
    } catch (err) {
      lastError = err;

      const isRetryable = classifyHttpError(err);

      if (!isRetryable) {
        throw err;
      }

      if (attempts > maxRetries) {
        if (options.fallbackProvider && options.fallbackProvider !== currentProviderName) {
          const fallback = providers[options.fallbackProvider];
          if (fallback) {
            currentProvider = fallback;
            currentProviderName = options.fallbackProvider;
            attempts = 0;
            lastError = null;
            continue;
          }
        }
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempts - 1), 8000);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw lastError || new Error('Proveedor de IA falló¬¬¬ tras múltiples intentos');
}

/**
 * @param {ProviderConfig} provider
 * @param {string} apiKey
 * @param {string} input
 * @param {AbortSignal} [abortSignal]
 * @returns {Promise<AnalysisResult>}
 */
async function callProviderOnce(provider, apiKey, input, abortSignal) {
  const url = provider.url.replace('{API_KEY}', apiKey);
  const payload = provider.buildPayload(input);

  const headers = {
    'Content-Type': 'application/json',
    ...(provider.headers || {}),
  };

  if (provider.apiKeyEnv === 'GEMINI_API_KEY') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const controller = abortSignal ? null : new AbortController();
  const signal = abortSignal || controller?.signal;

  const timeoutMs = provider.name === 'ollama' ? 120000 : 90000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  const combinedSignal = combineSignals(signal, timeoutSignal);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: combinedSignal,
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const e = new Error(`Timeout: el proveedor no respondió en ${timeoutMs / 1000}s`);
      e.code = 'ETIMEDOUT';
      e.isRetryable = true;
      throw e;
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
    error.headers = Object.fromEntries(response.headers.entries());

    if (response.status === 401 || response.status === 403) {
      error.isRetryable = false;
      error.message = `API key invá¬¬lida, expirada o sin permisos (${provider.apiKeyEnv}). Verifica la variable de entorno.`;
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
    const e = new Error(`Respuesta no es JSON vá- lido: ${text.slice(0, 200)}`);
    e.code = 'EINVALIDJSON';
    e.isRetryable = false;
    throw e;
  }

  const result = extractAnalysisFromProviderResponse(data, provider.name);
  return result;
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
    return retryDate.getTime() - Date.now();
  }
  return 5000;
}

/**
 * @param {Error} err
 * @returns {boolean}
 */
function classifyHttpError(err) {
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

  signal1.addEventListener('abort', abort, { once: true });
  signal2.addEventListener('abort', abort, { once: true });

  return controller.signal;
}

/**
 * @param {object} data
 * @param {string} providerName
 * @returns {AnalysisResult}
 */
function extractAnalysisFromProviderResponse(data, providerName) {
  if (providerName === 'gemini') {
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAnalysisFromText(text);
  }

  if (providerName === 'ollama') {
    const text = data?.message?.content || data?.response || '';
    return parseAnalysisFromText(text);
  }

  if (providerName === 'anthropic') {
    const text = data?.content?.[0]?.text || '';
    return parseAnalysisFromText(text);
  }

  if (providerName === 'openai') {
    const text = data?.choices?.[0]?.message?.content || '';
    return parseAnalysisFromText(text);
  }

  if (providerName === 'mistral') {
    const text = data?.choices?.[0]?.message?.content || '';
    return parseAnalysisFromText(text);
  }

  const text = JSON.stringify(data);
  return parseAnalysisFromText(text);
}

/**
 * @param {string} text
 * @returns {AnalysisResult}
 */
function parseAnalysisFromText(text) {
  const { parseJSON } = await import('../utils/parseJSON.js');
  const parsed = parseJSON(text);

  const normalized = normalizeAnalysis(parsed);

  const { AnalysisSchema } = await import('../utils/schema.js');
  const result = AnalysisSchema.safeParse(normalized);
  if (!result.success) {
    const e = new Error(`Esquema invá¬¬lido: ${result.error.message}`);
    e.code = 'ESCHEMA';
    e.isRetryable = false;
    throw e;
  }

  return result.data;
}

/**
 * @param {any} raw
 * @returns {AnalysisResult}
 */
function normalizeAnalysis(raw) {
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map(t => ({
        title: String(t.title || ''),
        description: String(t.description || ''),
        priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
        owner: t.owner ? String(t.owner) : null,
        dueDate: t.dueDate ? String(t.dueDate) : null,
      }))
    : Array.isArray(raw.action_items)
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

  const action_items = Array.isArray(raw.action_items)
    ? raw.action_items
    : Array.isArray(raw.tasks)
    ? raw.tasks.map(t => ({ title: t.title, description: t.description }))
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
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}',
      headers: { 'Content-Type': 'application/json' },
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
    },
    ollama: {
      name: 'ollama',
      apiKeyEnv: 'OLLAMA_API_KEY',
      url: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') + '/api/chat',
      headers: {},
      buildPayload: input => ({
        model: process.env.OLLAMA_MODEL || 'mistral',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: input },
        ],
        stream: false,
        format: 'json',
      }),
    },
    anthropic: {
      name: 'anthropic',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': '{API_KEY}',
        'anthropic-version': '2023-06-01',
      },
      buildPayload: input => ({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: input }],
      }),
    },
    openai: {
      name: 'openai',
      apiKeyEnv: 'OPENAI_API_KEY',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: 'Bearer {API_KEY}',
      },
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
    },
    mistral: {
      name: 'mistral',
      apiKeyEnv: 'MISTRAL_API_KEY',
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: {
        Authorization: 'Bearer {API_KEY}',
      },
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
    },
  };
}

function buildSystemPrompt() {
  return `Eres un asistente de aná¬¬lisis de reuniones. Extrae: summary, tasks (action_items), risks, decisions.
Responde SOLO con JSON vá- lido con esta estructura:
{
  "summary": "...",
  "tasks": [{"title":"...","description":"...","priority":"high|medium|low","owner":"...","dueDate":"YYYY-MM-DD"}],
  "risks": [{"title":"...","description":"..."}],
  "decisions": [{"title":"...","description":"..."}],
  "action_items": [{"title":"...","description":"..."}]
}`;
}

export default { analyze };