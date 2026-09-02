import { useState } from "react";
import type { Session } from "@jvmscope/core/browser";
import { useSessionStore } from "../../state/store.js";
import { AttachProgress } from "../AttachProgress/AttachProgress.js";
import { EditorPane } from "./EditorPane.js";
import { CommandPanel } from "../CommandPanel/CommandPanel.js";
import { ResultsView } from "../OutputConsole/ResultsView.js";

/**
 * Stable reference for the "no output yet" case. Returning `?? []` from inside the selector
 * would allocate a new array on every store read; zustand compares with Object.is, so it
 * would see a change every time and re-render forever ("Maximum update depth exceeded",
 * React error #185), which unmounts the whole tree and blanks the window.
 */
const NO_CHUNKS: string[] = [];

export type PanelKey = "watch" | "trace" | "tt" | "other";

const PANELS: { key: PanelKey; label: string; icon: string }[] = [
  { key: "watch", label: "Watch", icon: "◉" },
  { key: "trace", label: "Trace", icon: "⑃" },
  { key: "tt", label: "Time Tunnel", icon: "⏱" },
  { key: "other", label: "Other tools", icon: "⋯" },
];

export function SessionView({ session, editorVisible }: { session: Session; editorVisible: boolean }) {
  const chunks = useSessionStore((s) => s.commandChunks[session.id]) ?? NO_CHUNKS;
  const [openPanel, setOpenPanel] = useState<PanelKey | undefined>();

  if (session.status !== "ready") {
    return <AttachProgress status={session.status} error={session.error} />;
  }

  return (
    <div className="session-view">
      {/* Editor keeps the space the drawer does not use; it resizes rather than being covered,
          because the native view cannot be painted over. */}
      <EditorPane sessionId={session.id} visible={editorVisible} />

      {openPanel && (
        <div className="drawer">
          <div className="drawer-header">
            <span>{PANELS.find((p) => p.key === openPanel)!.label}</span>
            <button className="icon-button" title="Close panel" onClick={() => setOpenPanel(undefined)}>
              ✕
            </button>
          </div>
          <div className="drawer-body">
            <CommandPanel session={session} panel={openPanel} />
          </div>
          <div className="drawer-results">
            <ResultsView chunks={chunks} />
          </div>
        </div>
      )}

      <div className="rail">
        {PANELS.map((p) => (
          <button
            key={p.key}
            className={`rail-button ${openPanel === p.key ? "active" : ""}`}
            title={p.label}
            onClick={() => setOpenPanel((cur) => (cur === p.key ? undefined : p.key))}
          >
            <span className="rail-icon">{p.icon}</span>
            <span className="rail-label">{p.label}</span>
          </button>
        ))}
        {chunks.length > 0 && !openPanel && <div className="rail-badge" title={`${chunks.length} result(s)`} />}
      </div>
    </div>
  );
}
