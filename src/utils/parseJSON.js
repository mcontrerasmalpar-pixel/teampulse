/**
 * TeamPulse JSON Parser with Zod Validation
 * Validates AI response structures with strict schemas
 */

import { z } from 'zod';

/**
 * Schema for action items
 */
const ActionItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
  category: z.string().optional(),
});

/**
 * Schema for decisions
 */
const DecisionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  rationale: z.string().optional().default(''),
  impact: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  timestamp: z.string().optional(),
  stakeholders: z.array(z.string()).optional().default([]),
});

/**
 * Schema for risks
 */
const RiskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  probability: z.enum(['high', 'medium', 'low']).default('medium'),
  mitigation: z.string().optional().default(''),
  owner: z.string().optional(),
  status: z.enum(['identified', 'monitoring', 'mitigated', 'closed']).default('identified'),
});

/**
 * Schema for insights
 */
const InsightSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  type: z.enum(['observation', 'recommendation', 'concern', 'opportunity']).default('observation'),
  evidence: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

/**
 * Schema for topics discussed
 */
const TopicSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  duration: z.number().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional().default('neutral'),
  keyPoints: z.array(z.string()).optional().default([]),
});

/**
 * Schema for sentiment analysis
 */
const SentimentSchema = z.object({
  overall: z.enum(['positive', 'neutral', 'negative', 'mixed']).default('neutral'),
  score: z.number().min(-1).max(1).optional().default(0),
  byParticipant: z.record(z.string(), z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).default('neutral'),
    score: z.number().min(-1).max(1).optional().default(0),
  })).optional().default({}),
  trends: z.array(z.object({
    timestamp: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
    score: z.number().min(-1).max(1),
  })).optional().default([]),
});

/**
 * Schema for meeting summary
 */
const MeetingSummarySchema = z.object({
  title: z.string().min(1),
  date: z.string().optional(),
  duration: z.string().optional(),
  participants: z.array(z.string()).optional().default([]),
  overview: z.string().min(1),
  keyDecisions: z.array(DecisionSchema).optional().default([]),
  actionItems: z.array(ActionItemSchema).optional().default([]),
  risks: z.array(RiskSchema).optional().default([]),
  insights: z.array(InsightSchema).optional().default([]),
  topics: z.array(TopicSchema).optional().default([]),
  sentiment: SentimentSchema.optional().default({
    overall: 'neutral',
    score: 0,
  }),
  nextSteps: z.array(z.string()).optional().default([]),
  followUpRequired: z.boolean().optional().default(false),
  followUpDate: z.string().optional(),
});

/**
 * Schema for drift analysis
 */
const DriftAnalysisSchema = z.object({
  meetingId: z.string(),
  driftScore: z.number().min(0).max(1),
  driftType: z.enum(['topic', 'sentiment', 'engagement', 'none']).default('none'),
  evidence: z.array(z.string()).optional().default([]),
  recommendations: z.array(z.string()).optional().default([]),
  timestamp: z.string(),
});

/**
 * Schema for watchdog alerts
 */
const WatchdogAlertSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['action_item_overdue', 'risk_escalated', 'decision_pending', 'follow_up_needed', 'custom']),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).default('medium'),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  relatedMeetingId: z.string().optional(),
  relatedItemIds: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  acknowledged: z.boolean().optional().default(false),
  acknowledgedAt: z.string().optional(),
  acknowledgedBy: z.string().optional(),
  resolved: z.boolean().optional().default(false),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
});

/**
 * Schema for chat response
 */
const ChatResponseSchema = z.object({
  response: z.string().min(1),
  sources: z.array(z.object({
    meetingId: z.string(),
    excerpt: z.string(),
    relevance: z.number().min(0).max(1).optional(),
  })).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  followUpQuestions: z.array(z.string()).optional().default([]),
});

/**
 * Parse and validate meeting summary
 */
export function parseMeetingSummary(text) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    const parsed = JSON.parse(jsonString);
    const result = MeetingSummarySchema.parse(parsed);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    }
    return {
      success: false,
      error: 'Parse error',
      message: error.message,
    };
  }
}

/**
 * Parse and validate drift analysis
 */
export function parseDriftAnalysis(text) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    const parsed = JSON.parse(jsonString);
    const result = DriftAnalysisSchema.parse(parsed);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    }
    return {
      success: false,
      error: 'Parse error',
      message: error.message,
    };
  }
}

/**
 * Parse and validate watchdog alerts
 */
export function parseWatchdogAlerts(text) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    const parsed = JSON.parse(jsonString);
    
    const alerts = Array.isArray(parsed) ? parsed : [parsed];
    const results = alerts.map(alert => WatchdogAlertSchema.parse(alert));
    
    return { success: true, data: results };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    }
    return {
      success: false,
      error: 'Parse error',
      message: error.message,
    };
  }
}

/**
 * Parse and validate chat response
 */
export function parseChatResponse(text) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    const parsed = JSON.parse(jsonString);
    const result = ChatResponseSchema.parse(parsed);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    }
    return {
      success: false,
      error: 'Parse error',
      message: error.message,
    };
  }
}

/**
 * Generic JSON parser with optional schema validation
 */
export function parseJSON(text, schema = null) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    const parsed = JSON.parse(jsonString);
    
    if (schema) {
      const result = schema.parse(parsed);
      return { success: true, data: result };
    }
    
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        issues: error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    }
    return {
      success: false,
      error: 'Parse error',
      message: error.message,
    };
  }
}

export {
  ActionItemSchema,
  DecisionSchema,
  RiskSchema,
  InsightSchema,
  TopicSchema,
  SentimentSchema,
  MeetingSummarySchema,
  DriftAnalysisSchema,
  WatchdogAlertSchema,
  ChatResponseSchema,
};

export default {
  parseMeetingSummary,
  parseDriftAnalysis,
  parseWatchdogAlerts,
  parseChatResponse,
  parseJSON,
  ActionItemSchema,
  DecisionSchema,
  RiskSchema,
  InsightSchema,
  TopicSchema,
  SentimentSchema,
  MeetingSummarySchema,
  DriftAnalysisSchema,
  WatchdogAlertSchema,
  ChatResponseSchema,
};
