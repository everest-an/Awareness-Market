/**
 * Agent Collaboration Workflows Schema
 * 
 * Replaces in-memory workflow storage with persistent database
 */

import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, json, decimal, index } from 'drizzle-orm/mysql-core';

/**
 * Agent collaboration workflows
 */
export const workflows = mysqlTable('workflows', {
  id: varchar('id', { length: 64 }).primaryKey(), // wf_timestamp_random
  task: varchar('task', { length: 500 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', ['pending', 'running', 'completed', 'failed', 'cancelled']).default('pending').notNull(),
  orchestration: mysqlEnum('orchestration', ['sequential', 'parallel']).notNull(),
  memorySharing: mysqlEnum('memory_sharing', ['enabled', 'disabled']).default('enabled').notNull(),
  memoryTTL: int('memory_ttl').default(86400).notNull(), // seconds
  maxExecutionTime: int('max_execution_time').default(600).notNull(), // seconds
  recordOnChain: mysqlEnum('record_on_chain', ['yes', 'no']).default('yes').notNull(),
  createdBy: int('created_by').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  totalExecutionTime: int('total_execution_time'), // milliseconds
  sharedMemory: json('shared_memory'), // Shared memory context
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  createdByIdx: index('created_by_idx').on(table.createdBy),
  statusIdx: index('status_idx').on(table.status),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));

/**
 * Individual workflow steps
 */
export const workflowSteps = mysqlTable('workflow_steps', {
  id: int('id').autoincrement().primaryKey(),
  workflowId: varchar('workflow_id', { length: 64 }).notNull(),
  stepIndex: int('step_index').notNull(), // Order in workflow
  agentId: varchar('agent_id', { length: 255 }).notNull(), // openId or wallet address
  agentName: varchar('agent_name', { length: 255 }),
  status: mysqlEnum('status', ['pending', 'running', 'completed', 'failed']).default('pending').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  input: json('input'), // Input data for this step
  output: json('output'), // Output data from this step
  error: text('error'), // Error message if failed
  memoryKeys: json('memory_keys'), // Array of shared memory keys written
  executionTime: int('execution_time'), // milliseconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workflowIdIdx: index('workflow_id_idx').on(table.workflowId),
  statusIdx: index('status_idx').on(table.status),
}));

/**
 * On-chain interaction records (cached from ERC-8004)
 */
export const onChainInteractions = mysqlTable('on_chain_interactions', {
  id: int('id').autoincrement().primaryKey(),
  workflowId: varchar('workflow_id', { length: 64 }),
  fromAgentId: varchar('from_agent_id', { length: 255 }).notNull(),
  toAgentId: varchar('to_agent_id', { length: 255 }).notNull(),
  success: mysqlEnum('success', ['yes', 'no']).notNull(),
  weight: int('weight').notNull(), // Interaction weight
  interactionType: varchar('interaction_type', { length: 50 }).default('collaboration').notNull(),
  txHash: varchar('tx_hash', { length: 66 }), // Blockchain transaction hash
  blockNumber: int('block_number'),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  workflowIdIdx: index('workflow_id_idx').on(table.workflowId),
  fromAgentIdx: index('from_agent_idx').on(table.fromAgentId),
  toAgentIdx: index('to_agent_idx').on(table.toAgentId),
}));
