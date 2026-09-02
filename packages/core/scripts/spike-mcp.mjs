/**
 * Phase 0 Spike B: drive a live Arthas MCP Server through our ArthasMcpClient wrapper.
 * Usage: node scripts/spike-mcp.mjs [endpoint]
 */
import { ArthasMcpClient } from "../dist/mcp/client.js";

const endpoint = process.argv[2] ?? "http://127.0.0.1:8563/mcp";
const client = new ArthasMcpClient(endpoint);

console.log(`connecting to ${endpoint} ...`);
await client.connect();
console.log("connected.");

const tools = await client.listTools();
console.log(`\ntools/list returned ${tools.length} tools:`);
for (const t of tools) {
  console.log(`  - ${t.name}: ${(t.description ?? "").slice(0, 80)}`);
}

const watch = tools.find((t) => t.name === "watch");
if (watch) {
  console.log("\n=== watch tool inputSchema ===");
  console.log(JSON.stringify(watch.inputSchema, null, 2).slice(0, 1500));
}

await client.disconnect();
console.log("\ndisconnected.");
