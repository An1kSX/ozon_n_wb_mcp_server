# WB Claude Remote MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Wildberries REST proxy with a public Claude-compatible remote MCP server that authenticates users through our own OAuth flow and serves data from admin-configured WB cabinets.

**Architecture:** One Node/Express service exposes `/mcp`, OAuth discovery and token endpoints, admin cabinet endpoints, and a SQLite-backed repository. Claude connects to `/mcp`, receives OAuth challenges for protected tools, authenticates the user through `/authorize`, and then calls MCP tools with bearer tokens issued by this service.

**Tech Stack:** Node.js ES modules, Express, `@modelcontextprotocol/sdk`, SQLite via `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, `zod`, Vitest, Supertest, Nock.

---

## File Structure

- Modify `package.json`: switch to ES modules, add app/test scripts, add runtime and test dependencies.
- Create `src/server.js`: loads config, initializes database, builds app, starts HTTP listener.
- Create `src/app.js`: Express app composition, security middleware, route mounting, safe error handler.
- Create `src/config.js`: environment parsing and defaults for tests/dev.
- Create `src/security/crypto.js`: API-token encryption/decryption and token hashing helpers.
- Create `src/db/index.js`: SQLite connection, schema migration, bootstrap user.
- Create `src/oauth/metadata.js`: protected-resource metadata and authorization-server metadata.
- Create `src/oauth/clients.js`: Dynamic Client Registration storage and redirect URI policy.
- Create `src/oauth/pkce.js`: S256 PKCE challenge verification.
- Create `src/oauth/tokens.js`: authorization code, access token, and refresh token issue/verify logic.
- Create `src/oauth/routes.js`: `/register`, `/authorize`, `/token`, and login form handling.
- Create `src/admin/routes.js`: admin cabinet CRUD endpoints protected by admin basic auth.
- Create `src/cabinets/repository.js`: cabinet persistence with encrypted WB tokens.
- Create `src/wb/endpoints.js`: allowlisted WB API endpoint definitions.
- Create `src/wb/client.js`: Wildberries API caller and safe error translation.
- Create `src/mcp/auth.js`: bearer extraction, token validation, protected tool detection, OAuth challenges.
- Create `src/mcp/server.js`: MCP tool registration.
- Create `src/mcp/http.js`: Streamable HTTP transport endpoint for `/mcp`.
- Create `tests/helpers/app.js`: test app/database factory.
- Create `tests/oauth-metadata.test.js`: metadata and DCR tests.
- Create `tests/oauth-flow.test.js`: login, authorization code, PKCE, and token tests.
- Create `tests/cabinets.test.js`: encrypted cabinet storage and admin response tests.
- Create `tests/mcp-auth.test.js`: MCP auth gate tests.
- Create `tests/wb-tools.test.js`: MCP tool input validation and WB allowlist tests.
- Create `.env.example`: required production configuration.
- Create `.dockerignore`: keep dependencies, local databases, logs, and secrets out of Docker build context.
- Create `Dockerfile`: production Node image for the MCP server.
- Create `docker-compose.yml`: server deployment with persistent SQLite volume and env-file configuration.
- Rewrite `README.md`: setup, Claude connector, admin cabinet setup, security notes.

---

### Task 1: Project Skeleton And Test Harness

**Files:**
- Modify: `package.json`
- Create: `src/config.js`
- Create: `src/app.js`
- Create: `src/server.js`
- Create: `tests/helpers/app.js`
- Create: `tests/health.test.js`

- [ ] **Step 1: Write the failing health test**

Create `tests/health.test.js`:

```js
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

describe("health endpoint", () => {
  it("returns service status without requiring OAuth", async () => {
    const { app } = await createTestApp();

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "wb-claude-mcp" });
    expect(res.body.timestamp).toEqual(expect.any(String));
  });
});
```

Create `tests/helpers/app.js`:

```js
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildConfig } from "../../src/config.js";
import { buildApp } from "../../src/app.js";
import { initializeDatabase } from "../../src/db/index.js";

export async function createTestApp(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "wb-mcp-test-"));
  const config = buildConfig({
    NODE_ENV: "test",
    BASE_URL: "https://mcp.example.test",
    DATABASE_PATH: join(dir, "test.db"),
    TOKEN_SIGNING_SECRET: "test-token-secret-with-at-least-32-bytes",
    ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "admin-password",
    BOOTSTRAP_USER_EMAIL: "boss@example.com",
    BOOTSTRAP_USER_PASSWORD: "boss-password",
    ...overrides,
  });
  const db = initializeDatabase(config);
  const app = buildApp({ config, db });
  return {
    app,
    config,
    db,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/health.test.js
```

Expected: FAIL because `vitest`, `src/config.js`, `src/app.js`, and `src/db/index.js` do not exist yet.

- [ ] **Step 3: Update package and add minimal app skeleton**

Replace `package.json` with:

```json
{
  "name": "wb-api-mcp-server",
  "version": "1.0.0",
  "description": "Claude remote MCP server for Wildberries cabinet APIs",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "keywords": [
    "wildberries",
    "api",
    "mcp",
    "claude",
    "oauth"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "axios": "^1.6.7",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "cookie-parser": "^1.4.6",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-session": "^1.18.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "nock": "^13.5.4",
    "supertest": "^6.3.4",
    "vitest": "^1.3.1"
  }
}
```

Create `src/config.js`:

```js
export function buildConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
  return {
    env: env.NODE_ENV || "development",
    port,
    baseUrl,
    mcpResourceUrl: `${baseUrl}/mcp`,
    databasePath: env.DATABASE_PATH || "data/wb-mcp.sqlite",
    tokenSigningSecret: requireSecret(env, "TOKEN_SIGNING_SECRET", "dev-token-signing-secret-change-me-32"),
    encryptionKey: requireSecret(env, "ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    sessionSecret: requireSecret(env, "SESSION_SECRET", "dev-session-secret-change-me-32"),
    adminUsername: env.ADMIN_USERNAME || "admin",
    adminPassword: env.ADMIN_PASSWORD || "admin-password-change-me",
    bootstrapUserEmail: env.BOOTSTRAP_USER_EMAIL || "boss@example.com",
    bootstrapUserPassword: env.BOOTSTRAP_USER_PASSWORD || "change-me",
    allowedRedirectHosts: (env.ALLOWED_REDIRECT_HOSTS || "claude.ai,claude.com,localhost,127.0.0.1")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  };
}

function requireSecret(env, key, devValue) {
  if (env.NODE_ENV === "production" && !env[key]) {
    throw new Error(`${key} is required in production`);
  }
  return env[key] || devValue;
}
```

Create `src/db/index.js`:

```js
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export function initializeDatabase(config) {
  if (config.databasePath !== ":memory:") {
    mkdirSync(dirname(config.databasePath), { recursive: true });
  }
  const db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  bootstrapUser(db, config);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function bootstrapUser(db, config) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(config.bootstrapUserEmail);
  if (existing) return;
  const passwordHash = bcrypt.hashSync(config.bootstrapUserPassword, 12);
  db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(config.bootstrapUserEmail, passwordHash);
}
```

Create `src/app.js`:

```js
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";

export function buildApp({ config, db }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));
  app.use(cookieParser());
  app.use(
    session({
      name: "wb_mcp_sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.env === "production",
      },
    }),
  );

  app.locals.config = config;
  app.locals.db = db;

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "wb-claude-mcp",
      timestamp: new Date().toISOString(),
    });
  });

  app.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: true,
      message: status >= 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}
```

Create `src/server.js`:

```js
import { buildConfig } from "./config.js";
import { initializeDatabase } from "./db/index.js";
import { buildApp } from "./app.js";

const config = buildConfig();
const db = initializeDatabase(config);
const app = buildApp({ config, db });

app.listen(config.port, () => {
  console.log(`WB Claude MCP server listening on ${config.port}`);
});
```

- [ ] **Step 4: Install dependencies and run test**

Run:

```bash
npm install
npm test -- --run tests/health.test.js
```

Expected: PASS for `tests/health.test.js`.

---

### Task 2: OAuth Discovery And Dynamic Client Registration

**Files:**
- Create: `tests/oauth-metadata.test.js`
- Create: `src/oauth/metadata.js`
- Create: `src/oauth/clients.js`
- Modify: `src/db/index.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write failing metadata and registration tests**

Create `tests/oauth-metadata.test.js`:

```js
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

describe("OAuth metadata for Claude remote MCP", () => {
  it("serves protected resource metadata for the MCP resource", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app).get("/.well-known/oauth-protected-resource/mcp");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      resource: config.mcpResourceUrl,
      authorization_servers: [config.baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["wb:read"],
    });
    cleanup();
  });

  it("serves authorization server metadata with PKCE and DCR", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app).get("/.well-known/oauth-authorization-server");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      issuer: config.baseUrl,
      authorization_endpoint: `${config.baseUrl}/authorize`,
      token_endpoint: `${config.baseUrl}/token`,
      registration_endpoint: `${config.baseUrl}/register`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
    cleanup();
  });

  it("registers a public Claude OAuth client with an allowed redirect URI", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/register")
      .send({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toEqual(expect.any(String));
    expect(res.body.token_endpoint_auth_method).toBe("none");
    expect(res.body.redirect_uris).toEqual(["https://claude.ai/api/mcp/auth_callback"]);
    cleanup();
  });

  it("rejects dynamic clients with untrusted redirect hosts", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/register")
      .send({
        client_name: "Bad Client",
        redirect_uris: ["https://attacker.example/callback"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_redirect_uri");
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/oauth-metadata.test.js
```

Expected: FAIL with 404 responses for metadata and registration endpoints.

- [ ] **Step 3: Implement metadata, DCR schema, and routes**

Add these tables inside `migrate(db)` in `src/db/index.js`:

```js
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
```

Create `src/oauth/metadata.js`:

```js
export function protectedResourceMetadata(config) {
  return {
    resource: config.mcpResourceUrl,
    authorization_servers: [config.baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["wb:read"],
  };
}

export function authorizationServerMetadata(config) {
  return {
    issuer: config.baseUrl,
    authorization_endpoint: `${config.baseUrl}/authorize`,
    token_endpoint: `${config.baseUrl}/token`,
    registration_endpoint: `${config.baseUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["wb:read", "offline_access"],
  };
}
```

Create `src/oauth/clients.js`:

```js
import crypto from "node:crypto";
import { z } from "zod";

const registrationSchema = z.object({
  client_name: z.string().min(1).max(200).default("Claude"),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
});

export function registerClient({ db, config, body }) {
  const input = registrationSchema.parse(body);
  for (const redirectUri of input.redirect_uris) {
    if (!isAllowedRedirectUri(config, redirectUri)) {
      const err = new Error("Redirect URI is not allowed");
      err.statusCode = 400;
      err.oauthError = "invalid_redirect_uri";
      throw err;
    }
  }

  const clientId = `dcr_${crypto.randomUUID()}`;
  db.prepare(
    "INSERT INTO oauth_clients (client_id, client_name, redirect_uris) VALUES (?, ?, ?)",
  ).run(clientId, input.client_name, JSON.stringify(input.redirect_uris));

  return {
    client_id: clientId,
    client_name: input.client_name,
    redirect_uris: input.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

export function getClient(db, clientId) {
  const row = db.prepare("SELECT * FROM oauth_clients WHERE client_id = ?").get(clientId);
  if (!row) return null;
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: JSON.parse(row.redirect_uris),
  };
}

export function isRedirectAllowedForClient(client, redirectUri) {
  return client.redirectUris.includes(redirectUri);
}

function isAllowedRedirectUri(config, value) {
  const uri = new URL(value);
  if (uri.protocol === "https:") {
    return config.allowedRedirectHosts.includes(uri.hostname.toLowerCase());
  }
  if (uri.protocol === "http:" && ["localhost", "127.0.0.1"].includes(uri.hostname)) {
    return config.allowedRedirectHosts.includes(uri.hostname.toLowerCase());
  }
  return false;
}
```

Modify `src/app.js` to import and mount metadata/DCR endpoints before the error handler:

```js
import { authorizationServerMetadata, protectedResourceMetadata } from "./oauth/metadata.js";
import { registerClient } from "./oauth/clients.js";
```

```js
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(protectedResourceMetadata(config));
  });

  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    res.json(protectedResourceMetadata(config));
  });

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json(authorizationServerMetadata(config));
  });

  app.post("/register", (req, res, next) => {
    try {
      res.status(201).json(registerClient({ db, config, body: req.body }));
    } catch (err) {
      if (err.oauthError) {
        res.status(err.statusCode).json({ error: err.oauthError, error_description: err.message });
        return;
      }
      next(err);
    }
  });
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --run tests/oauth-metadata.test.js tests/health.test.js
```

Expected: PASS for metadata, DCR, and health tests.

---

### Task 3: Cabinet Storage With Encrypted Wildberries Tokens

**Files:**
- Create: `tests/cabinets.test.js`
- Create: `src/security/crypto.js`
- Create: `src/cabinets/repository.js`
- Create: `src/admin/routes.js`
- Modify: `src/db/index.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write failing cabinet security tests**

Create `tests/cabinets.test.js`:

```js
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { createCabinet, getCabinetToken } from "../src/cabinets/repository.js";

function adminAuth() {
  return `Basic ${Buffer.from("admin:admin-password").toString("base64")}`;
}

describe("admin cabinet storage", () => {
  it("stores WB API tokens encrypted and returns only safe cabinet fields", async () => {
    const { app, db, config, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/cabinets")
      .set("Authorization", adminAuth())
      .send({ id: "main", name: "Main WB", wbApiToken: "wb-secret-token", notes: "Primary cabinet" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "main",
      name: "Main WB",
      notes: "Primary cabinet",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");

    const row = db.prepare("SELECT encrypted_token FROM wb_cabinets WHERE id = ?").get("main");
    expect(row.encrypted_token).not.toContain("wb-secret-token");
    expect(getCabinetToken({ db, config, id: "main" })).toBe("wb-secret-token");
    cleanup();
  });

  it("lists cabinets without token material", async () => {
    const { app, db, config, cleanup } = await createTestApp();
    createCabinet({ db, config, id: "main", name: "Main WB", wbApiToken: "wb-secret-token", notes: "" });

    const res = await request(app).get("/admin/cabinets").set("Authorization", adminAuth());

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { id: "main", name: "Main WB", notes: "", createdAt: expect.any(String), updatedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");
    cleanup();
  });

  it("rejects admin requests without admin credentials", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app).get("/admin/cabinets");

    expect(res.status).toBe(401);
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/cabinets.test.js
```

Expected: FAIL because cabinet repository and admin routes do not exist.

- [ ] **Step 3: Implement encrypted storage and admin routes**

Add this table in `src/db/index.js`:

```js
  db.exec(`
    CREATE TABLE IF NOT EXISTS wb_cabinets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
```

Create `src/security/crypto.js`:

```js
import crypto from "node:crypto";

export function encryptSecret(config, plaintext) {
  const key = Buffer.from(config.encryptionKey, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(config, value) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  const key = Buffer.from(config.encryptionKey, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
```

Create `src/cabinets/repository.js`:

```js
import { z } from "zod";
import { decryptSecret, encryptSecret } from "../security/crypto.js";

const cabinetSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(200),
  wbApiToken: z.string().min(10).max(4096),
  notes: z.string().max(1000).default(""),
});

export function createCabinet({ db, config, id, name, wbApiToken, notes = "" }) {
  const input = cabinetSchema.parse({ id, name, wbApiToken, notes });
  const encrypted = encryptSecret(config, input.wbApiToken);
  db.prepare(`
    INSERT INTO wb_cabinets (id, name, encrypted_token, notes, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      encrypted_token = excluded.encrypted_token,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(input.id, input.name, encrypted, input.notes);
  return getCabinet(db, input.id);
}

export function listCabinets(db) {
  return db.prepare(`
    SELECT id, name, notes, created_at AS createdAt, updated_at AS updatedAt
    FROM wb_cabinets
    ORDER BY name ASC
  `).all();
}

export function getCabinet(db, id) {
  return db.prepare(`
    SELECT id, name, notes, created_at AS createdAt, updated_at AS updatedAt
    FROM wb_cabinets
    WHERE id = ?
  `).get(id);
}

export function getCabinetToken({ db, config, id }) {
  const row = db.prepare("SELECT encrypted_token FROM wb_cabinets WHERE id = ?").get(id);
  if (!row) {
    const err = new Error("Unknown cabinet");
    err.statusCode = 404;
    throw err;
  }
  return decryptSecret(config, row.encrypted_token);
}
```

Create `src/admin/routes.js`:

```js
import express from "express";
import { createCabinet, listCabinets } from "../cabinets/repository.js";

export function buildAdminRouter({ config, db }) {
  const router = express.Router();
  router.use((req, res, next) => {
    const header = req.get("authorization") || "";
    const [scheme, encoded] = header.split(" ");
    if (scheme !== "Basic" || !encoded) {
      res.set("WWW-Authenticate", 'Basic realm="admin"').status(401).json({ error: true, message: "Admin auth required" });
      return;
    }
    const [username, password] = Buffer.from(encoded, "base64").toString("utf8").split(":");
    if (username !== config.adminUsername || password !== config.adminPassword) {
      res.set("WWW-Authenticate", 'Basic realm="admin"').status(401).json({ error: true, message: "Admin auth required" });
      return;
    }
    next();
  });

  router.get("/cabinets", (_req, res) => {
    res.json({ items: listCabinets(db) });
  });

  router.post("/cabinets", (req, res, next) => {
    try {
      const cabinet = createCabinet({ db, config, ...req.body });
      res.status(201).json(cabinet);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

Modify `src/app.js`:

```js
import { buildAdminRouter } from "./admin/routes.js";
```

```js
  app.use("/admin", buildAdminRouter({ config, db }));
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --run tests/cabinets.test.js tests/health.test.js
```

Expected: PASS for cabinet and health tests.

---

### Task 4: OAuth Authorization Code, Login, PKCE, And Tokens

**Files:**
- Create: `tests/oauth-flow.test.js`
- Create: `src/oauth/pkce.js`
- Create: `src/oauth/tokens.js`
- Create: `src/oauth/routes.js`
- Modify: `src/db/index.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write failing OAuth flow tests**

Create `tests/oauth-flow.test.js`:

```js
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";
import { verifyAccessToken } from "../src/oauth/tokens.js";

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClaudeClient(app) {
  const res = await request(app).post("/register").send({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  return res.body.client_id;
}

describe("OAuth authorization flow", () => {
  it("issues an authorization code after service login and exchanges it with PKCE", async () => {
    const { app, config, cleanup } = await createTestApp();
    const agent = request.agent(app);
    const clientId = await registerClaudeClient(app);
    const { verifier, challenge } = pkcePair();

    const authorizeRes = await agent
      .post("/authorize")
      .type("form")
      .send({
        email: "boss@example.com",
        password: "boss-password",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        response_type: "code",
        scope: "wb:read offline_access",
        state: "state-123",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: config.mcpResourceUrl,
      });

    expect(authorizeRes.status).toBe(302);
    const location = new URL(authorizeRes.headers.location);
    expect(location.origin + location.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
    expect(location.searchParams.get("state")).toBe("state-123");
    const code = location.searchParams.get("code");
    expect(code).toEqual(expect.any(String));

    const tokenRes = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: verifier,
        resource: config.mcpResourceUrl,
      });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 900,
      scope: "wb:read offline_access",
    });
    expect(tokenRes.body.access_token).toEqual(expect.any(String));
    expect(tokenRes.body.refresh_token).toEqual(expect.any(String));
    expect(verifyAccessToken(config, tokenRes.body.access_token).sub).toBe("1");
    cleanup();
  });

  it("rejects token exchange with the wrong PKCE verifier", async () => {
    const { app, config, cleanup } = await createTestApp();
    const clientId = await registerClaudeClient(app);
    const { challenge } = pkcePair();

    const authorizeRes = await request(app)
      .post("/authorize")
      .type("form")
      .send({
        email: "boss@example.com",
        password: "boss-password",
        client_id: clientId,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        response_type: "code",
        scope: "wb:read",
        state: "state-123",
        code_challenge: challenge,
        code_challenge_method: "S256",
        resource: config.mcpResourceUrl,
      });
    const code = new URL(authorizeRes.headers.location).searchParams.get("code");

    const tokenRes = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: "wrong-verifier",
        resource: config.mcpResourceUrl,
      });

    expect(tokenRes.status).toBe(400);
    expect(tokenRes.body.error).toBe("invalid_grant");
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/oauth-flow.test.js
```

Expected: FAIL because OAuth route/token modules are not implemented.

- [ ] **Step 3: Implement OAuth database tables**

Add these tables in `src/db/index.js`:

```js
  db.exec(`
    CREATE TABLE IF NOT EXISTS authorization_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      resource TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      resource TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
  `);
```

- [ ] **Step 4: Implement PKCE and tokens**

Create `src/oauth/pkce.js`:

```js
import crypto from "node:crypto";

export function verifyPkceS256(verifier, expectedChallenge) {
  const actual = crypto.createHash("sha256").update(verifier).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedChallenge));
}
```

Create `src/oauth/tokens.js`:

```js
import jwt from "jsonwebtoken";
import { randomToken, sha256 } from "../security/crypto.js";
import { verifyPkceS256 } from "./pkce.js";

const ACCESS_TOKEN_TTL_SECONDS = 900;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function issueAuthorizationCode({ db, clientId, userId, redirectUri, scope, resource, codeChallenge }) {
  const code = randomToken(32);
  db.prepare(`
    INSERT INTO authorization_codes
      (code_hash, client_id, user_id, redirect_uri, scope, resource, code_challenge, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sha256(code), clientId, userId, redirectUri, scope, resource, codeChallenge, Date.now() + AUTH_CODE_TTL_MS);
  return code;
}

export function exchangeAuthorizationCode({ db, config, clientId, code, redirectUri, codeVerifier, resource }) {
  const row = db.prepare("SELECT * FROM authorization_codes WHERE code_hash = ?").get(sha256(code));
  if (!row || row.consumed_at || row.expires_at < Date.now()) throwOAuth("invalid_grant", "Authorization code is invalid");
  if (row.client_id !== clientId || row.redirect_uri !== redirectUri || row.resource !== resource) {
    throwOAuth("invalid_grant", "Authorization code binding does not match");
  }
  if (!verifyPkceS256(codeVerifier, row.code_challenge)) throwOAuth("invalid_grant", "PKCE verification failed");

  db.prepare("UPDATE authorization_codes SET consumed_at = ? WHERE code_hash = ?").run(Date.now(), sha256(code));
  return issueTokenPair({ db, config, clientId, userId: row.user_id, scope: row.scope, resource: row.resource });
}

export function issueTokenPair({ db, config, clientId, userId, scope, resource }) {
  const accessToken = jwt.sign(
    { scope },
    config.tokenSigningSecret,
    {
      subject: String(userId),
      issuer: config.baseUrl,
      audience: resource,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  );
  const refreshToken = randomToken(48);
  db.prepare(`
    INSERT INTO refresh_tokens (token_hash, client_id, user_id, scope, resource, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sha256(refreshToken), clientId, userId, scope, resource, Date.now() + REFRESH_TOKEN_TTL_MS);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope,
  };
}

export function refreshAccessToken({ db, config, clientId, refreshToken }) {
  const hash = sha256(refreshToken);
  const row = db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(hash);
  if (!row || row.revoked_at || row.expires_at < Date.now() || row.client_id !== clientId) {
    throwOAuth("invalid_grant", "Refresh token is invalid");
  }
  db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?").run(Date.now(), hash);
  return issueTokenPair({ db, config, clientId, userId: row.user_id, scope: row.scope, resource: row.resource });
}

export function verifyAccessToken(config, accessToken) {
  return jwt.verify(accessToken, config.tokenSigningSecret, {
    issuer: config.baseUrl,
    audience: config.mcpResourceUrl,
  });
}

function throwOAuth(error, description) {
  const err = new Error(description);
  err.statusCode = 400;
  err.oauthError = error;
  throw err;
}
```

- [ ] **Step 5: Implement authorization and token routes**

Create `src/oauth/routes.js`:

```js
import express from "express";
import bcrypt from "bcryptjs";
import { getClient, isRedirectAllowedForClient } from "./clients.js";
import { exchangeAuthorizationCode, issueAuthorizationCode, refreshAccessToken } from "./tokens.js";

export function buildOAuthRouter({ config, db }) {
  const router = express.Router();

  router.get("/authorize", (req, res) => {
    res.type("html").send(renderLoginForm(req.query, ""));
  });

  router.post("/authorize", (req, res, next) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.body.email);
      if (!user || !bcrypt.compareSync(req.body.password || "", user.password_hash)) {
        res.status(401).type("html").send(renderLoginForm(req.body, "Invalid email or password"));
        return;
      }
      const client = getClient(db, req.body.client_id);
      if (!client || !isRedirectAllowedForClient(client, req.body.redirect_uri)) {
        res.status(400).json({ error: "invalid_request", error_description: "Invalid OAuth client or redirect URI" });
        return;
      }
      if (req.body.response_type !== "code" || req.body.code_challenge_method !== "S256") {
        res.status(400).json({ error: "invalid_request", error_description: "S256 authorization code flow is required" });
        return;
      }
      if (req.body.resource !== config.mcpResourceUrl) {
        res.status(400).json({ error: "invalid_target", error_description: "Invalid resource" });
        return;
      }
      const scope = normalizeScope(req.body.scope);
      const code = issueAuthorizationCode({
        db,
        clientId: client.clientId,
        userId: user.id,
        redirectUri: req.body.redirect_uri,
        scope,
        resource: req.body.resource,
        codeChallenge: req.body.code_challenge,
      });
      const redirect = new URL(req.body.redirect_uri);
      redirect.searchParams.set("code", code);
      if (req.body.state) redirect.searchParams.set("state", req.body.state);
      res.redirect(302, redirect.toString());
    } catch (err) {
      next(err);
    }
  });

  router.post("/token", (req, res) => {
    try {
      if (req.body.grant_type === "authorization_code") {
        res.json(exchangeAuthorizationCode({
          db,
          config,
          clientId: req.body.client_id,
          code: req.body.code,
          redirectUri: req.body.redirect_uri,
          codeVerifier: req.body.code_verifier,
          resource: req.body.resource,
        }));
        return;
      }
      if (req.body.grant_type === "refresh_token") {
        res.json(refreshAccessToken({
          db,
          config,
          clientId: req.body.client_id,
          refreshToken: req.body.refresh_token,
        }));
        return;
      }
      res.status(400).json({ error: "unsupported_grant_type" });
    } catch (err) {
      res.status(err.statusCode || 400).json({
        error: err.oauthError || "invalid_request",
        error_description: err.message,
      });
    }
  });

  return router;
}

function normalizeScope(scope = "wb:read") {
  const values = String(scope).split(/\s+/).filter(Boolean);
  if (!values.includes("wb:read")) values.push("wb:read");
  return [...new Set(values)].join(" ");
}

function renderLoginForm(query, error) {
  const hidden = ["client_id", "redirect_uri", "response_type", "scope", "state", "code_challenge", "code_challenge_method", "resource"]
    .map((key) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(query[key] || "")}">`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorize Claude</title></head>
<body>
  <main>
    <h1>Authorize Claude</h1>
    ${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}
    <form method="post" action="/authorize">
      ${hidden}
      <label>Email <input name="email" type="email" autocomplete="username" required></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Authorize</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
```

Modify `src/app.js`:

```js
import { buildOAuthRouter } from "./oauth/routes.js";
```

```js
  app.use(buildOAuthRouter({ config, db }));
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- --run tests/oauth-flow.test.js tests/oauth-metadata.test.js tests/health.test.js
```

Expected: PASS for OAuth flow, metadata, and health tests.

---

### Task 5: MCP Endpoint And OAuth HTTP Gate

**Files:**
- Create: `tests/mcp-auth.test.js`
- Create: `src/mcp/auth.js`
- Create: `src/mcp/server.js`
- Create: `src/mcp/http.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write failing MCP auth gate tests**

Create `tests/mcp-auth.test.js`:

```js
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

async function getAccessToken(app, config) {
  const client = await request(app).post("/register").send({
    client_name: "Claude",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    token_endpoint_auth_method: "none",
  });
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const auth = await request(app).post("/authorize").type("form").send({
    email: "boss@example.com",
    password: "boss-password",
    client_id: client.body.client_id,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    response_type: "code",
    scope: "wb:read offline_access",
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: config.mcpResourceUrl,
  });
  const code = new URL(auth.headers.location).searchParams.get("code");
  const token = await request(app).post("/token").type("form").send({
    grant_type: "authorization_code",
    client_id: client.body.client_id,
    code,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    code_verifier: verifier,
    resource: config.mcpResourceUrl,
  });
  return token.body.access_token;
}

describe("MCP OAuth gate", () => {
  it("returns OAuth 401 for protected tool calls without bearer token", async () => {
    const { app, config, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_cabinets", arguments: {} } });

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toContain("Bearer");
    expect(res.headers["www-authenticate"]).toContain(`resource_metadata="${config.baseUrl}/.well-known/oauth-protected-resource/mcp"`);
    expect(res.headers["www-authenticate"]).toContain('scope="wb:read"');
    cleanup();
  });

  it("allows tools/list without bearer token for connector bootstrap", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain("list_cabinets");
    cleanup();
  });

  it("allows protected tool calls with a valid bearer token", async () => {
    const { app, config, cleanup } = await createTestApp();
    const accessToken = await getAccessToken(app, config);

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_cabinets", arguments: {} } });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain("content");
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/mcp-auth.test.js
```

Expected: FAIL because `/mcp` does not exist.

- [ ] **Step 3: Implement MCP auth helpers and basic server**

Create `src/mcp/auth.js`:

```js
import { verifyAccessToken } from "../oauth/tokens.js";

export const PROTECTED_TOOLS = new Set([
  "list_cabinets",
  "get_advert_fullstats",
  "get_auto_stat_words",
  "get_campaign_stat_words",
  "get_nm_report_detail",
  "get_nm_report_detail_history",
  "get_search_report",
  "get_stocks_products",
  "list_csv_reports",
]);

export function extractBearer(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function authenticateMcpRequest(config, req) {
  const token = extractBearer(req);
  if (!token) return null;
  try {
    return verifyAccessToken(config, token);
  } catch {
    return null;
  }
}

export function callsProtectedTool(body) {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((message) => {
    return message?.method === "tools/call" && PROTECTED_TOOLS.has(message?.params?.name);
  });
}

export function writeAuthChallenge(config, res) {
  res
    .status(401)
    .set(
      "WWW-Authenticate",
      `Bearer error="invalid_token", error_description="Authentication required", resource_metadata="${config.baseUrl}/.well-known/oauth-protected-resource/mcp", scope="wb:read"`,
    )
    .json({ error: "invalid_token", error_description: "Authentication required" });
}
```

Create `src/mcp/server.js`:

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listCabinets } from "../cabinets/repository.js";

export function buildMcpServer({ db, config, user }) {
  const server = new McpServer({ name: "wb-claude-mcp", version: "1.0.0" });

  server.registerTool(
    "list_cabinets",
    {
      title: "List Wildberries cabinets",
      description: "Lists Wildberries cabinets configured by the service administrator.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      requireUser(user);
      return jsonContent(listCabinets(db));
    },
  );

  return server;
}

export function jsonContent(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export const cabinetIdSchema = {
  cabinetId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
};

function requireUser(user) {
  if (!user) {
    throw new Error("Authentication required");
  }
}
```

Create `src/mcp/http.js`:

```js
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticateMcpRequest, callsProtectedTool, writeAuthChallenge } from "./auth.js";
import { buildMcpServer } from "./server.js";

export function buildMcpRouter({ config, db }) {
  const router = express.Router();

  router.post("/mcp", async (req, res) => {
    const user = authenticateMcpRequest(config, req);
    if (!user && callsProtectedTool(req.body)) {
      writeAuthChallenge(config, res);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = buildMcpServer({ config, db, user });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  router.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "method_not_allowed" });
  });

  return router;
}
```

Modify `src/app.js`:

```js
import { buildMcpRouter } from "./mcp/http.js";
```

```js
  app.use(buildMcpRouter({ config, db }));
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --run tests/mcp-auth.test.js tests/oauth-flow.test.js tests/cabinets.test.js
```

Expected: PASS for MCP auth gate, OAuth flow, and cabinet tests.

---

### Task 6: Wildberries Client And Read-Only MCP Tools

**Files:**
- Create: `tests/wb-tools.test.js`
- Create: `src/wb/endpoints.js`
- Create: `src/wb/client.js`
- Modify: `src/mcp/server.js`

- [ ] **Step 1: Write failing WB tool tests**

Create `tests/wb-tools.test.js`:

```js
import { describe, expect, it } from "vitest";
import nock from "nock";
import { createTestApp } from "./helpers/app.js";
import { createCabinet } from "../src/cabinets/repository.js";
import { callWbApi } from "../src/wb/client.js";

describe("Wildberries API client", () => {
  it("calls only an allowlisted WB endpoint with the stored cabinet token", async () => {
    const { db, config, cleanup } = await createTestApp();
    createCabinet({ db, config, id: "main", name: "Main WB", wbApiToken: "wb-secret-token" });

    nock("https://advert-api.wildberries.ru", {
      reqheaders: { Authorization: "wb-secret-token" },
    })
      .post("/adv/v2/fullstats", [{ id: 123, dates: ["2026-05-15"] }])
      .reply(200, [{ advertId: 123, views: 10 }]);

    const data = await callWbApi({
      db,
      config,
      cabinetId: "main",
      endpointKey: "advertFullstats",
      input: [{ id: 123, dates: ["2026-05-15"] }],
    });

    expect(data).toEqual([{ advertId: 123, views: 10 }]);
    cleanup();
  });

  it("rejects unknown endpoint keys instead of proxying arbitrary URLs", async () => {
    const { db, config, cleanup } = await createTestApp();

    await expect(callWbApi({
      db,
      config,
      cabinetId: "main",
      endpointKey: "https://evil.example",
      input: {},
    })).rejects.toThrow("Unknown WB endpoint");
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/wb-tools.test.js
```

Expected: FAIL because WB client modules are not implemented.

- [ ] **Step 3: Implement allowlisted WB endpoints and client**

Create `src/wb/endpoints.js`:

```js
export const WB_ENDPOINTS = {
  advertFullstats: {
    method: "POST",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v2/fullstats",
  },
  autoStatWords: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v2/auto/stat-words",
  },
  campaignStatWords: {
    method: "GET",
    baseUrl: "https://advert-api.wildberries.ru",
    path: "/adv/v1/stat/words",
  },
  nmReportDetail: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/detail",
  },
  nmReportDetailHistory: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/detail/history",
  },
  searchReport: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/search-report/report",
  },
  stocksProducts: {
    method: "POST",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/stocks-report/products/products",
  },
  csvReports: {
    method: "GET",
    baseUrl: "https://seller-analytics-api.wildberries.ru",
    path: "/api/v2/nm-report/downloads",
  },
};
```

Create `src/wb/client.js`:

```js
import axios from "axios";
import { getCabinetToken } from "../cabinets/repository.js";
import { WB_ENDPOINTS } from "./endpoints.js";

export async function callWbApi({ db, config, cabinetId, endpointKey, input }) {
  const endpoint = WB_ENDPOINTS[endpointKey];
  if (!endpoint) {
    throw new Error("Unknown WB endpoint");
  }
  const token = getCabinetToken({ db, config, id: cabinetId });
  const response = await axios({
    method: endpoint.method,
    url: `${endpoint.baseUrl}${endpoint.path}`,
    data: endpoint.method === "GET" ? undefined : input,
    params: endpoint.method === "GET" ? input : undefined,
    headers: { Authorization: token },
    validateStatus: () => true,
    timeout: 30000,
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Wildberries rejected the configured cabinet token");
    err.statusCode = 502;
    throw err;
  }
  if (response.status === 429) {
    const err = new Error("Wildberries rate limit exceeded");
    err.statusCode = 429;
    throw err;
  }
  if (response.status >= 400) {
    const err = new Error(safeWbError(response.data) || "Wildberries API request failed");
    err.statusCode = 502;
    throw err;
  }
  return response.data;
}

function safeWbError(data) {
  if (!data || typeof data !== "object") return "";
  const message = data.message || data.errorText || data.error || "";
  return typeof message === "string" ? message.slice(0, 500) : "";
}
```

- [ ] **Step 4: Register read-only MCP tools**

Extend `src/mcp/server.js`:

```js
import { callWbApi } from "../wb/client.js";
```

Add this helper:

```js
function registerWbTool(server, { name, title, description, endpointKey, inputSchema }, deps) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (args) => {
      requireUser(deps.user);
      const { cabinetId, ...input } = args;
      const data = await callWbApi({
        db: deps.db,
        config: deps.config,
        cabinetId,
        endpointKey,
        input,
      });
      return jsonContent(data);
    },
  );
}
```

Inside `buildMcpServer`, after `list_cabinets`, register:

```js
  const deps = { db, config, user };
  registerWbTool(server, {
    name: "get_advert_fullstats",
    title: "Get advertising full statistics",
    description: "Gets Wildberries advertising campaign full statistics for a cabinet.",
    endpointKey: "advertFullstats",
    inputSchema: { cabinetId: z.string(), request: z.array(z.object({ id: z.number(), dates: z.array(z.string()) })) },
  }, deps);
```

Then update `registerWbTool` to pass `input.request ?? input` so `get_advert_fullstats` sends the array body while other tools send object input:

```js
      const data = await callWbApi({
        db: deps.db,
        config: deps.config,
        cabinetId,
        endpointKey,
        input: input.request ?? input,
      });
```

Register the remaining read-only tools with permissive object inputs for WB-specific report parameters:

```js
  const reportInput = { cabinetId: z.string(), request: z.record(z.any()).default({}) };
  registerWbTool(server, { name: "get_auto_stat_words", title: "Get automatic campaign words", description: "Gets phrase-cluster statistics for an automatic campaign.", endpointKey: "autoStatWords", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "get_campaign_stat_words", title: "Get campaign phrase statistics", description: "Gets keyword phrase statistics for a campaign.", endpointKey: "campaignStatWords", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail", title: "Get product sales funnel detail", description: "Gets product card sales funnel statistics.", endpointKey: "nmReportDetail", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "get_nm_report_detail_history", title: "Get product sales funnel history", description: "Gets product card statistics grouped by day.", endpointKey: "nmReportDetailHistory", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "get_search_report", title: "Get search query report", description: "Gets Wildberries search query report data.", endpointKey: "searchReport", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "get_stocks_products", title: "Get stock product report", description: "Gets stock report data by product.", endpointKey: "stocksProducts", inputSchema: reportInput }, deps);
  registerWbTool(server, { name: "list_csv_reports", title: "List CSV reports", description: "Lists generated seller analytics CSV reports.", endpointKey: "csvReports", inputSchema: reportInput }, deps);
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- --run tests/wb-tools.test.js tests/mcp-auth.test.js tests/cabinets.test.js
```

Expected: PASS for WB client, MCP auth, and cabinet tests.

---

### Task 7: Security Middleware, Rate Limits, And Secret-Safe Errors

**Files:**
- Create: `tests/security.test.js`
- Modify: `src/app.js`
- Modify: `src/admin/routes.js`
- Modify: `src/oauth/routes.js`
- Modify: `src/mcp/http.js`

- [ ] **Step 1: Write failing security behavior tests**

Create `tests/security.test.js`:

```js
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app.js";

describe("public security behavior", () => {
  it("does not allow wildcard CORS credentials on authenticated endpoints", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app).options("/mcp").set("Origin", "https://attacker.example");

    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    cleanup();
  });

  it("redacts server errors from responses", async () => {
    const { app, cleanup } = await createTestApp();

    const res = await request(app)
      .post("/admin/cabinets")
      .set("Authorization", `Basic ${Buffer.from("admin:admin-password").toString("base64")}`)
      .send({ id: "bad space", name: "Bad", wbApiToken: "wb-secret-token" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("wb-secret-token");
    cleanup();
  });
});
```

- [ ] **Step 2: Run tests to verify current gaps**

Run:

```bash
npm test -- --run tests/security.test.js
```

Expected: FAIL until consistent security headers, CORS behavior, and error handling are confirmed.

- [ ] **Step 3: Harden app middleware and errors**

In `src/app.js`, add no wildcard CORS and rate limits:

```js
import rateLimit from "express-rate-limit";
```

Before route mounting:

```js
  const authLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const mcpLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
```

Mount limiters:

```js
  app.use(["/authorize", "/token", "/register"], authLimiter);
  app.use("/mcp", mcpLimiter);
```

Replace the final error handler with:

```js
  app.use((err, _req, res, _next) => {
    const status = err.name === "ZodError" ? 400 : err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    res.status(status).json({
      error: true,
      message: status >= 500 ? "Internal server error" : err.message,
    });
  });
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --run tests/security.test.js tests/oauth-flow.test.js tests/mcp-auth.test.js
```

Expected: PASS for security, OAuth, and MCP auth tests.

---

### Task 8: Docker Deployment, Documentation, Environment Example, And Full Verification

**Files:**
- Create: `.env.example`
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Replace: `README.md`

- [ ] **Step 1: Write `.env.example`**

Create `.env.example`:

```dotenv
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.example
DATABASE_PATH=data/wb-mcp.sqlite

TOKEN_SIGNING_SECRET=replace-with-at-least-32-random-bytes
SESSION_SECRET=replace-with-at-least-32-random-bytes
ENCRYPTION_KEY=replace-with-64-hex-characters-for-aes-256-gcm

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-strong-admin-password
BOOTSTRAP_USER_EMAIL=boss@example.com
BOOTSTRAP_USER_PASSWORD=replace-with-strong-user-password

ALLOWED_REDIRECT_HOSTS=claude.ai,claude.com
```

- [ ] **Step 2: Create Docker deployment files**

Create `.dockerignore`:

```dockerignore
node_modules
npm-debug.log
.git
.env
.env.*
!.env.example
data
logs
coverage
docs/superpowers
```

Create `Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY README.md ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

Create `docker-compose.yml`:

```yaml
services:
  wb-mcp:
    build: .
    container_name: wb-claude-mcp
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
    volumes:
      - wb-mcp-data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  wb-mcp-data:
```

- [ ] **Step 3: Rewrite README**

Replace `README.md` with:

```md
# WB Claude Remote MCP Server

Public remote MCP server for connecting Claude to administrator-configured Wildberries cabinets.

## Security Model

- Claude connects to `/mcp` over public HTTPS.
- Wildberries API tokens are stored only on this server.
- Claude never receives WB API tokens.
- Users authenticate through this service during Claude connector setup.
- OAuth access tokens are required for all WB data tools.
- All authenticated users can access all configured WB cabinets.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

For local Claude testing, expose the local server through a public HTTPS tunnel and use the tunnel URL ending in `/mcp`.

## Docker Deployment

Create `.env` from `.env.example`, fill every secret, then build and start:

```bash
docker compose up -d --build
```

The app listens on container port `3000` and stores SQLite data in the `wb-mcp-data` Docker volume. Put Nginx, Caddy, Traefik, Cloudflare Tunnel, or another HTTPS layer in front of it and set `BASE_URL` to the public HTTPS origin, for example `https://wb-mcp.example.com`.

Check health:

```bash
docker compose ps
docker compose logs -f wb-mcp
curl http://localhost:3000/health
```

## Claude Connector Setup

In Claude, open Settings -> Connectors -> Add custom connector.

- Name: `WB cabinets`
- Remote MCP server URL: `https://your-domain.example/mcp`
- OAuth Client ID: leave empty
- OAuth Client Secret: leave empty

After adding the connector, click Connect. Claude will open the authorization page served by this app. Sign in with the configured service user.

## Admin Cabinet Setup

Create or update a cabinet:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"id":"main","name":"Main WB","wbApiToken":"<WB_API_TOKEN>","notes":"Primary cabinet"}' \
  https://your-domain.example/admin/cabinets
```

List cabinets:

```bash
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" https://your-domain.example/admin/cabinets
```

Admin responses never include WB API tokens.

## MCP Tools

- `list_cabinets`
- `get_advert_fullstats`
- `get_auto_stat_words`
- `get_campaign_stat_words`
- `get_nm_report_detail`
- `get_nm_report_detail_history`
- `get_search_report`
- `get_stocks_products`
- `list_csv_reports`

## Verification

```bash
npm test -- --run
docker compose build
```
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test -- --run
docker compose build
```

Expected: all tests pass and the Docker image builds successfully.

- [ ] **Step 5: Start server locally for smoke test**

Run:

```bash
npm start
```

Expected: server logs `WB Claude MCP server listening on 3000`.

In another shell:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok","service":"wb-claude-mcp","timestamp":"..."}
```

Stop the server after the smoke test.

- [ ] **Step 6: Start server with Docker for smoke test**

Run:

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/health
docker compose down
```

Expected: container is healthy and `/health` returns service status.

---

## Self-Review Checklist

- Spec coverage: OAuth discovery, Claude empty Client ID/Secret setup, admin-only WB token management, all-users-see-all-cabinets behavior, encrypted token storage, MCP auth gate, read-only WB tools, and deployment docs are covered.
- Completion marker scan: no task uses unresolved markers.
- Type consistency: `config.mcpResourceUrl`, `client_id`, `redirect_uri`, `code_challenge`, `cabinetId`, `endpointKey`, and `wbApiToken` are used consistently across tests and implementation steps.
- Security coverage: no WB token is accepted from Claude; all WB tools require service-issued bearer tokens; DCR redirect hosts are allowlisted; token audience is bound to `/mcp`.
