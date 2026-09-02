import { ipcMain } from "electron";
import type { SessionManager } from "@jvmscope/core";

export function registerMcpHandlers(sessionManager: SessionManager): void {
  ipcMain.handle(
    "mcp:call-tool",
    async (_event, sessionId: string, tool: string, params: Record<string, unknown>) =>
      sessionManager.runCommand(sessionId, tool, params),
  );
}
