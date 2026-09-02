import type { JvmScopeApi } from "@jvmscope/preload";

/**
 * Accessor for the preload-exposed API. If the preload script failed to load, every call
 * would otherwise throw "Cannot read properties of undefined" and the window would render
 * blank with no explanation — so callers check `isBridgeAvailable()` and surface a real
 * message instead.
 */
export function getBridge(): JvmScopeApi | undefined {
  return (window as { jvmscope?: JvmScopeApi }).jvmscope;
}

export function isBridgeAvailable(): boolean {
  return getBridge() !== undefined;
}

/** Throws a diagnosable error rather than a TypeError when the bridge is missing. */
export function requireBridge(): JvmScopeApi {
  const bridge = getBridge();
  if (!bridge) {
    throw new Error(
      "The preload bridge (window.jvmscope) is unavailable. This UI must run inside the " +
        "Electron shell — open it with `pnpm --filter @jvmscope/main run dev`.",
    );
  }
  return bridge;
}
