import { execa } from "execa";
import type { PodRef } from "../session/types.js";

export interface KubectlOptions {
  context?: string;
}

function contextArgs(opts?: KubectlOptions): string[] {
  return opts?.context ? ["--context", opts.context] : [];
}

/** Runs `kubectl exec` in the target pod/container and returns stdout. */
export async function kubectlExec(
  ref: PodRef,
  command: string[],
  opts?: KubectlOptions,
): Promise<string> {
  const args = [
    ...contextArgs(opts),
    "exec",
    "-n",
    ref.namespace,
    ref.pod,
    ...(ref.container ? ["-c", ref.container] : []),
    "--",
    ...command,
  ];
  const { stdout } = await execa("kubectl", args);
  return stdout;
}

/** Like kubectlExec but does not throw on non-zero exit — used for capability probes (e.g. does `tar` exist). */
export async function kubectlExecProbe(
  ref: PodRef,
  command: string[],
  opts?: KubectlOptions,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const args = [
    ...contextArgs(opts),
    "exec",
    "-n",
    ref.namespace,
    ref.pod,
    ...(ref.container ? ["-c", ref.container] : []),
    "--",
    ...command,
  ];
  const result = await execa("kubectl", args, { reject: false });
  return { exitCode: result.exitCode ?? -1, stdout: result.stdout, stderr: result.stderr };
}
