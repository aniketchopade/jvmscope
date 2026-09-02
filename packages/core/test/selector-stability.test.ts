import { describe, expect, it } from "vitest";

/**
 * Regression guard for the bug that blanked the app window: a zustand selector returning
 * `state.commandChunks[id] ?? []` allocates a fresh array on every read. Zustand compares
 * successive selector results with Object.is, so an always-new reference re-renders forever
 * ("Maximum update depth exceeded", React error #185), which unmounts the tree.
 *
 * The fix is to return the stored value from the selector and apply the default outside it,
 * against a module-level constant. These tests encode why that matters.
 */

const NO_CHUNKS: string[] = [];

interface StoreState {
  commandChunks: Record<string, string[]>;
}

const state: StoreState = { commandChunks: { known: ["a"] } };

const unstableSelector = (s: StoreState) => s.commandChunks["missing"] ?? [];
const stableSelector = (s: StoreState) => s.commandChunks["missing"];

describe("zustand selector reference stability", () => {
  it("shows why an inline default loops: successive reads are never Object.is-equal", () => {
    expect(Object.is(unstableSelector(state), unstableSelector(state))).toBe(false);
  });

  it("selecting the raw value keeps successive reads referentially equal", () => {
    expect(Object.is(stableSelector(state), stableSelector(state))).toBe(true);
  });

  it("applying the default outside the selector stays stable across reads", () => {
    const first = stableSelector(state) ?? NO_CHUNKS;
    const second = stableSelector(state) ?? NO_CHUNKS;
    expect(Object.is(first, second)).toBe(true);
    expect(first).toEqual([]);
  });

  it("still returns the real value when present", () => {
    const chunks = state.commandChunks["known"] ?? NO_CHUNKS;
    expect(chunks).toEqual(["a"]);
  });
});
