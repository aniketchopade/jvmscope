import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpToolDescriptor } from "../session/types.js";

/**
 * Thin wrapper around the official MCP SDK client, pointed at an Arthas MCP Server endpoint
 * (local: http://127.0.0.1:8563, or the Tunnel Server's agentId-addressed URL in Phase 3).
 * Uses the real MCP client rather than hand-rolled JSON-RPC/SSE, since Arthas MCP Server
 * is a standard MCP server.
 */
export class ArthasMcpClient {
  private client?: Client;

  constructor(private readonly endpoint: string) {}

  async connect(): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint));
    const client = new Client({ name: "jvmscope", version: "0.1.0" }, { capabilities: {} });
    await client.connect(transport);
    this.client = client;
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
  }

  /** Lists the ~29 Arthas diagnostic tools with their JSON Schemas, used to drive dynamic UI forms. */
  async listTools(): Promise<McpToolDescriptor[]> {
    if (!this.client) throw new Error("not connected");
    const result = await this.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Calls a tool (e.g. "watch", "trace", "tt") and streams text content back via onChunk as it
   * arrives, in addition to returning the full result. Long-running commands (watch/trace/tt)
   * rely on Arthas MCP Server's STREAMABLE mode to push partial output incrementally.
   */
  async callTool(
    name: string,
    params: Record<string, unknown>,
    onChunk?: (text: string) => void,
  ): Promise<string[]> {
    if (!this.client) throw new Error("not connected");
    const result = await this.client.callTool({ name, arguments: params });
    const chunks: string[] = [];
    const content = Array.isArray(result.content) ? result.content : [];
    for (const item of content) {
      if (item.type === "text") {
        chunks.push(item.text);
        onChunk?.(item.text);
      }
    }
    return chunks;
  }
}
