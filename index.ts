import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isPostgresConfigured = (): boolean => {
  return Boolean(
    process.env.SQL_HOST ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PGHOST
  );
};

let postgresActive: boolean | null = null;

export const isPostgresActive = async (): Promise<boolean> => {
  if (!isPostgresConfigured()) return false;
  if (postgresActive !== null) return postgresActive;

  try {
    const p = createPool();
    const client = await p.connect();
    client.release();
    postgresActive = true;
  } catch (err) {
    postgresActive = false;
  }
  return postgresActive;
};

export const markPostgresInactive = () => {
  postgresActive = false;
};

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST || '127.0.0.1',
      user: process.env.SQL_USER || 'postgres',
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DB_NAME || 'marshmallow',
      max: 10,
      connectionTimeoutMillis: 1500,
    });

    global._postgresPool.on('error', () => {
      postgresActive = false;
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export async function retryQuery<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const msg = String(err?.message || '') + String(err?.cause?.message || '');
      const isConnError =
        msg.includes('Connection terminated') ||
        msg.includes('closed') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('EPIPE') ||
        msg.includes('timeout') ||
        msg.includes('terminating connection');
      if (attempt <= retries && isConnError) {
        await new Promise(r => setTimeout(r, 100 * attempt));
        continue;
      }
      throw err;
    }
  }
}

let isSchemaEnsured = false;

export async function ensureSchema() {
  if (!isPostgresConfigured()) return;
  const active = await isPostgresActive();
  if (!active) return;
  if (isSchemaEnsured) return;

  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS border_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS age TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS hometown TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS school TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS work TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_privacy TEXT DEFAULT 'public'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_privacy TEXT DEFAULT 'public'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_privacy TEXT DEFAULT 'public'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS following_privacy TEXT DEFAULT 'public'`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_unsent BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden_for TEXT DEFAULT '[]'`,
    `CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS daily_photo_uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0
    )`
  ];

  let errorsCount = 0;
  for (const statement of alterStatements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      if (err?.code !== '42501' && !err?.message?.includes('permission denied')) {
        errorsCount++;
      }
    }
  }

  if (errorsCount === 0) {
    isSchemaEnsured = true;
  }
}

if (isPostgresConfigured()) {
  ensureSchema().catch(() => {});
}

export const db = drizzle(pool, { schema });

