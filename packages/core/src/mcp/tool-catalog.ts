import type { McpToolDescriptor } from "../session/types.js";
import type { ArthasMcpClient } from "./client.js";

/** Well-known Arthas tool names the UI has dedicated form builders for (Watch/Trace/Time Tunnel panels). */
export const KNOWN_TOOLS = {
  watch: "watch",
  trace: "trace",
  timeTunnel: "tt",
} as const;

/**
 * Caches the live `tools/list` result for a session so the Watch/Trace/Time-Tunnel forms can
 * validate/build params against the actual current schema (tolerating Arthas version drift)
 * instead of hardcoded param lists.
 */
export class ToolCatalog {
  private tools: McpToolDescriptor[] = [];

  async refresh(client: ArthasMcpClient): Promise<McpToolDescriptor[]> {
    this.tools = await client.listTools();
    return this.tools;
  }

  get(name: string): McpToolDescriptor | undefined {
    return this.tools.find((t) => t.name === name);
  }

  all(): McpToolDescriptor[] {
    return this.tools;
  }
}
