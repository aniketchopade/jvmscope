import { randomUUID } from "node:crypto";
import type { CommandRecord } from "../session/types.js";
import type { ArthasMcpClient } from "./client.js";

/**
 * Runs an MCP tool call and produces a CommandRecord, streaming chunks via onChunk as they
 * arrive so the caller (IPC layer) can relay them to the renderer's output console live
 * rather than waiting for the full result.
 */
export async function runCommand(
  client: ArthasMcpClient,
  tool: string,
  params: Record<string, unknown>,
  onChunk?: (record: CommandRecord, chunk: string) => void,
): Promise<CommandRecord> {
  const record: CommandRecord = {
    id: randomUUID(),
    tool,
    params,
    startedAt: new Date().toISOString(),
    chunks: [],
  };

  try {
    await client.callTool(tool, params, (chunk) => {
      record.chunks.push(chunk);
      onChunk?.(record, chunk);
    });
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
  } finally {
    record.finishedAt = new Date().toISOString();
  }

  return record;
}
