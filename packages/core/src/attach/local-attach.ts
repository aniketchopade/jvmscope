import { execa } from "execa";
import type { AttachResult } from "../session/types.js";

export interface LocalAttachOptions {
  arthasBootJarPath: string;
  /** Arthas's HTTP port (`--http-port`, default 3658/8563); the MCP endpoint is served under it. */
  httpPort: number;
  telnetPort?: number;
  javaBin?: string;
  /** Passed to arthas-boot as --repo-mirror; "aliyun" is much faster from most networks. */
  repoMirror?: string;
}

/**
 * Builds the MCP endpoint URL for an Arthas HTTP port. Arthas serves MCP at the
 * `arthas.mcpEndpoint` path (default `/mcp`) on its HTTP port — NOT at the host root.
 */
export function mcpEndpointFor(baseUrl: string, mcpPath = "/mcp"): string {
  return `${baseUrl.replace(/\/$/, "")}${mcpPath}`;
}

/**
 * Polls the Arthas MCP endpoint until it responds. A bare GET without MCP headers correctly
 * returns 400 ("text/event-stream required in Accept header"), so any non-5xx status means
 * the MCP handler is mounted and serving — that's our readiness signal.
 */
async function waitForMcpEndpoint(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for Arthas MCP endpoint at ${url} (${lastError})`);
}

/**
 * Attaches Arthas to a local PID via arthas-boot.jar and returns the MCP endpoint once it is
 * confirmed reachable.
 *
 * Note: there is no `--mcp-server-port` flag. Arthas exposes MCP on its regular HTTP port,
 * enabled by `arthas.mcpEndpoint=/mcp` in arthas.properties (set by default since Arthas 4.3.4).
 */
export async function attachLocal(pid: string, options: LocalAttachOptions): Promise<AttachResult> {
  const javaBin = options.javaBin ?? "java";
  await execa(
    javaBin,
    [
      "-jar",
      options.arthasBootJarPath,
      pid,
      "--attach-only",
      "--http-port",
      String(options.httpPort),
      ...(options.telnetPort ? ["--telnet-port", String(options.telnetPort)] : []),
      ...(options.repoMirror ? ["--repo-mirror", options.repoMirror] : []),
    ],
    // First attach downloads the Arthas distribution (~18MB), so allow generous time.
    { timeout: 300_000 },
  );

  const mcpEndpoint = mcpEndpointFor(`http://127.0.0.1:${options.httpPort}`);
  await waitForMcpEndpoint(mcpEndpoint);
  return { mcpEndpoint };
}
