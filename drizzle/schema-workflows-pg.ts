/**
 * Agent Collaboration Workflows Schema (PostgreSQL)
 *
 * Replaces in-memory workflow storage with persistent database
 */

import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  index
} from 'drizzle-orm/pg-core';

// Define enums first (PostgreSQL requires this)
export const workflowStatusEnum = pgEnum('workflow_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
]);

export const orchestrationEnum = pgEnum('orchestration', [
  'sequential',
  'parallel'
]);

export const memorySharingEnum = pgEnum('memory_sharing', [
  'enabled',
  'disabled'
]);

export const recordOnChainEnum = pgEnum('record_on_chain', [
  'yes',
  'no'
]);

export const stepStatusEnum = pgEnum('step_status', [
  'pending',
  'running',
  'completed',
  'failed'
]);

export const interactionSuccessEnum = pgEnum('interaction_success', [
  'yes',
  'no'
]);

/**
 * Agent collaboration workflows
 */
export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 64 }).primaryKey(), // wf_timestamp_random
  task: varchar('task', { length: 500 }).notNull(),
  description: text('description'),
  status: workflowStatusEnum('status').default('pending').notNull(),
  orchestration: orchestrationEnum('orchestration').notNull(),
  memorySharing: memorySharingEnum('memory_sharing').default('enabled').notNull(),
  memoryTTL: integer('memory_ttl').default(86400).notNull(), // seconds
  maxExecutionTime: integer('max_execution_time').default(600).notNull(), // seconds
  recordOnChain: recordOnChainEnum('record_on_chain').default('yes').notNull(),
  createdBy: integer('created_by').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalExecutionTime: integer('total_execution_time'), // milliseconds
  sharedMemory: jsonb('shared_memory'), // Shared memory context
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index('workflows_created_by_idx').on(table.createdBy),
  statusIdx: index('workflows_status_idx').on(table.status),
  createdAtIdx: index('workflows_created_at_idx').on(table.createdAt),
}));

/**
 * Individual workflow steps
 */
export const workflowSteps = pgTable('workflow_steps', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workflowId: varchar('workflow_id', { length: 64 }).notNull(),
  stepIndex: integer('step_index').notNull(), // Order in workflow
  agentId: varchar('agent_id', { length: 255 }).notNull(), // openId or wallet address
  agentName: varchar('agent_name', { length: 255 }),
  status: stepStatusEnum('status').default('pending').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  input: jsonb('input'), // Input data for this step
  output: jsonb('output'), // Output data from this step
  error: text('error'), // Error message if failed
  memoryKeys: jsonb('memory_keys'), // Array of shared memory keys written
  executionTime: integer('execution_time'), // milliseconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workflowStepIdx: index('workflow_steps_workflow_idx').on(table.workflowId, table.stepIndex),
}));

/**
 * On-chain interaction records (ERC-8004)
 */
export const onChainInteractions = pgTable('on_chain_interactions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workflowId: varchar('workflow_id', { length: 64 }),
  fromAgentId: varchar('from_agent_id', { length: 255 }).notNull(),
  toAgentId: varchar('to_agent_id', { length: 255 }).notNull(),
  success: interactionSuccessEnum('success').notNull(),
  weight: integer('weight').default(50).notNull(), // Reputation weight
  interactionType: varchar('interaction_type', { length: 50 }).default('collaboration').notNull(),
  txHash: varchar('tx_hash', { length: 66 }), // Ethereum transaction hash
  blockNumber: integer('block_number'),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  workflowIdx: index('on_chain_interactions_workflow_idx').on(table.workflowId),
  fromAgentIdx: index('on_chain_interactions_from_agent_idx').on(table.fromAgentId),
  toAgentIdx: index('on_chain_interactions_to_agent_idx').on(table.toAgentId),
  txHashIdx: index('on_chain_interactions_tx_hash_idx').on(table.txHash),
}));
