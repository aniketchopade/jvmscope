import { useState } from "react";
import type { McpToolDescriptor } from "@jvmscope/core/browser";
import { describeParam, describeTool, labelForParam, PARAM_DEFAULTS, PRIMARY_PARAMS } from "../../i18n/arthasLabels.js";

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
}

/**
 * Builds a form from a tool's live JSON Schema, so the panels stay correct across Arthas
 * versions. Labels/descriptions come from our English dictionary rather than the upstream
 * Chinese text; rarely-used parameters are tucked behind "Advanced" so the common case is
 * two fields and a button.
 */
export function SchemaForm({
  tool,
  onSubmit,
  submitting,
  initialValues,
  hiddenFields,
}: {
  tool: McpToolDescriptor;
  onSubmit: (params: Record<string, unknown>) => void;
  submitting: boolean;
  initialValues?: Record<string, unknown>;
  hiddenFields?: string[];
}) {
  const properties = (tool.inputSchema.properties as Record<string, JsonSchemaProperty> | undefined) ?? {};
  const required = new Set((tool.inputSchema.required as string[] | undefined) ?? []);
  const [values, setValues] = useState<Record<string, unknown>>({
    ...PARAM_DEFAULTS[tool.name],
    ...initialValues,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const visible = Object.entries(properties).filter(([key]) => !hiddenFields?.includes(key));
  const primary = visible.filter(([key]) => PRIMARY_PARAMS.has(key) || required.has(key));
  const advanced = visible.filter(([key]) => !PRIMARY_PARAMS.has(key) && !required.has(key));

  const missingRequired = [...required].filter((key) => {
    const v = values[key];
    return !hiddenFields?.includes(key) && (v === undefined || v === "");
  });

  function submit() {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value === "" || value === undefined) continue;
      params[key] = value;
    }
    onSubmit(params);
  }

  const description = describeTool(tool.name, tool.description);

  return (
    <div className="form">
      {description && <p className="form-hint">{description}</p>}

      {primary.map(([key, schema]) => (
        <Field
          key={key}
          name={key}
          schema={schema}
          required={required.has(key)}
          value={values[key]}
          onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
        />
      ))}

      {advanced.length > 0 && (
        <button type="button" className="link-button" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide" : "Show"} advanced ({advanced.length})
        </button>
      )}

      {showAdvanced &&
        advanced.map(([key, schema]) => (
          <Field
            key={key}
            name={key}
            schema={schema}
            required={false}
            value={values[key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
          />
        ))}

      <button className="primary" onClick={submit} disabled={submitting || missingRequired.length > 0}>
        {submitting
          ? "Running…"
          : missingRequired.length > 0
            ? `Enter ${missingRequired.map(labelForParam).join(", ")}`
            : `Run ${tool.name}`}
      </button>
    </div>
  );
}

function Field({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string;
  schema: JsonSchemaProperty;
  required: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const hint = describeParam(name, schema.description);

  if (schema.type === "boolean") {
    return (
      <label className="field field-inline" title={hint}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{labelForParam(name)}</span>
      </label>
    );
  }

  return (
    <label className="field">
      <span className="field-label">
        {labelForParam(name)}
        {required && <span className="required">*</span>}
      </span>
      <input
        type={schema.type === "integer" || schema.type === "number" ? "number" : "text"}
        value={value === undefined ? "" : String(value)}
        placeholder={hint ?? (schema.default !== undefined ? String(schema.default) : "")}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          onChange(schema.type === "integer" || schema.type === "number" ? Number(raw) : raw);
        }}
      />
    </label>
  );
}
