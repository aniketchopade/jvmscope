import type { KubectlOptions } from "../kubectl/exec.js";
import { kubectlExec } from "../kubectl/exec.js";
import { mcpEndpointFor } from "./local-attach.js";
import type { AttachResult, PodRef } from "../session/types.js";

export interface KubectlAttachOptions {
  /** Path to arthas-boot.jar *inside the pod* (copied there ahead of time, or already present). */
  remoteArthasBootJarPath: string;
  /** Arthas's HTTP port inside the pod; MCP is served under it at /mcp. */
  httpPort: number;
  appName: string;
  /** When set, bootstraps with --tunnel-server so the agent registers itself (Phase 3). */
  tunnelServerWsUrl?: string;
  /** Phase 3: pins the agent's id so the Tunnel Server can be addressed deterministically. */
  agentId?: string;
  /**
   * Phase 2: the local port a `kubectl port-forward` bridge exposes the pod's httpPort on.
   * When omitted (Phase 3 / tunnel mode) the caller resolves the endpoint from the Tunnel Server.
   */
  localForwardedPort?: number;
}

/**
 * Phase 2/3: kubectl-execs `java -jar arthas-boot.jar <pid> ...` inside the pod.
 *
 * Phase 2 callers pair this with a PortForwardBridge and pass localForwardedPort, so the
 * returned endpoint points at the forwarded localhost port.
 * Phase 3 callers pass tunnelServerWsUrl + agentId; the agent registers itself with the
 * Tunnel Server and the caller resolves the agentId-addressed URL from the Tunnel Server's
 * client API instead of using a local port.
 */
export async function attachInPod(
  ref: PodRef,
  pid: string,
  options: KubectlAttachOptions,
  kubectlOpts?: KubectlOptions,
): Promise<AttachResult> {
  const command = [
    "java",
    "-jar",
    options.remoteArthasBootJarPath,
    pid,
    "--attach-only",
    "--http-port",
    String(options.httpPort),
    "--app-name",
    options.appName,
    ...(options.tunnelServerWsUrl ? ["--tunnel-server", options.tunnelServerWsUrl] : []),
    ...(options.agentId ? ["--agent-id", options.agentId] : []),
  ];
  await kubectlExec(ref, command, kubectlOpts);

  if (options.localForwardedPort) {
    return { mcpEndpoint: mcpEndpointFor(`http://127.0.0.1:${options.localForwardedPort}`), agentId: options.agentId };
  }

  // Tunnel mode: the endpoint is resolved by the caller from the Tunnel Server's client API.
  return { mcpEndpoint: "", agentId: options.agentId };
}
