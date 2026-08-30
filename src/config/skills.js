/**
 * TeamPulse Configuration - Skills and AI Settings
 */

export const CONFIG = {
  ai: {
    primaryProvider: 'gemini',
    fallbackProvider: 'ollama',
    maxRetries: 3,
    timeout: 30000,
    rateLimitMultiplier: 1000,
    baseRetryDelay: 1000,
    maxRetryDelay: 30000,
    providers: {
      gemini: {
        model: 'gemini-2.0-flash',
        maxTokens: 4096,
        temperature: 0.7,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      },
      ollama: {
        model: 'llama3.1',
        maxTokens: 4096,
        temperature: 0.7,
        baseUrl: 'http://localhost:11434',
      },
      mistral: {
        model: 'mistral-large-latest',
        maxTokens: 4096,
        temperature: 0.7,
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
      },
    },
    healthCheck: {
      enabled: true,
      interval: 300000,
      timeout: 5000,
    },
  },

  memory: {
    schemaVersion: 1,
    maxSessionAge: 30,
    cacheTTL: 24 * 60 * 60 * 1000,
    maxCacheEntries: 1000,
    autoCleanup: true,
  },

  processing: {
    maxConcurrentBatch: 3,
    maxConcurrentAPI: 2,
    chunkSize: 10000,
    streamingChunkDelay: 50,
  },

  skills: {
    analyst: {
      name: 'Meeting Analyst',
      description: 'Analyzes meeting transcripts to extract insights, decisions, and action items',
      enabled: true,
      defaultProvider: 'gemini',
      prompt: `You are an expert meeting analyst. Analyze the following meeting transcript and extract:
- Key decisions made
- Action items with owners and deadlines
- Risks and concerns raised
- Insights and opportunities
- Topics discussed with sentiment

Provide your analysis in structured JSON format.`,
    },
    
    briefing: {
      name: 'Meeting Briefing',
      description: 'Generates concise summaries and briefings from meeting data',
      enabled: true,
      defaultProvider: 'gemini',
      prompt: `You are an expert meeting summarizer. Create a concise, actionable briefing from the following meeting data.
Focus on what matters most for stakeholders who couldn't attend.

Provide your briefing in a clear, structured format.`,
    },
    
    watchdog: {
      name: 'Watchdog Agent',
      description: 'Monitors action items, risks, and follow-ups to send proactive alerts',
      enabled: true,
      defaultProvider: 'gemini',
      checkInterval: 3600000,
      prompt: `You are a proactive project watchdog. Review the following meeting data and identify:
- Overdue action items
- Escalated risks
- Pending decisions
- Required follow-ups

Generate alerts in JSON format with severity levels.`,
    },
    
    insight: {
      name: 'Insight Agent',
      description: 'Discovers patterns and insights across multiple meetings',
      enabled: true,
      defaultProvider: 'gemini',
      prompt: `You are an insight discovery expert. Analyze patterns across these meetings and identify:
- Recurring themes and topics
- Sentiment trends
- Decision patterns
- Risk patterns
- Opportunities for improvement

Provide insights in structured JSON format.`,
    },
    
    drift: {
      name: 'Drift Detector',
      description: 'Detects when meetings drift off-topic or lose engagement',
      enabled: true,
      defaultProvider: 'gemini',
      prompt: `You are a meeting drift detector. Analyze this transcript and identify:
- Topic drift (when conversation moves away from agenda)
- Sentiment drift (changes in emotional tone)
- Engagement drift (changes in participation levels)

Provide drift analysis in JSON format with evidence and recommendations.`,
    },
  },

  security: {
    configDirMode: 0o700,
    fileMode: 0o600,
    maskApiKeys: true,
    secureCleanup: true,
  },

  logging: {
    level: 'info',
    logApiCalls: false,
    logRetries: true,
    logFallbacks: true,
  },
};

export default CONFIG;
