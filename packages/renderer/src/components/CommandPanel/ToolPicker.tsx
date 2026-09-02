import { useState } from "react";
import type { McpToolDescriptor } from "@jvmscope/core/browser";
import { SchemaForm } from "./SchemaForm.js";
import { describeTool } from "../../i18n/arthasLabels.js";

/**
 * Reaches the ~29 Arthas tools that have no dedicated panel (jad, sc, sm, thread, dashboard,
 * profiler, ognl, …). Selecting one renders its schema-driven form, so every tool the
 * connected Arthas exposes is usable without hardcoding any of them.
 */
export function ToolPicker({
  tools,
  submitting,
  onRun,
}: {
  tools: McpToolDescriptor[];
  submitting: boolean;
  onRun: (toolName: string, params: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const tool = tools.find((t) => t.name === selected);
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="form">
      <label className="field">
        <span className="field-label">Tool</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a tool…</option>
          {sorted.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {!tool && (
        <ul className="tool-list">
          {sorted.slice(0, 12).map((t) => {
            const description = describeTool(t.name, t.description);
            return (
              <li key={t.name}>
                <button className="link-button" onClick={() => setSelected(t.name)}>
                  {t.name}
                </button>
                {description && <span className="tool-list-desc"> — {description}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {tool && <SchemaForm key={tool.name} tool={tool} submitting={submitting} onSubmit={(p) => onRun(tool.name, p)} />}
    </div>
  );
}
