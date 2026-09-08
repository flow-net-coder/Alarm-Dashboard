import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Provision a Supabase PostgreSQL database first.');
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureTablesExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        session_date TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL DEFAULT 'task',
        title TEXT NOT NULL,
        description TEXT,
        details JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TIMESTAMPTZ,
        source_message_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS marcus_context (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS heartbeat_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        conversations_processed INTEGER NOT NULL DEFAULT 0,
        action_items_created INTEGER NOT NULL DEFAULT 0,
        summary TEXT
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id TEXT NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        subscription JSONB NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'default-device';
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS subscription JSONB;
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        label TEXT NOT NULL,
        time TEXT NOT NULL,
        meridiem TEXT NOT NULL,
        days JSONB NOT NULL,
        color TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        snooze INTEGER NOT NULL DEFAULT 5,
        sound TEXT NOT NULL DEFAULT 'Soft chimes',
        ding_count INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        last_triggered_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'default-device';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Untitled alarm';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS time TEXT NOT NULL DEFAULT '07:00';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS meridiem TEXT NOT NULL DEFAULT 'AM';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS days JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#E69C73';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS snooze INTEGER NOT NULL DEFAULT 5;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS sound TEXT NOT NULL DEFAULT 'Soft chimes';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS ding_count INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS note TEXT;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS last_triggered_key TEXT;
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE alarms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
      CREATE INDEX IF NOT EXISTS alarms_enabled_idx ON alarms (enabled);
      CREATE INDEX IF NOT EXISTS alarms_device_id_idx ON alarms (device_id);
      CREATE INDEX IF NOT EXISTS push_subscriptions_device_id_idx ON push_subscriptions (device_id);
    `);
    console.log('[marcus-db] Ensured PostgreSQL database tables exist.');
  } catch (err) {
    console.error('[marcus-db] Could not initialize database tables:', (err as Error).message);
  }
}

export * from './schema';
