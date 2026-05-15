import express from "express";
import bcrypt from "bcryptjs";
import { getClient, isRedirectAllowedForClient } from "./clients.js";
import { exchangeAuthorizationCode, issueAuthorizationCode, refreshAccessToken } from "./tokens.js";

export function buildOAuthRouter({ config, db }) {
  const router = express.Router();

  router.get("/authorize", (req, res) => {
    res.type("html").send(renderLoginForm(req.query, ""));
  });

  router.post("/authorize", async (req, res, next) => {
    try {
      const user = await db.one("SELECT * FROM users WHERE email = $1", [req.body.email]);
      if (!user || !bcrypt.compareSync(req.body.password || "", user.password_hash)) {
        res.status(401).type("html").send(renderLoginForm(req.body, "Invalid email or password"));
        return;
      }
      const client = await getClient(db, req.body.client_id);
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
      const code = await issueAuthorizationCode({
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

  router.post("/token", async (req, res) => {
    try {
      if (req.body.grant_type === "authorization_code") {
        res.json(await exchangeAuthorizationCode({
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
        res.json(await refreshAccessToken({
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
