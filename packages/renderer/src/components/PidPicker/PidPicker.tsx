import { requireBridge } from "../../api/bridge.js";
import { useState } from "react";
import type { DiscoveredTarget } from "@jvmscope/core/browser";
import { useSessionStore } from "../../state/store.js";
import { PodPicker } from "./PodPicker.js";

export function PidPicker() {
  const [mode, setMode] = useState<"local" | "pod">("local");
  const [podRef, setPodRef] = useState<{ namespace: string; pod: string; container?: string }>();
  const [targets, setTargets] = useState<DiscoveredTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachingPid, setAttachingPid] = useState<string>();
  const [error, setError] = useState<string>();
  const upsertSession = useSessionStore((s) => s.upsertSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

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

    // Automatic jar-path resolution from `jps -lv` output is unreliable for fat jars and
    // exploded WARs, so the user confirms the path. This uses a native dialog because
    // Electron does not implement window.prompt().
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
      if (session.status === "error") setError(session.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachingPid(undefined);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          <input type="radio" checked={mode === "local"} onChange={() => setMode("local")} /> Local
        </label>
        <label>
          <input type="radio" checked={mode === "pod"} onChange={() => setMode("pod")} /> Pod
        </label>
        {mode === "pod" && <PodPicker onSelect={setPodRef} />}
        <button onClick={refresh} disabled={loading || (mode === "pod" && !podRef)}>
          {loading ? "Refreshing…" : "Refresh PIDs"}
        </button>
      </div>

      {error && <div style={{ color: "var(--error)", fontSize: 12 }}>{error}</div>}

      {targets.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>PID</th>
              <th>Main class / jar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.pid}>
                <td>{t.pid}</td>
                <td>{t.displayName}</td>
                <td>
                  <button onClick={() => attach(t)} disabled={attachingPid === t.pid}>
                    {attachingPid === t.pid ? "Attaching…" : "Attach"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
