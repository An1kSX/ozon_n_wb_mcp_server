import jwt from "jsonwebtoken";
import { randomToken, sha256 } from "../security/crypto.js";
import { verifyPkceS256 } from "./pkce.js";

const ACCESS_TOKEN_TTL_SECONDS = 900;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueAuthorizationCode({ db, clientId, userId, redirectUri, scope, resource, codeChallenge }) {
  const code = randomToken(32);
  await db.none(`
    INSERT INTO authorization_codes
      (code_hash, client_id, user_id, redirect_uri, scope, resource, code_challenge, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [sha256(code), clientId, userId, redirectUri, scope, resource, codeChallenge, Date.now() + AUTH_CODE_TTL_MS]);
  return code;
}

export async function exchangeAuthorizationCode({ db, config, clientId, code, redirectUri, codeVerifier, resource }) {
  const row = await db.one("SELECT * FROM authorization_codes WHERE code_hash = $1", [sha256(code || "")]);
  if (!row || row.consumed_at || row.expires_at < Date.now()) throwOAuth("invalid_grant", "Authorization code is invalid");
  if (row.client_id !== clientId || row.redirect_uri !== redirectUri || row.resource !== resource) {
    throwOAuth("invalid_grant", "Authorization code binding does not match");
  }
  if (!verifyPkceS256(codeVerifier || "", row.code_challenge)) throwOAuth("invalid_grant", "PKCE verification failed");

  await db.none("UPDATE authorization_codes SET consumed_at = $1 WHERE code_hash = $2", [Date.now(), sha256(code)]);
  return issueTokenPair({ db, config, clientId, userId: row.user_id, scope: row.scope, resource: row.resource });
}

export async function issueTokenPair({ db, config, clientId, userId, scope, resource }) {
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
  await db.none(`
    INSERT INTO refresh_tokens (token_hash, client_id, user_id, scope, resource, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [sha256(refreshToken), clientId, userId, scope, resource, Date.now() + REFRESH_TOKEN_TTL_MS]);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope,
  };
}

export async function refreshAccessToken({ db, config, clientId, refreshToken }) {
  const hash = sha256(refreshToken || "");
  const row = await db.one("SELECT * FROM refresh_tokens WHERE token_hash = $1", [hash]);
  if (!row || row.revoked_at || row.expires_at < Date.now() || row.client_id !== clientId) {
    throwOAuth("invalid_grant", "Refresh token is invalid");
  }
  await db.none("UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2", [Date.now(), hash]);
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
