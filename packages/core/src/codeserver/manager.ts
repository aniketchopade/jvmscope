import { execa, type ResultPromise } from "execa";
import getPort from "get-port";
import { access } from "node:fs/promises";
import type { CodeServerHandle } from "../session/types.js";
import { windowsToWslPath } from "./wsl.js";

export interface CodeServerBinary {
  /** Path to the code-server executable — a Windows/macOS/Linux path when runner is "native", or a path *inside WSL2* (e.g. /home/user/.local/bin/code-server) when runner is "wsl". */
  binPath: string;
  /** "wsl" on Windows (code-server has no native Windows build — see provisionCodeServer). */
  runner?: "native" | "wsl";
  wslDistro?: string;
}

/**
 * Manages code-server processes. One instance per session (not shared): isolation between
 * concurrent sessions, a clean 1:1 lifecycle (attach spawns it, close-session kills it), and
 * it matches the product's "one attach -> one folder" mental model. The idle-memory cost of
 * multiple instances is acceptable given realistic concurrency (a handful of sessions).
 *
 * Binary provisioning (first-run download/install + checksum) is intentionally out of scope
 * for this class — callers resolve a CodeServerBinary and pass it in, keeping network/install
 * concerns separate from process lifecycle.
 */
export class CodeServerManager {
  private processes = new Map<string, ResultPromise>();

  async spawn(sessionId: string, workspaceDir: string, binary: CodeServerBinary): Promise<CodeServerHandle> {
    const port = await getPort({ port: [8590, 8591, 8592, 8593, 8594, 8595] });
    // Workspace trust is pointless here — the workspace is decompiled output this app just
    // generated — and its prompt otherwise covers the editor on every session.
    const baseArgs = [
      "--bind-addr",
      `127.0.0.1:${port}`,
      "--auth",
      "none",
      "--disable-telemetry",
      "--disable-workspace-trust",
      "--disable-update-check",
    ];

    // code-server resolves this path inside its own filesystem, so under WSL it must be the
    // /mnt/... form — for BOTH the CLI argument and the ?folder= URL below. Passing the raw
    // Windows path to ?folder= makes code-server report "Unable to resolve resource C:\...".
    const workspaceForServer = binary.runner === "wsl" ? windowsToWslPath(workspaceDir) : workspaceDir;

    let subprocess: ResultPromise;
    if (binary.runner === "wsl") {
      subprocess = execa(
        "wsl.exe",
        [...(binary.wslDistro ? ["-d", binary.wslDistro] : []), "--", binary.binPath, ...baseArgs, workspaceForServer],
        { reject: false },
      );
    } else {
      await access(binary.binPath);
      subprocess = execa(binary.binPath, [...baseArgs, workspaceForServer], { reject: false });
    }
    this.processes.set(sessionId, subprocess);

    // WSL2 forwards a service bound to 127.0.0.1 inside the distro to the same port on the
    // Windows-side localhost automatically, so this URL is correct for both runners.
    await waitForHttp(`http://127.0.0.1:${port}`);

    const pid = subprocess.pid;
    if (pid === undefined) {
      throw new Error("code-server failed to start (no pid)");
    }

    return { port, pid, url: `http://127.0.0.1:${port}/?folder=${encodeURIComponent(workspaceForServer)}` };
  }

  stop(sessionId: string): void {
    const subprocess = this.processes.get(sessionId);
    subprocess?.kill();
    this.processes.delete(sessionId);
  }

  stopAll(): void {
    for (const sessionId of this.processes.keys()) this.stop(sessionId);
  }
}

async function waitForHttp(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for code-server at ${url}`);
}
