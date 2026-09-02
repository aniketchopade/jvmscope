import type { SessionStatus } from "@jvmscope/core/browser";

const STEPS: SessionStatus[] = [
  "attaching",
  "fetching-jar",
  "exploding",
  "decompiling",
  "starting-editor",
  "connecting-mcp",
];

const LABELS: Partial<Record<SessionStatus, string>> = {
  attaching: "Attaching Arthas",
  "fetching-jar": "Fetching jar",
  exploding: "Exploding jar",
  decompiling: "Decompiling classes",
  "starting-editor": "Starting editor",
  "connecting-mcp": "Connecting to Arthas MCP",
};

export function AttachProgress({ status, error }: { status: SessionStatus; error?: string }) {
  if (status === "error") {
    return (
      <div className="centered-message">
        <h2 className="error-text">Attach failed</h2>
        <pre className="error-banner">{error}</pre>
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(status);

  return (
    <div className="centered-message">
      <h2>Attaching…</h2>
      <div className="form" style={{ gap: 6 }}>
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", gap: 8, opacity: i <= currentIndex ? 1 : 0.35 }}>
            <span>{i < currentIndex ? "✓" : i === currentIndex ? "○" : "·"}</span>
            <span>{LABELS[step]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
