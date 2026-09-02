import { execa } from "execa";
import type { KubectlOptions } from "./exec.js";

export interface PodSummary {
  name: string;
  namespace: string;
  containers: string[];
}

export async function listNamespaces(opts?: KubectlOptions): Promise<string[]> {
  const args = [...(opts?.context ? ["--context", opts.context] : []), "get", "namespaces", "-o", "name"];
  const { stdout } = await execa("kubectl", args);
  return stdout
    .split("\n")
    .map((l) => l.replace(/^namespace\//, "").trim())
    .filter(Boolean);
}

export async function listPods(namespace: string, opts?: KubectlOptions): Promise<PodSummary[]> {
  const args = [
    ...(opts?.context ? ["--context", opts.context] : []),
    "get",
    "pods",
    "-n",
    namespace,
    "-o",
    "json",
  ];
  const { stdout } = await execa("kubectl", args);
  const parsed = JSON.parse(stdout) as {
    items: { metadata: { name: string }; spec: { containers: { name: string }[] } }[];
  };
  return parsed.items.map((item) => ({
    name: item.metadata.name,
    namespace,
    containers: item.spec.containers.map((c) => c.name),
  }));
}
