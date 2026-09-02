import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256File, isCached } from "../src/jar-pipeline/cache.js";

describe("jar cache", () => {
  it("hashes file contents deterministically", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jvmscope-test-"));
    try {
      const filePath = join(dir, "sample.txt");
      await writeFile(filePath, "hello world");
      const hash1 = await sha256File(filePath);
      const hash2 = await sha256File(filePath);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports cache misses and hits via marker file presence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jvmscope-test-"));
    try {
      const marker = join(dir, ".decompiled-abc123");
      expect(await isCached(marker)).toBe(false);
      await writeFile(marker, "");
      expect(await isCached(marker)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
