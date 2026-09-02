import { useEffect, useRef } from "react";
import { requireBridge } from "../../api/bridge.js";

/**
 * Placeholder whose screen bounds drive the native code-server view in the main process.
 *
 * The editor is an Electron WebContentsView, which always paints ON TOP of HTML — no dialog
 * or drawer can overlay it. So panels resize this element (ResizeObserver re-reports bounds)
 * and anything that must appear above the editor sets `visible={false}`, which detaches the
 * native view entirely.
 */
export function EditorPane({ sessionId, visible }: { sessionId: string; visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!visible) {
      void requireBridge().editor.hide(sessionId);
      return;
    }

    const report = () => {
      const rect = el.getBoundingClientRect();
      void requireBridge().editor.show(sessionId, {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener("resize", report);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [sessionId, visible]);

  // Hidden on unmount so a closed tab does not leave its native view attached.
  useEffect(() => {
    return () => {
      void requireBridge().editor.hide(sessionId);
    };
  }, [sessionId]);

  return <div ref={ref} className="editor-pane" />;
}
