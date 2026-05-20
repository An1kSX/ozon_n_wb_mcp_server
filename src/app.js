import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { authorizationServerMetadata, protectedResourceMetadata } from "./oauth/metadata.js";
import { registerClient } from "./oauth/clients.js";
import { buildOAuthRouter } from "./oauth/routes.js";
import { buildAdminRouter } from "./admin/routes.js";
import { buildMcpRouter } from "./mcp/http.js";

export function buildApp({ config, db, cache }) {
  const app = express();

  app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "font-src": ["'self'", "https:", "data:"],
          "form-action": ["'self'", "https://claude.ai", "https://claude.com"],
          "frame-ancestors": ["'self'"],
          "img-src": ["'self'", "data:"],
          "object-src": ["'none'"],
          "script-src": ["'self'"],
          "script-src-attr": ["'none'"],
          "style-src": ["'self'", "https:", "'unsafe-inline'"],
          "upgrade-insecure-requests": [],
        },
      },
    }),
  );
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

  const authLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const mcpLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.locals.config = config;
  app.locals.db = db;
  app.locals.cache = cache;

  app.get("/health", async (_req, res) => {
    const cacheHealth = cache ? await cache.health() : { enabled: false, status: "disabled" };
    res.json({
      status: "ok",
      service: "wb-claude-mcp",
      cache: cacheHealth,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(protectedResourceMetadata(config));
  });

  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    res.json(protectedResourceMetadata(config));
  });

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json(authorizationServerMetadata(config));
  });

  app.post("/register", authLimiter, async (req, res, next) => {
    try {
      res.status(201).json(await registerClient({ db, config, body: req.body }));
    } catch (err) {
      if (err.oauthError) {
        res.status(err.statusCode).json({ error: err.oauthError, error_description: err.message });
        return;
      }
      next(err);
    }
  });

  app.use(["/authorize", "/token"], authLimiter);
  app.use(buildOAuthRouter({ config, db }));
  app.use("/admin", buildAdminRouter({ config, db }));
  app.use("/mcp", mcpLimiter);
  app.use(buildMcpRouter({ config, db }));

  app.use((err, _req, res, _next) => {
    const status = err.name === "ZodError" ? 400 : err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    res.status(status).json({
      error: true,
      message: status >= 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}
