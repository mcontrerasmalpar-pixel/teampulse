// @ts-check
import { parseJSON } from '../utils/parseJSON.js';
import { AnalysisSchema } from '../utils/schema.js';

/**
 * @param {string} input
 * @param {string} providerName
 * @param {AbortSignal} [externalSignal]
 * @param {{fallbackProvider?: string}} [options]
 */
export async function analyzePaid(input, providerName = 'gemini', externalSignal, options = {}) {
  const names = [providerName, options.fallbackProvider].filter(Boolean);
  let lastError;
  for (const name of names) {
    try {
      return await callOnce(name, input, externalSignal);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Provider failed');
}

async function callOnce(name, input, externalSignal) {
  const spec = specFor(name);
  const apiKey = spec.env ? process.env[spec.env] : 'none';
  if (spec.env && !process.env[spec.env]) {
    const err = new Error(`Falta variable de entorno: ${spec.env}`);
    throw err;
  }
  const timeoutMs = name === 'ollama' ? 120000 : 90000;
  const signal = externalSignal || AbortSignal.timeout(timeoutMs);
  const response = await fetch(spec.url(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...spec.headers(apiKey) },
    body: JSON.stringify(spec.payload(input)),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  const raw = spec.extract(data);
  const parsed = parseJSON(raw);
  const result = AnalysisSchema.safeParse({
    summary: String(parsed.summary || ''),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
  });
  if (!result.success) throw new Error(`Esquema invalido: ${result.error.message}`);
  return result.data;
}

function prompt() {
  return 'Eres un asistente de analisis de reuniones. Responde SOLO JSON con summary, tasks, risks, decisions, action_items.';
}

function specFor(name) {
  const catalog = {
    gemini: {
      env: 'GEMINI_API_KEY',
      url: (key) =>
        `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${key}`,
      headers: () => ({}),
      payload: (input) => ({
        contents: [{ parts: [{ text: prompt() + '\n\n' + input }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      extract: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
    },
    ollama: {
      env: '',
      url: () => (process.env.OLLAMA_BASE_URL || 'http://localhost:11434') + '/api/chat',
      headers: () => ({}),
      payload: (input) => ({
        model: process.env.OLLAMA_MODEL || 'mistral',
        messages: [
          { role: 'system', content: prompt() },
          { role: 'user', content: input },
        ],
        stream: false,
        format: 'json',
      }),
      extract: (data) => data?.message?.content || data?.response || '',
    },
    anthropic: {
      env: 'ANTHROPIC_API_KEY',
      url: () => 'https://api.anthropic.com/v1/messages',
      headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
      payload: (input) => ({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: prompt(),
        messages: [{ role: 'user', content: input }],
      }),
      extract: (data) => data?.content?.[0]?.text || '',
    },
    openai: {
      env: 'OPENAI_API_KEY',
      url: () => 'https://api.openai.com/v1/chat/completions',
      headers: (key) => ({ Authorization: `Bearer ${key}` }),
      payload: (input) => ({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: prompt() },
          { role: 'user', content: input },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      extract: (data) => data?.choices?.[0]?.message?.content || '',
    },
    mistral: {
      env: 'MISTRAL_API_KEY',
      url: () => 'https://api.mistral.ai/v1/chat/completions',
      headers: (key) => ({ Authorization: `Bearer ${key}` }),
      payload: (input) => ({
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        messages: [
          { role: 'system', content: prompt() },
          { role: 'user', content: input },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      extract: (data) => data?.choices?.[0]?.message?.content || '',
    },
  };
  return catalog[name] || catalog.gemini;
}

export default { analyzePaid };
