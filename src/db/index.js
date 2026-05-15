import { Pool } from "pg";
import bcrypt from "bcryptjs";

export async function initializeDatabase(config, options = {}) {
  const pool = options.pool || new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
  });
  const db = wrapPool(pool);
  await migrate(db);
  await bootstrapUser(db, config);
  return db;
}

export function wrapPool(pool) {
  return {
    pool,
    query: (text, params = []) => pool.query(text, params),
    async one(text, params = []) {
      const result = await pool.query(text, params);
      return result.rows[0] || null;
    },
    async any(text, params = []) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    async none(text, params = []) {
      await pool.query(text, params);
    },
    end: () => pool.end(),
  };
}

async function migrate(db) {
  await db.none(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      redirect_uris JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS authorization_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      resource TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      consumed_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      resource TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      revoked_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS marketplace_accounts (
      id TEXT PRIMARY KEY,
      marketplace TEXT NOT NULL CHECK (marketplace IN ('wildberries', 'ozon')),
      name TEXT NOT NULL,
      encrypted_credentials TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS authorization_codes_client_id_idx ON authorization_codes (client_id);
    CREATE INDEX IF NOT EXISTS refresh_tokens_client_id_idx ON refresh_tokens (client_id);
    CREATE INDEX IF NOT EXISTS marketplace_accounts_marketplace_idx ON marketplace_accounts (marketplace);
  `);
}

async function bootstrapUser(db, config) {
  const existing = await db.one("SELECT id FROM users WHERE email = $1", [config.bootstrapUserEmail]);
  if (existing) return;
  const passwordHash = bcrypt.hashSync(config.bootstrapUserPassword, 12);
  await db.none("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [config.bootstrapUserEmail, passwordHash]);
}
