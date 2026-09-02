import { useState } from "react";
import type { McpToolDescriptor } from "@jvmscope/core/browser";
import { SchemaForm } from "./SchemaForm.js";

/**
 * Arthas's `tt` tool is action-based (record / list / search / info / replay / delete) with
 * `action` required. Rather than make the user type an action name, the workflow is exposed
 * as explicit modes: record a method, list what was captured, then inspect or replay a call.
 */
const ACTIONS = [
  { key: "record", label: "Record", hint: "Capture calls of a method" },
  { key: "list", label: "List", hint: "Show captured calls" },
  { key: "info", label: "Inspect", hint: "Detail for one index" },
  { key: "replay", label: "Replay", hint: "Re-execute a captured call" },
] as const;

/** Each action needs only a subset of tt's parameters; the rest are hidden to keep it legible. */
const IRRELEVANT_FOR_LOOKUP = [
  "searchExpression",
  "classPattern",
  "methodPattern",
  "condition",
  "numberOfExecutions",
  "timeout",
  "regex",
  "maxMatchCount",
  "action",
];

const HIDDEN_BY_ACTION: Record<string, string[]> = {
  record: ["index", "searchExpression", "action"],
  list: [...IRRELEVANT_FOR_LOOKUP, "index"],
  info: IRRELEVANT_FOR_LOOKUP,
  replay: IRRELEVANT_FOR_LOOKUP,
};

export function TimeTunnelPanel({
  tool,
  submitting,
  onRun,
}: {
  tool: McpToolDescriptor;
  submitting: boolean;
  onRun: (params: Record<string, unknown>) => void;
}) {
  const [action, setAction] = useState<(typeof ACTIONS)[number]["key"]>("record");

  return (
    <div className="form">
      <div className="segmented">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            title={a.hint}
            className={a.key === action ? "active" : ""}
            onClick={() => setAction(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <SchemaForm
        // Remount on action change so fields reset cleanly to that action's defaults.
        key={action}
        tool={tool}
        submitting={submitting}
        initialValues={{ action }}
        hiddenFields={HIDDEN_BY_ACTION[action]}
        onSubmit={(params) => onRun({ ...params, action })}
      />
    </div>
  );
}
