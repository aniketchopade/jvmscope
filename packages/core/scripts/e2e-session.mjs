/**
 * Full end-to-end test of the SessionManager pipeline against a live local JVM:
 * attach -> fetch jar -> explode -> decompile -> start code-server -> connect MCP -> run commands.
 * This is exactly the flow the Electron app drives via IPC.
 *
 * Usage: node scripts/e2e-session.mjs <pid> <jarPath>
 */
import { SessionManager } from "../dist/session/session-manager.js";
import { defaultSettings } from "../dist/config/settings.js";
import { provisionCodeServer } from "../dist/codeserver/provisioner.js";
import { LocalPidDiscovery } from "../dist/discovery/local-jps.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

const [, , pidArg, jarPath] = process.argv;

console.log("=== 1. discovery ===");
const targets = await new LocalPidDiscovery().listTargets();
for (const t of targets) console.log(`  pid=${t.pid} ${t.displayName} (mode=${t.mode})`);
const target = targets.find((t) => t.pid === pidArg);
if (!target) throw new Error(`pid ${pidArg} not found in jps output`);
console.log(`  -> selected ${target.pid} ${target.displayName}`);

console.log("\n=== 2. provision code-server ===");
const codeServerBinary = await provisionCodeServer(join(homedir(), ".jvmscope", "bin", "code-server"));
console.log("  binary:", codeServerBinary.binPath, "runner:", codeServerBinary.runner);

console.log("\n=== 3. attach pipeline ===");
const settings = defaultSettings(homedir());
const manager = new SessionManager(settings);
manager.on("status-changed", (id, status) => console.log(`  [status] ${status}`));

const session = await manager.attach({
  target,
  jarLocation: { path: jarPath },
  appName: "e2e-demo",
  codeServerBinary,
});

if (session.status === "error") {
  console.error("\n!! ATTACH FAILED:", session.error);
  process.exit(1);
}

console.log("\n=== 4. session state ===");
console.log("  workspace:", session.workspace.root);
console.log("  jar sha256:", session.jarSource.sha256.slice(0, 16), "...");
console.log("  code-server:", session.codeServer.url);
console.log("  mcp endpoint:", session.mcp.endpoint, "connected:", session.mcp.connected);
console.log("  tools available:", session.mcp.toolCatalog.length);

console.log("\n=== 5. decompiled sources in workspace ===");
async function walk(dir, depth = 0) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    console.log("   " + "  ".repeat(depth) + (e.isDirectory() ? e.name + "/" : e.name));
    if (e.isDirectory() && depth < 4) await walk(join(dir, e.name), depth + 1);
  }
}
await walk(session.workspace.srcDir);

console.log("\n=== 6. verify code-server serves the workspace ===");
const csRes = await fetch(`http://127.0.0.1:${session.codeServer.port}/`);
console.log("  GET code-server ->", csRes.status, csRes.headers.get("content-type"));

console.log("\n=== 7. run watch via session manager ===");
const watchRec = await manager.runCommand(session.id, "watch", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  express: "{params, returnObj}",
  numberOfExecutions: 2,
  timeout: 15,
});
console.log("  chunks:", watchRec.chunks.length, "error:", watchRec.error ?? "none");
console.log("  ", (watchRec.chunks[0] ?? "").slice(0, 300));

console.log("\n=== 8. run trace via session manager ===");
const traceRec = await manager.runCommand(session.id, "trace", {
  classPattern: "com.example.demo.OrderService",
  methodPattern: "placeOrder",
  numberOfExecutions: 1,
  timeout: 15,
});
console.log("  chunks:", traceRec.chunks.length, "error:", traceRec.error ?? "none");
console.log("  ", (traceRec.chunks[0] ?? "").slice(0, 300));

console.log("\n=== 9. command log ===");
console.log("  session.commandLog entries:", session.commandLog.length);

console.log("\n=== 10. close session ===");
await manager.close(session.id);
console.log("  status:", session.status);

process.exit(0);
