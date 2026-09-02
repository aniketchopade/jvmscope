import { execa } from "execa";
import type { DiscoveredTarget } from "../session/types.js";

/** Parses `jps -l` output into normalized targets. Skips the Jps process itself. */
export function parseJpsOutput(stdout: string, mode: "local" | "pod" = "local"): DiscoveredTarget[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [pid, ...rest] = line.split(/\s+/);
      return { pid, displayName: rest.join(" ") || "(no main class)" };
    })
    .filter((t) => !t.displayName.includes("sun.tools.jps.Jps"))
    .map((t) => ({ ...t, mode } as DiscoveredTarget));
}

export class LocalPidDiscovery {
  async listTargets(): Promise<DiscoveredTarget[]> {
    const { stdout } = await execa("jps", ["-l"]);
    return parseJpsOutput(stdout, "local");
  }
}
