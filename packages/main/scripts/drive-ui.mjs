/**
 * Reproduces the real app (same window/preload/IPC wiring) and drives the actual UI:
 * stubs only the native file dialog, then clicks the real Attach button so the component's
 * own attach() -> store update -> SessionView -> EditorPane path runs. Dumps DOM state and
 * layout geometry so blank-screen / overlay bugs are diagnosable from a log file.
 *
 * Usage: JVMSCOPE_LOG=<abs log> PID=<pid> JAR=<abs jar> pnpm exec electron scripts/drive-ui.mjs
 */
import { app } from "electron";
import { homedir } from "node:os";
import { appendFileSync } from "node:fs";
import { SessionManager, defaultSettings, provisionCodeServer, provisionResources } from "@jvmscope/core";
import { createMainWindow } from "../dist/windows/main-window.js";
import { CodeServerViewManager } from "../dist/windows/code-server-view.js";
import { registerDiscoveryHandlers } from "../dist/ipc/discovery-handlers.js";
import { registerSessionHandlers } from "../dist/ipc/session-handlers.js";
import { registerMcpHandlers } from "../dist/ipc/mcp-handlers.js";
import { registerEditorHandlers } from "../dist/ipc/editor-handlers.js";
import { registerDialogHandlers } from "../dist/ipc/dialog-handlers.js";
import { attachRendererLogging, debugLog } from "../dist/debug-log.js";

const out = process.env.JVMSCOPE_LOG ?? "drive.log";
const log = (...p) => appendFileSync(out, p.map((x) => (typeof x === "string" ? x : JSON.stringify(x, null, 2))).join(" ") + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  let views;
  try {
    const settings = defaultSettings(homedir());
    await provisionResources({ cfrJarPath: settings.cfrJarPath, arthasBootJarPath: settings.arthasBootJarPath });
    const sessionManager = new SessionManager(settings);
    const codeServerBinary = await provisionCodeServer(`${homedir()}/.jvmscope/bin/code-server`);

    const window = createMainWindow();
    attachRendererLogging(window);
    views = new CodeServerViewManager(window);

    registerDiscoveryHandlers();
    registerSessionHandlers(sessionManager, window, codeServerBinary, settings);
    registerMcpHandlers(sessionManager);
    registerEditorHandlers(sessionManager, codeServerViews(views));
    registerDialogHandlers(window);
    sessionManager.on("status-changed", (id, s) => debugLog("session", id, "->", s));

    await new Promise((r) => window.webContents.once("did-finish-load", r));
    log("=== renderer loaded ===");

    // The native file dialog is modal and cannot be dismissed programmatically, and the
    // contextBridge API is frozen so it cannot be stubbed from the page. The main process
    // honours JVMSCOPE_JAR_OVERRIDE, but only when test hooks are enabled — hence
    // NODE_ENV=test here (see core/config/test-hooks.ts).
    process.env.NODE_ENV = "test";
    process.env.JVMSCOPE_JAR_OVERRIDE = process.env.JAR;

    // Click Refresh PIDs, wait for the table, then click the row's Attach button.
    await window.webContents.executeJavaScript(`
      (() => {
        const b = [...document.querySelectorAll("button")].find(b => /Refresh|Scanning/.test(b.textContent));
        if (b) { b.click(); return "refreshed"; }
        return "no refresh button (modal auto-scans on open)";
      })()
    `);
    await sleep(2500);
    log("AFTER REFRESH:", await window.webContents.executeJavaScript("document.body.innerText.slice(0,300)"));

    log("ATTACH CLICK:", await window.webContents.executeJavaScript(`
      (() => {
        const row = [...document.querySelectorAll("tr")].find(r => r.textContent.includes(${JSON.stringify(process.env.PID)}));
        if (!row) return "row not found";
        const btn = row.querySelector("button");
        if (!btn) return "button not found in row";
        if (btn.disabled) return "button disabled";
        btn.click();
        return "clicked attach";
      })()
    `));

    // Wait for the session to actually be ready: poll for the Watch form's Run button, which
    // only exists once SessionView has mounted. (Substring-matching the start of body text
    // is not a reliable readiness signal — the marker can fall outside the slice.)
    let ready = false;
    for (let i = 0; i < 25 && !ready; i++) {
      await sleep(2000);
      ready = await window.webContents.executeJavaScript(
        `!!document.querySelector(".rail") && !!document.querySelector(".status-dot.ready")`,
      );
    }
    log("SESSION READY IN UI:", ready);
    await sleep(1500);

    log("OPEN WATCH PANEL:", await window.webContents.executeJavaScript(`
      (() => {
        const b = [...document.querySelectorAll("button")].find(b => b.title === "Watch");
        if (!b) return "rail Watch button not found";
        b.click();
        return "opened";
      })()
    `));
    await sleep(1200);

    const domState = await window.webContents.executeJavaScript(`
      (() => {
        const root = document.getElementById("root");
        const all = [...document.querySelectorAll("*")];
        const editorDiv = document.querySelector(".editor-pane");
        const r = editorDiv ? editorDiv.getBoundingClientRect() : null;
        return {
          bodyText: document.body.innerText.slice(0, 700),
          rootChildren: root ? root.childElementCount : -1,
          viewport: { w: innerWidth, h: innerHeight },
          editorPaneRect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : "not found",
          elementCount: all.length,
        };
      })()
    `);
    log("DOM AFTER ATTACH:", domState);

    // Fill the Watch form the way a user would (React-aware value setting), then Run.
    const filled = await window.webContents.executeJavaScript(`
      (() => {
        const setReactValue = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const labels = [...document.querySelectorAll("label")];
        const byName = (n) => {
          const l = labels.find(l => l.textContent.trim().startsWith(n));
          return l ? l.querySelector("input") : null;
        };
        const cls = byName("Class pattern"), m = byName("Method pattern"), n = byName("Number of executions");
        if (!cls || !m) return "form fields not found";
        setReactValue(cls, "com.example.demo.OrderService");
        setReactValue(m, "placeOrder");
        if (n) setReactValue(n, "2");
        return "filled";
      })()
    `);
    log("FORM FILL:", filled);
    await sleep(500);

    const clicked = await window.webContents.executeJavaScript(`
      (() => {
        const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Run watch"));
        if (!btn) return "Run button not found: " + [...document.querySelectorAll("button")].map(b=>b.textContent).join(" | ");
        if (btn.disabled) return "Run button disabled: " + btn.textContent;
        btn.click();
        return "clicked run";
      })()
    `);
    log("RUN CLICK:", clicked);

    for (let i = 0; i < 12; i++) {
      await sleep(3000);
      const busy = await window.webContents.executeJavaScript(
        `!![...document.querySelectorAll("button")].find(b => b.textContent.includes("Running"))`,
      );
      if (!busy) break;
    }
    await sleep(2000);

    const results = await window.webContents.executeJavaScript(`
      (() => {
        const tables = [...document.querySelectorAll("table")];
        const last = tables[tables.length - 1];
        return {
          tableCount: tables.length,
          resultsPaneText: document.body.innerText.slice(-900),
          lastTableRows: last ? last.querySelectorAll("tbody tr").length : 0,
        };
      })()
    `);
    log("WATCH RESULTS IN UI:", results);
  } catch (err) {
    log("DRIVER-THREW:", err.stack ?? err.message);
  } finally {
    app.quit();
  }
});

function codeServerViews(v) {
  return v;
}
