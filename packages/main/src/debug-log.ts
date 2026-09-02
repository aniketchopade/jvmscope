import { appendFileSync } from "node:fs";
import type { BrowserWindow } from "electron";

/**
 * Diagnostic logging to a file. Electron's main-process stdout is not reliably visible on
 * Windows (it does not reach a piped console), and renderer-side errors never appear there
 * at all — so when JVMSCOPE_LOG is set, both are appended to that file.
 */
const logPath = process.env.JVMSCOPE_LOG;

export function debugLog(...parts: unknown[]): void {
  if (!logPath) return;
  const line = parts
    .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
    .join(" ");
  appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
}

/** Mirrors renderer console output and load failures into the same log. */
export function attachRendererLogging(window: BrowserWindow): void {
  if (!logPath) return;

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    debugLog(`RENDERER[${level}] ${message} (${sourceId}:${line})`);
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    debugLog("RENDERER-GONE", details);
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    debugLog("DID-FAIL-LOAD", code, description, url);
  });

  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    debugLog("PRELOAD-ERROR", preloadPath, error.message);
  });

  window.webContents.on("did-finish-load", () => {
    debugLog("DID-FINISH-LOAD");
  });
}
