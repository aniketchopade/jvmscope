import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionWorkspace } from "../session/types.js";

export async function createSessionWorkspace(workspaceRoot: string, sessionId: string): Promise<SessionWorkspace> {
  const root = join(workspaceRoot, sessionId);
  const rawDir = join(root, "raw");
  const explodedDir = join(root, "exploded");
  const srcDir = join(root, "src");

  await Promise.all([mkdir(rawDir, { recursive: true }), mkdir(explodedDir, { recursive: true }), mkdir(srcDir, { recursive: true })]);

  await mkdir(join(root, ".vscode"), { recursive: true });

  return { root, rawDir, explodedDir, srcDir };
}
