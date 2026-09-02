/**
 * Arthas MCP Server returns structured JSON payloads (not ANSI terminal text) as the text
 * content of a tool result. These types/parsers model the shapes observed from Arthas 4.3.4
 * so the UI can render real tables and call trees instead of raw text.
 */

export interface WatchResultItem {
  type: "watch";
  className: string;
  methodName: string;
  /** "AtExit" | "AtEnter" | "AtExceptionExit" */
  accessPoint?: string;
  cost?: number;
  ts?: string;
  /** OGNL-rendered value of the watch express, e.g. "@ArrayList[...]" */
  value?: string;
}

export interface TraceNode {
  type?: string;
  className?: string;
  methodName?: string;
  lineNumber?: number;
  cost?: number;
  totalCost?: number;
  minCost?: number;
  maxCost?: number;
  times?: number;
  invoking?: boolean;
  children?: TraceNode[];
}

export interface TraceResultItem {
  type: "trace";
  nodeCount?: number;
  root?: TraceNode;
}

export interface TimeFragment {
  index: number;
  className: string;
  methodName: string;
  cost?: number;
  timestamp?: string;
  object?: string;
  params?: { expand?: number; object?: unknown }[];
  returnObj?: string;
  return?: boolean;
  throw?: boolean;
  throwExp?: string;
}

export interface TtResultItem {
  type: "tt";
  timeFragmentList?: TimeFragment[];
  timeFragment?: TimeFragment;
  replayResult?: TimeFragment;
  replayNo?: number;
}

export type ParsedResultItem = WatchResultItem | TraceResultItem | TtResultItem | { type: string; [k: string]: unknown };

export interface ParsedToolResult {
  /** True when the payload was JSON we understood; false for plain-text/error output. */
  structured: boolean;
  message?: string;
  status?: string;
  stage?: string;
  timedOut?: boolean;
  resultCount?: number;
  results: ParsedResultItem[];
  /** Populated when the tool returned an error string rather than a result payload. */
  errorText?: string;
  /** Always kept so the UI can offer a "raw" view. */
  raw: string;
}

/**
 * Parses one text chunk from an Arthas MCP tool result. Tool failures come back as plain
 * text (e.g. "Tool execution failed: Required parameter 'action' is missing") rather than
 * JSON, so this never throws — it degrades to an errorText/raw-only result.
 */
export function parseToolResultChunk(chunk: string): ParsedToolResult {
  const trimmed = chunk.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { structured: false, results: [], errorText: trimmed, raw: chunk };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      status?: string;
      stage?: string;
      timedOut?: boolean;
      resultCount?: number;
      results?: ParsedResultItem[];
    };
    return {
      structured: true,
      message: parsed.message,
      status: parsed.status,
      stage: parsed.stage,
      timedOut: parsed.timedOut,
      resultCount: parsed.resultCount,
      results: parsed.results ?? [],
      raw: chunk,
    };
  } catch {
    return { structured: false, results: [], errorText: trimmed, raw: chunk };
  }
}

/** Flattens a trace call tree into indented rows for tabular display. */
export function flattenTraceTree(node: TraceNode | undefined, depth = 0): { depth: number; node: TraceNode }[] {
  if (!node) return [];
  const rows = [{ depth, node }];
  for (const child of node.children ?? []) {
    rows.push(...flattenTraceTree(child, depth + 1));
  }
  return rows;
}

/** Collects time fragments across a tt result's several shapes (record/list/info/replay). */
export function collectTimeFragments(items: ParsedResultItem[]): TimeFragment[] {
  const fragments: TimeFragment[] = [];
  for (const item of items) {
    const tt = item as TtResultItem;
    if (tt.timeFragmentList) fragments.push(...tt.timeFragmentList);
    if (tt.timeFragment) fragments.push(tt.timeFragment);
    if (tt.replayResult) fragments.push(tt.replayResult);
  }
  // Later pages of a `tt list` repeat earlier fragments; de-dupe by index, last write wins.
  const byIndex = new Map<number, TimeFragment>();
  for (const f of fragments) byIndex.set(f.index, f);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}
