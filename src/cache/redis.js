import { createClient } from "redis";

export function buildCache(config) {
  if (!config.redisUrl) {
    return disabledCache();
  }

  const client = createClient({ url: config.redisUrl });
  let ready = false;

  client.on("ready", () => {
    ready = true;
  });
  client.on("end", () => {
    ready = false;
  });
  client.on("error", (err) => {
    ready = false;
    console.error("Redis cache error:", err.message);
  });

  return {
    enabled: true,
    async connect() {
      if (!client.isOpen) {
        await client.connect();
      }
    },
    async get(key) {
      if (!ready) return null;
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    },
    async set(key, value, ttlSeconds = config.cacheDefaultTtlSeconds) {
      if (!ready) return;
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    },
    async del(key) {
      if (!ready) return;
      await client.del(key);
    },
    async health() {
      if (!client.isOpen) return { enabled: true, status: "disconnected" };
      const pong = await client.ping();
      return { enabled: true, status: pong === "PONG" ? "ok" : "degraded" };
    },
    async close() {
      if (client.isOpen) {
        await client.quit();
      }
    },
  };
}

function disabledCache() {
  return {
    enabled: false,
    connect: async () => {},
    get: async () => null,
    set: async () => {},
    del: async () => {},
    health: async () => ({ enabled: false, status: "disabled" }),
    close: async () => {},
  };
}
