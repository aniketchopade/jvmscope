import { copyFile } from "node:fs/promises";
import { copyFromPod } from "../kubectl/cp.js";
import type { KubectlOptions } from "../kubectl/exec.js";
import type { DiscoveredTarget } from "../session/types.js";

export interface JarLocation {
  /** Where the jar lives on the target: an absolute local path, or a path inside the pod. */
  path: string;
}

/**
 * Retrieves the target's jar onto the laptop at `localRawJarPath`.
 * `jarLocation.path` is resolved by the caller — automatic resolution from `jps -lv` output
 * is unreliable for fat jars/exploded WARs, so the session flow always offers a manual
 * file-picker override rather than guessing here.
 */
export async function retrieveJar(
  target: DiscoveredTarget,
  jarLocation: JarLocation,
  localRawJarPath: string,
  kubectlOpts?: KubectlOptions,
): Promise<void> {
  if (target.mode === "local") {
    await copyFile(jarLocation.path, localRawJarPath);
    return;
  }
  if (!target.podRef) {
    throw new Error(`Target ${target.pid} is mode=${target.mode} but has no podRef`);
  }
  await copyFromPod(target.podRef, jarLocation.path, localRawJarPath, kubectlOpts);
}
