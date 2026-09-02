/**
 * Verifies the jar-picker test hook is gated correctly using the REAL Electron runtime values
 * (app.isPackaged), not just unit-test inputs. Evaluates the gate rather than invoking the
 * dialog, because an ungated call would open a modal native dialog and block forever.
 *
 * Usage: PROBE_OUT=<abs path> pnpm exec electron scripts/verify-test-hook-gate.mjs
 */
import { app } from "electron";
import { writeFileSync } from "node:fs";
import { areTestHooksEnabled } from "@jvmscope/core";

const out = process.env.PROBE_OUT ?? "gate.txt";
const log = (line) => writeFileSync(out, line + "\n", { flag: "a" });

app.whenReady().then(() => {
  try {
    log(`app.isPackaged = ${app.isPackaged}`);

    for (const env of [undefined, "", "production", "test", "development"]) {
      const enabled = areTestHooksEnabled(env, app.isPackaged);
      log(`NODE_ENV=${env === undefined ? "<unset>" : JSON.stringify(env)} -> testHooks ${enabled ? "ENABLED" : "disabled"}`);
    }

    // The shipped configuration: packaged build, no NODE_ENV.
    log(`packaged build, NODE_ENV unset -> testHooks ${areTestHooksEnabled(undefined, true) ? "ENABLED" : "disabled"}`);
  } catch (err) {
    log(`PROBE-THREW: ${err.message}`);
  } finally {
    app.quit();
  }
});
