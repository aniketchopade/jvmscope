/**
 * Verifies the preload bridge actually reaches the renderer under the same BrowserWindow
 * webPreferences the app uses. Writes results to $PROBE_OUT, because Electron main-process
 * console output does not reach a piped stdout on Windows.
 *
 * Avoids top-level await, which does not work reliably in Electron's ESM main process.
 *
 * Run with: PROBE_OUT=<abs path> pnpm exec electron scripts/verify-preload.mjs
 */
import { app, BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(__dirname, "../../preload/dist/index.js");
const out = process.env.PROBE_OUT ?? "probe.txt";

const log = (line) => writeFileSync(out, line + "\n", { flag: "a" });

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT: ${err.message}`);
  app.quit();
});

app.whenReady().then(async () => {
  try {
    log(`PRELOAD PATH: ${preloadPath}`);

    const win = new BrowserWindow({
      show: false,
      webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });

    win.webContents.on("preload-error", (_e, path, error) => {
      log(`PRELOAD-ERROR: ${path} :: ${error.message}`);
    });

    await win.loadURL("data:text/html,<html><body>probe</body></html>");

    const keys = await win.webContents.executeJavaScript(
      "(() => { const a = window.jvmscope; return a ? Object.keys(a) : null; })()",
    );

    log(`BRIDGE: ${keys === null ? "MISSING" : JSON.stringify(keys)}`);
  } catch (err) {
    log(`PROBE-THREW: ${err.message}`);
  } finally {
    app.quit();
  }
});
