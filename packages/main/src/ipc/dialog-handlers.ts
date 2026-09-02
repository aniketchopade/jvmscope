import { app, ipcMain, dialog, type BrowserWindow } from "electron";
import { areTestHooksEnabled } from "@jvmscope/core";
import { debugLog } from "../debug-log.js";

/**
 * Electron does not implement window.prompt(), so the renderer cannot ask for the jar path
 * inline — it goes through a native open dialog here instead. Automatic resolution from
 * `jps -lv` is unreliable for fat jars and exploded WARs, so the user confirms the path.
 */
export function registerDialogHandlers(window: BrowserWindow): void {
  ipcMain.handle("dialog:pick-jar", async (_event, defaultPath?: string) => {
    // Test hook: a native dialog is modal and cannot be dismissed programmatically, and the
    // contextBridge API is frozen so it cannot be stubbed from the page either. Automated UI
    // runs (scripts/drive-ui.mjs) set NODE_ENV=test plus this variable to bypass it.
    // Gated so a shipped build can never be told which file to "choose" via the environment.
    if (areTestHooksEnabled(process.env.NODE_ENV, app.isPackaged)) {
      const override = process.env.JVMSCOPE_JAR_OVERRIDE;
      if (override) {
        debugLog("dialog:pick-jar overridden by test hook ->", override);
        return override;
      }
    }

    const result = await dialog.showOpenDialog(window, {
      title: "Select the jar for the target process",
      defaultPath,
      properties: ["openFile"],
      filters: [
        { name: "Java archives", extensions: ["jar", "war"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
}
