import { requireBridge } from "../../api/bridge.js";
import { useEffect, useState } from "react";

export interface PodSelection {
  namespace: string;
  pod: string;
  container?: string;
}

export function PodPicker({ onSelect }: { onSelect: (selection: PodSelection | undefined) => void }) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState<string>("");
  const [pods, setPods] = useState<{ name: string; containers: string[] }[]>([]);
  const [pod, setPod] = useState<string>("");
  const [container, setContainer] = useState<string>("");

  useEffect(() => {
    requireBridge().discovery.listNamespaces().then(setNamespaces);
  }, []);

  useEffect(() => {
    if (!namespace) {
      setPods([]);
      return;
    }
    requireBridge().discovery.listPods(namespace).then(setPods);
  }, [namespace]);

  useEffect(() => {
    if (!namespace || !pod) {
      onSelect(undefined);
      return;
    }
    onSelect({ namespace, pod, container: container || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, pod, container]);

  const containers = pods.find((p) => p.name === pod)?.containers ?? [];

  return (
    <>
      <select value={namespace} onChange={(e) => { setNamespace(e.target.value); setPod(""); }}>
        <option value="">namespace…</option>
        {namespaces.map((ns) => (
          <option key={ns} value={ns}>
            {ns}
          </option>
        ))}
      </select>
      <select value={pod} onChange={(e) => setPod(e.target.value)} disabled={!namespace}>
        <option value="">pod…</option>
        {pods.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      {containers.length > 1 && (
        <select value={container} onChange={(e) => setContainer(e.target.value)}>
          <option value="">container…</option>
          {containers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
