/**
 * TeamPulse AI Provider Service
 * Handles AI API calls with timeout control, error handling, and fallback support
 */

import { CONFIG } from '../config/skills.js';

/**
 * Custom error class for AI provider errors
 */
export class ProviderError extends Error {
  constructor(message, code, provider, options = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code; // 'TIMEOUT', 'AUTH', 'RATE_LIMIT', 'SERVER', 'NETWORK', 'PARSE'
    this.provider = provider;
    this.retryAfter = options.retryAfter;
    this.originalError = options.originalError;
    this.statusCode = options.statusCode;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
}

/**
 * Handle HTTP errors with granular error codes
 */
function handleHttpError(statusCode, provider, responseText) {
  switch (statusCode) {
    case 401:
    case 403:
      return new ProviderError(
        `Authentication failed for ${provider}. Check API key.`,
        'AUTH',
        provider,
        { statusCode, originalError: responseText }
      );
    
    case 429:
      const retryAfterMatch = responseText?.match(/retry-after[\s:=]+(\d+)/i);
      const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : null;
      return new ProviderError(
        `Rate limit exceeded for ${provider}`,
        'RATE_LIMIT',
        provider,
        { statusCode, retryAfter, originalError: responseText }
      );
    
    case 500:
    case 502:
    case 503:
    case 504:
      return new ProviderError(
        `Server error from ${provider} (${statusCode})`,
        'SERVER',
        provider,
        { statusCode, originalError: responseText }
      );
    
    case 400:
      return new ProviderError(
        `Bad request to ${provider}: ${responseText?.slice(0, 200)}`,
        'BAD_REQUEST',
        provider,
        { statusCode, originalError: responseText }
      );
    
    default:
      return new ProviderError(
        `HTTP error ${statusCode} from ${provider}`,
        'HTTP',
        provider,
        { statusCode, originalError: responseText }
      );
  }
}

/**
 * Call Gemini API with timeout and error handling
 */
async function callGemini(messages, options = {}) {
  const { timeout = 30000, signal: externalSignal } = options;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new ProviderError('GEMINI_API_KEY not configured', 'AUTH', 'gemini');
  }

  const timeoutSignal = AbortSignal.timeout(timeout);
  
  let signal = timeoutSignal;
  if (externalSignal) {
    const controller = new AbortController();
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason));
    timeoutSignal.addEventListener('abort', () => controller.abort(timeoutSignal.reason));
    signal = controller.signal;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: messages.map(m => ({ text: m.content })) }],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 4096,
          },
        }),
        signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw handleHttpError(response.status, 'gemini', errorText);
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new ProviderError(
        'Invalid response format from Gemini',
        'PARSE',
        'gemini',
        { statusCode: response.status, originalError: JSON.stringify(data) }
      );
    }

    return {
      text: data.candidates[0].content.parts[0].text,
      provider: 'gemini',
      usage: data.usageMetadata,
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new ProviderError(
        `Request to gemini timed out after ${timeout}ms`,
        'TIMEOUT',
        'gemini',
        { originalError: error }
      );
    }
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      `Network error calling gemini: ${error.message}`,
      'NETWORK',
      'gemini',
      { originalError: error }
    );
  }
}

/**
 * Call Ollama API with timeout and error handling
 */
async function callOllama(messages, options = {}) {
  const { timeout = 30000, signal: externalSignal, model = 'llama3.1' } = options;
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const timeoutSignal = AbortSignal.timeout(timeout);
  
  let signal = timeoutSignal;
  if (externalSignal) {
    const controller = new AbortController();
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason));
    timeoutSignal.addEventListener('abort', () => controller.abort(timeoutSignal.reason));
    signal = controller.signal;
  }

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: messages.map(m => m.content).join('\n\n'),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw handleHttpError(response.status, 'ollama', errorText);
    }

    const data = await response.json();
    
    return {
      text: data.response,
      provider: 'ollama',
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
      },
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new ProviderError(
        `Request to ollama timed out after ${timeout}ms`,
        'TIMEOUT',
        'ollama',
        { originalError: error }
      );
    }
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      `Network error calling ollama: ${error.message}`,
      'NETWORK',
      'ollama',
      { originalError: error }
    );
  }
}

/**
 * Call Mistral API with timeout and error handling
 */
async function callMistral(messages, options = {}) {
  const { timeout = 30000, signal: externalSignal, model = 'mistral-large-latest' } = options;
  const apiKey = process.env.MISTRAL_API_KEY;
  
  if (!apiKey) {
    throw new ProviderError('MISTRAL_API_KEY not configured', 'AUTH', 'mistral');
  }

  const timeoutSignal = AbortSignal.timeout(timeout);
  
  let signal = timeoutSignal;
  if (externalSignal) {
    const controller = new AbortController();
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason));
    timeoutSignal.addEventListener('abort', () => controller.abort(timeoutSignal.reason));
    signal = controller.signal;
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role || 'user', content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw handleHttpError(response.status, 'mistral', errorText);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new ProviderError(
        'Invalid response format from Mistral',
        'PARSE',
        'mistral',
        { statusCode: response.status, originalError: JSON.stringify(data) }
      );
    }

    return {
      text: data.choices[0].message.content,
      provider: 'mistral',
      usage: data.usage,
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new ProviderError(
        `Request to mistral timed out after ${timeout}ms`,
        'TIMEOUT',
        'mistral',
        { originalError: error }
      );
    }
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      `Network error calling mistral: ${error.message}`,
      'NETWORK',
      'mistral',
      { originalError: error }
    );
  }
}

/**
 * Main provider function with fallback support
 */
export async function callProvider(messages, options = {}) {
  const {
    provider = CONFIG.ai.primaryProvider,
    fallbackProvider = CONFIG.ai.fallbackProvider,
    maxRetries = CONFIG.ai.maxRetries,
    timeout = CONFIG.ai.timeout,
    onFallback,
    ...providerOptions
  } = options;

  const providers = [provider];
  if (fallbackProvider && fallbackProvider !== provider) {
    providers.push(fallbackProvider);
  }

  for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
    const currentProvider = providers[providerIndex];
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = calculateRetryDelay(attempt - 1);
          console.log(`Retrying ${currentProvider} in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
        }

        let result;
        switch (currentProvider) {
          case 'gemini':
            result = await callGemini(messages, { ...providerOptions, timeout });
            break;
          case 'ollama':
            result = await callOllama(messages, { ...providerOptions, timeout });
            break;
          case 'mistral':
            result = await callMistral(messages, { ...providerOptions, timeout });
            break;
          default:
            throw new ProviderError(`Unknown provider: ${currentProvider}`, 'AUTH', currentProvider);
        }

        if (providerIndex > 0) {
          console.log(`✓ Successfully used fallback provider: ${currentProvider}`);
          if (onFallback) onFallback(currentProvider);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (error.code === 'AUTH') {
          console.error(`❌ Auth error from ${currentProvider}: ${error.message}`);
          break;
        }

        if (error.code === 'RATE_LIMIT' && providerIndex < providers.length - 1) {
          console.warn(`⚠ Rate limited by ${currentProvider}, switching to fallback`);
          break;
        }

        if (attempt < maxRetries && ['TIMEOUT', 'SERVER', 'NETWORK', 'RATE_LIMIT'].includes(error.code)) {
          console.warn(`⚠ ${error.code} error from ${currentProvider}: ${error.message}`);
          continue;
        }

        console.error(`❌ Error from ${currentProvider}: ${error.message}`);
        break;
      }
    }

    if (providerIndex < providers.length - 1) {
      console.log(`Switching to fallback provider: ${providers[providerIndex + 1]}`);
      continue;
    }
  }

  throw lastError || new ProviderError('All providers failed', 'SERVER', provider);
}

/**
 * Health check for providers
 */
export async function checkProviderHealth(provider = 'gemini') {
  try {
    const testMessages = [{ role: 'user', content: 'Hello' }];
    const result = await callProvider(testMessages, { 
      provider, 
      timeout: 5000,
      maxRetries: 0 
    });
    return { healthy: true, provider, latency: result.latency };
  } catch (error) {
    return { healthy: false, provider, error: error.message, code: error.code };
  }
}

export default { callProvider, checkProviderHealth, ProviderError };
