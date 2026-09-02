import { useMemo, useState } from "react";
import {
  parseToolResultChunk,
  flattenTraceTree,
  collectTimeFragments,
  type ParsedToolResult,
  type WatchResultItem,
  type TraceResultItem,
  type TimeFragment,
} from "@jvmscope/core/browser";

/**
 * Renders Arthas MCP tool results. Arthas MCP Server returns structured JSON payloads
 * (not ANSI terminal text), so this shows real tables and call trees rather than a terminal
 * emulator, with a raw-JSON toggle as an escape hatch.
 */
export function ResultsView({ chunks }: { chunks: string[] }) {
  const [showRaw, setShowRaw] = useState(false);
  const parsed = useMemo(() => chunks.map(parseToolResultChunk), [chunks]);

  if (parsed.length === 0) {
    return <Empty>No results yet. Run a command above.</Empty>;
  }

  return (
    <div style={{ padding: 10 }}>
      <label className="field-inline field" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
        <span className="field-label">Raw JSON</span>
      </label>
      {parsed.map((result, i) => (
        <ResultBlock key={i} result={result} showRaw={showRaw} />
      ))}
    </div>
  );
}

function ResultBlock({ result, showRaw }: { result: ParsedToolResult; showRaw: boolean }) {
  if (showRaw) {
    return <Pre>{safePretty(result.raw)}</Pre>;
  }

  if (!result.structured) {
    return <div className="error-banner" style={{ margin: "0 0 10px" }}>{result.errorText}</div>;
  }

  const watches = result.results.filter((r) => r.type === "watch") as WatchResultItem[];
  const traces = result.results.filter((r) => r.type === "trace") as TraceResultItem[];
  const fragments = collectTimeFragments(result.results.filter((r) => r.type === "tt"));

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="form-hint" style={{ marginBottom: 4 }}>
        {result.message}
        {result.timedOut ? " (timed out)" : ""}
      </div>
      {watches.length > 0 && <WatchTable items={watches} />}
      {traces.map((t, i) => (
        <TraceTree key={i} trace={t} />
      ))}
      {fragments.length > 0 && <TimeFragmentTable fragments={fragments} />}
      {watches.length === 0 && traces.length === 0 && fragments.length === 0 && (
        <Pre>{safePretty(result.raw)}</Pre>
      )}
    </div>
  );
}

function WatchTable({ items }: { items: WatchResultItem[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>time</th>
          <th>method</th>
          <th>at</th>
          <th>cost (ms)</th>
          <th>value</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td style={{ whiteSpace: "nowrap" }}>{item.ts?.slice(11, 23)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {shortClass(item.className)}.{item.methodName}
            </td>
            <td>{item.accessPoint}</td>
            <td>{item.cost?.toFixed(3)}</td>
            <td>
              <Pre>{item.value}</Pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TraceTree({ trace }: { trace: TraceResultItem }) {
  const rows = flattenTraceTree(trace.root);
  return (
    <table>
      <thead>
        <tr>
          <th>call tree ({trace.nodeCount ?? rows.length} nodes)</th>
          <th>line</th>
          <th>times</th>
          <th>cost (ms)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td style={{ paddingLeft: 10 + row.depth * 16, whiteSpace: "nowrap" }}>
              {row.node.className ? `${shortClass(row.node.className)}.${row.node.methodName}` : row.node.type ?? "(root)"}
            </td>
            <td>{row.node.lineNumber ?? ""}</td>
            <td>{row.node.times ?? ""}</td>
            <td>{formatNanos(row.node.totalCost ?? row.node.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimeFragmentTable({ fragments }: { fragments: TimeFragment[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>index</th>
          <th>time</th>
          <th>method</th>
          <th>cost (ms)</th>
          <th>params</th>
          <th>return</th>
        </tr>
      </thead>
      <tbody>
        {fragments.map((f) => (
          <tr key={f.index}>
            <td>
              <code>{f.index}</code>
            </td>
            <td style={{ whiteSpace: "nowrap" }}>{f.timestamp?.slice(11, 23)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {shortClass(f.className)}.{f.methodName}
            </td>
            <td>{f.cost?.toFixed(3)}</td>
            <td>
              <Pre>{(f.params ?? []).map((p) => String(p.object)).join(", ")}</Pre>
            </td>
            <td>
              <Pre>{f.throw ? `throw ${f.throwExp}` : (f.returnObj ?? "")}</Pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre>{children}</pre>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="results-empty">{children}</div>;
}

function shortClass(fqcn: string | undefined): string {
  if (!fqcn) return "";
  const parts = fqcn.split(".");
  return parts.length > 2 ? `${parts.slice(-2).join(".")}` : fqcn;
}

/** Trace costs come back in nanoseconds; watch/tt costs are already milliseconds. */
function formatNanos(value: number | undefined): string {
  if (value === undefined) return "";
  return (value / 1_000_000).toFixed(3);
}

function safePretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
