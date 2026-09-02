import { ArthasMcpClient } from "../dist/mcp/client.js";
import { runCommand } from "../dist/mcp/command-runner.js";

const client = new ArthasMcpClient(process.argv[2] ?? "http://127.0.0.1:8563/mcp");
await client.connect();

async function run(tool, params) {
  console.log(`\n########## ${tool} ${JSON.stringify(params)} ##########`);
  const rec = await runCommand(client, tool, params);
  for (const c of rec.chunks) console.log(c.slice(0, 900));
  if (rec.error) console.log("!! error:", rec.error);
  return rec;
}

await run("tt", {
  action: "record",
  classPattern: "com.example.demo.PricingEngine",
  methodPattern: "computeTotal",
  numberOfExecutions: 3,
  timeout: 20,
});

await run("tt", { action: "list" });
await run("tt", { action: "info", index: 1000 });
await run("tt", { action: "replay", index: 1000 });

await client.disconnect();
