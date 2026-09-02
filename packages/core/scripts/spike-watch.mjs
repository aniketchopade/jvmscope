/**
 * Phase 0 Spike B (part 2): run real watch/trace/tt commands against a live JVM
 * through our ArthasMcpClient + runCommand, exactly as the UI's CommandPanel would.
 */
import { ArthasMcpClient } from "../dist/mcp/client.js";
import { runCommand } from "../dist/mcp/command-runner.js";

const endpoint = process.argv[2] ?? "http://127.0.0.1:8563/mcp";
const client = new ArthasMcpClient(endpoint);
await client.connect();
console.log("connected.\n");

async function run(tool, params) {
  console.log(`########## ${tool} ${JSON.stringify(params)} ##########`);
  const record = await runCommand(client, tool, params, (_rec, chunk) => {
    process.stdout.write(`[chunk] ${chunk.slice(0, 400)}\n`);
  });
  if (record.error) console.log(`!! error: ${record.error}`);
  console.log(`-- ${record.chunks.length} chunk(s), ${record.startedAt} -> ${record.finishedAt}\n`);
  return record;
}

await run("watch", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  express: "{params, returnObj}",
  numberOfExecutions: 2,
  timeout: 20,
});

await run("trace", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  numberOfExecutions: 1,
  timeout: 20,
});

await run("tt", { timeTunnel: true, classPattern: "com.example.demo.PricingEngine", methodPattern: "computeTotal", numberOfExecutions: 1, timeout: 20 });

await client.disconnect();
console.log("disconnected.");
