import { ipcMain, type BrowserWindow } from "electron";
import { SessionManager, type Settings } from "@jvmscope/core";
import type { AttachOptions } from "@jvmscope/preload";
import type { CodeServerBinary } from "@jvmscope/core";

export function registerSessionHandlers(
  sessionManager: SessionManager,
  window: BrowserWindow,
  codeServerBinary: CodeServerBinary,
  settings: Settings,
): void {
  sessionManager.on("status-changed", (sessionId, status) => {
    window.webContents.send("session:status-changed", sessionId, status);
  });
  sessionManager.on("command-chunk", (sessionId, record, chunk) => {
    window.webContents.send("mcp:command-chunk", sessionId, record, chunk);
  });

  ipcMain.handle("session:attach", async (_event, opts: AttachOptions) => {
    return sessionManager.attach({
      target: opts.target,
      jarLocation: { path: opts.jarPath },
      appName: opts.appName,
      codeServerBinary,
      kubectlOpts: settings.kubectlContext ? { context: settings.kubectlContext } : undefined,
      tunnelServerWsUrl: settings.tunnelServer?.agentWsUrl,
    });
  });

  ipcMain.handle("session:list", async () => sessionManager.list());

  ipcMain.handle("session:close", async (_event, sessionId: string) => sessionManager.close(sessionId));
}
