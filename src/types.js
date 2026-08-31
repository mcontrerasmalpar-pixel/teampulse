// @ts-check

/**
 * Shared types for providers and analysis output.
 * Prefer Zod inference from `AnalysisSchema` when possible.
 *
 * @typedef {'gemini' | 'ollama' | 'anthropic' | 'openai' | 'mistral' | 'fixture'} ProviderName
 *
 * @typedef {Object} ProviderConfig
 * @property {string} name
 * @property {string} apiKeyEnv
 * @property {(apiKey: string) => string} buildUrl
 * @property {(apiKey: string) => Record<string, string>} buildHeaders
 * @property {(input: string) => object} buildPayload
 * @property {(data: object) => string} extractText
 *
 * @typedef {Object} AnalyzeOptions
 * @property {ProviderName} [fallbackProvider]
 * @property {string} [fallbackModel]
 * @property {number} [timeoutMs]
 *
 * @typedef {Object} StructuredError
 * @property {string} code
 * @property {string} message
 * @property {boolean} [retryable]
 * @property {number} [status]
 */

export {};
