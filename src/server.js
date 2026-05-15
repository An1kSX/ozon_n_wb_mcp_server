import { buildConfig } from "./config.js";
import { initializeDatabase } from "./db/index.js";
import { buildApp } from "./app.js";

const config = buildConfig();
const db = await initializeDatabase(config);
const app = buildApp({ config, db });

app.listen(config.port, () => {
  console.log(`WB Claude MCP server listening on ${config.port}`);
});
