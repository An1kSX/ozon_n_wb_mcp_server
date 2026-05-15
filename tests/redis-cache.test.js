import { describe, expect, it } from "vitest";
import { buildConfig } from "../src/config.js";
import { buildCache } from "../src/cache/redis.js";

describe("Redis cache configuration", () => {
  it("builds a disabled cache when Redis URL is empty", async () => {
    const config = buildConfig({ NODE_ENV: "test", REDIS_URL: "" });
    const cache = buildCache(config);

    expect(cache.enabled).toBe(false);
    await expect(cache.get("missing")).resolves.toBeNull();
  });

  it("reads Redis URL and default TTL from environment", () => {
    const config = buildConfig({
      NODE_ENV: "test",
      REDIS_URL: "redis://redis:6379/0",
      CACHE_DEFAULT_TTL_SECONDS: "900",
    });

    expect(config.redisUrl).toBe("redis://redis:6379/0");
    expect(config.cacheDefaultTtlSeconds).toBe(900);
  });
});
