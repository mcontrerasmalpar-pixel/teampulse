// ── Multi-provider AI service ─────────────────────────────────────────────────
import { GoogleGenerativeAI } from '@google/generative-ai';

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
};

export function resolveProvider(providerName = 'gemini', modelOverride = null) {
  const name = providerName.toLowerCase();
  const config = PROVIDERS[name];
  if (!config) throw new Error(`Unknown provider: ${name}. Valid: ${Object.keys(PROVIDERS).join(', ')}`);
  const model = modelOverride || config.default;
  return { name, model };
}

export async function callProvider(provider, model, prompt) {
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
  }

  if (provider === 'claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0].text;
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set in .env');
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return completion.choices[0].message.content;
  }

  throw new Error(`Provider ${provider} not implemented`);
}
