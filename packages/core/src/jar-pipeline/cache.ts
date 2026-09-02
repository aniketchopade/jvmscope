import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return hash.digest("hex");
}

/** True if a directory for this jar hash already exists (e.g. `<cacheRoot>/<sha256>/src`), meaning decompilation can be skipped. */
export async function isCached(markerPath: string): Promise<boolean> {
  try {
    await access(markerPath);
    return true;
  } catch {
    return false;
  }
}
