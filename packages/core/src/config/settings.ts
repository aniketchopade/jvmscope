import { join } from "node:path";

export interface TunnelServerSettings {
  /** e.g. "ws://relay.internal:7777/ws" — where in-pod agents register. */
  agentWsUrl: string;
  /** e.g. "http://relay.internal:8080" — where the UI/MCP client connects. */
  clientHttpUrl: string;
}

export interface Settings {
  kubectlContext?: string;
  /** Bundled arthas-boot.jar path, used for air-gapped pod bootstrap. */
  arthasBootJarPath: string;
  /** Bundled CFR decompiler jar path. */
  cfrJarPath: string;
  /**
   * Arthas's HTTP port (`--http-port`). MCP is served under this port at the
   * `arthas.mcpEndpoint` path (default `/mcp`) — there is no separate MCP port.
   */
  defaultHttpPort: number;
  /** arthas-boot `--repo-mirror`; "aliyun" is substantially faster from most networks. */
  repoMirror?: string;
  tunnelServer?: TunnelServerSettings;
  workspaceRoot: string;
}

export function defaultSettings(homeDir: string): Settings {
  const root = join(homeDir, ".jvmscope");
  return {
    arthasBootJarPath: join(root, "bin", "arthas-boot.jar"),
    cfrJarPath: join(root, "bin", "cfr.jar"),
    defaultHttpPort: 8563,
    repoMirror: "aliyun",
    workspaceRoot: join(root, "sessions"),
  };
}
