export type SessionMode = "local" | "pod" | "pod-tunnel";

export interface PodRef {
  namespace: string;
  pod: string;
  container?: string;
}

/** A Java process available to attach to, normalized across discovery modes. */
export interface DiscoveredTarget {
  pid: string;
  /** Main class or jar path as reported by `jps -l`. */
  displayName: string;
  mode: SessionMode;
  podRef?: PodRef;
  /** Set only when discovered via the Tunnel Server's agent registry (Phase 3). */
  agentId?: string;
}

export type SessionStatus =
  | "discovering"
  | "attaching"
  | "fetching-jar"
  | "exploding"
  | "decompiling"
  | "starting-editor"
  | "connecting-mcp"
  | "ready"
  | "error"
  | "closed";

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface CommandRecord {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  /** Streamed text chunks (Arthas output is ANSI-formatted, rendered via xterm.js). */
  chunks: string[];
  error?: string;
}

export interface AttachResult {
  mcpEndpoint: string;
  /** agentId is only present when reached through the Tunnel Server. */
  agentId?: string;
}

export interface JarSource {
  /** Path to the jar as it exists on the target (pod path or local path). */
  originPath: string;
  /** Path to the jar copied onto the laptop for exploding/decompiling. */
  localRawJarPath: string;
  sha256: string;
}

export interface SessionWorkspace {
  root: string;
  rawDir: string;
  explodedDir: string;
  srcDir: string;
}

export interface CodeServerHandle {
  port: number;
  pid: number;
  url: string;
}

export interface Session {
  id: string;
  mode: SessionMode;
  target: DiscoveredTarget;
  status: SessionStatus;
  error?: string;
  jarSource?: JarSource;
  workspace?: SessionWorkspace;
  codeServer?: CodeServerHandle;
  mcp?: {
    endpoint: string;
    connected: boolean;
    toolCatalog: McpToolDescriptor[];
  };
  commandLog: CommandRecord[];
  createdAt: string;
}
