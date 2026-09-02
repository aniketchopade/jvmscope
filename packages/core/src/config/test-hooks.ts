/**
 * Whether test-only affordances (e.g. bypassing the modal jar-picker dialog) may be honoured.
 *
 * This is an ALLOWLIST on purpose. Electron does not set NODE_ENV, so in a packaged app it is
 * `undefined` — the tempting `nodeEnv !== "production"` check would evaluate to true there and
 * leave the hook enabled in the shipped build, exactly backwards. Requiring an explicit
 * "test"/"development" value means the default (unset) is always closed.
 *
 * `isPackaged` is defence in depth: even if NODE_ENV leaks in from the surrounding
 * environment, a packaged build never honours the hook.
 *
 * Pure so it can be unit-tested without Electron; callers pass `app.isPackaged`.
 */
export function areTestHooksEnabled(nodeEnv: string | undefined, isPackaged: boolean): boolean {
  if (isPackaged) return false;
  return nodeEnv === "test" || nodeEnv === "development";
}
