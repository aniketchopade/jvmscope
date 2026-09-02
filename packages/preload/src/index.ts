import { contextBridge, ipcRenderer } from "electron";
import type { CommandRecord, DiscoveredTarget, Session } from "@jvmscope/core";

export interface DiscoverOptions {
  mode: "local" | "pod";
  namespace?: string;
  pod?: string;
  container?: string;
}

export interface AttachOptions {
  target: DiscoveredTarget;
  jarPath: string;
  appName: string;
}

export interface EditorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The only surface the renderer can reach into main/Node through — contextIsolation is on
 * and nodeIntegration is off, so the renderer never touches child_process/fs/kubectl directly.
 */
const api = {
  discovery: {
    listTargets: (opts: DiscoverOptions): Promise<DiscoveredTarget[]> => ipcRenderer.invoke("discovery:list-targets", opts),
    listNamespaces: (): Promise<string[]> => ipcRenderer.invoke("discovery:list-namespaces"),
    listPods: (namespace: string): Promise<{ name: string; containers: string[] }[]> =>
      ipcRenderer.invoke("discovery:list-pods", namespace),
  },
  session: {
    attach: (opts: AttachOptions): Promise<Session> => ipcRenderer.invoke("session:attach", opts),
    list: (): Promise<Session[]> => ipcRenderer.invoke("session:list"),
    close: (sessionId: string): Promise<void> => ipcRenderer.invoke("session:close", sessionId),
    onStatusChanged: (cb: (sessionId: string, status: Session["status"]) => void): (() => void) => {
      const listener = (_event: unknown, sessionId: string, status: Session["status"]) => cb(sessionId, status);
      ipcRenderer.on("session:status-changed", listener);
      return () => ipcRenderer.removeListener("session:status-changed", listener);
    },
  },
  mcp: {
    callTool: (sessionId: string, tool: string, params: Record<string, unknown>): Promise<CommandRecord> =>
      ipcRenderer.invoke("mcp:call-tool", sessionId, tool, params),
    onCommandChunk: (cb: (sessionId: string, record: CommandRecord, chunk: string) => void): (() => void) => {
      const listener = (_event: unknown, sessionId: string, record: CommandRecord, chunk: string) =>
        cb(sessionId, record, chunk);
      ipcRenderer.on("mcp:command-chunk", listener);
      return () => ipcRenderer.removeListener("mcp:command-chunk", listener);
    },
  },
  dialog: {
    /** Native open dialog — Electron has no window.prompt(). Resolves undefined if cancelled. */
    pickJar: (defaultPath?: string): Promise<string | undefined> => ipcRenderer.invoke("dialog:pick-jar", defaultPath),
  },
  editor: {
    show: (sessionId: string, bounds: EditorBounds): Promise<void> => ipcRenderer.invoke("editor:show", sessionId, bounds),
    setBounds: (sessionId: string, bounds: EditorBounds): Promise<void> =>
      ipcRenderer.invoke("editor:set-bounds", sessionId, bounds),
    hide: (sessionId: string): Promise<void> => ipcRenderer.invoke("editor:hide", sessionId),
  },
};

export type JvmScopeApi = typeof api;

contextBridge.exposeInMainWorld("jvmscope", api);
