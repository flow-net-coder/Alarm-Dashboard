import { pgTable, uuid, text, timestamp, integer, jsonb, serial } from 'drizzle-orm/pg-core';

export const conversationsTable = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  sessionDate: text('session_date').notNull(), // YYYY-MM-DD
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const actionItemsTable = pgTable('action_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull().default('task'), // task|meeting|email|call|reminder|other
  title: text('title').notNull(),
  description: text('description'),
  details: jsonb('details'), // people, dates, locations, subject lines, etc.
  status: text('status').notNull().default('pending'), // pending|in_progress|done|cancelled
  dueDate: timestamp('due_date', { withTimezone: true }),
  sourceMessageId: uuid('source_message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const marcusContextTable = pgTable('marcus_context', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const heartbeatLogsTable = pgTable('heartbeat_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
  conversationsProcessed: integer('conversations_processed').notNull().default(0),
  actionItemsCreated: integer('action_items_created').notNull().default(0),
  summary: text('summary'),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type ActionItem = typeof actionItemsTable.$inferSelect;
export type MarcusContext = typeof marcusContextTable.$inferSelect;
export type HeartbeatLog = typeof heartbeatLogsTable.$inferSelect;
