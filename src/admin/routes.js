import express from "express";
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

  return router;
}

function writeAdminChallenge(res) {
  res
    .set("WWW-Authenticate", 'Basic realm="admin"')
    .status(401)
    .json({ error: true, message: "Admin auth required" });
}
