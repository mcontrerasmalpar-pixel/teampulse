// @ts-check
import { z } from 'zod';

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  owner: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
});

const RiskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
});

const DecisionSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
});

const ActionItemSchema = z.object({
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

export default { AnalysisSchema };
