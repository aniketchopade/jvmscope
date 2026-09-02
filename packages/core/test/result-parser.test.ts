import { describe, expect, it } from "vitest";
import {
  parseToolResultChunk,
  flattenTraceTree,
  collectTimeFragments,
  type TraceResultItem,
  type TtResultItem,
} from "../src/mcp/result-parser.js";

// Payloads below are verbatim shapes captured from a live Arthas 4.3.4 MCP Server
// running against the testapp demo server.

describe("parseToolResultChunk", () => {
  it("parses a watch result payload", () => {
    const raw = JSON.stringify({
      resultCount: 1,
      timedOut: false,
      stage: "final",
      message: "Watch execution completed successfully",
      results: [
        {
          accessPoint: "AtExit",
          className: "com.example.demo.OrderService",
          cost: 7.2757,
          jobId: 1,
          methodName: "placeOrder",
          ts: "2026-09-01 21:58:02.402651700",
          type: "watch",
          value: "@ArrayList[...]",
        },
      ],
    });

    const parsed = parseToolResultChunk(raw);

    expect(parsed.structured).toBe(true);
    expect(parsed.message).toBe("Watch execution completed successfully");
    expect(parsed.timedOut).toBe(false);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]).toMatchObject({ type: "watch", methodName: "placeOrder", cost: 7.2757 });
  });

  it("degrades gracefully on a plain-text tool error instead of throwing", () => {
    const parsed = parseToolResultChunk("Tool execution failed: Required parameter 'action' is missing");

    expect(parsed.structured).toBe(false);
    expect(parsed.errorText).toContain("Required parameter 'action' is missing");
    expect(parsed.results).toEqual([]);
  });

  it("degrades gracefully on malformed JSON", () => {
    const parsed = parseToolResultChunk('{"results": [ truncated');
    expect(parsed.structured).toBe(false);
    expect(parsed.raw).toContain("truncated");
  });
});

describe("flattenTraceTree", () => {
  it("flattens a nested call tree depth-first with depth markers", () => {
    const trace: TraceResultItem = {
      type: "trace",
      root: {
        className: "com.example.demo.OrderService",
        methodName: "placeOrder",
        children: [
          { className: "com.example.demo.InventoryClient", methodName: "checkStock", totalCost: 17203500 },
          {
            className: "com.example.demo.PricingEngine",
            methodName: "computeTotal",
            children: [{ className: "com.example.demo.PricingEngine", methodName: "discountFor" }],
          },
        ],
      },
    };

    const rows = flattenTraceTree(trace.root);

    expect(rows.map((r) => [r.depth, r.node.methodName])).toEqual([
      [0, "placeOrder"],
      [1, "checkStock"],
      [1, "computeTotal"],
      [2, "discountFor"],
    ]);
  });

  it("returns nothing for an undefined root", () => {
    expect(flattenTraceTree(undefined)).toEqual([]);
  });
});

describe("collectTimeFragments", () => {
  it("gathers fragments across record/info/replay shapes, de-duped and index-sorted", () => {
    const items: TtResultItem[] = [
      { type: "tt", timeFragmentList: [frag(1001), frag(1000)] },
      { type: "tt", timeFragment: frag(1002) },
      // A replay of an already-listed index must not duplicate the row.
      { type: "tt", replayNo: 1, replayResult: { ...frag(1000), cost: 6.7334 } },
    ];

    const fragments = collectTimeFragments(items);

    expect(fragments.map((f) => f.index)).toEqual([1000, 1001, 1002]);
    // last write wins, so the replayed cost replaces the originally recorded one
    expect(fragments[0].cost).toBe(6.7334);
  });
});

function frag(index: number) {
  return {
    index,
    className: "com.example.demo.PricingEngine",
    methodName: "computeTotal",
    cost: 4.4916,
    timestamp: "2026-09-01 21:58:36.073574700",
    returnObj: "@Double[75.96199999999999]",
  };
}
