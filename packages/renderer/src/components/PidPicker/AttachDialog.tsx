import { useEffect, useState } from "react";
import type { DiscoveredTarget } from "@jvmscope/core/browser";
import { requireBridge } from "../../api/bridge.js";
import { useSessionStore } from "../../state/store.js";
import { PodPicker } from "./PodPicker.js";

/**
 * Attach flow as a modal, so the PID table is not permanently occupying the window. It
 * closes itself once a session is attached.
 *
 * The caller hides the native editor view while this is open — an Electron WebContentsView
 * paints above all HTML, so a dialog cannot be drawn over it.
 */
export function AttachDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"local" | "pod">("local");
  const [podRef, setPodRef] = useState<{ namespace: string; pod: string; container?: string }>();
  const [targets, setTargets] = useState<DiscoveredTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachingPid, setAttachingPid] = useState<string>();
  const [error, setError] = useState<string>();
  const upsertSession = useSessionStore((s) => s.upsertSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  useEffect(() => {
    if (mode === "local") void refresh();
    // Pod mode waits for a namespace/pod selection before it can list anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      const result = await requireBridge().discovery.listTargets(
        mode === "local"
          ? { mode: "local" }
          : { mode: "pod", namespace: podRef?.namespace, pod: podRef?.pod, container: podRef?.container },
      );
      setTargets(result);
      if (result.length === 0) setError("No Java processes found. Is the target JVM running?");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function attach(target: DiscoveredTarget) {
    setError(undefined);
    const jarPath = await requireBridge().dialog.pickJar(
      target.displayName.endsWith(".jar") ? target.displayName : undefined,
    );
    if (!jarPath) return;

    setAttachingPid(target.pid);
    try {
      const session = await requireBridge().session.attach({
        target,
        jarPath,
        appName: `jvmscope-${target.pid}`,
      });
      upsertSession(session);
      setActiveSession(session.id);
      if (session.status === "error") {
        setError(session.error);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachingPid(undefined);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Attach to a Java process</h2>
          <button className="icon-button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-toolbar">
          <div className="segmented">
            <button className={mode === "local" ? "active" : ""} onClick={() => setMode("local")}>
              Local
            </button>
            <button className={mode === "pod" ? "active" : ""} onClick={() => setMode("pod")}>
              Pod
            </button>
          </div>
          {mode === "pod" && <PodPicker onSelect={setPodRef} />}
          <button onClick={refresh} disabled={loading || (mode === "pod" && !podRef)}>
            {loading ? "Scanning…" : "Refresh"}
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="modal-body">
          {targets.length === 0 && !loading ? (
            <p className="form-hint">No processes listed yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>PID</th>
                  <th>Main class / jar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.pid}>
                    <td>
                      <code>{t.pid}</code>
                    </td>
                    <td>{t.displayName}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="primary" onClick={() => attach(t)} disabled={attachingPid !== undefined}>
                        {attachingPid === t.pid ? "Attaching…" : "Attach"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="modal-footnote">
          You'll be asked to pick the process's jar — it is exploded and decompiled so the source can be browsed.
        </p>
      </div>
    </div>
  );
}
