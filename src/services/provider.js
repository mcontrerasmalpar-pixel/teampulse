// ── Multi-provider AI service ─────────────────────────────────────────────────────
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseJSON } from '../utils/parseJSON.js';

const PROVIDERS = {
  gemini: {
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    default: 'gemini-2.0-flash',
  },
  claude: {
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    default: 'claude-3-5-sonnet-20241022',
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    default: 'gpt-4o',
  },
  mistral: {
    models: ['mistral-large-latest', 'mixtral-8x7b-instruct', 'mistral-small-latest'],
    default: 'mistral-large-latest',
  },
  ollama: {
    models: ['mistral', 'llama3', 'phi3', 'gemma2', 'qwen2'],
    default: 'mistral',
  },
};

// ── Redact API keys from error messages before surfacing them ───────────────────
const KEY_PATTERN = /([A-Za-z0-9_\-]{20,})/g;
function redactKeys(message = '') {
  const activeKeys = [
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.MISTRAL_API_KEY,
  ].filter(Boolean);

  let safe = message;
  for (const key of activeKeys) {
    if (key && safe.includes(key)) {
      safe = safe.replaceAll(key, `${key.slice(0, 6)}…[REDACTED]`);
    }
  }
  return safe;
}

// ── Retry with exponential backoff ────────────────────────────────────────────
function isRetryable(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('overloaded') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed')
  );
}

async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

export function resolveProvider(providerName = 'gemini', modelOverride = null) {
  const name = providerName.toLowerCase();
  const config = PROVIDERS[name];
  if (!config) throw new Error(
    `Unknown provider: "${name}"\n  Valid providers: gemini | claude | openai | mistral | ollama`
  );
  const model = modelOverride || config.default;
  return { name, model };
}

async function _callOnce(provider, model, prompt, opts = {}) {
  const { jsonMode = false, temperature = 0.2, maxTokens = 4096 } = opts;

  // ── Gemini ──────────────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
  }

  // ── Claude ───────────────────────────────────────────────────────────────────
  if (provider === 'claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0].text;
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    return completion.choices[0].message.content;
  }

  // ── Mistral ───────────────────────────────────────────────────────────────────
  if (provider === 'mistral') {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error('MISTRAL_API_KEY not set');
    const { Mistral } = await import('@mistralai/mistralai');
    const client = new Mistral({ apiKey });
    const response = await client.chat.complete({
      model,
      temperature,
      messages: [{ role: 'user', content: prompt }],
      ...(jsonMode ? { responseFormat: { type: 'json_object' } } : {}),
    });
    return response.choices[0].message.content;
  }

  // ── Ollama (local) ────────────────────────────────────────────────────────────
  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404) throw new Error(
        `Ollama model "${model}" not found.\n  Run: ollama pull ${model}`
      );
      throw new Error(`Ollama error ${res.status}: ${text || 'check that ollama serve is running'}`);
    }
    const data = await res.json();
    return data.message?.content ?? '';
  }

  throw new Error(`Provider "${provider}" not implemented. Valid: gemini | claude | openai | mistral | ollama`);
}

export async function callProvider(provider, model, prompt, opts = {}) {
  try {
    return await withRetry(() => _callOnce(provider, model, prompt, opts));
  } catch (err) {
    const safeMessage = redactKeys(err.message);
    if (safeMessage !== err.message) throw new Error(safeMessage);
    throw err;
  }
}

// parseJSON re-exported so callers don't need a separate import
export { parseJSON } from '../utils/parseJSON.js';

export function getProviderLabel(provider, model) {
  const labels = {
    gemini:  '✦ Gemini',
    claude:  '◆ Claude',
    openai:  '⬡ OpenAI',
    mistral: '🌪️ Mistral',
    ollama:  '🦙 Ollama',
  };
  return `${labels[provider] || provider} · ${model}`;
}
