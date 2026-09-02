import { ipcMain } from "electron";
import type { Rectangle } from "electron";
import type { SessionManager } from "@jvmscope/core";
import type { CodeServerViewManager } from "../windows/code-server-view.js";
import { debugLog } from "../debug-log.js";

export function registerEditorHandlers(sessionManager: SessionManager, views: CodeServerViewManager): void {
  ipcMain.handle("editor:show", async (_event, sessionId: string, bounds: Rectangle) => {
    const session = sessionManager.get(sessionId);
    if (!session?.codeServer) throw new Error(`Session ${sessionId} has no running code-server`);
    debugLog("editor:show", sessionId, bounds, session.codeServer.url);
    views.show(sessionId, session.codeServer.url, bounds);
  });

  ipcMain.handle("editor:set-bounds", async (_event, sessionId: string, bounds: Rectangle) => {
    debugLog("editor:set-bounds", sessionId, bounds);
    views.setBounds(sessionId, bounds);
  });

  ipcMain.handle("editor:hide", async (_event, sessionId: string) => {
    debugLog("editor:hide", sessionId);
    views.hide(sessionId);
  });
}
