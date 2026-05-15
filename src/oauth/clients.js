import crypto from "node:crypto";
import { z } from "zod";

const registrationSchema = z.object({
  client_name: z.string().min(1).max(200).default("Claude"),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
});

export async function registerClient({ db, config, body }) {
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
  await db.none(
    "INSERT INTO oauth_clients (client_id, client_name, redirect_uris) VALUES ($1, $2, $3::jsonb)",
    [clientId, input.client_name, JSON.stringify(input.redirect_uris)],
  );

  return {
    client_id: clientId,
    client_name: input.client_name,
    redirect_uris: input.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

export async function getClient(db, clientId) {
  const row = await db.one("SELECT * FROM oauth_clients WHERE client_id = $1", [clientId]);
  if (!row) return null;
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: Array.isArray(row.redirect_uris) ? row.redirect_uris : JSON.parse(row.redirect_uris),
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
