import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Session } from "./types.js";

/** Lightweight metadata persisted for reopen/resume — not full command history/output. */
export interface PersistedSessionSummary {
  id: string;
  mode: Session["mode"];
  target: Session["target"];
  workspaceRoot?: string;
  createdAt: string;
}

export class SessionPersistence {
  constructor(private readonly filePath: string) {}

  async load(): Promise<PersistedSessionSummary[]> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as PersistedSessionSummary[];
    } catch {
      return [];
    }
  }

  async save(summaries: PersistedSessionSummary[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(summaries, null, 2), "utf-8");
  }

  static summarize(session: Session): PersistedSessionSummary {
    return {
      id: session.id,
      mode: session.mode,
      target: session.target,
      workspaceRoot: session.workspace?.root,
      createdAt: session.createdAt,
    };
  }
}
