import { useEffect, useState } from "react";
import { useSessionStore } from "./state/store.js";
import { isBridgeAvailable, requireBridge } from "./api/bridge.js";
import { AttachDialog } from "./components/PidPicker/AttachDialog.js";
import { SessionTabs } from "./components/SessionTabs/SessionTabs.js";
import { SessionView } from "./components/SessionView/SessionView.js";

export function App() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setStatus = useSessionStore((s) => s.setStatus);
  const appendChunk = useSessionStore((s) => s.appendChunk);
  const recordCommand = useSessionStore((s) => s.recordCommand);

  const bridgeAvailable = isBridgeAvailable();
  const sessionList = Object.values(sessions);
  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;

  // Opens automatically when there is nothing to show, so the first run needs no hunting.
  const [attachOpen, setAttachOpen] = useState(sessionList.length === 0);

  useEffect(() => {
    if (!bridgeAvailable) return;
    const bridge = requireBridge();
    const offStatus = bridge.session.onStatusChanged((sessionId, status) => setStatus(sessionId, status));
    const offChunk = bridge.mcp.onCommandChunk((sessionId, record, chunk) => {
      appendChunk(sessionId, chunk);
      recordCommand(sessionId, record);
    });
    return () => {
      offStatus();
      offChunk();
    };
  }, [bridgeAvailable, setStatus, appendChunk, recordCommand]);

  if (!bridgeAvailable) {
    return (
      <div className="centered-message">
        <h2>JVMScope</h2>
        <p className="error-text">The preload bridge is unavailable.</p>
        <p className="form-hint">
          This UI reaches Arthas, kubectl and code-server through the Electron main process, so it must run inside the
          Electron shell rather than a browser tab.
        </p>
        <pre>pnpm --filter @jvmscope/main run dev</pre>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="titlebar">
        <SessionTabs sessions={sessionList} activeSessionId={activeSessionId} />
        <button className="new-session" onClick={() => setAttachOpen(true)} title="Attach to a Java process">
          + Attach
        </button>
      </header>

      <main className="app-main">
        {activeSession ? (
          // editorVisible=false detaches the native view so the dialog is not painted under it.
          <SessionView session={activeSession} editorVisible={!attachOpen} />
        ) : (
          <div className="centered-message">
            <h2>No session attached</h2>
            <p className="form-hint">Attach to a running Java process to browse its source and run Arthas commands.</p>
            <button className="primary" onClick={() => setAttachOpen(true)}>
              Attach to a process
            </button>
          </div>
        )}
      </main>

      {/* The native editor view paints above all HTML, so it is hidden while the dialog is up. */}
      {attachOpen && <AttachDialog onClose={() => setAttachOpen(false)} />}
    </div>
  );
}
