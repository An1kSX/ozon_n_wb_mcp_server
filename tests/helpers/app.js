import { newDb } from "pg-mem";
import { buildConfig } from "../../src/config.js";
import { buildApp } from "../../src/app.js";
import { initializeDatabase } from "../../src/db/index.js";

export async function createTestApp(overrides = {}) {
  const config = buildConfig({
    NODE_ENV: "test",
    BASE_URL: "https://mcp.example.test",
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    TOKEN_SIGNING_SECRET: "test-token-secret-with-at-least-32-bytes",
    ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "admin-password",
    BOOTSTRAP_USER_EMAIL: "boss@example.com",
    BOOTSTRAP_USER_PASSWORD: "boss-password",
    ...overrides,
  });
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = memoryDb.adapters.createPg();
  const pool = new Pool();
  const db = await initializeDatabase(config, { pool });
  const cache = {
    enabled: false,
    health: async () => ({ enabled: false, status: "disabled" }),
    close: async () => {},
  };
  const app = buildApp({ config, db, cache });
  return {
    app,
    config,
    db,
    async cleanup() {
      await db.end();
    },
  };
}
