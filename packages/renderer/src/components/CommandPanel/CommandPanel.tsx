import { useState } from "react";
import type { Session } from "@jvmscope/core/browser";
import { requireBridge } from "../../api/bridge.js";
import { SchemaForm } from "./SchemaForm.js";
import { TimeTunnelPanel } from "./TimeTunnelPanel.js";
import { ToolPicker } from "./ToolPicker.js";
import type { PanelKey } from "../SessionView/SessionView.js";

const TOOL_FOR_PANEL: Partial<Record<PanelKey, string>> = {
  watch: "watch",
  trace: "trace",
  tt: "tt",
};

export function CommandPanel({ session, panel }: { session: Session; panel: PanelKey }) {
  const [submitting, setSubmitting] = useState(false);
  const tools = session.mcp?.toolCatalog ?? [];

  async function run(toolName: string, params: Record<string, unknown>) {
    setSubmitting(true);
    try {
      await requireBridge().mcp.callTool(session.id, toolName, params);
    } finally {
      setSubmitting(false);
    }
  }

  if (panel === "other") {
    return <ToolPicker tools={tools} submitting={submitting} onRun={run} />;
  }

  const toolName = TOOL_FOR_PANEL[panel]!;
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return <p className="form-hint">Tool "{toolName}" is not in this session's catalog ({tools.length} available).</p>;
  }

  if (panel === "tt") {
    return <TimeTunnelPanel tool={tool} submitting={submitting} onRun={(p) => run("tt", p)} />;
  }

  return <SchemaForm tool={tool} submitting={submitting} onSubmit={(p) => run(tool.name, p)} />;
}
