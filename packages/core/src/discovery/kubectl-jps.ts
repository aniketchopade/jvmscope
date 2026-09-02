import type { KubectlOptions } from "../kubectl/exec.js";
import { kubectlExec } from "../kubectl/exec.js";
import type { DiscoveredTarget, PodRef } from "../session/types.js";
import { parseJpsOutput } from "./local-jps.js";

export class KubectlPidDiscovery {
  async listTargets(ref: PodRef, opts?: KubectlOptions): Promise<DiscoveredTarget[]> {
    const stdout = await kubectlExec(ref, ["jps", "-l"], opts);
    return parseJpsOutput(stdout, "pod").map((t) => ({ ...t, podRef: ref }));
  }
}
