import express from "express";
import crypto from "node:crypto";
import { createMarketplaceAccount, listMarketplaceAccounts } from "../accounts/repository.js";

export function buildAdminRouter({ config, db }) {
  const router = express.Router();
  router.use((req, res, next) => {
    const header = req.get("authorization") || "";
    const [scheme, encoded] = header.split(" ");
    if (scheme !== "Basic" || !encoded) {
      writeAdminChallenge(res);
      return;
    }
    const [username, password] = Buffer.from(encoded, "base64").toString("utf8").split(":");
    if (username !== config.adminUsername || password !== config.adminPassword) {
      writeAdminChallenge(res);
      return;
    }
    next();
  });

  router.get("/", async (req, res, next) => {
    try {
      const csrfToken = ensureAdminCsrfToken(req);
      const accounts = await listMarketplaceAccounts(db);
      res.type("html").send(renderAdminPage({ accounts, csrfToken }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/accounts", async (_req, res, next) => {
    try {
      res.json({ items: await listMarketplaceAccounts(db) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/accounts", async (req, res, next) => {
    try {
      const account = await createMarketplaceAccount({ db, config, ...req.body });
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  });

  router.post("/accounts/form", async (req, res, next) => {
    try {
      if (!isValidAdminCsrfToken(req)) {
        res.status(403).type("html").send(renderMessagePage("Forbidden", "Invalid admin form token."));
        return;
      }
      const account = accountFromForm(req.body);
      await createMarketplaceAccount({ db, config, ...account });
      res.redirect(303, "/admin");
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function ensureAdminCsrfToken(req) {
  if (!req.session.adminCsrfToken) {
    req.session.adminCsrfToken = crypto.randomBytes(32).toString("base64url");
  }
  return req.session.adminCsrfToken;
}

function isValidAdminCsrfToken(req) {
  const expected = req.session.adminCsrfToken;
  const actual = typeof req.body?._csrf === "string" ? req.body._csrf : "";
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function accountFromForm(body) {
  const base = {
    id: normalizeFormValue(body.id),
    marketplace: normalizeFormValue(body.marketplace),
    name: normalizeFormValue(body.name),
    notes: normalizeFormValue(body.notes),
  };

  if (base.marketplace === "wildberries") {
    return {
      ...base,
      credentials: {
        apiToken: normalizeFormValue(body.apiToken),
      },
    };
  }

  return {
    ...base,
    credentials: withoutEmpty({
      sellerClientId: normalizeFormValue(body.sellerClientId),
      sellerApiKey: normalizeFormValue(body.sellerApiKey),
      performanceClientId: normalizeFormValue(body.performanceClientId),
      performanceClientSecret: normalizeFormValue(body.performanceClientSecret),
      performanceApiKey: normalizeFormValue(body.performanceApiKey),
    }),
  };
}

function normalizeFormValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withoutEmpty(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
}

function renderAdminPage({ accounts, csrfToken }) {
  const rows = accounts.map((account) => `
      <tr>
        <td><code>${escapeHtml(account.id)}</code></td>
        <td>${escapeHtml(account.marketplace)}</td>
        <td>${escapeHtml(account.name)}</td>
        <td>${escapeHtml(account.notes || "")}</td>
        <td>${escapeHtml(formatDate(account.updatedAt))}</td>
      </tr>
    `).join("");

  return htmlPage("Marketplace Admin", `
    <header>
      <h1>Marketplace Admin</h1>
      <p>Manage Wildberries and Ozon accounts available to Claude.</p>
    </header>

    <section>
      <h2>Connected Accounts</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Marketplace</th>
              <th>Name</th>
              <th>Notes</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" class="muted">No accounts configured yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <main class="forms">
      <section>
        <h2>Add Wildberries</h2>
        <form method="post" action="/admin/accounts/form" autocomplete="off">
          ${csrfInput(csrfToken)}
          <input type="hidden" name="marketplace" value="wildberries">
          ${field("id", "Account ID", "wb-main", true)}
          ${field("name", "Display Name", "Main WB", true)}
          ${field("apiToken", "WB API Token", "", true, "password")}
          ${field("notes", "Notes", "", false)}
          <button type="submit">Save Wildberries Account</button>
        </form>
      </section>

      <section>
        <h2>Add Ozon</h2>
        <form method="post" action="/admin/accounts/form" autocomplete="off">
          ${csrfInput(csrfToken)}
          <input type="hidden" name="marketplace" value="ozon">
          ${field("id", "Account ID", "ozon-main", true)}
          ${field("name", "Display Name", "Main Ozon", true)}
          ${field("sellerClientId", "Seller Client ID", "", true)}
          ${field("sellerApiKey", "Seller API Key", "", true, "password")}
          ${field("performanceClientId", "Performance Client ID", "", false)}
          ${field("performanceClientSecret", "Performance Client Secret", "", false, "password")}
          ${field("performanceApiKey", "Performance API Key", "", false, "password")}
          ${field("notes", "Notes", "", false)}
          <button type="submit">Save Ozon Account</button>
        </form>
      </section>
    </main>
  `);
}

function renderMessagePage(title, message) {
  return htmlPage(title, `<section><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/admin">Back to admin</a></section>`);
}

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; background: #f6f7f9; color: #17202a; }
    body { margin: 0; }
    header, section, main { max-width: 1120px; margin: 0 auto; }
    header { padding: 32px 24px 12px; }
    section { padding: 16px 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 0 0 16px; font-size: 20px; }
    p { margin: 0; color: #5d6978; }
    .table-wrap { overflow-x: auto; border: 1px solid #d8dde6; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #e6eaf0; text-align: left; font-size: 14px; }
    th { background: #eef2f7; font-weight: 700; }
    code { font-family: Consolas, monospace; }
    .muted { color: #6b7785; text-align: center; }
    .forms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: 8px 24px 40px; }
    .forms section { margin: 0; padding: 20px; background: #fff; border: 1px solid #d8dde6; }
    label { display: block; margin: 0 0 12px; font-size: 14px; font-weight: 700; }
    input { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid #b9c1cc; font: inherit; }
    button { width: 100%; margin-top: 8px; padding: 11px 14px; border: 0; background: #175cd3; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    a { color: #175cd3; }
    @media (max-width: 760px) { .forms { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function csrfInput(value) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(value)}">`;
}

function field(name, label, placeholder, required, type = "text") {
  return `<label>${escapeHtml(label)}
    <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}"${required ? " required" : ""}>
  </label>`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function writeAdminChallenge(res) {
  res
    .set("WWW-Authenticate", 'Basic realm="admin"')
    .status(401)
    .json({ error: true, message: "Admin auth required" });
}
