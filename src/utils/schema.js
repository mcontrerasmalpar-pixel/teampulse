// @ts-check
import { z } from 'zod';

export const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  owner: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
});

export const RiskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
});

export const DecisionSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
});

export const ActionItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
});

export const AnalysisSchema = z.object({
  summary: z.string().default(''),
  tasks: z.array(TaskSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  action_items: z.array(ActionItemSchema).default([]),
});

/** @typedef {z.infer<typeof TaskSchema>} Task */
/** @typedef {z.infer<typeof RiskSchema>} Risk */
/** @typedef {z.infer<typeof DecisionSchema>} Decision */
/** @typedef {z.infer<typeof AnalysisSchema>} Analysis */

export default { AnalysisSchema, TaskSchema, RiskSchema, DecisionSchema };
