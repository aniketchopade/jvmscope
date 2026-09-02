import { app } from "electron";
import { homedir } from "node:os";
import { SessionManager, defaultSettings, provisionCodeServer, provisionResources } from "@jvmscope/core";
import { createMainWindow } from "./windows/main-window.js";
import { CodeServerViewManager } from "./windows/code-server-view.js";
import { registerDiscoveryHandlers } from "./ipc/discovery-handlers.js";
import { registerSessionHandlers } from "./ipc/session-handlers.js";
import { registerMcpHandlers } from "./ipc/mcp-handlers.js";
import { registerEditorHandlers } from "./ipc/editor-handlers.js";
import { registerDialogHandlers } from "./ipc/dialog-handlers.js";
import { attachRendererLogging, debugLog } from "./debug-log.js";

async function main(): Promise<void> {
  await app.whenReady();

  const settings = defaultSettings(homedir());
  await provisionResources({ cfrJarPath: settings.cfrJarPath, arthasBootJarPath: settings.arthasBootJarPath });
  const sessionManager = new SessionManager(settings);
  const codeServerBinary = await provisionCodeServer(`${homedir()}/.jvmscope/bin/code-server`);

  const window = createMainWindow();
  attachRendererLogging(window);
  debugLog("main window created");
  const codeServerViews = new CodeServerViewManager(window);

  registerDiscoveryHandlers();
  registerSessionHandlers(sessionManager, window, codeServerBinary, settings);
  registerMcpHandlers(sessionManager);
  registerEditorHandlers(sessionManager, codeServerViews);
  registerDialogHandlers(window);

  sessionManager.on("status-changed", (id, status) => debugLog("session", id, "->", status));

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

void main();
