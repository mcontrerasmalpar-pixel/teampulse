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
  const { analyzePaid } = await import('./provider-paid.js');
  return analyzePaid(input, providerName, externalSignal, options);
}

export default { analyze };
