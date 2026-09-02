/** Captures real Arthas MCP payloads to a fixture file for UI verification + tests. */
import { ArthasMcpClient } from "../dist/mcp/client.js";
import { runCommand } from "../dist/mcp/command-runner.js";
import { writeFile } from "node:fs/promises";

const client = new ArthasMcpClient(process.argv[2] ?? "http://127.0.0.1:8563/mcp");
await client.connect();

const out = {};
async function cap(name, tool, params) {
  const rec = await runCommand(client, tool, params);
  out[name] = rec.chunks;
  console.log(name, "->", rec.chunks.length, "chunk(s)", rec.error ?? "");
}

await cap("watch", "watch", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  express: "{params, returnObj}",
  numberOfExecutions: 3,
  timeout: 15,
});
await cap("trace", "trace", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  numberOfExecutions: 2,
  timeout: 15,
});
await cap("ttRecord", "tt", {
  action: "record",
  classPattern: "com.example.demo.PricingEngine",
  methodPattern: "computeTotal",
  numberOfExecutions: 3,
  timeout: 15,
});
await cap("ttList", "tt", { action: "list" });
await cap("error", "tt", { classPattern: "x" });

await writeFile(process.argv[3], JSON.stringify(out, null, 2));
console.log("wrote", process.argv[3]);
await client.disconnect();
