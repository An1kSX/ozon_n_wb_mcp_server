export function buildConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
  const defaultRedirectHosts = env.NODE_ENV === "production"
    ? "claude.ai,claude.com"
    : "claude.ai,claude.com,localhost,127.0.0.1";
  return {
    env: env.NODE_ENV || "development",
    port,
    baseUrl,
    mcpResourceUrl: `${baseUrl}/mcp`,
    databaseUrl: requireSecret(env, "DATABASE_URL", "postgres://postgres:postgres@localhost:5432/wb_mcp"),
    databasePoolMax: Number(env.DATABASE_POOL_MAX || 10),
    redisUrl: env.REDIS_URL || "",
    cacheDefaultTtlSeconds: Number(env.CACHE_DEFAULT_TTL_SECONDS || 300),
    tokenSigningSecret: requireSecret(env, "TOKEN_SIGNING_SECRET", "dev-token-signing-secret-change-me-32"),
    encryptionKey: requireSecret(env, "ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    sessionSecret: requireSecret(env, "SESSION_SECRET", "dev-session-secret-change-me-32"),
    adminUsername: env.ADMIN_USERNAME || "admin",
    adminPassword: env.ADMIN_PASSWORD || "admin-password-change-me",
    bootstrapUserEmail: env.BOOTSTRAP_USER_EMAIL || "boss@example.com",
    bootstrapUserPassword: env.BOOTSTRAP_USER_PASSWORD || "change-me",
    allowedRedirectHosts: (env.ALLOWED_REDIRECT_HOSTS || defaultRedirectHosts)
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
