/** Phase 0 Spike C: explode + CFR-decompile a real jar through our pipeline. */
import { explodeJar } from "../dist/jar-pipeline/explode.js";
import { decompileJar, decompileClassesDir } from "../dist/jar-pipeline/decompile.js";
import { createSessionWorkspace } from "../dist/jar-pipeline/workspace-layout.js";
import { sha256File } from "../dist/jar-pipeline/cache.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const jarPath = process.argv[2];
const cfrJarPath = join(homedir(), ".jvmscope", "bin", "cfr.jar");

const ws = await createSessionWorkspace(join(tmpdir(), "jvmscope-spike"), "jar-spike");
console.log("workspace:", ws.root);

console.log("sha256:", (await sha256File(jarPath)).slice(0, 16), "...");

const t0 = Date.now();
const { classesDir, isFatJar } = await explodeJar(jarPath, ws.explodedDir);
console.log(`exploded in ${Date.now() - t0}ms -> classesDir=${classesDir} isFatJar=${isFatJar}`);

const t1 = Date.now();
let progressLines = 0;
const n = isFatJar ? await decompileClassesDir(classesDir, ws.srcDir, { cfrJarPath, onProgress: () => progressLines++ }) : await decompileJar(jarPath, ws.srcDir, { cfrJarPath, onProgress: () => progressLines++ });
console.log(`CFR reported ${n} processed entries`);
console.log(`decompiled in ${Date.now() - t1}ms (${progressLines} progress lines)`);

async function walk(dir, depth = 0) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    console.log("  ".repeat(depth) + (e.isDirectory() ? `${e.name}/` : e.name));
    if (e.isDirectory()) await walk(join(dir, e.name), depth + 1);
  }
}
console.log("\n=== decompiled tree ===");
await walk(ws.srcDir);

const sample = join(ws.srcDir, "com", "example", "demo", "PricingEngine.java");
console.log(`\n=== ${sample} ===`);
console.log(await readFile(sample, "utf-8"));
