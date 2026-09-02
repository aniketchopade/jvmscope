import { ipcMain } from "electron";
import { LocalPidDiscovery, KubectlPidDiscovery, listNamespaces, listPods } from "@jvmscope/core";
import type { DiscoverOptions } from "@jvmscope/preload";

export function registerDiscoveryHandlers(): void {
  const local = new LocalPidDiscovery();
  const kubectl = new KubectlPidDiscovery();

  ipcMain.handle("discovery:list-targets", async (_event, opts: DiscoverOptions) => {
    if (opts.mode === "local") return local.listTargets();
    if (!opts.namespace || !opts.pod) throw new Error("namespace and pod are required for pod-mode discovery");
    return kubectl.listTargets({ namespace: opts.namespace, pod: opts.pod, container: opts.container });
  });

  ipcMain.handle("discovery:list-namespaces", async () => listNamespaces());

  ipcMain.handle("discovery:list-pods", async (_event, namespace: string) => listPods(namespace));
}
