import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ResultsView } from "../components/OutputConsole/ResultsView.js";
import { SchemaForm } from "../components/CommandPanel/SchemaForm.js";
import { TimeTunnelPanel } from "../components/CommandPanel/TimeTunnelPanel.js";
import { AttachProgress } from "../components/AttachProgress/AttachProgress.js";
import fixtures from "./fixtures.json";
import watchSchema from "./watch-schema.json";
import ttSchema from "./tt-schema.json";
import "../styles.css";

/**
 * Dev-only harness that renders the data-driven components against payloads captured from a
 * real Arthas MCP Server (see core/scripts/capture-fixtures.mjs). It needs no Electron
 * bridge and no live JVM, so the presentation layer can be checked in a plain browser.
 * Not part of the shipped app — built via `vite build --mode harness`.
 */
function Harness() {
  const f = fixtures as Record<string, string[]>;
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 28 }}>
      <Section title="AttachProgress — mid-pipeline">
        <AttachProgress status="decompiling" />
      </Section>

      <Section title="AttachProgress — failure">
        <AttachProgress status="error" error="Timed out waiting for Arthas MCP endpoint at http://127.0.0.1:8563/mcp" />
      </Section>

      <Section title="Watch results (live capture)">
        <Box><ResultsView chunks={f.watch} /></Box>
      </Section>

      <Section title="Trace call tree (live capture)">
        <Box><ResultsView chunks={f.trace} /></Box>
      </Section>

      <Section title="Time tunnel — recorded fragments (live capture)">
        <Box><ResultsView chunks={f.ttRecord} /></Box>
      </Section>

      <Section title="Tool error (live capture: missing required param)">
        <Box><ResultsView chunks={f.error} /></Box>
      </Section>

      <Section title="Watch form — generated from the live tool schema">
        <SchemaForm tool={watchSchema as never} submitting={false} onSubmit={() => {}} />
      </Section>

      <Section title="Time Tunnel panel — action-based, from the live tt schema">
        <TimeTunnelPanel tool={ttSchema as never} submitting={false} onRun={() => {}} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, margin: "0 0 8px", color: "var(--text)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div style={{ border: "1px solid var(--border)", height: 260, background: "var(--bg-panel)" }}>{children}</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
