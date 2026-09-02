import { execa } from "execa";
import { createWriteStream } from "node:fs";
import type { KubectlOptions } from "./exec.js";
import { kubectlExecProbe } from "./exec.js";
import type { PodRef } from "../session/types.js";

/**
 * Copies a file out of a pod to the laptop. `kubectl cp` requires `tar` in the container;
 * slim/distroless images often lack it, so we probe first and fall back to streaming
 * `kubectl exec cat <path>` into a local file, which only needs a shell + cat.
 */
export async function copyFromPod(
  ref: PodRef,
  remotePath: string,
  localPath: string,
  opts?: KubectlOptions,
): Promise<void> {
  const probe = await kubectlExecProbe(ref, ["sh", "-c", "command -v tar"], opts);
  if (probe.exitCode === 0) {
    const args = [
      ...(opts?.context ? ["--context", opts.context] : []),
      "cp",
      `${ref.namespace}/${ref.pod}:${remotePath}`,
      localPath,
      ...(ref.container ? ["-c", ref.container] : []),
    ];
    await execa("kubectl", args);
    return;
  }

  const args = [
    ...(opts?.context ? ["--context", opts.context] : []),
    "exec",
    "-n",
    ref.namespace,
    ref.pod,
    ...(ref.container ? ["-c", ref.container] : []),
    "--",
    "cat",
    remotePath,
  ];
  const subprocess = execa("kubectl", args, { stdout: "pipe" });
  const out = createWriteStream(localPath);
  subprocess.stdout?.pipe(out);
  await subprocess;
  await new Promise<void>((resolve, reject) => {
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
}
