import { z } from "zod";
import { decryptSecret, encryptSecret } from "../security/crypto.js";

const marketplaceAccountSchema = z.discriminatedUnion("marketplace", [
  z.object({
    id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    marketplace: z.literal("wildberries"),
    name: z.string().min(1).max(200),
    credentials: z.object({
      apiToken: z.string().min(10).max(4096),
    }),
    notes: z.string().max(1000).default(""),
  }),
  z.object({
    id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    marketplace: z.literal("ozon"),
    name: z.string().min(1).max(200),
    credentials: z.object({
      sellerClientId: z.string().min(1).max(256),
      sellerApiKey: z.string().min(10).max(4096),
      performanceClientId: z.string().min(1).max(256).optional(),
      performanceClientSecret: z.string().min(10).max(4096).optional(),
      performanceApiKey: z.string().min(10).max(4096).optional(),
    }),
    notes: z.string().max(1000).default(""),
  }),
]);

export async function createMarketplaceAccount({ db, config, id, marketplace, name, credentials, notes = "" }) {
  const input = marketplaceAccountSchema.parse({ id, marketplace, name, credentials, notes });
  const encrypted = encryptSecret(config, JSON.stringify(input.credentials));
  await db.none(`
    INSERT INTO marketplace_accounts (id, marketplace, name, encrypted_credentials, notes, updated_at)
    VALUES ($1, $2, $3, $4, $5, now())
    ON CONFLICT(id) DO UPDATE SET
      marketplace = EXCLUDED.marketplace,
      name = EXCLUDED.name,
      encrypted_credentials = EXCLUDED.encrypted_credentials,
      notes = EXCLUDED.notes,
      updated_at = now()
  `, [input.id, input.marketplace, input.name, encrypted, input.notes]);
  return getMarketplaceAccount(db, input.id);
}

export async function listMarketplaceAccounts(db) {
  return db.any(`
    SELECT id, marketplace, name, notes, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM marketplace_accounts
    ORDER BY marketplace ASC, name ASC
  `);
}

export async function getMarketplaceAccount(db, id) {
  return db.one(`
    SELECT id, marketplace, name, notes, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM marketplace_accounts
    WHERE id = $1
  `, [id]);
}

export async function getMarketplaceCredentials({ db, config, id, marketplace }) {
  const row = await db.one("SELECT marketplace, encrypted_credentials FROM marketplace_accounts WHERE id = $1", [id]);
  if (!row) {
    const err = new Error("Unknown marketplace account");
    err.statusCode = 404;
    throw err;
  }
  if (marketplace && row.marketplace !== marketplace) {
    const err = new Error(`Marketplace account is not ${marketplace}`);
    err.statusCode = 400;
    throw err;
  }
  return JSON.parse(decryptSecret(config, row.encrypted_credentials));
}
