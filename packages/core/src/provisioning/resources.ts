import { access, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { dirname } from "node:path";

const CFR_VERSION = "0.152";
const CFR_URL = `https://github.com/leibnitz27/cfr/releases/download/${CFR_VERSION}/cfr-${CFR_VERSION}.jar`;
const ARTHAS_BOOT_URL = "https://arthas.aliyun.com/arthas-boot.jar";

async function downloadIfMissing(url: string, destPath: string): Promise<void> {
  try {
    await access(destPath);
    return;
  } catch {
    // not yet provisioned
  }

  await mkdir(dirname(destPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  const out = createWriteStream(destPath);
  await finished(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(out));
}

/** Downloads CFR (decompiler) and arthas-boot.jar (local-attach bootstrap) on first run. */
export async function provisionResources(opts: { cfrJarPath: string; arthasBootJarPath: string }): Promise<void> {
  await Promise.all([
    downloadIfMissing(CFR_URL, opts.cfrJarPath),
    downloadIfMissing(ARTHAS_BOOT_URL, opts.arthasBootJarPath),
  ]);
}
