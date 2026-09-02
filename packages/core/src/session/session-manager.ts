import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Settings } from "../config/settings.js";
import { attachLocal } from "../attach/local-attach.js";
import { attachInPod } from "../attach/kubectl-attach.js";
import { retrieveJar, type JarLocation } from "../jar-pipeline/retrieve.js";
import { explodeJar } from "../jar-pipeline/explode.js";
import { decompileJar, decompileClassesDir } from "../jar-pipeline/decompile.js";
import { createSessionWorkspace } from "../jar-pipeline/workspace-layout.js";
import { sha256File, isCached } from "../jar-pipeline/cache.js";
import { CodeServerManager, type CodeServerBinary } from "../codeserver/manager.js";
import { ArthasMcpClient } from "../mcp/client.js";
import { ToolCatalog } from "../mcp/tool-catalog.js";
import { runCommand } from "../mcp/command-runner.js";
import type { CommandRecord, DiscoveredTarget, Session, SessionStatus } from "./types.js";
import type { KubectlOptions } from "../kubectl/exec.js";

export interface AttachRequest {
  target: DiscoveredTarget;
  jarLocation: JarLocation;
  appName: string;
  codeServerBinary: CodeServerBinary;
  kubectlOpts?: KubectlOptions;
  /** Phase 3 only: bootstraps the pod agent with --tunnel-server instead of a plain kubectl exec. */
  tunnelServerWsUrl?: string;
  /** Phase 2 only: local port a kubectl port-forward bridge exposes the pod's Arthas HTTP port on. */
  localForwardedPort?: number;
}

type SessionEvents = {
  "status-changed": [sessionId: string, status: SessionStatus];
  "command-chunk": [sessionId: string, record: CommandRecord, chunk: string];
};

/**
 * Owns the per-session state machine:
 * discovering -> attaching -> fetching-jar -> exploding -> decompiling ->
 * starting-editor -> connecting-mcp -> ready (or error at any step).
 * Drives the AttachProgress UI via "status-changed" events and relays streamed MCP
 * output via "command-chunk" events.
 */
export class SessionManager extends EventEmitter<SessionEvents> {
  private sessions = new Map<string, Session>();
  private mcpClients = new Map<string, ArthasMcpClient>();
  private toolCatalogs = new Map<string, ToolCatalog>();
  private codeServerManager = new CodeServerManager();

  constructor(private readonly settings: Settings) {
    super();
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async attach(request: AttachRequest): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      mode: request.target.mode,
      target: request.target,
      status: "attaching",
      commandLog: [],
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);

    try {
      await this.runAttachPipeline(session, request);
      this.setStatus(session, "ready");
    } catch (err) {
      session.error = err instanceof Error ? err.message : String(err);
      this.setStatus(session, "error");
    }

    return session;
  }

  private async runAttachPipeline(session: Session, request: AttachRequest): Promise<void> {
    this.setStatus(session, "attaching");
    const attachResult =
      session.mode === "local"
        ? await attachLocal(session.target.pid, {
            arthasBootJarPath: this.settings.arthasBootJarPath,
            httpPort: this.settings.defaultHttpPort,
            repoMirror: this.settings.repoMirror,
          })
        : await attachInPod(
            session.target.podRef!,
            session.target.pid,
            {
              remoteArthasBootJarPath: this.settings.arthasBootJarPath,
              httpPort: this.settings.defaultHttpPort,
              appName: request.appName,
              tunnelServerWsUrl: request.tunnelServerWsUrl,
              localForwardedPort: request.localForwardedPort,
            },
            request.kubectlOpts,
          );

    this.setStatus(session, "fetching-jar");
    const workspace = await createSessionWorkspace(this.settings.workspaceRoot, session.id);
    session.workspace = workspace;
    const rawJarPath = `${workspace.rawDir}/target.jar`;
    await retrieveJar(session.target, request.jarLocation, rawJarPath, request.kubectlOpts);
    const sha256 = await sha256File(rawJarPath);
    session.jarSource = { originPath: request.jarLocation.path, localRawJarPath: rawJarPath, sha256 };

    const decompiledMarker = `${workspace.srcDir}/.decompiled-${sha256}`;
    const alreadyDecompiled = await isCached(decompiledMarker);

    if (!alreadyDecompiled) {
      this.setStatus(session, "exploding");
      // Exploding gives the user resources/META-INF in the workspace and tells us whether
      // application classes sit at the jar root or under a fat jar's BOOT-INF/classes.
      const { classesDir, isFatJar } = await explodeJar(rawJarPath, workspace.explodedDir);

      this.setStatus(session, "decompiling");
      // CFR cannot read a directory, so a fat jar's classes dir is re-packed into a temp jar;
      // a plain jar is decompiled directly from the original archive.
      if (isFatJar) {
        await decompileClassesDir(classesDir, workspace.srcDir, { cfrJarPath: this.settings.cfrJarPath });
      } else {
        await decompileJar(rawJarPath, workspace.srcDir, { cfrJarPath: this.settings.cfrJarPath });
      }
      const { writeFile } = await import("node:fs/promises");
      await writeFile(decompiledMarker, "");
    }

    this.setStatus(session, "starting-editor");
    const codeServer = await this.codeServerManager.spawn(session.id, workspace.srcDir, request.codeServerBinary);
    session.codeServer = codeServer;

    this.setStatus(session, "connecting-mcp");
    const mcpClient = new ArthasMcpClient(attachResult.mcpEndpoint);
    await mcpClient.connect();
    this.mcpClients.set(session.id, mcpClient);

    const toolCatalog = new ToolCatalog();
    const tools = await toolCatalog.refresh(mcpClient);
    this.toolCatalogs.set(session.id, toolCatalog);

    session.mcp = { endpoint: attachResult.mcpEndpoint, connected: true, toolCatalog: tools };
  }

  async runCommand(sessionId: string, tool: string, params: Record<string, unknown>): Promise<CommandRecord> {
    const session = this.requireSession(sessionId);
    const client = this.mcpClients.get(sessionId);
    if (!client) throw new Error(`Session ${sessionId} has no connected MCP client`);

    const record = await runCommand(client, tool, params, (rec, chunk) => {
      this.emit("command-chunk", sessionId, rec, chunk);
    });
    session.commandLog.push(record);
    return record;
  }

  async close(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    await this.mcpClients.get(sessionId)?.disconnect();
    this.mcpClients.delete(sessionId);
    this.toolCatalogs.delete(sessionId);
    this.codeServerManager.stop(sessionId);
    this.setStatus(session, "closed");
  }

  private requireSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown session ${sessionId}`);
    return session;
  }

  private setStatus(session: Session, status: SessionStatus): void {
    session.status = status;
    this.emit("status-changed", session.id, status);
  }
}
