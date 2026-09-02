import { describe, expect, it } from "vitest";
import { areTestHooksEnabled } from "../src/config/test-hooks.js";

describe("areTestHooksEnabled", () => {
  it("is enabled for explicit test/development environments in an unpackaged build", () => {
    expect(areTestHooksEnabled("test", false)).toBe(true);
    expect(areTestHooksEnabled("development", false)).toBe(true);
  });

  it("is disabled when NODE_ENV is unset — the packaged-Electron default", () => {
    // The whole point of the allowlist: `nodeEnv !== "production"` would return true here and
    // silently ship an enabled test hook.
    expect(areTestHooksEnabled(undefined, false)).toBe(false);
    expect(areTestHooksEnabled("", false)).toBe(false);
  });

  it("is disabled in production", () => {
    expect(areTestHooksEnabled("production", false)).toBe(false);
  });

  it("is always disabled in a packaged build, whatever NODE_ENV says", () => {
    expect(areTestHooksEnabled("test", true)).toBe(false);
    expect(areTestHooksEnabled("development", true)).toBe(false);
    expect(areTestHooksEnabled(undefined, true)).toBe(false);
  });
});
