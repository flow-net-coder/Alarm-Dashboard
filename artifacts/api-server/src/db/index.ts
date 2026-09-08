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
    `);
    console.log('[marcus-db] Ensured PostgreSQL database tables exist.');
  } catch (err) {
    console.error('[marcus-db] Could not initialize database tables:', (err as Error).message);
  }
}

export * from './schema';
