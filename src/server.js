import { buildConfig } from "./config.js";
import { initializeDatabase } from "./db/index.js";
import { buildApp } from "./app.js";
import { buildCache } from "./cache/redis.js";

const config = buildConfig();
const db = await initializeDatabase(config);
const cache = buildCache(config);
await cache.connect();
const app = buildApp({ config, db, cache });

const server = app.listen(config.port, () => {
  console.log(`WB Claude MCP server listening on ${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await cache.close();
    await db.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
