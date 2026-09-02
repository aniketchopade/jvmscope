import { requireBridge } from "../../api/bridge.js";
import type { Session } from "@jvmscope/core/browser";
import { useSessionStore } from "../../state/store.js";

export function SessionTabs({ sessions, activeSessionId }: { sessions: Session[]; activeSessionId?: string }) {
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const removeSession = useSessionStore((s) => s.removeSession);

  async function closeTab(sessionId: string) {
    await requireBridge().session.close(sessionId);
    await requireBridge().editor.hide(sessionId);
    removeSession(sessionId);
  }

  if (sessions.length === 0) {
    return <div className="app-title">JVMScope</div>;
  }

  return (
    <div className="tabs">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`tab ${session.id === activeSessionId ? "active" : ""}`}
          onClick={() => setActiveSession(session.id)}
          title={session.target.displayName}
        >
          <span className={`status-dot ${session.status}`} />
          <span className="tab-label">PID {session.target.pid}</span>
          <span
            className="tab-close"
            title="Close session"
            onClick={(e) => {
              e.stopPropagation();
              void closeTab(session.id);
            }}
          >
            ✕
          </span>
        </div>
      ))}
    </div>
  );
}
